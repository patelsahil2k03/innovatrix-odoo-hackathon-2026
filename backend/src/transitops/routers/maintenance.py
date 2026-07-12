import uuid

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from transitops.core.database import get_db
from transitops.core.errors import NotFound
from transitops.core.pagination import ListParams, apply_sort, list_params, paginate
from transitops.core.rbac import get_current_user, require_maintenance_write
from transitops.models.enums import MaintenanceStatus
from transitops.models.maintenance_log import MaintenanceLog
from transitops.models.user import User
from transitops.schemas.common import Page
from transitops.schemas.maintenance import (
    MaintenanceClose,
    MaintenanceCreate,
    MaintenanceOut,
)
from transitops.services import dispatch

router = APIRouter(prefix="/maintenance", tags=["maintenance"])

SORTABLE = {
    "maintenance_type": MaintenanceLog.maintenance_type,
    "cost": MaintenanceLog.cost,
    "status": MaintenanceLog.status,
    "opened_at": MaintenanceLog.opened_at,
    "closed_at": MaintenanceLog.closed_at,
}


@router.get("", response_model=Page[MaintenanceOut])
def list_maintenance(
    params: ListParams = Depends(list_params),
    status_: MaintenanceStatus | None = Query(None, alias="status"),
    vehicle_id: uuid.UUID | None = None,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    stmt = select(MaintenanceLog)
    if status_:
        stmt = stmt.where(MaintenanceLog.status == status_)
    if vehicle_id:
        stmt = stmt.where(MaintenanceLog.vehicle_id == vehicle_id)
    if params.q:
        stmt = stmt.where(MaintenanceLog.description.ilike(f"%{params.q.strip()}%"))
    stmt = apply_sort(stmt, params.sort, SORTABLE, default="-opened_at")
    return paginate(db, stmt, params)


@router.post("", response_model=MaintenanceOut, status_code=status.HTTP_201_CREATED)
def open_maintenance(
    payload: MaintenanceCreate,
    db: Session = Depends(get_db),
    _: User = Depends(require_maintenance_write),
):
    """Side effect (00 §5): the vehicle goes `in_shop` and drops out of the dispatch pool."""
    return dispatch.open_maintenance(
        db,
        vehicle_id=payload.vehicle_id,
        maintenance_type=payload.maintenance_type,
        description=payload.description,
        cost=payload.cost,
    )


@router.post("/{maintenance_id}/close", response_model=MaintenanceOut)
def close_maintenance(
    maintenance_id: uuid.UUID,
    payload: MaintenanceClose,
    db: Session = Depends(get_db),
    _: User = Depends(require_maintenance_write),
):
    """Side effect (00 §5): vehicle returns to `available` — unless it is retired, or another
    maintenance job on it is still open."""
    log = db.get(MaintenanceLog, maintenance_id)
    if log is None:
        raise NotFound("Maintenance job", maintenance_id)
    return dispatch.close_maintenance(db, log, cost=payload.cost)
