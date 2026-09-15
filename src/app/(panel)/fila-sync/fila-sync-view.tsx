"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { apiFetch } from "@/lib/api-client";
import { userFacingApiError } from "@/lib/user-facing-api-error";
import type {
  MikrotikSyncJobAuditFromApi,
  MikrotikSyncJobFromApi,
  MikrotikSyncJobsListFromApi,
  MikrotikSyncSummaryFromApi,
} from "@/lib/api-types";
import {
  mikrotikSyncJobClientLabel,
  mikrotikSyncJobTenantLabel,
} from "@/lib/api-types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/cn";
import { Eye, ListOrdered, RefreshCw, RotateCcw } from "lucide-react";

const PAGE_SIZE = 20;

type ToastState = { variant: "success" | "error"; message: string } | null;

function formatDt(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function statusBadgeVariant(
  s: MikrotikSyncJobFromApi["status"],
): "success" | "warning" | "error" | "default" {
  if (s === "done") return "success";
  if (s === "failed") return "error";
  if (s === "processing") return "warning";
  return "default";
}

function statusLabelPt(s: MikrotikSyncJobFromApi["status"]): string {
  if (s === "pending") return "Pendente";
  if (s === "processing") return "A processar";
  if (s === "done") return "Concluído";
  return "Falhou";
}

function executionModeLabelPt(mode: string | null | undefined): string {
  if (mode == null || mode === "") return "—";
  if (mode === "simulate") return "Simulação (sem Equipamento)";
  if (mode === "dry-run") return "Dry-run (validação, sem socket)";
  if (mode === "live") return "Live (Equipamento)";
  return mode;
}

/** Rótulos para motivos automáticos / operacionais (código continua em formato API). */
function triggerReasonDescriptionPt(reason: string | null | undefined): string | null {
  if (!reason) return null;
  const map: Record<string, string> = {
    TRUST_RELEASE_EXPIRED: "Confiança expirada — re-sync agendado (sem Equipamento nesta etapa)",
    FINANCE_ROLLUP: "Consolidação financeira alterou o estado do cliente — re-sync enfileirado",
  };
  return map[reason] ?? null;
}

function TriggerBlock({
  triggerReason,
  triggerSource,
  triggerContext,
}: {
  triggerReason: string | null | undefined;
  triggerSource: string | null | undefined;
  triggerContext: Record<string, unknown> | null | undefined;
}) {
  const reasonDesc = triggerReasonDescriptionPt(triggerReason);
  const hasTrigger = Boolean(triggerReason || triggerSource || triggerContext);
  if (!hasTrigger) {
    return (
      <div>
        <span className="text-neutral-500">Origem do enqueue</span>
        <p className="mt-1 rounded border border-neutral-200 bg-neutral-50 p-2 text-xs text-neutral-600">
          Job legado ou criado sem metadados de gatilho.
        </p>
      </div>
    );
  }
  return (
    <div className="space-y-2">
      <span className="text-neutral-500">Origem do enqueue</span>
      <div className="space-y-2 rounded border border-violet-200/80 bg-violet-50/50 p-3 text-xs">
        <div className="grid gap-2 sm:grid-cols-2">
          <div>
            <span className="font-semibold text-neutral-600">Motivo</span>
            <p className="font-mono">{triggerReason || "—"}</p>
            {reasonDesc ? <p className="mt-0.5 text-[0.65rem] text-neutral-600">{reasonDesc}</p> : null}
          </div>
          <div>
            <span className="font-semibold text-neutral-600">Origem</span>
            <p className="font-mono">{triggerSource || "—"}</p>
          </div>
        </div>
        {triggerContext ? (
          <div>
            <span className="font-semibold text-neutral-600">Contexto (seguro)</span>
            <pre className="mt-1 max-h-32 overflow-auto rounded border border-neutral-200 bg-white p-2 text-[0.65rem] text-neutral-800">
              {JSON.stringify(triggerContext, null, 2)}
            </pre>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function AuditBlock({
  audit,
  formatDt,
}: {
  audit: MikrotikSyncJobAuditFromApi | null | undefined;
  formatDt: (iso: string | null | undefined) => string;
}) {
  const hasAudit =
    audit &&
    (audit.executionMode != null ||
      (audit.executionMessage != null && audit.executionMessage !== "") ||
      (audit.executionError != null && audit.executionError !== ""));
  if (!hasAudit) {
    return (
      <div>
        <span className="text-neutral-500">Auditoria (última execução)</span>
        <p className="mt-1 rounded border border-neutral-200 bg-neutral-50 p-2 text-xs text-neutral-600">
          Ainda sem registo de execução terminal (pendente, em processamento, ou worker anterior a esta versão).
        </p>
      </div>
    );
  }
  return (
    <div className="space-y-2">
      <span className="text-neutral-500">Auditoria (última execução)</span>
      <div className="space-y-2 rounded border border-sky-200/80 bg-sky-50/50 p-3 text-xs">
        <div className="grid gap-2 sm:grid-cols-2">
          <div>
            <span className="font-semibold text-neutral-600">Modo</span>
            <p>{executionModeLabelPt(audit!.executionMode)}</p>
          </div>
          <div>
            <span className="font-semibold text-neutral-600">Acção</span>
            <p className="font-mono">{audit!.executionAction ?? "—"}</p>
          </div>
          <div className="sm:col-span-2">
            <span className="font-semibold text-neutral-600">Mensagem</span>
            <p className="mt-0.5 whitespace-pre-wrap break-words">{audit!.executionMessage || "—"}</p>
          </div>
          {audit!.executionError ? (
            <div className="sm:col-span-2">
              <span className="font-semibold text-neutral-600">Código / erro</span>
              <p className="mt-0.5 whitespace-pre-wrap break-words text-red-900">{audit!.executionError}</p>
            </div>
          ) : null}
          <div>
            <span className="font-semibold text-neutral-600">Executado em</span>
            <p>{formatDt(audit!.executedAt)}</p>
          </div>
        </div>
        {audit!.expectedSnapshot && Object.keys(audit!.expectedSnapshot).length > 0 ? (
          <div>
            <span className="font-semibold text-neutral-600">Expectativa (snapshot)</span>
            <pre className="mt-1 max-h-32 overflow-auto rounded border border-neutral-200 bg-white p-2 text-[0.65rem] text-neutral-800">
              {JSON.stringify(audit!.expectedSnapshot, null, 2)}
            </pre>
          </div>
        ) : null}
      </div>
    </div>
  );
}

const AUTO_REFRESH_MS = 45_000;

export function FilaSyncView() {
  const [summary, setSummary] = useState<MikrotikSyncSummaryFromApi | null>(null);
  const [list, setList] = useState<MikrotikSyncJobsListFromApi | null>(null);
  const [loading, setLoading] = useState(true);
  const [manualBusy, setManualBusy] = useState(false);
  const [summaryError, setSummaryError] = useState<string | null>(null);
  const [listError, setListError] = useState<string | null>(null);

  const [statusFilter, setStatusFilter] = useState<string>("");
  const [clientIdFilter, setClientIdFilter] = useState("");
  const [serverIdFilter, setServerIdFilter] = useState("");
  const [page, setPage] = useState(1);
  const [autoRefresh, setAutoRefresh] = useState(false);

  const [detailJob, setDetailJob] = useState<MikrotikSyncJobFromApi | null>(null);
  const [retryingId, setRetryingId] = useState<string | null>(null);
  const [toast, setToast] = useState<ToastState>(null);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4500);
    return () => clearTimeout(t);
  }, [toast]);

  const loadSummary = useCallback(async () => {
    setSummaryError(null);
    const s = await apiFetch<MikrotikSyncSummaryFromApi>("/mikrotik-sync/summary");
    setSummary(s);
  }, []);

  const buildQuery = useCallback(
    (pageOverride?: number) => {
      const sp = new URLSearchParams();
      sp.set("page", String(pageOverride ?? page));
      sp.set("limit", String(PAGE_SIZE));
      if (statusFilter) sp.set("status", statusFilter);
      const c = clientIdFilter.trim();
      if (c) sp.set("clientId", c);
      const sv = serverIdFilter.trim();
      if (sv) sp.set("serverId", sv);
      return sp.toString();
    },
    [page, statusFilter, clientIdFilter, serverIdFilter],
  );

  const loadJobs = useCallback(
    async (pageOverride?: number) => {
      setListError(null);
      const q = buildQuery(pageOverride);
      const data = await apiFetch<MikrotikSyncJobsListFromApi>(`/mikrotik-sync/jobs?${q}`);
      setList(data);
    },
    [buildQuery],
  );

  const loadAll = useCallback(async () => {
    setManualBusy(true);
    try {
      await Promise.all([loadSummary(), loadJobs()]);
    } finally {
      setManualBusy(false);
    }
  }, [loadSummary, loadJobs]);

  const hasActiveFilters = Boolean(
    statusFilter || clientIdFilter.trim() || serverIdFilter.trim(),
  );

  const tableBusy = loading || manualBusy;
  const showTableOverlay = Boolean(tableBusy && list);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await loadSummary();
      } catch (e) {
        if (!cancelled) setSummaryError(userFacingApiError(e));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [loadSummary]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        await loadJobs();
      } catch (e) {
        if (!cancelled) setListError(userFacingApiError(e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [loadJobs, page, statusFilter, clientIdFilter, serverIdFilter]);

  useEffect(() => {
    if (!autoRefresh) return;
    const id = window.setInterval(() => {
      void Promise.all([loadSummary(), loadJobs()]).catch(() => {
        /* erros já aparecem no próximo pedido manual */
      });
    }, AUTO_REFRESH_MS);
    return () => window.clearInterval(id);
  }, [autoRefresh, loadSummary, loadJobs]);

  const applyFilters = () => {
    setPage(1);
    void loadJobs(1);
  };

  const retryJob = async (job: MikrotikSyncJobFromApi) => {
    const id = job._id;
    setRetryingId(id);
    try {
      await apiFetch<MikrotikSyncJobFromApi>(`/mikrotik-sync/${id}/retry`, { method: "POST" });
      setToast({ variant: "success", message: "Job reenviado para a fila (pending)." });
      await loadAll();
    } catch (e) {
      setToast({ variant: "error", message: userFacingApiError(e) });
    } finally {
      setRetryingId(null);
    }
  };

  const summaryCards = useMemo(() => {
    if (!summary) return null;
    const items: { key: keyof MikrotikSyncSummaryFromApi; label: string; className: string }[] = [
      { key: "pending", label: "Pendentes", className: "border-amber-200 bg-amber-50/80" },
      { key: "processing", label: "Em processamento", className: "border-sky-200 bg-sky-50/80" },
      { key: "done", label: "Concluídos", className: "border-emerald-200 bg-emerald-50/80" },
      { key: "failed", label: "Falhados", className: "border-red-200 bg-red-50/80" },
    ];
    return (
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {items.map(({ key, label, className }) => (
          <Card key={key} className={cn("border", className)}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-neutral-600">{label}</CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <p className="text-2xl font-semibold tabular-nums text-neutral-900">{summary[key]}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }, [summary]);

  const totalPages = list?.pages ?? 1;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-bold tracking-tight text-neutral-900">
            <ListOrdered className="h-6 w-6 text-amber-500" aria-hidden />
            Fila de Sincronização
          </h1>
          <p className="text-sm text-neutral-600">
            Jobs MikroTik Sync (MikrotikSyncJob). Operação e reenvio de falhas — sem execução Equipamento no painel.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <label className="flex cursor-pointer items-center gap-2 text-sm text-neutral-600">
            <input
              type="checkbox"
              className="h-4 w-4 rounded border-neutral-300"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
            />
            Auto ({Math.round(AUTO_REFRESH_MS / 1000)}s)
          </label>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={() => void loadAll()}
            disabled={tableBusy}
          >
            <RefreshCw className={cn("h-4 w-4", tableBusy && "animate-spin")} aria-hidden />
            Atualizar
          </Button>
        </div>
      </div>

      {summaryError ? (
        <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{summaryError}</p>
      ) : (
        summaryCards
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Filtros</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-1.5">
              <Label htmlFor="sync-status">Estado</Label>
              <Select
                id="sync-status"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="w-full"
              >
                <option value="">Todos</option>
                <option value="pending">Pendente</option>
                <option value="processing">A processar</option>
                <option value="done">Concluído</option>
                <option value="failed">Falhou</option>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="sync-client">ID do cliente</Label>
              <Input
                id="sync-client"
                placeholder="ID"
                value={clientIdFilter}
                onChange={(e) => setClientIdFilter(e.target.value)}
                className="font-mono text-xs"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="sync-server">ID do servidor MikroTik</Label>
              <Input
                id="sync-server"
                placeholder="ID"
                value={serverIdFilter}
                onChange={(e) => setServerIdFilter(e.target.value)}
                className="font-mono text-xs"
              />
            </div>
            <div className="flex items-end">
              <Button type="button" className="w-full sm:w-auto" onClick={() => applyFilters()}>
                Aplicar filtros
              </Button>
            </div>
          </div>
          <p className="text-xs text-neutral-500">
            Os dados estão limitados ao tenant resolvido no backend (DEFAULT_TENANT_SLUG / cabeçalho x-tenant). O parâmetro
            tenantId na API só é válido se coincidir com esse tenant.
          </p>
        </CardContent>
      </Card>

      {listError ? (
        <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{listError}</p>
      ) : null}

      <Card className="relative overflow-hidden">
        <CardContent className="p-0">
          {showTableOverlay ? (
            <div
              className="pointer-events-auto absolute inset-0 z-10 flex items-center justify-center bg-white/55 backdrop-blur-[1px]"
              role="status"
              aria-live="polite"
            >
              <span className="rounded-full border border-neutral-200 bg-white px-3 py-1.5 text-xs font-medium text-neutral-700 shadow-sm">
                A actualizar…
              </span>
            </div>
          ) : null}
          {loading && !list ? (
            <div className="p-8 text-center text-sm text-neutral-500">A carregar…</div>
          ) : !list?.items.length ? (
            <EmptyState
              title="Nenhum job"
              description={
                hasActiveFilters
                  ? "Nenhum registo corresponde aos filtros. Limpe os campos ou use «Aplicar filtros» com outros critérios."
                  : "Ainda não há jobs neste tenant. Enfileire com alterações de cliente (enqueue) ou aparecerão após retry."
              }
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Tenant</TableHead>
                  <TableHead>Estado (job)</TableHead>
                  <TableHead className="text-right">Tentativas</TableHead>
                  <TableHead className="min-w-[180px]">Último erro</TableHead>
                  <TableHead>Criado em</TableHead>
                  <TableHead>Actualizado em</TableHead>
                  <TableHead className="text-right">Acções</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {list.items.map((job) => (
                  <TableRow key={job._id}>
                    <TableCell className="font-medium">{mikrotikSyncJobClientLabel(job)}</TableCell>
                    <TableCell className="text-neutral-700">{mikrotikSyncJobTenantLabel(job)}</TableCell>
                    <TableCell>
                      <Badge variant={statusBadgeVariant(job.status)}>{statusLabelPt(job.status)}</Badge>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{job.attempts ?? 0}</TableCell>
                    <TableCell className="max-w-[220px] truncate text-xs text-neutral-600" title={job.lastError || ""}>
                      {job.lastError || "—"}
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-xs text-neutral-600">{formatDt(job.createdAt)}</TableCell>
                    <TableCell className="whitespace-nowrap text-xs text-neutral-600">{formatDt(job.updatedAt)}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-8 gap-1 px-2"
                          onClick={() => setDetailJob(job)}
                        >
                          <Eye className="h-3.5 w-3.5" aria-hidden />
                          Detalhes
                        </Button>
                        {job.status === "failed" ? (
                          <Button
                            type="button"
                            variant="default"
                            size="sm"
                            className="h-8 gap-1 px-2"
                            disabled={retryingId === job._id}
                            onClick={() => void retryJob(job)}
                          >
                            <RotateCcw className="h-3.5 w-3.5" aria-hidden />
                            Reenviar
                          </Button>
                        ) : null}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
        {list && list.total > 0 ? (
          <div className="flex flex-col items-center justify-between gap-3 border-t border-neutral-100 px-4 py-3 sm:flex-row">
            <p className="text-xs text-neutral-500">
              Página {list.page} de {totalPages} · {list.total} job(s)
            </p>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                Anterior
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
              >
                Seguinte
              </Button>
            </div>
          </div>
        ) : null}
      </Card>

      <Modal
        open={!!detailJob}
        onOpenChange={(open) => {
          if (!open) setDetailJob(null);
        }}
        title="Detalhes do job"
        description={detailJob ? `Job ${detailJob._id}` : undefined}
        className="max-w-2xl"
      >
        {detailJob ? (
          <div className="space-y-3 text-sm">
            <div className="grid gap-2 sm:grid-cols-2">
              <div>
                <span className="text-neutral-500">Cliente</span>
                <p className="font-medium">{mikrotikSyncJobClientLabel(detailJob)}</p>
              </div>
              <div>
                <span className="text-neutral-500">Tenant</span>
                <p className="font-medium">{mikrotikSyncJobTenantLabel(detailJob)}</p>
              </div>
              <div>
                <span className="text-neutral-500">Estado</span>
                <p>
                  <Badge variant={statusBadgeVariant(detailJob.status)}>{statusLabelPt(detailJob.status)}</Badge>
                </p>
              </div>
              <div>
                <span className="text-neutral-500">serverId</span>
                <p className="break-all font-mono text-xs">{String(detailJob.serverId ?? "—")}</p>
              </div>
            </div>
            <div>
              <span className="text-neutral-500">Último erro</span>
              <p className="mt-1 rounded border border-neutral-200 bg-neutral-50 p-2 text-xs">{detailJob.lastError || "—"}</p>
            </div>
            <TriggerBlock
              triggerReason={detailJob.triggerReason}
              triggerSource={detailJob.triggerSource}
              triggerContext={detailJob.triggerContext}
            />
            <AuditBlock audit={detailJob.audit} formatDt={formatDt} />
            <div>
              <span className="text-neutral-500">intentSnapshot (JSON)</span>
              <pre className="mt-1 max-h-64 overflow-auto rounded border border-neutral-200 bg-neutral-950 p-3 text-xs text-emerald-100">
                {JSON.stringify(detailJob.intentSnapshot ?? null, null, 2)}
              </pre>
            </div>
          </div>
        ) : null}
      </Modal>

      {toast ? (
        <div
          className={cn(
            "fixed bottom-4 right-4 z-[100] max-w-sm rounded-md border px-4 py-3 text-sm shadow-lg",
            toast.variant === "success"
              ? "border-emerald-200 bg-emerald-50 text-emerald-900"
              : "border-red-200 bg-red-50 text-red-900",
          )}
          role="status"
        >
          {toast.message}
        </div>
      ) : null}
    </div>
  );
}
