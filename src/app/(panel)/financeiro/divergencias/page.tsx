"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { apiFetch } from "@/lib/api-client";
import { userFacingApiError } from "@/lib/user-facing-api-error";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

type MikrotikDivergenceDashboardFromApi = {
  tenant: { id: string; slug: string };
  now: string;
  evaluation: {
    cutoffWindowActiveNow: boolean;
    limit: number;
    timeoutMs: number;
  };
  totals: {
    items: number;
    divergent: number;
    inSync: number;
    unknown: number;
    queryErrors: number;
  };
  items: Array<{
    clientId: string;
    clientName: string;
    financialState: {
      clientStatus: string;
      overdueCount: number;
      maxDaysLate: number;
      inGrace: boolean;
    };
    policyDecision: {
      diagnosis: string;
      eligibleForDelinquent: boolean;
    };
    desiredNetworkState: {
      recommendedSyncGoal: string;
      effectiveAccess: string;
      expectedDeviceStatus: string | null;
    };
    realNetworkState: {
      status: string;
      exists: boolean;
      profile: string | null;
      queryError: string | null;
    };
    divergence: {
      status: "divergent" | "in_sync" | "unknown";
      reason: string | null;
    };
    lastExecution: {
      syncState: string;
      lastAttemptAt: string | null;
      lastSuccessAt: string | null;
      lastJobStatus: string | null;
      lastJobAttempts: number | null;
    };
  }>;
};

type ReconcileClientFromApi = {
  ok: boolean;
  clientId: string;
  enqueued: boolean;
  duplicate: boolean;
  skipped: boolean;
  job: { _id?: string; status?: string } | null;
  triggerReason: string;
  monitoring: {
    divergent: boolean | null;
    divergenceReason: string | null;
    skipReason: string | null;
  };
};

function yesNo(v: boolean): string {
  return v ? "Sim" : "Nao";
}

function formatDateTime(value: string | null | undefined): string {
  if (!value) return "-";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleString("pt-BR");
}

export default function FinanceiroDivergenciasPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<MikrotikDivergenceDashboardFromApi | null>(null);
  const [limit, setLimit] = useState("50");
  const [timeoutMs, setTimeoutMs] = useState("8000");
  const [onlyDivergent, setOnlyDivergent] = useState(true);
  const [reconcileBusyId, setReconcileBusyId] = useState<string | null>(null);
  const [reconcileFeedback, setReconcileFeedback] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    setError(null);
    const lim = Math.max(10, Math.min(120, Number(limit) || 50));
    const timeout = Math.max(3000, Math.min(120000, Number(timeoutMs) || 8000));
    const only = onlyDivergent ? "1" : "0";
    const payload = await apiFetch<MikrotikDivergenceDashboardFromApi>(
      `/mikrotik-monitoring/divergence?limit=${lim}&timeoutMs=${timeout}&onlyDivergent=${only}`,
    );
    setData(payload);
  }, [limit, timeoutMs, onlyDivergent]);

  const runReconcile = useCallback(
    async (clientId: string, clientName: string) => {
      const ok = window.confirm(
        `Enfileirar sync oficial no pipeline para corrigir divergência?\n\nCliente: ${clientName}\n\nConfirma?`,
      );
      if (!ok) return;
      const msg = window.prompt(
        `Motivo opcional para auditoria (operador) — ${clientName}:`,
        "",
      );
      if (msg === null) return;
      const reason = String(msg).trim();

      const t = Math.max(3000, Math.min(120000, Number(timeoutMs) || 8000));
      setReconcileBusyId(clientId);
      setReconcileFeedback((f) => {
        const next = { ...f };
        delete next[clientId];
        return next;
      });
      try {
        const payload = await apiFetch<ReconcileClientFromApi>(
          `/mikrotik-monitoring/client/${clientId}/reconcile?timeoutMs=${t}`,
          {
            method: "POST",
            body: JSON.stringify({ reason: reason || undefined, force: false }),
            timeoutMs: t + 15000,
          },
        );
        const jobId = payload.job && typeof payload.job === "object" && "_id" in payload.job ? String(payload.job._id) : "";
        const parts = [
          payload.enqueued ? "Job enfileirado." : null,
          payload.duplicate ? "Já existia job pendente/processing (contexto actualizado)." : null,
          payload.skipped ? "Sync não enfileirada (ver detalhes)." : null,
          jobId ? `Job: ${jobId}` : null,
        ].filter(Boolean);
        setReconcileFeedback((f) => ({ ...f, [clientId]: parts.join(" ") || "Concluído." }));
      } catch (e) {
        setReconcileFeedback((f) => ({ ...f, [clientId]: userFacingApiError(e) }));
      } finally {
        setReconcileBusyId(null);
      }
    },
    [timeoutMs],
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await load();
      } catch (e) {
        if (!cancelled) setError(userFacingApiError(e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [load]);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-neutral-900">Divergencia policy x MikroTik</h1>
          <p className="text-sm text-neutral-600">
            Leitura operacional da decisao da policy versus estado real de rede, sem reconciliacao automatica.
          </p>
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <div className="w-24">
            <Label htmlFor="limit">Limite</Label>
            <Input id="limit" type="number" min={10} max={120} value={limit} onChange={(e) => setLimit(e.target.value)} />
          </div>
          <div className="w-28">
            <Label htmlFor="timeout">Timeout ms</Label>
            <Input id="timeout" type="number" min={3000} max={120000} value={timeoutMs} onChange={(e) => setTimeoutMs(e.target.value)} />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={onlyDivergent}
              onChange={(e) => setOnlyDivergent(e.target.checked)}
            />
            So divergentes
          </label>
          <Button type="button" variant="outline" onClick={() => void load()} disabled={loading}>
            Atualizar
          </Button>
          <Button type="button" asChild>
            <Link href="/financeiro/politica">Voltar politica</Link>
          </Button>
        </div>
      </div>

      {error ? <p className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</p> : null}

      {data ? (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <Card><CardContent className="pt-5"><p className="text-xs text-neutral-500">Itens</p><p className="text-2xl font-bold">{data.totals.items}</p></CardContent></Card>
            <Card><CardContent className="pt-5"><p className="text-xs text-neutral-500">Divergentes</p><p className="text-2xl font-bold text-red-700">{data.totals.divergent}</p></CardContent></Card>
            <Card><CardContent className="pt-5"><p className="text-xs text-neutral-500">Em sync</p><p className="text-2xl font-bold text-emerald-700">{data.totals.inSync}</p></CardContent></Card>
            <Card><CardContent className="pt-5"><p className="text-xs text-neutral-500">Indefinido</p><p className="text-2xl font-bold">{data.totals.unknown}</p></CardContent></Card>
            <Card><CardContent className="pt-5"><p className="text-xs text-neutral-500">Erros consulta</p><p className="text-2xl font-bold text-amber-700">{data.totals.queryErrors}</p></CardContent></Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                Snapshot {data.tenant.slug} - janela ativa agora: {yesNo(data.evaluation.cutoffWindowActiveNow)}
              </CardTitle>
            </CardHeader>
            <CardContent className="text-xs text-neutral-600">
              Gerado em {new Date(data.now).toLocaleString("pt-BR")} com limit={data.evaluation.limit} e timeout={data.evaluation.timeoutMs}ms.
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Clientes analisados ({data.items.length})</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Financeiro</TableHead>
                    <TableHead>Decisao policy</TableHead>
                    <TableHead>Desejado</TableHead>
                    <TableHead>Real MikroTik</TableHead>
                    <TableHead>Divergencia</TableHead>
                    <TableHead>Ultima execucao</TableHead>
                    <TableHead className="text-right">Ação</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.items.map((item) => (
                    <TableRow key={item.clientId}>
                      <TableCell className="font-medium">{item.clientName}</TableCell>
                      <TableCell className="text-xs">
                        <div>Status: {item.financialState.clientStatus}</div>
                        <div>Overdue: {item.financialState.overdueCount}</div>
                        <div>Dias: {item.financialState.maxDaysLate}</div>
                        <div>Carencia: {yesNo(item.financialState.inGrace)}</div>
                      </TableCell>
                      <TableCell className="text-xs">
                        <div>{item.policyDecision.diagnosis}</div>
                        <div>Elegivel delinquent: {yesNo(item.policyDecision.eligibleForDelinquent)}</div>
                      </TableCell>
                      <TableCell className="text-xs">
                        <div>Goal: {item.desiredNetworkState.recommendedSyncGoal}</div>
                        <div>Acesso: {item.desiredNetworkState.effectiveAccess}</div>
                        <div>Esperado: {item.desiredNetworkState.expectedDeviceStatus || "-"}</div>
                      </TableCell>
                      <TableCell className="text-xs">
                        <div>Status: {item.realNetworkState.status}</div>
                        <div>Existe: {yesNo(item.realNetworkState.exists)}</div>
                        <div>Perfil: {item.realNetworkState.profile || "-"}</div>
                        {item.realNetworkState.queryError ? (
                          <div className="text-amber-700">{item.realNetworkState.queryError}</div>
                        ) : null}
                      </TableCell>
                      <TableCell className="text-xs">
                        {item.divergence.status === "divergent" ? (
                          <Badge variant="error">Divergente</Badge>
                        ) : item.divergence.status === "in_sync" ? (
                          <Badge variant="success">Em sync</Badge>
                        ) : (
                          <Badge variant="warning">Indefinido</Badge>
                        )}
                        <div className="mt-1 text-neutral-700">{item.divergence.reason || "-"}</div>
                      </TableCell>
                      <TableCell className="text-xs">
                        <div>Sync state: {item.lastExecution.syncState}</div>
                        <div>Job: {item.lastExecution.lastJobStatus || "-"}</div>
                        <div>Tentativas: {item.lastExecution.lastJobAttempts ?? "-"}</div>
                        <div>Ult. tentativa: {formatDateTime(item.lastExecution.lastAttemptAt)}</div>
                        <div>Ult. sucesso: {formatDateTime(item.lastExecution.lastSuccessAt)}</div>
                      </TableCell>
                      <TableCell className="max-w-[14rem] text-right align-top text-xs">
                        {item.divergence.status === "divergent" ? (
                          <div className="flex flex-col items-end gap-1">
                            <Button
                              type="button"
                              size="sm"
                              variant="secondary"
                              disabled={reconcileBusyId === item.clientId}
                              onClick={() => void runReconcile(item.clientId, item.clientName)}
                            >
                              {reconcileBusyId === item.clientId ? "A enfileirar..." : "Corrigir agora"}
                            </Button>
                            {reconcileFeedback[item.clientId] ? (
                              <span
                                className={
                                  reconcileFeedback[item.clientId].includes("Job enfileirado") ||
                                  reconcileFeedback[item.clientId].includes("pendente")
                                    ? "text-emerald-800"
                                    : "text-red-800"
                                }
                              >
                                {reconcileFeedback[item.clientId]}
                              </span>
                            ) : null}
                          </div>
                        ) : (
                          <span className="text-neutral-400">—</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </>
      ) : null}

      {!data && loading ? <p className="text-sm text-neutral-500">A carregar diagnostico de divergencia...</p> : null}
    </div>
  );
}

