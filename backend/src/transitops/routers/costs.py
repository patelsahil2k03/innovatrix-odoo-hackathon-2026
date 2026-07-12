"""Fuel logs and expenses (contract §6). Write access: dispatcher or financial analyst."""

import uuid
from datetime import UTC, datetime

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from transitops.core import events
from transitops.core.database import get_db
from transitops.core.errors import AppError, NotFound
from transitops.core.pagination import ListParams, apply_sort, list_params, paginate
from transitops.core.rbac import get_current_user, require_cost_write
from transitops.models.enums import ExpenseType
from transitops.models.expense import Expense
from transitops.models.fuel_log import FuelLog
from transitops.models.trip import Trip
from transitops.models.user import User
from transitops.models.vehicle import Vehicle
from transitops.schemas.common import Page
from transitops.schemas.cost import ExpenseCreate, ExpenseOut, FuelLogCreate, FuelLogOut

fuel_router = APIRouter(prefix="/fuel-logs", tags=["fuel & expenses"])
expense_router = APIRouter(prefix="/expenses", tags=["fuel & expenses"])

FUEL_SORTABLE = {
    "liters": FuelLog.liters,
    "cost": FuelLog.cost,
    "logged_at": FuelLog.logged_at,
    "odometer_at_fill": FuelLog.odometer_at_fill,
}
EXPENSE_SORTABLE = {
    "expense_type": Expense.expense_type,
    "amount": Expense.amount,
    "created_at": Expense.created_at,
}


def _check_vehicle_and_trip(
    db: Session, vehicle_id: uuid.UUID, trip_id: uuid.UUID | None
) -> None:
    """A cost row always belongs to a vehicle; if it also names a trip, that trip must be the
    same vehicle's — otherwise the per-vehicle cost totals would silently be wrong."""
    if db.get(Vehicle, vehicle_id) is None:
        raise NotFound("Vehicle", vehicle_id)

    if trip_id is None:
        return

    trip = db.get(Trip, trip_id)
    if trip is None:
        raise NotFound("Trip", trip_id)
    if trip.vehicle_id != vehicle_id:
        raise AppError(
            "TRIP_VEHICLE_MISMATCH",
            "That trip belongs to a different vehicle",
            fields={"trip_id": "Trip is not for this vehicle"},
        )


@fuel_router.get("", response_model=Page[FuelLogOut])
def list_fuel_logs(
    params: ListParams = Depends(list_params),
    vehicle_id: uuid.UUID | None = None,
    trip_id: uuid.UUID | None = None,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    stmt = select(FuelLog)
    if vehicle_id:
        stmt = stmt.where(FuelLog.vehicle_id == vehicle_id)
    if trip_id:
        stmt = stmt.where(FuelLog.trip_id == trip_id)
    stmt = apply_sort(stmt, params.sort, FUEL_SORTABLE, default="-logged_at")
    return paginate(db, stmt, params)


@fuel_router.post("", response_model=FuelLogOut, status_code=status.HTTP_201_CREATED)
def create_fuel_log(
    payload: FuelLogCreate,
    db: Session = Depends(get_db),
    user: User = Depends(require_cost_write),
):
    _check_vehicle_and_trip(db, payload.vehicle_id, payload.trip_id)

    log = FuelLog(
        vehicle_id=payload.vehicle_id,
        trip_id=payload.trip_id,
        liters=payload.liters,
        cost=payload.cost,
        odometer_at_fill=payload.odometer_at_fill,
        logged_at=payload.logged_at or datetime.now(UTC),
        created_by=user.id,
    )
    db.add(log)
    db.commit()
    db.refresh(log)

    events.hub.publish(events.FUEL_LOGGED, vehicle_id=str(log.vehicle_id), fuel_log_id=str(log.id))
    events.hub.publish(events.KPI_REFRESH)
    return log


@expense_router.get("", response_model=Page[ExpenseOut])
def list_expenses(
    params: ListParams = Depends(list_params),
    vehicle_id: uuid.UUID | None = None,
    trip_id: uuid.UUID | None = None,
    expense_type: ExpenseType | None = None,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    stmt = select(Expense)
    if vehicle_id:
        stmt = stmt.where(Expense.vehicle_id == vehicle_id)
    if trip_id:
        stmt = stmt.where(Expense.trip_id == trip_id)
    if expense_type:
        stmt = stmt.where(Expense.expense_type == expense_type)
    if params.q:
        stmt = stmt.where(Expense.notes.ilike(f"%{params.q.strip()}%"))
    stmt = apply_sort(stmt, params.sort, EXPENSE_SORTABLE, default="-created_at")
    return paginate(db, stmt, params)


@expense_router.post("", response_model=ExpenseOut, status_code=status.HTTP_201_CREATED)
def create_expense(
    payload: ExpenseCreate,
    db: Session = Depends(get_db),
    user: User = Depends(require_cost_write),
):
    _check_vehicle_and_trip(db, payload.vehicle_id, payload.trip_id)

    expense = Expense(
        vehicle_id=payload.vehicle_id,
        trip_id=payload.trip_id,
        expense_type=payload.expense_type,
        amount=payload.amount,
        notes=payload.notes,
        created_by=user.id,
    )
    db.add(expense)
    db.commit()
    db.refresh(expense)

    events.hub.publish(
        events.EXPENSE_LOGGED, vehicle_id=str(expense.vehicle_id), expense_id=str(expense.id)
    )
    events.hub.publish(events.KPI_REFRESH)
    return expense
