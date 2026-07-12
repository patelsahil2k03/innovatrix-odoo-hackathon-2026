import type {
  VehicleStatus,
  DriverStatus,
  TripStatus,
  RiskLevel,
  DocumentStatus,
  MaintenanceStatus,
  AlertSeverity,
} from "@/lib/mock-data";

type BadgeTone = "success" | "warning" | "info" | "neutral" | "primary";

function Badge({ tone, label }: { tone: BadgeTone; label: string }) {
  return <span className={`badge badge-${tone}`}>{label}</span>;
}

const vehicleMap: Record<VehicleStatus, [BadgeTone, string]> = {
  active: ["success", "Active"],
  idle: ["neutral", "Idle"],
  maintenance: ["warning", "Maintenance"],
  retired: ["neutral", "Retired"],
};

export function VehicleStatusBadge({ status }: { status: VehicleStatus }) {
  const [tone, label] = vehicleMap[status] ?? ["neutral", status];
  return <Badge tone={tone} label={label} />;
}

const driverMap: Record<DriverStatus, [BadgeTone, string]> = {
  available: ["success", "Available"],
  on_trip: ["info", "On Trip"],
  suspended: ["warning", "Suspended"],
};

export function DriverStatusBadge({ status }: { status: DriverStatus }) {
  const [tone, label] = driverMap[status] ?? ["neutral", status];
  return <Badge tone={tone} label={label} />;
}

const tripMap: Record<TripStatus, [BadgeTone, string]> = {
  pending: ["neutral", "Pending"],
  dispatched: ["info", "Dispatched"],
  in_transit: ["primary", "In Transit"],
  completed: ["success", "Completed"],
  cancelled: ["warning", "Cancelled"],
};

export function TripStatusBadge({ status }: { status: TripStatus }) {
  const [tone, label] = tripMap[status] ?? ["neutral", status];
  return <Badge tone={tone} label={label} />;
}

const riskMap: Record<RiskLevel, [BadgeTone, string]> = {
  low: ["success", "Low Risk"],
  medium: ["warning", "Medium Risk"],
  high: ["warning", "High Risk"],
};

export function RiskBadge({ level }: { level: RiskLevel }) {
  const [tone, label] = riskMap[level] ?? ["neutral", level];
  return <Badge tone={tone} label={label} />;
}

const documentMap: Record<DocumentStatus, [BadgeTone, string]> = {
  valid: ["success", "Valid"],
  expiring: ["warning", "Expiring"],
  expired: ["warning", "Expired"],
};

export function DocumentStatusBadge({ status }: { status: DocumentStatus }) {
  const [tone, label] = documentMap[status] ?? ["neutral", status];
  return <Badge tone={tone} label={label} />;
}

const maintenanceMap: Record<MaintenanceStatus, [BadgeTone, string]> = {
  open: ["warning", "Open"],
  in_progress: ["info", "In Progress"],
  closed: ["success", "Closed"],
};

export function MaintenanceStatusBadge({ status }: { status: MaintenanceStatus }) {
  const [tone, label] = maintenanceMap[status] ?? ["neutral", status];
  return <Badge tone={tone} label={label} />;
}

const severityClassMap: Record<AlertSeverity, string> = {
  critical: "critical",
  warning: "critical",
  info: "info",
  success: "success",
};

export function severityDotClass(level: AlertSeverity): string {
  return severityClassMap[level] ?? "info";
}
