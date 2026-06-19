"use client";

import Link from "next/link";
import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { usePanelIsAdmin } from "@/hooks/use-panel-is-admin";
import {
  Activity,
  AlertCircle,
  CheckCircle2,
  Cpu,
  HardDrive,
  Loader2,
  MoreVertical,
  Network,
  Plus,
  RefreshCw,
  Server,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/cn";
import { apiFetch, ApiRequestError } from "@/lib/api-client";
import type {
  MikrotikServersMonitoringFromApi,
  MikrotikServersMonitoringSummaryFromApi,
  MikrotikServerMonitoringRowFromApi,
  MikrotikNetworkNodeSummaryFromApi,
} from "@/lib/api-types";
import { ServerFormModal } from "./_components/server-form-modal";
import {
  ServerConnectionScriptModal,
  type ServerConnectionScriptSeed,
} from "./_components/server-connection-script-modal";

const MONITORING_FETCH_TIMEOUT_MS = 120_000;

type ServerCardView = {
  id: string;
  code: string;
  name: string;
  host: string;
  port: number;
  online: boolean;
  ip: string;
  clients: number;
  uptime: string;
  boardRos: string;
  cpuPct: number | null;
  memUsedGb: number;
  memTotalGb: number;
  diskUsedGb: number;
  diskTotalGb: number;
  hasMemMetrics: boolean;
  hasDiskMetrics: boolean;
  lastPolledAt: string | null;
  lastSyncAt: string | null;
  lastJobStatus: string | null;
  lastError: string | null;
  pppCount: number | null;
  activePppOnline: number | null;
  criticalAlertsCount: number;
  warningAlertsCount: number;
  networkNodeId: string | null;
  networkNode: MikrotikNetworkNodeSummaryFromApi | null;
  interfaces: MikrotikServerMonitoringRowFromApi["interfaces"];
};

function bytesToGiB(b: number): number {
  if (!Number.isFinite(b) || b <= 0) return 0;
  return Math.round((b / 1024 ** 3) * 100) / 100;
}

function formatPtDate(iso: string | null): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
  } catch {
    return "—";
  }
}

function rowToCardView(row: MikrotikServerMonitoringRowFromApi): ServerCardView {
  const port = row.port != null && row.port > 0 ? row.port : 8728;
  const memT = row.memoryTotalBytes;
  const memF = row.memoryFreeBytes;
  const diskT = row.diskTotalBytes;
  const diskF = row.diskFreeBytes;
  const hasMem = row.online && memT != null && memT > 0 && memF != null;
  const hasDisk = row.online && diskT != null && diskT > 0 && diskF != null;
  const memUsed = hasMem ? Math.max(0, memT - memF) : 0;
  const diskUsed = hasDisk ? Math.max(0, diskT - diskF) : 0;

  const boardParts = [row.board, row.version].filter(Boolean);
  const boardRos =
    row.online && boardParts.length > 0
      ? boardParts.join(" · ")
      : row.online
        ? "—"
        : row.board && row.version
          ? `${row.board} · ${row.version}`
          : "—";

  return {
    id: row.id,
    code: `SRV·${row.id.slice(-6)}`,
    name: row.name,
    host: row.host,
    port,
    online: row.online,
    ip: `${row.host}:${port}`,
    clients: row.totalClients,
    uptime: row.online ? row.uptime || "—" : "—",
    boardRos,
    cpuPct: row.cpuPercent,
    memUsedGb: bytesToGiB(memUsed),
    memTotalGb: hasMem ? bytesToGiB(memT) : 0,
    diskUsedGb: bytesToGiB(diskUsed),
    diskTotalGb: hasDisk ? bytesToGiB(diskT) : 0,
    hasMemMetrics: Boolean(hasMem),
    hasDiskMetrics: Boolean(hasDisk),
    lastPolledAt: row.lastPolledAt,
    lastSyncAt: row.lastSyncAt,
    lastJobStatus: row.lastJobStatus,
    lastError: row.lastError,
    pppCount: row.pppSecretCount,
    activePppOnline: row.activePppSessionsTotal != null ? row.activePppSessionsTotal : null,
    criticalAlertsCount: row.criticalAlertsCount ?? 0,
    warningAlertsCount: row.warningAlertsCount ?? 0,
    networkNodeId: row.networkNodeId ?? null,
    networkNode: row.networkNode ?? null,
    interfaces: row.interfaces || [],
  };
}

type ServerGroup = {
  key: string;
  title: string;
  node: MikrotikNetworkNodeSummaryFromApi | null;
  items: ServerCardView[];
};

function buildServerGroups(rows: ServerCardView[]): ServerGroup[] {
  const order: string[] = [];
  const map = new Map<string, ServerCardView[]>();
  for (const r of rows) {
    const key = r.networkNode?.id ?? "__none__";
    if (!map.has(key)) {
      map.set(key, []);
      order.push(key);
    }
    map.get(key)!.push(r);
  }
  return order.map((key) => {
    const items = map.get(key)!;
    const node = items[0]?.networkNode ?? null;
    const title =
      node != null ? `${node.name} · ${node.code}` : "Sem node / POP";
    return { key, title, node, items };
  });
}

function NetworkExecutiveSummary({
  summary,
  generatedAt,
}: {
  summary: MikrotikServersMonitoringSummaryFromApi | null;
  generatedAt: string | null;
}) {
  if (!summary) return null;
  const items = [
    { label: "Equipamentos", value: summary.totalServers, sub: "cadastrados" },
    { label: "Online", value: summary.onlineServers, sub: "Disponibilidade atual" },
    { label: "Offline", value: summary.offlineServers, sub: "indisponíveis" },
    { label: "Clientes vinculados", value: summary.totalClients, sub: "na rede" },
    { label: "Conexões ativas", value: summary.totalPppSessions, sub: "neste momento" },
    { label: "Alertas críticos", value: summary.criticalAlerts, sub: "soma por equipamento" },
    { label: "Alertas aviso", value: summary.warningAlerts, sub: "soma por equipamento" },
  ];
  return (
    <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
      {items.map((it) => (
        <Card
          key={it.label}
          className="border-slate-200/95 shadow-sm ring-1 ring-slate-900/[0.035]"
        >
          <CardContent className="p-4">
            <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500">{it.label}</p>
            <p className="mt-1 text-2xl font-semibold tabular-nums text-slate-900">
              {typeof it.value === "number" ? it.value.toLocaleString("pt-BR") : it.value}
            </p>
            <p className="mt-0.5 text-[11px] text-slate-500">{it.sub}</p>
            {it.label === "Servidores" && generatedAt ? (
              <p className="mt-2 border-t border-slate-100 pt-2 text-[10px] text-slate-400">
                Consulta: {formatPtDate(generatedAt)}
              </p>
            ) : null}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function ServerGroupSection({
  group,
  onEditServer,
  onScriptConnection,
  canAccessConnectionScript,
}: {
  group: ServerGroup;
  onEditServer?: (id: string) => void;
  onScriptConnection?: (seed: ServerConnectionScriptSeed) => void;
  canAccessConnectionScript: boolean;
}) {
  const online = group.items.filter((s) => s.online).length;
  const offline = group.items.length - online;
  const clients = group.items.reduce((a, s) => a + s.clients, 0);
  const pppSum = group.items.reduce((a, s) => a + (s.activePppOnline ?? 0), 0);
  return (
    <section className="space-y-3">
      <div className="flex flex-col gap-2 rounded-xl border border-slate-200/90 bg-gradient-to-r from-slate-50/95 to-white px-4 py-3 shadow-sm ring-1 ring-slate-900/[0.02] sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-sm font-semibold text-slate-900">{group.title}</h3>
          {group.node ? (
            <p className="text-[11px] text-slate-500">
              Tipo {group.node.type} · estado {group.node.status}
            </p>
          ) : (
            <p className="text-[11px] text-slate-500">Equipamentos sem agrupamento de node no cadastro</p>
          )}
        </div>
        <dl className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-slate-600">
          <div>
            <dt className="inline font-medium text-slate-500">Servidores: </dt>
            <dd className="inline font-semibold text-slate-800">{group.items.length}</dd>
          </div>
          <div>
            <dt className="inline font-medium text-emerald-700">Online: </dt>
            <dd className="inline font-semibold tabular-nums">{online}</dd>
          </div>
          <div>
            <dt className="inline font-medium text-rose-700">Offline: </dt>
            <dd className="inline font-semibold tabular-nums">{offline}</dd>
          </div>
          <div>
            <dt className="inline font-medium text-slate-500">Clientes: </dt>
            <dd className="inline font-semibold tabular-nums">{clients.toLocaleString("pt-BR")}</dd>
          </div>
          <div>
            <dt className="inline font-medium text-slate-500">PPP activas: </dt>
            <dd className="inline font-semibold tabular-nums">{pppSum.toLocaleString("pt-BR")}</dd>
          </div>
        </dl>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {group.items.map((s) => (
          <ServerCard
            key={s.id}
            s={s}
            onEditServer={onEditServer}
            onScriptConnection={onScriptConnection}
            canAccessConnectionScript={canAccessConnectionScript}
          />
        ))}
      </div>
    </section>
  );
}

const CARD_MENU_ACTIONS = [
  "Editar",
  "Localização",
  "Checar conexão",
  "Roteiro de conexão",
  "Reiniciar",
  "Atualização da rede",
  "Importação",
  "Exportação",
  "Atualizar acessos dos clientes",
  "Migrar clientes",
] as const;

function ServerCard({
  s,
  onEditServer,
  onScriptConnection,
  canAccessConnectionScript,
}: {
  s: ServerCardView;
  onEditServer?: (id: string) => void;
  onScriptConnection?: (seed: ServerConnectionScriptSeed) => void;
  canAccessConnectionScript: boolean;
}) {
  const memPct =
    s.hasMemMetrics && s.memTotalGb > 0
      ? Math.min(100, Math.round((s.memUsedGb / s.memTotalGb) * 100))
      : 0;
  const diskPct =
    s.hasDiskMetrics && s.diskTotalGb > 0
      ? Math.min(100, Math.round((s.diskUsedGb / s.diskTotalGb) * 100))
      : 0;
  const cpuDisplay = s.online && s.cpuPct != null ? `${Math.round(s.cpuPct)}%` : "—";
  const critical = s.criticalAlertsCount > 0;

  return (
    <Card
      className={cn(
        "overflow-hidden border-slate-200/95 shadow-sm ring-1 ring-slate-900/[0.035]",
        critical && "ring-2 ring-rose-300/90",
      )}
    >
      <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0 pb-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <CardTitle className="truncate text-base font-semibold text-slate-900">{s.name}</CardTitle>
            {s.online ? (
              <Badge variant="success" className="shrink-0 gap-1 font-semibold">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-600" aria-hidden />
                Online
              </Badge>
            ) : (
              <Badge
                variant="error"
                className="shrink-0 border-rose-200/80 bg-rose-50 font-semibold text-rose-800"
              >
                Offline
              </Badge>
            )}
            {critical ? (
              <Badge
                variant="error"
                className="shrink-0 border-rose-200/80 bg-rose-50 text-[10px] font-semibold uppercase tracking-wide text-rose-900"
              >
                {s.criticalAlertsCount} crít.
              </Badge>
            ) : null}
            {!critical && s.warningAlertsCount > 0 ? (
              <Badge variant="warning" className="shrink-0 text-[10px] font-semibold uppercase tracking-wide">
                {s.warningAlertsCount} aviso
              </Badge>
            ) : null}
          </div>
          <CardDescription className="mt-1 font-mono text-[11px] tracking-wide text-slate-500">
            {s.code}
          </CardDescription>
        </div>
        <div className="flex shrink-0 items-start gap-2">
          <Button asChild variant="outline" size="sm" className="h-8 border-slate-200 bg-white px-2.5 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50">
            <Link href={`/redes/servidores/${s.id}`}>Ver detalhes</Link>
          </Button>
          <ServerCardActions
            serverId={s.id}
            serverName={s.name}
            host={s.host}
            port={s.port}
            onEditServer={onEditServer}
            onScriptConnection={onScriptConnection}
            canAccessConnectionScript={canAccessConnectionScript}
          />
        </div>
      </CardHeader>
      <CardContent className="space-y-4 pt-0">
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500">Endereço / acesso</p>
            <p className="mt-0.5 font-mono text-sm font-medium text-slate-800">{s.ip}</p>
          </div>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500">Clientes (cadastro)</p>
            <p className="mt-0.5 flex items-center gap-1.5 font-semibold tabular-nums text-slate-900">
              <Users className="h-3.5 w-3.5 text-slate-400" aria-hidden />
              {s.clients.toLocaleString("pt-BR")}
            </p>
          </div>
          {s.pppCount != null ? (
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500">PPPoE (secrets)</p>
              <p className="mt-0.5 font-semibold tabular-nums text-slate-900">{s.pppCount.toLocaleString("pt-BR")}</p>
            </div>
          ) : (
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500">PPPoE (secrets)</p>
              <p className="mt-0.5 text-slate-500">—</p>
            </div>
          )}
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500">PPP online</p>
            <p className="mt-0.5 font-semibold tabular-nums text-slate-900">
              {s.activePppOnline != null ? s.activePppOnline.toLocaleString("pt-BR") : "—"}
            </p>
          </div>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500">Uptime</p>
            <p className="mt-0.5 font-medium tabular-nums text-slate-800">{s.uptime}</p>
          </div>
          <div className="col-span-2">
            <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500">Placa / ROS</p>
            <p className="mt-0.5 truncate text-slate-800" title={s.boardRos}>
              {s.boardRos}
            </p>
          </div>
        </div>

        <div className="rounded-lg border border-slate-100 bg-slate-50/90 px-3 py-2 text-[11px] text-slate-600">
          <p className="font-semibold uppercase tracking-[0.06em] text-slate-500">Última comunicação</p>
          <p className="mt-1">
            <span className="text-slate-500">Última verificação: </span>
            <span className="font-medium text-slate-800">{formatPtDate(s.lastPolledAt)}</span>
          </p>
          <p className="mt-0.5">
            <span className="text-slate-500">Última atualização: </span>
            <span className="font-medium text-slate-800">{formatPtDate(s.lastSyncAt)}</span>
            {s.lastJobStatus ? (
              <span className="ml-1.5 rounded bg-white/80 px-1.5 py-0.5 font-mono text-[10px] text-slate-600 ring-1 ring-slate-200/80">
                {s.lastJobStatus}
              </span>
            ) : null}
          </p>
          {!s.online && s.lastError ? (
            <p className="mt-2 line-clamp-3 text-rose-800" title={s.lastError}>
              {s.lastError}
            </p>
          ) : null}
        </div>

        <div className="space-y-2 rounded-lg border border-slate-100 bg-slate-50/80 p-3">
          <div className="flex items-center justify-between text-[11px]">
            <span className="flex items-center gap-1.5 font-semibold text-slate-600">
              <Cpu className="h-3.5 w-3.5 text-slate-400" aria-hidden />
              CPU
            </span>
            <span className="tabular-nums font-semibold text-slate-900">{cpuDisplay}</span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-slate-200/90">
            <div
              className={cn("h-full rounded-full bg-emerald-600/90", !s.online || s.cpuPct == null ? "w-0" : "")}
              style={
                s.online && s.cpuPct != null ? { width: `${Math.min(100, Math.max(0, s.cpuPct))}%` } : undefined
              }
            />
          </div>

          <div className="flex items-center justify-between text-[11px] pt-1">
            <span className="flex items-center gap-1.5 font-semibold text-slate-600">
              <Activity className="h-3.5 w-3.5 text-slate-400" aria-hidden />
              Memória
            </span>
            <span className="tabular-nums text-slate-800">
              {s.hasMemMetrics ? `${s.memUsedGb} / ${s.memTotalGb} GiB` : s.online ? "Sem dados nesta versão" : "—"}
            </span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-slate-200/90">
            <div
              className="h-full rounded-full bg-slate-500/80"
              style={{ width: s.hasMemMetrics ? `${memPct}%` : "0%" }}
            />
          </div>

          <div className="flex items-center justify-between text-[11px] pt-1">
            <span className="flex items-center gap-1.5 font-semibold text-slate-600">
              <HardDrive className="h-3.5 w-3.5 text-slate-400" aria-hidden />
              Armazenamento
            </span>
            <span className="tabular-nums text-slate-800">
              {s.hasDiskMetrics ? `${s.diskUsedGb} / ${s.diskTotalGb} GiB` : s.online ? "Sem dados nesta versão" : "—"}
            </span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-slate-200/90">
            <div
              className="h-full rounded-full bg-slate-400/90"
              style={{ width: s.hasDiskMetrics ? `${diskPct}%` : "0%" }}
            />
          </div>
        </div>

        <div className="rounded-lg border border-slate-100 bg-white/90 p-3">
          <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500">Interfaces em execução</p>
          {s.online && s.interfaces.length > 0 ? (
            <div className="mt-2 max-h-32 overflow-auto text-[11px]">
              <table className="w-full border-collapse text-left">
                <thead>
                  <tr className="border-b border-slate-100 text-slate-500">
                    <th className="py-1 pr-2 font-medium">Nome</th>
                    <th className="py-1 font-mono font-medium">RX</th>
                    <th className="py-1 pl-2 font-mono font-medium">TX</th>
                  </tr>
                </thead>
                <tbody>
                  {s.interfaces.slice(0, 8).map((iface, idx) => (
                    <tr key={`${iface.name}-${idx}`} className="border-b border-slate-50 text-slate-700">
                      <td className="py-1 pr-2 font-medium">{iface.name || "—"}</td>
                      <td className="py-1 font-mono tabular-nums text-slate-600">{iface.rxBytes ?? "—"}</td>
                      <td className="py-1 pl-2 font-mono tabular-nums text-slate-600">{iface.txBytes ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="mt-2 text-xs text-slate-500">
              {s.online ? "Sem dados nesta versão" : "Equipamento offline — sem leitura de interfaces."}
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

const SCRIPT_MENU_LABEL = "Roteiro de conexão" as const;

function ServerCardActions({
  serverId,
  serverName,
  host,
  port,
  onEditServer,
  onScriptConnection,
  canAccessConnectionScript,
}: {
  serverId: string;
  serverName: string;
  host: string;
  port: number;
  onEditServer?: (id: string) => void;
  onScriptConnection?: (seed: ServerConnectionScriptSeed) => void;
  canAccessConnectionScript: boolean;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const menuId = useId();

  const menuActions = useMemo(
    () =>
      canAccessConnectionScript
        ? CARD_MENU_ACTIONS
        : CARD_MENU_ACTIONS.filter((l) => l !== SCRIPT_MENU_LABEL),
    [canAccessConnectionScript],
  );

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  return (
    <div className="relative shrink-0" ref={rootRef}>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="h-8 w-8 border-slate-200 bg-white p-0 text-slate-600 shadow-sm hover:bg-slate-50"
        aria-expanded={open}
        aria-haspopup="menu"
        aria-controls={menuId}
        onClick={() => setOpen((v) => !v)}
      >
        <MoreVertical className="h-4 w-4" aria-hidden />
        <span className="sr-only">Ações do servidor</span>
      </Button>
      {open ? (
        <div
          id={menuId}
          role="menu"
          className="absolute right-0 z-20 mt-1 w-52 rounded-lg border border-slate-200/95 bg-white py-1 shadow-lg ring-1 ring-slate-900/[0.06]"
        >
          {menuActions.map((label) => (
            <button
              key={label}
              type="button"
              role="menuitem"
              className="w-full px-3 py-2 text-left text-[13px] text-slate-700 transition-colors hover:bg-slate-50"
              onClick={() => {
                setOpen(false);
                if (label === "Editar") onEditServer?.(serverId);
                if (label === SCRIPT_MENU_LABEL && canAccessConnectionScript) {
                  onScriptConnection?.({
                    serverId,
                    serverName,
                    defaultHost: host,
                    defaultPort: port,
                  });
                }
              }}
            >
              {label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export default function RedesServidoresPage() {
  const isAdminUser = usePanelIsAdmin();
  const [rows, setRows] = useState<ServerCardView[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [generatedAt, setGeneratedAt] = useState<string | null>(null);
  const [summary, setSummary] = useState<MikrotikServersMonitoringSummaryFromApi | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [formServerId, setFormServerId] = useState<string | null>(null);
  const [scriptOpen, setScriptOpen] = useState(false);
  const [scriptSeed, setScriptSeed] = useState<ServerConnectionScriptSeed | null>(null);

  const groups = useMemo(() => buildServerGroups(rows), [rows]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiFetch<MikrotikServersMonitoringFromApi>(
        "/mikrotik/servers/monitoring?timeoutMs=12000",
        { timeoutMs: MONITORING_FETCH_TIMEOUT_MS },
      );
      setGeneratedAt(data.generatedAt ?? null);
      setSummary(data.summary ?? null);
      setRows((data.servers || []).map(rowToCardView));
    } catch (e) {
      const msg =
        e instanceof ApiRequestError
          ? e.message
          : e instanceof Error
            ? e.message
            : "Falha ao carregar monitoramento.";
      setError(msg);
      setRows([]);
      setGeneratedAt(null);
      setSummary(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="mx-auto w-full max-w-[90rem] space-y-6">
      <header className="flex flex-col gap-4 border-b border-slate-200/90 pb-6 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">Redes</p>
          <h1 className="mt-1 text-xl font-semibold tracking-tight text-slate-900 sm:text-2xl">
            Servidores de Rede
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-600">
            Gerencie concentradores PPPoE, MikroTik e autenticação da operação.
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="gap-2 border-slate-200 bg-white text-slate-700 shadow-sm hover:bg-slate-50"
            onClick={() => void load()}
            disabled={loading}
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <RefreshCw className="h-4 w-4" aria-hidden />}
            Atualizar
          </Button>
          <Button
            type="button"
            className="gap-2 border-0 bg-emerald-600 font-semibold text-white shadow-sm ring-1 ring-emerald-900/10 hover:bg-emerald-700"
            onClick={() => {
              setFormServerId(null);
              setFormOpen(true);
            }}
          >
            <Plus className="h-4 w-4" aria-hidden />
            Novo Servidor
          </Button>
        </div>
      </header>

      <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
        <Card className="w-full shrink-0 border-slate-200/95 shadow-sm ring-1 ring-slate-900/[0.035] lg:max-w-sm">
          <CardHeader className="pb-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200/90 bg-slate-50 shadow-[inset_0_1px_0_rgba(255,255,255,0.85)]">
              <Network className="h-5 w-5 text-slate-600" aria-hidden />
            </div>
            <CardTitle className="text-base">Visão centralizada</CardTitle>
            <CardDescription className="text-sm leading-relaxed text-slate-600">
              Este módulo concentra o inventário e o estado operacional dos equipamentos que sustentam a sua rede de
              acesso.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 pt-0 text-sm text-slate-600">
            <ul className="space-y-2.5">
              <li className="flex gap-2">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" aria-hidden />
                <span>Monitoramento centralizado de concentradores e pontos de presença.</span>
              </li>
              <li className="flex gap-2">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" aria-hidden />
                <span>Estrutura preparada para acompanhar os equipamentos e atualizar os acessos dos clientes.</span>
              </li>
              <li className="flex gap-2">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" aria-hidden />
                <span>Checagem de conexão e diagnóstico alinhados à operação comercial.</span>
              </li>
              <li className="flex gap-2">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" aria-hidden />
                <span>Importação, exportação e migração estarão disponíveis em uma próxima etapa.</span>
              </li>
            </ul>
            <p className="rounded-lg border border-slate-100 bg-slate-50/90 px-3 py-2 text-xs leading-relaxed text-slate-500">
              A lista ao lado verifica cada equipamento individualmente; uma falha isolada não impede os
              restantes cards.
            </p>
          </CardContent>
        </Card>

        <div className="min-w-0 flex-1">
          <NetworkExecutiveSummary summary={summary} generatedAt={generatedAt} />
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Server className="h-4 w-4 text-slate-400" aria-hidden />
              <h2 className="text-sm font-semibold tracking-tight text-slate-900">Inventário operacional</h2>
            </div>
            {generatedAt && !loading ? (
              <p className="text-[11px] text-slate-500">
                Leitura atualizada em: {formatPtDate(generatedAt)}
              </p>
            ) : null}
          </div>

          {error ? (
            <div
              className="mb-4 flex items-start gap-3 rounded-lg border border-rose-200/90 bg-rose-50/90 px-4 py-3 text-sm text-rose-900"
              role="alert"
            >
              <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-rose-600" aria-hidden />
              <div className="min-w-0 flex-1">
                <p className="font-semibold">Não foi possível carregar o monitoramento</p>
                <p className="mt-1 text-rose-800/95">{error}</p>
                <Button type="button" variant="outline" size="sm" className="mt-3" onClick={() => void load()}>
                  Tentar novamente
                </Button>
              </div>
            </div>
          ) : null}

          {loading ? (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {[1, 2, 3].map((k) => (
                <Card
                  key={k}
                  className="overflow-hidden border-slate-200/95 shadow-sm ring-1 ring-slate-900/[0.035]"
                >
                  <CardHeader className="space-y-2 pb-3">
                    <div className="h-5 w-3/4 animate-pulse rounded bg-slate-200" />
                    <div className="h-3 w-1/3 animate-pulse rounded bg-slate-100" />
                  </CardHeader>
                  <CardContent className="space-y-3 pt-0">
                    <div className="h-20 animate-pulse rounded-lg bg-slate-100" />
                    <div className="h-24 animate-pulse rounded-lg bg-slate-100" />
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : !error && rows.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/50 px-6 py-12 text-center">
              <Server className="mx-auto h-10 w-10 text-slate-300" aria-hidden />
              <p className="mt-3 text-sm font-semibold text-slate-800">Nenhum equipamento de rede cadastrado</p>
              <p className="mt-1 text-sm text-slate-600">
                Cadastre equipamentos de rede para que apareçam
                aqui com estado online/offline.
              </p>
            </div>
          ) : (
            <div className="space-y-10">
              {groups.map((g) => (
                <ServerGroupSection
                  key={g.key}
                  group={g}
                  onEditServer={(sid) => {
                    setFormServerId(sid);
                    setFormOpen(true);
                  }}
                  onScriptConnection={(seed) => {
                    setScriptSeed(seed);
                    setScriptOpen(true);
                  }}
                  canAccessConnectionScript={isAdminUser}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      <ServerFormModal
        open={formOpen}
        onOpenChange={setFormOpen}
        serverId={formServerId}
        onSaved={() => void load()}
      />
      {isAdminUser ? (
        <ServerConnectionScriptModal
          open={scriptOpen}
          onOpenChange={(o) => {
            setScriptOpen(o);
            if (!o) setScriptSeed(null);
          }}
          seed={scriptSeed}
        />
      ) : null}
    </div>
  );
}
