"""Populate a fresh TransitOps database with realistic, internally consistent demo data.

Usage:
    uv run python -m transitops.seed            # only runs against an empty database
    uv run python -m transitops.seed --reset     # wipes every table first, then reseeds

Deterministic: every random choice is drawn from `random.Random(SEED)`, so two runs against a
fresh database produce byte-identical data. "Now" is real wall-clock time, so absolute dates
shift day to day, but everything is generated relative to it (e.g. "spread across the last 60
days") so the shape of the data never changes.
"""

from __future__ import annotations

import argparse
import random
import sys
from dataclasses import dataclass
from datetime import date, datetime, timedelta, timezone
from decimal import Decimal

import bcrypt
from sqlalchemy import delete, func, select
from sqlalchemy.orm import Session

from transitops.core.database import SessionLocal
from transitops.models import (
    Alert,
    AuditLog,
    Driver,
    DriverDocument,
    Expense,
    FuelLog,
    MaintenanceLog,
    Notification,
    Role,
    Trip,
    User,
    Vehicle,
    VehicleDocument,
)
from transitops.models.enums import (
    AlertEntityType,
    AlertSeverity,
    AlertStatus,
    AlertType,
    DocumentType,
    DriverStatus,
    ExpenseType,
    LicenseCategory,
    MaintenanceStatus,
    MaintenanceType,
    RoleName,
    TripStatus,
    VehicleStatus,
    VehicleType,
)
from transitops.seed.cities import CITIES, REGIONS, haversine_km
from transitops.seed.generators import (
    ACQUISITION_COST_RANGE,
    CAPACITY_KG_RANGE,
    ODOMETER_KM_RANGE,
    VEHICLE_MODELS,
    make_license_number,
    make_name,
    make_phone,
    make_plate,
)

SEED = 1729
DEMO_PASSWORD = "Demo@1234"  # demo-only, not a real secret

ROLE_DEFS = [
    (RoleName.FLEET_MANAGER.value, "Manages fleet composition, vehicle allocation, and acquisition decisions."),
    (RoleName.DISPATCHER.value, "Assigns drivers and vehicles to trips and manages day-to-day dispatch operations."),
    (RoleName.SAFETY_OFFICER.value, "Monitors driver compliance, license validity, and safety scores."),
    (RoleName.FINANCIAL_ANALYST.value, "Tracks fuel costs, expenses, and trip revenue for financial reporting."),
]

DEMO_USERS = [
    ("fleet@transitops.in", "Rahul Kapoor", RoleName.FLEET_MANAGER.value),
    ("dispatch@transitops.in", "Sneha Iyer", RoleName.DISPATCHER.value),
    ("safety@transitops.in", "Anil Deshmukh", RoleName.SAFETY_OFFICER.value),
    ("finance@transitops.in", "Meera Nair", RoleName.FINANCIAL_ANALYST.value),
]

VEHICLE_COUNT = 25
DRIVER_COUNT = 20
MAINTENANCE_COUNT = 10
FUEL_LOGS_PER_VEHICLE = 5
HISTORICAL_TRIP_COUNTS = [(TripStatus.COMPLETED, 44), (TripStatus.CANCELLED, 8), (TripStatus.DRAFT, 7)]
DISPATCHED_TRIP_COUNT = 3

RATE_PER_KM = {"truck": 42, "van": 30, "mini": 22, "bus": 38}
AVG_SPEED_KMPH = 42

TANK_LITERS_RANGE = {"truck": (80, 180), "van": (30, 60), "mini": (15, 35), "bus": (100, 200)}
DIESEL_PRICE_RANGE = (92.0, 97.5)

EXPENSE_AMOUNT_RANGE = {"toll": (50, 450), "parking": (20, 150), "fine": (500, 3000), "misc": (100, 2000)}
EXPENSE_NOTES = {
    "toll": ["NH48 toll plaza", "Expressway toll", "State highway toll"],
    "parking": ["Overnight parking", "Warehouse parking fee", "Depot parking"],
    "fine": ["Overloading fine", "Speed limit violation", "Documents check fine"],
    "misc": ["Loading labour charge", "Weighbridge fee", "Emergency roadside repair"],
}

MAINTENANCE_COST_RANGE = {
    "service": (3000, 12000),
    "repair": (5000, 40000),
    "inspection": (500, 2000),
    "oil_change": (1500, 4000),
    "tyres": (8000, 32000),
}
MAINTENANCE_DESCRIPTIONS = {
    "service": "Scheduled periodic service",
    "repair": "Unscheduled repair after breakdown",
    "inspection": "Statutory fitness inspection",
    "oil_change": "Engine oil and filter change",
    "tyres": "Tyre replacement",
}

VEHICLE_DOC_TYPES = [
    DocumentType.REGISTRATION_CERTIFICATE,
    DocumentType.INSURANCE,
    DocumentType.PERMIT,
    DocumentType.PUC,
    DocumentType.FITNESS_CERTIFICATE,
]
DRIVER_DOC_TYPES = [DocumentType.DRIVING_LICENSE, DocumentType.MEDICAL_CERTIFICATE, DocumentType.BADGE]


@dataclass
class Reservations:
    """Vehicles/drivers pinned to a specific current-state before any trips are built, so the
    rest of the seed can make their status consistent with what those rows say (e.g. a vehicle
    with an open maintenance log must show status=in_shop, never status=available)."""

    retired_vehicles: list[Vehicle]
    in_shop_vehicles: list[Vehicle]
    on_trip_vehicles: list[Vehicle]
    suspended_driver: Driver
    expired_license_drivers: list[Driver]
    on_trip_drivers: list[Driver]


def reset_all(db: Session) -> None:
    print("--reset: wiping existing data from all tables...")
    for model in (
        Alert,
        AuditLog,
        Notification,
        VehicleDocument,
        DriverDocument,
        Expense,
        FuelLog,
        MaintenanceLog,
        Trip,
        Driver,
        Vehicle,
        User,
        Role,
    ):
        db.execute(delete(model))
    db.flush()


def seed_roles(db: Session) -> dict[str, Role]:
    roles = {name: Role(name=name, description=desc) for name, desc in ROLE_DEFS}
    db.add_all(roles.values())
    db.flush()
    return roles


def seed_users(db: Session, roles: dict[str, Role]) -> dict[str, User]:
    # passlib 1.7.4 (the pinned version) can't detect bcrypt>=4.1's version scheme (it dropped
    # `__about__`), so we call bcrypt directly rather than through passlib.CryptContext.
    password_hash = bcrypt.hashpw(DEMO_PASSWORD.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")
    users = {
        email: User(
            email=email.lower(), password_hash=password_hash, full_name=full_name, role=roles[role_name], is_active=True
        )
        for email, full_name, role_name in DEMO_USERS
    }
    db.add_all(users.values())
    db.flush()
    return users


def seed_vehicles(db: Session, rng: random.Random) -> list[Vehicle]:
    used_plates: set[str] = set()
    type_cycle = list(VehicleType)
    vehicles: list[Vehicle] = []
    for i in range(VEHICLE_COUNT):
        vtype = type_cycle[i % len(type_cycle)]
        region = REGIONS[i % len(REGIONS)]
        cap_lo, cap_hi = CAPACITY_KG_RANGE[vtype.value]
        odo_lo, odo_hi = ODOMETER_KM_RANGE[vtype.value]
        cost_lo, cost_hi = ACQUISITION_COST_RANGE[vtype.value]
        vehicles.append(
            Vehicle(
                registration_number=make_plate(rng, region, used_plates),
                name_model=rng.choice(VEHICLE_MODELS[vtype.value]),
                vehicle_type=vtype,
                max_load_capacity_kg=Decimal(rng.randint(cap_lo, cap_hi)),
                odometer_km=Decimal(rng.randint(odo_lo, odo_hi)),
                acquisition_cost=Decimal(rng.randint(cost_lo, cost_hi)),
                status=VehicleStatus.AVAILABLE,
                region=region,
            )
        )
    rng.shuffle(vehicles)
    db.add_all(vehicles)
    db.flush()
    return vehicles


def seed_drivers(db: Session, rng: random.Random, today: date) -> list[Driver]:
    used_licenses: set[str] = set()
    drivers: list[Driver] = []
    for i in range(DRIVER_COUNT):
        region = REGIONS[i % len(REGIONS)]
        drivers.append(
            Driver(
                name=make_name(rng),
                phone=make_phone(rng),
                license_number=make_license_number(rng, region, used_licenses),
                license_category=rng.choice(list(LicenseCategory)),
                license_expiry_date=today + timedelta(days=rng.randint(180, 900)),
                safety_score=rng.randint(70, 98),
                status=DriverStatus.AVAILABLE,
            )
        )
    db.add_all(drivers)
    db.flush()
    return drivers


def reserve_current_state(rng: random.Random, vehicles: list[Vehicle], drivers: list[Driver], today: date) -> Reservations:
    pool = list(vehicles)
    retired = rng.sample(pool, 2)
    pool = [v for v in pool if v not in retired]
    in_shop = rng.sample(pool, 2)
    pool = [v for v in pool if v not in in_shop]
    on_trip_vehicles = rng.sample(pool, DISPATCHED_TRIP_COUNT)
    for v in retired:
        v.status = VehicleStatus.RETIRED
    for v in on_trip_vehicles:
        v.status = VehicleStatus.ON_TRIP

    dpool = list(drivers)
    suspended = rng.choice(dpool)
    dpool.remove(suspended)
    expired = rng.sample(dpool, 2)
    dpool = [d for d in dpool if d not in expired]
    on_trip_drivers = rng.sample(dpool, DISPATCHED_TRIP_COUNT)
    remaining = [d for d in dpool if d not in on_trip_drivers]

    suspended.status = DriverStatus.SUSPENDED
    suspended.safety_score = rng.randint(35, 55)
    for d in expired:
        d.license_expiry_date = today - timedelta(days=rng.randint(5, 90))
    for d in on_trip_drivers:
        d.status = DriverStatus.ON_TRIP
    for d in remaining:
        d.status = DriverStatus.OFF_DUTY if rng.random() < 0.2 else DriverStatus.AVAILABLE

    return Reservations(
        retired_vehicles=retired,
        in_shop_vehicles=in_shop,
        on_trip_vehicles=on_trip_vehicles,
        suspended_driver=suspended,
        expired_license_drivers=expired,
        on_trip_drivers=on_trip_drivers,
    )


def seed_trips(
    db: Session,
    rng: random.Random,
    vehicles: list[Vehicle],
    drivers: list[Driver],
    users: dict[str, User],
    reservations: Reservations,
    now: datetime,
) -> list[Trip]:
    creators = [users["dispatch@transitops.in"], users["fleet@transitops.in"]]
    trips: list[Trip] = []

    def pick_route() -> tuple[dict, dict, float]:
        source, dest = rng.sample(CITIES, 2)
        distance = round(haversine_km(source["lat"], source["lng"], dest["lat"], dest["lng"]), 2)
        return source, dest, distance

    def build_trip(vehicle: Vehicle, driver: Driver, status: TripStatus, created_at: datetime) -> None:
        source, dest, distance = pick_route()
        cargo = float(vehicle.max_load_capacity_kg) * rng.uniform(0.4, 0.9)
        revenue = distance * RATE_PER_KM[vehicle.vehicle_type.value] * rng.uniform(0.9, 1.15)

        dispatched_at: datetime | None = None
        completed_at: datetime | None = None
        actual_distance: float | None = None
        progress = Decimal("0")

        if status == TripStatus.DISPATCHED:
            dispatched_at = created_at + timedelta(hours=rng.randint(1, 4))
            progress = Decimal(rng.randint(15, 85))
        elif status == TripStatus.CANCELLED:
            dispatched_at = created_at + timedelta(hours=rng.randint(1, 5))
            progress = Decimal(rng.randint(10, 60))
        elif status == TripStatus.COMPLETED:
            dispatched_at = created_at + timedelta(hours=rng.randint(1, 6))
            travel_hours = distance / AVG_SPEED_KMPH
            completed_at = dispatched_at + timedelta(hours=travel_hours * rng.uniform(0.9, 1.3))
            actual_distance = round(distance * rng.uniform(1.0, 1.15), 2)
            progress = Decimal("100")

        updated_at = completed_at or dispatched_at or created_at

        trips.append(
            Trip(
                vehicle=vehicle,
                driver=driver,
                creator=rng.choice(creators),
                source_city=source["name"],
                source_lat=Decimal(str(source["lat"])),
                source_lng=Decimal(str(source["lng"])),
                dest_city=dest["name"],
                dest_lat=Decimal(str(dest["lat"])),
                dest_lng=Decimal(str(dest["lng"])),
                cargo_weight_kg=Decimal(str(round(cargo, 2))),
                planned_distance_km=Decimal(str(distance)),
                actual_distance_km=Decimal(str(actual_distance)) if actual_distance is not None else None,
                revenue=Decimal(str(round(revenue, 2))),
                status=status,
                progress_percent=progress,
                dispatched_at=dispatched_at,
                completed_at=completed_at,
                created_at=created_at,
                updated_at=updated_at,
            )
        )

    # Currently in progress — pinned to the reserved on-trip vehicle/driver pairs so their
    # status=on_trip is backed by a real dispatched trip.
    for vehicle, driver in zip(reservations.on_trip_vehicles, reservations.on_trip_drivers):
        created_at = now - timedelta(hours=rng.randint(6, 48))
        build_trip(vehicle, driver, TripStatus.DISPATCHED, created_at)

    # Historical trips spread across the last ~60 days, any vehicle/driver.
    for status, count in HISTORICAL_TRIP_COUNTS:
        for _ in range(count):
            vehicle = rng.choice(vehicles)
            driver = rng.choice(drivers)
            days_ago = rng.randint(0, 10) if status == TripStatus.DRAFT else rng.randint(0, 59)
            created_at = now - timedelta(days=days_ago, hours=rng.randint(0, 23))
            build_trip(vehicle, driver, status, created_at)

    db.add_all(trips)
    db.flush()
    return trips


def seed_fuel_logs(
    db: Session, rng: random.Random, vehicles: list[Vehicle], trips: list[Trip], users: dict[str, User], now: datetime
) -> list[FuelLog]:
    trips_by_vehicle: dict = {}
    for trip in trips:
        trips_by_vehicle.setdefault(trip.vehicle_id, []).append(trip)

    creators = list(users.values())
    logs: list[FuelLog] = []
    for vehicle in vehicles:
        final_odo = float(vehicle.odometer_km)
        start_odo = max(0.0, final_odo - rng.uniform(3000, 9000))
        vehicle_trips = trips_by_vehicle.get(vehicle.id, [])
        lo, hi = TANK_LITERS_RANGE[vehicle.vehicle_type.value]
        for i in range(FUEL_LOGS_PER_VEHICLE):
            days_ago = max(0, 95 - i * (95 // FUEL_LOGS_PER_VEHICLE) - rng.randint(0, 5))
            logged_at = now - timedelta(days=days_ago, hours=rng.randint(0, 23))
            odometer = start_odo + (final_odo - start_odo) * ((i + 1) / FUEL_LOGS_PER_VEHICLE)
            liters = rng.uniform(lo, hi)
            price = rng.uniform(*DIESEL_PRICE_RANGE)
            trip = rng.choice(vehicle_trips) if vehicle_trips and rng.random() < 0.3 else None
            logs.append(
                FuelLog(
                    vehicle=vehicle,
                    trip=trip,
                    liters=Decimal(str(round(liters, 2))),
                    cost=Decimal(str(round(liters * price, 2))),
                    odometer_at_fill=Decimal(str(round(odometer, 2))),
                    logged_at=logged_at,
                    created_by=rng.choice(creators).id,
                )
            )
    db.add_all(logs)
    db.flush()
    return logs


def seed_expenses(
    db: Session, rng: random.Random, vehicles: list[Vehicle], trips: list[Trip], users: dict[str, User], now: datetime
) -> list[Expense]:
    trips_by_vehicle: dict = {}
    for trip in trips:
        trips_by_vehicle.setdefault(trip.vehicle_id, []).append(trip)

    creators = list(users.values())
    expenses: list[Expense] = []
    for vehicle in vehicles:
        vehicle_trips = trips_by_vehicle.get(vehicle.id, [])
        for _ in range(rng.randint(3, 5)):
            expense_type = rng.choice(list(ExpenseType))
            lo, hi = EXPENSE_AMOUNT_RANGE[expense_type.value]
            amount = rng.uniform(lo, hi)
            trip = rng.choice(vehicle_trips) if vehicle_trips and rng.random() < 0.4 else None
            created_at = now - timedelta(days=rng.randint(0, 89), hours=rng.randint(0, 23))
            expenses.append(
                Expense(
                    vehicle=vehicle,
                    trip=trip,
                    expense_type=expense_type,
                    amount=Decimal(str(round(amount, 2))),
                    notes=rng.choice(EXPENSE_NOTES[expense_type.value]),
                    created_at=created_at,
                    created_by=rng.choice(creators).id,
                )
            )
    db.add_all(expenses)
    db.flush()
    return expenses


def seed_maintenance(
    db: Session, rng: random.Random, vehicles: list[Vehicle], reservations: Reservations, now: datetime
) -> list[MaintenanceLog]:
    logs: list[MaintenanceLog] = []

    for vehicle in reservations.in_shop_vehicles:
        vehicle.status = VehicleStatus.IN_SHOP
        maint_type = rng.choice(list(MaintenanceType))
        opened_at = now - timedelta(days=rng.randint(1, 10), hours=rng.randint(0, 23))
        logs.append(
            MaintenanceLog(
                vehicle=vehicle,
                maintenance_type=maint_type,
                description=MAINTENANCE_DESCRIPTIONS[maint_type.value],
                cost=Decimal(rng.randint(*MAINTENANCE_COST_RANGE[maint_type.value])),
                status=MaintenanceStatus.OPEN,
                opened_at=opened_at,
                closed_at=None,
            )
        )

    reserved_ids = {v.id for v in reservations.in_shop_vehicles}
    candidates = [v for v in vehicles if v.id not in reserved_ids]
    for _ in range(MAINTENANCE_COUNT - len(reservations.in_shop_vehicles)):
        vehicle = rng.choice(candidates)
        maint_type = rng.choice(list(MaintenanceType))
        opened_at = now - timedelta(days=rng.randint(15, 180), hours=rng.randint(0, 23))
        closed_at = opened_at + timedelta(days=rng.randint(1, 7))
        logs.append(
            MaintenanceLog(
                vehicle=vehicle,
                maintenance_type=maint_type,
                description=MAINTENANCE_DESCRIPTIONS[maint_type.value],
                cost=Decimal(rng.randint(*MAINTENANCE_COST_RANGE[maint_type.value])),
                status=MaintenanceStatus.CLOSED,
                opened_at=opened_at,
                closed_at=closed_at,
            )
        )

    db.add_all(logs)
    db.flush()
    return logs


def seed_documents(
    db: Session, rng: random.Random, vehicles: list[Vehicle], drivers: list[Driver], today: date
) -> tuple[list[VehicleDocument], list[DriverDocument], list[VehicleDocument], list[DriverDocument]]:
    vehicle_docs: list[VehicleDocument] = []
    driver_docs: list[DriverDocument] = []

    for vehicle in vehicles:
        for doc_type in rng.sample(VEHICLE_DOC_TYPES, 2):
            vehicle_docs.append(
                VehicleDocument(
                    vehicle=vehicle,
                    document_type=doc_type,
                    document_number=f"{doc_type.value[:3].upper()}-{rng.randint(100000, 999999)}",
                    expiry_date=today + timedelta(days=rng.randint(60, 700)),
                )
            )

    for driver in drivers:
        for doc_type in rng.sample(DRIVER_DOC_TYPES, 2):
            driver_docs.append(
                DriverDocument(
                    driver=driver,
                    document_type=doc_type,
                    document_number=f"{doc_type.value[:3].upper()}-{rng.randint(100000, 999999)}",
                    expiry_date=today + timedelta(days=rng.randint(60, 700)),
                )
            )

    # Force a few into "expiring soon" territory so the demo always has something to alert on,
    # rather than relying on the 60-700 day spread to land there by chance.
    expiring_vehicle_docs = rng.sample(vehicle_docs, 3)
    for doc in expiring_vehicle_docs:
        doc.expiry_date = today + timedelta(days=rng.randint(3, 25))

    expiring_driver_docs = rng.sample(driver_docs, 2)
    for doc in expiring_driver_docs:
        doc.expiry_date = today + timedelta(days=rng.randint(3, 25))

    db.add_all(vehicle_docs)
    db.add_all(driver_docs)
    db.flush()
    return vehicle_docs, driver_docs, expiring_vehicle_docs, expiring_driver_docs


def seed_alerts(
    db: Session,
    rng: random.Random,
    reservations: Reservations,
    expiring_vehicle_docs: list[VehicleDocument],
    expiring_driver_docs: list[DriverDocument],
    trips: list[Trip],
) -> list[Alert]:
    alerts: list[Alert] = []

    for driver in reservations.expired_license_drivers:
        alerts.append(
            Alert(
                type=AlertType.LICENSE_EXPIRY,
                severity=AlertSeverity.CRITICAL,
                title=f"Driving license expired for {driver.name} ({driver.license_number})",
                entity_type=AlertEntityType.DRIVER,
                entity_id=driver.id,
                status=AlertStatus.ACTIVE,
            )
        )

    for doc in expiring_vehicle_docs:
        label = doc.document_type.value.replace("_", " ").title()
        alerts.append(
            Alert(
                type=AlertType.DOC_EXPIRY,
                severity=AlertSeverity.WARNING,
                title=f"{label} expiring soon for {doc.vehicle.registration_number}",
                entity_type=AlertEntityType.VEHICLE_DOCUMENT,
                entity_id=doc.id,
                status=AlertStatus.ACTIVE,
            )
        )

    for doc in expiring_driver_docs:
        label = doc.document_type.value.replace("_", " ").title()
        alerts.append(
            Alert(
                type=AlertType.DOC_EXPIRY,
                severity=AlertSeverity.WARNING,
                title=f"{label} expiring soon for {doc.driver.name}",
                entity_type=AlertEntityType.DRIVER_DOCUMENT,
                entity_id=doc.id,
                status=AlertStatus.ACTIVE,
            )
        )

    for vehicle in reservations.in_shop_vehicles:
        alerts.append(
            Alert(
                type=AlertType.MAINTENANCE_DUE,
                severity=AlertSeverity.WARNING,
                title=f"Open maintenance job blocking {vehicle.registration_number}",
                entity_type=AlertEntityType.VEHICLE,
                entity_id=vehicle.id,
                status=AlertStatus.ACTIVE,
            )
        )

    cancelled_trips = [t for t in trips if t.status == TripStatus.CANCELLED]
    if cancelled_trips:
        trip = rng.choice(cancelled_trips)
        alerts.append(
            Alert(
                type=AlertType.TRIP_ANOMALY,
                severity=AlertSeverity.INFO,
                title=f"Trip {trip.source_city} -> {trip.dest_city} cancelled at {trip.progress_percent}% progress",
                entity_type=AlertEntityType.VEHICLE,
                entity_id=trip.vehicle_id,
                status=AlertStatus.ACTIVE,
            )
        )

    db.add_all(alerts)
    db.flush()
    return alerts


def main() -> None:
    parser = argparse.ArgumentParser(description="Seed the TransitOps database with demo data.")
    parser.add_argument("--reset", action="store_true", help="Delete all existing rows before seeding.")
    args = parser.parse_args()

    rng = random.Random(SEED)
    now = datetime.now(timezone.utc)
    today = now.date()

    db = SessionLocal()
    try:
        if args.reset:
            reset_all(db)
        else:
            existing = db.scalar(select(func.count()).select_from(Role))
            if existing:
                print(
                    "Database already contains data (roles table is non-empty).\n"
                    "Re-run with --reset to wipe and reseed: uv run python -m transitops.seed --reset",
                    file=sys.stderr,
                )
                sys.exit(1)

        roles = seed_roles(db)
        users = seed_users(db, roles)
        vehicles = seed_vehicles(db, rng)
        drivers = seed_drivers(db, rng, today)
        reservations = reserve_current_state(rng, vehicles, drivers, today)
        trips = seed_trips(db, rng, vehicles, drivers, users, reservations, now)
        fuel_logs = seed_fuel_logs(db, rng, vehicles, trips, users, now)
        expenses = seed_expenses(db, rng, vehicles, trips, users, now)
        maintenance_logs = seed_maintenance(db, rng, vehicles, reservations, now)
        vehicle_docs, driver_docs, expiring_vehicle_docs, expiring_driver_docs = seed_documents(
            db, rng, vehicles, drivers, today
        )
        alerts = seed_alerts(db, rng, reservations, expiring_vehicle_docs, expiring_driver_docs, trips)

        db.commit()
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()

    print("\nSeed complete:")
    print(f"  roles={len(roles)}  users={len(users)}  vehicles={len(vehicles)}  drivers={len(drivers)}")
    print(f"  trips={len(trips)}  fuel_logs={len(fuel_logs)}  expenses={len(expenses)}  maintenance_logs={len(maintenance_logs)}")
    print(f"  vehicle_documents={len(vehicle_docs)}  driver_documents={len(driver_docs)}  alerts={len(alerts)}")
    print("\nDemo accounts (shared password — change before any real deployment):")
    for email, full_name, role_name in DEMO_USERS:
        print(f"  {email:<28} role={role_name:<18} name={full_name}")
    print(f"  password: {DEMO_PASSWORD}   # demo-only, not a real secret")


if __name__ == "__main__":
    main()
