import uuid
from datetime import UTC, datetime, timedelta

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from transitops.core import events
from transitops.core.database import get_db
from transitops.core.errors import AppError, Conflict, NotFound
from transitops.core.pagination import ListParams, apply_sort, list_params, paginate
from transitops.core.rbac import get_current_user, require_driver_write
from transitops.models.driver import Driver
from transitops.models.enums import DriverStatus, LicenseCategory
from transitops.models.user import User
from transitops.schemas.common import Page
from transitops.schemas.driver import (
    DriverCreate,
    DriverDetail,
    DriverOut,
    DriverPerformance,
    DriverUpdate,
)
from transitops.services import analytics

router = APIRouter(prefix="/drivers", tags=["drivers"])

SORTABLE = {
    "name": Driver.name,
    "license_number": Driver.license_number,
    "license_category": Driver.license_category,
    "license_expiry_date": Driver.license_expiry_date,
    "safety_score": Driver.safety_score,
    "status": Driver.status,
    "created_at": Driver.created_at,
}


def _get(db: Session, driver_id: uuid.UUID) -> Driver:
    driver = db.get(Driver, driver_id)
    if driver is None:
        raise NotFound("Driver", driver_id)
    return driver


@router.get("", response_model=Page[DriverOut])
def list_drivers(
    params: ListParams = Depends(list_params),
    status_: DriverStatus | None = Query(None, alias="status"),
    license_category: LicenseCategory | None = None,
    expiring_within_days: int | None = Query(
        None, ge=0, le=3650, description="Licences expiring within N days (includes expired)"
    ),
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    stmt = select(Driver)
    if status_:
        stmt = stmt.where(Driver.status == status_)
    if license_category:
        stmt = stmt.where(Driver.license_category == license_category)
    if expiring_within_days is not None:
        cutoff = datetime.now(UTC).date() + timedelta(days=expiring_within_days)
        stmt = stmt.where(Driver.license_expiry_date <= cutoff)
    if params.q:
        like = f"%{params.q.strip()}%"
        stmt = stmt.where(
            or_(Driver.name.ilike(like), Driver.license_number.ilike(like), Driver.phone.ilike(like))
        )
    stmt = apply_sort(stmt, params.sort, SORTABLE, default="name")
    return paginate(db, stmt, params)


@router.get("/assignable", response_model=list[DriverOut])
def assignable(db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    """Feeds the trip wizard: available AND licence not expired. Dispatch re-checks under a lock."""
    today = datetime.now(UTC).date()
    return list(
        db.scalars(
            select(Driver)
            .where(
                Driver.status == DriverStatus.AVAILABLE,
                Driver.license_expiry_date >= today,
            )
            .order_by(Driver.safety_score.desc())
        ).all()
    )


@router.post("", response_model=DriverOut, status_code=status.HTTP_201_CREATED)
def create_driver(
    payload: DriverCreate,
    db: Session = Depends(get_db),
    _: User = Depends(require_driver_write),
):
    existing = db.scalar(
        select(Driver.id).where(Driver.license_number == payload.license_number)
    )
    if existing:
        raise Conflict(
            "DUPLICATE_LICENSE",
            f"A driver with licence {payload.license_number} already exists",
            fields={"license_number": "Already registered"},
        )

    driver = Driver(**payload.model_dump())
    db.add(driver)
    db.commit()
    db.refresh(driver)

    events.hub.publish(events.KPI_REFRESH)
    return driver


@router.get("/{driver_id}", response_model=DriverDetail)
def get_driver(
    driver_id: uuid.UUID, db: Session = Depends(get_db), _: User = Depends(get_current_user)
):
    driver = _get(db, driver_id)
    return DriverDetail(
        **DriverOut.model_validate(driver).model_dump(),
        performance=DriverPerformance(**analytics.driver_performance(db, driver)),
    )


@router.patch("/{driver_id}", response_model=DriverOut)
def update_driver(
    driver_id: uuid.UUID,
    payload: DriverUpdate,
    db: Session = Depends(get_db),
    _: User = Depends(require_driver_write),
):
    driver = _get(db, driver_id)
    changes = payload.model_dump(exclude_unset=True)

    # A driver mid-trip can't be edited out from under it — no suspending someone who is on
    # the road, and no hand-editing them "off" a trip (complete or cancel it instead).
    if driver.status == DriverStatus.ON_TRIP and changes:
        raise AppError(
            "DRIVER_ON_TRIP",
            f"{driver.name} is on a trip; complete or cancel it before editing",
            fields={"status": "Driver is currently on a trip"},
        )
    if changes.get("status") == DriverStatus.ON_TRIP:
        raise AppError(
            "INVALID_STATUS_TRANSITION",
            "A driver is put on a trip by dispatching one, not by editing their status",
            fields={"status": "Dispatch a trip instead"},
        )

    for field, value in changes.items():
        setattr(driver, field, value)

    db.commit()
    db.refresh(driver)

    if "status" in changes:
        events.hub.publish(
            events.DRIVER_STATUS_CHANGED, driver_id=str(driver.id), status=driver.status.value
        )
    events.hub.publish(events.KPI_REFRESH)
    return driver
