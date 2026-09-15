"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { RefreshCw, ShieldCheck } from "lucide-react";
import { apiFetch } from "@/lib/api-client";
import { userFacingApiError } from "@/lib/user-facing-api-error";
import type {
  SystemUpdateHistoryEntryFromApi,
  SystemUpdatePlanResponseFromApi,
  SystemUpdateStatusResponseFromApi,
} from "@/lib/api-types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { ErrorState } from "@/components/ui/error-state";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

function shortCommit(value?: string | null) {
  if (!value) return "-";
  return value.slice(0, 8);
}

function onOff(value: boolean) {
  return value ? "sujo" : "limpo";
}

function healthVariant(value?: string) {
  if (value === "online") return "success" as const;
  if (value === "degraded") return "warning" as const;
  return "error" as const;
}

export default function AtualizacoesSistemaPage() {
  const [status, setStatus] = useState<SystemUpdateStatusResponseFromApi | null>(null);
  const [history, setHistory] = useState<SystemUpdateHistoryEntryFromApi[]>([]);
  const [plan, setPlan] = useState<SystemUpdatePlanResponseFromApi | null>(null);
  const [tag, setTag] = useState("v1.4.0-ecosistema-dcnet");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [planning, setPlanning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadAll = useCallback(async (initial = false) => {
    if (initial) setLoading(true);
    else setRefreshing(true);
    setError(null);

    try {
      const [statusPayload, historyPayload] = await Promise.all([
        apiFetch<SystemUpdateStatusResponseFromApi>("/system/update/status", { timeoutMs: 15000 }),
        apiFetch<{ status: string; items: SystemUpdateHistoryEntryFromApi[] }>("/system/update/history", {
          timeoutMs: 12000,
        }),
      ]);

      setStatus(statusPayload);
      setHistory(Array.isArray(historyPayload.items) ? historyPayload.items : []);
    } catch (e) {
      setError(userFacingApiError(e));
    } finally {
      if (initial) setLoading(false);
      else setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void loadAll(true);
  }, [loadAll]);

  const preparePlan = async () => {
    setPlanning(true);
    setError(null);
    try {
      const payload = await apiFetch<SystemUpdatePlanResponseFromApi>("/system/update/plan", {
        method: "POST",
        body: JSON.stringify({ tag }),
        timeoutMs: 15000,
      });
      setPlan(payload);
      await loadAll(false);
    } catch (e) {
      setError(userFacingApiError(e));
    } finally {
      setPlanning(false);
    }
  };

  const topTags = useMemo(() => (status?.availableTags || []).slice(0, 12), [status?.availableTags]);

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-bold tracking-tight text-neutral-900">
            <ShieldCheck className="h-5 w-5 text-emerald-700" />
            Atualizações do Sistema
          </h1>
          <p className="text-sm text-neutral-600">
            Central de atualização integrada ao XPDCNET real (somente leitura e planejamento nesta etapa).
          </p>
        </div>
        <Button type="button" variant="outline" onClick={() => void loadAll(false)} disabled={loading || refreshing}>
          <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
          {refreshing ? "Atualizando..." : "Verificar atualização"}
        </Button>
      </header>

      <Card>
        <CardContent className="pt-5">
          <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
            Execução real será habilitada somente após validação do fluxo blue-green.
          </p>
        </CardContent>
      </Card>

      {error ? <ErrorState title="Falha na Central de Atualizações" description={error} onRetry={() => void loadAll(false)} /> : null}

      <section className="grid gap-3 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Versão Admin</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-neutral-700">
            <p>Branch: <span className="font-medium text-neutral-900">{status?.current.admin.branch || "-"}</span></p>
            <p>Commit: <span className="font-medium text-neutral-900">{shortCommit(status?.current.admin.commit)}</span></p>
            <p>Tag: <span className="font-medium text-neutral-900">{status?.current.admin.tag || "-"}</span></p>
            <p>Git: <Badge variant={status?.current.admin.dirty ? "warning" : "success"}>{onOff(Boolean(status?.current.admin.dirty))}</Badge></p>
            <p>PM2: <Badge variant={status?.runtime.admin.pm2Status === "online" ? "success" : "error"}>{status?.runtime.admin.pm2Status || "-"}</Badge></p>
            <p>Porta: <span className="font-medium text-neutral-900">{status?.runtime.admin.port ?? 3012}</span></p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Versão API</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-neutral-700">
            <p>Branch: <span className="font-medium text-neutral-900">{status?.current.backend.branch || "-"}</span></p>
            <p>Commit: <span className="font-medium text-neutral-900">{shortCommit(status?.current.backend.commit)}</span></p>
            <p>Tag: <span className="font-medium text-neutral-900">{status?.current.backend.tag || "-"}</span></p>
            <p>Git: <Badge variant={status?.current.backend.dirty ? "warning" : "success"}>{onOff(Boolean(status?.current.backend.dirty))}</Badge></p>
            <p>PM2: <Badge variant={status?.runtime.api.pm2Status === "online" ? "success" : "error"}>{status?.runtime.api.pm2Status || "-"}</Badge></p>
            <p>Porta: <span className="font-medium text-neutral-900">{status?.runtime.api.port ?? 3035}</span></p>
          </CardContent>
        </Card>
      </section>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Saúde e Tags</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div className="flex flex-wrap gap-2">
            <Badge variant={healthVariant(status?.health.frontend)}>Frontend: {status?.health.frontend || "-"}</Badge>
            <Badge variant={healthVariant(status?.health.api)}>API: {status?.health.api || "-"}</Badge>
            <Badge variant={healthVariant(status?.health.mongodb)}>MongoDB: {status?.health.mongodb || "-"}</Badge>
            <Badge variant={healthVariant(status?.health.nginx)}>NGINX: {status?.health.nginx || "-"}</Badge>
          </div>

          <p className="text-neutral-600">
            Última atualização registrada: {status?.lastUpdate?.createdAt ? new Date(status.lastUpdate.createdAt).toLocaleString("pt-BR") : "-"}
          </p>

          <div className="space-y-2">
            <p className="font-medium text-neutral-800">Tags disponíveis</p>
            <div className="flex flex-wrap gap-2">
              {topTags.length === 0 ? <span className="text-neutral-500">Nenhuma tag disponível.</span> : null}
              {topTags.map((t) => (
                <button
                  key={t}
                  type="button"
                  className="rounded-md border border-neutral-200 bg-white px-2 py-1 text-xs text-neutral-700 hover:bg-neutral-50"
                  onClick={() => setTag(t)}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Planejamento</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <Input value={tag} onChange={(e) => setTag(e.target.value)} className="max-w-md" placeholder="v1.4.0-ecosistema-dcnet" />
            <Button type="button" onClick={() => void preparePlan()} disabled={planning || loading}>
              {planning ? "Preparando..." : "Preparar plano"}
            </Button>
            <Button type="button" disabled variant="outline" title="Bloqueado nesta etapa">
              Instalar atualização
            </Button>
            <Button type="button" disabled variant="outline" title="Bloqueado nesta etapa">
              Reverter atualização
            </Button>
          </div>

          {plan ? (
            <div className="space-y-2 rounded-lg border border-neutral-200 bg-neutral-50 p-3 text-sm text-neutral-700">
              <p>Versão alvo: <span className="font-medium text-neutral-900">{plan.targetVersion}</span></p>
              <p>Commits no plano: <span className="font-medium text-neutral-900">{plan.commitCount}</span></p>
              <p>Arquivos alterados: <span className="font-medium text-neutral-900">{plan.changedFiles.length}</span></p>
              <p>Necessita npm ci: <span className="font-medium text-neutral-900">{plan.requiresNpmCi ? "sim" : "não"}</span></p>
              <p>Necessita build: <span className="font-medium text-neutral-900">{plan.requiresBuild ? "sim" : "não"}</span></p>
              <p>Migrations detectadas: <span className="font-medium text-neutral-900">{plan.migrationsDetected ? "sim" : "não"}</span></p>
              <p>Executável nesta etapa: <span className="font-medium text-red-700">{plan.executable ? "sim" : "não"}</span></p>
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Histórico</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Data</TableHead>
                <TableHead>Ação</TableHead>
                <TableHead>Usuário</TableHead>
                <TableHead>Tag</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Resumo</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {history.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-neutral-500">Sem histórico registrado.</TableCell>
                </TableRow>
              ) : null}
              {history.map((item) => (
                <TableRow key={item.id}>
                  <TableCell>{item.createdAt ? new Date(item.createdAt).toLocaleString("pt-BR") : "-"}</TableCell>
                  <TableCell>{item.action}</TableCell>
                  <TableCell>{item.requestedBy || "-"}</TableCell>
                  <TableCell>{item.targetTag || "-"}</TableCell>
                  <TableCell>
                    <Badge variant={item.status === "success" ? "success" : "error"}>{item.status}</Badge>
                  </TableCell>
                  <TableCell>{item.summary}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {loading ? <p className="text-sm text-neutral-500">Carregando central de atualizações...</p> : null}
    </div>
  );
}
