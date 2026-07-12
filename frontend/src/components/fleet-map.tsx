"use client";

import { useEffect, useRef } from "react";
import type { TripLive } from "@/lib/api";

export function FleetMap({ trips }: { trips: TripLive[] }) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let map: import("leaflet").Map | undefined;
    let cancelled = false;

    (async () => {
      const L = (await import("leaflet")).default;
      if (cancelled || !containerRef.current) return;

      map = L.map(containerRef.current, { scrollWheelZoom: false }).setView([21.5, 78.4], 5);

      L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}{r}.png", {
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
        subdomains: "abcd",
        maxZoom: 19,
      }).addTo(map);

      const cityLabelled = new Set<string>();
      const labelCity = (name: string, lat: number, lng: number) => {
        if (cityLabelled.has(name)) return;
        cityLabelled.add(name);
        L.marker([lat, lng], {
          icon: L.divIcon({ className: "", html: `<span></span>`, iconSize: [0, 0] }),
          interactive: false,
        })
          .bindTooltip(name, { permanent: true, direction: "bottom", offset: [0, 6], className: "city-label" })
          .addTo(map!)
          .openTooltip();
      };

      trips.forEach((t) => {
        labelCity(t.source_city, t.source_lat, t.source_lng);
        labelCity(t.dest_city, t.dest_lat, t.dest_lng);

        L.polyline(
          [
            [t.source_lat, t.source_lng],
            [t.dest_lat, t.dest_lng],
          ],
          { color: "#024ad8", weight: 3, opacity: 0.9, dashArray: "8 6" }
        ).addTo(map!);

        const icon = L.divIcon({
          className: "",
          html: `<div class="vehicle-pin on_trip"></div>`,
          iconSize: [18, 18],
          iconAnchor: [9, 9],
        });
        const marker = L.marker([t.current_lat, t.current_lng], { icon }).addTo(map!);

        marker.bindTooltip(t.vehicle_registration, {
          permanent: true,
          direction: "top",
          offset: [0, -10],
          className: "vehicle-tooltip",
        });

        marker.bindPopup(`
          <div class="map-popup-title">${t.vehicle_registration}</div>
          <div class="map-popup-row"><span>Route</span><span>${t.source_city} → ${t.dest_city}</span></div>
          <div class="map-popup-row"><span>Progress</span><span>${t.progress_percent.toFixed(0)}%</span></div>
          <div class="map-popup-row"><span>Driver</span><span>${t.driver_name}</span></div>
        `);
      });

      if (trips.length > 0) {
        const bounds = L.latLngBounds(
          trips.flatMap((t) => [
            [t.source_lat, t.source_lng] as [number, number],
            [t.dest_lat, t.dest_lng] as [number, number],
          ])
        );
        map.fitBounds(bounds, { padding: [40, 40] });
      }
    })();

    return () => {
      cancelled = true;
      map?.remove();
    };
  }, [trips]);

  return <div id="fleet-map" ref={containerRef} />;
}
