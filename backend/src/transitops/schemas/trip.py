import uuid
from datetime import datetime

from pydantic import BaseModel, Field

from transitops.models.enums import TripStatus
from transitops.schemas.common import ORMModel
from transitops.schemas.driver import DriverOut
from transitops.schemas.vehicle import VehicleOut


class TripCreate(BaseModel):
    vehicle_id: uuid.UUID
    driver_id: uuid.UUID
    source_city: str = Field(min_length=1, max_length=80, examples=["Ahmedabad"])
    dest_city: str = Field(min_length=1, max_length=80, examples=["Mumbai"])
    cargo_weight_kg: float = Field(gt=0, le=100_000)
    # Optional: derived from the city catalog when omitted (core/cities.py).
    planned_distance_km: float | None = Field(default=None, gt=0, le=10_000)
    revenue: float = Field(default=0, ge=0)


class TripUpdate(BaseModel):
    """PATCH — draft trips only (422 TRIP_NOT_DRAFT otherwise)."""

    vehicle_id: uuid.UUID | None = None
    driver_id: uuid.UUID | None = None
    source_city: str | None = Field(default=None, min_length=1, max_length=80)
    dest_city: str | None = Field(default=None, min_length=1, max_length=80)
    cargo_weight_kg: float | None = Field(default=None, gt=0, le=100_000)
    planned_distance_km: float | None = Field(default=None, gt=0, le=10_000)
    revenue: float | None = Field(default=None, ge=0)


class TripFuelOnComplete(BaseModel):
    liters: float = Field(gt=0)
    cost: float = Field(ge=0)


class TripComplete(BaseModel):
    actual_distance_km: float = Field(gt=0, le=10_000)
    final_odometer_km: float = Field(ge=0)
    fuel: TripFuelOnComplete | None = None


class TripOut(ORMModel):
    id: uuid.UUID
    vehicle_id: uuid.UUID
    driver_id: uuid.UUID
    created_by: uuid.UUID
    source_city: str
    source_lat: float
    source_lng: float
    dest_city: str
    dest_lat: float
    dest_lng: float
    cargo_weight_kg: float
    planned_distance_km: float
    actual_distance_km: float | None
    revenue: float
    status: TripStatus
    progress_percent: float
    dispatched_at: datetime | None
    completed_at: datetime | None
    created_at: datetime
    updated_at: datetime


class TripDetail(TripOut):
    vehicle: VehicleOut
    driver: DriverOut


class TripLive(BaseModel):
    """`GET /trips/live` — bootstrap payload for the deck.gl map; SSE keeps it moving."""

    id: uuid.UUID
    status: TripStatus
    source_city: str
    dest_city: str
    source_lat: float
    source_lng: float
    dest_lat: float
    dest_lng: float
    progress_percent: float
    # Interpolated along the source→dest line by progress — where to draw the vehicle now.
    current_lat: float
    current_lng: float
    vehicle_registration: str
    driver_name: str


class Suggestion(BaseModel):
    """W2 — deterministic scoring, no external AI. Reasons are shown verbatim in the UI."""

    vehicle: VehicleOut
    driver: DriverOut
    score: float
    reasons: list[str]
