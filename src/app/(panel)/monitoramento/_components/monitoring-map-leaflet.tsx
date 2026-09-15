"use client";

import { useEffect, useMemo } from "react";
import L from "leaflet";
import { MapContainer, TileLayer, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import type { MonitoringMapMarker } from "@/lib/api-types";
import { MonitoringMapClusterLayer } from "./monitoring-map-cluster-layer";

function FitBounds({ markers }: { markers: MonitoringMapMarker[] }) {
  const map = useMap();
  useEffect(() => {
    if (!markers.length) return;
    const b = L.latLngBounds(markers.map((m) => [m.lat, m.lng] as L.LatLngTuple));
    map.fitBounds(b, { padding: [32, 32], maxZoom: 17 });
  }, [map, markers]);
  return null;
}

type Props = {
  markers: MonitoringMapMarker[];
  /** Altura em px */
  height?: number;
};

/**
 * Mapa Leaflet só com client-side (importar via `next/dynamic` com `ssr: false` na página).
 */
export function MonitoringMapLeaflet({ markers, height = 560 }: Props) {
  const center = useMemo((): [number, number] => {
    if (!markers.length) return [-15.78, -47.93];
    const lat = markers.reduce((a, m) => a + m.lat, 0) / markers.length;
    const lng = markers.reduce((a, m) => a + m.lng, 0) / markers.length;
    return [lat, lng];
  }, [markers]);

  if (!markers.length) return null;

  return (
    <MapContainer
      center={center}
      zoom={6}
      style={{ height, width: "100%" }}
      scrollWheelZoom
      preferCanvas
      className="z-0 rounded-xl border border-slate-200/90 shadow-inner"
    >
      <TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
      <FitBounds markers={markers} />
      <MonitoringMapClusterLayer markers={markers} />
    </MapContainer>
  );
}
