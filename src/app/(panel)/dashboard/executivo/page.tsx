"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { apiFetch } from "@/lib/api-client";
import { userFacingApiError } from "@/lib/user-facing-api-error";
import type { ExecutiveDashboardFromApi } from "@/lib/api-types";
import { AlertTriangle, BarChart3, CheckCircle2, ShieldAlert, ShieldCheck, TimerReset, Wallet } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AlertBanner } from "@/components/ui/alert-banner";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { StatCard } from "@/components/ui/stat-card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

function pct(v: number): string {
  return `${v.toFixed(1)}%`;
}

export default function DashboardExecutivoPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<ExecutiveDashboardFromApi | null>(null);

  const load = useCallback(async () => {
    setError(null);
    const payload = await apiFetch<ExecutiveDashboardFromApi>("/operations/executive-dashboard");
    setData(payload);
  }, []);

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
          <h1 className="text-xl font-bold tracking-tight text-dcnet-text">Painel executivo</h1>
          <p className="text-sm text-dcnet-muted">
            Resumo para decisões rápidas.
          </p>
        </div>
        <div className="flex gap-2">
          <Button type="button" variant="outline" onClick={() => void load()} disabled={loading}>
            Atualizar
          </Button>
          <Button type="button" asChild>
            <Link href="/dashboard">Voltar dashboard</Link>
          </Button>
        </div>
      </div>

      {error ? <AlertBanner tone="error">{error}</AlertBanner> : null}

      {data ? (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard label="Vão bloquear hoje" value={data.executive.willBlockToday} icon={ShieldAlert} tone="warning" compact />
            <StatCard label="Em carência" value={data.executive.inGrace} icon={TimerReset} tone="info" compact />
            <StatCard label="Já bloqueados" value={data.executive.alreadyBlocked} icon={AlertTriangle} tone="error" compact />
            <StatCard label="Protegidos" value={data.executive.protected} icon={ShieldCheck} tone="success" compact />
            <StatCard label="Divergentes" value={data.executive.divergent} icon={Wallet} tone="error" compact />
            <StatCard label="Falharam hoje" value={data.executive.failedExecutionsToday} icon={AlertTriangle} tone="warning" compact />
            <StatCard label="Execuções ok hoje" value={data.executive.doneExecutionsToday} icon={CheckCircle2} tone="success" compact />
            <StatCard label="Taxa sucesso" value={pct(data.executive.operationalSuccessRate)} icon={BarChart3} tone="primary" compact />
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Ações com falha hoje ({data.details.failedJobsToday.length})</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {data.details.failedJobsToday.length ? (
                <Table containerClassName="rounded-none border-x-0 border-b-0 shadow-none">
                  <TableHeader>
                    <TableRow>
                      <TableHead>Cliente</TableHead>
                      <TableHead>Tentativas</TableHead>
                      <TableHead>Executado em</TableHead>
                      <TableHead>Erro</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.details.failedJobsToday.map((f) => (
                      <TableRow key={f.id}>
                        <TableCell>{f.clientName}</TableCell>
                        <TableCell>{f.attempts}</TableCell>
                        <TableCell>{f.executedAt ? new Date(f.executedAt).toLocaleString("pt-BR") : "-"}</TableCell>
                        <TableCell className="text-xs text-dcnet-secondary">{f.lastError || "-"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="p-5">
                  <EmptyState
                    icon={<CheckCircle2 className="h-5 w-5" />}
                    title="Nenhuma falha registrada hoje"
                    description="Tudo está estável hoje."
                  />
                </div>
              )}
            </CardContent>
          </Card>
        </>
      ) : null}

      {!data && loading ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 8 }).map((_, index) => (
            <div key={index} className="xp-card-surface h-24 p-4">
              <Skeleton className="h-3 w-28" />
              <Skeleton className="mt-4 h-7 w-20" />
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
