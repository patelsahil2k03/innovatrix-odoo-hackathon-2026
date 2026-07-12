"""Test fixtures.

Each test gets a fresh in-memory SQLite database with the schema built from the models, and its
own set of vehicles/drivers/users — nothing here depends on the seed script, so these tests pass
on a clean checkout.

The simulator is force-disabled: a background task mutating trips underneath an assertion would
make these flaky for no benefit.
"""

import os
from datetime import UTC, date, datetime, timedelta

os.environ["SIMULATOR_ENABLED"] = "false"
os.environ["DATABASE_URL"] = "sqlite://"

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from transitops.core.database import Base, get_db
from transitops.core.security import hash_password
from transitops.main import create_app
from transitops.models import Driver, Role, User, Vehicle
from transitops.models.enums import (
    DriverStatus,
    LicenseCategory,
    RoleName,
    VehicleStatus,
    VehicleType,
)

PASSWORD = "test-password"


@pytest.fixture
def db_session():
    # StaticPool + a shared in-memory DB so the app and the test see the same connection.
    engine = create_engine(
        "sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool
    )
    Base.metadata.create_all(engine)
    TestSession = sessionmaker(bind=engine, autoflush=False, autocommit=False)

    session = TestSession()
    try:
        yield session
    finally:
        session.close()
        Base.metadata.drop_all(engine)
        engine.dispose()


@pytest.fixture
def client(db_session):
    app = create_app()

    def override_get_db():
        yield db_session

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()


@pytest.fixture
def password() -> str:
    return PASSWORD


@pytest.fixture
def users(db_session) -> dict[str, User]:
    """One user per role, so RBAC can be exercised from both sides."""
    created = {}
    for role_name in RoleName:
        role = Role(name=role_name.value, description=role_name.value)
        db_session.add(role)
        db_session.flush()

        user = User(
            email=f"{role_name.value}@test.in",
            password_hash=hash_password(PASSWORD),
            full_name=role_name.value.replace("_", " ").title(),
            role_id=role.id,
            is_active=True,
        )
        db_session.add(user)
        created[role_name.value] = user

    db_session.commit()
    return created


def _auth(client: TestClient, role: RoleName) -> dict[str, str]:
    response = client.post(
        "/api/v1/auth/token", json={"email": f"{role.value}@test.in", "password": PASSWORD}
    )
    assert response.status_code == 200, response.text
    return {"Authorization": f"Bearer {response.json()['access_token']}"}


@pytest.fixture
def as_dispatcher(client, users) -> dict[str, str]:
    return _auth(client, RoleName.DISPATCHER)


@pytest.fixture
def as_fleet_manager(client, users) -> dict[str, str]:
    return _auth(client, RoleName.FLEET_MANAGER)


@pytest.fixture
def as_safety_officer(client, users) -> dict[str, str]:
    return _auth(client, RoleName.SAFETY_OFFICER)


@pytest.fixture
def as_financial_analyst(client, users) -> dict[str, str]:
    return _auth(client, RoleName.FINANCIAL_ANALYST)


@pytest.fixture
def vehicle(db_session) -> Vehicle:
    """A 500 kg van — the capacity rule's demo subject."""
    v = Vehicle(
        registration_number="GJ-01-AB-1234",
        name_model="Tata Ace Gold",
        vehicle_type=VehicleType.MINI,
        max_load_capacity_kg=500,
        odometer_km=10_000,
        acquisition_cost=500_000,
        status=VehicleStatus.AVAILABLE,
        region="Gujarat",
    )
    db_session.add(v)
    db_session.commit()
    db_session.refresh(v)
    return v


@pytest.fixture
def driver(db_session) -> Driver:
    d = Driver(
        name="Amit Patel",
        phone="+91 9876543210",
        license_number="GJ0120180012345",
        license_category=LicenseCategory.LMV,
        license_expiry_date=date.today() + timedelta(days=365),
        safety_score=90,
        status=DriverStatus.AVAILABLE,
    )
    db_session.add(d)
    db_session.commit()
    db_session.refresh(d)
    return d


@pytest.fixture
def make_trip(client, as_dispatcher, vehicle, driver):
    """Creates a draft trip via the API (so its validation runs) and returns the trip id."""

    def _make(cargo_weight_kg: float = 400, **overrides) -> str:
        payload = {
            "vehicle_id": str(vehicle.id),
            "driver_id": str(driver.id),
            "source_city": "Ahmedabad",
            "dest_city": "Mumbai",
            "cargo_weight_kg": cargo_weight_kg,
            "revenue": 25_000,
            **overrides,
        }
        response = client.post("/api/v1/trips", json=payload, headers=as_dispatcher)
        assert response.status_code == 201, response.text
        return response.json()["id"]

    return _make
