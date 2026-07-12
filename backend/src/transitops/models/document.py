import uuid
from datetime import date, datetime

from sqlalchemy import Date, DateTime, Enum, ForeignKey, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from transitops.core.database import Base
from transitops.models.enums import DocumentType
from transitops.models.mixins import UUIDPKMixin


class VehicleDocument(Base, UUIDPKMixin):
    __tablename__ = "vehicle_documents"

    vehicle_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("vehicles.id"), nullable=False, index=True
    )
    document_type: Mapped[DocumentType] = mapped_column(
        Enum(DocumentType, name="document_type", native_enum=True), nullable=False
    )
    document_number: Mapped[str | None] = mapped_column(String(60))
    expiry_date: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    file_url: Mapped[str | None] = mapped_column(String(500))
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    vehicle: Mapped["Vehicle"] = relationship(back_populates="documents")  # noqa: F821


class DriverDocument(Base, UUIDPKMixin):
    __tablename__ = "driver_documents"

    driver_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("drivers.id"), nullable=False, index=True
    )
    document_type: Mapped[DocumentType] = mapped_column(
        Enum(DocumentType, name="document_type", native_enum=True), nullable=False
    )
    document_number: Mapped[str | None] = mapped_column(String(60))
    expiry_date: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    file_url: Mapped[str | None] = mapped_column(String(500))
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    driver: Mapped["Driver"] = relationship(back_populates="documents")  # noqa: F821
