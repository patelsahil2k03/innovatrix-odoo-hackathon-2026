"use client";

import { useEffect, useRef } from "react";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/api/v1";

/* eslint-disable @typescript-eslint/no-explicit-any */
type Handler = (data: any) => void;

/** Subscribes to the backend's SSE hub (GET /events, docs/02 §4) with one listener per named
 * event (trip.progress, trip.dispatched, kpi.refresh, ...). Handlers are read from a ref so
 * passing a fresh inline function every render doesn't reconnect the stream — only the SET of
 * event names being listened for does that (via the sorted-keys dependency below). */
export function useEventStream(handlers: Record<string, Handler>): void {
  const handlersRef = useRef(handlers);
  // Refs must not be written during render (react-hooks/refs) — keep the "latest handlers"
  // assignment in an effect, which still runs before the listeners below can fire.
  useEffect(() => {
    handlersRef.current = handlers;
  });

  const eventNames = Object.keys(handlers).sort().join(",");

  useEffect(() => {
    if (!eventNames) return;

    const source = new EventSource(`${API_BASE}/events`, { withCredentials: true });
    const listeners: Array<[string, (e: MessageEvent) => void]> = [];

    for (const name of eventNames.split(",")) {
      const listener = (e: MessageEvent) => {
        try {
          handlersRef.current[name]?.(JSON.parse(e.data));
        } catch {
          // malformed payload — ignore, next event will still arrive
        }
      };
      source.addEventListener(name, listener);
      listeners.push([name, listener]);
    }

    return () => {
      for (const [name, listener] of listeners) source.removeEventListener(name, listener);
      source.close();
    };
  }, [eventNames]);
}
