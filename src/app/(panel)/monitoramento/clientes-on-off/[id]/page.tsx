"use client";

import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import {
  AlertCircle,
  ArrowLeft,
  ClipboardCopy,
  ExternalLink,
  ListOrdered,
  Loader2,
  RefreshCw,
  Server,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { apiFetch, ApiRequestError } from "@/lib/api-client";
import type { MikrotikClientMonitoringFromApi, MonitoringClientSummaryFromApi } from "@/lib/api-types";
import { MonitoringClientStatusBadge } from "../../_components/monitoring-client-status-badge";

export default function MonitoramentoClienteDetalhePage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const id = typeof params.id === "string" ? params.id : "";
  const fromRaw = searchParams.get("from");
  const fromLabel =
    fromRaw === "map" ? "Mapa de clientes" : fromRaw === "onoff" ? "Lista On / Off" : fromRaw ? String(fromRaw) : null;
  const backHref = fromRaw === "map" ? "/monitoramento/mapa-clientes" : "/monitoramento/clientes-on-off";
  const backLabel = fromRaw === "map" ? "Voltar ao mapa" : "Voltar à lista";

  const [summary, setSummary] = useState<MonitoringClientSummaryFromApi | null>(null);
  const [monitoring, setMonitoring] = useState<MikrotikClientMonitoringFromApi | null>(null);
  const [loading, setLoading] = useState(true);
  const [busySync, setBusySync] = useState(false);
  const [hint, setHint] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    setHint(null);
    try {
      const [sum, mon] = await Promise.all([
        apiFetch<MonitoringClientSummaryFromApi>(`/monitoring/client/${encodeURIComponent(id)}?timeoutMs=12000`, {
          timeoutMs: 120_000,
        }),
        apiFetch<MikrotikClientMonitoringFromApi>(`/mikrotik-monitoring/client/${encodeURIComponent(id)}?timeoutMs=12000`, {
          timeoutMs: 90_000,
        }).catch(() => null),
      ]);
      setSummary(sum);
      setMonitoring(mon);
    } catch (e) {
      setError(e instanceof ApiRequestError ? e.message : "Não foi possível carregar os dados deste cliente.");
      setSummary(null);
      setMonitoring(null);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  const ip = summary?.ip && String(summary.ip).trim() ? String(summary.ip).trim() : "—";

  const copyIp = async () => {
    if (!ip || ip === "—") return;
    try {
      await navigator.clipboard.writeText(String(ip));
      setHint("IP copiado.");
      setTimeout(() => setHint(null), 2000);
    } catch {
      setHint("Não foi possível copiar.");
      setTimeout(() => setHint(null), 2000);
    }
  };

  const enqueueSync = async () => {
    if (!id || !summary?.serverId) return;
    const ok = window.confirm(
      "Enfileirar sincronização com o equipamento para este cliente? A operação fica registada no servidor.",
    );
    if (!ok) return;
    setBusySync(true);
    setHint(null);
    try {
      const body: Record<string, unknown> = { clientId: id, triggerReason: "manual_admin_monitoramento" };
      body.expectedServerId = summary.serverId;
      const res = await apiFetch<{ ok?: boolean; skipped?: boolean; reason?: string; message?: string }>(
        "/mikrotik-sync/enqueue",
        {
          method: "POST",
          auth: true,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
          timeoutMs: 60_000,
        },
      );
      setHint(res.skipped ? res.message || "Ignorado." : "Pedido enviado para a fila.");
    } catch (e) {
      setHint(e instanceof ApiRequestError ? e.message : "Falha ao enfileirar.");
    } finally {
      setBusySync(false);
    }
  };

  if (!id) {
    return (
      <div className="px-4 py-12 text-center text-slate-600">
        <p>Identificador inválido.</p>
        <Button asChild variant="outline" className="mt-4">
          <Link href="/monitoramento/clientes-on-off">Voltar</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-4xl space-y-6 pb-10">
      <div className="flex flex-col gap-3 border-b border-slate-200/90 pb-6">
        <Button asChild variant="outline" size="sm" className="w-fit gap-2">
          <Link href={backHref}>
            <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
            {backLabel}
          </Link>
        </Button>
        {fromLabel ? (
          <p className="text-xs text-slate-600">
            Origem: <span className="font-semibold text-slate-800">{fromLabel}</span>
          </p>
        ) : null}
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">Monitoramento · Cliente</p>
          {loading ? (
            <div className="mt-2 h-8 w-48 animate-pulse rounded bg-slate-200" />
          ) : (
            <h1 className="mt-1 text-xl font-semibold tracking-tight text-slate-900 sm:text-2xl">
              {summary?.fullName ?? "Cliente"}
            </h1>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" size="sm" className="gap-2" onClick={() => void load()} disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <RefreshCw className="h-4 w-4" aria-hidden />}
            Actualizar
          </Button>
        </div>
      </div>

      {error ? (
        <div className="flex items-start gap-3 rounded-lg border border-rose-200/90 bg-rose-50/90 px-4 py-3 text-sm text-rose-900" role="alert">
          <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-rose-600" aria-hidden />
          <p>{error}</p>
        </div>
      ) : null}
      {hint ? <p className="text-sm text-slate-600">{hint}</p> : null}

      {summary ? (
        <>
          <Card className="border-slate-200/95 shadow-sm ring-1 ring-slate-900/[0.03]">
            <CardHeader className="border-b border-slate-100 bg-slate-50/80">
              <CardTitle className="text-base">Conexão e estado</CardTitle>
              <CardDescription>Última leitura ao concentrador do cliente.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 p-5 text-sm">
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex flex-col gap-1">
                  <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Estado na rede</span>
                  <MonitoringClientStatusBadge pppStatus={summary.pppStatus} />
                </div>
                <div className="flex flex-col gap-1">
                  <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Cadastro</span>
                  <Badge variant="outline" className="w-fit">
                    {summary.status}
                  </Badge>
                </div>
                <div className="flex flex-col gap-1">
                  <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Equipamento</span>
                  <Badge variant={summary.equipmentOnline ? "success" : "error"} className="w-fit">
                    {summary.equipmentOnline ? "A responder" : "Sem resposta"}
                  </Badge>
                </div>
              </div>
              <dl className="grid gap-3 sm:grid-cols-2">
                <div>
                  <dt className="text-[11px] font-semibold uppercase text-slate-500">Login</dt>
                  <dd className="font-mono text-slate-900">{summary.login ?? "—"}</dd>
                </div>
                <div>
                  <dt className="text-[11px] font-semibold uppercase text-slate-500">IP</dt>
                  <dd className="font-mono text-slate-900">{ip}</dd>
                </div>
                <div>
                  <dt className="text-[11px] font-semibold uppercase text-slate-500">Tempo online (conexão activa)</dt>
                  <dd className="text-slate-900">{summary.activeConnection?.uptime ?? "—"}</dd>
                </div>
                <div>
                  <dt className="text-[11px] font-semibold uppercase text-slate-500">Tipo de acesso</dt>
                  <dd className="uppercase text-slate-900">{summary.authType ?? "—"}</dd>
                </div>
              </dl>
              {!summary.equipmentOnline && summary.equipmentLastError ? (
                <p className="text-xs text-rose-800">{summary.equipmentLastError}</p>
              ) : null}
            </CardContent>
          </Card>

          <Card className="border-slate-200/95 shadow-sm">
            <CardHeader>
              <CardTitle className="text-base">Plano</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm text-slate-800">
              <p>
                <span className="text-slate-500">Nome: </span>
                <span className="font-semibold">{summary.planName ?? "—"}</span>
              </p>
              <p>
                <span className="text-slate-500">Download / upload (referência do plano): </span>
                <span className="font-mono text-xs">{summary.planRateLabel ?? "—"}</span>
              </p>
            </CardContent>
          </Card>

          <Card className="border-slate-200/95 shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Server className="h-4 w-4 text-slate-500" aria-hidden />
                Servidor
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <p>
                <span className="text-slate-500">Nome: </span>
                {summary.serverName ? (
                  <span className="font-semibold">{summary.serverName}</span>
                ) : summary.serverId ? (
                  <span className="font-mono text-xs">{summary.serverId}</span>
                ) : (
                  <span className="text-amber-800">Cliente sem servidor associado no cadastro.</span>
                )}
              </p>
              <p className="text-xs text-slate-500">
                Identificador interno: <span className="font-mono text-slate-700">{id}</span>
              </p>
            </CardContent>
          </Card>

          {monitoring ? (
            <Card className="border-slate-200/95 shadow-sm">
              <CardHeader>
                <CardTitle className="text-base">Diagnóstico no equipamento</CardTitle>
                <CardDescription>Leitura técnica do registo de acesso (uso interno).</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2 text-sm text-slate-800">
                <p>
                  Registo existe: <strong>{monitoring.exists ? "sim" : "não"}</strong> · Perfil:{" "}
                  <span className="font-mono text-xs">{monitoring.profile ?? "—"}</span>
                </p>
                <p>
                  Estado esperado no equipamento:{" "}
                  <span className="font-mono text-xs">{monitoring.expected?.deviceStatus ?? "—"}</span>
                </p>
                {monitoring.queryError ? (
                  <p className="text-rose-800">
                    Erro de consulta: <span className="font-mono text-xs">{monitoring.queryError}</span>
                  </p>
                ) : null}
                {monitoring.skipReason ? <p className="text-amber-800">Ignorado: {monitoring.skipReason}</p> : null}
              </CardContent>
            </Card>
          ) : !loading ? (
            <Card className="border-slate-200/95 border-dashed bg-slate-50/50">
              <CardContent className="py-6 text-sm text-slate-600">
                Diagnóstico extra não disponível nesta carga (rede ou cliente sem vínculo para consulta).
              </CardContent>
            </Card>
          ) : null}

          <Card className="border-slate-200/95 border-dashed bg-slate-50/40">
            <CardHeader>
              <CardTitle className="text-base">Atalhos seguros</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" size="sm" className="gap-1" onClick={() => void copyIp()} disabled={!ip || ip === "—"}>
                <ClipboardCopy className="h-3.5 w-3.5" aria-hidden />
                Copiar IP
              </Button>
              <Button asChild variant="outline" size="sm" className="gap-1">
                <Link href="/clientes">
                  <ExternalLink className="h-3.5 w-3.5" aria-hidden />
                  Abrir em Clientes
                </Link>
              </Button>
              <Button asChild variant="outline" size="sm" className="gap-1">
                <Link href={`/clientes/timeline/${encodeURIComponent(id)}`}>
                  <ListOrdered className="h-3.5 w-3.5" aria-hidden />
                  Histórico
                </Link>
              </Button>
              <Button type="button" variant="outline" size="sm" disabled={busySync || !summary.serverId} onClick={() => void enqueueSync()}>
                {busySync ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> : null}
                Pedir sincronização
              </Button>
            </CardContent>
          </Card>
        </>
      ) : null}
    </div>
  );
}
