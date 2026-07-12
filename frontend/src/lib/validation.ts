/* ==========================================================================
   Client-side validation.

   These rules mirror the server's (backend/src/transitops/schemas + services/dispatch.py).
   The server stays the authority — it re-checks everything inside a locked transaction — but
   catching the same mistakes here means the user is told *at the field* instead of getting a
   round-trip and one red line at the bottom of the modal.

   Every validator returns FieldErrors keyed by the SAME field name the API uses, so a server
   422 (`{"error": {"fields": {"cargo_weight_kg": "Must be ≤ 500"}}}`) drops straight into the
   same UI slots via `fieldErrorsFrom`.
   ========================================================================== */

import { ApiError } from "@/lib/api";

export type FieldErrors = Record<string, string>;

/** Relaxed Indian plate format — identical to REGISTRATION_PATTERN on the server. */
const REGISTRATION_RE = /^[A-Z]{2}-?\d{1,2}-?[A-Z]{1,3}-?\d{1,4}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const REQUIRED_MESSAGE = "This field is required";

function req(value: string, message = REQUIRED_MESSAGE): string | null {
  return value.trim() ? null : message;
}

/** Number that must be present and > 0. Returns the message, or null when fine. */
function positive(value: string, label: string): string | null {
  if (!value.trim()) return REQUIRED_MESSAGE;
  const n = Number(value);
  if (Number.isNaN(n)) return "Enter a valid number";
  if (n <= 0) return `${label} must be greater than 0`;
  return null;
}

/** Optional number; when present must be >= 0. */
function nonNegativeOptional(value: string, label: string): string | null {
  if (!value.trim()) return null;
  const n = Number(value);
  if (Number.isNaN(n)) return "Enter a valid number";
  if (n < 0) return `${label} cannot be negative`;
  return null;
}

function set(errors: FieldErrors, key: string, message: string | null): void {
  if (message) errors[key] = message;
}

/** Map a backend error envelope onto the same field slots the client validators use. */
export function fieldErrorsFrom(err: unknown): FieldErrors {
  return err instanceof ApiError && err.fields ? { ...err.fields } : {};
}

/** The banner message for anything the server rejected that isn't tied to one field. */
export function formMessageFrom(err: unknown, fallback: string): string {
  return err instanceof ApiError ? err.message : fallback;
}

export function hasErrors(errors: FieldErrors): boolean {
  return Object.keys(errors).length > 0;
}

/* ---- Vehicles ------------------------------------------------------------ */

export interface VehicleFormValues {
  registration_number: string;
  name_model: string;
  vehicle_type: string;
  max_load_capacity_kg: string;
  odometer_km: string;
  acquisition_cost: string;
  region: string;
}

export function validateVehicle(form: VehicleFormValues): FieldErrors {
  const errors: FieldErrors = {};

  const registration = form.registration_number.trim().toUpperCase();
  if (!registration) {
    set(errors, "registration_number", REQUIRED_MESSAGE);
  } else if (!REGISTRATION_RE.test(registration)) {
    set(errors, "registration_number", "Use an Indian plate format, e.g. GJ-01-AB-1234");
  }

  set(errors, "name_model", req(form.name_model));
  set(errors, "vehicle_type", req(form.vehicle_type, "Choose a vehicle type"));
  set(errors, "max_load_capacity_kg", positive(form.max_load_capacity_kg, "Capacity"));
  set(errors, "acquisition_cost", positive(form.acquisition_cost, "Acquisition cost"));
  set(errors, "odometer_km", nonNegativeOptional(form.odometer_km, "Odometer"));

  return errors;
}

/* ---- Drivers ------------------------------------------------------------- */

export interface DriverFormValues {
  name: string;
  phone: string;
  license_number: string;
  license_category: string;
  license_expiry_date: string;
}

export function validateDriver(form: DriverFormValues): FieldErrors {
  const errors: FieldErrors = {};

  set(errors, "name", req(form.name));
  set(errors, "license_category", req(form.license_category, "Choose a licence category"));

  const license = form.license_number.trim();
  if (!license) {
    set(errors, "license_number", REQUIRED_MESSAGE);
  } else if (license.length < 4) {
    set(errors, "license_number", "Licence number looks too short");
  }

  // Deliberately NOT rejecting a past date: drivers with expired licences exist in the system,
  // they are simply unassignable (the server enforces that at dispatch). We warn, we don't block.
  set(errors, "license_expiry_date", req(form.license_expiry_date, "Pick an expiry date"));

  return errors;
}

/** Non-blocking nudge shown under the expiry field. */
export function licenseExpiryWarning(dateValue: string): string | null {
  if (!dateValue) return null;
  const expiry = new Date(dateValue);
  if (Number.isNaN(expiry.getTime())) return null;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const days = Math.round((expiry.getTime() - today.getTime()) / 86_400_000);

  if (days < 0) return "This licence has already expired — the driver can be saved, but not dispatched.";
  if (days <= 30) return `Expires in ${days} day${days === 1 ? "" : "s"} — renew soon.`;
  return null;
}

/* ---- Trips --------------------------------------------------------------- */

export interface TripFormValues {
  vehicle_id: string;
  driver_id: string;
  source_city: string;
  dest_city: string;
  cargo_weight_kg: string;
  planned_distance_km: string;
  revenue: string;
}

/**
 * `capacityKg` is the selected vehicle's capacity, when one is selected — this is the client
 * half of the cargo ≤ capacity rule, so the user sees "Must be ≤ 500 kg" while typing instead
 * of after a failed submit.
 */
export function validateTrip(form: TripFormValues, capacityKg?: number): FieldErrors {
  const errors: FieldErrors = {};

  set(errors, "vehicle_id", req(form.vehicle_id, "Select a vehicle"));
  set(errors, "driver_id", req(form.driver_id, "Select a driver"));
  set(errors, "source_city", req(form.source_city, "Enter a source city"));
  set(errors, "dest_city", req(form.dest_city, "Enter a destination city"));

  if (
    form.source_city.trim() &&
    form.source_city.trim().toLowerCase() === form.dest_city.trim().toLowerCase()
  ) {
    set(errors, "dest_city", "Destination must differ from the source city");
  }

  const cargo = positive(form.cargo_weight_kg, "Cargo weight");
  if (cargo) {
    set(errors, "cargo_weight_kg", cargo);
  } else if (capacityKg !== undefined && Number(form.cargo_weight_kg) > capacityKg) {
    set(errors, "cargo_weight_kg", `Must be ≤ ${capacityKg} kg — the selected vehicle's capacity`);
  }

  if (form.planned_distance_km.trim()) {
    set(errors, "planned_distance_km", positive(form.planned_distance_km, "Distance"));
  }
  set(errors, "revenue", nonNegativeOptional(form.revenue, "Revenue"));

  return errors;
}

/* ---- Complete trip -------------------------------------------------------- */

export interface CompleteTripFormValues {
  actual_distance_km: string;
  final_odometer_km: string;
  liters: string;
  fuel_cost: string;
}

export function validateCompleteTrip(form: CompleteTripFormValues): FieldErrors {
  const errors: FieldErrors = {};

  set(errors, "actual_distance_km", positive(form.actual_distance_km, "Distance"));
  set(errors, "final_odometer_km", positive(form.final_odometer_km, "Odometer"));

  // Fuel is optional, but it's one log entry — half of it is not a valid record, and the server
  // would reject the partial object anyway.
  const hasLiters = !!form.liters.trim();
  const hasCost = !!form.fuel_cost.trim();
  if (hasLiters || hasCost) {
    if (!hasLiters) set(errors, "liters", "Add the litres too, or clear the fuel cost");
    else set(errors, "liters", positive(form.liters, "Litres"));

    if (!hasCost) set(errors, "fuel_cost", "Add the cost too, or clear the litres");
    else set(errors, "fuel_cost", positive(form.fuel_cost, "Fuel cost"));
  }

  return errors;
}

/* ---- Login ---------------------------------------------------------------- */

export function validateLogin(email: string, password: string): FieldErrors {
  const errors: FieldErrors = {};

  if (!email.trim()) set(errors, "email", REQUIRED_MESSAGE);
  else if (!EMAIL_RE.test(email.trim())) set(errors, "email", "Enter a valid email address");

  set(errors, "password", req(password));

  return errors;
}
