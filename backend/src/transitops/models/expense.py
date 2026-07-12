import uuid
from datetime import datetime

from sqlalchemy import CheckConstraint, DateTime, Enum, ForeignKey, Numeric, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from transitops.core.database import Base
from transitops.models.enums import ExpenseType
from transitops.models.mixins import UUIDPKMixin


class Expense(Base, UUIDPKMixin):
    __tablename__ = "expenses"
    __table_args__ = (CheckConstraint("amount > 0", name="ck_expenses_amount_positive"),)

    vehicle_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("vehicles.id"), nullable=False, index=True
    )
    trip_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("trips.id"), index=True)
    expense_type: Mapped[ExpenseType] = mapped_column(
        Enum(ExpenseType, name="expense_type", native_enum=True), nullable=False
    )
    amount: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False)
    notes: Mapped[str | None] = mapped_column(String(255))
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    created_by: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"), nullable=False)

    vehicle: Mapped["Vehicle"] = relationship(back_populates="expenses")  # noqa: F821
    trip: Mapped["Trip | None"] = relationship(back_populates="expenses")  # noqa: F821
