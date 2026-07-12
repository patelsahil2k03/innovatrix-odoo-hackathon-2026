"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { SearchIcon } from "@/components/icons";
import { api, type VehicleOut, type DriverOut, type TripOut } from "@/lib/api";
import { VehicleStatusBadge, DriverStatusBadge, TripStatusBadge } from "@/components/ui/status-badge";

const MIN_QUERY_LENGTH = 2;
const RESULT_LIMIT = 5;
const DEBOUNCE_MS = 300;

interface SearchResults {
  vehicles: VehicleOut[];
  drivers: DriverOut[];
  trips: TripOut[];
}

const EMPTY_RESULTS: SearchResults = { vehicles: [], drivers: [], trips: [] };

export function GlobalSearch() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [results, setResults] = useState<SearchResults>(EMPTY_RESULTS);
  const [resultsQuery, setResultsQuery] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);

  const trimmed = query.trim();
  const hasQuery = trimmed.length >= MIN_QUERY_LENGTH;
  const loading = hasQuery && resultsQuery !== trimmed;

  useEffect(() => {
    if (trimmed.length < MIN_QUERY_LENGTH) return;

    const timer = setTimeout(async () => {
      try {
        const [vehicles, drivers, trips] = await Promise.all([
          api.vehicles.list({ q: trimmed, page_size: RESULT_LIMIT }),
          api.drivers.list({ q: trimmed, page_size: RESULT_LIMIT }),
          api.trips.list({ q: trimmed, page_size: RESULT_LIMIT }),
        ]);
        setResults({ vehicles: vehicles.items, drivers: drivers.items, trips: trips.items });
      } catch {
        setResults(EMPTY_RESULTS);
      } finally {
        setResultsQuery(trimmed);
      }
    }, DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [trimmed]);

  useEffect(() => {
    if (!isOpen) return;
    const handleClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("click", handleClick);
    return () => document.removeEventListener("click", handleClick);
  }, [isOpen]);

  function goTo(path: string) {
    setIsOpen(false);
    setQuery("");
    setResultsQuery("");
    router.push(path);
  }

  const hasResults = results.vehicles.length > 0 || results.drivers.length > 0 || results.trips.length > 0;

  return (
    <div className="search-field topbar-search global-search" ref={containerRef}>
      <SearchIcon />
      <input
        className="input"
        type="text"
        placeholder="Search vehicles, drivers, trips…"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setIsOpen(true);
        }}
        onFocus={() => setIsOpen(true)}
      />

      {isOpen && hasQuery && (
        <div className="search-dropdown">
          {loading && !hasResults ? (
            <div className="notification-empty">
              <p className="text-body-sm u-muted">Searching…</p>
            </div>
          ) : !hasResults ? (
            <div className="notification-empty">
              <p className="text-body-sm u-muted">No results for &ldquo;{trimmed}&rdquo;</p>
            </div>
          ) : (
            <>
              {results.vehicles.length > 0 && (
                <div className="search-group">
                  <div className="search-group-label">Vehicles</div>
                  {results.vehicles.map((v) => (
                    <button
                      key={v.id}
                      type="button"
                      className="search-result"
                      onClick={() => goTo(`/vehicles/${v.id}`)}
                    >
                      <span className="search-result-title">{v.registration_number} · {v.name_model}</span>
                      <VehicleStatusBadge status={v.status} />
                    </button>
                  ))}
                </div>
              )}

              {results.drivers.length > 0 && (
                <div className="search-group">
                  <div className="search-group-label">Drivers</div>
                  {results.drivers.map((d) => (
                    <button
                      key={d.id}
                      type="button"
                      className="search-result"
                      onClick={() => goTo(`/drivers/${d.id}`)}
                    >
                      <span className="search-result-title">{d.name} · {d.license_number}</span>
                      <DriverStatusBadge status={d.status} />
                    </button>
                  ))}
                </div>
              )}

              {results.trips.length > 0 && (
                <div className="search-group">
                  <div className="search-group-label">Trips</div>
                  {results.trips.map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      className="search-result"
                      onClick={() => goTo("/trips")}
                    >
                      <span className="search-result-title">{t.source_city} → {t.dest_city}</span>
                      <TripStatusBadge status={t.status} />
                    </button>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
