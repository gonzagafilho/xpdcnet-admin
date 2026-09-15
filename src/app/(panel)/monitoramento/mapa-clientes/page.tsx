"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertCircle, Loader2, MapPin, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { apiFetch, ApiRequestError } from "@/lib/api-client";
import type { MonitoringMapMarker, MonitoringSessionBoardFromApi } from "@/lib/api-types";
import { MonitoringMapSidebar } from "../_components/monitoring-map-sidebar";

const FETCH_TIMEOUT_MS = 120_000;

const MonitoringMapLeaflet = dynamic(
  () => import("../_components/monitoring-map-leaflet").then((m) => m.MonitoringMapLeaflet),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-[min(70vh,560px)] items-center justify-center gap-2 rounded-xl border border-slate-200/95 bg-slate-50 text-slate-600">
        <Loader2 className="h-6 w-6 animate-spin" aria-hidden />
        A preparar mapa…
      </div>
    ),
  },
);

export default function MonitoramentoMapaClientesPage() {
  const [data, setData] = useState<MonitoringSessionBoardFromApi | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [serverId, setServerId] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const q = new URLSearchParams();
      q.set("timeoutMs", "12000");
      if (serverId) q.set("serverId", serverId);
      const payload = await apiFetch<MonitoringSessionBoardFromApi>(`/monitoring/session-board?${q.toString()}`, {
        timeoutMs: FETCH_TIMEOUT_MS,
      });
      setData(payload);
    } catch (e) {
      setError(e instanceof ApiRequestError ? e.message : "Falha ao carregar mapa.");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [serverId]);

  useEffect(() => {
    void load();
  }, [load]);

  const chips = useMemo(() => {
    if (!data?.servers?.length) return [];
    return data.servers.map((b) => ({
      id: b.server.id,
      name: b.server.name,
      online: b.server.online,
    }));
  }, [data]);

  const visibleBlocks = useMemo(() => {
    if (!data?.servers) return [];
    if (!serverId) return data.servers;
    return data.servers.filter((b) => b.server.id === serverId);
  }, [data, serverId]);

  const markers: MonitoringMapMarker[] = useMemo(() => {
    const out: MonitoringMapMarker[] = [];
    for (const b of visibleBlocks) {
      for (const row of b.rows) {
        if (!row.geo) continue;
        const q = search.trim().toLowerCase();
        if (q && !row.fullName.toLowerCase().includes(q) && !row.username.toLowerCase().includes(q)) continue;
        out.push({
          row,
          serverName: b.server.name,
          lat: row.geo.lat,
          lng: row.geo.lng,
        });
      }
    }
    return out;
  }, [visibleBlocks, search]);

  const [mapHeight, setMapHeight] = useState(560);
  useEffect(() => {
    const h = Math.min(Math.round(window.innerHeight * 0.72), 620);
    setMapHeight(h);
    const onResize = () => setMapHeight(Math.min(Math.round(window.innerHeight * 0.72), 620));
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  return (
    <div className="mx-auto w-full max-w-[90rem] space-y-6 pb-10">
      <header className="flex flex-col gap-4 border-b border-slate-200/90 pb-6 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">Monitoramento</p>
          <h1 className="mt-1 text-xl font-semibold tracking-tight text-slate-900 sm:text-2xl">Mapa de clientes</h1>
          <p className="mt-2 max-w-2xl text-sm text-slate-600">
            Só aparecem pins quando o cadastro tem coordenadas válidas (<span className="font-mono text-xs">geo.lat</span> /{" "}
            <span className="font-mono text-xs">geo.lng</span>). Verde = conexão activa na última leitura; vermelho = sem
            conexão activa ou equipamento indisponível. Os pins agrupam-se ao afastar o zoom.
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="gap-2 border-slate-200"
          onClick={() => void load()}
          disabled={loading}
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <RefreshCw className="h-4 w-4" aria-hidden />}
          Actualizar
        </Button>
      </header>

      {error ? (
        <div className="flex items-start gap-3 rounded-lg border border-rose-200/90 bg-rose-50/90 px-4 py-3 text-sm text-rose-900" role="alert">
          <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-rose-600" aria-hidden />
          <div>
            <p className="font-semibold">Erro</p>
            <p className="mt-1">{error}</p>
          </div>
        </div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="min-h-[min(70vh,620px)] lg:col-span-2">
          {loading && !data ? (
            <div className="flex h-[min(70vh,560px)] items-center justify-center gap-2 rounded-xl border border-slate-200/95 bg-slate-50 text-slate-600">
              <Loader2 className="h-6 w-6 animate-spin" aria-hidden />
              A carregar…
            </div>
          ) : markers.length > 0 ? (
            <MonitoringMapLeaflet markers={markers} height={mapHeight} />
          ) : (
            <div className="flex h-[min(70vh,560px)] flex-col items-center justify-center gap-3 rounded-xl border border-slate-200/95 bg-slate-50/80 px-6 text-center text-slate-600 shadow-sm ring-1 ring-slate-900/[0.04]">
              <MapPin className="h-12 w-12 text-slate-300" aria-hidden />
              <p className="max-w-md text-sm font-medium text-slate-800">Sem coordenadas para desenhar pins nesta vista.</p>
              <p className="max-w-lg text-xs leading-relaxed text-slate-500">
                Preencha <span className="font-mono">geo.lat</span> e <span className="font-mono">geo.lng</span> no cadastro
                do cliente. Não utilizamos geocode automático — só posições explícitas.
              </p>
            </div>
          )}
        </div>

        <MonitoringMapSidebar
          chips={chips}
          serverId={serverId}
          onServerChange={setServerId}
          visibleBlocks={visibleBlocks}
          markers={markers}
          search={search}
          onSearchChange={setSearch}
        />
      </div>
    </div>
  );
}
