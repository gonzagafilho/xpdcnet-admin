"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { apiFetch } from "@/lib/api-client";
import { userFacingApiError } from "@/lib/user-facing-api-error";
import type { ExecutiveDashboardFromApi } from "@/lib/api-types";
import {
  AlertTriangle,
  ArrowUpRight,
  BarChart3,
  CheckCircle2,
  Clock3,
  ShieldAlert,
  ShieldCheck,
  TimerReset,
  Wallet,
} from "lucide-react";
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
          <h1 className="text-xl font-bold tracking-tight text-dcnet-text">Dashboard executivo</h1>
          <p className="text-sm text-dcnet-muted">Visão comercial do dia.</p>
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
          <section className="grid gap-3 lg:grid-cols-3">
            <Card className="xp-card-surface border-dcnet-warning/30">
              <CardContent className="p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-dcnet-warning">Risco de hoje</p>
                <p className="mt-1 text-3xl font-bold text-dcnet-text">{data.executive.willBlockToday}</p>
                <p className="mt-1 text-xs text-dcnet-muted">Clientes para atenção imediata.</p>
              </CardContent>
            </Card>
            <Card className="xp-card-surface border-dcnet-success/30">
              <CardContent className="p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-dcnet-success">Proteção ativa</p>
                <p className="mt-1 text-3xl font-bold text-dcnet-text">{data.executive.protected}</p>
                <p className="mt-1 text-xs text-dcnet-muted">Clientes com situação regular.</p>
              </CardContent>
            </Card>
            <Card className="xp-card-surface border-dcnet-primary/30">
              <CardContent className="p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-dcnet-primary">Desempenho diário</p>
                <p className="mt-1 text-3xl font-bold text-dcnet-text">{pct(data.executive.operationalSuccessRate)}</p>
                <p className="mt-1 text-xs text-dcnet-muted">Taxa de execução do dia.</p>
              </CardContent>
            </Card>
          </section>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard label="Atenção hoje" value={data.executive.willBlockToday} icon={ShieldAlert} tone="warning" compact />
            <StatCard label="Em carência" value={data.executive.inGrace} icon={TimerReset} tone="info" compact />
            <StatCard label="Com bloqueio" value={data.executive.alreadyBlocked} icon={AlertTriangle} tone="error" compact />
            <StatCard label="Protegidos" value={data.executive.protected} icon={ShieldCheck} tone="success" compact />
            <StatCard label="Com diferença" value={data.executive.divergent} icon={Wallet} tone="error" compact />
            <StatCard label="Falhas hoje" value={data.executive.failedExecutionsToday} icon={Clock3} tone="warning" compact />
            <StatCard label="Acertos hoje" value={data.executive.doneExecutionsToday} icon={CheckCircle2} tone="success" compact />
            <StatCard label="Resultado" value={pct(data.executive.operationalSuccessRate)} icon={BarChart3} tone="primary" compact />
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Prioridades do dia ({data.details.failedJobsToday.length})</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {data.details.failedJobsToday.length ? (
                <Table containerClassName="rounded-none border-x-0 border-b-0 shadow-none">
                  <TableHeader>
                    <TableRow>
                      <TableHead>Cliente</TableHead>
                      <TableHead className="w-28">Tentativas</TableHead>
                      <TableHead className="w-48">Última ação</TableHead>
                      <TableHead>Resumo</TableHead>
                      <TableHead className="w-16 text-right">Ir</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.details.failedJobsToday.map((f) => (
                      <TableRow key={f.id}>
                        <TableCell>{f.clientName}</TableCell>
                        <TableCell>{f.attempts}</TableCell>
                        <TableCell>{f.executedAt ? new Date(f.executedAt).toLocaleString("pt-BR") : "-"}</TableCell>
                        <TableCell className="text-xs text-dcnet-secondary">{f.lastError || "Sem detalhe"}</TableCell>
                        <TableCell className="text-right">
                          <Button variant="ghost" size="sm" asChild>
                            <Link href="/financeiro/divergencias">
                              <ArrowUpRight className="h-3.5 w-3.5" />
                            </Link>
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="p-5">
                  <EmptyState
                    icon={<CheckCircle2 className="h-5 w-5" />}
                    title="Sem prioridades abertas"
                    description="Dia estável e sem pendências."
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
