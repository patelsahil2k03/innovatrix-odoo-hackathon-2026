"use client";

import { useEffect, useState, type DependencyList } from "react";
import { ApiError } from "./api";

export interface FetchState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
}

/** Standard loading/data/error tuple for a page's primary API call, re-run when `deps` change.
 *
 * `loading` is derived during render (current key vs. the key of the last-settled result)
 * rather than set from inside the effect — the effect itself only calls setState from within
 * the fetch's own `.then()`/`.catch()`, never as a bare synchronous statement, per
 * react-hooks/set-state-in-effect. See https://react.dev/learn/you-might-not-need-an-effect. */
export function useFetch<T>(
  fetcher: () => Promise<T>,
  deps: DependencyList
): FetchState<T> & { reload: () => void } {
  const [reloadKey, setReloadKey] = useState(0);
  const currentKey = JSON.stringify([...deps, reloadKey]);

  const [settled, setSettled] = useState<{ key: string; data: T | null; error: string | null }>({
    key: "",
    data: null,
    error: null,
  });

  const loading = settled.key !== currentKey;

  useEffect(() => {
    let alive = true;
    fetcher().then(
      (data) => {
        if (alive) setSettled({ key: currentKey, data, error: null });
      },
      (err) => {
        if (!alive) return;
        const message = err instanceof ApiError ? err.message : "Something went wrong";
        setSettled({ key: currentKey, data: null, error: message });
      }
    );
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentKey]);

  return { data: settled.data, loading, error: settled.error, reload: () => setReloadKey((k) => k + 1) };
}
