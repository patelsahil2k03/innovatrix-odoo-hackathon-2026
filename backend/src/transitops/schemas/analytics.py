import uuid

from pydantic import BaseModel

from transitops.models.enums import VehicleType


class Kpis(BaseModel):
    """`GET /analytics/kpis` — the dashboard block (contract §7)."""

    total_vehicles: int
    available_vehicles: int
    on_trip_vehicles: int
    in_shop_vehicles: int
    retired_vehicles: int
    active_trips: int
    pending_trips: int
    completed_trips: int
    total_drivers: int
    drivers_on_duty: int
    fleet_utilization_pct: float
    total_operational_cost: float
    total_revenue: float
    open_alerts: int


class FleetRow(BaseModel):
    """`GET /analytics/fleet` — per-vehicle economics (PS ROI formula, docs/03 §3)."""

    vehicle_id: uuid.UUID
    registration_number: str
    name_model: str
    vehicle_type: VehicleType
    region: str | None
    status: str
    total_trips: int
    total_distance_km: float
    total_liters: float
    fuel_efficiency_kmpl: float | None
    operational_cost: float
    revenue: float
    cost_per_km: float | None
    utilization_pct: float
    roi: float | None
    health_score: int


class TrendPoint(BaseModel):
    period: str  # ISO week start (YYYY-MM-DD)
    fuel_cost: float
    trips_completed: int
    distance_km: float
    co2_kg: float


class StatusSlice(BaseModel):
    status: str
    count: int


class Trends(BaseModel):
    """`GET /analytics/trends` — feeds the Recharts screens + the W4 CO₂ estimate."""

    weekly: list[TrendPoint]
    trips_by_status: list[StatusSlice]
    co2_total_kg: float
    co2_saved_kg: float
