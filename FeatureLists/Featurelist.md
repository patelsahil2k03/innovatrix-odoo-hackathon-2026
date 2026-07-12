# TransitOps — Feature Tracker 
Legend: `[ ]` not started · `[~]` in progress · `[x]` done

---

## 1. Roles & Users

### Essential
- [ ] `ROLES`: id, name, description — Fleet Manager / Dispatcher / Safety Officer / Financial Analyst
- [ ] `USERS`: email (unique), password hash, role_id, full_name, created_at
- [ ] Signup/login with email + password (JWT)
- [ ] Route/page access scoped by role (per mockup's permission matrix)
- [ ] Session validation middleware (protect all routes except login)

### Add-on
- [ ] Account lockout after 5 failed login attempts (shown in mockup error state)
- [ ] Forgot password flow
- [ ] Settings screen: editable role-permission matrix (Fleet/Drivers/Trips/Fuel-Exp/Analytics × 4 roles)
- [ ] Depot Name / Currency / Distance Unit config (Settings screen)

---

## 2. Vehicles

### Essential
- [ ] CRUD: registration number (unique), model, vehicle_type, max_load_capacity, odometer, acquisition_cost, status, region
- [ ] Status field: Available / On Trip / In Shop / Retired
- [ ] Business rule: Retired/In Shop vehicles hidden from Trip Dispatcher vehicle picker
- [ ] Search/filter by reg no, type, status, region

### Add-on
- [ ] `VEHICLE_DOCUMENTS`: document_type, document_number, expiry_date, file_url, status per vehicle
- [ ] Document expiry tracking/reminders

---

## 3. Vehicle Health & Analytics

### Essential
- [ ] `VEHICLE_ANALYTICS` computed values surfaced in Reports: fuel_efficiency, utilization_percent, cost_per_km, profitability
- [ ] Vehicle status breakdown (Available/On Trip/In Shop/Retired) on Dashboard

### Add-on
- [ ] `VEHICLE_HEALTH`: health_score, maintenance_risk, predicted_service_date, calculated_at — a simple health score (e.g., derived from maintenance frequency + odometer) with a basic recalculation job
- [ ] Persist `VEHICLE_ANALYTICS` as its own collection (recomputed periodically) rather than only computing at query time, so historical trend charts are possible

---

## 4. Drivers

### Essential
- [ ] CRUD: name, license_number (unique), license_category, license_expiry_date, safety_score, status, phone
- [ ] Status: Available / On Trip / Off Duty / Suspended
- [ ] Business rule: expired license OR Suspended status → blocked from trip assignment

### Add-on
- [ ] `DRIVER_DOCUMENTS`: document_type, expiry_date, file_url per driver

---

## 5. Driver Performance

### Essential
- [ ] Trip Completion % and Safety Score visible on Driver screen (per mockup)

### Add-on
- [ ] `DRIVER_PERFORMANCE` as its own collection: total_trips, avg_fuel_efficiency, incident_count, rating — recomputed after each completed trip

---

## 6. Trips

### Essential
- [ ] Create trip: source_location, destination_location, vehicle_id (available only), driver_id (available only), cargo_weight, planned_distance, created_by
- [ ] Validation: cargo weight ≤ vehicle max capacity (inline error, per mockup)
- [ ] Validation: vehicle/driver not already On Trip
- [ ] Validation: driver license not expired, not Suspended
- [ ] Lifecycle: Draft → Dispatched → Completed / Cancelled (stepper UI per mockup)
- [ ] Dispatch action: vehicle + driver status → On Trip, set dispatched_at
- [ ] Complete action: capture actual_distance + fuel consumed, set completed_at → vehicle + driver status → Available
- [ ] Complete action cascades: auto-generate Fuel Log + Expense entry
- [ ] Cancel (from Dispatched): restore vehicle + driver to Available
- [ ] `revenue` field per trip (required for ROI formula)
- [ ] Live board / trip cards view (per mockup screen 4)

### Add-on
- [ ] Trip search/filter
- [ ] `AI_DISPATCH_SUGGESTIONS`: score + reason per candidate vehicle/driver pairing, surfaced as a "suggested match" hint on the Trip Dispatcher create form

---

## 7. Maintenance Logs

### Essential
- [ ] Log Service Record: vehicle_id, maintenance_type, cost, status, opened_at, closed_at
- [ ] Creating active record → vehicle status auto → In Shop
- [ ] Closing record → vehicle status auto → Available (unless Retired)
- [ ] Service log table (history per vehicle)

### Add-on
- [ ] Maintenance type categorization/filtering

---

## 8. Fuel Logs & Expenses

### Essential
- [ ] `FUEL_LOGS`: vehicle_id, trip_id, liters, cost, logged_at
- [ ] `EXPENSES`: vehicle_id, expense_type, amount, notes, created_at
- [ ] Auto-compute: Total Operational Cost = Fuel + Maintenance (per vehicle, running total)

### Add-on
- [ ] Auto-populate fuel log from trip completion (cascade from Trip Dispatcher)

---

## 9. Reports & Analytics

### Essential
- [ ] KPI cards: Fuel Efficiency (distance/fuel), Fleet Utilization %, Operational Cost, Vehicle ROI
- [ ] ROI formula: `(Revenue − (Maintenance + Fuel)) / Acquisition Cost`
- [ ] Top Costliest Vehicles chart/list
- [ ] Monthly Revenue chart
- [ ] CSV export (mandatory per spec)

### Add-on
- [ ] PDF export
- [ ] Additional charts/visual analytics (heatmaps, utilization trends)

---

## 10. Dashboard

### Essential
- [ ] KPI cards: Active Vehicles, Available Vehicles, Vehicles in Maintenance, Active Trips, Pending Trips, Drivers On Duty, Fleet Utilization %
- [ ] Filters: Vehicle Type / Status / Region
- [ ] Recent Trips table
- [ ] Vehicle Status breakdown bar

### Add-on
- [ ] Dark mode

---

## 11. Alerts

### Essential
- [ ] Inline validation errors surfaced in-form: capacity exceeded, expired license, overlapping assignment (as shown in mockup)

### Add-on
- [ ] `ALERTS` as its own collection: title, type, severity, status, created_at — persisted/queryable alert feed (e.g., license-expiring-soon, vehicle-due-for-service), separate from inline form validation

---

## 12. Notifications

### Add-on
- [ ] `NOTIFICATIONS`: user_id, title, message, is_read, created_at — in-app notification bell
- [ ] Email reminders for expiring licenses

---

## 13. Audit Logs

### Add-on
- [ ] `AUDIT_LOGS`: user_id, action, entity_name, entity_id, created_at — tracks who did what, when, across all entities (useful for compliance/traceability, but not required for core demo flow)

---

## Full Entity List 

| # | Collection | Category |
|---|---|---|
| 1 | `roles` | Essential |
| 2 | `users` | Essential |
| 3 | `vehicles` | Essential |
| 4 | `vehicle_documents` | Add-on |
| 5 | `vehicle_health` | Add-on |
| 6 | `vehicle_analytics` | Essential (computed) / Add-on (persisted) |
| 7 | `drivers` | Essential |
| 8 | `driver_documents` | Add-on |
| 9 | `driver_performance` | Add-on |
| 10 | `trips` | Essential |
| 11 | `maintenance_logs` | Essential |
| 12 | `fuel_logs` | Essential |
| 13 | `expenses` | Essential |
| 14 | `alerts` | Essential (inline) / Add-on (persisted) |
| 15 | `notifications` | Add-on |
| 16 | `audit_logs` | Add-on |
| 17 | `ai_dispatch_suggestions` | Add-on |

---

## Suggested build order 
1. Roles/Users/Auth + Vehicle + Driver CRUD
2. Trip creation + validations
3. Dispatch/Complete/Cancel status-transition cascade 
4. Maintenance log + status cascade
5. Fuel + Expense CRUD + operational cost calc
6. Dashboard + Reports (computed KPIs, ROI formula, CSV export)
7. Add-ons if time remains: documents, health score, driver performance, alerts feed, notifications, audit logs, AI dispatch suggestions
8. Polish, seed data, run through the Van-05/Alex demo script end-to-end
