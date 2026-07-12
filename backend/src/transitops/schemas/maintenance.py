import uuid
from datetime import datetime

from pydantic import BaseModel, Field

from transitops.models.enums import MaintenanceStatus, MaintenanceType
from transitops.schemas.common import ORMModel


class MaintenanceCreate(BaseModel):
    vehicle_id: uuid.UUID
    maintenance_type: MaintenanceType
    description: str | None = Field(default=None, max_length=2000)
    cost: float = Field(default=0, ge=0)


class MaintenanceClose(BaseModel):
    cost: float = Field(ge=0)


class MaintenanceOut(ORMModel):
    id: uuid.UUID
    vehicle_id: uuid.UUID
    maintenance_type: MaintenanceType
    description: str | None
    cost: float
    status: MaintenanceStatus
    opened_at: datetime
    closed_at: datetime | None
