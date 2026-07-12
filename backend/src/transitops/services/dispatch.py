"""THE rule engine (00_MASTER_PLAN §5).

Every status transition in the product runs through here, and each one is a single transaction
that first takes row locks on the vehicle and the driver (`SELECT ... FOR UPDATE`). That is what
makes double-dispatch impossible even with the simulator mutating rows concurrently: two
dispatches of the same vehicle serialize, and the loser re-reads `on_trip` and is rejected.

Guards are re-checked inside the locked transaction rather than trusted from the earlier read —
the dispatchable/assignable list endpoints are a UX filter, never the enforcement point.

SQLite note: its dialect compiles `FOR UPDATE` to nothing (single-writer anyway), so the same
code path runs unchanged against the SQLite fallback.
"""

import uuid
from datetime import UTC, date, datetime

from sqlalchemy import select
from sqlalchemy.orm import Session

from transitops.core import events
from transitops.core.errors import AppError, NotFound
from transitops.models.driver import Driver
from transitops.models.enums import (
    DriverStatus,
    MaintenanceStatus,
    TripStatus,
    VehicleStatus,
)
from transitops.models.fuel_log import FuelLog
from transitops.models.maintenance_log import MaintenanceLog
from transitops.models.trip import Trip
from transitops.models.vehicle import Vehicle


def _lock_vehicle(db: Session, vehicle_id: uuid.UUID) -> Vehicle:
    vehicle = db.scalar(select(Vehicle).where(Vehicle.id == vehicle_id).with_for_update())
    if vehicle is None:
        raise NotFound("Vehicle", vehicle_id)
    return vehicle


def _lock_driver(db: Session, driver_id: uuid.UUID) -> Driver:
    driver = db.scalar(select(Driver).where(Driver.id == driver_id).with_for_update())
    if driver is None:
        raise NotFound("Driver", driver_id)
    return driver


# --- Guards (00 §5) ---------------------------------------------------------------------------


def check_vehicle_assignable(vehicle: Vehicle) -> None:
    """Retired / in-shop / already-on-trip vehicles are never dispatchable."""
    if vehicle.status == VehicleStatus.ON_TRIP:
        raise AppError(
            "VEHICLE_NOT_AVAILABLE",
            f"{vehicle.registration_number} is already on a trip",
            fields={"vehicle_id": "Vehicle is on another trip"},
        )
    if vehicle.status == VehicleStatus.IN_SHOP:
        raise AppError(
            "VEHICLE_NOT_AVAILABLE",
            f"{vehicle.registration_number} is in the shop for maintenance",
            fields={"vehicle_id": "Vehicle is in maintenance"},
        )
    if vehicle.status == VehicleStatus.RETIRED:
        raise AppError(
            "VEHICLE_NOT_AVAILABLE",
            f"{vehicle.registration_number} is retired",
            fields={"vehicle_id": "Vehicle is retired"},
        )


def check_driver_assignable(driver: Driver, today: date | None = None) -> None:
    """Suspended, off-duty, on-trip, or expired-license drivers are never assignable."""
    today = today or datetime.now(UTC).date()

    if driver.status == DriverStatus.SUSPENDED:
        raise AppError(
            "DRIVER_SUSPENDED",
            f"{driver.name} is suspended and cannot be assigned",
            fields={"driver_id": "Driver is suspended"},
        )
    if driver.status == DriverStatus.ON_TRIP:
        raise AppError(
            "DRIVER_NOT_AVAILABLE",
            f"{driver.name} is already on a trip",
            fields={"driver_id": "Driver is on another trip"},
        )
    if driver.status == DriverStatus.OFF_DUTY:
        raise AppError(
            "DRIVER_NOT_AVAILABLE",
            f"{driver.name} is off duty",
            fields={"driver_id": "Driver is off duty"},
        )
    if driver.license_expiry_date < today:
        raise AppError(
            "LICENSE_EXPIRED",
            f"{driver.name}'s licence expired on {driver.license_expiry_date:%d %b %Y}",
            fields={"driver_id": "Driver's licence has expired"},
        )


def check_cargo_fits(vehicle: Vehicle, cargo_weight_kg: float) -> None:
    """The demo's deliberate-failure moment: 700 kg into a 500 kg van → 422."""
    capacity = float(vehicle.max_load_capacity_kg)
    if float(cargo_weight_kg) > capacity:
        raise AppError(
            "CARGO_EXCEEDS_CAPACITY",
            f"Cargo weight {cargo_weight_kg:g} kg exceeds "
            f"{vehicle.registration_number} capacity ({capacity:g} kg)",
            fields={"cargo_weight_kg": f"Must be ≤ {capacity:g}"},
        )


def validate_assignment(
    db: Session, vehicle_id: uuid.UUID, driver_id: uuid.UUID, cargo_weight_kg: float
) -> tuple[Vehicle, Driver]:
    """All three guards, without locking — used by POST/PATCH /trips so the wizard fails fast."""
    vehicle = db.get(Vehicle, vehicle_id)
    if vehicle is None:
        raise NotFound("Vehicle", vehicle_id)
    driver = db.get(Driver, driver_id)
    if driver is None:
        raise NotFound("Driver", driver_id)

    check_vehicle_assignable(vehicle)
    check_driver_assignable(driver)
    check_cargo_fits(vehicle, cargo_weight_kg)
    return vehicle, driver


# --- Transitions ------------------------------------------------------------------------------


def dispatch_trip(db: Session, trip: Trip) -> Trip:
    """draft → dispatched; vehicle and driver both → on_trip. One locked transaction."""
    if trip.status != TripStatus.DRAFT:
        raise AppError(
            "TRIP_NOT_DRAFT",
            f"Only draft trips can be dispatched (this one is {trip.status.value})",
            fields={"status": "Trip is not a draft"},
        )

    # Lock in a stable order (vehicle then driver) — two concurrent dispatches touching the same
    # pair can't deadlock by grabbing the locks in opposite orders.
    vehicle = _lock_vehicle(db, trip.vehicle_id)
    driver = _lock_driver(db, trip.driver_id)

    check_vehicle_assignable(vehicle)
    check_driver_assignable(driver)
    check_cargo_fits(vehicle, float(trip.cargo_weight_kg))

    vehicle.status = VehicleStatus.ON_TRIP
    driver.status = DriverStatus.ON_TRIP
    trip.status = TripStatus.DISPATCHED
    trip.dispatched_at = datetime.now(UTC)
    trip.progress_percent = 0

    db.commit()
    db.refresh(trip)

    _publish_after_commit(
        events.TRIP_DISPATCHED,
        trip=trip,
        vehicle=vehicle,
        driver=driver,
    )
    return trip


def complete_trip(
    db: Session,
    trip: Trip,
    actual_distance_km: float,
    final_odometer_km: float,
    user_id: uuid.UUID,
    fuel: dict | None = None,
) -> Trip:
    """dispatched → completed; both statuses restored, odometer updated, optional fuel log."""
    if trip.status == TripStatus.COMPLETED:
        raise AppError(
            "TRIP_ALREADY_COMPLETED",
            "This trip is already completed",
            fields={"status": "Trip is already completed"},
        )
    if trip.status != TripStatus.DISPATCHED:
        raise AppError(
            "TRIP_NOT_DISPATCHED",
            f"Only dispatched trips can be completed (this one is {trip.status.value})",
            fields={"status": "Trip is not dispatched"},
        )

    vehicle = _lock_vehicle(db, trip.vehicle_id)
    driver = _lock_driver(db, trip.driver_id)

    if float(final_odometer_km) < float(vehicle.odometer_km):
        raise AppError(
            "ODOMETER_REGRESSION",
            f"Final odometer {final_odometer_km:g} km is below the vehicle's current reading "
            f"({float(vehicle.odometer_km):g} km)",
            fields={"final_odometer_km": f"Must be ≥ {float(vehicle.odometer_km):g}"},
        )

    now = datetime.now(UTC)
    trip.status = TripStatus.COMPLETED
    trip.actual_distance_km = actual_distance_km
    trip.completed_at = now
    trip.progress_percent = 100

    vehicle.odometer_km = final_odometer_km
    # A vehicle sent to the shop mid-trip (or retired) must not be flipped back to available.
    vehicle.status = (
        vehicle.status
        if vehicle.status in (VehicleStatus.IN_SHOP, VehicleStatus.RETIRED)
        else VehicleStatus.AVAILABLE
    )
    driver.status = (
        DriverStatus.SUSPENDED
        if driver.status == DriverStatus.SUSPENDED
        else DriverStatus.AVAILABLE
    )

    if fuel:
        db.add(
            FuelLog(
                vehicle_id=vehicle.id,
                trip_id=trip.id,
                liters=fuel["liters"],
                cost=fuel["cost"],
                odometer_at_fill=final_odometer_km,
                logged_at=now,
                created_by=user_id,
            )
        )

    db.commit()
    db.refresh(trip)

    _publish_after_commit(events.TRIP_COMPLETED, trip=trip, vehicle=vehicle, driver=driver)
    if fuel:
        events.hub.publish(
            events.FUEL_LOGGED, vehicle_id=str(vehicle.id), trip_id=str(trip.id)
        )
    return trip


def cancel_trip(db: Session, trip: Trip) -> Trip:
    """draft or dispatched → cancelled; a dispatched trip releases its vehicle and driver."""
    if trip.status == TripStatus.COMPLETED:
        raise AppError(
            "TRIP_ALREADY_COMPLETED",
            "A completed trip cannot be cancelled",
            fields={"status": "Trip is already completed"},
        )
    if trip.status == TripStatus.CANCELLED:
        raise AppError(
            "TRIP_ALREADY_CANCELLED",
            "This trip is already cancelled",
            fields={"status": "Trip is already cancelled"},
        )

    was_dispatched = trip.status == TripStatus.DISPATCHED
    vehicle = _lock_vehicle(db, trip.vehicle_id)
    driver = _lock_driver(db, trip.driver_id)

    trip.status = TripStatus.CANCELLED
    trip.progress_percent = 0

    if was_dispatched:
        # Only release resources this trip actually holds. A draft trip never held them, and a
        # vehicle moved to the shop while the trip ran stays in the shop.
        if vehicle.status == VehicleStatus.ON_TRIP:
            vehicle.status = VehicleStatus.AVAILABLE
        if driver.status == DriverStatus.ON_TRIP:
            driver.status = DriverStatus.AVAILABLE

    db.commit()
    db.refresh(trip)

    _publish_after_commit(events.TRIP_CANCELLED, trip=trip, vehicle=vehicle, driver=driver)
    return trip


# --- Maintenance side effects (00 §5) ---------------------------------------------------------


def open_maintenance(
    db: Session,
    vehicle_id: uuid.UUID,
    maintenance_type,
    description: str | None,
    cost: float,
) -> MaintenanceLog:
    """Opening maintenance sends the vehicle to the shop — which hides it from dispatch."""
    vehicle = _lock_vehicle(db, vehicle_id)

    if vehicle.status == VehicleStatus.ON_TRIP:
        raise AppError(
            "VEHICLE_ON_TRIP",
            f"{vehicle.registration_number} is on a trip and cannot enter maintenance",
            fields={"vehicle_id": "Vehicle is currently on a trip"},
        )

    log = MaintenanceLog(
        vehicle_id=vehicle.id,
        maintenance_type=maintenance_type,
        description=description,
        cost=cost,
        status=MaintenanceStatus.OPEN,
        opened_at=datetime.now(UTC),
    )
    db.add(log)

    if vehicle.status != VehicleStatus.RETIRED:
        vehicle.status = VehicleStatus.IN_SHOP

    db.commit()
    db.refresh(log)

    events.hub.publish(
        events.MAINTENANCE_OPENED, maintenance_id=str(log.id), vehicle_id=str(vehicle.id)
    )
    events.hub.publish(
        events.VEHICLE_STATUS_CHANGED, vehicle_id=str(vehicle.id), status=vehicle.status.value
    )
    events.hub.publish(events.KPI_REFRESH)
    return log


def close_maintenance(db: Session, log: MaintenanceLog, cost: float) -> MaintenanceLog:
    """Closing returns the vehicle to available — unless it was retired in the meantime."""
    if log.status == MaintenanceStatus.CLOSED:
        raise AppError(
            "MAINTENANCE_ALREADY_CLOSED",
            "This maintenance job is already closed",
            fields={"status": "Already closed"},
        )

    vehicle = _lock_vehicle(db, log.vehicle_id)

    log.status = MaintenanceStatus.CLOSED
    log.cost = cost
    log.closed_at = datetime.now(UTC)

    # Another job may still be open on this vehicle — it stays in the shop until the last closes.
    still_open = db.scalar(
        select(MaintenanceLog.id).where(
            MaintenanceLog.vehicle_id == vehicle.id,
            MaintenanceLog.status == MaintenanceStatus.OPEN,
            MaintenanceLog.id != log.id,
        )
    )
    if not still_open and vehicle.status == VehicleStatus.IN_SHOP:
        vehicle.status = VehicleStatus.AVAILABLE

    db.commit()
    db.refresh(log)

    events.hub.publish(
        events.MAINTENANCE_CLOSED, maintenance_id=str(log.id), vehicle_id=str(vehicle.id)
    )
    events.hub.publish(
        events.VEHICLE_STATUS_CHANGED, vehicle_id=str(vehicle.id), status=vehicle.status.value
    )
    events.hub.publish(events.KPI_REFRESH)
    return log


def _publish_after_commit(name: str, trip: Trip, vehicle: Vehicle, driver: Driver) -> None:
    events.hub.publish(
        name,
        trip_id=str(trip.id),
        status=trip.status.value,
        vehicle_id=str(vehicle.id),
        driver_id=str(driver.id),
    )
    events.hub.publish(
        events.VEHICLE_STATUS_CHANGED, vehicle_id=str(vehicle.id), status=vehicle.status.value
    )
    events.hub.publish(
        events.DRIVER_STATUS_CHANGED, driver_id=str(driver.id), status=driver.status.value
    )
    events.hub.publish(events.KPI_REFRESH)
