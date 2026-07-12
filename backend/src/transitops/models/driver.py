from datetime import date

from sqlalchemy import CheckConstraint, Date, Enum, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from transitops.core.database import Base
from transitops.models.enums import DriverStatus, LicenseCategory
from transitops.models.mixins import TimestampMixin, UUIDPKMixin


class Driver(Base, UUIDPKMixin, TimestampMixin):
    __tablename__ = "drivers"
    __table_args__ = (
        CheckConstraint("safety_score >= 0 AND safety_score <= 100", name="ck_drivers_safety_range"),
    )

    name: Mapped[str] = mapped_column(String(120), nullable=False)
    phone: Mapped[str | None] = mapped_column(String(20))
    license_number: Mapped[str] = mapped_column(String(30), unique=True, nullable=False, index=True)
    license_category: Mapped[LicenseCategory] = mapped_column(
        Enum(LicenseCategory, name="license_category", native_enum=True), nullable=False
    )
    # Deliberately nullable-false but allowed to be in the past: drivers WITH expired licenses
    # exist in the seed on purpose — they're just unassignable (service-layer guard), never
    # rejected at the data layer. See docs/03_SCHEMA.md.
    license_expiry_date: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    safety_score: Mapped[int] = mapped_column(Integer, nullable=False, default=100)
    status: Mapped[DriverStatus] = mapped_column(
        Enum(DriverStatus, name="driver_status", native_enum=True),
        nullable=False,
        default=DriverStatus.AVAILABLE,
        index=True,
    )

    trips: Mapped[list["Trip"]] = relationship(back_populates="driver")  # noqa: F821
    documents: Mapped[list["DriverDocument"]] = relationship(  # noqa: F821
        back_populates="driver"
    )
