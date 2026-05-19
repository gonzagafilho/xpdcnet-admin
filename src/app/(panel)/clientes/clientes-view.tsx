"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { apiFetch } from "@/lib/api-client";
import { userFacingApiError } from "@/lib/user-facing-api-error";
import type { ClientFromApi, ClientStatus, PlanFromApi } from "@/lib/api-types";
import { planDisplayName } from "@/lib/api-types";
import {
  CLIENT_STATUS_AUTOMATION_FOOTNOTE,
  CLIENT_STATUS_DISTINCTION_SUMMARY,
  CLIENT_STATUS_GUIDE_SECTIONS,
  CLIENT_STATUS_OPTIONS,
  clientStatusBadgeVariant,
  clientStatusLabelPt,
} from "@/lib/client-status";
import type { ClientOverdueRollup } from "@/lib/client-overdue-invoices";
import { fetchOverdueRollupByClientId } from "@/lib/client-overdue-invoices";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
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
import {
  AlertTriangle,
  ArrowRight,
  Ban,
  Pencil,
  Plus,
  Search,
  Trash2,
  UserCheck,
  Users,
} from "lucide-react";
import { ClientDelinquencyRulerPanel } from "./client-delinquency-ruler";
import { ClienteFormModal } from "./cliente-form-modal";

const PAGE_SIZE = 15;

type ToastState = { variant: "success" | "error"; message: string } | null;

export function ClientesView() {
  const [clients, setClients] = useState<ClientFromApi[]>([]);
  const [plans, setPlans] = useState<PlanFromApi[]>([]);
  const [loading, setLoading] = useState(true);
  const [listError, setListError] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"" | ClientStatus>("");
  const [page, setPage] = useState(1);

  const [clientModalOpen, setClientModalOpen] = useState(false);
  const [clientModalMode, setClientModalMode] = useState<"create" | "edit">("create");
  const [editingClient, setEditingClient] = useState<ClientFromApi | null>(null);

  const [deleteTarget, setDeleteTarget] = useState<ClientFromApi | null>(null);
  const [blockConfirmTarget, setBlockConfirmTarget] = useState<ClientFromApi | null>(null);
  const [statusUpdatingId, setStatusUpdatingId] = useState<string | null>(null);
  const [overdueByClient, setOverdueByClient] = useState<Map<string, ClientOverdueRollup>>(() => new Map());
  const [toast, setToast] = useState<ToastState>(null);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4500);
    return () => clearTimeout(t);
  }, [toast]);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search.trim()), 350);
    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, statusFilter]);

  const totalPages = Math.max(1, Math.ceil(clients.length / PAGE_SIZE));

  useEffect(() => {
    setPage((p) => Math.min(p, totalPages));
  }, [totalPages]);

  const paginatedClients = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return clients.slice(start, start + PAGE_SIZE);
  }, [clients, page]);

  const clientKpis = useMemo(() => {
    let active = 0;
    let delinquent = 0;
    let blocked = 0;
    for (const c of clients) {
      if (c.status === "active") active += 1;
      else if (c.status === "delinquent") delinquent += 1;
      else if (c.status === "blocked") blocked += 1;
    }
    return { total: clients.length, active, delinquent, blocked };
  }, [clients]);

  const loadPlans = useCallback(async () => {
    const list = await apiFetch<PlanFromApi[]>("/plans");
    setPlans(Array.isArray(list) ? list : []);
  }, []);

  const loadClients = useCallback(async () => {
    setListError(null);
    const params = new URLSearchParams();
    if (debouncedSearch) params.set("search", debouncedSearch);
    if (statusFilter) params.set("status", statusFilter);
    const qs = params.toString();
    const path = qs ? `/clients?${qs}` : "/clients";
    const list = await apiFetch<ClientFromApi[]>(path);
    setClients(Array.isArray(list) ? list : []);
  }, [debouncedSearch, statusFilter]);

  const loadOverdueRollups = useCallback(async () => {
    try {
      setOverdueByClient(await fetchOverdueRollupByClientId());
    } catch {
      setOverdueByClient(new Map());
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        await Promise.all([loadPlans(), loadClients(), loadOverdueRollups()]);
      } catch (e) {
        if (!cancelled) setListError(userFacingApiError(e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [loadClients, loadOverdueRollups, loadPlans]);

  const openCreate = () => {
    setEditingClient(null);
    setClientModalMode("create");
    setClientModalOpen(true);
  };

  const openEdit = (c: ClientFromApi) => {
    setEditingClient(c);
    setClientModalMode("edit");
    setClientModalOpen(true);
  };

  const handleQuickStatus = async (c: ClientFromApi, next: ClientStatus, successMessage?: string) => {
    if (next === c.status) return;
    setStatusUpdatingId(c._id);
    try {
      const updated = await apiFetch<ClientFromApi>(`/clients/${c._id}`, {
        method: "PUT",
        body: JSON.stringify({ status: next }),
      });
      setClients((prev) => prev.map((x) => (x._id === c._id ? updated : x)));
      setToast({
        variant: "success",
        message: successMessage ?? "Estado do cliente atualizado.",
      });
    } catch (e) {
      setToast({ variant: "error", message: userFacingApiError(e) });
    } finally {
      setStatusUpdatingId(null);
    }
  };

  const confirmBlockClient = async () => {
    if (!blockConfirmTarget) return;
    const c = blockConfirmTarget;
    await handleQuickStatus(
      c,
      "blocked",
      "Cliente bloqueado no cadastro (PUT /clients/:id). Sem corte técnico nem MikroTik nesta fase.",
    );
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    const id = deleteTarget._id;
    try {
      await apiFetch(`/clients/${id}`, { method: "DELETE" });
      setToast({ variant: "success", message: "Cliente eliminado." });
      await loadClients();
      await loadOverdueRollups();
    } catch (e) {
      setToast({ variant: "error", message: userFacingApiError(e) });
      throw e;
    }
  };

  const rangeStart = clients.length === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const rangeEnd = Math.min(page * PAGE_SIZE, clients.length);

  return (
    <div className="mx-auto w-full max-w-[90rem] space-y-6">
      {toast ? (
        <div
          className={
            toast.variant === "success"
              ? "fixed bottom-4 right-4 z-[100] max-w-sm rounded-xl border border-emerald-200/90 bg-emerald-50/95 px-4 py-3 text-sm text-emerald-900 shadow-lg ring-1 ring-emerald-900/5"
              : "fixed bottom-4 right-4 z-[100] max-w-sm rounded-xl border border-red-200/90 bg-red-50/95 px-4 py-3 text-sm text-red-900 shadow-lg ring-1 ring-red-900/5"
          }
          role="status"
        >
          {toast.message}
        </div>
      ) : null}

      <header className="rounded-xl border border-slate-200/95 bg-white px-5 py-5 shadow-sm ring-1 ring-slate-900/[0.035] sm:px-6">
        <div className="flex flex-col gap-4 border-b border-slate-200/90 pb-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="flex min-w-0 gap-3">
            <div
              className="hidden h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-slate-200/90 bg-slate-50 shadow-[inset_0_1px_0_rgba(255,255,255,0.85)] sm:flex"
              aria-hidden
            >
              <Users className="h-5 w-5 text-slate-600" strokeWidth={2} />
            </div>
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">Operação</p>
              <h1 className="mt-0.5 text-lg font-semibold tracking-tight text-slate-900 sm:text-xl">Carteira de clientes</h1>
              <p className="mt-2 max-w-3xl text-sm leading-relaxed text-slate-600">
                Consulta em tempo real via <span className="font-mono text-[0.8rem] text-slate-700">GET /clients</span>
                {` `}(parâmetros opcionais{` `}
                <span className="font-mono text-[0.8rem] text-slate-700">search</span>,{` `}
                <span className="font-mono text-[0.8rem] text-slate-700">status</span>). Criação e edição partilham a mesma
                ficha; autenticação em modal à parte.{" "}
                <span className="text-slate-700">{CLIENT_STATUS_DISTINCTION_SUMMARY}</span>
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" variant="outline" size="sm" className="border-slate-200 bg-white shadow-sm" asChild>
              <Link href="/planos" className="gap-1.5">
                Catálogo de planos <ArrowRight className="h-3.5 w-3.5 text-slate-500" />
              </Link>
            </Button>
            <Button
              type="button"
              size="sm"
              className="gap-2 border-0 bg-emerald-600 font-semibold text-white shadow-sm ring-1 ring-emerald-900/10 hover:bg-emerald-700"
              disabled={loading}
              onClick={openCreate}
            >
              <Plus className="h-4 w-4" />
              Novo cliente
            </Button>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 border-b border-slate-200/90 py-3.5">
          <span className="inline-flex items-center rounded-full border border-amber-200/90 bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-950 shadow-sm ring-1 ring-amber-900/5">
            Todos os clientes
          </span>
          <span
            className="inline-flex cursor-not-allowed items-center rounded-full border border-transparent bg-slate-50 px-3 py-1 text-xs text-slate-400"
            title="Sem rota nesta versão — estrutura preparada"
          >
            Pré-registros <span className="ml-1 font-normal text-slate-400">(em breve)</span>
          </span>
        </div>

        <div className="grid gap-3 pt-5 sm:grid-cols-2 xl:grid-cols-4">
          <div className="relative flex min-h-[4.65rem] items-center gap-2 overflow-hidden rounded-xl border border-slate-200/95 bg-white px-4 py-2 shadow-sm ring-1 ring-slate-900/[0.04]">
            <div className="relative z-10 flex min-w-0 flex-1 flex-col justify-center gap-1">
              <span className="text-[9px] font-semibold uppercase tracking-[0.1em] text-slate-500">Total na consulta</span>
              <p className="text-[1.4rem] font-bold leading-[1.05] tracking-tight text-slate-950 tabular-nums sm:text-[1.5rem]">
                {loading ? "—" : clientKpis.total}
              </p>
            </div>
            <div className="relative z-10 flex shrink-0 items-center pl-0.5" aria-hidden>
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 ring-1 ring-slate-200/90 shadow-[inset_0_1px_0_rgba(255,255,255,0.9)]">
                <Users className="h-3.5 w-3.5 text-slate-600" strokeWidth={2} />
              </div>
            </div>
          </div>
          <div className="relative flex min-h-[4.65rem] items-center gap-2 overflow-hidden rounded-xl border border-emerald-500/25 bg-emerald-600 px-4 py-2 shadow-sm ring-1 ring-white/10">
            <div className="relative z-10 flex min-w-0 flex-1 flex-col justify-center gap-1">
              <span className="text-[9px] font-semibold uppercase tracking-[0.1em] text-white/75">Ativos</span>
              <p className="text-[1.4rem] font-bold leading-[1.05] tracking-tight text-white tabular-nums sm:text-[1.5rem]">
                {loading ? "—" : clientKpis.active}
              </p>
            </div>
            <div className="relative z-10 flex shrink-0 items-center pl-0.5" aria-hidden>
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white/20 shadow-[inset_0_1px_0_rgba(255,255,255,0.18)] ring-1 ring-white/30">
                <UserCheck className="h-3.5 w-3.5 text-white/95" strokeWidth={2} />
              </div>
            </div>
          </div>
          <div className="relative flex min-h-[4.65rem] items-center gap-2 overflow-hidden rounded-xl border border-amber-500/30 bg-amber-600 px-4 py-2 shadow-sm ring-1 ring-white/10">
            <div className="relative z-10 flex min-w-0 flex-1 flex-col justify-center gap-1">
              <span className="text-[9px] font-semibold uppercase tracking-[0.1em] text-white/80">Inadimplentes</span>
              <p className="text-[1.4rem] font-bold leading-[1.05] tracking-tight text-white tabular-nums sm:text-[1.5rem]">
                {loading ? "—" : clientKpis.delinquent}
              </p>
            </div>
            <div className="relative z-10 flex shrink-0 items-center pl-0.5" aria-hidden>
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white/20 shadow-[inset_0_1px_0_rgba(255,255,255,0.18)] ring-1 ring-white/30">
                <AlertTriangle className="h-3.5 w-3.5 text-white/95" strokeWidth={2} />
              </div>
            </div>
          </div>
          <div className="relative flex min-h-[4.65rem] items-center gap-2 overflow-hidden rounded-xl border border-red-500/25 bg-red-600 px-4 py-2 shadow-sm ring-1 ring-white/10">
            <div className="relative z-10 flex min-w-0 flex-1 flex-col justify-center gap-1">
              <span className="text-[9px] font-semibold uppercase tracking-[0.1em] text-white/75">Bloqueados</span>
              <p className="text-[1.4rem] font-bold leading-[1.05] tracking-tight text-white tabular-nums sm:text-[1.5rem]">
                {loading ? "—" : clientKpis.blocked}
              </p>
            </div>
            <div className="relative z-10 flex shrink-0 items-center pl-0.5" aria-hidden>
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white/20 shadow-[inset_0_1px_0_rgba(255,255,255,0.18)] ring-1 ring-white/30">
                <Ban className="h-3.5 w-3.5 text-white/95" strokeWidth={2} />
              </div>
            </div>
          </div>
        </div>

        <div className="mt-5 grid gap-4 rounded-xl border border-slate-200/90 bg-slate-50/50 p-4 sm:p-5 lg:grid-cols-12 lg:items-end">
          <div className="space-y-1.5 lg:col-span-6">
            <Label htmlFor="client-search" className="text-[11px] font-semibold uppercase tracking-[0.1em] text-slate-500">
              Pesquisa
            </Label>
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input
                id="client-search"
                placeholder="Nome, documento ou utilizador de acesso…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                disabled={loading}
                className="border-slate-200 bg-white pl-9 shadow-sm"
              />
            </div>
          </div>
          <div className="space-y-1.5 lg:col-span-3">
            <Label
              htmlFor="client-status-filter"
              className="text-[11px] font-semibold uppercase tracking-[0.1em] text-slate-500"
            >
              Estado
            </Label>
            <Select
              id="client-status-filter"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as "" | ClientStatus)}
              disabled={loading}
              className="border-slate-200 bg-white shadow-sm"
            >
              <option value="">Todos</option>
              {CLIENT_STATUS_OPTIONS.map((o) => (
                <option key={o.value} value={o.value} title={o.hint}>
                  {o.label}
                </option>
              ))}
            </Select>
          </div>
          <p className="text-xs leading-relaxed text-slate-500 lg:col-span-3 lg:pb-2">
            Pesquisa e filtro reenviam o pedido à API. Passe o rato sobre cada opção de estado para ver a dica. A
            paginação abaixo é local ({PAGE_SIZE} linhas por página) sobre o resultado devolvido.
          </p>
        </div>

        <details className="mt-4 rounded-xl border border-slate-200/90 bg-white px-4 py-3 text-xs text-slate-700 shadow-sm ring-1 ring-slate-900/[0.03]">
          <summary className="cursor-pointer list-none font-semibold text-slate-800 [&::-webkit-details-marker]:hidden">
            Guia operacional — estados do cliente
          </summary>
          <p className="mt-2 leading-relaxed text-slate-600">{CLIENT_STATUS_AUTOMATION_FOOTNOTE}</p>
          <ul className="mt-3 list-inside list-disc space-y-1.5 text-slate-600 marker:text-slate-400">
            {CLIENT_STATUS_GUIDE_SECTIONS.map((row) => (
              <li key={row.label}>
                <span className="font-medium text-slate-800">{row.label}:</span> {row.detail}
              </li>
            ))}
          </ul>
        </details>
      </header>

      {listError ? (
        <div
          className="rounded-xl border border-red-200/90 bg-red-50/90 px-5 py-3.5 text-sm text-red-900 shadow-sm ring-1 ring-red-900/5"
          role="alert"
        >
          {listError}
        </div>
      ) : null}

      {loading ? (
        <div className="rounded-xl border border-slate-200/95 bg-white px-6 py-16 text-center shadow-sm ring-1 ring-slate-900/[0.035]">
          <p className="text-sm font-medium text-slate-700">A carregar clientes…</p>
          <p className="mt-1.5 text-xs text-slate-500">A aguardar resposta de /clients e /plans</p>
        </div>
      ) : clients.length === 0 ? (
        <div className="rounded-xl border border-slate-200/95 bg-white px-6 py-10 shadow-sm ring-1 ring-slate-900/[0.035]">
          <EmptyState
            icon={<Users className="mx-auto h-10 w-10 text-slate-400" />}
            title="Nenhum cliente"
            description={
              debouncedSearch || statusFilter
                ? "Nenhum resultado com os filtros atuais."
                : "Ainda não há clientes. Crie o primeiro com «Novo cliente»."
            }
            action={
              !debouncedSearch && !statusFilter ? (
                <Button
                  type="button"
                  className="border-0 bg-emerald-600 font-semibold text-white shadow-sm ring-1 ring-emerald-900/10 hover:bg-emerald-700"
                  onClick={openCreate}
                >
                  Novo cliente
                </Button>
              ) : undefined
            }
          />
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-200/95 bg-white shadow-sm ring-1 ring-slate-900/[0.035]">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200/90 bg-slate-50/70 px-5 py-3.5">
            <div>
              <h2 className="text-sm font-semibold tracking-tight text-slate-900">Registos</h2>
              <p className="mt-0.5 text-xs text-slate-500">
                {clients.length} cliente(s) nesta consulta
                {totalPages > 1 ? ` · página ${page} de ${totalPages}` : null}
              </p>
            </div>
          </div>
          <Table containerClassName="rounded-none border-0 border-t border-slate-200/90 shadow-none">
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Documento</TableHead>
                <TableHead>Telefone</TableHead>
                <TableHead>Utilizador</TableHead>
                <TableHead>Plano</TableHead>
                <TableHead>Venc.</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedClients.map((c) => (
                <TableRow
                  key={c._id}
                  className={cn(
                    c.status === "blocked"
                      ? "border-l-[3px] border-l-red-600 bg-red-50/30"
                      : overdueByClient.has(c._id) && "border-l-[3px] border-l-amber-500 bg-amber-50/35",
                  )}
                >
                  <TableCell className="font-medium text-slate-900">{c.fullName}</TableCell>
                  <TableCell className="tabular-nums text-slate-600">{c.document || "—"}</TableCell>
                  <TableCell className="text-slate-600">{c.phone || "—"}</TableCell>
                  <TableCell className="font-mono text-xs text-slate-600">
                    {c.access?.username || "—"}
                  </TableCell>
                  <TableCell className="max-w-[10rem] truncate text-slate-600">
                    {planDisplayName(c.planId)}
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-slate-600">Dia {c.dueDay ?? 10}</TableCell>
                  <TableCell>
                    <div className="flex max-w-[14rem] flex-col gap-1.5 sm:max-w-none sm:flex-row sm:items-start sm:gap-2">
                      <Badge variant={clientStatusBadgeVariant(c.status)} className="w-fit shrink-0">
                        {clientStatusLabelPt(c.status)}
                      </Badge>
                      <Select
                        aria-label={`Alterar estado de ${c.fullName}`}
                        value={c.status}
                        disabled={statusUpdatingId === c._id}
                        onChange={(e) => void handleQuickStatus(c, e.target.value as ClientStatus)}
                        className={cn("h-8 w-full min-w-[9rem] text-xs sm:w-[9rem]")}
                      >
                        {CLIENT_STATUS_OPTIONS.map((o) => (
                          <option key={o.value} value={o.value} title={o.hint}>
                            {o.label}
                          </option>
                        ))}
                      </Select>
                    </div>
                    {overdueByClient.has(c._id) ? (
                      <ClientDelinquencyRulerPanel
                        variant="table"
                        rollup={overdueByClient.get(c._id)!}
                        clientStatus={c.status}
                        onMarkDelinquent={() => void handleQuickStatus(c, "delinquent")}
                        onBlockClient={
                          c.status === "delinquent" ? () => setBlockConfirmTarget(c) : undefined
                        }
                        actionDisabled={statusUpdatingId === c._id}
                      />
                    ) : null}
                    {c.status === "delinquent" && !overdueByClient.has(c._id) ? (
                      <div className="mt-2 max-w-md rounded-lg border border-slate-200/90 bg-slate-50/90 px-2.5 py-2 text-xs text-slate-800 ring-1 ring-slate-900/[0.03]">
                        <p className="text-[0.65rem] leading-relaxed text-slate-600">
                          Sem faturas «overdue» na API para este cliente. Ainda pode bloquear o cadastro após decisão
                          interna (sem automação de rede).
                        </p>
                        <Button
                          type="button"
                          size="sm"
                          variant="destructive"
                          className="mt-2 h-8 text-xs font-semibold"
                          disabled={statusUpdatingId === c._id}
                          onClick={() => setBlockConfirmTarget(c)}
                        >
                          Bloquear cliente
                        </Button>
                      </div>
                    ) : null}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap items-center justify-end gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="gap-1 border-slate-200 bg-white shadow-sm"
                        asChild
                      >
                        <Link href={`/clientes/timeline/${c._id}`}>Timeline</Link>
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="gap-1 border-slate-200 bg-white shadow-sm"
                        onClick={() => openEdit(c)}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                        Editar
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="gap-1 border-red-200/90 bg-white text-red-800 shadow-sm hover:bg-red-50/90"
                        onClick={() => setDeleteTarget(c)}
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
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200/90 bg-slate-50/50 px-5 py-3.5 text-sm text-slate-700">
              <span className="text-xs text-slate-500">
                Mostrando <span className="font-semibold text-slate-800">{rangeStart}</span>–
                <span className="font-semibold text-slate-800">{rangeEnd}</span> de{" "}
                <span className="font-semibold text-slate-800">{clients.length}</span>
              </span>
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="border-slate-200 bg-white shadow-sm"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  Anterior
                </Button>
                <span className="tabular-nums text-xs text-slate-600">
                  Página {page} / {totalPages}
                </span>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="border-slate-200 bg-white shadow-sm"
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                >
                  Seguinte
                </Button>
              </div>
            </div>
          ) : null}
        </div>
      )}

      <ClienteFormModal
        open={clientModalOpen}
        onOpenChange={setClientModalOpen}
        mode={clientModalMode}
        client={clientModalMode === "edit" ? editingClient : null}
        plans={plans}
        onSuccess={async (kind) => {
          setToast({
            variant: "success",
            message:
              kind === "create"
                ? "Cliente criado. POST /clients inclui address e geo quando válidos; campos sem modelo na API seguem em notes."
                : "Cliente atualizado.",
          });
          await loadClients();
          await loadOverdueRollups();
        }}
        onInform={(message, variant) => setToast({ variant: variant ?? "error", message })}
      />

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(o) => !o && setDeleteTarget(null)}
        title="Eliminar cliente"
        description={
          deleteTarget
            ? `Eliminar «${deleteTarget.fullName}»? Esta ação remove o registo na API (DELETE /clients/:id).`
            : ""
        }
        confirmLabel="Eliminar"
        variant="destructive"
        onConfirm={handleDelete}
      />

      <ConfirmDialog
        open={!!blockConfirmTarget}
        onOpenChange={(o) => !o && setBlockConfirmTarget(null)}
        title="Bloquear cliente"
        description={
          blockConfirmTarget
            ? `Confirma bloquear «${blockConfirmTarget.fullName}» no cadastro? O estado passará a «Bloqueado» (PUT /clients/:id com status blocked). Não há corte de acesso na rede nem MikroTik nesta fase.`
            : ""
        }
        confirmLabel="Bloquear"
        variant="destructive"
        onConfirm={confirmBlockClient}
      />
    </div>
  );
}
