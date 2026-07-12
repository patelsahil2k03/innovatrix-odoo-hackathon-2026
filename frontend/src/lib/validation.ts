import { z } from "zod";

/* Client-side mirrors of the API contract's validation rules (docs/04_API_CONTRACT.md).
   The server is always the final authority — these exist so bad input never round-trips to
   the API just to bounce back as a 422; the cross-field capacity check (cargo vs. the selected
   vehicle's max_load_capacity_kg) can't live in the schema itself since it depends on which
   vehicle is picked at runtime, so callers run that check separately after this passes. */

const emptyToUndefined = (v: unknown) => (v === "" ? undefined : v);

export const tripFormSchema = z.object({
  vehicle_id: z.string().min(1, "Select a vehicle"),
  driver_id: z.string().min(1, "Select a driver"),
  source_city: z.string().min(1, "Source city is required"),
  dest_city: z.string().min(1, "Destination city is required"),
  cargo_weight_kg: z.coerce.number().positive("Cargo weight must be greater than 0"),
  planned_distance_km: z.preprocess(
    emptyToUndefined,
    z.coerce.number().positive("Distance must be greater than 0").optional()
  ),
  revenue: z.preprocess(
    emptyToUndefined,
    z.coerce.number().nonnegative("Revenue can't be negative").optional()
  ),
});

export type TripFormValues = z.infer<typeof tripFormSchema>;

/** Flattens a zod error into { fieldName: firstMessage } for inline form display. */
export function fieldErrorsFrom(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path[0];
    if (typeof key === "string" && !out[key]) out[key] = issue.message;
  }
  return out;
}
