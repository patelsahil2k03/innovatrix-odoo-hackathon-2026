import uuid
from datetime import datetime

from sqlalchemy import DateTime, Enum, String, func
from sqlalchemy.orm import Mapped, mapped_column

from transitops.core.database import Base
from transitops.models.enums import AlertEntityType, AlertSeverity, AlertStatus, AlertType
from transitops.models.mixins import UUIDPKMixin


class Alert(Base, UUIDPKMixin):
    __tablename__ = "alerts"

    type: Mapped[AlertType] = mapped_column(
        Enum(AlertType, name="alert_type", native_enum=True), nullable=False, index=True
    )
    severity: Mapped[AlertSeverity] = mapped_column(
        Enum(AlertSeverity, name="alert_severity", native_enum=True), nullable=False
    )
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    # Polymorphic reference (no FK — the referenced table varies) per docs/03_SCHEMA.md §4.
    entity_type: Mapped[AlertEntityType] = mapped_column(
        Enum(AlertEntityType, name="alert_entity_type", native_enum=True), nullable=False
    )
    entity_id: Mapped[uuid.UUID] = mapped_column(nullable=False, index=True)
    status: Mapped[AlertStatus] = mapped_column(
        Enum(AlertStatus, name="alert_status", native_enum=True),
        nullable=False,
        default=AlertStatus.ACTIVE,
        index=True,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
