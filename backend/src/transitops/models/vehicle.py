from sqlalchemy import CheckConstraint, Enum, Numeric, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from transitops.core.database import Base
from transitops.models.enums import VehicleStatus, VehicleType
from transitops.models.mixins import TimestampMixin, UUIDPKMixin


class Vehicle(Base, UUIDPKMixin, TimestampMixin):
    __tablename__ = "vehicles"
    __table_args__ = (
        CheckConstraint("max_load_capacity_kg > 0", name="ck_vehicles_capacity_positive"),
        CheckConstraint("odometer_km >= 0", name="ck_vehicles_odometer_nonneg"),
        CheckConstraint("acquisition_cost >= 0", name="ck_vehicles_cost_nonneg"),
    )

    registration_number: Mapped[str] = mapped_column(
        String(20), unique=True, nullable=False, index=True
    )
    name_model: Mapped[str] = mapped_column(String(120), nullable=False)
    vehicle_type: Mapped[VehicleType] = mapped_column(
        Enum(VehicleType, name="vehicle_type", native_enum=True), nullable=False
    )
    max_load_capacity_kg: Mapped[float] = mapped_column(Numeric(10, 2), nullable=False)
    odometer_km: Mapped[float] = mapped_column(Numeric(10, 2), nullable=False, default=0)
    acquisition_cost: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False)
    status: Mapped[VehicleStatus] = mapped_column(
        Enum(VehicleStatus, name="vehicle_status", native_enum=True),
        nullable=False,
        default=VehicleStatus.AVAILABLE,
        index=True,
    )
    region: Mapped[str | None] = mapped_column(String(80), index=True)

    trips: Mapped[list["Trip"]] = relationship(back_populates="vehicle")  # noqa: F821
    maintenance_logs: Mapped[list["MaintenanceLog"]] = relationship(  # noqa: F821
        back_populates="vehicle"
    )
    fuel_logs: Mapped[list["FuelLog"]] = relationship(back_populates="vehicle")  # noqa: F821
    expenses: Mapped[list["Expense"]] = relationship(back_populates="vehicle")  # noqa: F821
    documents: Mapped[list["VehicleDocument"]] = relationship(  # noqa: F821
        back_populates="vehicle"
    )
