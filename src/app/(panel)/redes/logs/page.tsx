"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertCircle, ChevronLeft, ChevronRight, FileJson, Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { Select } from "@/components/ui/select";
import { apiFetch, ApiRequestError } from "@/lib/api-client";
import type { OperationLogItemFromApi, OperationLogsPageFromApi } from "@/lib/api-types";

function formatPtDate(iso: string | null): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "medium" });
  } catch {
    return "—";
  }
}

function resultSummary(row: OperationLogItemFromApi): string {
  const r = row.result;
  if (r && typeof r === "object" && !Array.isArray(r)) {
    const o = r as Record<string, unknown>;
    if (typeof o.success === "boolean") return o.success ? "success: true" : "success: false";
    if (typeof o.message === "string" && o.message.trim()) return o.message.trim().slice(0, 160);
  }
  if (row.status === "error" && row.errorMessage) return row.errorMessage.slice(0, 200);
  return row.status === "success" ? "OK" : "—";
}

export default function RedesLogsOperacionaisPage() {
  const [items, setItems] = useState<OperationLogItemFromApi[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(25);
  const [tenantSlug, setTenantSlug] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [action, setAction] = useState("");
  const [targetType, setTargetType] = useState("");
  const [status, setStatus] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const [jsonRow, setJsonRow] = useState<OperationLogItemFromApi | null>(null);

  const totalPages = useMemo(() => Math.max(1, Math.ceil(total / pageSize)), [total, pageSize]);

  const load = useCallback(async (pageOverride?: number) => {
    setLoading(true);
    setError(null);
    const p = pageOverride ?? page;
    const q = new URLSearchParams();
    q.set("page", String(p));
    q.set("pageSize", String(pageSize));
    if (action.trim()) q.set("action", action.trim());
    if (targetType.trim()) q.set("targetType", targetType.trim());
    if (status === "success" || status === "error") q.set("status", status);
    if (from.trim()) q.set("from", from.trim());
    if (to.trim()) q.set("to", to.trim());
    try {
      const data = await apiFetch<OperationLogsPageFromApi>(`/operations/logs?${q.toString()}`, {
        auth: true,
        timeoutMs: 60_000,
      });
      setItems(Array.isArray(data.items) ? data.items : []);
      setTotal(typeof data.total === "number" ? data.total : 0);
      setTenantSlug(data.tenantSlug ?? null);
    } catch (e) {
      const msg = e instanceof ApiRequestError ? e.message : e instanceof Error ? e.message : "Falha ao carregar o histórico.";
      setError(msg);
      setItems([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, action, targetType, status, from, to]);

  useEffect(() => {
    void load();
  }, [load]);

  const applyFilters = () => {
    setPage(1);
    void load(1);
  };

  return (
    <div className="mx-auto w-full max-w-[90rem] space-y-6 pb-10">
      <div className="flex flex-col gap-4 border-b border-slate-200/90 pb-6 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">Redes · Operações</p>
          <h1 className="mt-1 text-xl font-semibold tracking-tight text-slate-900 sm:text-2xl">Logs operacionais</h1>
          <p className="mt-2 max-w-2xl text-sm text-slate-600">
            Auditoria de acções no tenant actual{tenantSlug ? ` (${tenantSlug})` : ""}. Dados sensíveis são redigidos no
            servidor.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline" size="sm" className="border-slate-200">
            <Link href="/redes/servidores">Servidores</Link>
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="gap-2 border-slate-200"
            onClick={() => void load()}
            disabled={loading}
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <RefreshCw className="h-4 w-4" aria-hidden />}
            Actualizar
          </Button>
        </div>
      </div>

      <Card className="border-slate-200/95 shadow-sm ring-1 ring-slate-900/[0.035]">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Filtros</CardTitle>
          <CardDescription className="text-sm">Combinação de critérios — período em ISO ou datetime local suportado pelo browser.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 pt-0 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          <div className="space-y-1">
            <label className="text-[11px] font-semibold text-slate-600">Acção</label>
            <Input value={action} onChange={(e) => setAction(e.target.value)} placeholder="Ex.: atualização concluída" className="font-mono text-xs" />
          </div>
          <div className="space-y-1">
            <label className="text-[11px] font-semibold text-slate-600">Tipo de alvo</label>
            <Input value={targetType} onChange={(e) => setTargetType(e.target.value)} placeholder="Ex.: unidade remota" className="font-mono text-xs" />
          </div>
          <div className="space-y-1">
            <label className="text-[11px] font-semibold text-slate-600">Estado</label>
            <Select value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="">Todos</option>
              <option value="success">success</option>
              <option value="error">error</option>
            </Select>
          </div>
          <div className="space-y-1">
            <label className="text-[11px] font-semibold text-slate-600">Desde</label>
            <Input value={from} onChange={(e) => setFrom(e.target.value)} placeholder="2026-01-01T00:00:00" className="font-mono text-xs" />
          </div>
          <div className="space-y-1">
            <label className="text-[11px] font-semibold text-slate-600">Até</label>
            <Input value={to} onChange={(e) => setTo(e.target.value)} placeholder="2026-12-31T23:59:59" className="font-mono text-xs" />
          </div>
          <div className="flex items-end">
            <Button type="button" size="sm" className="w-full bg-slate-900 text-white hover:bg-slate-800" onClick={() => applyFilters()}>
              Aplicar
            </Button>
          </div>
        </CardContent>
      </Card>

      {error ? (
        <div className="flex items-start gap-3 rounded-lg border border-rose-200/90 bg-rose-50/90 px-4 py-3 text-sm text-rose-900" role="alert">
          <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-rose-600" aria-hidden />
          <div>
            <p className="font-semibold">Erro</p>
            <p className="mt-1">{error}</p>
          </div>
        </div>
      ) : null}

      <Card className="overflow-hidden border-slate-200/95 shadow-sm ring-1 ring-slate-900/[0.035]">
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2 border-b border-slate-100 bg-slate-50/80 py-3">
          <CardTitle className="text-sm font-semibold text-slate-900">Registos</CardTitle>
          <p className="text-xs text-slate-500">
            {total.toLocaleString("pt-BR")} total · página {page} / {totalPages}
          </p>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center gap-2 px-4 py-10 text-sm text-slate-600">
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              A carregar…
            </div>
          ) : items.length === 0 ? (
            <p className="px-4 py-10 text-center text-sm text-slate-600">Nenhum registo com os filtros actuais.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[960px] border-collapse text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-200 bg-white text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500">
                    <th className="px-3 py-2.5">Data</th>
                    <th className="px-3 py-2.5">Acção</th>
                    <th className="px-3 py-2.5">Alvo</th>
                    <th className="px-3 py-2.5">Estado</th>
                    <th className="px-3 py-2.5">Tenant</th>
                    <th className="px-3 py-2.5">Resumo</th>
                    <th className="px-3 py-2.5 text-right">Detalhe</th>
                  </tr>
                </thead>
                <tbody className="text-slate-800">
                  {items.map((row) => (
                    <tr key={row.id} className="border-b border-slate-100 hover:bg-slate-50/80">
                      <td className="whitespace-nowrap px-3 py-2 text-xs tabular-nums text-slate-600">{formatPtDate(row.createdAt)}</td>
                      <td className="max-w-[200px] truncate px-3 py-2 font-mono text-xs" title={row.action}>
                        {row.action}
                      </td>
                      <td className="max-w-[220px] truncate px-3 py-2 text-xs" title={`${row.targetType} ${row.targetId}`}>
                        <span className="font-medium text-slate-700">{row.targetType}</span>
                        {row.targetId ? <span className="ml-1 font-mono text-slate-500">{row.targetId}</span> : null}
                      </td>
                      <td className="px-3 py-2">
                        <span
                          className={
                            row.status === "error"
                              ? "rounded bg-rose-50 px-1.5 py-0.5 text-xs font-semibold text-rose-800"
                              : "rounded bg-emerald-50 px-1.5 py-0.5 text-xs font-semibold text-emerald-800"
                          }
                        >
                          {row.status}
                        </span>
                      </td>
                      <td className="max-w-[120px] truncate px-3 py-2 font-mono text-[11px] text-slate-500" title={row.tenantId || ""}>
                        {tenantSlug || row.tenantId || "—"}
                      </td>
                      <td className="max-w-[280px] truncate px-3 py-2 text-xs text-slate-600" title={resultSummary(row)}>
                        {resultSummary(row)}
                      </td>
                      <td className="px-3 py-2 text-right">
                        <Button type="button" size="sm" variant="outline" className="h-8 gap-1 text-xs" onClick={() => setJsonRow(row)}>
                          <FileJson className="h-3.5 w-3.5" aria-hidden />
                          JSON
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={loading || page <= 1}
          onClick={() => setPage((p) => Math.max(1, p - 1))}
          className="gap-1"
        >
          <ChevronLeft className="h-4 w-4" aria-hidden />
          Anterior
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={loading || page >= totalPages}
          onClick={() => setPage((p) => p + 1)}
          className="gap-1"
        >
          Seguinte
          <ChevronRight className="h-4 w-4" aria-hidden />
        </Button>
      </div>

      <Modal
        open={jsonRow != null}
        onOpenChange={(o) => {
          if (!o) setJsonRow(null);
        }}
        title="Detalhes do evento"
        description={jsonRow ? `${jsonRow.action} · ${jsonRow.id}` : ""}
        className="max-w-3xl"
      >
        {jsonRow ? (
          <pre className="max-h-[60vh] overflow-auto rounded-lg border border-slate-200 bg-slate-950 p-4 text-left text-[11px] leading-relaxed text-emerald-100">
            {JSON.stringify(jsonRow, null, 2)}
          </pre>
        ) : null}
      </Modal>
    </div>
  );
}
