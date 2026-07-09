"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { apiFetch } from "@/lib/api-client";
import { userFacingApiError } from "@/lib/user-facing-api-error";
import type {
  PlanAuthType,
  PlanBillingCycle,
  PlanFromApi,
} from "@/lib/api-types";
import { formatBRL } from "@/lib/api-types";
import { EmptyState } from "@/components/ui/empty-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
import {
  Activity,
  Gauge,
  Network,
  Pencil,
  Plus,
  RadioTower,
  Trash2,
  Users,
} from "lucide-react";

type ToastState = { variant: "success" | "error"; message: string } | null;
type PlanOptions = {
  nodes: { id: string; name: string; code: string }[];
  concentrators: { id: string; name: string; host: string; networkNodeId: string | null }[];
};

type PlanForm = {
  name: string;
  downloadMbps: string;
  uploadMbps: string;
  monthlyPrice: string;
  authType: PlanAuthType;
  billingCycle: PlanBillingCycle;
  networkNodeId: string;
  serverId: string;
  popName: string;
  routerosProfileName: string;
  description: string;
  status: "active" | "inactive";
};

const emptyForm: PlanForm = {
  name: "",
  downloadMbps: "",
  uploadMbps: "",
  monthlyPrice: "",
  authType: "pppoe",
  billingCycle: "monthly",
  networkNodeId: "",
  serverId: "",
  popName: "",
  routerosProfileName: "",
  description: "",
  status: "active",
};

function planToForm(plan: PlanFromApi): PlanForm {
  const serverId = plan.serverId && typeof plan.serverId === "object" ? plan.serverId._id : plan.serverId || "";
  const nodeId = plan.networkNodeId && typeof plan.networkNodeId === "object"
    ? plan.networkNodeId._id
    : plan.networkNodeId || plan.networkNode?.id || "";
  return {
    name: plan.name,
    downloadMbps: String(plan.downloadMbps ?? plan.speedMbps),
    uploadMbps: plan.uploadMbps == null ? "" : String(plan.uploadMbps),
    monthlyPrice: String(plan.monthlyPrice ?? plan.price),
    authType: plan.authType === "hotspot" ? "hotspot" : "pppoe",
    billingCycle: ["monthly", "weekly", "daily"].includes(String(plan.billingCycle))
      ? (plan.billingCycle as PlanBillingCycle)
      : "monthly",
    networkNodeId: nodeId,
    serverId,
    popName: plan.popName || "",
    routerosProfileName: plan.routerosProfileName || plan.mikrotik?.profile || "",
    description: plan.description || "",
    status: plan.isActive === false ? "inactive" : "active",
  };
}

function speedLabel(value: number | null | undefined) {
  return value == null ? "Não informado" : `${value} Mbps`;
}

export function PlanosView() {
  const [plans, setPlans] = useState<PlanFromApi[]>([]);
  const [nodes, setNodes] = useState<PlanOptions["nodes"]>([]);
  const [servers, setServers] = useState<PlanOptions["concentrators"]>([]);
  const [loading, setLoading] = useState(true);
  const [listError, setListError] = useState<string | null>(null);
  const [formModalOpen, setFormModalOpen] = useState(false);
  const [editing, setEditing] = useState<PlanFromApi | null>(null);
  const [form, setForm] = useState<PlanForm>(emptyForm);
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<PlanFromApi | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [toast, setToast] = useState<ToastState>(null);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 4500);
    return () => clearTimeout(timer);
  }, [toast]);

  const load = useCallback(async () => {
    setListError(null);
    const [planRows, options] = await Promise.all([
      apiFetch<PlanFromApi[]>("/plans"),
      apiFetch<PlanOptions>("/plans/options"),
    ]);
    setPlans(Array.isArray(planRows) ? planRows : []);
    setNodes(Array.isArray(options.nodes) ? options.nodes : []);
    setServers(Array.isArray(options.concentrators) ? options.concentrators : []);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        await load();
      } catch (error) {
        if (!cancelled) setListError(userFacingApiError(error));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [load]);

  const summary = useMemo(() => {
    const concentrators = new Set<string>();
    for (const plan of plans) {
      for (const row of plan.linkedConcentrators || []) concentrators.add(row.id);
    }
    return {
      total: plans.length,
      active: plans.filter((plan) => plan.isActive !== false).length,
      clients: plans.reduce((sum, plan) => sum + (plan.stats?.clients || 0), 0),
      concentrators: concentrators.size,
    };
  }, [plans]);

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setFormError(null);
    setFormModalOpen(true);
  };

  const openEdit = (plan: PlanFromApi) => {
    setEditing(plan);
    setForm(planToForm(plan));
    setFormError(null);
    setFormModalOpen(true);
  };

  const submitForm = async () => {
    setFormError(null);
    const downloadMbps = Number(form.downloadMbps.replace(",", "."));
    const uploadMbps = form.uploadMbps.trim() ? Number(form.uploadMbps.replace(",", ".")) : null;
    const monthlyPrice = Number(form.monthlyPrice.replace(",", "."));
    if (!form.name.trim()) return setFormError("Nome é obrigatório.");
    if (!Number.isFinite(downloadMbps) || downloadMbps <= 0) return setFormError("Download inválido.");
    if (uploadMbps !== null && (!Number.isFinite(uploadMbps) || uploadMbps < 0)) return setFormError("Upload inválido.");
    if (!Number.isFinite(monthlyPrice) || monthlyPrice < 0) return setFormError("Valor mensal inválido.");

    const body = {
      name: form.name.trim(),
      downloadMbps,
      uploadMbps,
      monthlyPrice,
      authType: form.authType,
      billingCycle: form.billingCycle,
      networkNodeId: form.networkNodeId || null,
      serverId: form.serverId || null,
      popName: form.popName.trim(),
      routerosProfileName: form.routerosProfileName.trim(),
      description: form.description.trim(),
      status: form.status,
    };

    setSaving(true);
    try {
      await apiFetch<PlanFromApi>(editing ? `/plans/${editing._id}` : "/plans", {
        method: editing ? "PUT" : "POST",
        body: JSON.stringify(body),
      });
      setToast({ variant: "success", message: editing ? "Plano atualizado." : "Plano criado com sucesso." });
      setFormModalOpen(false);
      await load();
    } catch (error) {
      setFormError(userFacingApiError(error));
    } finally {
      setSaving(false);
    }
  };

  const toggleStatus = async (plan: PlanFromApi) => {
    const nextStatus = plan.isActive === false ? "active" : "inactive";
    setTogglingId(plan._id);
    try {
      const updated = await apiFetch<PlanFromApi>(`/plans/${plan._id}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status: nextStatus }),
      });
      setPlans((current) => current.map((row) => (row._id === plan._id ? updated : row)));
      setToast({ variant: "success", message: nextStatus === "active" ? "Plano ativado." : "Plano desativado." });
    } catch (error) {
      setToast({ variant: "error", message: userFacingApiError(error) });
    } finally {
      setTogglingId(null);
    }
  };

  const deletePlan = async () => {
    if (!deleteTarget) return;
    try {
      await apiFetch(`/plans/${deleteTarget._id}`, { method: "DELETE" });
      setToast({ variant: "success", message: "Plano excluído." });
      await load();
    } catch (error) {
      setToast({ variant: "error", message: userFacingApiError(error) });
      throw error;
    }
  };

  const cards = [
    { label: "Total de planos", value: summary.total, icon: Gauge, detail: "catálogo cadastrado" },
    { label: "Planos ativos", value: summary.active, icon: Activity, detail: "disponíveis para operação" },
    { label: "Clientes vinculados", value: summary.clients, icon: Users, detail: "cadastros com plano" },
    { label: "Concentradores vinculados", value: summary.concentrators, icon: RadioTower, detail: "equipamentos em uso" },
  ];

  return (
    <div className="mx-auto max-w-[1500px] space-y-5">
      {toast ? (
        <div className={`fixed bottom-4 right-4 z-[100] max-w-sm rounded-md border px-4 py-3 text-sm shadow-lg ${toast.variant === "success" ? "border-emerald-200 bg-emerald-50 text-emerald-900" : "border-red-200 bg-red-50 text-red-900"}`} role="status">
          {toast.message}
        </div>
      ) : null}

      <header className="flex flex-col gap-4 border-b border-slate-200 pb-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[11px] font-semibold uppercase text-emerald-700">Rede DC NET</p>
          <h1 className="mt-1 text-xl font-semibold text-slate-950 sm:text-2xl">Planos de Internet</h1>
          <p className="mt-1 text-sm text-slate-600">Catálogo comercial de planos vinculados à rede DC NET</p>
        </div>
        <Button type="button" onClick={openCreate} className="gap-2" disabled={loading}>
          <Plus className="h-4 w-4" /> Novo plano
        </Button>
      </header>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4" aria-label="Resumo dos planos">
        {cards.map(({ label, value, icon: Icon, detail }) => (
          <Card key={label} className="rounded-lg border-slate-200 shadow-sm">
            <CardContent className="flex items-center justify-between gap-4 p-4">
              <div>
                <p className="text-xs font-medium text-slate-500">{label}</p>
                <p className="mt-1 text-2xl font-semibold text-slate-950">{loading ? "—" : value}</p>
                <p className="mt-1 text-xs text-slate-500">{detail}</p>
              </div>
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700">
                <Icon className="h-5 w-5" />
              </div>
            </CardContent>
          </Card>
        ))}
      </section>

      {listError ? <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800" role="alert">{listError}</div> : null}

      <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
          <div>
            <h2 className="text-sm font-semibold text-slate-900">Catálogo comercial</h2>
            <p className="text-xs text-slate-500">Vínculos são calculados a partir dos clientes e acessos existentes.</p>
          </div>
          <Network className="h-5 w-5 text-slate-400" />
        </div>
        {loading ? (
          <p className="py-14 text-center text-sm text-slate-500">Carregando planos...</p>
        ) : plans.length === 0 ? (
          <div className="p-6"><EmptyState icon={<Network className="mx-auto h-10 w-10" />} title="Nenhum plano cadastrado" description="Crie o primeiro plano comercial da rede." action={<Button onClick={openCreate}>Novo plano</Button>} /></div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="min-w-[220px]">Nome do plano</TableHead>
                  <TableHead>Download</TableHead>
                  <TableHead>Upload</TableHead>
                  <TableHead>Valor mensal</TableHead>
                  <TableHead>Node</TableHead>
                  <TableHead>POP</TableHead>
                  <TableHead className="min-w-[180px]">Concentrador</TableHead>
                  <TableHead>Clientes</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {plans.map((plan) => {
                  const node = plan.networkNode || plan.linkedNodes?.[0];
                  const concentrators = plan.linkedConcentrators || [];
                  const pop = plan.popName || concentrators[0]?.name || "Não informado";
                  const hasLinks = (plan.stats?.clients || 0) > 0 || (plan.stats?.accesses || 0) > 0;
                  return (
                    <TableRow key={plan._id}>
                      <TableCell>
                        <p className="font-medium text-slate-950">{plan.name}</p>
                        {plan.routerosProfileName || plan.mikrotik?.profile ? <p className="mt-0.5 text-xs text-slate-500">Perfil: {plan.routerosProfileName || plan.mikrotik?.profile}</p> : null}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-slate-700">{speedLabel(plan.downloadMbps ?? plan.speedMbps)}</TableCell>
                      <TableCell className="whitespace-nowrap text-slate-700">{speedLabel(plan.uploadMbps)}</TableCell>
                      <TableCell className="whitespace-nowrap font-medium text-slate-800">{formatBRL(plan.monthlyPrice ?? plan.price)}</TableCell>
                      <TableCell>{node ? <><p className="text-sm text-slate-800">{node.name}</p><p className="text-xs text-slate-500">{node.code}</p></> : <span className="text-slate-400">Não vinculado</span>}</TableCell>
                      <TableCell className="text-slate-700">{pop}</TableCell>
                      <TableCell>{concentrators.length ? concentrators.map((row) => <div key={row.id} className="mb-1 last:mb-0"><p className="text-sm text-slate-800">{row.name}</p>{row.host ? <p className="text-xs text-slate-500">{row.host}</p> : null}</div>) : <span className="text-slate-400">Não vinculado</span>}</TableCell>
                      <TableCell><span className="font-semibold text-slate-900">{plan.stats?.clients || 0}</span><p className="text-xs text-slate-500">{plan.stats?.accesses || 0} acessos</p></TableCell>
                      <TableCell>{plan.isActive === false ? <Badge variant="muted">Inativo</Badge> : <Badge variant="success">Ativo</Badge>}</TableCell>
                      <TableCell>
                        <div className="flex min-w-[230px] items-center justify-end gap-2">
                          <Button type="button" variant="outline" size="sm" onClick={() => openEdit(plan)}><Pencil className="h-3.5 w-3.5" /> Editar</Button>
                          <Button type="button" variant="secondary" size="sm" disabled={togglingId === plan._id} onClick={() => void toggleStatus(plan)}>{togglingId === plan._id ? "Aguarde" : plan.isActive === false ? "Ativar" : "Desativar"}</Button>
                          <span title={hasLinks ? "Este plano possui clientes vinculados e não pode ser excluído." : "Excluir plano"}>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="text-red-700 hover:bg-red-50"
                              disabled={hasLinks}
                              onClick={() => setDeleteTarget(plan)}
                            >
                              <Trash2 className="h-3.5 w-3.5" /> Excluir
                            </Button>
                          </span>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </section>

      <Modal open={formModalOpen} onOpenChange={setFormModalOpen} title={editing ? "Editar plano" : "Novo plano"} description="Defina condições comerciais do plano." className="max-w-3xl">
        <div className="space-y-4">
          {formError ? <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{formError}</div> : null}
          <div className="space-y-1.5"><Label htmlFor="plan-name">Nome *</Label><Input id="plan-name" value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} placeholder="Ex.: DC NET 600 MEGA" /></div>
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-1.5"><Label htmlFor="plan-download">Download (Mbps) *</Label><Input id="plan-download" inputMode="decimal" value={form.downloadMbps} onChange={(event) => setForm((current) => ({ ...current, downloadMbps: event.target.value }))} /></div>
            <div className="space-y-1.5"><Label htmlFor="plan-upload">Upload (Mbps)</Label><Input id="plan-upload" inputMode="decimal" value={form.uploadMbps} onChange={(event) => setForm((current) => ({ ...current, uploadMbps: event.target.value }))} /></div>
            <div className="space-y-1.5"><Label htmlFor="plan-price">Valor mensal (R$) *</Label><Input id="plan-price" inputMode="decimal" value={form.monthlyPrice} onChange={(event) => setForm((current) => ({ ...current, monthlyPrice: event.target.value }))} /></div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5"><Label htmlFor="plan-node">Node</Label><Select id="plan-node" value={form.networkNodeId} onChange={(event) => setForm((current) => ({ ...current, networkNodeId: event.target.value }))}><option value="">Sem vínculo explícito</option>{nodes.map((node) => <option key={node.id} value={node.id}>{node.name} ({node.code})</option>)}</Select></div>
            <div className="space-y-1.5"><Label htmlFor="plan-server">Concentrador</Label><Select id="plan-server" value={form.serverId} onChange={(event) => setForm((current) => ({ ...current, serverId: event.target.value }))}><option value="">Derivar pelos acessos</option>{servers.map((server) => <option key={server.id} value={server.id}>{server.name} ({server.host})</option>)}</Select></div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5"><Label htmlFor="plan-pop">POP</Label><Input id="plan-pop" value={form.popName} onChange={(event) => setForm((current) => ({ ...current, popName: event.target.value }))} placeholder="Ex.: CHACARA STARLINK" /></div>
            <div className="space-y-1.5"><Label htmlFor="plan-profile">Perfil Equipamento</Label><Input id="plan-profile" value={form.routerosProfileName} onChange={(event) => setForm((current) => ({ ...current, routerosProfileName: event.target.value }))} placeholder="Opcional" /></div>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-1.5"><Label htmlFor="plan-auth">Autenticação</Label><Select id="plan-auth" value={form.authType} onChange={(event) => setForm((current) => ({ ...current, authType: event.target.value as PlanAuthType }))}><option value="pppoe">Internet</option><option value="hotspot">Hotspot</option></Select></div>
            <div className="space-y-1.5"><Label htmlFor="plan-cycle">Ciclo</Label><Select id="plan-cycle" value={form.billingCycle} onChange={(event) => setForm((current) => ({ ...current, billingCycle: event.target.value as PlanBillingCycle }))}><option value="monthly">Mensal</option><option value="weekly">Semanal</option><option value="daily">Diário</option></Select></div>
            <div className="space-y-1.5"><Label htmlFor="plan-status">Status</Label><Select id="plan-status" value={form.status} onChange={(event) => setForm((current) => ({ ...current, status: event.target.value as "active" | "inactive" }))}><option value="active">Ativo</option><option value="inactive">Inativo</option></Select></div>
          </div>
          <div className="space-y-1.5"><Label htmlFor="plan-description">Descrição</Label><textarea id="plan-description" className="min-h-20 w-full rounded-md border border-slate-200 px-3 py-2 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100" value={form.description} onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))} /></div>
          <div className="flex justify-end gap-2 border-t border-slate-100 pt-4"><Button type="button" variant="secondary" onClick={() => setFormModalOpen(false)} disabled={saving}>Cancelar</Button><Button type="button" onClick={() => void submitForm()} disabled={saving}>{saving ? "Salvando..." : editing ? "Salvar alterações" : "Criar plano"}</Button></div>
        </div>
      </Modal>

      <ConfirmDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)} title="Excluir plano" description={deleteTarget ? `Excluir ${deleteTarget.name}? A operação só será aceita se não houver clientes, acessos ou faturas vinculados.` : ""} confirmLabel="Excluir" variant="destructive" onConfirm={deletePlan} />
    </div>
  );
}
