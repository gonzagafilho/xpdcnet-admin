"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
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

  degraded?: boolean;

  workers?: {
    sync?: boolean;
    finance?: boolean;
    trust?: boolean;
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


  const [, setStreamConnected] = useState(false);

  const [history, setHistory] = useState<
    Array<{
      time: string;
      pending: number;
      processing: number;
      failed: number;
    }>
  >([]);

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

        setData(payload);

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

  const degraded = useMemo(() => {
    return Boolean(data?.degraded);
  }, [data]);

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
          title="Pending"
          value={data?.queue?.pending ?? 0}
          icon={<Clock3 className="h-6 w-6" />}
        />

        <Card
          title="Processing"
          value={data?.queue?.processing ?? 0}
          icon={<Activity className="h-6 w-6" />}
        />

        <Card
          title="Failed"
          value={data?.queue?.failed ?? 0}
          icon={<ServerCrash className="h-6 w-6" />}
        />

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
          <div className="mb-6 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
                Queue Timeline
              </h3>
              <p className="mt-1 text-sm text-slate-500">
                Fluxo operacional realtime da fila distribuída.
              </p>
            </div>

            <div className="flex items-center gap-2 text-xs font-semibold text-emerald-600">
              <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-500" />
              LIVE
            </div>
          </div>

          <div className="h-[320px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={history}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="time" />
                <YAxis />
                <Tooltip />
                <Line type="monotone" dataKey="pending" stroke="#2563eb" strokeWidth={3} dot={false} />
                <Line type="monotone" dataKey="processing" stroke="#16a34a" strokeWidth={3} dot={false} />
                <Line type="monotone" dataKey="failed" stroke="#dc2626" strokeWidth={3} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
    </div>
  );
}
