"use client";

import { useState } from "react";
import Link from "next/link";
import { AppShell } from "@/components/shell/app-shell";
import { KpiGrid } from "@/components/ui/kpi-grid";
import { Modal } from "@/components/ui/modal";
import { Field, FormAlert, RequiredLegend } from "@/components/ui/field";
import { DriverStatusBadge } from "@/components/ui/status-badge";
import { LoadingBlock, ErrorBlock, TableRowState } from "@/components/ui/async-state";
import { PlusIcon, SearchIcon } from "@/components/icons";
import { api, type LicenseCategory } from "@/lib/api";
import { useFetch } from "@/lib/use-fetch";
import { fmtDate, healthMeterClass, initials, ratingFromSafetyScore } from "@/lib/format";
import { useAuth } from "@/lib/auth-context";
import { canWriteDrivers, ROLE_LABELS } from "@/lib/roles";
import {
  fieldErrorsFrom,
  formMessageFrom,
  hasErrors,
  licenseExpiryWarning,
  validateDriver,
  type FieldErrors,
} from "@/lib/validation";

const FORM_ID = "add-driver-form";
const LICENSE_CATEGORIES: LicenseCategory[] = ["LMV", "HMV", "TRANS"];
const THIRTY_DAYS_MS = 1000 * 60 * 60 * 24 * 30;

async function loadDrivers(status: string, search: string) {
  const [allDrivers, filtered] = await Promise.all([
    api.drivers.list({ page_size: 200 }),
    api.drivers.list({ status: status || undefined, q: search || undefined, page_size: 100 }),
  ]);
  return { allDrivers, filtered, nowMs: Date.now() };
}

interface NewDriverForm {
  name: string;
  phone: string;
  license_number: string;
  license_category: LicenseCategory;
  license_expiry_date: string;
}

const BLANK_FORM: NewDriverForm = {
  name: "",
  phone: "",
  license_number: "",
  license_category: "HMV",
  license_expiry_date: "",
};

export default function DriversPage() {
  const { user } = useAuth();
  const canAdd = canWriteDrivers(user?.role);
  const [status, setStatus] = useState("");
  const [search, setSearch] = useState("");
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [form, setForm] = useState<NewDriverForm>(BLANK_FORM);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const { data, loading, error, reload } = useFetch(() => loadDrivers(status, search), [status, search]);

  const allDrivers = data?.allDrivers ?? null;
  const filtered = data?.filtered ?? null;
  const rows = filtered?.items ?? [];
  const total = allDrivers?.items.length ?? 0;
  const available = (allDrivers?.items ?? []).filter((d) => d.status === "available").length;
  const onTrip = (allDrivers?.items ?? []).filter((d) => d.status === "on_trip").length;
  const avgSafety = allDrivers && allDrivers.items.length
    ? Math.round(allDrivers.items.reduce((s, d) => s + d.safety_score, 0) / allDrivers.items.length)
    : 0;

  function update(patch: Partial<NewDriverForm>) {
    setForm((prev) => ({ ...prev, ...patch }));
    setErrors((prev) => {
      const next = { ...prev };
      for (const key of Object.keys(patch)) delete next[key];
      return next;
    });
  }

  function closeAdd() {
    setIsAddOpen(false);
    setForm(BLANK_FORM);
    setErrors({});
    setFormError(null);
  }

  async function handleAddDriver(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);

    const found = validateDriver(form);
    if (hasErrors(found)) {
      setErrors(found);
      setFormError("Some details need fixing.");
      return;
    }
    setErrors({});
    setSubmitting(true);

    try {
      await api.drivers.create({
        name: form.name.trim(),
        phone: form.phone.trim() || undefined,
        license_number: form.license_number.trim().toUpperCase(),
        license_category: form.license_category,
        license_expiry_date: form.license_expiry_date,
      });
      closeAdd();
      reload();
    } catch (err) {
      setErrors(fieldErrorsFrom(err));
      setFormError(formMessageFrom(err, "Failed to add driver"));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AppShell eyebrow="Fleet" title="Drivers">
      <KpiGrid
        cells={[
          { label: "Total Drivers", value: total },
          { label: "Available", value: available },
          { label: "On Trip", value: onTrip },
          { label: "Avg Safety Score", value: avgSafety },
        ]}
      />

      <div className="table-toolbar">
        <div className="table-filters">
          <select className="select" value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">All Statuses</option>
            <option value="available">Available</option>
            <option value="on_trip">On Trip</option>
            <option value="off_duty">Off Duty</option>
            <option value="suspended">Suspended</option>
          </select>
          <div className="search-field">
            <SearchIcon />
            <input
              className="input"
              type="text"
              placeholder="Search name or license number…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>
        {canAdd ? (
          <button className="btn btn-primary" onClick={() => setIsAddOpen(true)}>
            <PlusIcon style={{ width: 16, height: 16 }} />
            Add Driver
          </button>
        ) : (
          <span className="text-body-sm u-muted-soft">
            Only Safety Officers can add drivers (you&apos;re signed in as {ROLE_LABELS[user?.role ?? ""] ?? user?.role}).
          </span>
        )}
      </div>

      {loading && !data ? (
        <LoadingBlock label="Loading drivers…" />
      ) : error ? (
        <ErrorBlock message={error} onRetry={reload} />
      ) : (
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Driver</th>
                <th>License No.</th>
                <th>Category</th>
                <th>License Expiry</th>
                <th>Safety Score</th>
                <th>Rating</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <TableRowState colSpan={8}>No drivers match these filters.</TableRowState>
              ) : (
                rows.map((d) => {
                  const expSoon = new Date(d.license_expiry_date).getTime() - (data?.nowMs ?? 0) < THIRTY_DAYS_MS;
                  return (
                    <tr key={d.id}>
                      <td>
                        <div className="row-link">
                          <div className="row-avatar">{initials(d.name)}</div>
                          <Link className="cell-strong" href={`/drivers/${d.id}`}>
                            {d.name}
                          </Link>
                        </div>
                      </td>
                      <td className="cell-muted">{d.license_number}</td>
                      <td className="cell-muted">{d.license_category}</td>
                      <td className={expSoon ? "u-warning" : "cell-muted"}>{fmtDate(d.license_expiry_date)}</td>
                      <td>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <div className="meter" style={{ width: 64 }}>
                            <div
                              className={`meter-fill ${healthMeterClass(d.safety_score)}`}
                              style={{ width: `${d.safety_score}%` }}
                            />
                          </div>
                          <span className="text-body-sm">{d.safety_score}</span>
                        </div>
                      </td>
                      <td className="cell-muted">{ratingFromSafetyScore(d.safety_score).toFixed(1)} ★</td>
                      <td>
                        <DriverStatusBadge status={d.status} />
                      </td>
                      <td>
                        <Link href={`/drivers/${d.id}`} className="btn btn-sm btn-outline-muted">
                          View
                        </Link>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      )}

      <Modal
        isOpen={isAddOpen}
        onClose={closeAdd}
        title="Add Driver"
        footer={
          <>
            <button className="btn btn-outline-muted" onClick={closeAdd}>
              Cancel
            </button>
            <button className="btn btn-primary" type="submit" form={FORM_ID} disabled={submitting}>
              {submitting ? "Saving…" : "Save Driver"}
            </button>
          </>
        }
      >
        <form className="form-grid" id={FORM_ID} onSubmit={handleAddDriver} noValidate>
          <RequiredLegend />

          {formError ? <FormAlert message={formError} count={Object.keys(errors).length} /> : null}

          <Field id="driver_name" label="Full Name" required error={errors.name} span2>
            <input
              className="input"
              placeholder="Raj Mehta"
              value={form.name}
              onChange={(e) => update({ name: e.target.value })}
            />
          </Field>

          <Field
            id="license_number"
            label="License Number"
            required
            error={errors.license_number}
          >
            <input
              className="input"
              placeholder="GJ0120220041233"
              value={form.license_number}
              onChange={(e) => update({ license_number: e.target.value })}
            />
          </Field>

          <Field
            id="license_category"
            label="License Category"
            required
            error={errors.license_category}
          >
            <select
              className="select"
              value={form.license_category}
              onChange={(e) => update({ license_category: e.target.value as LicenseCategory })}
            >
              {LICENSE_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </Field>

          <Field
            id="license_expiry_date"
            label="License Expiry Date"
            required
            error={errors.license_expiry_date}
            // An expired licence is savable but not dispatchable — advise, don't block.
            warning={licenseExpiryWarning(form.license_expiry_date)}
          >
            <input
              className="input"
              type="date"
              value={form.license_expiry_date}
              onChange={(e) => update({ license_expiry_date: e.target.value })}
            />
          </Field>

          <Field id="phone" label="Phone" error={errors.phone}>
            <input
              className="input"
              placeholder="+91 98250 11223"
              value={form.phone}
              onChange={(e) => update({ phone: e.target.value })}
            />
          </Field>
        </form>
      </Modal>
    </AppShell>
  );
}
