"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Activity, Loader2, RefreshCw, Server } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ErrorState } from "@/components/ui/error-state";
import { apiFetch } from "@/lib/api-client";
import { userFacingApiError } from "@/lib/user-facing-api-error";
import type { MikrotikServerMonitoringDetailFromApi, MikrotikServerMonitoringRowFromApi, MikrotikServersMonitoringFromApi } from "@/lib/api-types";
import { MonitoringServerChips } from "../_components/monitoring-server-chips";
import { MonitoringTrafficServerCard } from "../_components/monitoring-traffic-server-card";

const FETCH_TIMEOUT_MS = 120_000;

function formatPtDate(iso: string | null): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
  } catch {
    return "—";
  }
}

export default function MonitoramentoTrafegoPage() {
  const [rows, setRows] = useState<MikrotikServerMonitoringRowFromApi[]>([]);
  const [generatedAt, setGeneratedAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [serverId, setServerId] = useState<string | null>(null);

  const [detail, setDetail] = useState<MikrotikServerMonitoringDetailFromApi | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const serverIdRef = useRef<string | null>(null);
  serverIdRef.current = serverId;

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiFetch<MikrotikServersMonitoringFromApi>("/mikrotik/servers/monitoring?timeoutMs=12000", {
        timeoutMs: FETCH_TIMEOUT_MS,
      });
      setGeneratedAt(data.generatedAt ?? null);
      setRows(Array.isArray(data.servers) ? data.servers : []);
    } catch (e) {
      setError(userFacingApiError(e));
      setRows([]);
      setGeneratedAt(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const chips = useMemo(
    () => rows.map((r) => ({ id: r.id, name: r.name, online: r.online })),
    [rows],
  );

  const visible = useMemo(() => {
    if (!serverId) return rows;
    return rows.filter((r) => r.id === serverId);
  }, [rows, serverId]);

  useEffect(() => {
    if (!serverId || visible.length !== 1) {
      setDetail(null);
      setDetailError(null);
      setDetailLoading(false);
      return;
    }
    const target = visible[0];
    if (!target.online) {
      setDetail(null);
      setDetailError(null);
      setDetailLoading(false);
      return;
    }

    let cancelled = false;
    setDetailLoading(true);
    setDetailError(null);
    setDetail(null);

    void (async () => {
      const fetchFor = target.id;
      try {
        const d = await apiFetch<MikrotikServerMonitoringDetailFromApi>(
          `/mikrotik/servers/${encodeURIComponent(target.id)}/monitoring?timeoutMs=12000`,
          { timeoutMs: FETCH_TIMEOUT_MS },
        );
        if (!cancelled && serverIdRef.current === fetchFor) setDetail(d);
      } catch (e) {
        if (!cancelled && serverIdRef.current === fetchFor) {
          setDetailError(userFacingApiError(e));
          setDetail(null);
        }
      } finally {
        if (!cancelled && serverIdRef.current === fetchFor) setDetailLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [serverId, visible]);

  const totals = useMemo(() => {
    let rx = 0;
    let tx = 0;
    for (const srv of visible) {
      for (const i of srv.interfaces ?? []) {
        rx += Number(String(i.rxBytes ?? "").replace(/\s/g, "")) || 0;
        tx += Number(String(i.txBytes ?? "").replace(/\s/g, "")) || 0;
      }
    }
    return { rx, tx, n: visible.length };
  }, [visible]);

  return (
    <div className="mx-auto w-full max-w-[90rem] space-y-6 pb-10">
      <header className="flex flex-col gap-4 border-b border-slate-200/90 pb-6 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">Monitoramento</p>
          <h1 className="mt-1 text-xl font-semibold tracking-tight text-slate-900 sm:text-2xl">Tráfego</h1>
          <p className="mt-2 max-w-2xl text-sm text-slate-600">
            Valores da <strong>última consulta</strong> a cada equipamento. Ao escolher um servidor, mostramos também um
            histórico leve das últimas leituras guardadas (não é monitorização contínua ao segundo).
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

      <div className="rounded-lg border border-slate-200/90 bg-slate-50/80 px-4 py-3 text-sm text-slate-800">
        <strong className="text-slate-900">Como ler esta página:</strong> as barras comparam portas entre si nesta
        leitura. Os máximos de download/upload por porta aparecem quando filtra <strong>um único</strong> servidor
        online (segunda consulta ao mesmo equipamento).
      </div>

      {error ? (
        <ErrorState title="Falha ao carregar tráfego" description={error} onRetry={() => void load()} />
      ) : null}

      {rows.length > 0 ? (
        <div className="space-y-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Servidor</p>
          <MonitoringServerChips servers={chips} value={serverId} onChange={setServerId} />
        </div>
      ) : null}

      {generatedAt && !loading ? (
        <p className="text-[11px] text-slate-500">Última consulta (lista): {formatPtDate(generatedAt)}</p>
      ) : null}

      {visible.length > 0 && !error ? (
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="flex items-center gap-2 rounded-lg border border-slate-200/90 bg-white px-4 py-3 shadow-sm">
            <Activity className="h-4 w-4 text-sky-600" aria-hidden />
            <div>
              <p className="text-[10px] font-semibold uppercase text-slate-500">Equipamentos (vista)</p>
              <p className="text-lg font-semibold tabular-nums text-slate-900">{totals.n}</p>
            </div>
          </div>
          <div className="rounded-lg border border-slate-200/90 bg-white px-4 py-3 text-xs shadow-sm">
            <p className="font-semibold uppercase text-slate-500">Total download (vista)</p>
            <p className="mt-1 font-mono text-sm text-slate-800">{totals.rx.toLocaleString("pt-BR")}</p>
          </div>
          <div className="rounded-lg border border-slate-200/90 bg-white px-4 py-3 text-xs shadow-sm">
            <p className="font-semibold uppercase text-slate-500">Total upload (vista)</p>
            <p className="mt-1 font-mono text-sm text-slate-800">{totals.tx.toLocaleString("pt-BR")}</p>
          </div>
        </div>
      ) : null}

      {loading && !rows.length ? (
        <div className="flex items-center gap-2 py-16 text-slate-600">
          <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
          A carregar equipamentos…
        </div>
      ) : null}

      {!loading && !error && rows.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/50 px-6 py-12 text-center text-slate-600">
          <Server className="mx-auto h-10 w-10 text-slate-300" aria-hidden />
          <p className="mt-3 text-sm font-semibold text-slate-800">Nenhum servidor para monitorar</p>
        </div>
      ) : null}

      <div className="space-y-8">
        {visible.map((srv) => (
          <MonitoringTrafficServerCard
            key={srv.id}
            srv={srv}
            detail={serverId === srv.id && visible.length === 1 ? detail : null}
            detailLoading={serverId === srv.id && visible.length === 1 ? detailLoading : false}
            detailError={serverId === srv.id && visible.length === 1 ? detailError : null}
            isFilterTarget={serverId === srv.id}
            recentSnapshots={serverId === srv.id && visible.length === 1 ? detail?.recentSnapshots : null}
          />
        ))}
      </div>
    </div>
  );
}
