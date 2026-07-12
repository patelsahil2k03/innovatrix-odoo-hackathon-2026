import uuid
from datetime import datetime

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy import or_, select
from sqlalchemy.orm import Session, joinedload

from transitops.core.cities import CITY_NAMES, City, find_city, road_distance_km
from transitops.core.database import get_db
from transitops.core.errors import AppError, NotFound
from transitops.core.pagination import ListParams, apply_sort, list_params, paginate
from transitops.core.rbac import get_current_user, require_trip_write
from transitops.models.enums import TripStatus
from transitops.models.trip import Trip
from transitops.models.user import User
from transitops.schemas.common import Page
from transitops.schemas.trip import (
    Suggestion,
    TripComplete,
    TripCreate,
    TripDetail,
    TripLive,
    TripOut,
    TripUpdate,
)
from transitops.services import dispatch, suggestions

router = APIRouter(prefix="/trips", tags=["trips"])

SORTABLE = {
    "source_city": Trip.source_city,
    "dest_city": Trip.dest_city,
    "cargo_weight_kg": Trip.cargo_weight_kg,
    "planned_distance_km": Trip.planned_distance_km,
    "revenue": Trip.revenue,
    "status": Trip.status,
    "dispatched_at": Trip.dispatched_at,
    "completed_at": Trip.completed_at,
    "created_at": Trip.created_at,
}


def _get(db: Session, trip_id: uuid.UUID) -> Trip:
    trip = db.get(Trip, trip_id)
    if trip is None:
        raise NotFound("Trip", trip_id)
    return trip


def _resolve_city(name: str, field: str) -> City:
    city = find_city(name)
    if city is None:
        raise AppError(
            "UNKNOWN_CITY",
            f"'{name}' is not in the city catalog",
            fields={field: f"Choose one of: {', '.join(CITY_NAMES)}"},
        )
    return city


@router.get("", response_model=Page[TripOut])
def list_trips(
    params: ListParams = Depends(list_params),
    status_: TripStatus | None = Query(None, alias="status"),
    vehicle_id: uuid.UUID | None = None,
    driver_id: uuid.UUID | None = None,
    date_from: datetime | None = Query(None, description="Trips created on/after this instant"),
    date_to: datetime | None = Query(None, description="Trips created on/before this instant"),
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    stmt = select(Trip)
    if status_:
        stmt = stmt.where(Trip.status == status_)
    if vehicle_id:
        stmt = stmt.where(Trip.vehicle_id == vehicle_id)
    if driver_id:
        stmt = stmt.where(Trip.driver_id == driver_id)
    if date_from:
        stmt = stmt.where(Trip.created_at >= date_from)
    if date_to:
        stmt = stmt.where(Trip.created_at <= date_to)
    if params.q:
        like = f"%{params.q.strip()}%"
        stmt = stmt.where(or_(Trip.source_city.ilike(like), Trip.dest_city.ilike(like)))
    stmt = apply_sort(stmt, params.sort, SORTABLE, default="-created_at")
    return paginate(db, stmt, params)


@router.get("/live", response_model=list[TripLive])
def live_trips(db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    """Map bootstrap: every dispatched trip with its interpolated current position."""
    trips = db.scalars(
        select(Trip)
        .options(joinedload(Trip.vehicle), joinedload(Trip.driver))
        .where(Trip.status == TripStatus.DISPATCHED)
    ).all()

    out = []
    for trip in trips:
        progress = float(trip.progress_percent) / 100.0
        s_lat, s_lng = float(trip.source_lat), float(trip.source_lng)
        d_lat, d_lng = float(trip.dest_lat), float(trip.dest_lng)
        out.append(
            TripLive(
                id=trip.id,
                status=trip.status,
                source_city=trip.source_city,
                dest_city=trip.dest_city,
                source_lat=s_lat,
                source_lng=s_lng,
                dest_lat=d_lat,
                dest_lng=d_lng,
                progress_percent=float(trip.progress_percent),
                # Straight-line interpolation — no routing engine, and it reads perfectly on a map.
                current_lat=round(s_lat + (d_lat - s_lat) * progress, 6),
                current_lng=round(s_lng + (d_lng - s_lng) * progress, 6),
                vehicle_registration=trip.vehicle.registration_number,
                driver_name=trip.driver.name,
            )
        )
    return out


@router.get("/suggestions", response_model=list[Suggestion])
def suggestions_for_cargo(
    cargo_weight_kg: float = Query(gt=0),
    limit: int = Query(3, ge=1, le=10),
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    """W2 before a trip exists — what the wizard calls while the dispatcher is still choosing."""
    return suggestions.suggest_for(db, cargo_weight_kg, limit=limit)


@router.post("", response_model=TripOut, status_code=status.HTTP_201_CREATED)
def create_trip(
    payload: TripCreate,
    db: Session = Depends(get_db),
    user: User = Depends(require_trip_write),
):
    """Creates a draft — but validates every dispatch guard now, so the wizard fails fast."""
    source = _resolve_city(payload.source_city, "source_city")
    dest = _resolve_city(payload.dest_city, "dest_city")
    if source.name == dest.name:
        raise AppError(
            "SAME_SOURCE_AND_DEST",
            "Source and destination must differ",
            fields={"dest_city": "Must differ from the source city"},
        )

    dispatch.validate_assignment(
        db, payload.vehicle_id, payload.driver_id, payload.cargo_weight_kg
    )

    trip = Trip(
        vehicle_id=payload.vehicle_id,
        driver_id=payload.driver_id,
        created_by=user.id,
        source_city=source.name,
        source_lat=source.lat,
        source_lng=source.lng,
        dest_city=dest.name,
        dest_lat=dest.lat,
        dest_lng=dest.lng,
        cargo_weight_kg=payload.cargo_weight_kg,
        planned_distance_km=payload.planned_distance_km or road_distance_km(source, dest),
        revenue=payload.revenue,
        status=TripStatus.DRAFT,
    )
    db.add(trip)
    db.commit()
    db.refresh(trip)
    return trip


@router.get("/{trip_id}", response_model=TripDetail)
def get_trip(
    trip_id: uuid.UUID, db: Session = Depends(get_db), _: User = Depends(get_current_user)
):
    trip = db.scalar(
        select(Trip)
        .options(joinedload(Trip.vehicle), joinedload(Trip.driver))
        .where(Trip.id == trip_id)
    )
    if trip is None:
        raise NotFound("Trip", trip_id)
    return trip


@router.patch("/{trip_id}", response_model=TripOut)
def update_trip(
    trip_id: uuid.UUID,
    payload: TripUpdate,
    db: Session = Depends(get_db),
    _: User = Depends(require_trip_write),
):
    trip = _get(db, trip_id)
    if trip.status != TripStatus.DRAFT:
        raise AppError(
            "TRIP_NOT_DRAFT",
            f"Only draft trips can be edited (this one is {trip.status.value})",
            fields={"status": "Trip is not a draft"},
        )

    changes = payload.model_dump(exclude_unset=True)

    if "source_city" in changes:
        source = _resolve_city(changes["source_city"], "source_city")
        changes["source_city"] = source.name
        changes["source_lat"], changes["source_lng"] = source.lat, source.lng
    if "dest_city" in changes:
        dest = _resolve_city(changes["dest_city"], "dest_city")
        changes["dest_city"] = dest.name
        changes["dest_lat"], changes["dest_lng"] = dest.lat, dest.lng

    # Re-validate the whole assignment against the post-edit values: swapping in a heavier cargo
    # or a smaller vehicle must be caught here, not at dispatch time.
    vehicle_id = changes.get("vehicle_id", trip.vehicle_id)
    driver_id = changes.get("driver_id", trip.driver_id)
    cargo = changes.get("cargo_weight_kg", float(trip.cargo_weight_kg))

    if {"vehicle_id", "driver_id", "cargo_weight_kg"} & changes.keys():
        # The trip's own vehicle/driver are legitimately "not available" only if some *other*
        # trip took them; a draft holds no resources, so a plain re-validate is correct here.
        dispatch.validate_assignment(db, vehicle_id, driver_id, cargo)

    for field, value in changes.items():
        setattr(trip, field, value)

    if trip.source_city == trip.dest_city:
        raise AppError(
            "SAME_SOURCE_AND_DEST",
            "Source and destination must differ",
            fields={"dest_city": "Must differ from the source city"},
        )

    db.commit()
    db.refresh(trip)
    return trip


@router.post("/{trip_id}/dispatch", response_model=TripOut)
def dispatch_trip(
    trip_id: uuid.UUID,
    db: Session = Depends(get_db),
    _: User = Depends(require_trip_write),
):
    return dispatch.dispatch_trip(db, _get(db, trip_id))


@router.post("/{trip_id}/complete", response_model=TripOut)
def complete_trip(
    trip_id: uuid.UUID,
    payload: TripComplete,
    db: Session = Depends(get_db),
    user: User = Depends(require_trip_write),
):
    return dispatch.complete_trip(
        db,
        _get(db, trip_id),
        actual_distance_km=payload.actual_distance_km,
        final_odometer_km=payload.final_odometer_km,
        user_id=user.id,
        fuel=payload.fuel.model_dump() if payload.fuel else None,
    )


@router.post("/{trip_id}/cancel", response_model=TripOut)
def cancel_trip(
    trip_id: uuid.UUID,
    db: Session = Depends(get_db),
    _: User = Depends(require_trip_write),
):
    return dispatch.cancel_trip(db, _get(db, trip_id))


@router.get("/{trip_id}/suggestions", response_model=list[Suggestion])
def trip_suggestions(
    trip_id: uuid.UUID,
    limit: int = Query(3, ge=1, le=10),
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    trip = _get(db, trip_id)
    return suggestions.suggest_for(
        db, float(trip.cargo_weight_kg), limit=limit, exclude_trip=trip.id
    )
