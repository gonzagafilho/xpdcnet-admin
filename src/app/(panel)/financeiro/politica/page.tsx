"use client";

import { useCallback, useEffect, useState } from "react";
import { apiFetch } from "@/lib/api-client";
import { userFacingApiError } from "@/lib/user-facing-api-error";
import type { FinancePolicyImpactFromApi } from "@/lib/api-types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";

function yesNo(v: boolean): string {
  return v ? "Sim" : "Não";
}

export default function FinanceiroPoliticaPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<FinancePolicyImpactFromApi | null>(null);
  const [limit, setLimit] = useState("200");

  const load = useCallback(async () => {
    setError(null);
    const lim = Math.max(20, Math.min(500, Number(limit) || 200));
    const payload = await apiFetch<FinancePolicyImpactFromApi>(`/invoices/finance-policy-impact?limit=${lim}`);
    setData(payload);
  }, [limit]);

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
          <h1 className="text-xl font-bold tracking-tight text-neutral-900">Impacto da política financeira</h1>
          <p className="text-sm text-neutral-600">
            Diagnóstico de quem está em carência, elegível para delinquent, fora da janela ou apto para religação.
          </p>
        </div>
        <div className="flex items-end gap-2">
          <div className="w-28">
            <Label htmlFor="limit">Limite</Label>
            <Input id="limit" type="number" min={20} max={500} value={limit} onChange={(e) => setLimit(e.target.value)} />
          </div>
          <Button type="button" variant="outline" onClick={() => void load()} disabled={loading}>
            Atualizar
          </Button>
          <Button type="button" asChild>
            <Link href="/financeiro">Voltar ao financeiro</Link>
          </Button>
        </div>
      </div>

      {error ? <p className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</p> : null}

      {data ? (
        <>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Política aplicada ({data.tenant.slug})</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
              <p>Automação: <span className="font-semibold">{yesNo(data.policy.financeAutomationEnabled)}</span></p>
              <p>Carência: <span className="font-semibold">{data.policy.financeGraceDays} dia(s)</span></p>
              <p>Mínimo overdue: <span className="font-semibold">{data.policy.financeMinOverdueInvoices}</span></p>
              <p>Janela: <span className="font-semibold">{yesNo(data.policy.financeCutoffWindowEnabled)}</span></p>
              <p>Hora início: <span className="font-semibold">{data.policy.financeCutoffStartHour}</span></p>
              <p>Hora fim: <span className="font-semibold">{data.policy.financeCutoffEndHour}</span></p>
              <p>Timezone: <span className="font-semibold">{data.policy.financeTimezone}</span></p>
              <p>Auto-reativar: <span className="font-semibold">{yesNo(data.policy.financeAutoReactivateWhenClear)}</span></p>
              <p className="sm:col-span-2 lg:col-span-4 text-xs text-neutral-500">
                Período de bloqueio ativo agora: <strong>{yesNo(data.evaluation.cutoffWindowActiveNow)}</strong> · Leitura atualizada em{" "}
                {new Date(data.now).toLocaleString("pt-BR")}
              </p>
            </CardContent>
          </Card>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Card><CardContent className="pt-5"><p className="text-xs text-neutral-500">Com overdue</p><p className="text-2xl font-bold">{data.totals.withOverdue}</p></CardContent></Card>
            <Card><CardContent className="pt-5"><p className="text-xs text-neutral-500">Em carência</p><p className="text-2xl font-bold">{data.totals.inGrace}</p></CardContent></Card>
            <Card><CardContent className="pt-5"><p className="text-xs text-neutral-500">Elegíveis para delinquent</p><p className="text-2xl font-bold">{data.totals.eligibleForDelinquent}</p></CardContent></Card>
            <Card><CardContent className="pt-5"><p className="text-xs text-neutral-500">Delinquent (total)</p><p className="text-2xl font-bold">{data.totals.totalDelinquent}</p></CardContent></Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Clientes afetados ({data.items.length})</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Overdue</TableHead>
                    <TableHead className="text-right">Dias atraso</TableHead>
                    <TableHead>Sinais</TableHead>
                    <TableHead>Diagnóstico</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.items.map((item) => (
                    <TableRow key={item.clientId}>
                      <TableCell className="font-medium">{item.clientName}</TableCell>
                      <TableCell>{item.clientStatus}</TableCell>
                      <TableCell className="text-right tabular-nums">{item.overdueCount}</TableCell>
                      <TableCell className="text-right tabular-nums">{item.maxDaysLate}</TableCell>
                      <TableCell className="space-x-1">
                        {item.inGrace ? <Badge variant="default">Carência</Badge> : null}
                        {item.eligibleForDelinquent ? <Badge variant="warning">Elegível bloqueio</Badge> : null}
                        {item.blockedByCutoffWindow ? <Badge variant="default">Fora da janela</Badge> : null}
                        {item.protectedStatus ? <Badge variant="error">Status protegido</Badge> : null}
                        {item.wouldReactivateWhenClear ? <Badge variant="success">Reativação</Badge> : null}
                      </TableCell>
                      <TableCell className="text-xs text-neutral-700">{item.diagnosis}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </>
      ) : null}

      {!data && loading ? <p className="text-sm text-neutral-500">A carregar visão rápida comercial...</p> : null}
    </div>
  );
}

