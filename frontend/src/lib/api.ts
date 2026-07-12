/* ==========================================================================
   TransitOps — typed API client for the FastAPI backend (backend/src/transitops).
   Every call goes through `apiFetch`, which sends the httpOnly auth cookie
   (credentials: "include") and unwraps the backend's error envelope:
     {"error": {"code", "message", "fields"}}
   ========================================================================== */

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/api/v1";

export class ApiError extends Error {
  status: number;
  code: string;
  fields?: Record<string, string>;

  constructor(status: number, code: string, message: string, fields?: Record<string, string>) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.fields = fields;
  }
}

function qs(params?: object): string {
  if (!params) return "";
  const usp = new URLSearchParams();
  for (const [key, value] of Object.entries(params as Record<string, unknown>)) {
    if (value === undefined || value === null || value === "") continue;
    usp.set(key, String(value));
  }
  const s = usp.toString();
  return s ? `?${s}` : "";
}

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    credentials: "include",
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });

  if (res.status === 204) return undefined as T;

  const contentType = res.headers.get("content-type") ?? "";
  const isJson = contentType.includes("application/json");
  const body = isJson ? await res.json().catch(() => null) : await res.text();

  if (!res.ok) {
    const envelope = isJson && body && typeof body === "object" ? body.error : null;
    throw new ApiError(
      res.status,
      envelope?.code ?? "ERROR",
      envelope?.message ?? (typeof body === "string" && body ? body : "Request failed"),
      envelope?.fields
    );
  }

  return body as T;
}

/* ---- Shared -------------------------------------------------------------- */

export interface Page<T> {
  items: T[];
  total: number;
  page: number;
  page_size: number;
}

export interface ListParams {
  page?: number;
  page_size?: number;
  sort?: string;
  q?: string;
}

/* ---- Enums (mirrors backend/src/transitops/models/enums.py) -------------- */

export type VehicleType = "truck" | "van" | "mini" | "bus";
export type VehicleStatus = "available" | "on_trip" | "in_shop" | "retired";
export type LicenseCategory = "LMV" | "HMV" | "TRANS";
export type DriverStatus = "available" | "on_trip" | "off_duty" | "suspended";
export type TripStatus = "draft" | "dispatched" | "completed" | "cancelled";
export type MaintenanceType = "service" | "repair" | "inspection" | "oil_change" | "tyres";
export type MaintenanceStatus = "open" | "closed";
export type ExpenseType = "toll" | "parking" | "fine" | "misc";
export type AlertType = "license_expiry" | "doc_expiry" | "maintenance_due" | "trip_anomaly";
export type AlertSeverity = "info" | "warning" | "critical";
export type AlertStatus = "active" | "acknowledged";
export type DocumentStatus = "valid" | "expiring_soon" | "expired";
export type DocumentType =
  | "registration_certificate"
  | "insurance"
  | "permit"
  | "puc"
  | "fitness_certificate"
  | "driving_license"
  | "medical_certificate"
  | "badge";

/* ---- Auth ----------------------------------------------------------------- */

export interface UserOut {
  id: string;
  email: string;
  full_name: string;
  role: string;
}

export interface AuthResponse {
  user: UserOut;
}

/* ---- Vehicles --------------------------------------------------------------- */

export interface VehicleOut {
  id: string;
  registration_number: string;
  name_model: string;
  vehicle_type: VehicleType;
  max_load_capacity_kg: number;
  odometer_km: number;
  acquisition_cost: number;
  status: VehicleStatus;
  region: string | null;
  created_at: string;
  updated_at: string;
}

export interface VehicleCosts {
  fuel_total: number;
  maintenance_total: number;
  other_total: number;
  operational_total: number;
}

export interface VehicleMetrics {
  total_trips: number;
  completed_trips: number;
  total_distance_km: number;
  total_liters: number;
  total_revenue: number;
  fuel_efficiency_kmpl: number | null;
  utilization_pct: number;
  cost_per_km: number | null;
  roi: number | null;
  health_score: number;
}

export interface VehicleDetail extends VehicleOut {
  costs: VehicleCosts;
  metrics: VehicleMetrics;
}

export interface VehicleDocumentOut {
  id: string;
  document_type: DocumentType;
  document_number: string | null;
  expiry_date: string;
  file_url: string | null;
  status: DocumentStatus;
}

export interface VehicleCreate {
  registration_number: string;
  name_model: string;
  vehicle_type: VehicleType;
  max_load_capacity_kg: number;
  odometer_km?: number;
  acquisition_cost: number;
  region?: string;
}

/* ---- Drivers ------------------------------------------------------------ */

export interface DriverOut {
  id: string;
  name: string;
  phone: string | null;
  license_number: string;
  license_category: LicenseCategory;
  license_expiry_date: string;
  safety_score: number;
  status: DriverStatus;
  created_at: string;
  updated_at: string;
}

export interface DriverPerformance {
  total_trips: number;
  completed_trips: number;
  cancelled_trips: number;
  total_distance_km: number;
  license_valid: boolean;
  days_to_license_expiry: number;
  rating: number;
}

export interface DriverDetail extends DriverOut {
  performance: DriverPerformance;
}

export interface DriverDocumentOut {
  id: string;
  document_type: DocumentType;
  document_number: string | null;
  expiry_date: string;
  file_url: string | null;
  status: DocumentStatus;
}

export interface DriverCreate {
  name: string;
  phone?: string;
  license_number: string;
  license_category: LicenseCategory;
  license_expiry_date: string;
  safety_score?: number;
}

/* ---- Trips ---------------------------------------------------------------- */

export interface TripOut {
  id: string;
  vehicle_id: string;
  driver_id: string;
  created_by: string;
  source_city: string;
  source_lat: number;
  source_lng: number;
  dest_city: string;
  dest_lat: number;
  dest_lng: number;
  cargo_weight_kg: number;
  planned_distance_km: number;
  actual_distance_km: number | null;
  revenue: number;
  status: TripStatus;
  progress_percent: number;
  dispatched_at: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface TripDetail extends TripOut {
  vehicle: VehicleOut;
  driver: DriverOut;
}

export interface TripLive {
  id: string;
  status: TripStatus;
  source_city: string;
  dest_city: string;
  source_lat: number;
  source_lng: number;
  dest_lat: number;
  dest_lng: number;
  progress_percent: number;
  current_lat: number;
  current_lng: number;
  vehicle_registration: string;
  driver_name: string;
}

export interface Suggestion {
  vehicle: VehicleOut;
  driver: DriverOut;
  score: number;
  reasons: string[];
}

export interface TripCreate {
  vehicle_id: string;
  driver_id: string;
  source_city: string;
  dest_city: string;
  cargo_weight_kg: number;
  planned_distance_km?: number;
  revenue?: number;
}

export interface TripUpdate {
  vehicle_id?: string;
  driver_id?: string;
  source_city?: string;
  dest_city?: string;
  cargo_weight_kg?: number;
  planned_distance_km?: number;
  revenue?: number;
}

export interface TripCompletePayload {
  actual_distance_km: number;
  final_odometer_km: number;
  fuel?: { liters: number; cost: number };
}

/* ---- Maintenance ---------------------------------------------------------- */

export interface MaintenanceOut {
  id: string;
  vehicle_id: string;
  maintenance_type: MaintenanceType;
  description: string | null;
  cost: number;
  status: MaintenanceStatus;
  opened_at: string;
  closed_at: string | null;
}

export interface MaintenanceCreate {
  vehicle_id: string;
  maintenance_type: MaintenanceType;
  description?: string;
  cost?: number;
}

/* ---- Fuel & expenses ------------------------------------------------------- */

export interface FuelLogOut {
  id: string;
  vehicle_id: string;
  trip_id: string | null;
  liters: number;
  cost: number;
  odometer_at_fill: number | null;
  logged_at: string;
  created_by: string;
}

export interface ExpenseOut {
  id: string;
  vehicle_id: string;
  trip_id: string | null;
  expense_type: ExpenseType;
  amount: number;
  notes: string | null;
  created_at: string;
  created_by: string;
}

/* ---- Analytics -------------------------------------------------------------- */

export interface Kpis {
  total_vehicles: number;
  available_vehicles: number;
  on_trip_vehicles: number;
  in_shop_vehicles: number;
  retired_vehicles: number;
  active_trips: number;
  pending_trips: number;
  completed_trips: number;
  total_drivers: number;
  drivers_on_duty: number;
  fleet_utilization_pct: number;
  total_operational_cost: number;
  total_revenue: number;
  open_alerts: number;
}

export interface FleetRow {
  vehicle_id: string;
  registration_number: string;
  name_model: string;
  vehicle_type: VehicleType;
  region: string | null;
  status: string;
  total_trips: number;
  total_distance_km: number;
  total_liters: number;
  fuel_efficiency_kmpl: number | null;
  operational_cost: number;
  revenue: number;
  cost_per_km: number | null;
  utilization_pct: number;
  roi: number | null;
  health_score: number;
}

export interface TrendPoint {
  period: string;
  fuel_cost: number;
  trips_completed: number;
  distance_km: number;
  co2_kg: number;
}

export interface StatusSlice {
  status: string;
  count: number;
}

export interface Trends {
  weekly: TrendPoint[];
  trips_by_status: StatusSlice[];
  co2_total_kg: number;
  co2_saved_kg: number;
}

/* ---- Support: alerts / notifications / audit log --------------------------- */

export interface AlertOut {
  id: string;
  type: AlertType;
  severity: AlertSeverity;
  title: string;
  entity_type: string;
  entity_id: string;
  status: AlertStatus;
  created_at: string;
}

export interface NotificationOut {
  id: string;
  user_id: string;
  title: string;
  message: string;
  is_read: boolean;
  created_at: string;
}

/* ---- API surface ------------------------------------------------------------ */

export const api = {
  auth: {
    login: (email: string, password: string) =>
      apiFetch<AuthResponse>("/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      }),
    logout: () => apiFetch<void>("/auth/logout", { method: "POST" }),
    me: () => apiFetch<AuthResponse>("/auth/me"),
  },

  vehicles: {
    list: (params?: ListParams & { status?: string; vehicle_type?: string; region?: string }) =>
      apiFetch<Page<VehicleOut>>(`/vehicles${qs(params)}`),
    get: (id: string) => apiFetch<VehicleDetail>(`/vehicles/${id}`),
    documents: (id: string) => apiFetch<VehicleDocumentOut[]>(`/vehicles/${id}/documents`),
    dispatchable: (cargoWeightKg: number) =>
      apiFetch<VehicleOut[]>(`/vehicles/dispatchable${qs({ cargo_weight_kg: cargoWeightKg })}`),
    create: (payload: VehicleCreate) =>
      apiFetch<VehicleOut>("/vehicles", { method: "POST", body: JSON.stringify(payload) }),
  },

  drivers: {
    list: (
      params?: ListParams & { status?: string; license_category?: string; expiring_within_days?: number }
    ) => apiFetch<Page<DriverOut>>(`/drivers${qs(params)}`),
    get: (id: string) => apiFetch<DriverDetail>(`/drivers/${id}`),
    documents: (id: string) => apiFetch<DriverDocumentOut[]>(`/drivers/${id}/documents`),
    assignable: () => apiFetch<DriverOut[]>("/drivers/assignable"),
    create: (payload: DriverCreate) =>
      apiFetch<DriverOut>("/drivers", { method: "POST", body: JSON.stringify(payload) }),
  },

  trips: {
    list: (
      params?: ListParams & { status?: string; vehicle_id?: string; driver_id?: string }
    ) => apiFetch<Page<TripOut>>(`/trips${qs(params)}`),
    get: (id: string) => apiFetch<TripDetail>(`/trips/${id}`),
    live: () => apiFetch<TripLive[]>("/trips/live"),
    suggestionsFor: (cargoWeightKg: number, limit = 3) =>
      apiFetch<Suggestion[]>(`/trips/suggestions${qs({ cargo_weight_kg: cargoWeightKg, limit })}`),
    suggestionsForTrip: (tripId: string, limit = 3) =>
      apiFetch<Suggestion[]>(`/trips/${tripId}/suggestions${qs({ limit })}`),
    create: (payload: TripCreate) =>
      apiFetch<TripOut>("/trips", { method: "POST", body: JSON.stringify(payload) }),
    update: (id: string, payload: TripUpdate) =>
      apiFetch<TripOut>(`/trips/${id}`, { method: "PATCH", body: JSON.stringify(payload) }),
    dispatch: (id: string) => apiFetch<TripOut>(`/trips/${id}/dispatch`, { method: "POST" }),
    complete: (id: string, payload: TripCompletePayload) =>
      apiFetch<TripOut>(`/trips/${id}/complete`, { method: "POST", body: JSON.stringify(payload) }),
    cancel: (id: string) => apiFetch<TripOut>(`/trips/${id}/cancel`, { method: "POST" }),
  },

  maintenance: {
    list: (params?: ListParams & { status?: string; vehicle_id?: string }) =>
      apiFetch<Page<MaintenanceOut>>(`/maintenance${qs(params)}`),
    open: (payload: MaintenanceCreate) =>
      apiFetch<MaintenanceOut>("/maintenance", { method: "POST", body: JSON.stringify(payload) }),
    close: (id: string, cost: number) =>
      apiFetch<MaintenanceOut>(`/maintenance/${id}/close`, {
        method: "POST",
        body: JSON.stringify({ cost }),
      }),
  },

  fuelLogs: {
    list: (params?: ListParams & { vehicle_id?: string; trip_id?: string }) =>
      apiFetch<Page<FuelLogOut>>(`/fuel-logs${qs(params)}`),
  },

  expenses: {
    list: (params?: ListParams & { vehicle_id?: string; trip_id?: string; expense_type?: string }) =>
      apiFetch<Page<ExpenseOut>>(`/expenses${qs(params)}`),
  },

  analytics: {
    kpis: (params?: { vehicle_type?: string; status?: string; region?: string }) =>
      apiFetch<Kpis>(`/analytics/kpis${qs(params)}`),
    fleet: (params?: { vehicle_type?: string; status?: string; region?: string }) =>
      apiFetch<FleetRow[]>(`/analytics/fleet${qs(params)}`),
    trends: (weeks = 8) => apiFetch<Trends>(`/analytics/trends${qs({ weeks })}`),
    exportCsvUrl: (report: "fleet" | "trips" | "expenses") =>
      `${API_BASE}/export/csv${qs({ report })}`,
  },

  alerts: {
    list: (params?: ListParams & { status?: string; type?: string; severity?: string }) =>
      apiFetch<Page<AlertOut>>(`/alerts${qs(params)}`),
    acknowledge: (id: string) => apiFetch<AlertOut>(`/alerts/${id}/acknowledge`, { method: "POST" }),
  },

  notifications: {
    list: (params?: ListParams & { is_read?: boolean }) =>
      apiFetch<Page<NotificationOut>>(`/notifications${qs(params)}`),
    markAllRead: () => apiFetch<{ marked_read: number }>("/notifications/read-all", { method: "POST" }),
  },
};
