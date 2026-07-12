import uuid

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from transitops.core import events
from transitops.core.database import get_db
from transitops.core.errors import AppError, Conflict, NotFound
from transitops.core.pagination import ListParams, apply_sort, list_params, paginate
from transitops.core.rbac import get_current_user, require_vehicle_write
from transitops.models.document import VehicleDocument
from transitops.models.enums import (
    MaintenanceStatus,
    TripStatus,
    VehicleStatus,
    VehicleType,
)
from transitops.models.expense import Expense
from transitops.models.fuel_log import FuelLog
from transitops.models.maintenance_log import MaintenanceLog
from transitops.models.trip import Trip
from transitops.models.user import User
from transitops.models.vehicle import Vehicle
from transitops.schemas.common import Page
from transitops.schemas.vehicle import (
    VehicleCosts,
    VehicleCreate,
    VehicleDetail,
    VehicleMetrics,
    VehicleOut,
    VehicleUpdate,
)
from transitops.services import analytics

router = APIRouter(prefix="/vehicles", tags=["vehicles"])

SORTABLE = {
    "registration_number": Vehicle.registration_number,
    "name_model": Vehicle.name_model,
    "vehicle_type": Vehicle.vehicle_type,
    "max_load_capacity_kg": Vehicle.max_load_capacity_kg,
    "odometer_km": Vehicle.odometer_km,
    "acquisition_cost": Vehicle.acquisition_cost,
    "status": Vehicle.status,
    "region": Vehicle.region,
    "created_at": Vehicle.created_at,
}


def _get(db: Session, vehicle_id: uuid.UUID) -> Vehicle:
    vehicle = db.get(Vehicle, vehicle_id)
    if vehicle is None:
        raise NotFound("Vehicle", vehicle_id)
    return vehicle


@router.get("", response_model=Page[VehicleOut])
def list_vehicles(
    params: ListParams = Depends(list_params),
    status_: VehicleStatus | None = Query(None, alias="status"),
    vehicle_type: VehicleType | None = None,
    region: str | None = None,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    stmt = select(Vehicle)
    if status_:
        stmt = stmt.where(Vehicle.status == status_)
    if vehicle_type:
        stmt = stmt.where(Vehicle.vehicle_type == vehicle_type)
    if region:
        stmt = stmt.where(Vehicle.region == region)
    if params.q:
        like = f"%{params.q.strip()}%"
        stmt = stmt.where(
            or_(
                Vehicle.registration_number.ilike(like),
                Vehicle.name_model.ilike(like),
                Vehicle.region.ilike(like),
            )
        )
    stmt = apply_sort(stmt, params.sort, SORTABLE, default="registration_number")
    return paginate(db, stmt, params)


@router.get("/dispatchable", response_model=list[VehicleOut])
def dispatchable(
    cargo_weight_kg: float = Query(0, ge=0, description="Only vehicles that can carry this load"),
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    """Feeds the trip wizard. A UX filter only — dispatch re-checks all of this under a row lock."""
    return list(
        db.scalars(
            select(Vehicle)
            .where(
                Vehicle.status == VehicleStatus.AVAILABLE,
                Vehicle.max_load_capacity_kg >= cargo_weight_kg,
            )
            .order_by(Vehicle.max_load_capacity_kg)
        ).all()
    )


@router.post("", response_model=VehicleOut, status_code=status.HTTP_201_CREATED)
def create_vehicle(
    payload: VehicleCreate,
    db: Session = Depends(get_db),
    _: User = Depends(require_vehicle_write),
):
    existing = db.scalar(
        select(Vehicle.id).where(
            Vehicle.registration_number == payload.registration_number
        )
    )
    if existing:
        raise Conflict(
            "DUPLICATE_REGISTRATION",
            f"A vehicle with registration {payload.registration_number} already exists",
            fields={"registration_number": "Already registered"},
        )

    vehicle = Vehicle(**payload.model_dump())
    db.add(vehicle)
    db.commit()
    db.refresh(vehicle)

    events.hub.publish(events.KPI_REFRESH)
    return vehicle


@router.get("/{vehicle_id}", response_model=VehicleDetail)
def get_vehicle(
    vehicle_id: uuid.UUID,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    vehicle = _get(db, vehicle_id)
    return VehicleDetail(
        **VehicleOut.model_validate(vehicle).model_dump(),
        costs=VehicleCosts(**analytics.vehicle_costs(db, vehicle.id)),
        metrics=VehicleMetrics(**analytics.vehicle_metrics(db, vehicle)),
    )


@router.get("/{vehicle_id}/costs", response_model=VehicleCosts)
def get_costs(
    vehicle_id: uuid.UUID,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    _get(db, vehicle_id)
    return analytics.vehicle_costs(db, vehicle_id)


@router.patch("/{vehicle_id}", response_model=VehicleOut)
def update_vehicle(
    vehicle_id: uuid.UUID,
    payload: VehicleUpdate,
    db: Session = Depends(get_db),
    _: User = Depends(require_vehicle_write),
):
    vehicle = _get(db, vehicle_id)
    changes = payload.model_dump(exclude_unset=True)

    new_status = changes.get("status")
    if new_status and new_status != vehicle.status:
        # A vehicle mid-trip can't be retired or sent to the shop out from under the trip —
        # cancel or complete the trip first.
        if vehicle.status == VehicleStatus.ON_TRIP:
            raise AppError(
                "VEHICLE_ON_TRIP",
                f"{vehicle.registration_number} is on a trip; complete or cancel it first",
                fields={"status": "Vehicle is currently on a trip"},
            )
        if new_status == VehicleStatus.ON_TRIP:
            raise AppError(
                "INVALID_STATUS_TRANSITION",
                "A vehicle is put on a trip by dispatching it, not by editing its status",
                fields={"status": "Dispatch a trip instead"},
            )
        # 00 §5: an open maintenance job pins the vehicle to the shop. Editing it back to
        # available here would put it in the dispatch pool with the job still open — close the
        # job instead (that transition is what returns it to available). Retiring is still fine.
        if new_status == VehicleStatus.AVAILABLE:
            open_job = db.scalar(
                select(MaintenanceLog.id).where(
                    MaintenanceLog.vehicle_id == vehicle.id,
                    MaintenanceLog.status == MaintenanceStatus.OPEN,
                )
            )
            if open_job:
                raise AppError(
                    "MAINTENANCE_OPEN",
                    f"{vehicle.registration_number} has an open maintenance job; "
                    "close it to return the vehicle to service",
                    fields={"status": "Close the open maintenance job first"},
                )

    # Shrinking capacity below what a live trip is already carrying would make that trip illegal.
    new_capacity = changes.get("max_load_capacity_kg")
    if new_capacity is not None:
        heaviest = db.scalar(
            select(func.max(Trip.cargo_weight_kg)).where(
                Trip.vehicle_id == vehicle.id,
                Trip.status.in_((TripStatus.DRAFT, TripStatus.DISPATCHED)),
            )
        )
        if heaviest is not None and float(new_capacity) < float(heaviest):
            raise AppError(
                "CAPACITY_BELOW_ACTIVE_CARGO",
                f"An active trip on this vehicle carries {float(heaviest):g} kg",
                fields={"max_load_capacity_kg": f"Must be ≥ {float(heaviest):g}"},
            )

    for field, value in changes.items():
        setattr(vehicle, field, value)

    db.commit()
    db.refresh(vehicle)

    if new_status:
        events.hub.publish(
            events.VEHICLE_STATUS_CHANGED,
            vehicle_id=str(vehicle.id),
            status=vehicle.status.value,
        )
    events.hub.publish(events.KPI_REFRESH)
    return vehicle


@router.delete("/{vehicle_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_vehicle(
    vehicle_id: uuid.UUID,
    db: Session = Depends(get_db),
    _: User = Depends(require_vehicle_write),
):
    """Soft delete → `retired`. Hard delete only when the vehicle has no trip history to orphan."""
    vehicle = _get(db, vehicle_id)

    if vehicle.status == VehicleStatus.ON_TRIP:
        raise AppError(
            "VEHICLE_ON_TRIP",
            f"{vehicle.registration_number} is on a trip; complete or cancel it first",
            fields={"status": "Vehicle is currently on a trip"},
        )

    # Every table that points at this vehicle, not just trips — a vehicle can carry fuel logs or
    # expenses with no trip at all, and hard-deleting it would trip an FK violation.
    has_history = any(
        db.scalar(select(func.count(model.id)).where(model.vehicle_id == vehicle.id))
        for model in (Trip, FuelLog, Expense, MaintenanceLog, VehicleDocument)
    )
    if has_history:
        vehicle.status = VehicleStatus.RETIRED
    else:
        db.delete(vehicle)

    db.commit()
    events.hub.publish(events.KPI_REFRESH)
