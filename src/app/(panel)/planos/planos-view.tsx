"use client";

import { useCallback, useEffect, useState } from "react";
import { apiFetch } from "@/lib/api-client";
import { userFacingApiError } from "@/lib/user-facing-api-error";
import type { PlanAuthType, PlanBillingCycle, PlanFromApi } from "@/lib/api-types";
import { formatBRL } from "@/lib/api-types";
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
import { Network, Pencil, Plus, Trash2 } from "lucide-react";

type ToastState = { variant: "success" | "error"; message: string } | null;

type PlanForm = {
  name: string;
  speedMbps: string;
  price: string;
  authType: PlanAuthType;
  billingCycle: PlanBillingCycle;
  isActive: "true" | "false";
};

const emptyForm: PlanForm = {
  name: "",
  speedMbps: "",
  price: "",
  authType: "pppoe",
  billingCycle: "monthly",
  isActive: "true",
};

function planToForm(p: PlanFromApi): PlanForm {
  return {
    name: p.name,
    speedMbps: String(p.speedMbps),
    price: String(p.price),
    authType: (p.authType === "hotspot" ? "hotspot" : "pppoe") as PlanAuthType,
    billingCycle: (["monthly", "weekly", "daily"].includes(String(p.billingCycle))
      ? p.billingCycle
      : "monthly") as PlanBillingCycle,
    isActive: p.isActive === false ? "false" : "true",
  };
}

export function PlanosView() {
  const [plans, setPlans] = useState<PlanFromApi[]>([]);
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
    const t = setTimeout(() => setToast(null), 4500);
    return () => clearTimeout(t);
  }, [toast]);

  const load = useCallback(async () => {
    setListError(null);
    const list = await apiFetch<PlanFromApi[]>("/plans");
    setPlans(Array.isArray(list) ? list : []);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        await load();
      } catch (e) {
        if (!cancelled) setListError(userFacingApiError(e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [load]);

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setFormError(null);
    setFormModalOpen(true);
  };

  const openEdit = (p: PlanFromApi) => {
    setEditing(p);
    setForm(planToForm(p));
    setFormError(null);
    setFormModalOpen(true);
  };

  const submitForm = async () => {
    setFormError(null);
    const name = form.name.trim();
    const speed = Number(form.speedMbps.replace(",", "."));
    const price = Number(form.price.replace(",", "."));

    if (!name) {
      setFormError("Nome é obrigatório.");
      return;
    }
    if (Number.isNaN(speed) || speed <= 0) {
      setFormError("Velocidade inválida (Mbps).");
      return;
    }
    if (Number.isNaN(price) || price < 0) {
      setFormError("Preço inválido.");
      return;
    }

    const body = {
      name,
      speedMbps: speed,
      price,
      billingCycle: form.billingCycle,
      authType: form.authType,
      isActive: form.isActive === "true",
    };

    setSaving(true);
    try {
      if (!editing) {
        await apiFetch<PlanFromApi>("/plans", { method: "POST", body: JSON.stringify(body) });
        setToast({ variant: "success", message: "Plano criado com sucesso." });
      } else {
        await apiFetch<PlanFromApi>(`/plans/${editing._id}`, {
          method: "PUT",
          body: JSON.stringify(body),
        });
        setToast({ variant: "success", message: "Plano atualizado." });
      }
      setFormModalOpen(false);
      await load();
    } catch (e) {
      setFormError(userFacingApiError(e));
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async (p: PlanFromApi) => {
    const next = p.isActive === false;
    setTogglingId(p._id);
    try {
      await apiFetch<PlanFromApi>(`/plans/${p._id}`, {
        method: "PUT",
        body: JSON.stringify({ isActive: next }),
      });
      setPlans((prev) =>
        prev.map((x) => (x._id === p._id ? { ...x, isActive: next } : x)),
      );
      setToast({
        variant: "success",
        message: next ? "Plano ativado." : "Plano desativado.",
      });
    } catch (e) {
      setToast({ variant: "error", message: userFacingApiError(e) });
    } finally {
      setTogglingId(null);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    const id = deleteTarget._id;
    try {
      await apiFetch(`/plans/${id}`, { method: "DELETE" });
      setToast({ variant: "success", message: "Plano eliminado." });
      await load();
    } catch (e) {
      setToast({ variant: "error", message: userFacingApiError(e) });
      throw e;
    }
  };

  const authLabel = (t: string | undefined) =>
    t === "hotspot" ? "Hotspot" : "PPPoE";

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      {toast ? (
        <div
          className={
            toast.variant === "success"
              ? "fixed bottom-4 right-4 z-[100] max-w-sm rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900 shadow-lg"
              : "fixed bottom-4 right-4 z-[100] max-w-sm rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900 shadow-lg"
          }
          role="status"
        >
          {toast.message}
        </div>
      ) : null}

      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-lg font-semibold text-zinc-900">Planos</h1>
          <p className="text-sm text-zinc-500">
            CRUD sobre a API /plans (tenant resolvido no servidor).
          </p>
        </div>
        <Button type="button" onClick={openCreate} className="shrink-0 gap-2" disabled={loading}>
          <Plus className="h-4 w-4" />
          Novo plano
        </Button>
      </div>

      {listError ? (
        <div
          className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
          role="alert"
        >
          {listError}
        </div>
      ) : null}

      {loading ? (
        <p className="py-12 text-center text-sm text-zinc-500">A carregar planos…</p>
      ) : plans.length === 0 ? (
        <EmptyState
          icon={<Network className="mx-auto h-10 w-10" />}
          title="Nenhum plano"
          description="Crie o primeiro plano com «Novo plano» ou aguarde dados na API."
          action={
            <Button type="button" onClick={openCreate}>
              Novo plano
            </Button>
          }
        />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>Velocidade</TableHead>
              <TableHead>Preço</TableHead>
              <TableHead>Autenticação</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {plans.map((p) => (
              <TableRow key={p._id}>
                <TableCell className="font-medium text-zinc-900">{p.name}</TableCell>
                <TableCell className="text-zinc-600">{p.speedMbps} Mbps</TableCell>
                <TableCell className="text-zinc-600">{formatBRL(p.price)}</TableCell>
                <TableCell className="text-zinc-600">{authLabel(p.authType)}</TableCell>
                <TableCell>
                  {p.isActive === false ? (
                    <Badge variant="warning">Inativo</Badge>
                  ) : (
                    <Badge variant="success">Ativo</Badge>
                  )}
                </TableCell>
                <TableCell>
                  <div className="flex flex-wrap items-center justify-end gap-2">
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      disabled={togglingId === p._id}
                      onClick={() => void handleToggleActive(p)}
                    >
                      {togglingId === p._id
                        ? "…"
                        : p.isActive === false
                          ? "Ativar"
                          : "Desativar"}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="gap-1"
                      onClick={() => openEdit(p)}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                      Editar
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="gap-1 text-red-700 hover:bg-red-50"
                      onClick={() => setDeleteTarget(p)}
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
      )}

      <Modal
        open={formModalOpen}
        onOpenChange={setFormModalOpen}
        title={editing ? "Editar plano" : "Novo plano"}
        description={
          editing
            ? "Alterações enviadas com PUT /plans/:id."
            : "Campos alinhados a POST /plans (name, speedMbps, price obrigatórios)."
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
            <Label htmlFor="pf-name">Nome *</Label>
            <Input
              id="pf-name"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="Ex.: 300 Mbps"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="pf-speed">Velocidade (Mbps) *</Label>
              <Input
                id="pf-speed"
                inputMode="decimal"
                value={form.speedMbps}
                onChange={(e) => setForm((f) => ({ ...f, speedMbps: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pf-price">Preço (R$) *</Label>
              <Input
                id="pf-price"
                inputMode="decimal"
                value={form.price}
                onChange={(e) => setForm((f) => ({ ...f, price: e.target.value }))}
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="pf-auth">Tipo de autenticação</Label>
            <Select
              id="pf-auth"
              value={form.authType}
              onChange={(e) => setForm((f) => ({ ...f, authType: e.target.value as PlanAuthType }))}
            >
              <option value="pppoe">PPPoE</option>
              <option value="hotspot">Hotspot</option>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="pf-cycle">Ciclo de faturação</Label>
            <Select
              id="pf-cycle"
              value={form.billingCycle}
              onChange={(e) =>
                setForm((f) => ({ ...f, billingCycle: e.target.value as PlanBillingCycle }))
              }
            >
              <option value="monthly">Mensal</option>
              <option value="weekly">Semanal</option>
              <option value="daily">Diário</option>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="pf-active">Estado</Label>
            <Select
              id="pf-active"
              value={form.isActive}
              onChange={(e) => setForm((f) => ({ ...f, isActive: e.target.value as "true" | "false" }))}
            >
              <option value="true">Ativo</option>
              <option value="false">Inativo</option>
            </Select>
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

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(o) => !o && setDeleteTarget(null)}
        title="Eliminar plano"
        description={
          deleteTarget
            ? `Tem a certeza que deseja eliminar «${deleteTarget.name}»? Esta ação não pode ser anulada. Clientes associados podem ficar inconsistentes.`
            : ""
        }
        confirmLabel="Eliminar"
        variant="destructive"
        onConfirm={handleDelete}
      />
    </div>
  );
}
