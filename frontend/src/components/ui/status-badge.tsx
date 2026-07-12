import type {
  VehicleStatus,
  DriverStatus,
  TripStatus,
  DocumentStatus,
  MaintenanceStatus,
  AlertSeverity,
} from "@/lib/api";
import type { RiskLevel } from "@/lib/format";

type BadgeTone = "success" | "warning" | "info" | "neutral" | "primary";

function Badge({ tone, label }: { tone: BadgeTone; label: string }) {
  return <span className={`badge badge-${tone}`}>{label}</span>;
}

const vehicleMap: Record<VehicleStatus, [BadgeTone, string]> = {
  available: ["success", "Available"],
  on_trip: ["info", "On Trip"],
  in_shop: ["warning", "In Shop"],
  retired: ["neutral", "Retired"],
};

export function VehicleStatusBadge({ status }: { status: VehicleStatus }) {
  const [tone, label] = vehicleMap[status] ?? ["neutral", status];
  return <Badge tone={tone} label={label} />;
}

const driverMap: Record<DriverStatus, [BadgeTone, string]> = {
  available: ["success", "Available"],
  on_trip: ["info", "On Trip"],
  off_duty: ["neutral", "Off Duty"],
  suspended: ["warning", "Suspended"],
};

export function DriverStatusBadge({ status }: { status: DriverStatus }) {
  const [tone, label] = driverMap[status] ?? ["neutral", status];
  return <Badge tone={tone} label={label} />;
}

const tripMap: Record<TripStatus, [BadgeTone, string]> = {
  draft: ["neutral", "Draft"],
  dispatched: ["primary", "Dispatched"],
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
  expiring_soon: ["warning", "Expiring Soon"],
  expired: ["warning", "Expired"],
};

export function DocumentStatusBadge({ status }: { status: DocumentStatus }) {
  const [tone, label] = documentMap[status] ?? ["neutral", status];
  return <Badge tone={tone} label={label} />;
}

const maintenanceMap: Record<MaintenanceStatus, [BadgeTone, string]> = {
  open: ["warning", "Open"],
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
};

export function severityDotClass(level: AlertSeverity): string {
  return severityClassMap[level] ?? "info";
}
