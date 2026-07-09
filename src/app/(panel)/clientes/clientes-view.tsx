"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { apiFetch, getSessionToken } from "@/lib/api-client";
import { userFacingApiError } from "@/lib/user-facing-api-error";
import type { ClientFromApi, ClientStatus, PlanFromApi } from "@/lib/api-types";
import { clientStatusBadgeVariant, clientStatusLabelPt, CLIENT_STATUS_OPTIONS } from "@/lib/client-status";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  CheckCircle2,
  ChevronDown,
  Clock3,
  Download,
  Eye,
  Filter,
  LayoutGrid,
  MoreHorizontal,
  Pencil,
  Plus,
  Search,
  Settings,
  Trash2,
  UserCheck,
  UserX,
  Users,
  XCircle,
} from "lucide-react";
import { ClienteFormModal } from "./cliente-form-modal";
import { ClientDetailsModal } from "./client-details-modal";

const PAGE_SIZE = 15;

type OperationalClient = ClientFromApi & {
  operationalLinks?: { accesses: number; contract: boolean; invoices: number };
  deletionProtected?: boolean;
};

type Summary = { total: number; active: number; inactive: number; pending: number; byStatus: Record<string, number> };
type PlanOptions = { concentrators: Array<{ id: string; name: string; host: string }> };
type ToastState = { variant: "success" | "error"; message: string } | null;
type StatusTarget = "active" | "disabled";
type StatusAction = {
  clientIds: string[];
  target: StatusTarget;
  title: string;
  description: string;
  confirmLabel: string;
  bulk?: boolean;
};

function shortId(id: string) {
  return `#${id.slice(-6).toUpperCase()}`;
}

function statusIcon(status: ClientStatus) {
  if (status === "active") return <CheckCircle2 className="h-4 w-4 text-emerald-600" />;
  if (status === "disabled" || status === "cancelled") return <XCircle className="h-4 w-4 text-red-600" />;
  return <Clock3 className="h-4 w-4 text-amber-600" />;
}

function quickStatusAction(client: OperationalClient): StatusAction | null {
  if (client.status === "pending") {
    return {
      clientIds: [client._id], target: "active", title: "Ativar cliente",
      description: `Confirmar a ativação cadastral de ${client.fullName}? Os acessos vinculados serão marcados como ativos, sem comandos de rede.`,
      confirmLabel: "Ativar",
    };
  }
  if (client.status === "active") {
    return {
      clientIds: [client._id], target: "disabled", title: "Desativar cliente",
      description: `Confirmar a desativação cadastral de ${client.fullName}? Nenhuma sessão Internet será desconectada.`,
      confirmLabel: "Desativar",
    };
  }
  if (client.status === "disabled") {
    return {
      clientIds: [client._id], target: "active", title: "Reativar cliente",
      description: `Confirmar a reativação cadastral de ${client.fullName}? Nenhum comando será enviado ao concentrador.`,
      confirmLabel: "Reativar",
    };
  }
  return null;
}

export function ClientesView() {
  const [clients, setClients] = useState<OperationalClient[]>([]);
  const [plans, setPlans] = useState<PlanFromApi[]>([]);
  const [summary, setSummary] = useState<Summary>({ total: 0, active: 0, inactive: 0, pending: 0, byStatus: {} });
  const [concentrators, setConcentrators] = useState<PlanOptions["concentrators"]>([]);
  const [loading, setLoading] = useState(true);
  const [listError, setListError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"" | ClientStatus>("");
  const [showFilters, setShowFilters] = useState(false);
  const [page, setPage] = useState(1);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [optionsOpen, setOptionsOpen] = useState(false);
  const optionsRef = useRef<HTMLDivElement>(null);
  const [clientModalOpen, setClientModalOpen] = useState(false);
  const [clientModalMode, setClientModalMode] = useState<"create" | "edit">("create");
  const [editingClient, setEditingClient] = useState<OperationalClient | null>(null);
  const [detailClient, setDetailClient] = useState<OperationalClient | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<OperationalClient | null>(null);
  const [statusAction, setStatusAction] = useState<StatusAction | null>(null);
  const [toast, setToast] = useState<ToastState>(null);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 4500);
    return () => clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    const close = (event: MouseEvent) => {
      if (optionsRef.current && !optionsRef.current.contains(event.target as Node)) setOptionsOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  useEffect(() => {
    setPage(1);
    setSelectedIds(new Set());
  }, [debouncedSearch, statusFilter]);

  const loadClients = useCallback(async () => {
    const params = new URLSearchParams();
    if (debouncedSearch) params.set("search", debouncedSearch);
    if (statusFilter) params.set("status", statusFilter);
    const rows = await apiFetch<OperationalClient[]>(`/clients${params.size ? `?${params}` : ""}`);
    setClients(Array.isArray(rows) ? rows : []);
  }, [debouncedSearch, statusFilter]);

  const loadBase = useCallback(async () => {
    const [planRows, summaryRow, options] = await Promise.all([
      apiFetch<PlanFromApi[]>("/plans"),
      apiFetch<Summary>("/clients/summary"),
      apiFetch<PlanOptions>("/plans/options"),
    ]);
    setPlans(Array.isArray(planRows) ? planRows : []);
    setSummary(summaryRow);
    setConcentrators(Array.isArray(options.concentrators) ? options.concentrators : []);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setListError(null);
      try {
        await Promise.all([loadBase(), loadClients()]);
      } catch (error) {
        if (!cancelled) setListError(userFacingApiError(error));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [loadBase, loadClients]);

  const totalPages = Math.max(1, Math.ceil(clients.length / PAGE_SIZE));
  useEffect(() => setPage((current) => Math.min(current, totalPages)), [totalPages]);
  const paginatedClients = useMemo(() => clients.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE), [clients, page]);
  const allPageSelected = paginatedClients.length > 0 && paginatedClients.every((client) => selectedIds.has(client._id));

  const openCreate = () => {
    setEditingClient(null);
    setClientModalMode("create");
    setClientModalOpen(true);
  };

  const openEdit = (client: OperationalClient) => {
    setEditingClient(client);
    setClientModalMode("edit");
    setClientModalOpen(true);
  };

  const refresh = async () => {
    await Promise.all([loadClients(), loadBase()]);
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await apiFetch(`/clients/${deleteTarget._id}`, { method: "DELETE" });
      setToast({ variant: "success", message: "Cliente excluído." });
      await refresh();
    } catch (error) {
      setToast({ variant: "error", message: userFacingApiError(error) });
      throw error;
    }
  };

  const applyStatusLocally = (clientIds: string[], target: StatusTarget) => {
    const idSet = new Set(clientIds);
    const affected = clients.filter((client) => idSet.has(client._id));

    setClients((current) => {
      const updated = current.map((client) => idSet.has(client._id) ? { ...client, status: target } : client);
      return statusFilter && statusFilter !== target ? updated.filter((client) => !idSet.has(client._id)) : updated;
    });
    setSummary((current) => {
      const byStatus = { ...current.byStatus };
      for (const client of affected) byStatus[client.status] = Math.max(0, (byStatus[client.status] || 0) - 1);
      byStatus[target] = (byStatus[target] || 0) + affected.length;
      return {
        ...current,
        active: byStatus.active || 0,
        inactive: (byStatus.disabled || 0) + (byStatus.cancelled || 0),
        pending: byStatus.pending || 0,
        byStatus,
      };
    });
    setSelectedIds((current) => {
      const next = new Set(current);
      for (const id of clientIds) next.delete(id);
      return next;
    });
    setDetailClient((current) => current && idSet.has(current._id) ? { ...current, status: target } : current);
  };

  const handleStatusChange = async () => {
    if (!statusAction) return;
    const isBulk = Boolean(statusAction.bulk);
    try {
      await apiFetch(isBulk ? "/clients/status/bulk" : `/clients/${statusAction.clientIds[0]}/status`, {
        method: "PATCH",
        body: JSON.stringify(isBulk
          ? { clientIds: statusAction.clientIds, status: statusAction.target }
          : { status: statusAction.target }),
      });
      applyStatusLocally(statusAction.clientIds, statusAction.target);
      setToast({
        variant: "success",
        message: isBulk
          ? `${statusAction.clientIds.length} clientes atualizados com sucesso.`
          : statusAction.target === "active" ? "Cliente ativado com sucesso." : "Cliente desativado com sucesso.",
      });
    } catch (error) {
      setToast({ variant: "error", message: userFacingApiError(error) });
      throw error;
    }
  };

  const prepareBulkStatus = (target: StatusTarget) => {
    const clientIds = [...selectedIds];
    const actionLabel = target === "active" ? "Ativar" : "Desativar";
    setStatusAction({
      clientIds, target, title: `${actionLabel} clientes selecionados`,
      description: `${actionLabel} ${clientIds.length} cliente(s) apenas no cadastro e nos acessos vinculados? Nenhum comando de rede será executado.`,
      confirmLabel: actionLabel,
      bulk: true,
    });
  };

  const togglePage = () => {
    setSelectedIds((current) => {
      const next = new Set(current);
      for (const client of paginatedClients) {
        if (allPageSelected) next.delete(client._id);
        else next.add(client._id);
      }
      return next;
    });
  };

  const exportCsv = async (serverId?: string) => {
    setOptionsOpen(false);
    try {
      const base = process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "");
      if (!base) throw new Error("URL do sistema não configurada.");
      const token = getSessionToken();
      const query = serverId ? `?serverId=${encodeURIComponent(serverId)}` : "";
      const response = await fetch(`${base}/clients/export.csv${query}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        cache: "no-store",
      });
      if (!response.ok) throw new Error((await response.json().catch(() => null))?.message || "Falha ao exportar clientes.");
      const blob = await response.blob();
      const disposition = response.headers.get("content-disposition") || "";
      const filename = disposition.match(/filename="?([^";]+)"?/i)?.[1] || "clientes-xpdcnet.csv";
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = filename;
      anchor.click();
      URL.revokeObjectURL(url);
      setToast({ variant: "success", message: "Exportação CSV preparada." });
    } catch (error) {
      setToast({ variant: "error", message: userFacingApiError(error) });
    }
  };

  const cards = [
    { label: "Todos", value: summary.total, icon: Users, tone: "border-blue-200 bg-blue-50 text-blue-950" },
    { label: "Ativos", value: summary.active, icon: UserCheck, tone: "border-emerald-200 bg-emerald-50 text-emerald-950" },
    { label: "Desativados / Inativos", value: summary.inactive, icon: UserX, tone: "border-red-200 bg-red-50 text-red-950" },
  ];

  return (
    <div className="mx-auto w-full max-w-[96rem] space-y-3">
      {toast ? <div className={`fixed bottom-4 right-4 z-[120] max-w-sm rounded-md border px-4 py-3 text-sm shadow-lg ${toast.variant === "success" ? "border-emerald-200 bg-emerald-50 text-emerald-900" : "border-red-200 bg-red-50 text-red-900"}`} role="status">{toast.message}</div> : null}

      <header className="hidden"></header>

      <section className="grid gap-3 sm:grid-cols-3" aria-label="Resumo dos clientes">
        {cards.map(({ label, value, icon: Icon, tone }) => (
          <div
            key={label}
            className={`flex h-16 cursor-pointer items-center justify-between rounded-xl border px-4 py-2 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-xl ${tone}`}
          >
            <div>
              <p className="text-xs font-medium opacity-70">{label}</p>

              <p className="text-xl font-semibold tabular-nums">
                {loading ? "—" : value}
              </p>
            </div>

            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/80 shadow-sm">
              <Icon className="h-5 w-5 opacity-90" />
            </div>
          </div>
        ))}
      </section>

      <section className="rounded-lg border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col gap-3 border-b border-slate-200 p-4 lg:flex-row lg:items-center">
          <div className="relative min-w-0 flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar por nome, CPF/CNPJ, telefone, e-mail ou login de acesso" className="pl-9" />
          </div>
          <Button type="button" variant="outline" onClick={() => setShowFilters((value) => !value)}><Filter className="h-4 w-4" /> Mais filtros</Button>
          <Button type="button" onClick={openCreate} className="bg-emerald-600 hover:bg-emerald-700"><Plus className="h-4 w-4" /> Novo cliente</Button>
          <div className="relative" ref={optionsRef}>
            <Button type="button" variant="outline" onClick={() => setOptionsOpen((value) => !value)}><Settings className="h-4 w-4" /> Opções <ChevronDown className="h-3.5 w-3.5" /></Button>
            {optionsOpen ? (
              <div className="absolute right-0 top-11 z-30 w-72 rounded-lg border border-slate-200 bg-white p-2 shadow-xl">
                <button type="button" onClick={() => void exportCsv()} className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50"><Download className="h-4 w-4" /> Exportar todos os clientes</button>
                <div className="my-1 border-t border-slate-100" />
                <p className="px-3 py-1 text-[11px] font-semibold uppercase text-slate-400">Exportar por concentrador</p>
                {concentrators.map((server) => <button key={server.id} type="button" onClick={() => void exportCsv(server.id)} className="w-full rounded-md px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50">{server.name}<span className="block text-xs text-slate-400">{server.host}</span></button>)}
                <div className="my-1 border-t border-slate-100" />
                <p className="flex items-center gap-2 px-3 py-2 text-xs text-slate-400"><MoreHorizontal className="h-4 w-4" /> Ações em lote serão adicionadas futuramente.</p>
              </div>
            ) : null}
          </div>
        </div>

        {showFilters ? (
          <div className="flex flex-wrap items-end gap-3 border-b border-slate-200 bg-slate-50 px-4 py-3">
            <div className="min-w-56"><label className="mb-1 block text-xs font-medium text-slate-600" htmlFor="client-status">Status</label><Select id="client-status" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as "" | ClientStatus)}><option value="">Todos os status</option>{CLIENT_STATUS_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</Select></div>
            <Button type="button" variant="ghost" size="sm" onClick={() => { setStatusFilter(""); setSearch(""); }}>Limpar filtros</Button>
          </div>
        ) : null}

        {selectedIds.size > 0 ? (
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-blue-100 bg-blue-50 px-4 py-2.5">
            <p className="text-sm font-medium text-blue-950">{selectedIds.size} cliente(s) selecionado(s)</p>
            <div className="flex items-center gap-2">
              <Button type="button" size="sm" onClick={() => prepareBulkStatus("active")}><UserCheck className="h-4 w-4" /> Ativar selecionados</Button>
              <Button type="button" variant="outline" size="sm" className="border-red-200 text-red-700 hover:bg-red-50" onClick={() => prepareBulkStatus("disabled")}><UserX className="h-4 w-4" /> Desativar selecionados</Button>
            </div>
          </div>
        ) : null}

        {listError ? <div className="m-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">{listError}</div> : null}
        {loading ? <p className="py-16 text-center text-sm text-slate-500">Carregando clientes...</p> : clients.length === 0 ? <div className="p-8"><EmptyState icon={<Users className="mx-auto h-10 w-10" />} title="Nenhum cliente encontrado" description="Revise os filtros ou cadastre um novo cliente." /></div> : (
          <div className="overflow-x-auto">
            <Table containerClassName="rounded-none border-0 shadow-none">
              <TableHeader><TableRow>
                <TableHead className="w-10"><input type="checkbox" aria-label="Selecionar página" checked={allPageSelected} onChange={togglePage} className="h-4 w-4 accent-emerald-600" /></TableHead>
                <TableHead className="min-w-[210px]">Ações</TableHead>
                <TableHead>ID do cliente</TableHead>
                <TableHead className="min-w-[220px]">Nome</TableHead>
                <TableHead className="min-w-[200px]">E-mail</TableHead>
                <TableHead>CPF/CNPJ</TableHead>
                <TableHead>Telefone</TableHead>
              </TableRow></TableHeader>
              <TableBody>{paginatedClients.map((client) => {
                const protectedDelete = Boolean(client.deletionProtected);
                const quickAction = quickStatusAction(client);
                return <TableRow key={client._id}>
                  <TableCell><input type="checkbox" aria-label={`Selecionar ${client.fullName}`} checked={selectedIds.has(client._id)} onChange={() => setSelectedIds((current) => { const next = new Set(current); if (next.has(client._id)) next.delete(client._id); else next.add(client._id); return next; })} className="h-4 w-4 accent-emerald-600" /></TableCell>
                  <TableCell><div className="flex items-center gap-1">
                    <Button type="button" variant="ghost" size="icon" title="Abrir Cliente 360°" asChild>
                      <Link href={`/clientes/360/${client._id}`}>
                        <LayoutGrid className="h-4 w-4 text-emerald-700" />
                        <span className="sr-only">Cliente 360°</span>
                      </Link>
                    </Button>
                    <Button type="button" variant="ghost" size="icon" title="Visualizar detalhes" onClick={() => setDetailClient(client)}><Eye className="h-4 w-4 text-slate-600" /><span className="sr-only">Visualizar</span></Button>
                    <Button type="button" variant="ghost" size="icon" title="Editar cliente" onClick={() => openEdit(client)}><Pencil className="h-4 w-4 text-blue-600" /><span className="sr-only">Editar</span></Button>
                    <Button
                      type="button" variant="ghost" size="icon" disabled={!quickAction}
                      title={quickAction ? `${quickAction.confirmLabel}: status atual ${clientStatusLabelPt(client.status)}` : `Status ${clientStatusLabelPt(client.status)} exige tratamento individual`}
                      onClick={() => quickAction && setStatusAction(quickAction)}
                    >
                      {statusIcon(client.status)}
                      <span className="sr-only">Alterar status de {client.fullName}</span>
                    </Button>
                    <span title={protectedDelete ? "Cliente possui vínculos operacionais e não pode ser excluído diretamente." : "Excluir cliente"}><Button type="button" variant="ghost" size="icon" disabled={protectedDelete} onClick={() => setDeleteTarget(client)}><Trash2 className="h-4 w-4 text-red-600" /><span className="sr-only">Excluir</span></Button></span>
                  </div></TableCell>
                  <TableCell className="font-mono text-xs text-slate-500">{shortId(client._id)}</TableCell>
                  <TableCell><p className="font-medium text-slate-900">{client.fullName}</p><Badge variant={clientStatusBadgeVariant(client.status)} className="mt-1">{clientStatusLabelPt(client.status)}</Badge></TableCell>
                  <TableCell className="text-slate-600">{client.email || "—"}</TableCell>
                  <TableCell className="whitespace-nowrap text-slate-600">{client.document || "—"}</TableCell>
                  <TableCell className="whitespace-nowrap text-slate-600">{client.phone || "—"}</TableCell>
                </TableRow>;
              })}</TableBody>
            </Table>
          </div>
        )}

        {!loading && clients.length ? <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-600"><span>Mostrando {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, clients.length)} de {clients.length} {selectedIds.size ? `· ${selectedIds.size} selecionado(s)` : ""}</span><div className="flex items-center gap-2"><Button type="button" variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((value) => value - 1)}>Anterior</Button><span>Página {page} de {totalPages}</span><Button type="button" variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage((value) => value + 1)}>Próxima</Button></div></div> : null}
      </section>

      <ClienteFormModal open={clientModalOpen} onOpenChange={setClientModalOpen} mode={clientModalMode} client={clientModalMode === "edit" ? editingClient : null} plans={plans} onSuccess={async (kind) => { setToast({ variant: "success", message: kind === "create" ? "Cliente criado com sucesso." : "Cliente atualizado." }); await refresh(); }} onInform={(message, variant = "error") => setToast({ message, variant })} />
      <ClientDetailsModal open={Boolean(detailClient)} onOpenChange={(open) => !open && setDetailClient(null)} clientId={detailClient?._id || null} onEdit={() => { if (detailClient) openEdit(detailClient); setDetailClient(null); }} />
      <ConfirmDialog open={Boolean(statusAction)} onOpenChange={(open) => !open && setStatusAction(null)} title={statusAction?.title || "Alterar status"} description={statusAction?.description || ""} confirmLabel={statusAction?.confirmLabel || "Confirmar"} variant={statusAction?.target === "disabled" ? "destructive" : "default"} onConfirm={handleStatusChange} />
      <ConfirmDialog open={Boolean(deleteTarget)} onOpenChange={(open) => !open && setDeleteTarget(null)} title="Excluir cliente" description={deleteTarget ? `Excluir ${deleteTarget.fullName}? Esta ação só será permitida se não houver acessos, contratos ou cobranças vinculadas.` : ""} confirmLabel="Excluir" variant="destructive" onConfirm={handleDelete} />
    </div>
  );
}
