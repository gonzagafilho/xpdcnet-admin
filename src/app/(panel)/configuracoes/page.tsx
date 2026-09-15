"use client";

import { useCallback, useEffect, useState } from "react";
import { Settings } from "lucide-react";
import { apiFetch } from "@/lib/api-client";
import { userFacingApiError } from "@/lib/user-facing-api-error";
import type { TenantFinancePolicyFromApi } from "@/lib/api-types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

type FormState = {
  financeAutomationEnabled: boolean;
  financeGraceDays: number;
  financeMinOverdueInvoices: number;
  financeCutoffWindowEnabled: boolean;
  financeCutoffStartHour: number;
  financeCutoffEndHour: number;
  financeAutoReactivateWhenClear: boolean;
  financeAutomationMinHoldMinutes: number;
  financeTimezone: string;
};

function asForm(payload: TenantFinancePolicyFromApi): FormState {
  const p = payload.financePolicy;
  return {
    financeAutomationEnabled: Boolean(p.financeAutomationEnabled),
    financeGraceDays: Number(p.financeGraceDays ?? 0),
    financeMinOverdueInvoices: Number(p.financeMinOverdueInvoices ?? 1),
    financeCutoffWindowEnabled: Boolean(p.financeCutoffWindowEnabled),
    financeCutoffStartHour: Number(p.financeCutoffStartHour ?? 0),
    financeCutoffEndHour: Number(p.financeCutoffEndHour ?? 23),
    financeAutoReactivateWhenClear: Boolean(p.financeAutoReactivateWhenClear),
    financeAutomationMinHoldMinutes: Number(
      p.financeAutomationMinHoldMinutes ?? 15,
    ),
    financeTimezone: String(p.financeTimezone || "America/Sao_Paulo"),
  };
}

export default function ConfiguracoesPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [tenantSlug, setTenantSlug] = useState<string>("");
  const [updatedMeta, setUpdatedMeta] = useState<{ by?: string; at?: string | null } | null>(null);
  const [form, setForm] = useState<FormState>({
    financeAutomationEnabled: true,
    financeGraceDays: 0,
    financeMinOverdueInvoices: 1,
    financeCutoffWindowEnabled: false,
    financeCutoffStartHour: 0,
    financeCutoffEndHour: 23,
    financeAutoReactivateWhenClear: true,
    financeAutomationMinHoldMinutes: 15,
    financeTimezone: "America/Sao_Paulo",
  });

  const load = useCallback(async () => {
    setError(null);
    setSuccess(null);
    const payload = await apiFetch<TenantFinancePolicyFromApi>("/tenants/finance-policy");
    setTenantSlug(payload.tenantSlug);
    setForm(asForm(payload));
    setUpdatedMeta({
      by: payload.financePolicy.updatedBy,
      at: payload.financePolicy.updatedAt || null,
    });
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

  const onSave = async () => {
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const payload = await apiFetch<TenantFinancePolicyFromApi>("/tenants/finance-policy", {
        method: "PUT",
        body: JSON.stringify(form),
      });
      setForm(asForm(payload));
      setUpdatedMeta({
        by: payload.financePolicy.updatedBy,
        at: payload.financePolicy.updatedAt || null,
      });
      setSuccess("Política financeira salva com sucesso.");
    } catch (e) {
      setError(userFacingApiError(e));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="p-4 text-sm text-zinc-500">A carregar configurações…</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-xl font-bold tracking-tight text-neutral-900">
          <Settings className="h-5 w-5 text-neutral-600" />
          Configurações
        </h1>
        <p className="text-sm text-neutral-600">
          Política financeira automática por tenant{tenantSlug ? ` (${tenantSlug})` : ""}.
        </p>
      </div>

      {error ? <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</p> : null}
      {success ? (
        <p className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{success}</p>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Automação financeira</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <label className="flex items-center gap-2 text-sm text-neutral-700">
            <input
              type="checkbox"
              checked={form.financeAutomationEnabled}
              onChange={(e) => setForm((f) => ({ ...f, financeAutomationEnabled: e.target.checked }))}
            />
            Ativar automação financeira
          </label>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="grace">Dias de carência</Label>
              <Input
                id="grace"
                type="number"
                min={0}
                max={120}
                value={form.financeGraceDays}
                onChange={(e) => setForm((f) => ({ ...f, financeGraceDays: Number(e.target.value || 0) }))}
              />
            </div>
            <div>
              <Label htmlFor="min-overdue">Mínimo de faturas vencidas</Label>
              <Input
                id="min-overdue"
                type="number"
                min={1}
                max={20}
                value={form.financeMinOverdueInvoices}
                onChange={(e) =>
                  setForm((f) => ({ ...f, financeMinOverdueInvoices: Number(e.target.value || 1) }))
                }
              />
            </div>
            <div className="sm:col-span-2">
              <Label htmlFor="anti-flap">Anti-flapping (min entre mudanças automáticas de status)</Label>
              <Input
                id="anti-flap"
                type="number"
                min={0}
                max={1440}
                value={form.financeAutomationMinHoldMinutes}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    financeAutomationMinHoldMinutes: Number(e.target.value ?? 0),
                  }))
                }
              />
              <p className="mt-1 text-xs text-neutral-500">
                0 desliga. Valores maiores reduzem oscilações do motor financeiro (rollup); não afecta acções manuais no cadastro.
              </p>
            </div>
          </div>

          <label className="flex items-center gap-2 text-sm text-neutral-700">
            <input
              type="checkbox"
              checked={form.financeCutoffWindowEnabled}
              onChange={(e) => setForm((f) => ({ ...f, financeCutoffWindowEnabled: e.target.checked }))}
            />
            Ativar janela de corte por hora
          </label>

          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <Label htmlFor="start-hour">Hora início (0-23)</Label>
              <Input
                id="start-hour"
                type="number"
                min={0}
                max={23}
                value={form.financeCutoffStartHour}
                onChange={(e) => setForm((f) => ({ ...f, financeCutoffStartHour: Number(e.target.value || 0) }))}
              />
            </div>
            <div>
              <Label htmlFor="end-hour">Hora fim (0-23)</Label>
              <Input
                id="end-hour"
                type="number"
                min={0}
                max={23}
                value={form.financeCutoffEndHour}
                onChange={(e) => setForm((f) => ({ ...f, financeCutoffEndHour: Number(e.target.value || 0) }))}
              />
            </div>
            <div>
              <Label htmlFor="timezone">Timezone</Label>
              <Input
                id="timezone"
                placeholder="America/Sao_Paulo"
                value={form.financeTimezone}
                onChange={(e) => setForm((f) => ({ ...f, financeTimezone: e.target.value }))}
              />
            </div>
          </div>

          <label className="flex items-center gap-2 text-sm text-neutral-700">
            <input
              type="checkbox"
              checked={form.financeAutoReactivateWhenClear}
              onChange={(e) => setForm((f) => ({ ...f, financeAutoReactivateWhenClear: e.target.checked }))}
            />
            Religar automaticamente ao regularizar (sem overdue)
          </label>

          <div className="flex items-center gap-3">
            <Button type="button" onClick={() => void onSave()} disabled={saving}>
              {saving ? "Salvando..." : "Salvar política"}
            </Button>
            <Button type="button" variant="outline" onClick={() => void load()} disabled={saving}>
              Recarregar
            </Button>
          </div>

          {updatedMeta?.at ? (
            <p className="text-xs text-neutral-500">
              Última atualização: {new Date(updatedMeta.at).toLocaleString("pt-BR")}
              {updatedMeta.by ? ` por ${updatedMeta.by}` : ""}
            </p>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
