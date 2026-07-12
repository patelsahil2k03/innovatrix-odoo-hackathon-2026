import uuid
from datetime import date, datetime

from pydantic import BaseModel, Field, field_validator

from transitops.models.enums import DriverStatus, LicenseCategory
from transitops.schemas.common import ORMModel


class DriverCreate(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    phone: str | None = Field(default=None, max_length=20)
    license_number: str = Field(min_length=4, max_length=30, examples=["GJ0120180012345"])
    license_category: LicenseCategory
    # May be in the past on purpose: drivers with expired licenses exist, they are simply
    # unassignable (guard lives in services/dispatch.py, not here).
    license_expiry_date: date
    safety_score: int = Field(default=100, ge=0, le=100)

    @field_validator("license_number")
    @classmethod
    def upper(cls, v: str) -> str:
        return v.strip().upper()


class DriverUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=120)
    phone: str | None = Field(default=None, max_length=20)
    license_category: LicenseCategory | None = None
    license_expiry_date: date | None = None
    safety_score: int | None = Field(default=None, ge=0, le=100)
    status: DriverStatus | None = None


class DriverOut(ORMModel):
    id: uuid.UUID
    name: str
    phone: str | None
    license_number: str
    license_category: LicenseCategory
    license_expiry_date: date
    safety_score: int
    status: DriverStatus
    created_at: datetime
    updated_at: datetime


class DriverPerformance(BaseModel):
    total_trips: int
    completed_trips: int
    cancelled_trips: int
    total_distance_km: float
    license_valid: bool
    days_to_license_expiry: int
    rating: float  # safety_score on a 0–5 scale, for the UI's star display


class DriverDetail(DriverOut):
    performance: DriverPerformance
