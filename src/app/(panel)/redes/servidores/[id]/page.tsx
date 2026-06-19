"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { usePanelIsAdmin } from "@/hooks/use-panel-is-admin";
import {
  Activity,
  AlertCircle,
  ArrowLeft,
  ClipboardCopy,
  Cpu,
  Download,
  FileJson,
  HardDrive,
  History,
  Loader2,
  Network,
  RefreshCw,
  Server,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Modal } from "@/components/ui/modal";
import { cn } from "@/lib/cn";
import { apiFetch, ApiRequestError } from "@/lib/api-client";
import type { MikrotikServerMonitoringDetailFromApi } from "@/lib/api-types";
import { ServerFormModal } from "../_components/server-form-modal";
import { ServerConnectionScriptModal } from "../_components/server-connection-script-modal";
import { ServerAlertsPanel } from "../_components/server-alerts-panel";
import { ServerInterfacesTable } from "../_components/server-interfaces-table";
import { ServerPppSessionsTable } from "../_components/server-ppp-sessions-table";
import { ServerSnapshotHistory } from "../_components/server-snapshot-history";

const FETCH_TIMEOUT_MS = 90_000;

function formatPtDate(iso: string | null): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
  } catch {
    return "—";
  }
}

function bytesToGiB(b: number): number {
  if (!Number.isFinite(b) || b <= 0) return 0;
  return Math.round((b / 1024 ** 3) * 100) / 100;
}

function parseCounter(s: string | null | undefined): number {
  if (s == null || s === "") return 0;
  const n = Number(String(s).replace(/\s/g, ""));
  return Number.isFinite(n) ? n : 0;
}

function normalizeDetailPayload(row: MikrotikServerMonitoringDetailFromApi): MikrotikServerMonitoringDetailFromApi {
  return {
    ...row,
    alerts: row.alerts ?? [],
    recentSnapshots: row.recentSnapshots ?? [],
    activePppSessions: row.activePppSessions ?? [],
    activePppSessionsTotal: row.activePppSessionsTotal ?? 0,
    activePppSessionsTruncated: row.activePppSessionsTruncated ?? false,
    networkNode: row.networkNode ?? null,
  };
}

function buildExecutiveSummary(d: MikrotikServerMonitoringDetailFromApi): string {
  const lines = [
    `Servidor: ${d.name} (${d.id})`,
    d.networkNode ? `POP/Node: ${d.networkNode.name} (${d.networkNode.code})` : "POP/Node: —",
    `Online: ${d.online ? "sim" : "não"}`,
    `Host: ${d.host}:${d.port ?? 8728}`,
    `Identidade ROS: ${d.identityName ?? "—"}`,
    `Versão: ${d.version ?? "—"}`,
    `Uptime: ${d.uptime ?? "—"}`,
    `CPU: ${d.cpuPercent != null ? `${Math.round(d.cpuPercent)}%` : "—"}`,
    `Clientes (cadastro): ${d.totalClients}`,
    `PPP secrets: ${d.pppSecretCount != null ? d.pppSecretCount : "—"}`,
    `PPP activas: ${d.activePppSessionsTotal ?? 0}${d.activePppSessionsTruncated ? " (lista truncada)" : ""}`,
    `Última verificação: ${d.lastPolledAt ?? "—"}`,
    `Última atualização de rede: ${d.lastSyncAt ?? "—"} (${d.lastJobStatus ?? "—"})`,
    `Alertas: ${(d.alerts ?? []).length}`,
  ];
  if (d.lastError) lines.push(`Erro: ${d.lastError}`);
  return lines.join("\n");
}

function MetricMini({
  label,
  value,
  sub,
  icon: Icon,
  barPct,
  barClass,
}: {
  label: string;
  value: string;
  sub?: string;
  icon: typeof Cpu;
  barPct?: number;
  barClass?: string;
}) {
  return (
    <Card className="border-slate-200/95 shadow-sm ring-1 ring-slate-900/[0.035]">
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500">{label}</p>
            <p className="mt-1 text-lg font-semibold tabular-nums text-slate-900">{value}</p>
            {sub ? <p className="mt-0.5 text-[11px] text-slate-500">{sub}</p> : null}
          </div>
          <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200/90 bg-slate-50 text-slate-600">
            <Icon className="h-4 w-4" aria-hidden />
          </div>
        </div>
        {barPct != null ? (
          <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-slate-200/90">
            <div
              className={cn("h-full rounded-full", barClass || "bg-slate-500/80")}
              style={{ width: `${Math.min(100, Math.max(0, barPct))}%` }}
            />
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

export default function ServidorDetalhePage() {
  const isAdminUser = usePanelIsAdmin();
  const params = useParams();
  const id = typeof params.id === "string" ? params.id : "";
  const [data, setData] = useState<MikrotikServerMonitoringDetailFromApi | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [checkHint, setCheckHint] = useState<string | null>(null);
  const [jsonOpen, setJsonOpen] = useState(false);
  const [copyHint, setCopyHint] = useState<string | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [scriptOpen, setScriptOpen] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    setCheckHint(null);
    try {
      const row = await apiFetch<MikrotikServerMonitoringDetailFromApi>(
        `/mikrotik/servers/${encodeURIComponent(id)}/monitoring?timeoutMs=15000`,
        { timeoutMs: FETCH_TIMEOUT_MS },
      );
      setData(normalizeDetailPayload(row));
      setCheckHint(`Consulta concluída às ${new Date().toLocaleTimeString("pt-BR")}.`);
    } catch (e) {
      const msg =
        e instanceof ApiRequestError
          ? e.message
          : e instanceof Error
            ? e.message
            : "Falha ao carregar detalhe.";
      setError(msg);
      setData(null);
      setCheckHint(null);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  const memPct = useMemo(() => {
    if (!data?.online || data.memoryTotalBytes == null || data.memoryTotalBytes <= 0 || data.memoryFreeBytes == null) {
      return null;
    }
    const used = data.memoryTotalBytes - data.memoryFreeBytes;
    return Math.min(100, Math.round((used / data.memoryTotalBytes) * 100));
  }, [data]);

  const diskPct = useMemo(() => {
    if (!data?.online || data.diskTotalBytes == null || data.diskTotalBytes <= 0 || data.diskFreeBytes == null) {
      return null;
    }
    const used = data.diskTotalBytes - data.diskFreeBytes;
    return Math.min(100, Math.round((used / data.diskTotalBytes) * 100));
  }, [data]);

  const topTraffic = useMemo(() => {
    if (!data?.interfaces?.length) return [];
    const copy = [...data.interfaces].map((i) => ({
      iface: i,
      sum: parseCounter(i.rx ?? i.rxBytes) + parseCounter(i.tx ?? i.txBytes),
    }));
    copy.sort((a, b) => b.sum - a.sum);
    return copy.slice(0, 6);
  }, [data]);

  const maxTraffic = topTraffic[0]?.sum || 1;

  const topInterfaceNames = useMemo(() => new Set(topTraffic.map((t) => t.iface.name).filter(Boolean)), [topTraffic]);

  const exportDiagnostic = useCallback(() => {
    if (!data) return;
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `xpdcnet-diagnostico-servidor-${data.id}-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [data]);

  const copyDiagnostic = useCallback(async () => {
    if (!data || typeof navigator === "undefined" || !navigator.clipboard) return;
    try {
      await navigator.clipboard.writeText(JSON.stringify(data, null, 2));
      setCopyHint("Copiado para a área de transferência.");
      setTimeout(() => setCopyHint(null), 2500);
    } catch {
      setCopyHint("Não foi possível copiar.");
      setTimeout(() => setCopyHint(null), 2500);
    }
  }, [data]);

  const copyExecutiveSummary = useCallback(async () => {
    if (!data || typeof navigator === "undefined" || !navigator.clipboard) return;
    try {
      await navigator.clipboard.writeText(buildExecutiveSummary(data));
      setCopyHint("Resumo executivo copiado.");
      setTimeout(() => setCopyHint(null), 2500);
    } catch {
      setCopyHint("Não foi possível copiar o resumo.");
      setTimeout(() => setCopyHint(null), 2500);
    }
  }, [data]);

  if (!id) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-12 text-center text-slate-600">
        <p>Identificador inválido.</p>
        <Button asChild variant="outline" className="mt-4">
          <Link href="/redes/servidores">Voltar</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-[90rem] space-y-6 pb-10">
      <div className="flex flex-col gap-4 border-b border-slate-200/90 pb-6 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-3">
          <Button asChild variant="outline" size="sm" className="w-fit gap-2 border-slate-200 bg-white shadow-sm">
            <Link href="/redes/servidores">
              <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
              Voltar para servidores
            </Link>
          </Button>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">Redes · NOC</p>
            {loading && !data ? (
              <div className="mt-2 h-8 w-64 animate-pulse rounded bg-slate-200" />
            ) : (
              <>
                <h1 className="mt-1 text-xl font-semibold tracking-tight text-slate-900 sm:text-2xl">
                  {data?.name ?? "Servidor"}
                </h1>
                <p className="mt-1 font-mono text-sm text-slate-600">
                  {data ? `${data.host}:${data.port ?? 8728}` : "—"}
                  {data?.identityName ? (
                    <span className="ml-2 text-slate-500">· identidade {data.identityName}</span>
                  ) : null}
                </p>
                {data?.networkNode ? (
                  <p className="mt-1 text-xs text-slate-600">
                    POP/Node:{" "}
                    <span className="font-semibold text-slate-800">
                      {data.networkNode.name} ({data.networkNode.code})
                    </span>
                  </p>
                ) : data && !loading ? (
                  <p className="mt-1 text-xs text-slate-500">Sem node / POP associado no cadastro.</p>
                ) : null}
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  {data?.online ? (
                    <Badge variant="success" className="gap-1 font-semibold">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-600" aria-hidden />
                      Online
                    </Badge>
                  ) : data ? (
                    <Badge variant="error" className="border-rose-200/80 bg-rose-50 font-semibold text-rose-800">
                      Offline
                    </Badge>
                  ) : null}
                  {data?.isActive === false ? (
                    <Badge variant="warning" className="font-semibold">
                      Inactivo no cadastro
                    </Badge>
                  ) : null}
                </div>
                {checkHint && !error ? <p className="mt-2 text-xs text-slate-500">{checkHint}</p> : null}
              </>
            )}
          </div>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          <Button type="button" variant="outline" size="sm" className="border-slate-200 bg-white shadow-sm" onClick={() => setEditOpen(true)}>
            Editar cadastro
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="gap-2 border-slate-200 bg-white shadow-sm"
            onClick={() => void load()}
            disabled={loading}
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <RefreshCw className="h-4 w-4" aria-hidden />}
            Atualizar
          </Button>
        </div>
      </div>

      {error ? (
        <div
          className="flex items-start gap-3 rounded-lg border border-rose-200/90 bg-rose-50/90 px-4 py-3 text-sm text-rose-900"
          role="alert"
        >
          <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-rose-600" aria-hidden />
          <div>
            <p className="font-semibold">Erro ao carregar o servidor</p>
            <p className="mt-1">{error}</p>
            <Button type="button" variant="outline" size="sm" className="mt-3" onClick={() => void load()}>
              Tentar novamente
            </Button>
          </div>
        </div>
      ) : null}

      {loading && !data ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((k) => (
            <div key={k} className="h-28 animate-pulse rounded-xl border border-slate-100 bg-slate-100/80" />
          ))}
        </div>
      ) : null}

      {data ? (
        <>
          {data.monitoringChannel === "REMOTE_AGENT" && data.executionAgentNode ? (
            <div className="rounded-lg border border-sky-200/90 bg-sky-50/90 px-4 py-3 text-sm text-sky-950">
              <p className="font-semibold">Monitoramento via agente remoto</p>
              <p className="mt-1 text-xs text-sky-900/90">
                Canal <span className="font-mono">REMOTE_AGENT</span> · agente{" "}
                <span className="font-semibold">{data.executionAgentNode.name}</span> (
                <span className="font-mono">{data.executionAgentNode.code}</span>) · modo de execução cadastrado:{" "}
                <span className="font-mono">{data.executionMode ?? "—"}</span>
              </p>
            </div>
          ) : null}
          {data.monitoringChannel === "ERROR" ? (
            <div className="rounded-lg border border-rose-200/90 bg-rose-50/90 px-4 py-3 text-sm text-rose-950">
              <p className="font-semibold">Rota de monitoramento indisponível</p>
              <p className="mt-1 text-xs">{data.lastError ?? "Erro de encaminhamento."}</p>
            </div>
          ) : null}
            <section>
              <Card className="border-slate-200/95 bg-white shadow-sm ring-1 ring-slate-900/[0.035]">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base font-semibold text-slate-900">
                    <Server className="h-5 w-5 text-slate-500" aria-hidden />
                    Painel Executivo NOC
                  </CardTitle>
                  <CardDescription>
                    Visão rápida para monitoramento operacional do servidor.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Status</p>
                      <p className={cn("mt-2 text-lg font-bold", data.online ? "text-emerald-700" : "text-rose-700")}>
                        {data.online ? "ONLINE" : "OFFLINE"}
                      </p>
                    </div>

                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Sistema do equipamento</p>
                      <p className="mt-2 text-sm font-semibold text-slate-900">{data.version ?? "—"}</p>
                      <p className="mt-1 text-xs text-slate-500">Identidade: {data.identityName ?? "—"}</p>
                    </div>

                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Recursos</p>
                      <p className="mt-2 text-sm font-semibold text-slate-900">
                        CPU {data.cpuPercent != null ? `${Math.round(data.cpuPercent)}%` : "—"} · RAM {memPct != null ? `${memPct}%` : "—"}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        Disco {diskPct != null ? `${diskPct}% usado` : "—"}
                      </p>
                    </div>

                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">PPPoE</p>
                      <p className="mt-2 text-sm font-semibold text-slate-900">
                        Online: {(data.activePppSessionsTotal ?? 0).toLocaleString("pt-BR")}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        Secrets: {data.pppSecretCount != null ? data.pppSecretCount.toLocaleString("pt-BR") : "—"}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </section>
          <section className="space-y-3">
            <h2 className="text-sm font-semibold text-slate-900">Alertas operacionais</h2>
            <ServerAlertsPanel alerts={data.alerts ?? []} />
          </section>

          <section>
            <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-900">
              <Server className="h-4 w-4 text-slate-400" aria-hidden />
              Resumo executivo
            </h2>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <MetricMini
                label="CPU"
                value={data.online && data.cpuPercent != null ? `${Math.round(data.cpuPercent)}%` : "—"}
                icon={Cpu}
                barPct={data.online && data.cpuPercent != null ? data.cpuPercent : undefined}
                barClass="bg-emerald-600/90"
              />
              <MetricMini
                label="Memória"
                value={
                  data.online && data.memoryTotalBytes != null && data.memoryTotalBytes > 0
                    ? `${memPct ?? 0}%`
                    : "—"
                }
                sub={
                  data.online && data.memoryTotalBytes != null && data.memoryTotalBytes > 0
                    ? `${bytesToGiB(Math.max(0, (data.memoryTotalBytes ?? 0) - (data.memoryFreeBytes ?? 0)))} / ${bytesToGiB(data.memoryTotalBytes)} GiB`
                    : data.online
                      ? "Sem totais nesta consulta"
                      : undefined
                }
                icon={Activity}
                barPct={memPct ?? undefined}
                barClass="bg-slate-500/80"
              />
              <MetricMini
                label="Armazenamento"
                value={
                  data.online && data.diskTotalBytes != null && data.diskTotalBytes > 0 ? `${diskPct ?? 0}%` : "—"
                }
                sub={
                  data.online && data.diskTotalBytes != null && data.diskTotalBytes > 0
                    ? `${bytesToGiB(Math.max(0, (data.diskTotalBytes ?? 0) - (data.diskFreeBytes ?? 0)))} / ${bytesToGiB(data.diskTotalBytes)} GiB`
                    : data.online
                      ? "Sem totais nesta consulta"
                      : undefined
                }
                icon={HardDrive}
                barPct={diskPct ?? undefined}
                barClass="bg-slate-400/90"
              />
              <MetricMini
                label="Uptime"
                value={data.online && data.uptime ? data.uptime : "—"}
                sub={data.version ? `Versão ${data.version}` : undefined}
                icon={Network}
              />
            </div>
            <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Card className="border-slate-200/95 shadow-sm ring-1 ring-slate-900/[0.035]">
                <CardHeader className="pb-2 pt-4">
                  <CardTitle className="text-sm font-medium text-slate-600">Placa / hardware</CardTitle>
                  <CardDescription className="text-base font-semibold text-slate-900">{data.board ?? "—"}</CardDescription>
                </CardHeader>
              </Card>
              <Card className="border-slate-200/95 shadow-sm ring-1 ring-slate-900/[0.035]">
                <CardHeader className="pb-2 pt-4">
                  <CardTitle className="text-sm font-medium text-slate-600">Clientes (cadastro)</CardTitle>
                  <CardDescription className="flex items-center gap-2 text-base font-semibold text-slate-900">
                    <Users className="h-4 w-4 text-slate-400" aria-hidden />
                    {data.totalClients.toLocaleString("pt-BR")}
                  </CardDescription>
                </CardHeader>
              </Card>
              <Card className="border-slate-200/95 shadow-sm ring-1 ring-slate-900/[0.035]">
                <CardHeader className="pb-2 pt-4">
                  <CardTitle className="text-sm font-medium text-slate-600">PPPoE (secrets)</CardTitle>
                  <CardDescription className="text-base font-semibold text-slate-900">
                    {data.pppSecretCount != null ? data.pppSecretCount.toLocaleString("pt-BR") : "—"}
                  </CardDescription>
                </CardHeader>
              </Card>
              <Card className="border-slate-200/95 shadow-sm ring-1 ring-slate-900/[0.035]">
                <CardHeader className="pb-2 pt-4">
                  <CardTitle className="text-sm font-medium text-slate-600">Atualização da rede</CardTitle>
                  <CardDescription className="space-y-1 text-sm font-normal text-slate-800">
                    <p>
                      Última solicitação: <span className="font-semibold">{formatPtDate(data.lastSyncAt)}</span>
                    </p>
                    {data.lastJobStatus ? (
                      <p className="font-mono text-xs text-slate-600">Estado: {data.lastJobStatus}</p>
                    ) : null}
                    <p className="text-xs text-slate-500">Última verificação: {formatPtDate(data.lastPolledAt)}</p>
                  </CardDescription>
                </CardHeader>
              </Card>
            </div>
          </section>

          <section id="servidor-diagnostico-conexao">
            <h2 className="mb-3 text-sm font-semibold text-slate-900">Diagnóstico de conexão</h2>
            <Card className="border-slate-200/95 bg-gradient-to-br from-slate-50/90 to-white shadow-sm ring-1 ring-slate-900/[0.035]">
              <CardContent className="space-y-3 p-5 text-sm">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-slate-500">Ligação com o equipamento:</span>
                  {data.online ? (
                    <Badge variant="success" className="font-semibold">
                      Disponível
                    </Badge>
                  ) : (
                    <Badge variant="error" className="font-semibold">
                      Indisponível
                    </Badge>
                  )}
                </div>
                <p className="text-slate-600">
                  Consulta sob demanda (sem polling automático). Histórico recente é gravado no servidor a cada abertura
                  desta página (até 20 registos por equipamento).
                </p>
                {data.lastError ? (
                  <div className="rounded-lg border border-rose-200/80 bg-rose-50/80 px-3 py-2 text-rose-900">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-rose-800">Erro actual</p>
                    <p className="mt-1 font-mono text-xs leading-relaxed">{data.lastError}</p>
                  </div>
                ) : data.online ? (
                  <p className="text-emerald-800/90">Nenhum erro reportado na última consulta.</p>
                ) : null}
              </CardContent>
            </Card>
          </section>

          <section>
            <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-900">
              <Users className="h-4 w-4 text-slate-400" aria-hidden />
              Clientes PPP online
            </h2>
            <Card className="border-slate-200/95 shadow-sm ring-1 ring-slate-900/[0.035]">
              <CardContent className="p-5">
                <ServerPppSessionsTable
                  sessions={data.activePppSessions ?? []}
                  total={data.activePppSessionsTotal ?? 0}
                  truncated={data.activePppSessionsTruncated ?? false}
                  online={data.online}
                  serverId={id}
                />
              </CardContent>
            </Card>
          </section>

          <section>
            <h2 className="mb-3 text-sm font-semibold text-slate-900">Tráfego · top interfaces</h2>
            <Card className="border-slate-200/95 shadow-sm ring-1 ring-slate-900/[0.035]">
              <CardContent className="space-y-4 p-5">
                {!data.online || topTraffic.length === 0 ? (
                  <p className="text-sm text-slate-500">
                    Sem dados de tráfego para destacar (equipamento offline ou contadores indisponíveis).
                  </p>
                ) : (
                  <ul className="space-y-4">
                    {topTraffic.map(({ iface, sum }, idx) => {
                      const pct = Math.round((sum / maxTraffic) * 100);
                      return (
                        <li key={`${iface.name}-${idx}`} className="space-y-1.5">
                          <div className="flex flex-wrap items-center justify-between gap-2 text-[12px]">
                            <span className="font-semibold text-slate-800">{iface.name}</span>
                            <span className="font-mono tabular-nums text-slate-500">
                              Σ bytes ≈ {sum.toLocaleString("pt-BR")}
                            </span>
                          </div>
                          <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-[11px] text-slate-600">
                            <span>
                              Rx taxa: <span className="font-mono">{iface.rxRate ?? "—"}</span>
                            </span>
                            <span>
                              Tx taxa: <span className="font-mono">{iface.txRate ?? "—"}</span>
                            </span>
                            <span>
                              Rx acum.: <span className="font-mono">{iface.rx ?? iface.rxBytes ?? "—"}</span>
                            </span>
                            <span>
                              Tx acum.: <span className="font-mono">{iface.tx ?? iface.txBytes ?? "—"}</span>
                            </span>
                          </div>
                          <div className="h-2 overflow-hidden rounded-full bg-slate-200/90">
                            <div
                              className={cn(
                                "h-full rounded-full",
                                iface.running && !iface.disabled ? "bg-sky-500/85" : "bg-slate-400/70",
                              )}
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </CardContent>
            </Card>
          </section>

          <section>
            <h2 className="mb-3 text-sm font-semibold text-slate-900">Interfaces</h2>
            <ServerInterfacesTable
              interfaces={data.interfaces}
              online={data.online}
              topInterfaceNames={topInterfaceNames}
            />
          </section>

          <section>
            <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-900">
              <History className="h-4 w-4 text-slate-400" aria-hidden />
              Histórico recente
            </h2>
            <ServerSnapshotHistory rows={data.recentSnapshots ?? []} />
          </section>

          <section>
            <h2 className="mb-3 text-sm font-semibold text-slate-900">Acções operacionais</h2>
            <Card className="border-slate-200/95 border-dashed bg-slate-50/40 shadow-sm ring-1 ring-slate-900/[0.02]">
              <CardContent className="flex flex-col gap-3 p-4">
                <div className="flex flex-wrap gap-2">
                  <Button type="button" size="sm" variant="outline" onClick={() => void load()} disabled={loading}>
                    {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> : null}
                    Checar conexão
                  </Button>
                  <Button type="button" size="sm" variant="outline" onClick={exportDiagnostic}>
                    <Download className="h-3.5 w-3.5" aria-hidden />
                    Exportar diagnóstico
                  </Button>
                  <Button type="button" size="sm" variant="outline" onClick={copyExecutiveSummary}>
                    <ClipboardCopy className="h-3.5 w-3.5" aria-hidden />
                    Copiar resumo
                  </Button>
                  <Button type="button" size="sm" variant="outline" onClick={copyDiagnostic}>
                    <ClipboardCopy className="h-3.5 w-3.5" aria-hidden />
                    Copiar diagnóstico
                  </Button>
                  <Button type="button" size="sm" variant="outline" onClick={() => setJsonOpen(true)}>
                    <FileJson className="h-3.5 w-3.5" aria-hidden />
                    Ver diagnóstico
                  </Button>
                  {isAdminUser ? (
                    <Button type="button" size="sm" variant="outline" onClick={() => setScriptOpen(true)}>
                      Script de conexão
                    </Button>
                  ) : null}
                  <Button type="button" size="sm" variant="outline" disabled title="Disponível numa próxima fase">
                    Atualizar acessos dos clientes
                  </Button>
                  <Button type="button" size="sm" variant="outline" disabled title="Configuração disponível em breve">
                    Ver configuração
                  </Button>
                </div>
                {copyHint ? <p className="text-xs text-slate-600">{copyHint}</p> : null}
                {!isAdminUser ? (
                  <p className="text-xs leading-relaxed text-slate-600">
                    Apenas administradores podem gerar scripts de conexão.
                  </p>
                ) : null}
              </CardContent>
            </Card>
          </section>

          <Modal
            open={jsonOpen}
            onOpenChange={setJsonOpen}
            title="Diagnóstico do equipamento"
            description="Dados da última consulta ao servidor. Apenas leitura."
            className="max-w-3xl"
          >
            <pre className="max-h-[60vh] overflow-auto rounded-lg border border-slate-200 bg-slate-950 p-4 text-left text-[11px] leading-relaxed text-emerald-100">
              {JSON.stringify(data, null, 2)}
            </pre>
          </Modal>

          <ServerFormModal open={editOpen} onOpenChange={setEditOpen} serverId={id || null} onSaved={() => void load()} />
          {isAdminUser ? (
            <ServerConnectionScriptModal
              open={scriptOpen}
              onOpenChange={setScriptOpen}
              seed={
                data
                  ? {
                      serverId: id,
                      serverName: data.name,
                      defaultHost: data.host,
                      defaultPort: data.port ?? 8728,
                    }
                  : null
              }
            />
          ) : null}
        </>
      ) : null}
    </div>
  );
}
