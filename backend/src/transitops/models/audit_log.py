import uuid
from datetime import datetime

from sqlalchemy import JSON, DateTime, ForeignKey, String, func
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from transitops.core.database import Base
from transitops.models.mixins import UUIDPKMixin


class AuditLog(Base, UUIDPKMixin):
    __tablename__ = "audit_logs"

    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"), nullable=False, index=True)
    action: Mapped[str] = mapped_column(String(80), nullable=False, index=True)
    entity_name: Mapped[str] = mapped_column(String(80), nullable=False, index=True)
    entity_id: Mapped[uuid.UUID] = mapped_column(nullable=False, index=True)
    # Real JSONB on Postgres, plain JSON (TEXT-backed) on SQLite — one middleware writes this.
    payload: Mapped[dict | None] = mapped_column(JSON().with_variant(JSONB, "postgresql"))
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    user: Mapped["User"] = relationship()  # noqa: F821
