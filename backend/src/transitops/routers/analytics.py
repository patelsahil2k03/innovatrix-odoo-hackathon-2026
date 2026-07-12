import csv
import io
from collections.abc import Iterator

from fastapi import APIRouter, Depends, Query
from fastapi.responses import StreamingResponse
from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload

from transitops.core.database import get_db
from transitops.core.errors import AppError
from transitops.core.rbac import get_current_user
from transitops.models.enums import VehicleStatus, VehicleType
from transitops.models.expense import Expense
from transitops.models.trip import Trip
from transitops.models.user import User
from transitops.schemas.analytics import FleetRow, Kpis, Trends
from transitops.services import analytics

router = APIRouter(tags=["analytics"])


@router.get("/analytics/kpis", response_model=Kpis)
def kpis(
    vehicle_type: VehicleType | None = None,
    status: VehicleStatus | None = None,
    region: str | None = None,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    return analytics.kpis(db, vehicle_type=vehicle_type, status=status, region=region)


@router.get("/analytics/fleet", response_model=list[FleetRow])
def fleet(
    vehicle_type: VehicleType | None = None,
    status: VehicleStatus | None = None,
    region: str | None = None,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    return analytics.fleet_report(db, vehicle_type=vehicle_type, status=status, region=region)


@router.get("/analytics/trends", response_model=Trends)
def trends(
    weeks: int = Query(8, ge=1, le=52),
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    return analytics.trends(db, weeks=weeks)


def _csv_stream(header: list[str], rows: list[list]) -> Iterator[str]:
    """Stream rather than build one big string — a 10k-row export shouldn't sit in memory."""
    buffer = io.StringIO()
    writer = csv.writer(buffer)

    writer.writerow(header)
    yield buffer.getvalue()
    buffer.seek(0)
    buffer.truncate(0)

    for row in rows:
        writer.writerow(row)
        yield buffer.getvalue()
        buffer.seek(0)
        buffer.truncate(0)


@router.get("/export/csv")
def export_csv(
    report: str = Query(description="fleet | trips | expenses"),
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    if report == "fleet":
        header = [
            "registration_number",
            "name_model",
            "vehicle_type",
            "region",
            "status",
            "total_trips",
            "total_distance_km",
            "total_liters",
            "fuel_efficiency_kmpl",
            "operational_cost",
            "revenue",
            "cost_per_km",
            "utilization_pct",
            "roi",
            "health_score",
        ]
        rows = [
            [r["registration_number"], r["name_model"], r["vehicle_type"].value, r["region"] or "",
             r["status"], r["total_trips"], r["total_distance_km"], r["total_liters"],
             r["fuel_efficiency_kmpl"] if r["fuel_efficiency_kmpl"] is not None else "",
             r["operational_cost"], r["revenue"],
             r["cost_per_km"] if r["cost_per_km"] is not None else "",
             r["utilization_pct"], r["roi"] if r["roi"] is not None else "", r["health_score"]]
            for r in analytics.fleet_report(db)
        ]

    elif report == "trips":
        header = [
            "trip_id", "vehicle", "driver", "source_city", "dest_city", "cargo_weight_kg",
            "planned_distance_km", "actual_distance_km", "revenue", "status",
            "dispatched_at", "completed_at",
        ]
        trips = db.scalars(
            select(Trip)
            .options(joinedload(Trip.vehicle), joinedload(Trip.driver))
            .order_by(Trip.created_at.desc())
        ).all()
        rows = [
            [str(t.id), t.vehicle.registration_number, t.driver.name, t.source_city, t.dest_city,
             float(t.cargo_weight_kg), float(t.planned_distance_km),
             float(t.actual_distance_km) if t.actual_distance_km is not None else "",
             float(t.revenue), t.status.value,
             t.dispatched_at.isoformat() if t.dispatched_at else "",
             t.completed_at.isoformat() if t.completed_at else ""]
            for t in trips
        ]

    elif report == "expenses":
        header = ["expense_id", "vehicle", "trip_id", "expense_type", "amount", "notes", "created_at"]
        expenses = db.scalars(
            select(Expense).options(joinedload(Expense.vehicle)).order_by(Expense.created_at.desc())
        ).all()
        rows = [
            [str(e.id), e.vehicle.registration_number, str(e.trip_id) if e.trip_id else "",
             e.expense_type.value, float(e.amount), e.notes or "", e.created_at.isoformat()]
            for e in expenses
        ]

    else:
        raise AppError(
            "VALIDATION_ERROR",
            f"Unknown report '{report}'",
            fields={"report": "Must be one of: fleet, trips, expenses"},
        )

    return StreamingResponse(
        _csv_stream(header, rows),
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="transitops_{report}.csv"'},
    )
