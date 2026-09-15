"use client";

import { Activity, Gauge, Server } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type {
  MikrotikServerMonitoringDetailFromApi,
  MikrotikServerMonitoringInterfaceDetailFromApi,
  MikrotikServerMonitoringInterfaceFromApi,
  MikrotikServerMonitoringRowFromApi,
  MikrotikServerSnapshotHistoryRowFromApi,
} from "@/lib/api-types";
import { MonitoringTrafficHistoryChart } from "./monitoring-traffic-history-chart";

function parseCounter(s: string | null | undefined): number {
  if (s == null || s === "") return 0;
  const n = Number(String(s).replace(/\s/g, ""));
  return Number.isFinite(n) ? n : 0;
}

type Props = {
  srv: MikrotikServerMonitoringRowFromApi;
  /** Preenchido quando há uma única máquina filtrada e o detalhe foi carregado com sucesso. */
  detail: MikrotikServerMonitoringDetailFromApi | null;
  detailLoading: boolean;
  detailError: string | null;
  /** Destaque quando o filtro de chips corresponde a este servidor. */
  isFilterTarget: boolean;
  /** Últimas leituras persistidas (detalhe do servidor). */
  recentSnapshots?: MikrotikServerSnapshotHistoryRowFromApi[] | null;
};

function detailByMatchKey(
  detail: MikrotikServerMonitoringDetailFromApi | null,
): Map<string, MikrotikServerMonitoringInterfaceDetailFromApi> {
  const m = new Map<string, MikrotikServerMonitoringInterfaceDetailFromApi>();
  if (!detail?.interfaces?.length) return m;
  for (const i of detail.interfaces) {
    const k = i.name != null ? String(i.name).trim().toLowerCase() : "";
    if (k) m.set(k, i);
  }
  return m;
}

export function MonitoringTrafficServerCard({
  srv,
  detail,
  detailLoading,
  detailError,
  isFilterTarget,
  recentSnapshots,
}: Props) {
  const ifaces = Array.isArray(srv.interfaces) ? srv.interfaces : [];
  const dmap = detailByMatchKey(detail);
  const totals = ifaces.map((i) => ({
    iface: i,
    sum: parseCounter(i.rxBytes) + parseCounter(i.txBytes),
  }));
  const maxSum = Math.max(1, ...totals.map((t) => t.sum));

  const snaps = Array.isArray(recentSnapshots) ? recentSnapshots : [];

  return (
    <Card
      className={
        isFilterTarget
          ? "overflow-hidden border-sky-400/90 shadow-md ring-2 ring-sky-200/90"
          : "overflow-hidden border-slate-200/95 shadow-sm ring-1 ring-slate-900/[0.035]"
      }
    >
      <CardHeader className="border-b border-slate-100 bg-gradient-to-r from-slate-50/90 to-white">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle className="flex flex-wrap items-center gap-2 text-lg">
              <Server className="h-5 w-5 text-slate-400" aria-hidden />
              {srv.name}
            </CardTitle>
            <CardDescription className="mt-1 font-mono text-xs text-slate-600">
              {srv.host}:{srv.port ?? 8728}
              {srv.identityName ? <span className="ml-2 text-slate-500">· {srv.identityName}</span> : null}
            </CardDescription>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {srv.online ? (
              <Badge variant="success" className="font-semibold">
                Conectados
              </Badge>
            ) : (
              <Badge variant="error" className="font-semibold">
                Sem conexão
              </Badge>
            )}
            {srv.monitoringChannel ? (
              <Badge variant="outline" className="font-mono text-[10px]">
                {srv.monitoringChannel}
              </Badge>
            ) : null}
            {detailLoading ? (
              <Badge variant="outline" className="text-[10px]">
                A carregar…
              </Badge>
            ) : null}
          </div>
        </div>
        {!srv.online && srv.lastError ? <p className="mt-2 text-xs text-rose-800">{srv.lastError}</p> : null}
        {detailError ? (
          <p className="mt-2 text-xs text-amber-800" role="status">
            Não foi possível carregar os máximos por porta. A tabela abaixo continua com a última leitura resumida.
          </p>
        ) : null}
        <div className="mt-3 flex flex-wrap gap-3 text-[11px] text-slate-600">
          <span className="inline-flex items-center gap-1 rounded-md border border-slate-200/90 bg-white px-2 py-1">
            <Gauge className="h-3 w-3 text-slate-400" aria-hidden />
            Uso do servidor: {srv.cpuPercent != null ? `${Math.round(srv.cpuPercent)}%` : "—"}
          </span>
          <span className="inline-flex items-center gap-1 rounded-md border border-slate-200/90 bg-white px-2 py-1">
            Memória:{" "}
            {srv.memoryTotalBytes != null && srv.memoryFreeBytes != null
              ? `${Math.round(((srv.memoryTotalBytes - srv.memoryFreeBytes) / srv.memoryTotalBytes) * 100)}% em uso`
              : "—"}
          </span>
          {srv.uptime ? (
            <span className="inline-flex items-center gap-1 rounded-md border border-slate-200/90 bg-white px-2 py-1">
              Tempo online: <span className="font-mono text-slate-800">{srv.uptime}</span>
            </span>
          ) : null}
          {srv.version ? (
            <span className="inline-flex items-center gap-1 rounded-md border border-slate-200/90 bg-white px-2 py-1 font-mono text-slate-800">
              ROS {srv.version}
            </span>
          ) : null}
        </div>
      </CardHeader>
      <CardContent className="space-y-6 p-5">
        {snaps.length >= 2 ? <MonitoringTrafficHistoryChart snapshots={snaps} /> : null}

        <div>
          <h3 className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
            <Activity className="h-3.5 w-3.5" aria-hidden />
            Tráfego por porta nesta leitura
          </h3>
          {srv.online && totals.length > 0 ? (
            <div className="space-y-2">
              {totals.slice(0, 16).map(({ iface, sum }) => {
                const pct = Math.round((sum / maxSum) * 100);
                return (
                  <div key={iface.name} className="space-y-1">
                    <div className="flex justify-between gap-2 text-[11px] font-medium text-slate-700">
                      <span className="min-w-0 truncate" title={iface.name}>
                        {iface.name || "—"}
                      </span>
                      <span className="shrink-0 tabular-nums text-slate-500">{pct}%</span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-sky-600 to-sky-400"
                        style={{ width: `${Math.max(4, pct)}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-sm text-slate-500">Sem dados de portas nesta consulta.</p>
          )}
        </div>

        <div>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Portas</h3>
          <div className="overflow-x-auto rounded-lg border border-slate-200/90">
            <table className="w-full min-w-[640px] border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                  <th className="px-3 py-2">Porta</th>
                  <th className="px-3 py-2">Estado</th>
                  <th className="px-3 py-2 font-mono">Download</th>
                  <th className="px-3 py-2 font-mono">Upload</th>
                  <th className="px-3 py-2 font-mono">Máx. download</th>
                  <th className="px-3 py-2 font-mono">Máx. upload</th>
                </tr>
              </thead>
              <tbody>
                {ifaces.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-3 py-6 text-center text-slate-500">
                      Nenhuma porta listada nesta leitura.
                    </td>
                  </tr>
                ) : (
                  ifaces.map((i: MikrotikServerMonitoringInterfaceFromApi, idx: number) => {
                    const k = i.name != null ? String(i.name).trim().toLowerCase() : "";
                    const d = k ? dmap.get(k) : undefined;
                    const rxMax = d?.rxMax ?? null;
                    const txMax = d?.txMax ?? null;
                    return (
                      <tr key={`${i.name}-${idx}`} className="border-b border-slate-100">
                        <td className="px-3 py-2 font-medium text-slate-800">{i.name || "—"}</td>
                        <td className="px-3 py-2">
                          {i.running ? (
                            <Badge variant="success" className="text-[10px]">
                              Activa
                            </Badge>
                          ) : (
                            <Badge variant="muted" className="text-[10px]">
                              —
                            </Badge>
                          )}
                        </td>
                        <td className="px-3 py-2 font-mono text-xs text-slate-700">{i.rxBytes ?? "—"}</td>
                        <td className="px-3 py-2 font-mono text-xs text-slate-700">{i.txBytes ?? "—"}</td>
                        <td className="px-3 py-2 font-mono text-xs text-slate-700">{rxMax != null && rxMax !== "" ? rxMax : "—"}</td>
                        <td className="px-3 py-2 font-mono text-xs text-slate-700">{txMax != null && txMax !== "" ? txMax : "—"}</td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
          {!detail && srv.online && ifaces.length > 0 && !detailLoading ? (
            <p className="mt-2 text-[11px] text-slate-500">
              As colunas «Máx. download / Máx. upload» aparecem ao escolher um único servidor na barra acima (segunda
              consulta ao equipamento).
            </p>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}
