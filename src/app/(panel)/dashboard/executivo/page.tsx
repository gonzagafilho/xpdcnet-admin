"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { apiFetch } from "@/lib/api-client";
import { userFacingApiError } from "@/lib/user-facing-api-error";
import type { ExecutiveDashboardFromApi } from "@/lib/api-types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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
          <h1 className="text-xl font-bold tracking-tight text-neutral-900">Dashboard executivo operacional</h1>
          <p className="text-sm text-neutral-600">
            Leitura consolidada da política financeira, execução de fila e divergência de rede.
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

      {error ? <p className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</p> : null}

      {data ? (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Card><CardContent className="pt-5"><p className="text-xs text-neutral-500">Vão bloquear hoje</p><p className="text-2xl font-bold">{data.executive.willBlockToday}</p></CardContent></Card>
            <Card><CardContent className="pt-5"><p className="text-xs text-neutral-500">Em carência</p><p className="text-2xl font-bold">{data.executive.inGrace}</p></CardContent></Card>
            <Card><CardContent className="pt-5"><p className="text-xs text-neutral-500">Já bloqueados</p><p className="text-2xl font-bold">{data.executive.alreadyBlocked}</p></CardContent></Card>
            <Card><CardContent className="pt-5"><p className="text-xs text-neutral-500">Protegidos</p><p className="text-2xl font-bold">{data.executive.protected}</p></CardContent></Card>
            <Card><CardContent className="pt-5"><p className="text-xs text-neutral-500">Divergentes</p><p className="text-2xl font-bold text-red-700">{data.executive.divergent}</p></CardContent></Card>
            <Card><CardContent className="pt-5"><p className="text-xs text-neutral-500">Falharam hoje</p><p className="text-2xl font-bold text-amber-700">{data.executive.failedExecutionsToday}</p></CardContent></Card>
            <Card><CardContent className="pt-5"><p className="text-xs text-neutral-500">Execuções ok hoje</p><p className="text-2xl font-bold text-emerald-700">{data.executive.doneExecutionsToday}</p></CardContent></Card>
            <Card><CardContent className="pt-5"><p className="text-xs text-neutral-500">Taxa sucesso operacional</p><p className="text-2xl font-bold">{pct(data.executive.operationalSuccessRate)}</p></CardContent></Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Falhas de execução hoje ({data.details.failedJobsToday.length})</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
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
                      <TableCell className="text-xs text-neutral-700">{f.lastError || "-"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </>
      ) : null}

      {!data && loading ? <p className="text-sm text-neutral-500">A carregar visão executiva...</p> : null}
    </div>
  );
}
