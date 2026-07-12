"use client";

import { useEffect, useRef } from "react";
import {
  vehicles,
  vehicleHealth,
  trips,
  cityCoords,
  getVehicleLatLng,
  getDriver,
} from "@/lib/mock-data";

export function FleetMap() {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let map: import("leaflet").Map | undefined;
    let cancelled = false;

    (async () => {
      const L = (await import("leaflet")).default;
      if (cancelled || !containerRef.current) return;

      map = L.map(containerRef.current, { scrollWheelZoom: false }).setView([21.5, 73.4], 6);

      L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}{r}.png", {
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
        subdomains: "abcd",
        maxZoom: 19,
      }).addTo(map);

      Object.entries(cityCoords).forEach(([city, coords]) => {
        L.marker(coords, {
          icon: L.divIcon({ className: "", html: `<span></span>`, iconSize: [0, 0] }),
          interactive: false,
        })
          .bindTooltip(city, { permanent: true, direction: "bottom", offset: [0, 6], className: "city-label" })
          .addTo(map!)
          .openTooltip();
      });

      vehicles.forEach((v) => {
        const latlng = getVehicleLatLng(v);
        if (!latlng) return;
        const icon = L.divIcon({ className: "", html: `<div class="vehicle-pin ${v.status}"></div>`, iconSize: [18, 18], iconAnchor: [9, 9] });
        const marker = L.marker(latlng, { icon }).addTo(map!);
        const health = vehicleHealth[v.id];
        const activeTrip = trips.find((t) => t.vehicle_id === v.id && (t.status === "in_transit" || t.status === "dispatched"));
        const driver = activeTrip && activeTrip.driver_id ? getDriver(activeTrip.driver_id) : null;

        marker.bindTooltip(v.registration_number, {
          permanent: true,
          direction: "top",
          offset: [0, -10],
          className: "vehicle-tooltip",
        });

        marker.bindPopup(`
          <div class="map-popup-title">${v.registration_number}</div>
          <div class="map-popup-row"><span>Model</span><span>${v.model}</span></div>
          <div class="map-popup-row"><span>Region</span><span>${v.region}</span></div>
          <div class="map-popup-row"><span>Status</span><span>${v.status}</span></div>
          <div class="map-popup-row"><span>Health</span><span>${health.health_score}</span></div>
          <div class="map-popup-row"><span>Driver</span><span>${driver ? driver.name : "Unassigned"}</span></div>
          <a href="/vehicles/${v.id}" class="text-body-sm u-primary">View vehicle →</a>
        `);
      });

      trips
        .filter((t) => t.status === "in_transit" || t.status === "dispatched")
        .forEach((t) => {
          const from = cityCoords[t.source_location];
          const to = cityCoords[t.destination_location];
          if (!from || !to) return;
          L.polyline([from, to], { color: "#da291c", weight: 3, opacity: 0.9, dashArray: "8 6" }).addTo(map!);
        });
    })();

    return () => {
      cancelled = true;
      map?.remove();
    };
  }, []);

  return <div id="fleet-map" ref={containerRef} />;
}
