import uuid
from datetime import datetime

from pydantic import BaseModel, Field

from transitops.models.enums import ExpenseType
from transitops.schemas.common import ORMModel


class FuelLogCreate(BaseModel):
    vehicle_id: uuid.UUID
    # Optional link; when present the trip must belong to the same vehicle (422 TRIP_VEHICLE_MISMATCH).
    trip_id: uuid.UUID | None = None
    liters: float = Field(gt=0, le=2000)
    cost: float = Field(gt=0)
    odometer_at_fill: float | None = Field(default=None, ge=0)
    logged_at: datetime | None = None


class FuelLogOut(ORMModel):
    id: uuid.UUID
    vehicle_id: uuid.UUID
    trip_id: uuid.UUID | None
    liters: float
    cost: float
    odometer_at_fill: float | None
    logged_at: datetime
    created_by: uuid.UUID


class ExpenseCreate(BaseModel):
    vehicle_id: uuid.UUID
    trip_id: uuid.UUID | None = None
    expense_type: ExpenseType
    amount: float = Field(gt=0)
    notes: str | None = Field(default=None, max_length=255)


class ExpenseOut(ORMModel):
    id: uuid.UUID
    vehicle_id: uuid.UUID
    trip_id: uuid.UUID | None
    expense_type: ExpenseType
    amount: float
    notes: str | None
    created_at: datetime
    created_by: uuid.UUID
