"use client";

import { useMemo, useState } from "react";

interface UsePagedRowsOptions<T> {
  pageSize?: number;
  /** Strings to match a search query against, per row. Omit to disable search. */
  searchFields?: (row: T) => (string | null | undefined)[];
  /** Comparators keyed by sortable field name. Omit to disable sorting. */
  sortFns?: Record<string, (a: T, b: T) => number>;
  /** Initial sort field, optionally prefixed with "-" for descending. */
  defaultSort?: string;
}

/** Client-side search + sort + pagination for a list that's already fully loaded (small
 * per-entity tables like a vehicle's documents or fuel logs) — no extra network round-trip.
 * Filtering/sorting/clamping all happen during render, not via an effect, so a shrinking result
 * set (e.g. a new search query) can't strand the page past the end. */
export function usePagedRows<T>(allRows: T[], options: UsePagedRowsOptions<T> = {}) {
  const { pageSize = 10, searchFields, sortFns, defaultSort = "" } = options;
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState(defaultSort);
  const [page, setPage] = useState(1);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q || !searchFields) return allRows;
    return allRows.filter((row) =>
      searchFields(row).some((v) => v != null && String(v).toLowerCase().includes(q))
    );
  }, [allRows, query, searchFields]);

  const sorted = useMemo(() => {
    if (!sort || !sortFns) return filtered;
    const desc = sort.startsWith("-");
    const key = desc ? sort.slice(1) : sort;
    const cmp = sortFns[key];
    if (!cmp) return filtered;
    const copy = [...filtered].sort(cmp);
    if (desc) copy.reverse();
    return copy;
  }, [filtered, sort, sortFns]);

  const total = sorted.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const clampedPage = Math.min(Math.max(1, page), totalPages);
  const start = (clampedPage - 1) * pageSize;
  const pageRows = sorted.slice(start, start + pageSize);

  function updateQuery(value: string) {
    setQuery(value);
    setPage(1);
  }

  function toggleSort(field: string) {
    setSort((prev) => (prev === field ? `-${field}` : field));
    setPage(1);
  }

  return {
    pageRows,
    page: clampedPage,
    setPage,
    total,
    pageSize,
    query,
    updateQuery,
    sort,
    toggleSort,
  };
}
