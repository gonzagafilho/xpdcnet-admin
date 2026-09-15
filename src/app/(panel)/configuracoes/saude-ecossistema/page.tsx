"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Activity, RefreshCw, Server } from "lucide-react";
import { apiFetch } from "@/lib/api-client";
import { userFacingApiError } from "@/lib/user-facing-api-error";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ErrorState } from "@/components/ui/error-state";

type ServiceState = "online" | "degraded" | "offline";

type ServiceDetail = {
  status: ServiceState;
  responseTimeMs?: number | null;
  cpuPercent?: number | null;
  memoryBytes?: number | null;
  uptimeSeconds?: number | null;
  sampledAt?: string | null;
  lastError?: { message?: string; at?: string | null } | null;
  [key: string]: unknown;
};

type EcosystemHealthResponse = {
  status: "healthy" | "degraded" | "offline";
  generatedAt: string;
  services: Record<string, ServiceState>;
  details: Record<string, ServiceDetail>;
};

const SERVICE_LABELS: Array<{ key: string; label: string }> = [
  { key: "frontend", label: "Frontend (3012)" },
  { key: "backend", label: "API (3035)" },
  { key: "mongodb", label: "MongoDB" },
  { key: "pm2", label: "PM2" },
  { key: "nginx", label: "NGINX" },
  { key: "workers", label: "Workers" },
  { key: "telemetria", label: "Telemetria" },
  { key: "pppoe", label: "PPPoE" },
  { key: "bolepix", label: "BolePix" },
  { key: "whatsapp", label: "WhatsApp" },
  { key: "concentradores", label: "Concentradores" },
  { key: "scheduler", label: "Scheduler" },
];

function stateMeta(state: ServiceState) {
  if (state === "online") return { icon: "🟢", label: "Online", badge: "success" as const };
  if (state === "degraded") return { icon: "🟡", label: "Degradado", badge: "warning" as const };
  return { icon: "🔴", label: "Offline", badge: "error" as const };
}

function formatMemory(bytes?: number | null) {
  if (bytes == null || !Number.isFinite(bytes)) return "-";
  const mb = bytes / (1024 * 1024);
  if (mb < 1024) return `${mb.toFixed(1)} MB`;
  return `${(mb / 1024).toFixed(2)} GB`;
}

function formatSeconds(seconds?: number | null) {
  if (seconds == null || !Number.isFinite(seconds)) return "-";
  const s = Math.max(0, Math.floor(seconds));
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (d > 0) return `${d}d ${h}h ${m}m`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

export default function SaudeEcossistemaPage() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<EcosystemHealthResponse | null>(null);

  const load = useCallback(async (initial = false) => {
    if (initial) setLoading(true);
    else setRefreshing(true);
    setError(null);
    try {
      const payload = await apiFetch<EcosystemHealthResponse>("/system/health");
      setData(payload);
    } catch (e) {
      setError(userFacingApiError(e));
    } finally {
      if (initial) setLoading(false);
      else setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void load(true);
  }, [load]);

  const summary = useMemo(() => {
    const services = data?.services || {};
    const all = Object.values(services);
    return {
      online: all.filter((s) => s === "online").length,
      degraded: all.filter((s) => s === "degraded").length,
      offline: all.filter((s) => s === "offline").length,
      total: all.length,
    };
  }, [data?.services]);

  const overall = data?.status || "degraded";
  const overallMeta = overall === "healthy"
    ? { icon: "🟢", label: "Healthy" }
    : overall === "offline"
      ? { icon: "🔴", label: "Offline" }
      : { icon: "🟡", label: "Degraded" };

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-bold tracking-tight text-neutral-900">
            <Server className="h-5 w-5 text-emerald-700" />
            Saúde do Ecossistema
          </h1>
          <p className="text-sm text-neutral-600">
            Monitoramento preventivo do XPDCNET (infra, API, workers e integrações).
          </p>
        </div>
        <Button type="button" variant="outline" onClick={() => void load(false)} disabled={loading || refreshing}>
          <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
          {refreshing ? "Atualizando..." : "Atualizar"}
        </Button>
      </header>

      {error ? <ErrorState title="Falha ao carregar saúde do ecossistema" description={error} onRetry={() => void load(false)} /> : null}

      <section className="grid gap-3 sm:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Estado geral</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-lg font-semibold">{overallMeta.icon} {overallMeta.label}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Online</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-lg font-semibold text-emerald-700">{summary.online}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Degradado</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-lg font-semibold text-amber-700">{summary.degraded}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Offline</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-lg font-semibold text-red-700">{summary.offline}</p>
          </CardContent>
        </Card>
      </section>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Activity className="h-4 w-4" />
            Serviços monitorados
          </CardTitle>
          <p className="text-xs text-neutral-500">
            Última atualização: {data?.generatedAt ? new Date(data.generatedAt).toLocaleString("pt-BR") : "-"}
          </p>
        </CardHeader>
        <CardContent className="space-y-3">
          {loading ? <p className="text-sm text-neutral-500">Carregando saúde do ecossistema...</p> : null}

          {!loading ? SERVICE_LABELS.map(({ key, label }) => {
            const detail = data?.details?.[key];
            const state = detail?.status || data?.services?.[key] || "offline";
            const meta = stateMeta(state);
            const err = detail?.lastError;
            return (
              <div key={key} className="rounded-lg border border-neutral-200 p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-medium text-neutral-900">{label}</p>
                  <Badge variant={meta.badge}>{meta.icon} {meta.label}</Badge>
                </div>
                <div className="mt-2 grid gap-2 text-xs text-neutral-600 sm:grid-cols-5">
                  <p>Resposta: <span className="font-medium text-neutral-800">{detail?.responseTimeMs != null ? `${detail.responseTimeMs} ms` : "-"}</span></p>
                  <p>CPU: <span className="font-medium text-neutral-800">{detail?.cpuPercent != null ? `${Number(detail.cpuPercent).toFixed(1)}%` : "-"}</span></p>
                  <p>Memória: <span className="font-medium text-neutral-800">{formatMemory(detail?.memoryBytes)}</span></p>
                  <p>Uptime: <span className="font-medium text-neutral-800">{formatSeconds(detail?.uptimeSeconds)}</span></p>
                  <p>Amostra: <span className="font-medium text-neutral-800">{detail?.sampledAt ? new Date(String(detail.sampledAt)).toLocaleString("pt-BR") : "-"}</span></p>
                </div>
                <p className="mt-2 text-xs text-neutral-600">
                  Último erro: <span className="font-medium text-neutral-800">{err?.message || "-"}</span>
                  {err?.at ? ` (${new Date(err.at).toLocaleString("pt-BR")})` : ""}
                </p>
              </div>
            );
          }) : null}
        </CardContent>
      </Card>
    </div>
  );
}
