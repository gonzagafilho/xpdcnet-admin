"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { apiFetch } from "@/lib/api-client";
import { userFacingApiError } from "@/lib/user-facing-api-error";
import type {
  ClientFromApi,
  InvoiceFromApi,
  InvoiceGenerateMonthResult,
  InvoiceStatus,
  InvoiceSummaryFromApi,
  PlanFromApi,
} from "@/lib/api-types";
import {
  formatBRL,
  invoiceClientName,
  invoicePlanName,
} from "@/lib/api-types";
import { EmptyState } from "@/components/ui/empty-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/cn";
import { AlertTriangle, CalendarDays, Pencil, Plus, Trash2, Wallet } from "lucide-react";

const PAGE_SIZE = 15;

type ToastState = { variant: "success" | "error"; message: string } | null;

function currentCompetence(): string {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  return `${d.getFullYear()}-${m}`;
}

function statusBadgeVariant(s: InvoiceStatus): "success" | "warning" | "error" | "default" {
  if (s === "paid") return "success";
  if (s === "overdue") return "warning";
  if (s === "cancelled") return "error";
  return "default";
}

function statusLabelPt(s: InvoiceStatus): string {
  if (s === "paid") return "Pago";
  if (s === "overdue") return "Em atraso";
  if (s === "cancelled") return "Cancelado";
  return "Pendente";
}

function formatDatePt(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function toDateInputValue(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toISOString().slice(0, 10);
}

function toDatetimeLocalValue(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function competencePretty(ym: string): string {
  if (!/^\d{4}-\d{2}$/.test(ym)) return ym;
  const [y, m] = ym.split("-").map(Number);
  const d = new Date(y, m - 1, 1);
  const s = d.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function recentSortKey(inv: InvoiceFromApi): number | null {
  const raw = inv.updatedAt || inv.createdAt;
  if (!raw) return null;
  const t = new Date(raw).getTime();
  return Number.isFinite(t) ? t : null;
}

type FormState = {
  clientId: string;
  planId: string;
  amount: string;
  dueDate: string;
  status: InvoiceStatus;
  competence: string;
  description: string;
  paidAtLocal: string;
};

const emptyForm = (): FormState => ({
  clientId: "",
  planId: "",
  amount: "",
  dueDate: new Date().toISOString().slice(0, 10),
  status: "pending",
  competence: currentCompetence(),
  description: "",
  paidAtLocal: "",
});

function invoiceToForm(inv: InvoiceFromApi): FormState {
  const cid = typeof inv.clientId === "object" ? inv.clientId._id : inv.clientId;
  const pid = typeof inv.planId === "object" ? inv.planId._id : inv.planId;
  return {
    clientId: cid,
    planId: pid,
    amount: String(inv.amount),
    dueDate: toDateInputValue(inv.dueDate),
    status: inv.status,
    competence: inv.competence,
    description: inv.description ?? "",
    paidAtLocal: toDatetimeLocalValue(inv.paidAt),
  };
}

export function FinanceiroView() {
  const [invoices, setInvoices] = useState<InvoiceFromApi[]>([]);
  const [clients, setClients] = useState<ClientFromApi[]>([]);
  const [plans, setPlans] = useState<PlanFromApi[]>([]);
  const [loading, setLoading] = useState(true);
  const [listError, setListError] = useState<string | null>(null);
  const [summary, setSummary] = useState<InvoiceSummaryFromApi | null>(null);
  const [summaryError, setSummaryError] = useState<string | null>(null);

  const [statusFilter, setStatusFilter] = useState<"" | InvoiceStatus>("");
  const [clientFilter, setClientFilter] = useState("");
  const [competenceFilter, setCompetenceFilter] = useState("");
  const [debouncedCompetence, setDebouncedCompetence] = useState("");

  const [formModalOpen, setFormModalOpen] = useState(false);
  const [editing, setEditing] = useState<InvoiceFromApi | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm());
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<InvoiceFromApi | null>(null);
  const [statusUpdatingId, setStatusUpdatingId] = useState<string | null>(null);
  const [toast, setToast] = useState<ToastState>(null);

  const [generateOpen, setGenerateOpen] = useState(false);
  const [generateCompetence, setGenerateCompetence] = useState(currentCompetence());
  const [generateSubmitting, setGenerateSubmitting] = useState(false);
  const [generateError, setGenerateError] = useState<string | null>(null);

  const [page, setPage] = useState(1);

  useEffect(() => {
    setPage(1);
  }, [statusFilter, clientFilter, debouncedCompetence]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4500);
    return () => clearTimeout(t);
  }, [toast]);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedCompetence(competenceFilter.trim()), 350);
    return () => clearTimeout(timer);
  }, [competenceFilter]);

  const invoiceQueryString = useMemo(() => {
    const params = new URLSearchParams();
    if (statusFilter) params.set("status", statusFilter);
    if (clientFilter) params.set("clientId", clientFilter);
    if (debouncedCompetence) params.set("competence", debouncedCompetence);
    return params.toString();
  }, [statusFilter, clientFilter, debouncedCompetence]);

  const loadClients = useCallback(async () => {
    const list = await apiFetch<ClientFromApi[]>("/clients");
    setClients(Array.isArray(list) ? list : []);
  }, []);

  const loadPlans = useCallback(async () => {
    const list = await apiFetch<PlanFromApi[]>("/plans");
    setPlans(Array.isArray(list) ? list : []);
  }, []);

  const loadInvoices = useCallback(async () => {
    setListError(null);
    const path = invoiceQueryString ? `/invoices?${invoiceQueryString}` : "/invoices";
    const list = await apiFetch<InvoiceFromApi[]>(path);
    setInvoices(Array.isArray(list) ? list : []);
  }, [invoiceQueryString]);

  const loadSummary = useCallback(async () => {
    setSummaryError(null);
    const path = invoiceQueryString ? `/invoices/summary?${invoiceQueryString}` : "/invoices/summary";
    const data = await apiFetch<InvoiceSummaryFromApi>(path);
    setSummary(data);
  }, [invoiceQueryString]);

  const refreshInvoicesAndSummary = useCallback(async () => {
    await Promise.all([loadInvoices(), loadSummary()]);
  }, [loadInvoices, loadSummary]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setSummaryError(null);
      setListError(null);
      try {
        await loadClients();
        if (!cancelled) await loadPlans();
        if (!cancelled) await loadInvoices();
      } catch (e) {
        if (!cancelled) setListError(userFacingApiError(e));
      }
      try {
        if (!cancelled) await loadSummary();
      } catch (e) {
        if (!cancelled) setSummaryError(userFacingApiError(e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [loadClients, loadInvoices, loadPlans, loadSummary]);

  const openGenerateDialog = () => {
    setGenerateCompetence(currentCompetence());
    setGenerateError(null);
    setGenerateOpen(true);
  };

  const submitGenerateMonth = async () => {
    setGenerateError(null);
    const c = generateCompetence.trim();
    if (!/^\d{4}-\d{2}$/.test(c)) {
      setGenerateError("Indique a competência no formato YYYY-MM.");
      return;
    }
    setGenerateSubmitting(true);
    try {
      const result = await apiFetch<InvoiceGenerateMonthResult>("/invoices/generate-month", {
        method: "POST",
        body: JSON.stringify({ competence: c }),
      });
      const lines: string[] = [];
      if (
        result.createdCount === 0 &&
        result.skippedOtherCount === 0 &&
        result.warnings.length === 0
      ) {
        if (result.skippedDuplicateCount > 0) {
          lines.push(
            `Concluído: nenhuma fatura nova — ${result.skippedDuplicateCount} cliente(s) ativo(s) já tinham cobrança em ${result.competence}.`,
          );
        } else if (result.eligibleCount === 0) {
          lines.push(`Não há clientes ativos para incluir (${result.competence}).`);
        }
      }
      lines.push(
        `Competência ${result.competence}`,
        `Criadas: ${result.createdCount}`,
        `Clientes ativos considerados: ${result.eligibleCount}`,
        `Ignoradas (já existia cobrança): ${result.skippedDuplicateCount}`,
        `Ignoradas (outros motivos): ${result.skippedOtherCount}`,
      );
      if (result.warnings.length > 0) {
        lines.push("—");
        lines.push(...result.warnings.slice(0, 8));
        if (result.warnings.length > 8) lines.push(`… e mais ${result.warnings.length - 8} aviso(s).`);
      }
      setToast({ variant: "success", message: lines.join("\n") });
      setGenerateOpen(false);
      await refreshInvoicesAndSummary();
    } catch (e) {
      setGenerateError(userFacingApiError(e));
    } finally {
      setGenerateSubmitting(false);
    }
  };

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm());
    setFormError(null);
    setFormModalOpen(true);
  };

  const openEdit = (inv: InvoiceFromApi) => {
    setEditing(inv);
    setForm(invoiceToForm(inv));
    setFormError(null);
    setFormModalOpen(true);
  };

  const handleQuickStatus = async (inv: InvoiceFromApi, next: InvoiceStatus) => {
    if (next === inv.status) return;
    setStatusUpdatingId(inv._id);
    try {
      const updated = await apiFetch<InvoiceFromApi>(`/invoices/${inv._id}`, {
        method: "PUT",
        body: JSON.stringify({ status: next }),
      });
      setInvoices((prev) => prev.map((x) => (x._id === inv._id ? updated : x)));
      setToast({ variant: "success", message: "Estado da cobrança atualizado." });
      await loadSummary();
    } catch (e) {
      setToast({ variant: "error", message: userFacingApiError(e) });
    } finally {
      setStatusUpdatingId(null);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    const id = deleteTarget._id;
    try {
      await apiFetch(`/invoices/${id}`, { method: "DELETE" });
      setToast({ variant: "success", message: "Cobrança eliminada." });
      await refreshInvoicesAndSummary();
    } catch (e) {
      setToast({ variant: "error", message: userFacingApiError(e) });
      throw e;
    }
  };

  const submitForm = async () => {
    setFormError(null);

    if (!form.clientId) {
      setFormError("Selecione o cliente.");
      return;
    }
    if (!form.planId) {
      setFormError("Selecione o plano.");
      return;
    }
    const amount = Number(form.amount.replace(",", "."));
    if (Number.isNaN(amount) || amount < 0) {
      setFormError("Valor inválido.");
      return;
    }
    if (!form.dueDate) {
      setFormError("Data de vencimento é obrigatória.");
      return;
    }
    const dueIso = new Date(`${form.dueDate}T12:00:00`).toISOString();
    if (Number.isNaN(new Date(dueIso).getTime())) {
      setFormError("Data de vencimento inválida.");
      return;
    }
    if (!/^\d{4}-\d{2}$/.test(form.competence.trim())) {
      setFormError("Competência deve estar no formato YYYY-MM.");
      return;
    }

    const body: Record<string, unknown> = {
      clientId: form.clientId,
      planId: form.planId,
      amount,
      dueDate: dueIso,
      status: form.status,
      competence: form.competence.trim(),
      description: form.description.trim(),
    };

    if (form.status === "paid" && form.paidAtLocal) {
      body.paidAt = new Date(form.paidAtLocal).toISOString();
    }

    setSaving(true);
    try {
      if (!editing) {
        await apiFetch<InvoiceFromApi>("/invoices", {
          method: "POST",
          body: JSON.stringify(body),
        });
        setToast({ variant: "success", message: "Cobrança criada." });
      } else {
        if (form.status !== "paid") {
          body.paidAt = null;
        } else if (!form.paidAtLocal) {
          delete body.paidAt;
        }
        await apiFetch<InvoiceFromApi>(`/invoices/${editing._id}`, {
          method: "PUT",
          body: JSON.stringify(body),
        });
        setToast({ variant: "success", message: "Cobrança atualizada." });
      }
      setFormModalOpen(false);
      await refreshInvoicesAndSummary();
    } catch (e) {
      setFormError(userFacingApiError(e));
    } finally {
      setSaving(false);
    }
  };

  const clientOptions = useMemo(
    () =>
      clients.map((c) => (
        <option key={c._id} value={c._id}>
          {c.fullName}
        </option>
      )),
    [clients],
  );

  const planOptions = useMemo(
    () =>
      plans.map((p) => (
        <option key={p._id} value={p._id}>
          {p.name} — {formatBRL(p.price)}
        </option>
      )),
    [plans],
  );

  const totalPages = Math.max(1, Math.ceil(invoices.length / PAGE_SIZE));

  useEffect(() => {
    setPage((p) => Math.min(p, totalPages));
  }, [totalPages]);

  const clampedPage = Math.min(page, totalPages);
  const rangeStart = invoices.length === 0 ? 0 : (clampedPage - 1) * PAGE_SIZE + 1;
  const rangeEnd = Math.min(clampedPage * PAGE_SIZE, invoices.length);

  const paginatedInvoices = useMemo(() => {
    const start = (clampedPage - 1) * PAGE_SIZE;
    return invoices.slice(start, start + PAGE_SIZE);
  }, [invoices, clampedPage]);

  const recentMovements = useMemo(() => {
    if (invoices.length === 0) {
      return { kind: "empty" as const, items: [] as InvoiceFromApi[] };
    }
    const withKeys = invoices.map((inv) => ({ inv, t: recentSortKey(inv) }));
    const any = withKeys.some((x) => x.t !== null);
    if (!any) {
      return { kind: "no_timestamps" as const, items: [] as InvoiceFromApi[] };
    }
    const sorted = [...withKeys]
      .filter((x): x is { inv: InvoiceFromApi; t: number } => x.t !== null)
      .sort((a, b) => b.t - a.t)
      .slice(0, 8)
      .map((x) => x.inv);
    return { kind: "list" as const, items: sorted };
  }, [invoices]);

  const activeFilterDescription = useMemo(() => {
    const parts: string[] = [];
    if (statusFilter) parts.push(`estado = ${statusLabelPt(statusFilter)}`);
    if (clientFilter) {
      const c = clients.find((x) => x._id === clientFilter);
      parts.push(`cliente = ${c?.fullName ?? "—"}`);
    }
    if (debouncedCompetence) parts.push(`competência = ${debouncedCompetence}`);
    return parts.join(" · ");
  }, [statusFilter, clientFilter, debouncedCompetence, clients]);

  return (
    <div className="mx-auto w-full max-w-[90rem] space-y-5 pb-2">
      {toast ? (
        <div
          className={
            toast.variant === "success"
              ? "fixed bottom-4 right-4 z-[100] max-w-md rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900 shadow-lg whitespace-pre-line"
              : "fixed bottom-4 right-4 z-[100] max-w-md rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900 shadow-lg whitespace-pre-line"
          }
          role="status"
        >
          {toast.message}
        </div>
      ) : null}

      <div className="border border-neutral-200 bg-white px-4 py-4 sm:px-5">
        <div className="flex flex-col gap-3 border-b border-neutral-100 pb-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="min-w-0">
            <h2 className="text-base font-bold tracking-tight text-neutral-900">Cobranças e faturação</h2>
            <p className="mt-1 max-w-3xl text-sm text-neutral-600">
              Listagem com <span className="font-mono text-xs">GET /invoices</span> (query{" "}
              <span className="font-mono text-xs">status</span>, <span className="font-mono text-xs">clientId</span>,{" "}
              <span className="font-mono text-xs">competence</span>). Totais por estado:{" "}
              <span className="font-mono text-xs">GET /invoices/summary</span> com os mesmos filtros. Geração em lote:{" "}
              <span className="font-mono text-xs">POST /invoices/generate-month</span>.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" variant="outline" size="sm" asChild>
              <Link href="/financeiro/politica">Visão operacional da política</Link>
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="gap-2"
              onClick={openGenerateDialog}
              disabled={loading}
            >
              <CalendarDays className="h-4 w-4" />
              Gerar cobranças do mês
            </Button>
            <Button
              type="button"
              size="sm"
              className="gap-2 border-0 bg-emerald-600 font-semibold text-white hover:bg-emerald-700"
              onClick={openCreate}
              disabled={loading}
            >
              <Plus className="h-4 w-4" />
              Nova cobrança
            </Button>
          </div>
        </div>

        <div className="grid gap-3 border-b border-neutral-100 py-4 sm:grid-cols-2 lg:grid-cols-3 lg:items-end">
          <div className="space-y-1.5">
            <Label
              htmlFor="inv-status-filter"
              className="text-xs font-semibold uppercase tracking-wide text-neutral-500"
            >
              Estado
            </Label>
            <Select
              id="inv-status-filter"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as "" | InvoiceStatus)}
              disabled={loading}
              className="border-neutral-200 bg-white"
            >
              <option value="">Todos</option>
              <option value="pending">Pendente</option>
              <option value="paid">Pago</option>
              <option value="overdue">Em atraso</option>
              <option value="cancelled">Cancelado</option>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label
              htmlFor="inv-client-filter"
              className="text-xs font-semibold uppercase tracking-wide text-neutral-500"
            >
              Cliente
            </Label>
            <Select
              id="inv-client-filter"
              value={clientFilter}
              onChange={(e) => setClientFilter(e.target.value)}
              disabled={loading}
              className="border-neutral-200 bg-white"
            >
              <option value="">Todos</option>
              {clientOptions}
            </Select>
          </div>
          <div className="space-y-1.5 sm:col-span-2 lg:col-span-1">
            <Label
              htmlFor="inv-comp-filter"
              className="text-xs font-semibold uppercase tracking-wide text-neutral-500"
            >
              Competência (YYYY-MM)
            </Label>
            <Input
              id="inv-comp-filter"
              placeholder="2026-04"
              value={competenceFilter}
              onChange={(e) => setCompetenceFilter(e.target.value)}
              disabled={loading}
              className="border-neutral-200 bg-white font-mono"
            />
          </div>
        </div>

        {activeFilterDescription ? (
          <p className="pt-3 text-xs text-neutral-600">
            <span className="font-semibold text-neutral-800">Filtro ativo:</span> {activeFilterDescription}
            {debouncedCompetence && /^\d{4}-\d{2}$/.test(debouncedCompetence) ? (
              <span className="ml-2 text-neutral-500">
                ({competencePretty(debouncedCompetence)})
              </span>
            ) : null}
          </p>
        ) : (
          <p className="pt-3 text-xs text-neutral-500">Sem filtros restritivos — visão de todas as cobranças devolvidas pela API.</p>
        )}
      </div>

      {listError ? (
        <div className="border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900" role="alert">
          {listError}
        </div>
      ) : null}

      <section className="space-y-3" aria-label="Resumo financeiro por estado">
        <div className="px-1">
          <h3 className="text-xs font-bold uppercase tracking-wide text-neutral-500">Leitura por estado</h3>
          <p className="mt-1 text-xs text-neutral-500">
            Valores da API com os filtros atuais. O estado «em atraso» é o registado na cobrança — não há cálculo
            automático por data de vencimento neste painel.
          </p>
        </div>
        {summaryError ? (
          <div
            className="border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950"
            role="alert"
          >
            <span className="font-medium">Resumo indisponível.</span> {summaryError}
          </div>
        ) : null}
        <div
          className={cn(
            "grid gap-4 sm:grid-cols-2 xl:grid-cols-5",
            loading && summary ? "opacity-60 transition-opacity" : "",
          )}
        >
          <div className="rounded-sm border border-neutral-200 bg-white px-6 py-6">
            <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Pendentes</p>
            <p className="mt-3 text-2xl font-bold tabular-nums text-neutral-900">
              {!summary && loading ? "…" : summary ? formatBRL(summary.pending.amount) : "—"}
            </p>
            <p className="mt-1 text-xs text-neutral-500">
              {!summary && loading ? "A carregar…" : summary ? `${summary.pending.count} cobrança(s)` : "—"}
            </p>
          </div>
          <div className="rounded-sm border border-emerald-200 bg-white px-6 py-6">
            <p className="text-xs font-semibold uppercase tracking-wide text-emerald-900/90">Pagas</p>
            <p className="mt-3 text-2xl font-bold tabular-nums text-emerald-900">
              {!summary && loading ? "…" : summary ? formatBRL(summary.paid.amount) : "—"}
            </p>
            <p className="mt-1 text-xs text-emerald-900/80">
              {!summary && loading ? "A carregar…" : summary ? `${summary.paid.count} cobrança(s)` : "—"}
            </p>
          </div>
          <div className="rounded-sm border border-amber-200 bg-white px-6 py-6">
            <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-amber-900/90">
              <AlertTriangle className="h-3.5 w-3.5 shrink-0" aria-hidden />
              Atrasadas
            </p>
            <p className="mt-3 text-2xl font-bold tabular-nums text-amber-950">
              {!summary && loading ? "…" : summary ? formatBRL(summary.overdue.amount) : "—"}
            </p>
            <p className="mt-1 text-xs text-amber-900/80">
              {!summary && loading ? "A carregar…" : summary ? `${summary.overdue.count} cobrança(s)` : "—"}
            </p>
          </div>
          <div className="rounded-sm border border-neutral-200 bg-white px-6 py-6">
            <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Canceladas</p>
            <p className="mt-3 text-2xl font-bold tabular-nums text-neutral-700">
              {!summary && loading ? "…" : summary ? formatBRL(summary.cancelled.amount) : "—"}
            </p>
            <p className="mt-1 text-xs text-neutral-500">
              {!summary && loading ? "A carregar…" : summary ? `${summary.cancelled.count} cobrança(s)` : "—"}
            </p>
          </div>
          <div className="rounded-sm border border-neutral-200 bg-neutral-50/80 px-6 py-6 sm:col-span-2 xl:col-span-1">
            <p className="text-xs font-semibold uppercase tracking-wide text-neutral-600">Total no filtro</p>
            <p className="mt-3 text-2xl font-bold tabular-nums text-neutral-900">
              {!summary && loading ? "…" : summary ? formatBRL(summary.totalAmount) : "—"}
            </p>
            <p className="mt-1 text-xs text-neutral-600">
              {!summary && loading
                ? "A carregar…"
                : summary
                  ? `${summary.totalInvoices} cobrança(s) somadas`
                  : "—"}
            </p>
            {summary?.filters.competence ? (
              <p className="mt-2 font-mono text-[0.65rem] text-neutral-500">
                Competência API: {summary.filters.competence}
              </p>
            ) : null}
          </div>
        </div>
      </section>

      <div className="grid gap-5 xl:grid-cols-4 xl:items-start">
        <div className="space-y-0 xl:col-span-3">
          {loading ? (
            <div className="border border-neutral-200 bg-white px-4 py-16 text-center">
              <p className="text-sm font-medium text-neutral-600">A carregar cobranças…</p>
              <p className="mt-1 text-xs text-neutral-500">A aguardar /invoices e resumo</p>
            </div>
          ) : invoices.length === 0 ? (
            <div className="border border-neutral-200 bg-white px-4 py-6">
              <EmptyState
                icon={<Wallet className="mx-auto h-10 w-10 text-neutral-400" />}
                title="Nenhuma cobrança"
                description={
                  statusFilter || clientFilter || debouncedCompetence
                    ? "Nenhum resultado com os filtros atuais."
                    : "Crie a primeira cobrança com «Nova cobrança» ou use «Gerar cobranças do mês»."
                }
                action={
                  !statusFilter && !clientFilter && !debouncedCompetence ? (
                    <Button
                      type="button"
                      className="border-0 bg-emerald-600 font-semibold text-white hover:bg-emerald-700"
                      onClick={openCreate}
                    >
                      Nova cobrança
                    </Button>
                  ) : undefined
                }
              />
            </div>
          ) : (
            <div className="border border-neutral-200 bg-white">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-neutral-200 px-4 py-3">
                <div>
                  <h3 className="text-sm font-bold text-neutral-900">Cobranças</h3>
                  <p className="text-xs text-neutral-500">
                    {invoices.length} na consulta atual
                    {totalPages > 1 ? ` · página ${clampedPage} de ${totalPages}` : null}
                    <span className="hidden sm:inline">
                      {" "}
                      · paginação local ({PAGE_SIZE} por página) — sem paginação no servidor nesta rota.
                    </span>
                  </p>
                </div>
              </div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs font-bold uppercase tracking-wide text-neutral-600">
                      Cliente
                    </TableHead>
                    <TableHead className="text-xs font-bold uppercase tracking-wide text-neutral-600">
                      Plano
                    </TableHead>
                    <TableHead className="text-xs font-bold uppercase tracking-wide text-neutral-600">
                      Valor
                    </TableHead>
                    <TableHead className="text-xs font-bold uppercase tracking-wide text-neutral-600">
                      Vencimento
                    </TableHead>
                    <TableHead className="text-xs font-bold uppercase tracking-wide text-neutral-600">
                      Competência
                    </TableHead>
                    <TableHead className="text-xs font-bold uppercase tracking-wide text-neutral-600">
                      Estado
                    </TableHead>
                    <TableHead className="text-xs font-bold uppercase tracking-wide text-neutral-600">
                      Pago em
                    </TableHead>
                    <TableHead className="text-right text-xs font-bold uppercase tracking-wide text-neutral-600">
                      Ações
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedInvoices.map((inv) => (
                    <TableRow
                      key={inv._id}
                      className={cn(inv.status === "overdue" && "border-l-4 border-l-amber-400 bg-amber-50/40")}
                    >
                      <TableCell className="font-medium text-neutral-900">
                        {invoiceClientName(inv.clientId)}
                      </TableCell>
                      <TableCell className="max-w-[10rem] truncate text-neutral-600">
                        {invoicePlanName(inv.planId)}
                      </TableCell>
                      <TableCell className="tabular-nums text-neutral-700">{formatBRL(inv.amount)}</TableCell>
                      <TableCell className="whitespace-nowrap text-neutral-600">
                        {formatDatePt(inv.dueDate)}
                      </TableCell>
                      <TableCell className="font-mono text-xs text-neutral-600">{inv.competence}</TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-1.5 sm:flex-row sm:items-center sm:gap-2">
                          <Badge variant={statusBadgeVariant(inv.status)} className="w-fit">
                            {statusLabelPt(inv.status)}
                          </Badge>
                          <Select
                            aria-label="Alterar estado da cobrança"
                            value={inv.status}
                            disabled={statusUpdatingId === inv._id}
                            onChange={(e) => void handleQuickStatus(inv, e.target.value as InvoiceStatus)}
                            className={cn("h-8 w-full min-w-[9rem] border-neutral-200 text-xs sm:w-[9rem]")}
                          >
                            <option value="pending">Pendente</option>
                            <option value="paid">Pago</option>
                            <option value="overdue">Em atraso</option>
                            <option value="cancelled">Cancelado</option>
                          </Select>
                        </div>
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-xs text-neutral-600">
                        {formatDatePt(inv.paidAt ?? undefined)}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap justify-end gap-2">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="gap-1 border-neutral-200"
                            onClick={() => openEdit(inv)}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                            Editar
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="gap-1 border-neutral-200 text-red-700 hover:bg-red-50"
                            onClick={() => setDeleteTarget(inv)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                            Eliminar
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {totalPages > 1 ? (
                <div className="flex flex-wrap items-center justify-between gap-3 border-t border-neutral-200 px-4 py-3 text-sm text-neutral-700">
                  <span className="text-xs text-neutral-500">
                    Mostrando <span className="font-semibold text-neutral-800">{rangeStart}</span>–
                    <span className="font-semibold text-neutral-800">{rangeEnd}</span> de{" "}
                    <span className="font-semibold text-neutral-800">{invoices.length}</span>
                  </span>
                  <div className="flex flex-wrap items-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={clampedPage <= 1}
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                    >
                      Anterior
                    </Button>
                    <span className="tabular-nums text-xs text-neutral-600">
                      Página {clampedPage} / {totalPages}
                    </span>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={clampedPage >= totalPages}
                      onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    >
                      Seguinte
                    </Button>
                  </div>
                </div>
              ) : null}
            </div>
          )}
        </div>

        <aside
          className="border border-neutral-200 bg-white px-5 py-5 xl:col-span-1"
          aria-label="Movimentos recentes"
        >
          <h3 className="text-sm font-bold text-neutral-900">Movimentos recentes</h3>
          <p className="mt-1 text-xs leading-relaxed text-neutral-500">
            Ordenação por <span className="font-mono text-[0.65rem]">updatedAt</span> ou{" "}
            <span className="font-mono text-[0.65rem]">createdAt</span> quando a API os envia na lista filtrada.
          </p>
          {loading ? (
            <p className="mt-6 text-sm text-neutral-500">A carregar…</p>
          ) : recentMovements.kind === "empty" ? (
            <p className="mt-4 text-sm text-neutral-500">Sem cobranças na lista atual.</p>
          ) : recentMovements.kind === "no_timestamps" ? (
            <p className="mt-4 text-sm leading-relaxed text-neutral-600">
              As cobranças desta consulta não incluem datas de criação ou atualização — não é possível listar
              «recentes» de forma honesta. Quando o backend as popular, aparecem aqui automaticamente.
            </p>
          ) : recentMovements.items.length === 0 ? (
            <p className="mt-4 text-sm text-neutral-500">Sem linhas com data na lista atual.</p>
          ) : (
            <ul className="mt-4 space-y-3 border-t border-neutral-100 pt-4">
              {recentMovements.items.map((inv) => (
                <li key={inv._id} className="text-sm">
                  <p className="font-medium text-neutral-900">{invoiceClientName(inv.clientId)}</p>
                  <p className="text-xs text-neutral-500">
                    {formatBRL(inv.amount)} · {inv.competence} · {statusLabelPt(inv.status)}
                  </p>
                  <p className="mt-0.5 font-mono text-[0.65rem] text-neutral-400">
                    {inv.updatedAt || inv.createdAt
                      ? new Date(inv.updatedAt || inv.createdAt || "").toLocaleString("pt-BR")
                      : "—"}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </aside>
      </div>

      <Modal
        open={formModalOpen}
        onOpenChange={setFormModalOpen}
        title={editing ? "Editar cobrança" : "Nova cobrança"}
        description={
          editing
            ? "PUT /invoices/:id — campos alinhados ao invoiceService."
            : "POST /invoices — clientId, planId, amount, dueDate, status e competence (YYYY-MM) obrigatórios no serviço."
        }
        className="max-w-xl"
      >
        <div className="space-y-4">
          {formError ? (
            <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
              {formError}
            </div>
          ) : null}

          <div className="space-y-1.5">
            <Label htmlFor="if-client">Cliente *</Label>
            <Select
              id="if-client"
              value={form.clientId}
              onChange={(e) => setForm((f) => ({ ...f, clientId: e.target.value }))}
            >
              <option value="">Selecione…</option>
              {clientOptions}
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="if-plan">Plano *</Label>
            <Select
              id="if-plan"
              value={form.planId}
              onChange={(e) => setForm((f) => ({ ...f, planId: e.target.value }))}
            >
              <option value="">Selecione…</option>
              {planOptions}
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="if-amount">Valor (R$) *</Label>
              <Input
                id="if-amount"
                inputMode="decimal"
                value={form.amount}
                onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="if-due">Vencimento *</Label>
              <Input
                id="if-due"
                type="date"
                value={form.dueDate}
                onChange={(e) => setForm((f) => ({ ...f, dueDate: e.target.value }))}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="if-comp">Competência (YYYY-MM) *</Label>
              <Input
                id="if-comp"
                placeholder="2026-04"
                value={form.competence}
                onChange={(e) => setForm((f) => ({ ...f, competence: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="if-status">Estado *</Label>
              <Select
                id="if-status"
                value={form.status}
                onChange={(e) => setForm((f) => ({ ...f, status: e.target.value as InvoiceStatus }))}
              >
                <option value="pending">Pendente</option>
                <option value="paid">Pago</option>
                <option value="overdue">Em atraso</option>
                <option value="cancelled">Cancelado</option>
              </Select>
            </div>
          </div>
          {form.status === "paid" ? (
            <div className="space-y-1.5">
              <Label htmlFor="if-paid">Pago em (opcional — vazio usa regra do servidor)</Label>
              <Input
                id="if-paid"
                type="datetime-local"
                value={form.paidAtLocal}
                onChange={(e) => setForm((f) => ({ ...f, paidAtLocal: e.target.value }))}
              />
            </div>
          ) : null}
          <div className="space-y-1.5">
            <Label htmlFor="if-desc">Descrição / notas</Label>
            <textarea
              id="if-desc"
              rows={3}
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              className="flex w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 shadow-sm placeholder:text-zinc-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400 focus-visible:ring-offset-1"
            />
          </div>
          <div className="flex flex-wrap gap-2 border-t border-neutral-100 pt-4">
            <Button type="button" variant="secondary" onClick={() => setFormModalOpen(false)} disabled={saving}>
              Cancelar
            </Button>
            <Button
              type="button"
              className="border-0 bg-emerald-600 font-semibold text-white hover:bg-emerald-700"
              onClick={() => void submitForm()}
              disabled={saving}
            >
              {saving ? "A guardar…" : editing ? "Guardar" : "Criar"}
            </Button>
          </div>
        </div>
      </Modal>

      <Modal
        open={generateOpen}
        onOpenChange={(o) => {
          setGenerateOpen(o);
          if (!o) setGenerateError(null);
        }}
        title="Gerar cobranças do mês"
        description="Cria faturas pendentes para todos os clientes ativos (POST /invoices/generate-month). Valor e vencimento seguem o cadastro. Quem já tem cobrança na competência é ignorado."
        className="max-w-md"
      >
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="gen-comp" className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
              Competência (YYYY-MM)
            </Label>
            <Input
              id="gen-comp"
              placeholder="2026-04"
              value={generateCompetence}
              onChange={(e) => setGenerateCompetence(e.target.value)}
              disabled={generateSubmitting}
              className="border-neutral-200 font-mono"
            />
          </div>
          {generateError ? (
            <p className="text-sm text-red-700" role="alert">
              {generateError}
            </p>
          ) : null}
          <div className="flex flex-wrap justify-end gap-2 border-t border-neutral-100 pt-4">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setGenerateOpen(false)}
              disabled={generateSubmitting}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              className="border-0 bg-emerald-600 font-semibold text-white hover:bg-emerald-700"
              onClick={() => void submitGenerateMonth()}
              disabled={generateSubmitting}
            >
              {generateSubmitting ? "A gerar…" : "Gerar"}
            </Button>
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(o) => !o && setDeleteTarget(null)}
        title="Eliminar cobrança"
        description={
          deleteTarget
            ? `Eliminar cobrança de competência ${deleteTarget.competence} (${formatBRL(deleteTarget.amount)})?`
            : ""
        }
        confirmLabel="Eliminar"
        variant="destructive"
        onConfirm={handleDelete}
      />
    </div>
  );
}
