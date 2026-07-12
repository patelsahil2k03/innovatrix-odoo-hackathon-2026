"use client";

import { useState } from "react";
import Link from "next/link";
import { AppShell } from "@/components/shell/app-shell";
import { KpiGrid } from "@/components/ui/kpi-grid";
import { Modal } from "@/components/ui/modal";
import { DriverStatusBadge } from "@/components/ui/status-badge";
import { LoadingBlock, ErrorBlock, TableRowState } from "@/components/ui/async-state";
import { Pagination } from "@/components/ui/pagination";
import { SortableTh } from "@/components/ui/sortable-th";
import { PlusIcon, SearchIcon } from "@/components/icons";
import { api, ApiError, type LicenseCategory } from "@/lib/api";
import { useFetch } from "@/lib/use-fetch";
import { fmtDate, healthMeterClass, initials, ratingFromSafetyScore } from "@/lib/format";
import { useAuth } from "@/lib/auth-context";
import { canWriteDrivers, ROLE_LABELS } from "@/lib/roles";

const LICENSE_CATEGORIES: LicenseCategory[] = ["LMV", "HMV", "TRANS"];
const THIRTY_DAYS_MS = 1000 * 60 * 60 * 24 * 30;
const PAGE_SIZE = 10;

async function loadDrivers(status: string, search: string, sort: string, page: number) {
  const [allDrivers, filtered] = await Promise.all([
    api.drivers.list({ page_size: 200 }),
    api.drivers.list({ status: status || undefined, q: search || undefined, sort, page, page_size: PAGE_SIZE }),
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
  const [sort, setSort] = useState("name");
  const [page, setPage] = useState(1);
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [form, setForm] = useState<NewDriverForm>(BLANK_FORM);
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function updateFilter(setter: (value: string) => void, value: string) {
    setter(value);
    setPage(1);
  }

  function toggleSort(field: string) {
    setSort((prev) => (prev === field ? `-${field}` : field));
    setPage(1);
  }

  const { data, loading, error, reload } = useFetch(
    () => loadDrivers(status, search, sort, page),
    [status, search, sort, page]
  );

  const allDrivers = data?.allDrivers ?? null;
  const filtered = data?.filtered ?? null;
  const rows = filtered?.items ?? [];
  const total = allDrivers?.items.length ?? 0;
  const available = (allDrivers?.items ?? []).filter((d) => d.status === "available").length;
  const onTrip = (allDrivers?.items ?? []).filter((d) => d.status === "on_trip").length;
  const avgSafety = allDrivers && allDrivers.items.length
    ? Math.round(allDrivers.items.reduce((s, d) => s + d.safety_score, 0) / allDrivers.items.length)
    : 0;

  async function handleAddDriver(e: React.SyntheticEvent) {
    e.preventDefault();
    setFormError(null);
    setSubmitting(true);
    try {
      await api.drivers.create({
        name: form.name,
        phone: form.phone || undefined,
        license_number: form.license_number,
        license_category: form.license_category,
        license_expiry_date: form.license_expiry_date,
      });
      setIsAddOpen(false);
      setForm(BLANK_FORM);
      reload();
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : "Failed to add driver");
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
          <select className="select" value={status} onChange={(e) => updateFilter(setStatus, e.target.value)}>
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
              onChange={(e) => updateFilter(setSearch, e.target.value)}
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
          <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <SortableTh label="Driver" field="name" sort={sort} onSort={toggleSort} />
                <SortableTh label="License No." field="license_number" sort={sort} onSort={toggleSort} />
                <SortableTh label="Category" field="license_category" sort={sort} onSort={toggleSort} />
                <SortableTh label="License Expiry" field="license_expiry_date" sort={sort} onSort={toggleSort} />
                <SortableTh label="Safety Score" field="safety_score" sort={sort} onSort={toggleSort} />
                <th>Rating</th>
                <SortableTh label="Status" field="status" sort={sort} onSort={toggleSort} />
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
          <Pagination
            page={filtered?.page ?? 1}
            pageSize={PAGE_SIZE}
            total={filtered?.total ?? 0}
            onPageChange={setPage}
          />
        </div>
      )}

      <Modal
        isOpen={isAddOpen}
        onClose={() => setIsAddOpen(false)}
        title="Add Driver"
        footer={
          <>
            <button className="btn btn-outline-muted" onClick={() => setIsAddOpen(false)}>
              Cancel
            </button>
            <button className="btn btn-primary" onClick={handleAddDriver} disabled={submitting}>
              {submitting ? "Saving…" : "Save Driver"}
            </button>
          </>
        }
      >
        <form className="form-grid" onSubmit={handleAddDriver}>
          <div className="field span-2">
            <label className="label">Full Name</label>
            <input
              className="input"
              placeholder="Raj Mehta"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              required
            />
          </div>
          <div className="field">
            <label className="label">License Number</label>
            <input
              className="input"
              placeholder="GJ0120220041233"
              value={form.license_number}
              onChange={(e) => setForm({ ...form, license_number: e.target.value })}
              required
            />
          </div>
          <div className="field">
            <label className="label">License Category</label>
            <select
              className="select"
              value={form.license_category}
              onChange={(e) => setForm({ ...form, license_category: e.target.value as LicenseCategory })}
            >
              {LICENSE_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label className="label">License Expiry Date</label>
            <input
              className="input"
              type="date"
              value={form.license_expiry_date}
              onChange={(e) => setForm({ ...form, license_expiry_date: e.target.value })}
              required
            />
          </div>
          <div className="field">
            <label className="label">Phone</label>
            <input
              className="input"
              placeholder="+91 98250 11223"
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
            />
          </div>
          {formError ? (
            <p className="text-body-sm u-warning" style={{ gridColumn: "span 2" }}>
              {formError}
            </p>
          ) : null}
        </form>
      </Modal>
    </AppShell>
  );
}
