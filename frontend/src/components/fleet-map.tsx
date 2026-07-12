"use client";

import { useEffect, useRef } from "react";
import type { TripLive } from "@/lib/api";

type LeafletModule = typeof import("leaflet");
type LMap = import("leaflet").Map;
type LMarker = import("leaflet").Marker;
type LPolyline = import("leaflet").Polyline;

function popupHtml(t: TripLive): string {
  return `
    <div class="map-popup-title">${t.vehicle_registration}</div>
    <div class="map-popup-row"><span>Route</span><span>${t.source_city} → ${t.dest_city}</span></div>
    <div class="map-popup-row"><span>Progress</span><span>${t.progress_percent.toFixed(0)}%</span></div>
    <div class="map-popup-row"><span>Driver</span><span>${t.driver_name}</span></div>
  `;
}

/** Live fleet map — the vehicle markers move without a page refresh as SSE `trip.progress`
 * events arrive upstream (see analytics/page.tsx's useEventStream wiring). The map instance
 * itself and the route lines/city labels are created once; only marker positions + popup text
 * update on every `trips` change, UNLESS the actual set of live trip ids changed (a trip was
 * dispatched/completed/cancelled), in which case everything is rebuilt from scratch. */
export function FleetMap({ trips }: { trips: TripLive[] }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const leafletRef = useRef<LeafletModule | null>(null);
  const mapRef = useRef<LMap | null>(null);
  const markersRef = useRef<Map<string, LMarker>>(new Map());
  const linesRef = useRef<LPolyline[]>([]);
  const cityLabelsRef = useRef<LMarker[]>([]);
  const tripsRef = useRef<TripLive[]>(trips);
  // Refs must not be written during render (react-hooks/refs) — this keeps tripsRef current for
  // the async map-creation effect below, which needs the latest value once it resolves, not a
  // stale closure over the first render's `trips`.
  useEffect(() => {
    tripsRef.current = trips;
  });

  // Create the map exactly once.
  useEffect(() => {
    let cancelled = false;

    (async () => {
      const L = (await import("leaflet")).default;
      if (cancelled || !containerRef.current) return;
      leafletRef.current = L;

      const map = L.map(containerRef.current, { scrollWheelZoom: false }).setView([21.5, 78.4], 5);
      mapRef.current = map;

      L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}{r}.png", {
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
        subdomains: "abcd",
        maxZoom: 19,
      }).addTo(map);

      rebuild(tripsRef.current);
    })();

    const markers = markersRef.current;
    return () => {
      cancelled = true;
      mapRef.current?.remove();
      mapRef.current = null;
      markers.clear();
      linesRef.current = [];
      cityLabelsRef.current = [];
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function clearLayer(layer: LMarker | LPolyline | undefined) {
    const map = mapRef.current;
    if (map && layer) map.removeLayer(layer);
  }

  function rebuild(list: TripLive[]) {
    const L = leafletRef.current;
    const map = mapRef.current;
    if (!L || !map) return;

    markersRef.current.forEach((m) => clearLayer(m));
    linesRef.current.forEach((l) => clearLayer(l));
    cityLabelsRef.current.forEach((m) => clearLayer(m));
    markersRef.current.clear();
    linesRef.current = [];
    cityLabelsRef.current = [];

    const labelled = new Set<string>();
    const labelCity = (name: string, lat: number, lng: number) => {
      if (labelled.has(name)) return;
      labelled.add(name);
      const m = L.marker([lat, lng], {
        icon: L.divIcon({ className: "", html: `<span></span>`, iconSize: [0, 0] }),
        interactive: false,
      })
        .bindTooltip(name, { permanent: true, direction: "bottom", offset: [0, 6], className: "city-label" })
        .addTo(map);
      m.openTooltip();
      cityLabelsRef.current.push(m);
    };

    list.forEach((t) => {
      labelCity(t.source_city, t.source_lat, t.source_lng);
      labelCity(t.dest_city, t.dest_lat, t.dest_lng);

      const line = L.polyline(
        [
          [t.source_lat, t.source_lng],
          [t.dest_lat, t.dest_lng],
        ],
        { color: "#024ad8", weight: 3, opacity: 0.9, dashArray: "8 6" }
      ).addTo(map);
      linesRef.current.push(line);

      const icon = L.divIcon({
        className: "",
        html: `<div class="vehicle-pin on_trip"></div>`,
        iconSize: [18, 18],
        iconAnchor: [9, 9],
      });
      const marker = L.marker([t.current_lat, t.current_lng], { icon }).addTo(map);
      marker.bindTooltip(t.vehicle_registration, {
        permanent: true,
        direction: "top",
        offset: [0, -10],
        className: "vehicle-tooltip",
      });
      marker.bindPopup(popupHtml(t));
      markersRef.current.set(t.id, marker);
    });

    if (list.length > 0) {
      const bounds = L.latLngBounds(
        list.flatMap((t) => [
          [t.source_lat, t.source_lng] as [number, number],
          [t.dest_lat, t.dest_lng] as [number, number],
        ])
      );
      map.fitBounds(bounds, { padding: [40, 40] });
    }
  }

  // Update on every `trips` change: reposition in place if the set of live trip ids is
  // unchanged (the common case — a progress tick), full rebuild otherwise (a trip appeared,
  // completed, or was cancelled).
  useEffect(() => {
    if (!mapRef.current || !leafletRef.current) return;

    const currentIds = new Set(markersRef.current.keys());
    const nextIds = new Set(trips.map((t) => t.id));
    const sameSet =
      currentIds.size === nextIds.size && [...currentIds].every((id) => nextIds.has(id));

    if (!sameSet) {
      rebuild(trips);
      return;
    }

    trips.forEach((t) => {
      const marker = markersRef.current.get(t.id);
      if (!marker) return;
      marker.setLatLng([t.current_lat, t.current_lng]);
      marker.setPopupContent(popupHtml(t));
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trips]);

  return <div id="fleet-map" ref={containerRef} />;
}
