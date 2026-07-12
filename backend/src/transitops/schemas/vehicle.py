import uuid
from datetime import datetime

from pydantic import BaseModel, Field, field_validator

from transitops.models.enums import VehicleStatus, VehicleType
from transitops.schemas.common import ORMModel

# Relaxed Indian plate format (contract §2), e.g. GJ-01-AB-1234 / MH12CD3456.
REGISTRATION_PATTERN = r"^[A-Z]{2}-?\d{1,2}-?[A-Z]{1,3}-?\d{1,4}$"


class VehicleCreate(BaseModel):
    registration_number: str = Field(pattern=REGISTRATION_PATTERN, examples=["GJ-01-AB-1234"])
    name_model: str = Field(min_length=1, max_length=120, examples=["Tata Ace Gold"])
    vehicle_type: VehicleType
    max_load_capacity_kg: float = Field(gt=0, le=100_000)
    odometer_km: float = Field(default=0, ge=0)
    acquisition_cost: float = Field(ge=0)
    region: str | None = Field(default=None, max_length=80)

    @field_validator("registration_number")
    @classmethod
    def upper(cls, v: str) -> str:
        return v.strip().upper()


class VehicleUpdate(BaseModel):
    """PATCH — every field optional; `status` transitions are re-checked in the service."""

    name_model: str | None = Field(default=None, min_length=1, max_length=120)
    vehicle_type: VehicleType | None = None
    max_load_capacity_kg: float | None = Field(default=None, gt=0, le=100_000)
    odometer_km: float | None = Field(default=None, ge=0)
    acquisition_cost: float | None = Field(default=None, ge=0)
    region: str | None = Field(default=None, max_length=80)
    status: VehicleStatus | None = None


class VehicleOut(ORMModel):
    id: uuid.UUID
    registration_number: str
    name_model: str
    vehicle_type: VehicleType
    max_load_capacity_kg: float
    odometer_km: float
    acquisition_cost: float
    status: VehicleStatus
    region: str | None
    created_at: datetime
    updated_at: datetime


class VehicleCosts(BaseModel):
    """`GET /vehicles/{id}/costs` — the PS "auto-computed total operational cost"."""

    fuel_total: float
    maintenance_total: float
    other_total: float
    operational_total: float


class VehicleMetrics(BaseModel):
    """Computed block (docs/03 §3) — never stored, always derived on read."""

    total_trips: int
    completed_trips: int
    total_distance_km: float
    total_liters: float
    total_revenue: float
    fuel_efficiency_kmpl: float | None
    utilization_pct: float
    cost_per_km: float | None
    roi: float | None
    health_score: int


class VehicleDetail(VehicleOut):
    costs: VehicleCosts
    metrics: VehicleMetrics
