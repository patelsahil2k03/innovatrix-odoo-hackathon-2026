import uuid
from datetime import datetime

from sqlalchemy import CheckConstraint, DateTime, ForeignKey, Numeric
from sqlalchemy.orm import Mapped, mapped_column, relationship

from transitops.core.database import Base
from transitops.models.mixins import UUIDPKMixin


class FuelLog(Base, UUIDPKMixin):
    __tablename__ = "fuel_logs"
    __table_args__ = (
        CheckConstraint("liters > 0", name="ck_fuel_liters_positive"),
        CheckConstraint("cost >= 0", name="ck_fuel_cost_nonneg"),
    )

    vehicle_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("vehicles.id"), nullable=False, index=True
    )
    trip_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("trips.id"), index=True)
    liters: Mapped[float] = mapped_column(Numeric(8, 2), nullable=False)
    cost: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False)
    odometer_at_fill: Mapped[float | None] = mapped_column(Numeric(10, 2))
    logged_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    created_by: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"), nullable=False)

    vehicle: Mapped["Vehicle"] = relationship(back_populates="fuel_logs")  # noqa: F821
    trip: Mapped["Trip | None"] = relationship(back_populates="fuel_logs")  # noqa: F821
