"""Computed analytics — the "views" of docs/03 §3, done as service queries.

Nothing here is stored: op cost, efficiency, utilization, ROI and health are all derived on read,
so they can never drift out of sync with the rows they summarize.
"""

import uuid
from datetime import UTC, datetime, timedelta

from sqlalchemy import Select, case, func, select
from sqlalchemy.orm import Session

from transitops.models.alert import Alert
from transitops.models.driver import Driver
from transitops.models.enums import (
    AlertStatus,
    DriverStatus,
    MaintenanceStatus,
    TripStatus,
    VehicleStatus,
)
from transitops.models.expense import Expense
from transitops.models.fuel_log import FuelLog
from transitops.models.maintenance_log import MaintenanceLog
from transitops.models.trip import Trip
from transitops.models.vehicle import Vehicle

# Diesel: ~2.68 kg CO₂ per litre burned (W4 estimate).
CO2_KG_PER_LITRE = 2.68
# A fully-loaded truck moving the same freight that would otherwise need several small vans:
# we credit the difference against a 6 km/l baseline as "saved".
BASELINE_KMPL = 6.0


def _f(value) -> float:
    """Numeric columns come back as Decimal (or None) — normalize for JSON + arithmetic."""
    return float(value) if value is not None else 0.0


def vehicle_costs(db: Session, vehicle_id: uuid.UUID) -> dict[str, float]:
    """fuel + maintenance + other = total operational cost (the PS "auto compute")."""
    fuel = _f(
        db.scalar(select(func.sum(FuelLog.cost)).where(FuelLog.vehicle_id == vehicle_id))
    )
    maintenance = _f(
        db.scalar(
            select(func.sum(MaintenanceLog.cost)).where(MaintenanceLog.vehicle_id == vehicle_id)
        )
    )
    other = _f(
        db.scalar(select(func.sum(Expense.amount)).where(Expense.vehicle_id == vehicle_id))
    )
    return {
        "fuel_total": round(fuel, 2),
        "maintenance_total": round(maintenance, 2),
        "other_total": round(other, 2),
        "operational_total": round(fuel + maintenance + other, 2),
    }


def health_score(
    odometer_km: float, open_maintenance: int, maintenance_count: int, expired_docs: int
) -> int:
    """W3 — rule-based, 0–100, explainable in one breath to an evaluator.

    Start at 100; deduct for distance since acquisition, for time in the shop, for how often it
    breaks, and for expired paperwork.
    """
    score = 100.0
    score -= min(odometer_km / 10_000.0, 30.0)  # up to −30 for a high-mileage vehicle
    score -= 25.0 * open_maintenance  # in the shop right now is the loudest signal
    score -= min(4.0 * maintenance_count, 20.0)  # a repeat offender
    score -= 10.0 * expired_docs
    return max(0, min(100, round(score)))


def _trip_aggregates(db: Session, vehicle_id: uuid.UUID) -> dict:
    row = db.execute(
        select(
            func.count(Trip.id),
            func.sum(case((Trip.status == TripStatus.COMPLETED, 1), else_=0)),
            func.sum(func.coalesce(Trip.actual_distance_km, 0)),
            func.sum(case((Trip.status == TripStatus.COMPLETED, Trip.revenue), else_=0)),
        ).where(Trip.vehicle_id == vehicle_id)
    ).one()
    return {
        "total_trips": int(row[0] or 0),
        "completed_trips": int(row[1] or 0),
        "total_distance_km": _f(row[2]),
        "total_revenue": _f(row[3]),
    }


def vehicle_metrics(db: Session, vehicle: Vehicle) -> dict:
    trips = _trip_aggregates(db, vehicle.id)
    costs = vehicle_costs(db, vehicle.id)

    liters = _f(
        db.scalar(select(func.sum(FuelLog.liters)).where(FuelLog.vehicle_id == vehicle.id))
    )
    distance = trips["total_distance_km"]
    op_cost = costs["operational_total"]
    acquisition = _f(vehicle.acquisition_cost)

    open_jobs = (
        db.scalar(
            select(func.count(MaintenanceLog.id)).where(
                MaintenanceLog.vehicle_id == vehicle.id,
                MaintenanceLog.status == MaintenanceStatus.OPEN,
            )
        )
        or 0
    )
    all_jobs = (
        db.scalar(
            select(func.count(MaintenanceLog.id)).where(
                MaintenanceLog.vehicle_id == vehicle.id
            )
        )
        or 0
    )
    expired_docs = _count_expired_vehicle_docs(db, vehicle.id)

    # Utilization: share of this vehicle's trips that are actively running or done — a cheap,
    # honest proxy for "is this asset working" that the dashboard can aggregate.
    utilization = 0.0
    if trips["total_trips"]:
        active_or_done = trips["completed_trips"] + (
            1 if vehicle.status == VehicleStatus.ON_TRIP else 0
        )
        utilization = min(100.0, 100.0 * active_or_done / trips["total_trips"])

    return {
        **trips,
        "total_liters": round(liters, 2),
        "fuel_efficiency_kmpl": round(distance / liters, 2) if liters > 0 and distance else None,
        "utilization_pct": round(utilization, 2),
        "cost_per_km": round(op_cost / distance, 2) if distance > 0 else None,
        # PS formula: (revenue − operational cost) / acquisition cost
        "roi": round((trips["total_revenue"] - op_cost) / acquisition, 4)
        if acquisition > 0
        else None,
        "health_score": health_score(
            _f(vehicle.odometer_km), int(open_jobs), int(all_jobs), expired_docs
        ),
    }


def _count_expired_vehicle_docs(db: Session, vehicle_id: uuid.UUID) -> int:
    from transitops.models.document import VehicleDocument

    return int(
        db.scalar(
            select(func.count(VehicleDocument.id)).where(
                VehicleDocument.vehicle_id == vehicle_id,
                VehicleDocument.expiry_date < datetime.now(UTC).date(),
            )
        )
        or 0
    )


def driver_performance(db: Session, driver: Driver) -> dict:
    row = db.execute(
        select(
            func.count(Trip.id),
            func.sum(case((Trip.status == TripStatus.COMPLETED, 1), else_=0)),
            func.sum(case((Trip.status == TripStatus.CANCELLED, 1), else_=0)),
            func.sum(func.coalesce(Trip.actual_distance_km, 0)),
        ).where(Trip.driver_id == driver.id)
    ).one()

    today = datetime.now(UTC).date()
    days_left = (driver.license_expiry_date - today).days
    return {
        "total_trips": int(row[0] or 0),
        "completed_trips": int(row[1] or 0),
        "cancelled_trips": int(row[2] or 0),
        "total_distance_km": round(_f(row[3]), 2),
        "license_valid": days_left >= 0,
        "days_to_license_expiry": days_left,
        "rating": round(driver.safety_score / 20.0, 1),  # 0–100 → 0–5 stars
    }


def _vehicle_filter(stmt: Select, vehicle_type=None, status=None, region=None) -> Select:
    if vehicle_type:
        stmt = stmt.where(Vehicle.vehicle_type == vehicle_type)
    if status:
        stmt = stmt.where(Vehicle.status == status)
    if region:
        stmt = stmt.where(Vehicle.region == region)
    return stmt


def kpis(db: Session, vehicle_type=None, status=None, region=None) -> dict:
    """Dashboard block. Filters narrow the vehicle population; trip/driver counts follow it."""
    vehicle_ids = list(
        db.scalars(_vehicle_filter(select(Vehicle.id), vehicle_type, status, region)).all()
    )

    counts = dict(
        db.execute(
            _vehicle_filter(
                select(Vehicle.status, func.count(Vehicle.id)), vehicle_type, status, region
            ).group_by(Vehicle.status)
        ).all()
    )

    trip_scope = select(Trip.status, func.count(Trip.id)).group_by(Trip.status)
    if vehicle_ids:
        trip_scope = trip_scope.where(Trip.vehicle_id.in_(vehicle_ids))
    elif vehicle_type or status or region:
        trip_scope = trip_scope.where(False)  # filters matched no vehicles → no trips
    trip_counts = dict(db.execute(trip_scope).all())

    total_vehicles = sum(counts.values())
    on_trip = int(counts.get(VehicleStatus.ON_TRIP, 0))
    available = int(counts.get(VehicleStatus.AVAILABLE, 0))
    # Utilization = share of the *usable* fleet (available + on trip) that is currently working.
    usable = on_trip + available
    utilization = round(100.0 * on_trip / usable, 2) if usable else 0.0

    cost = 0.0
    revenue = 0.0
    if vehicle_ids:
        cost = (
            _f(db.scalar(select(func.sum(FuelLog.cost)).where(FuelLog.vehicle_id.in_(vehicle_ids))))
            + _f(
                db.scalar(
                    select(func.sum(MaintenanceLog.cost)).where(
                        MaintenanceLog.vehicle_id.in_(vehicle_ids)
                    )
                )
            )
            + _f(
                db.scalar(
                    select(func.sum(Expense.amount)).where(Expense.vehicle_id.in_(vehicle_ids))
                )
            )
        )
        revenue = _f(
            db.scalar(
                select(func.sum(Trip.revenue)).where(
                    Trip.vehicle_id.in_(vehicle_ids), Trip.status == TripStatus.COMPLETED
                )
            )
        )

    return {
        "total_vehicles": total_vehicles,
        "available_vehicles": available,
        "on_trip_vehicles": on_trip,
        "in_shop_vehicles": int(counts.get(VehicleStatus.IN_SHOP, 0)),
        "retired_vehicles": int(counts.get(VehicleStatus.RETIRED, 0)),
        "active_trips": int(trip_counts.get(TripStatus.DISPATCHED, 0)),
        "pending_trips": int(trip_counts.get(TripStatus.DRAFT, 0)),
        "completed_trips": int(trip_counts.get(TripStatus.COMPLETED, 0)),
        "total_drivers": int(db.scalar(select(func.count(Driver.id))) or 0),
        "drivers_on_duty": int(
            db.scalar(
                select(func.count(Driver.id)).where(Driver.status == DriverStatus.ON_TRIP)
            )
            or 0
        ),
        "fleet_utilization_pct": utilization,
        "total_operational_cost": round(cost, 2),
        "total_revenue": round(revenue, 2),
        "open_alerts": int(
            db.scalar(select(func.count(Alert.id)).where(Alert.status == AlertStatus.ACTIVE))
            or 0
        ),
    }


def fleet_report(db: Session, vehicle_type=None, status=None, region=None) -> list[dict]:
    """Per-vehicle economics — also the source for `GET /export/csv?report=fleet`."""
    vehicles = db.scalars(
        _vehicle_filter(select(Vehicle), vehicle_type, status, region).order_by(
            Vehicle.registration_number
        )
    ).all()

    rows = []
    for vehicle in vehicles:
        metrics = vehicle_metrics(db, vehicle)
        costs = vehicle_costs(db, vehicle.id)
        rows.append(
            {
                "vehicle_id": vehicle.id,
                "registration_number": vehicle.registration_number,
                "name_model": vehicle.name_model,
                "vehicle_type": vehicle.vehicle_type,
                "region": vehicle.region,
                "status": vehicle.status.value,
                "total_trips": metrics["total_trips"],
                "total_distance_km": metrics["total_distance_km"],
                "total_liters": metrics["total_liters"],
                "fuel_efficiency_kmpl": metrics["fuel_efficiency_kmpl"],
                "operational_cost": costs["operational_total"],
                "revenue": metrics["total_revenue"],
                "cost_per_km": metrics["cost_per_km"],
                "utilization_pct": metrics["utilization_pct"],
                "roi": metrics["roi"],
                "health_score": metrics["health_score"],
            }
        )
    return rows


def trends(db: Session, weeks: int = 8) -> dict:
    """Time series for the charts. Bucketed in Python — portable across Postgres and SQLite,
    where `date_trunc` and `strftime` disagree."""
    since = datetime.now(UTC) - timedelta(weeks=weeks)

    buckets: dict[str, dict] = {}

    def bucket_for(moment: datetime) -> dict:
        # Normalize to the Monday of that week.
        day = moment.date()
        monday = day - timedelta(days=day.weekday())
        key = monday.isoformat()
        return buckets.setdefault(
            key,
            {"period": key, "fuel_cost": 0.0, "trips_completed": 0, "distance_km": 0.0, "liters": 0.0},
        )

    for logged_at, cost, liters in db.execute(
        select(FuelLog.logged_at, FuelLog.cost, FuelLog.liters).where(FuelLog.logged_at >= since)
    ):
        b = bucket_for(logged_at)
        b["fuel_cost"] += _f(cost)
        b["liters"] += _f(liters)

    for completed_at, distance in db.execute(
        select(Trip.completed_at, Trip.actual_distance_km).where(
            Trip.status == TripStatus.COMPLETED, Trip.completed_at.is_not(None), Trip.completed_at >= since
        )
    ):
        b = bucket_for(completed_at)
        b["trips_completed"] += 1
        b["distance_km"] += _f(distance)

    weekly = []
    for b in sorted(buckets.values(), key=lambda x: x["period"]):
        weekly.append(
            {
                "period": b["period"],
                "fuel_cost": round(b["fuel_cost"], 2),
                "trips_completed": b["trips_completed"],
                "distance_km": round(b["distance_km"], 2),
                "co2_kg": round(b["liters"] * CO2_KG_PER_LITRE, 2),
            }
        )

    trips_by_status = [
        {"status": s.value, "count": int(c)}
        for s, c in db.execute(
            select(Trip.status, func.count(Trip.id)).group_by(Trip.status)
        ).all()
    ]

    total_liters = _f(db.scalar(select(func.sum(FuelLog.liters))))
    total_distance = _f(
        db.scalar(
            select(func.sum(Trip.actual_distance_km)).where(Trip.status == TripStatus.COMPLETED)
        )
    )
    co2_total = total_liters * CO2_KG_PER_LITRE
    # What the same distance would have burned at the baseline efficiency, minus what we burned.
    co2_baseline = (total_distance / BASELINE_KMPL) * CO2_KG_PER_LITRE if total_distance else 0.0

    return {
        "weekly": weekly,
        "trips_by_status": trips_by_status,
        "co2_total_kg": round(co2_total, 2),
        "co2_saved_kg": round(max(0.0, co2_baseline - co2_total), 2),
    }
