/* Pure formatting helpers shared across pages. No Date.now()/Math.random() here — callers that
   need "now" (e.g. relative timestamps) must supply it explicitly, computed in an effect, so
   render stays pure (Next.js 16 lint). */

export const fmtMoney = (n: number | null | undefined): string =>
  n == null ? "—" : "₹" + Number(n).toLocaleString("en-IN", { maximumFractionDigits: 0 });

export const fmtNumber = (n: number | null | undefined, digits = 0): string =>
  n == null ? "—" : Number(n).toLocaleString("en-IN", { maximumFractionDigits: digits });

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

export const timeAgo = (iso: string | null | undefined, nowMs: number): string => {
  if (!iso) return "—";
  const diffMs = nowMs - new Date(iso).getTime();
  const mins = Math.round(diffMs / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return mins + "m ago";
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return hrs + "h ago";
  return Math.round(hrs / 24) + "d ago";
};

export const initials = (name: string): string =>
  name
    .split(" ")
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();

export const healthMeterClass = (score: number): "" | "is-success" | "is-warning" => {
  if (score >= 70) return "is-success";
  if (score >= 45) return "";
  return "is-warning";
};

export type RiskLevel = "low" | "medium" | "high";

/** Vehicle health has no separate risk category from the API — bucket the 0-100 score
 * with the same thresholds the health meter itself uses, so the two always agree. */
export const riskFromHealth = (score: number): RiskLevel => {
  if (score >= 70) return "low";
  if (score >= 45) return "medium";
  return "high";
};

export const DOCUMENT_TYPE_LABELS: Record<string, string> = {
  registration_certificate: "Registration Certificate",
  insurance: "Insurance",
  permit: "Permit",
  puc: "PUC Certificate",
  fitness_certificate: "Fitness Certificate",
  driving_license: "Driving License",
  medical_certificate: "Medical Certificate",
  badge: "Badge",
};

export const MAINTENANCE_TYPE_LABELS: Record<string, string> = {
  service: "Service",
  repair: "Repair",
  inspection: "Inspection",
  oil_change: "Oil Change",
  tyres: "Tyres",
};

export const EXPENSE_TYPE_LABELS: Record<string, string> = {
  toll: "Toll",
  parking: "Parking",
  fine: "Fine",
  misc: "Miscellaneous",
};

export const VEHICLE_TYPE_LABELS: Record<string, string> = {
  truck: "Truck",
  van: "Van",
  mini: "Mini",
  bus: "Bus",
};

/** Mirrors services/analytics.py driver_performance()'s rating formula (safety_score 0-100 →
 * 0-5 stars), so list views can show a rating without an N+1 call per driver. */
export const ratingFromSafetyScore = (safetyScore: number): number =>
  Math.round((safetyScore / 20) * 10) / 10;
