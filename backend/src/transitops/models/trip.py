import uuid
from datetime import datetime

from sqlalchemy import CheckConstraint, DateTime, Enum, ForeignKey, Index, Numeric, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from transitops.core.database import Base
from transitops.models.enums import TripStatus
from transitops.models.mixins import TimestampMixin, UUIDPKMixin


class Trip(Base, UUIDPKMixin, TimestampMixin):
    __tablename__ = "trips"
    __table_args__ = (
        CheckConstraint("cargo_weight_kg > 0", name="ck_trips_cargo_positive"),
        CheckConstraint(
            "progress_percent >= 0 AND progress_percent <= 100", name="ck_trips_progress_range"
        ),
        Index("ix_trips_status", "status"),
        Index("ix_trips_vehicle_status", "vehicle_id", "status"),
        Index("ix_trips_driver_status", "driver_id", "status"),
    )

    vehicle_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("vehicles.id"), nullable=False)
    driver_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("drivers.id"), nullable=False)
    created_by: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"), nullable=False)

    source_city: Mapped[str] = mapped_column(String(80), nullable=False)
    source_lat: Mapped[float] = mapped_column(Numeric(9, 6), nullable=False)
    source_lng: Mapped[float] = mapped_column(Numeric(9, 6), nullable=False)
    dest_city: Mapped[str] = mapped_column(String(80), nullable=False)
    dest_lat: Mapped[float] = mapped_column(Numeric(9, 6), nullable=False)
    dest_lng: Mapped[float] = mapped_column(Numeric(9, 6), nullable=False)

    cargo_weight_kg: Mapped[float] = mapped_column(Numeric(10, 2), nullable=False)
    planned_distance_km: Mapped[float] = mapped_column(Numeric(8, 2), nullable=False)
    actual_distance_km: Mapped[float | None] = mapped_column(Numeric(8, 2))
    revenue: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False, default=0)

    status: Mapped[TripStatus] = mapped_column(
        Enum(TripStatus, name="trip_status", native_enum=True),
        nullable=False,
        default=TripStatus.DRAFT,
    )
    # Advanced by the simulator (Card C services/simulator.py) while dispatched; the deck.gl
    # map reads this to place the vehicle marker along the source→dest line (no routing engine).
    progress_percent: Mapped[float] = mapped_column(Numeric(5, 2), nullable=False, default=0)

    dispatched_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    vehicle: Mapped["Vehicle"] = relationship(back_populates="trips")  # noqa: F821
    driver: Mapped["Driver"] = relationship(back_populates="trips")  # noqa: F821
    creator: Mapped["User"] = relationship()  # noqa: F821
    fuel_logs: Mapped[list["FuelLog"]] = relationship(back_populates="trip")  # noqa: F821
    expenses: Mapped[list["Expense"]] = relationship(back_populates="trip")  # noqa: F821
