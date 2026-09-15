"use client";

import { useEffect } from "react";
import L from "leaflet";
import { useMap } from "react-leaflet";
import "leaflet.markercluster/dist/MarkerCluster.css";
import "leaflet.markercluster/dist/MarkerCluster.Default.css";
import "leaflet.markercluster";
import type { MonitoringMapMarker } from "@/lib/api-types";

function pinIcon(online: boolean) {
  const color = online ? "#059669" : "#e11d48";
  return L.divIcon({
    className: "monitoring-leaflet-pin",
    html: `<div style="width:20px;height:20px;border-radius:50%;background:${color};border:2px solid #fff;box-shadow:0 2px 8px rgba(15,23,42,0.35)"></div>`,
    iconSize: [20, 20],
    iconAnchor: [10, 10],
  });
}

function escapeHtml(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

type Props = {
  markers: MonitoringMapMarker[];
};

/**
 * Agrupa marcadores no cliente; popups em HTML para compatibilidade total com o cluster.
 */
export function MonitoringMapClusterLayer({ markers }: Props) {
  const map = useMap();

  useEffect(() => {
    const MCluster = (L as unknown as { markerClusterGroup?: (opts: Record<string, unknown>) => L.Layer }).markerClusterGroup;
    if (typeof MCluster !== "function") return;

    const mcg = MCluster({
      chunkedLoading: markers.length > 80,
      maxClusterRadius: 56,
      spiderfyOnMaxZoom: true,
      showCoverageOnHover: false,
    }) as L.Layer & { addLayer: (ly: L.Layer) => void; clearLayers?: () => void };

    for (const m of markers) {
      const online = m.row.pppStatus === "online";
      const marker = L.marker([m.lat, m.lng], { icon: pinIcon(online) });
      const ip =
        m.row.session?.address != null && String(m.row.session.address).trim()
          ? String(m.row.session.address)
          : "—";
      const login = m.row.username || "—";
      const statusLabel = online ? "Conexões ativas" : "Sem conexão ativa";
      const name = escapeHtml(m.row.fullName || "Cliente");
      const href = `/monitoramento/clientes-on-off/${encodeURIComponent(m.row.clientId)}?from=map`;
      const html = `
        <div style="min-width:200px;font-family:system-ui,sans-serif;color:#0f172a;padding:4px 0">
          <p style="margin:0 0 8px;font-weight:600;font-size:14px;line-height:1.25">${name}</p>
          <p style="margin:0 0 6px;font-size:12px"><span style="color:#64748b;font-weight:500">Estado:</span>
            <span style="font-weight:600;color:${online ? "#047857" : "#be123c"}">${statusLabel}</span></p>
          <p style="margin:0 0 4px;font-size:12px;color:#475569"><span style="font-weight:500">Login:</span>
            <span style="font-family:ui-monospace,monospace">${escapeHtml(login)}</span></p>
          <p style="margin:0 0 4px;font-size:12px;color:#475569"><span style="font-weight:500">IP:</span>
            <span style="font-family:ui-monospace,monospace">${escapeHtml(ip)}</span></p>
          <p style="margin:0 0 10px;font-size:11px;color:#64748b">Servidor: <strong style="color:#334155">${escapeHtml(m.serverName)}</strong></p>
          <a href="${href}" style="display:block;text-align:center;padding:6px 10px;border:1px solid #e2e8f0;border-radius:6px;font-size:12px;font-weight:600;color:#0f172a;text-decoration:none">Ver cliente</a>
        </div>`;
      marker.bindPopup(html, { minWidth: 220, className: "monitoring-cluster-popup" });
      mcg.addLayer(marker);
    }

    map.addLayer(mcg);

    return () => {
      map.removeLayer(mcg);
    };
  }, [map, markers]);

  return null;
}
