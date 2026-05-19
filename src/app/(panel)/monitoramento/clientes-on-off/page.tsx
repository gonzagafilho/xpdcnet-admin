"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertCircle, Loader2, RefreshCw, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { apiFetch, ApiRequestError } from "@/lib/api-client";
import type { MonitoringSessionBoardFromApi, MonitoringSessionBoardRowFromApi } from "@/lib/api-types";
import { MonitoringClientStatusBadge } from "../_components/monitoring-client-status-badge";
import { MonitoringServerChips } from "../_components/monitoring-server-chips";

const FETCH_TIMEOUT_MS = 120_000;

function formatPtDate(iso: string | null): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
  } catch {
    return "—";
  }
}

export default function MonitoramentoClientesOnOffPage() {
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
      setError(e instanceof ApiRequestError ? e.message : "Falha ao carregar painel.");
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

  const flatRows = useMemo(() => {
    const out: Array<{ row: MonitoringSessionBoardRowFromApi; serverName: string; serverId: string }> = [];
    for (const b of visibleBlocks) {
      for (const row of b.rows) {
        out.push({ row, serverName: b.server.name, serverId: b.server.id });
      }
    }
    return out;
  }, [visibleBlocks]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return flatRows;
    return flatRows.filter(
      (x) =>
        x.row.fullName.toLowerCase().includes(q) ||
        x.row.username.toLowerCase().includes(q) ||
        x.serverName.toLowerCase().includes(q),
    );
  }, [flatRows, search]);

  const totals = useMemo(() => {
    const t = filtered.length;
    const on = filtered.filter((x) => x.row.pppStatus === "online").length;
    return { t, on, off: t - on };
  }, [filtered]);

  return (
    <div className="mx-auto w-full max-w-[90rem] space-y-6 pb-10">
      <header className="flex flex-col gap-4 border-b border-slate-200/90 pb-6 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">Monitoramento</p>
          <h1 className="mt-1 text-xl font-semibold tracking-tight text-slate-900 sm:text-2xl">Clientes On / Off</h1>
          <p className="mt-2 max-w-2xl text-sm text-slate-600">
            Cruza o cadastro com as <strong>conexões activas</strong> lidas no concentrador. «Off» aqui significa{" "}
            <strong>sem conexão activa</strong> nesta leitura — não significa por si só que o cliente está inactivo no
            sistema.
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

      {data?.generatedAt && !loading ? (
        <p className="text-[11px] text-slate-500">Última actualização: {formatPtDate(data.generatedAt)}</p>
      ) : null}

      {chips.length > 0 ? (
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Servidor</p>
          <MonitoringServerChips servers={chips} value={serverId} onChange={setServerId} />
        </div>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-3">
        <Card className="border-slate-200/95 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-slate-600">Total (vista)</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <p className="text-2xl font-semibold tabular-nums text-slate-900">{totals.t}</p>
          </CardContent>
        </Card>
        <Card className="border-emerald-200/80 bg-emerald-50/30 shadow-sm ring-1 ring-emerald-900/[0.04]">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-emerald-900">Conexões ativas</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <p className="text-2xl font-semibold tabular-nums text-emerald-900">{totals.on}</p>
          </CardContent>
        </Card>
        <Card className="border-rose-200/80 bg-rose-50/30 shadow-sm ring-1 ring-rose-900/[0.04]">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-rose-900">Sem conexão (vista)</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <p className="text-2xl font-semibold tabular-nums text-rose-900">{totals.off}</p>
          </CardContent>
        </Card>
      </div>

      <Card className="border-slate-200/95 shadow-sm">
        <CardHeader>
          <CardTitle className="text-base">Busca</CardTitle>
          <CardDescription>Filtro local sobre nome, login ou servidor.</CardDescription>
        </CardHeader>
        <CardContent>
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Nome ou login…" className="max-w-md" />
        </CardContent>
      </Card>

      {loading && !data ? (
        <div className="flex items-center gap-2 py-16 text-slate-600">
          <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
          A carregar…
        </div>
      ) : null}

      <Card className="overflow-hidden border-slate-200/95 shadow-sm">
        <CardHeader className="border-b border-slate-100 bg-slate-50/80">
          <CardTitle className="flex items-center gap-2 text-base">
            <Users className="h-4 w-4 text-slate-500" aria-hidden />
            Clientes
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[920px] border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                  <th className="px-3 py-2.5">Estado</th>
                  <th className="px-3 py-2.5">Cliente</th>
                  <th className="px-3 py-2.5">Login</th>
                  <th className="px-3 py-2.5">Tipo</th>
                  <th className="px-3 py-2.5">Tempo online</th>
                  <th className="px-3 py-2.5">IP</th>
                  <th className="px-3 py-2.5">Servidor</th>
                  <th className="px-3 py-2.5 text-right">Ficha</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-3 py-10 text-center text-slate-500">
                      Nenhuma linha para os filtros actuais.
                    </td>
                  </tr>
                ) : (
                  filtered.map(({ row, serverName }) => (
                    <tr key={`${row.clientId}-${serverName}`} className="border-b border-slate-100 hover:bg-slate-50/80">
                      <td className="px-3 py-2">
                        <MonitoringClientStatusBadge pppStatus={row.pppStatus} />
                      </td>
                      <td className="px-3 py-2 font-medium text-slate-900">{row.fullName}</td>
                      <td className="px-3 py-2 font-mono text-xs text-slate-700">{row.username || "—"}</td>
                      <td className="px-3 py-2 text-xs uppercase text-slate-600">{row.authType}</td>
                      <td className="px-3 py-2 font-mono text-xs text-slate-700">{row.session?.uptime ?? "—"}</td>
                      <td className="px-3 py-2 font-mono text-xs text-slate-700">{row.session?.address ?? "—"}</td>
                      <td className="px-3 py-2 text-xs text-slate-600">{serverName}</td>
                      <td className="px-3 py-2 text-right">
                        <Button asChild variant="outline" size="sm" className="h-8 text-xs">
                          <Link href={`/monitoramento/clientes-on-off/${encodeURIComponent(row.clientId)}?from=onoff`}>Ver</Link>
                        </Button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
