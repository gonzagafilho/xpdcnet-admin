"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { io } from "socket.io-client";
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Clock3,
  Loader2,
  RefreshCw,
  ServerCrash,
  Wifi,
  WifiOff,
} from "lucide-react";


import {
  LineChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  CartesianGrid,
  XAxis,
  YAxis,
} from "recharts";

import { apiFetch, ApiRequestError } from "@/lib/api-client";

type QueueHealthResponse = {
    queue?: {
    pending?: number;
    processing?: number;
    failed?: number;
    failedRecent?: number;
    failedTotal?: number;
    stale?: number;
    oldestPending?: unknown;
    oldestProcessing?: unknown;
  };
  agents?: {
    total?: number;
    online?: number;
    offline?: number;
    onlineWindowSeconds?: number;
  };

  recovery?: {
    recentRecoveriesLastHour?: number;
  };

  status?: "ok" | "degraded";
  degraded?: boolean;

  workers?: {
    sync?: boolean;
    finance?: boolean;
    trust?: boolean;
  };
    mikrotik?: {
    pppOnline?: number;
    pppSecretCount?: number | null;
    pppActiveTotal?: number | null;
    offlineClients?: number;
    connectivityRate?: number;
    pppCollectedAt?: string | null;
    lastTelemetryAt?: string | null;
    serverId?: string | null;
    serverName?: string | null;
    cpuPercent?: number | null;
    memoryPercent?: number | null;
    memoryFreeBytes?: number | null;
    memoryTotalBytes?: number | null;
    temperature?: number | null;
    voltage?: number | null;
    interfaceCount?: number | null;
    interfaceRunning?: number | null;
    version?: string | null;
    uptime?: string | null;
    boardName?: string | null;
    cpuCount?: number | null;
    architectureName?: string | null;
  };
    commercial?: {
    expectedRevenue?: number;
    receivedRevenue?: number;
    overdueRevenue?: number;

    pendingInvoices?: number;
    paidInvoices?: number;
    overdueInvoices?: number;

    newClientsThisMonth?: number;
    cancelledClientsThisMonth?: number;
    activeClients?: number;
    blockedClients?: number;
    delinquentClients?: number;
    suspendedClients?: number;
    cancelledClients?: number;
    mrr?: number;
    averageTicket?: number;
    activePlans?: number;
  };
      network?: {
      totalLinks?: number;
      onlineLinks?: number;
      degradedLinks?: number;
      offlineLinks?: number;
      avgHealthScore?: number;
      topologyHealthLevel?: string;
      capacityTotalMbps?: number;
      trafficCurrentMbps?: number;
      saturatedLinks?: number;
      averageUtilization?: number;

      mostUtilizedLink?: {
        linkName?: string;
        utilizationPct?: number;
        totalMbps?: number;
      };

      alertedLinks?: Array<{
        linkName?: string;
        alertType?: string;
      }>;

      topLinks?: Array<{
        linkName?: string;
        totalMbps?: number;
        utilizationPct?: number;
        rxMbps?: number;
        txMbps?: number;
      }>;
    };
};

function Card({
  title,
  value,
  icon,
}: {
  title: string;
  value: string | number;
  icon: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            {title}
          </p>

          <h2 className="mt-2 text-3xl font-bold tracking-tight text-slate-900">
            {value}
          </h2>
        </div>

        <div className="rounded-xl bg-slate-100 p-3 text-slate-700">
          {icon}
        </div>
      </div>
    </div>
  );
}

export default function RedesNocPage() {
  const [data, setData] = useState<QueueHealthResponse | null>(null);

  const [loading, setLoading] = useState(true);

  const [error, setError] = useState<string | null>(null);

  const [sla, setSla] = useState<{
    availability?: string;
    uptimePercent24h?: number;
    degradedEvents24h?: number;
    criticalIncidents24h?: number;
    openIncidents?: number;
    mttrMinutes?: number;
    mtbfMinutes?: number;
  } | null>(null);


  const [, setStreamConnected] = useState(false);

  const [history, setHistory] = useState<
    Array<{
      time: string;
      pending: number;
      processing: number;
      failed: number;
      stale?: number;
      pressurePercent?: number;
      throughputPerMinute?: number;
    }>
  >([]);

  const [events, setEvents] = useState<
    Array<{
      time: string;
      level: "info" | "success" | "warning";
      message: string;
    }>
  >([
    {
      time: new Date().toLocaleTimeString(),
      level: "success",
      message: "Realtime engine online",
    },
  ]);

  const [telemetry, setTelemetry] = useState<{
    routerName?: string;
    cpuPercent?: number | null;
    memoryPercent?: number | null;
    memoryTotalBytes?: number | null;
    pppOnline?: number | null;
    rxMbps?: number | null;
    txMbps?: number | null;
    interfaceCount?: number | null;
    interfaceRunning?: number | null;
    version?: string | null;
    uptime?: string | null;
    updatedAt?: string | null;
  } | null>(null);

  const [throughputHistory, setThroughputHistory] = useState<
    Array<{
      time: string;
      rxMbps: number;
      txMbps: number;
    }>
  >([]);

  const pushEvent = useCallback((level: "info" | "success" | "warning", message: string) => {
    setEvents((prev) => [
      {
        time: new Date().toLocaleTimeString(),
        level,
        message,
      },
      ...prev,
    ].slice(0, 20));
  }, []);

  const load = useCallback(async () => {
    try {
      setError(null);

      const out = await apiFetch<QueueHealthResponse>(
        "/monitoring/queue-health",
        {
          auth: true,
          timeoutMs: 30000,
        },
      );

      setData(out);

      const slaRes = await apiFetch<{
        ok: boolean;
        sla?: {
          availability?: string;
          uptimePercent24h?: number;
          degradedEvents24h?: number;
          criticalIncidents24h?: number;
          openIncidents?: number;
          mttrMinutes?: number;
          mtbfMinutes?: number;
        };
      }>("/monitoring/noc-sla", {
        auth: true,
        timeoutMs: 30000,
      });

      setSla(slaRes.sla || null);
    } catch (e) {
      const msg =
        e instanceof ApiRequestError
          ? e.message
          : e instanceof Error
            ? e.message
            : "Falha ao carregar NOC.";

      setError(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();

    const token =
      typeof window !== "undefined"
        ? sessionStorage.getItem("dcnet_token_session")
        : null;

    if (!token) {
      return;
    }

    const base =
      process.env.NEXT_PUBLIC_API_URL ||
      "";

    const url =
      `${base}/monitoring/stream`;

    const es = new EventSource(
      url + `?token=${encodeURIComponent(token)}`
    );

    es.onopen = () => {
      setStreamConnected(true);
    };

    es.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data);

                  setData((prev) => ({
            ...(prev || {}),
            ...payload,
            queue: payload?.queue || prev?.queue,
            mikrotik: payload?.mikrotik || prev?.mikrotik,
          }));

          if (payload?.mikrotik) {
            setTelemetry({
              routerName: payload.mikrotik.serverName || undefined,
              cpuPercent: payload.mikrotik.cpuPercent ?? null,
              memoryPercent: payload.mikrotik.memoryPercent ?? null,
              memoryTotalBytes: null,
              interfaceRunning: payload.mikrotik.interfaceRunning ?? null,
              pppOnline: payload.mikrotik.pppOnline ?? null,
              rxMbps: null,
              txMbps: null,
              interfaceCount: payload.mikrotik.interfaceCount ?? null,
              version: payload.mikrotik.version ?? null,
              uptime: payload.mikrotik.uptime ?? null,
              updatedAt: payload.mikrotik.lastTelemetryAt ?? null,
            });
          }
        setEvents((prev) => {
          const next = [
            {
              time: new Date().toLocaleTimeString(),
              level:
                ((payload?.queue?.failed ?? 0) > 0
                  ? "warning"
                  : "success") as "warning" | "success",
              message:
                (payload?.queue?.failed ?? 0) > 0
                  ? "Failed jobs detectados"
                  : "Queue saudável",
            },
            ...prev,
          ];

          return next.slice(0, 10);
        });

        setHistory((prev) => {
          const next = [
            ...prev,
            {
              time: new Date().toLocaleTimeString(),
              pending: payload?.queue?.pending ?? 0,
              processing: payload?.queue?.processing ?? 0,
              failed: payload?.queue?.failed ?? 0,
            },
          ];

          return next.slice(-20);
        });

        setLoading(false);

        setError(null);
      } catch (err) {
        console.error(err);
      }
    };

    es.onerror = () => {
      setStreamConnected(false);
    };

    return () => {
      es.close();
    };
  }, [load]);

  useEffect(() => {
    const base = (process.env.NEXT_PUBLIC_API_URL || "")
      .replace(/\/api\/?$/, "")
      .replace(/\/$/, "");

    if (!base) return;

    const socket = io(base, {
      path: "/socket.io",
      transports: ["websocket", "polling"],
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1200,
    });

    socket.on("connect", () => {
      pushEvent("success", "Socket.IO live conectado");
    });

    socket.on("disconnect", () => {
      pushEvent("warning", "Socket.IO desconectado; SSE segue como fallback");
    });

    socket.on("realtime:ready", () => {
      pushEvent("success", "Realtime core pronto");
    });

    socket.on("noc.event", (event: { severity?: string; message?: string; title?: string }) => {
      const severity = event?.severity === "warning" ? "warning" : event?.severity === "success" ? "success" : "info";
      const message = event?.message || event?.title || "Evento operacional recebido";

      pushEvent(severity, message);
    });

    socket.on("command:update", (event: { kind?: string; status?: string }) => {
      const kind = event?.kind || "COMMAND";
      const status = event?.status || "updated";
      const level = status === "failed" ? "warning" : status === "done" ? "success" : "info";

      pushEvent(level, `${kind} ${status}`);
    });

    socket.on("telemetry.metric", (event: {
      message?: string;
      routerName?: string;
      cpuPercent?: number | null;
      memoryPercent?: number | null;
      memoryTotalBytes?: number | null;
      pppOnline?: number | null;
      rxMbps?: number | null;
      txMbps?: number | null;
      interfaceCount?: number | null;
      interfaceRunning?: number | null;
      version?: string | null;
      uptime?: string | null;
    }) => {

      setTelemetry({
        routerName: event?.routerName || "RouterOS",
        cpuPercent: event?.cpuPercent ?? null,
        memoryPercent: event?.memoryPercent ?? null,
        memoryTotalBytes: event?.memoryTotalBytes ?? null,
        pppOnline: event?.pppOnline ?? null,
        rxMbps: event?.rxMbps ?? null,
        txMbps: event?.txMbps ?? null,
        interfaceCount: event?.interfaceCount ?? null,
        version: event?.version ?? null,
        uptime: event?.uptime ?? null,
        updatedAt: new Date().toLocaleTimeString(),
      });

      setThroughputHistory((prev) => [
        ...prev,
        {
          time: new Date().toLocaleTimeString(),
          rxMbps: Number(event?.rxMbps ?? 0),
          txMbps: Number(event?.txMbps ?? 0),
        },
      ].slice(-30));

      setThroughputHistory((prev) => [
        ...prev,
        {
          time: new Date().toLocaleTimeString(),
          rxMbps: Number(event?.rxMbps ?? 0),
          txMbps: Number(event?.txMbps ?? 0),
        },
      ].slice(-30));

      pushEvent(
        "info",
        event?.message || "Telemetria RouterOS recebida"
      );
    });

    socket.on("telemetry.alert", (event: { message?: string }) => {
      pushEvent("warning", event?.message || "Alerta de telemetria RouterOS");
    });

    return () => {
      socket.disconnect();
    };
  }, [pushEvent]);

  const severity = useMemo(() => {
    const stale = data?.queue?.stale ?? 0;
    const offlineAgents = data?.agents?.offline ?? 0;
    const backendDegraded = data?.status === "degraded" || Boolean(data?.degraded);

    if (offlineAgents > 0 && stale > 0) return "critical";
    if (stale > 0) return "degraded";
    if (backendDegraded) return "warning";
    return "healthy";
  }, [data]);

  const degraded = severity !== "healthy";

  return (
    <div className="mx-auto w-full max-w-[95rem] space-y-6 pb-10">

      <div className="flex flex-col gap-4 border-b border-slate-200 pb-6 sm:flex-row sm:items-center sm:justify-between">

        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">
            Redes / NOC
          </p>

          <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900">
            NOC Realtime
          </h1>

          <p className="mt-2 text-sm text-slate-600">
            Observabilidade operacional da fila distribuída XPDCNET.
          </p>
        </div>

        <button
          onClick={() => void load()}
          className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium shadow-sm transition hover:bg-slate-50"
        >
          <RefreshCw className="h-4 w-4" />
          Atualizar
        </button>
      </div>

      {degraded ? (
        <div className="flex items-center gap-3 rounded-2xl border border-amber-300 bg-amber-50 px-5 py-4 text-amber-900">
          <AlertTriangle className="h-5 w-5" />

          <div>
            <p className="font-semibold">
              Sistema em estado degradado
            </p>

            <p className="text-sm opacity-80">
              Detectada pressão operacional na fila distribuída.
            </p>
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-3 rounded-2xl border border-emerald-300 bg-emerald-50 px-5 py-4 text-emerald-900">
          <CheckCircle2 className="h-5 w-5" />

          <div>
            <p className="font-semibold">
              Operação estável
            </p>

            <p className="text-sm opacity-80">
              Nenhum estado degradado detectado.
            </p>
          </div>
        </div>
      )}

      {error ? (
        <div className="rounded-2xl border border-rose-300 bg-rose-50 px-5 py-4 text-rose-900">
          {error}
        </div>
      ) : null}

      {loading && !data ? (
        <div className="flex items-center gap-3 text-slate-600">
          <Loader2 className="h-5 w-5 animate-spin" />
          Carregando NOC realtime...
        </div>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">

        <Card
          title="Uptime 24h"
          value={`${sla?.uptimePercent24h ?? 100}%`}
          icon={<CheckCircle2 className="h-6 w-6" />}
        />

        <Card
          title="Availability"
          value={String(sla?.availability || "healthy").toUpperCase()}
          icon={<Activity className="h-6 w-6" />}
        />

        <Card
          title="MTTR (min)"
          value={sla?.mttrMinutes ?? 0}
          icon={<RefreshCw className="h-6 w-6" />}
        />

        <Card
          title="MTBF (min)"
          value={sla?.mtbfMinutes ?? 0}
          icon={<Clock3 className="h-6 w-6" />}
        />

      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">


          <Card
            title="CPU RouterOS"
            value={data?.mikrotik?.cpuPercent != null ? `${data.mikrotik.cpuPercent}%` : "—"}
            icon={<Activity className="h-6 w-6" />}
          />

          <Card
            title="RAM Usada"
             value={
              data?.mikrotik?.memoryPercent != null
                ? `${Number(data.mikrotik.memoryPercent).toFixed(0)}%`
                : "—"
            } 
            icon={<ServerCrash className="h-6 w-6" />}
          />

          <Card
            title="Clientes Online"
            value={data?.mikrotik?.pppActiveTotal ?? telemetry?.pppOnline ?? data?.mikrotik?.pppOnline ?? "—"}
            icon={<Wifi className="h-6 w-6" />}
          />

          <Card
            title="Clientes Cadastrados"
            value={data?.mikrotik?.pppSecretCount ?? "—"}
            icon={<Activity className="h-6 w-6" />}
          />
          <Card
            title="Clientes Offline"
            value={data?.mikrotik?.offlineClients ?? 0}
            icon={<WifiOff className="h-6 w-6" />}
          />

          <Card
             title="Conectividade"
             value={`${data?.mikrotik?.connectivityRate ?? 0}%`}
             icon={<CheckCircle2 className="h-6 w-6" />}
          />

          <Card
            title="Interfaces"
            value={
              data?.mikrotik?.interfaceRunning != null && data?.mikrotik?.interfaceCount != null
                ? `${data.mikrotik.interfaceRunning}/${data.mikrotik.interfaceCount}`
                : "—"
            }
            icon={<Activity className="h-6 w-6" />}
          />
        </div>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">

          <Card
            title="Clientes Ativos"
            value={data?.commercial?.activeClients ?? 0}
            icon={<Wifi className="h-6 w-6" />}
          />

          <Card
           title="Clientes Bloqueados"
           value={data?.commercial?.blockedClients ?? 0}
           icon={<AlertTriangle className="h-6 w-6" />}
          />

          <Card
            title="Inadimplentes"
            value={data?.commercial?.delinquentClients ?? 0}
            icon={<ServerCrash className="h-6 w-6" />}
          />

          <Card
            title="Planos Ativos"
            value={data?.commercial?.activePlans ?? 0}
            icon={<Activity className="h-6 w-6" />}
          />

        </div>

        <div className="grid gap-4 md:grid-cols-2">

          <Card
             title="MRR"
             value={`R$ ${(data?.commercial?.mrr ?? 0).toFixed(2)}`}
             icon={<CheckCircle2 className="h-6 w-6" />}
          />

           <Card
              title="Ticket Médio"
              value={`R$ ${(data?.commercial?.averageTicket ?? 0).toFixed(2)}`}
              icon={<Activity className="h-6 w-6" />}
            />
        <div className="grid gap-4 md:grid-cols-3">

          <Card
            title="Receita Prevista"
            value={`R$ ${(data?.commercial?.expectedRevenue ?? 0).toFixed(2)}`}
            icon={<CheckCircle2 className="h-6 w-6" />}
            />

          <Card
            title="Receita Recebida"
            value={`R$ ${(data?.commercial?.receivedRevenue ?? 0).toFixed(2)}`}
            icon={<Activity className="h-6 w-6" />}
          />

          <Card
            title="Receita Vencida"
            value={`R$ ${(data?.commercial?.overdueRevenue ?? 0).toFixed(2)}`}
            icon={<AlertTriangle className="h-6 w-6" />}
          />

        </div>

        <div className="grid gap-4 md:grid-cols-3">

          <Card
            title="Faturas Pendentes"
            value={data?.commercial?.pendingInvoices ?? 0}
            icon={<Clock3 className="h-6 w-6" />}
          />

          <Card
            title="Faturas Pagas"
            value={data?.commercial?.paidInvoices ?? 0}
            icon={<CheckCircle2 className="h-6 w-6" />}
          />

          <Card
            title="Faturas Vencidas"
            value={data?.commercial?.overdueInvoices ?? 0}
            icon={<ServerCrash className="h-6 w-6" />}
          />

        </div>

        <div className="grid gap-4 md:grid-cols-2">

          <Card
            title="Novos Clientes"
            value={data?.commercial?.newClientsThisMonth ?? 0}
            icon={<Wifi className="h-6 w-6" />}
          />

          <Card
            title="Cancelamentos"
            value={data?.commercial?.cancelledClientsThisMonth ?? 0}
            icon={<WifiOff className="h-6 w-6" />}
          />

        </div>
                  <div className="grid gap-4 md:grid-cols-3">

            <Card
              title="Health Score"
              value={`${data?.network?.avgHealthScore ?? 100}%`}
              icon={<CheckCircle2 className="h-6 w-6" />}
            />

            <Card
              title="Nível Topologia"
              value={String(data?.network?.topologyHealthLevel || "healthy").toUpperCase()}
              icon={<Activity className="h-6 w-6" />}
            />

            <Card
              title="Total Links"
              value={data?.network?.totalLinks ?? 0}
              icon={<Wifi className="h-6 w-6" />}
            />

          </div>

          <div className="grid gap-4 md:grid-cols-3">

            <Card
              title="Links Online"
              value={data?.network?.onlineLinks ?? 0}
              icon={<CheckCircle2 className="h-6 w-6" />}
            />

            <Card
              title="Links Degradados"
              value={data?.network?.degradedLinks ?? 0}
              icon={<AlertTriangle className="h-6 w-6" />}
            />

            <Card
              title="Links Offline"
              value={data?.network?.offlineLinks ?? 0}
              icon={<WifiOff className="h-6 w-6" />}
            />

          </div>
        <div className="grid gap-4 md:grid-cols-3">

            <Card
              title="Utilização Média"
              value={`${data?.network?.averageUtilization ?? 0}%`}
              icon={<Activity className="h-6 w-6" />}
            />

            <Card
              title="Links em Alerta"
              value={data?.network?.alertedLinks?.length ?? 0}
              icon={<AlertTriangle className="h-6 w-6" />}
            />

            <Card
              title="Link Mais Utilizado"
              value={
                data?.network?.mostUtilizedLink?.utilizationPct != null
                  ? `${data.network.mostUtilizedLink.utilizationPct}%`
                  : "—"
              }
              icon={<Wifi className="h-6 w-6" />}
            />

          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">

          <div className="grid gap-4 md:grid-cols-4">

            <Card
              title="Capacidade Total"
              value={`${(data?.network?.capacityTotalMbps ?? 0).toFixed(0)} Mbps`}
              icon={<Activity className="h-6 w-6" />}
            />

            <Card
              title="Tráfego Atual"
              value={`${(data?.network?.trafficCurrentMbps ?? 0).toFixed(3)} Mbps`}
              icon={<Wifi className="h-6 w-6" />}
            />

            <Card
              title="Utilização Geral"
              value={`${data?.network?.averageUtilization ?? 0}%`}
              icon={<CheckCircle2 className="h-6 w-6" />}
            />

            <Card
              title="Links Saturados"
              value={data?.network?.saturatedLinks ?? 0}
              icon={<AlertTriangle className="h-6 w-6" />}
            />

          </div>

            <h3 className="mb-4 text-lg font-semibold text-slate-900">
              Top Links de Tráfego
            </h3>

            <div className="space-y-3">

              {(data?.network?.topLinks ?? []).map((link, idx) => (

                <div
                  key={`${link.linkName}-${idx}`}
                  className="flex items-center justify-between rounded-xl border border-slate-100 p-3"
                >
                  <div>
                    <p className="font-medium text-slate-900">
                      {link.linkName}
                    </p>

                    <p className="text-xs text-slate-500">
                      RX {link.rxMbps ?? 0} Mbps · TX {link.txMbps ?? 0} Mbps
                    </p>
                  </div>

                  <div className="text-right">

                    <p className="font-semibold text-slate-900">
                      {(link.totalMbps ?? 0).toFixed(3)} Mbps
                    </p>

                    <p className="text-xs text-slate-500">
                      {link.utilizationPct ?? 0}%
                    </p>

                  </div>
                </div>

              ))}

            </div>

          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white px-5 py-4 text-sm text-slate-600 shadow-sm">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-semibold text-slate-900">
                {telemetry?.routerName || "RouterOS"}
              </p>
              <p>
                Versão: {telemetry?.version || "—"} · Uptime: {telemetry?.uptime || "—"}
              </p>
            </div>

            <div className="text-xs font-semibold text-slate-500">
              Última telemetria: {telemetry?.updatedAt || "aguardando"}
            </div>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card
          title="Pending"
          value={data?.queue?.pending ?? 0}
          icon={<Clock3 className="h-6 w-6" />}
        />

        <Card
          title="Processing"
          value={data?.queue?.processing ?? 0}
          icon={<Activity className="h-6 w-6" />}
        />

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Failed
              </p>

              <h2 className="mt-2 text-3xl font-bold tracking-tight text-slate-900">
                  {data?.queue?.failedRecent ?? data?.queue?.failed ?? 0}
              </h2>

              <p className="mt-1 text-xs font-medium text-slate-500">
                 Histórico: {data?.queue?.failedTotal ?? 0}
              </p>
             </div>

               <div className="rounded-xl bg-slate-100 p-3 text-slate-700">
                 <ServerCrash className="h-6 w-6" />
             </div>
           </div>
        </div>

        <Card
          title="Stale"
          value={data?.queue?.stale ?? 0}
          icon={<AlertTriangle className="h-6 w-6" />}
        />

      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">

        <Card
          title="Agents Online"
          value={data?.agents?.online ?? 0}
          icon={<Wifi className="h-6 w-6" />}
        />

        <Card
          title="Agents Offline"
          value={data?.agents?.offline ?? 0}
          icon={<WifiOff className="h-6 w-6" />}
        />

        <Card
          title="Recovery Events"
          value={data?.recovery?.recentRecoveriesLastHour ?? 0}
          icon={<RefreshCw className="h-6 w-6" />}
        />

        <Card
          title="Throughput / min"
          value={data?.queue ? ((data.queue.pending ?? 0) + (data.queue.processing ?? 0)) : 0}
          icon={<Activity className="h-6 w-6" />}
        />

      </div>

      <div className="grid gap-4 xl:grid-cols-2">

        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
            Workers
          </h3>

          <div className="mt-4 space-y-3 text-sm">

            <div className="flex items-center justify-between rounded-xl bg-slate-50 px-4 py-3">
              <span>Sync Worker</span>

              <span className={data?.workers?.sync ? "text-emerald-600" : "text-rose-600"}>
                {data?.workers?.sync ? "ONLINE" : "OFFLINE"}
              </span>
            </div>

            <div className="flex items-center justify-between rounded-xl bg-slate-50 px-4 py-3">
              <span>Finance Worker</span>

              <span className={data?.workers?.finance ? "text-emerald-600" : "text-rose-600"}>
                {data?.workers?.finance ? "ONLINE" : "OFFLINE"}
              </span>
            </div>

            <div className="flex items-center justify-between rounded-xl bg-slate-50 px-4 py-3">
              <span>Trust Worker</span>

              <span className={data?.workers?.trust ? "text-emerald-600" : "text-rose-600"}>
                {data?.workers?.trust ? "ONLINE" : "OFFLINE"}
              </span>
            </div>

          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
            Queue Pressure
          </h3>

          <div className="mt-6 space-y-4">

            <div>
              <div className="mb-2 flex items-center justify-between text-sm">
                <span>Oldest job</span>
                <span>{0}s</span>
              </div>

              <div className="h-3 overflow-hidden rounded-full bg-slate-100">
                <div
                  className="h-full rounded-full bg-slate-900 transition-all"
                  style={{
                    width: `${Math.min(
                      0,
                      100,
                    )}%`,
                  }}
                />
              </div>
            </div>

          </div>
        </div>

      </div>



          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="mb-5 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
                  Live Event Stream
                </h3>
                <p className="mt-1 text-sm text-slate-500">
                  Eventos operacionais realtime do core distribuído.
                </p>
              </div>
              <div className="flex items-center gap-2 text-xs font-semibold text-emerald-600">
                <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-500" />
                STREAM
              </div>
            </div>

            <div className="space-y-3">
              {events.map((event, idx) => (
                <div
                  key={idx}
                  className="flex items-start gap-3 rounded-xl border border-slate-100 bg-slate-50 px-4 py-3"
                >
                  <div
                    className={`mt-1 h-2.5 w-2.5 rounded-full ${
                      event.level === "success"
                        ? "bg-emerald-500"
                        : event.level === "warning"
                          ? "bg-amber-500"
                          : "bg-sky-500"
                    }`}
                  />
                  <div>
                    <p className="text-sm font-medium text-slate-800">
                      {event.message}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      {event.time}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="mb-6 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
                  Throughput RouterOS
                </h3>
                <p className="mt-1 text-sm text-slate-500">
                  RX/TX realtime recebido da telemetria do agente.
                </p>
              </div>

              <div className="flex items-center gap-2 text-xs font-semibold text-emerald-600">
                <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-500" />
                LIVE
              </div>
            </div>

            <div className="h-[260px] min-h-[260px] w-full min-w-0">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={throughputHistory}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="time" />
                  <YAxis />
                  <Tooltip />
                  <Line type="monotone" dataKey="rxMbps" stroke="#2563eb" strokeWidth={3} dot={false} />
                  <Line type="monotone" dataKey="txMbps" stroke="#16a34a" strokeWidth={3} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-6 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
                Queue Timeline
              </h3>
              <p className="mt-1 text-sm text-slate-500">
                Histórico real persistido no Mongo + atualização realtime.
              </p>
            </div>

            <div className="flex items-center gap-2 text-xs font-semibold text-emerald-600">
              <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-500" />
              LIVE
            </div>
          </div>

          <div className="h-[320px] min-h-[320px] w-full min-w-0">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={history}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="time" />
                <YAxis />
                <Tooltip />
                <Line type="monotone" dataKey="pending" stroke="#2563eb" strokeWidth={3} dot={false} />
                <Line type="monotone" dataKey="processing" stroke="#16a34a" strokeWidth={3} dot={false} />
                <Line type="monotone" dataKey="failed" stroke="#dc2626" strokeWidth={3} dot={false} />
                <Line type="monotone" dataKey="pressurePercent" stroke="#9333ea" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="throughputPerMinute" stroke="#0f172a" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
    </div>
  );
}
