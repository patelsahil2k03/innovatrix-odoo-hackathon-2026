import uuid
from datetime import datetime

from sqlalchemy import CheckConstraint, DateTime, Enum, ForeignKey, Numeric, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from transitops.core.database import Base
from transitops.models.enums import MaintenanceStatus, MaintenanceType
from transitops.models.mixins import UUIDPKMixin


class MaintenanceLog(Base, UUIDPKMixin):
    __tablename__ = "maintenance_logs"
    __table_args__ = (CheckConstraint("cost >= 0", name="ck_maintenance_cost_nonneg"),)

    vehicle_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("vehicles.id"), nullable=False, index=True
    )
    maintenance_type: Mapped[MaintenanceType] = mapped_column(
        Enum(MaintenanceType, name="maintenance_type", native_enum=True), nullable=False
    )
    description: Mapped[str | None] = mapped_column(Text)
    cost: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False, default=0)
    status: Mapped[MaintenanceStatus] = mapped_column(
        Enum(MaintenanceStatus, name="maintenance_status", native_enum=True),
        nullable=False,
        default=MaintenanceStatus.OPEN,
        index=True,
    )
    opened_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    closed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    vehicle: Mapped["Vehicle"] = relationship(back_populates="maintenance_logs")  # noqa: F821
