/* ==========================================================================
   TransitOps — mock data layer (ported from admin/assets/mock-data.js)
   Static-file prototype only — no backend wired up yet.
   ========================================================================== */

// Fixed reference "now" for this static prototype dataset, so expiry-soon
// checks stay deterministic across server render and client hydration.
export const NOW = Date.parse("2026-07-12T00:00:00Z");

export type VehicleStatus = "active" | "idle" | "maintenance" | "retired";
export type DriverStatus = "available" | "on_trip" | "suspended";
export type TripStatus = "pending" | "dispatched" | "in_transit" | "completed" | "cancelled";
export type RiskLevel = "low" | "medium" | "high";
export type DocumentStatus = "valid" | "expiring" | "expired";
export type MaintenanceStatus = "open" | "in_progress" | "closed";
export type AlertSeverity = "critical" | "warning" | "info" | "success";

export interface Vehicle {
  id: string;
  registration_number: string;
  model: string;
  vehicle_type: string;
  max_load_capacity: number;
  odometer: number;
  acquisition_cost: number;
  status: VehicleStatus;
  region: string;
}

export interface VehicleHealth {
  health_score: number;
  maintenance_risk: RiskLevel;
  predicted_service_date: string;
  calculated_at: string;
}

export interface VehicleAnalytics {
  fuel_efficiency: number;
  utilization_percent: number;
  cost_per_km: number;
  profitability: number;
}

export interface VehicleDocument {
  document_type: string;
  document_number: string;
  expiry_date: string;
  status: DocumentStatus;
}

export interface MaintenanceLog {
  maintenance_type: string;
  cost: number;
  status: MaintenanceStatus;
  opened_at: string;
  closed_at: string | null;
}

export interface FuelLog {
  liters: number;
  cost: number;
  logged_at: string;
}

export interface Expense {
  expense_type: string;
  amount: number;
  notes: string;
  created_at: string;
}

export interface Driver {
  id: string;
  name: string;
  license_number: string;
  license_category: string;
  license_expiry_date: string;
  safety_score: number;
  status: DriverStatus;
  phone: string;
}

export interface DriverPerformance {
  total_trips: number;
  avg_fuel_efficiency: number;
  incident_count: number;
  rating: number;
}

export interface DriverDocument {
  document_type: string;
  expiry_date: string;
  file_url: string;
}

export interface Trip {
  id: string;
  vehicle_id: string;
  driver_id: string | null;
  source_location: string;
  destination_location: string;
  cargo_weight: number;
  planned_distance: number;
  actual_distance: number | null;
  revenue: number;
  status: TripStatus;
  dispatched_at: string | null;
  completed_at: string | null;
}

export interface AIDispatchSuggestion {
  vehicle_id: string;
  driver_id: string;
  score: number;
  reason: string;
}

export interface Alert {
  id: string;
  title: string;
  type: string;
  severity: AlertSeverity;
  status: "open" | "acknowledged";
  created_at: string;
}

export const currentUser = {
  full_name: "Gaurav Rathva",
  email: "gaurav.rathva@transitops.io",
  role: "Super Admin",
};

export const vehicles: Vehicle[] = [
  { id: "v1", registration_number: "GJ-01-AB-4521", model: "Ashok Leyland 3718", vehicle_type: "Heavy Truck", max_load_capacity: 18.5, odometer: 184320, acquisition_cost: 4200000, status: "active", region: "Ahmedabad" },
  { id: "v2", registration_number: "GJ-05-CT-1187", model: "Tata Prima 4928", vehicle_type: "Heavy Truck", max_load_capacity: 25, odometer: 96540, acquisition_cost: 5100000, status: "active", region: "Surat" },
  { id: "v3", registration_number: "MH-12-KL-7734", model: "Eicher Pro 3015", vehicle_type: "Medium Truck", max_load_capacity: 9, odometer: 142870, acquisition_cost: 2850000, status: "maintenance", region: "Mumbai" },
  { id: "v4", registration_number: "GJ-01-XZ-3390", model: "Mahindra Blazo X28", vehicle_type: "Heavy Truck", max_load_capacity: 22, odometer: 51200, acquisition_cost: 4750000, status: "active", region: "Ahmedabad" },
  { id: "v5", registration_number: "RJ-14-BT-5502", model: "Tata Ace Gold", vehicle_type: "Mini Truck", max_load_capacity: 1.5, odometer: 68410, acquisition_cost: 720000, status: "active", region: "Udaipur" },
  { id: "v6", registration_number: "GJ-27-JD-9012", model: "Ashok Leyland Dost+", vehicle_type: "Mini Truck", max_load_capacity: 1.75, odometer: 112900, acquisition_cost: 810000, status: "idle", region: "Vadodara" },
  { id: "v7", registration_number: "MH-04-QW-6621", model: "Volvo FM 420", vehicle_type: "Heavy Truck", max_load_capacity: 28, odometer: 203110, acquisition_cost: 6800000, status: "retired", region: "Pune" },
  { id: "v8", registration_number: "GJ-05-LN-2245", model: "Tata Prima 2830", vehicle_type: "Medium Truck", max_load_capacity: 12, odometer: 34980, acquisition_cost: 3150000, status: "active", region: "Surat" },
];

export const vehicleHealth: Record<string, VehicleHealth> = {
  v1: { health_score: 88, maintenance_risk: "low", predicted_service_date: "2026-09-14", calculated_at: "2026-07-11T06:00:00Z" },
  v2: { health_score: 94, maintenance_risk: "low", predicted_service_date: "2026-10-02", calculated_at: "2026-07-11T06:00:00Z" },
  v3: { health_score: 41, maintenance_risk: "high", predicted_service_date: "2026-07-18", calculated_at: "2026-07-11T06:00:00Z" },
  v4: { health_score: 97, maintenance_risk: "low", predicted_service_date: "2026-11-20", calculated_at: "2026-07-11T06:00:00Z" },
  v5: { health_score: 76, maintenance_risk: "medium", predicted_service_date: "2026-08-05", calculated_at: "2026-07-11T06:00:00Z" },
  v6: { health_score: 63, maintenance_risk: "medium", predicted_service_date: "2026-07-30", calculated_at: "2026-07-11T06:00:00Z" },
  v7: { health_score: 22, maintenance_risk: "high", predicted_service_date: "2026-07-15", calculated_at: "2026-07-11T06:00:00Z" },
  v8: { health_score: 91, maintenance_risk: "low", predicted_service_date: "2026-12-01", calculated_at: "2026-07-11T06:00:00Z" },
};

export const vehicleAnalytics: Record<string, VehicleAnalytics> = {
  v1: { fuel_efficiency: 4.2, utilization_percent: 82, cost_per_km: 18.4, profitability: 312000 },
  v2: { fuel_efficiency: 3.8, utilization_percent: 91, cost_per_km: 21.1, profitability: 468500 },
  v3: { fuel_efficiency: 5.6, utilization_percent: 38, cost_per_km: 15.2, profitability: 41200 },
  v4: { fuel_efficiency: 4.0, utilization_percent: 76, cost_per_km: 19.8, profitability: 289000 },
  v5: { fuel_efficiency: 12.4, utilization_percent: 64, cost_per_km: 8.1, profitability: 96400 },
  v6: { fuel_efficiency: 11.8, utilization_percent: 29, cost_per_km: 9.4, profitability: 22800 },
  v7: { fuel_efficiency: 3.1, utilization_percent: 4, cost_per_km: 26.7, profitability: -18500 },
  v8: { fuel_efficiency: 5.1, utilization_percent: 68, cost_per_km: 17.6, profitability: 187300 },
};

export const vehicleDocuments: Record<string, VehicleDocument[]> = {
  v1: [
    { document_type: "Registration Certificate", document_number: "RC-4521-GJ", expiry_date: "2031-03-12", status: "valid" },
    { document_type: "Insurance", document_number: "INS-88213", expiry_date: "2026-08-30", status: "expiring" },
    { document_type: "Fitness Certificate", document_number: "FC-2291", expiry_date: "2027-01-05", status: "valid" },
    { document_type: "Permit", document_number: "PRM-77102", expiry_date: "2026-07-20", status: "expiring" },
  ],
  v3: [
    { document_type: "Registration Certificate", document_number: "RC-7734-MH", expiry_date: "2029-11-02", status: "valid" },
    { document_type: "Insurance", document_number: "INS-51290", expiry_date: "2026-12-01", status: "valid" },
    { document_type: "Fitness Certificate", document_number: "FC-1187", expiry_date: "2026-07-22", status: "expiring" },
  ],
};

export const maintenanceLogs: Record<string, MaintenanceLog[]> = {
  v1: [
    { maintenance_type: "Brake pad replacement", cost: 8200, status: "closed", opened_at: "2026-05-02T09:00:00Z", closed_at: "2026-05-03T17:00:00Z" },
    { maintenance_type: "Engine oil change", cost: 3400, status: "closed", opened_at: "2026-06-14T10:00:00Z", closed_at: "2026-06-14T13:00:00Z" },
  ],
  v3: [
    { maintenance_type: "Gearbox inspection", cost: 21500, status: "in_progress", opened_at: "2026-07-09T08:30:00Z", closed_at: null },
    { maintenance_type: "Suspension repair", cost: 14200, status: "open", opened_at: "2026-07-11T11:00:00Z", closed_at: null },
  ],
  v7: [
    { maintenance_type: "Full inspection (decommission)", cost: 0, status: "open", opened_at: "2026-06-01T09:00:00Z", closed_at: null },
  ],
};

export const fuelLogs: Record<string, FuelLog[]> = {
  v1: [
    { liters: 210, cost: 19740, logged_at: "2026-07-08T07:20:00Z" },
    { liters: 185, cost: 17390, logged_at: "2026-07-02T06:50:00Z" },
  ],
  v2: [
    { liters: 260, cost: 24440, logged_at: "2026-07-09T08:10:00Z" },
  ],
};

export const expenses: Record<string, Expense[]> = {
  v1: [
    { expense_type: "Toll", amount: 4200, notes: "Ahmedabad–Mumbai corridor", created_at: "2026-07-08T18:00:00Z" },
    { expense_type: "Driver Allowance", amount: 2500, notes: "3-day trip halt", created_at: "2026-07-07T09:00:00Z" },
  ],
  v3: [
    { expense_type: "Towing", amount: 6800, notes: "Breakdown near Panvel", created_at: "2026-07-10T14:00:00Z" },
  ],
};

export const drivers: Driver[] = [
  { id: "d1", name: "Raj Mehta", license_number: "GJ0120220041233", license_category: "HMV", license_expiry_date: "2028-04-11", safety_score: 92, status: "on_trip", phone: "+91 98250 11223" },
  { id: "d2", name: "Suresh Yadav", license_number: "MH0220190087651", license_category: "HMV", license_expiry_date: "2026-08-02", safety_score: 78, status: "available", phone: "+91 98220 44556" },
  { id: "d3", name: "Anil Kumar Singh", license_number: "RJ1420180032198", license_category: "LMV+HMV", license_expiry_date: "2027-11-30", safety_score: 65, status: "available", phone: "+91 90360 99871" },
  { id: "d4", name: "Vikram Solanki", license_number: "GJ2720210056432", license_category: "HMV", license_expiry_date: "2029-02-18", safety_score: 96, status: "on_trip", phone: "+91 99250 33210" },
  { id: "d5", name: "Devendra Patil", license_number: "MH0420170099823", license_category: "HMV", license_expiry_date: "2026-07-25", safety_score: 54, status: "suspended", phone: "+91 98811 22334" },
  { id: "d6", name: "Kiran Joshi", license_number: "GJ0520220071121", license_category: "LMV", license_expiry_date: "2028-09-09", safety_score: 88, status: "available", phone: "+91 97250 66112" },
];

export const driverPerformance: Record<string, DriverPerformance> = {
  d1: { total_trips: 214, avg_fuel_efficiency: 4.1, incident_count: 1, rating: 4.7 },
  d2: { total_trips: 168, avg_fuel_efficiency: 3.9, incident_count: 3, rating: 4.1 },
  d3: { total_trips: 96, avg_fuel_efficiency: 4.4, incident_count: 5, rating: 3.4 },
  d4: { total_trips: 301, avg_fuel_efficiency: 4.3, incident_count: 0, rating: 4.9 },
  d5: { total_trips: 142, avg_fuel_efficiency: 3.6, incident_count: 7, rating: 2.6 },
  d6: { total_trips: 58, avg_fuel_efficiency: 4.0, incident_count: 1, rating: 4.5 },
};

export const driverDocuments: Record<string, DriverDocument[]> = {
  d1: [
    { document_type: "Driving License", expiry_date: "2028-04-11", file_url: "#" },
    { document_type: "Medical Certificate", expiry_date: "2026-09-01", file_url: "#" },
  ],
  d5: [
    { document_type: "Driving License", expiry_date: "2026-07-25", file_url: "#" },
  ],
};

export const trips: Trip[] = [
  { id: "t1", vehicle_id: "v1", driver_id: "d1", source_location: "Ahmedabad", destination_location: "Mumbai", cargo_weight: 16.2, planned_distance: 524, actual_distance: 531, revenue: 68000, status: "in_transit", dispatched_at: "2026-07-11T05:30:00Z", completed_at: null },
  { id: "t2", vehicle_id: "v4", driver_id: "d4", source_location: "Ahmedabad", destination_location: "Jaipur", cargo_weight: 19.8, planned_distance: 660, actual_distance: null, revenue: 81500, status: "dispatched", dispatched_at: "2026-07-12T03:00:00Z", completed_at: null },
  { id: "t3", vehicle_id: "v2", driver_id: null, source_location: "Surat", destination_location: "Pune", cargo_weight: 22.5, planned_distance: 452, actual_distance: null, revenue: 74200, status: "pending", dispatched_at: null, completed_at: null },
  { id: "t4", vehicle_id: "v8", driver_id: null, source_location: "Surat", destination_location: "Nashik", cargo_weight: 10.4, planned_distance: 318, actual_distance: null, revenue: 39800, status: "pending", dispatched_at: null, completed_at: null },
  { id: "t5", vehicle_id: "v5", driver_id: "d6", source_location: "Udaipur", destination_location: "Ahmedabad", cargo_weight: 1.2, planned_distance: 262, actual_distance: 265, revenue: 14500, status: "completed", dispatched_at: "2026-07-09T04:00:00Z", completed_at: "2026-07-09T14:20:00Z" },
  { id: "t6", vehicle_id: "v1", driver_id: "d1", source_location: "Mumbai", destination_location: "Ahmedabad", cargo_weight: 15.0, planned_distance: 524, actual_distance: 519, revenue: 65200, status: "completed", dispatched_at: "2026-07-05T05:00:00Z", completed_at: "2026-07-05T18:40:00Z" },
  { id: "t7", vehicle_id: "v3", driver_id: "d3", source_location: "Mumbai", destination_location: "Pune", cargo_weight: 7.8, planned_distance: 148, actual_distance: null, revenue: 21000, status: "cancelled", dispatched_at: null, completed_at: null },
];

export const aiDispatchSuggestions: Record<string, AIDispatchSuggestion[]> = {
  t3: [
    { vehicle_id: "v2", driver_id: "d2", score: 96, reason: "Highest analytics profitability on the Surat corridor with a driver rated 4.1★ and zero recent incidents." },
    { vehicle_id: "v8", driver_id: "d6", score: 81, reason: "Lower cost-per-km but cargo weight (22.5t) exceeds Prima 2830's comfortable utilization band." },
    { vehicle_id: "v6", driver_id: "d3", score: 54, reason: "Vehicle idle and available, but mini-truck capacity is undersized for this load." },
  ],
  t4: [
    { vehicle_id: "v8", driver_id: "d6", score: 91, reason: "Vehicle already based in Surat, driver available, cargo weight well within capacity." },
    { vehicle_id: "v6", driver_id: "d2", score: 88, reason: "Strong fuel efficiency match for a short 318km haul, driver rated 4.1★." },
    { vehicle_id: "v5", driver_id: "d3", score: 62, reason: "Available but based out of region — adds ~140km of dead mileage." },
  ],
};

export const alerts: Alert[] = [
  { id: "al1", title: "Vehicle GJ-01-AB-4521 insurance expiring in 18 days", type: "document", severity: "warning", status: "open", created_at: "2026-07-12T04:00:00Z" },
  { id: "al2", title: "Vehicle MH-12-KL-7734 health score dropped below 45", type: "health", severity: "critical", status: "open", created_at: "2026-07-11T22:10:00Z" },
  { id: "al3", title: "Driver Devendra Patil license expires in 13 days", type: "document", severity: "warning", status: "open", created_at: "2026-07-11T19:45:00Z" },
  { id: "al4", title: "Trip T-1002 delayed beyond planned ETA", type: "trip", severity: "info", status: "acknowledged", created_at: "2026-07-11T15:05:00Z" },
  { id: "al5", title: "Vehicle MH-04-QW-6621 flagged for decommission review", type: "fleet", severity: "critical", status: "open", created_at: "2026-07-10T09:30:00Z" },
  { id: "al6", title: "Fuel cost spike detected on Surat–Pune corridor", type: "cost", severity: "info", status: "open", created_at: "2026-07-09T11:00:00Z" },
];

export const revenueTrend: { date: string; revenue: number }[] = [
  { date: "2026-07-06", revenue: 118400 },
  { date: "2026-07-07", revenue: 94200 },
  { date: "2026-07-08", revenue: 142800 },
  { date: "2026-07-09", revenue: 131500 },
  { date: "2026-07-10", revenue: 87600 },
  { date: "2026-07-11", revenue: 156300 },
  { date: "2026-07-12", revenue: 103900 },
];

export const cityCoords: Record<string, [number, number]> = {
  Ahmedabad: [23.0225, 72.5714],
  Surat: [21.1702, 72.8311],
  Mumbai: [19.076, 72.8777],
  Pune: [18.5204, 73.8567],
  Udaipur: [24.5854, 73.7125],
  Vadodara: [22.3072, 73.1812],
  Jaipur: [26.9124, 75.7873],
  Nashik: [19.9975, 73.7898],
};

/* ---- Lookup helpers ------------------------------------------------------ */

export const getVehicle = (id: string): Vehicle | undefined => vehicles.find((v) => v.id === id);
export const getDriver = (id: string): Driver | undefined => drivers.find((d) => d.id === id);

export const fmtMoney = (n: number | null | undefined): string =>
  n == null ? "—" : "₹" + Number(n).toLocaleString("en-IN");

export const fmtDate = (iso: string | null | undefined): string => {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
};

export const fmtDateTime = (iso: string | null | undefined): string => {
  if (!iso) return "—";
  const d = new Date(iso);
  return (
    d.toLocaleDateString("en-IN", { day: "2-digit", month: "short" }) +
    ", " +
    d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })
  );
};

export const timeAgo = (iso: string): string => {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.round(diffMs / 60000);
  if (mins < 60) return mins + "m ago";
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return hrs + "h ago";
  return Math.round(hrs / 24) + "d ago";
};

// Deterministic small offset so multiple vehicles in one city don't stack exactly.
export const jitter = (id: string, scale = 0.06): [number, number] => {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  const a = (((hash % 1000) / 1000 - 0.5) * scale);
  const b = ((((hash >> 5) % 1000) / 1000 - 0.5) * scale);
  return [a, b];
};

export const getVehicleLatLng = (vehicle: Vehicle): [number, number] | null => {
  const base = cityCoords[vehicle.region];
  if (!base) return null;
  const [dx, dy] = jitter(vehicle.id);
  return [base[0] + dx, base[1] + dy];
};

export const initials = (name: string): string =>
  name
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

export const healthMeterClass = (score: number): "" | "is-success" | "is-warning" => {
  if (score >= 70) return "is-success";
  if (score >= 45) return "";
  return "is-warning";
};
