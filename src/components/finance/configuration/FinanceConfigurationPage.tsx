"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, History, Save, ShieldAlert, SlidersHorizontal, Sparkles, Zap } from "lucide-react";
import type {
  FinanceConfigurationFromApi,
  FinanceConfigurationValidationResponseFromApi,
} from "@/lib/api-types";
import { apiFetch } from "@/lib/api-client";
import {
  getPanelSessionRole,
  hasPanelFinanceConfigurationPermission,
} from "@/lib/panel-auth";
import { userFacingApiError } from "@/lib/user-facing-api-error";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ErrorState } from "@/components/ui/error-state";
import { Skeleton } from "@/components/ui/skeleton";
import { ConfigurationDiff } from "./ConfigurationDiff";
import { ConfigurationHistory } from "./ConfigurationHistory";
import { DueDateSettingsCard } from "./DueDateSettingsCard";
import { ExceptionsSettingsCard } from "./ExceptionsSettingsCard";
import { GeneralSettingsCard } from "./GeneralSettingsCard";
import { InstallmentSettingsCard } from "./InstallmentSettingsCard";
import { InterestSettingsCard } from "./InterestSettingsCard";
import { NotificationSettingsCard } from "./NotificationSettingsCard";
import { PenaltySettingsCard } from "./PenaltySettingsCard";
import { ReactivationSettingsCard } from "./ReactivationSettingsCard";
import { SecuritySettingsCard } from "./SecuritySettingsCard";
import { SimulationBanner } from "./SimulationBanner";
import { SuspensionSettingsCard } from "./SuspensionSettingsCard";

type TabId =
  | "geral"
  | "vencimento"
  | "penalidades"
  | "avisos"
  | "suspensao"
  | "reativacao"
  | "excecoes"
  | "parcelamento"
  | "seguranca"
  | "historico";

const tabs: Array<{ id: TabId; label: string }> = [
  { id: "geral", label: "Geral" },
  { id: "vencimento", label: "Vencimento" },
  { id: "penalidades", label: "Multa e juros" },
  { id: "avisos", label: "Avisos" },
  { id: "suspensao", label: "Suspensão" },
  { id: "reativacao", label: "Reativação" },
  { id: "excecoes", label: "Exceções" },
  { id: "parcelamento", label: "Parcelamento" },
  { id: "seguranca", label: "Segurança" },
  { id: "historico", label: "Histórico" },
];

function editableSnapshot(value: FinanceConfigurationFromApi | null) {
  if (!value) return "";
  return JSON.stringify({
    simulationMode: value.simulationMode,
    timezone: value.timezone,
    currency: value.currency,
    due: value.due,
    penalties: value.penalties,
    notifications: value.notifications,
    suspension: value.suspension,
    reactivation: value.reactivation,
    security: value.security,
    scope: value.scope,
    exceptions: value.exceptions,
    installment: value.installment,
    changeReason: value.changeReason,
  });
}

function requestConfig(value: FinanceConfigurationFromApi) {
  return {
    simulationMode: value.simulationMode,
    timezone: value.timezone,
    currency: value.currency,
    due: value.due,
    penalties: value.penalties,
    notifications: value.notifications,
    suspension: value.suspension,
    reactivation: value.reactivation,
    security: value.security,
    scope: value.scope,
    exceptions: value.exceptions,
    installment: value.installment,
  };
}

export function FinanceConfigurationPage() {
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabId>("geral");
  const [role, setRole] = useState<string | null>(null);
  const [current, setCurrent] = useState<FinanceConfigurationFromApi | null>(null);
  const [draft, setDraft] = useState<FinanceConfigurationFromApi | null>(null);
  const [history, setHistory] = useState<FinanceConfigurationFromApi[]>([]);
  const [selectedHistoryVersion, setSelectedHistoryVersion] = useState<number | null>(null);
  const [validation, setValidation] = useState<FinanceConfigurationValidationResponseFromApi | null>(null);

  const canRead = hasPanelFinanceConfigurationPermission("read", role);
  const canWrite = hasPanelFinanceConfigurationPermission("write", role);
  const canActivate = hasPanelFinanceConfigurationPermission("activate", role);
  const canRestore = hasPanelFinanceConfigurationPermission("restore", role);
  const canEmergencyStop = hasPanelFinanceConfigurationPermission("emergencyStop", role);

  useEffect(() => {
    const syncRole = () => setRole(getPanelSessionRole());
    syncRole();
    const intervalId = window.setInterval(syncRole, 200);
    const stopId = window.setTimeout(() => window.clearInterval(intervalId), 4000);
    return () => {
      window.clearInterval(intervalId);
      window.clearTimeout(stopId);
    };
  }, []);

  const load = useCallback(async () => {
    setError(null);
    const [currentRes, historyRes] = await Promise.all([
      apiFetch<{ item: FinanceConfigurationFromApi }>("/finance/configuration/current"),
      apiFetch<{ items: FinanceConfigurationFromApi[] }>("/finance/configuration/history"),
    ]);
    setCurrent(currentRes.item);
    setDraft(currentRes.item);
    setHistory(historyRes.items);
    setSelectedHistoryVersion((prev) => prev ?? historyRes.items[0]?.version ?? null);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await load();
      } catch (err) {
        if (!cancelled) setError(userFacingApiError(err));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [load]);

  const dirty = useMemo(() => editableSnapshot(current) !== editableSnapshot(draft), [current, draft]);
  const selectedHistory = useMemo(
    () => history.find((item) => item.version === selectedHistoryVersion) || null,
    [history, selectedHistoryVersion],
  );

  const persistResult = useCallback(async (message: string) => {
    await load();
    setSuccess(message);
  }, [load]);

  const ensureDraft = () => {
    if (!draft) throw new Error("Configuração indisponível.");
    return draft;
  };

  const withBusy = async (action: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    setSuccess(null);
    try {
      await action();
    } catch (err) {
      setError(userFacingApiError(err));
    } finally {
      setBusy(false);
    }
  };

  const handleValidate = () => withBusy(async () => {
    const nextDraft = ensureDraft();
    const result = await apiFetch<FinanceConfigurationValidationResponseFromApi>(
      "/finance/configuration/validate",
      {
        method: "POST",
        body: JSON.stringify({ config: requestConfig(nextDraft) }),
      },
    );
    setValidation(result);
    setSuccess(result.valid ? "Configuração validada com sucesso." : "A validação encontrou pendências.");
  });

  const handleSaveDraft = () => withBusy(async () => {
    const nextDraft = ensureDraft();
    const result = await apiFetch<{ item: FinanceConfigurationFromApi }>("/finance/configuration/versions", {
      method: "POST",
      body: JSON.stringify({
        config: requestConfig(nextDraft),
        changeReason: nextDraft.changeReason,
        activate: false,
      }),
    });
    setDraft(result.item);
    await persistResult(`Versão ${result.item.version} salva como rascunho.`);
  });

  const handleActivate = () => withBusy(async () => {
    const nextDraft = ensureDraft();
    if (nextDraft.isPersisted && !dirty) {
      await apiFetch(`/finance/configuration/${nextDraft.version}/activate`, {
        method: "POST",
        body: JSON.stringify({ changeReason: nextDraft.changeReason }),
      });
      await persistResult(`Versão ${nextDraft.version} ativada.`);
      return;
    }

    const result = await apiFetch<{ item: FinanceConfigurationFromApi }>("/finance/configuration/versions", {
      method: "POST",
      body: JSON.stringify({
        config: requestConfig(nextDraft),
        changeReason: nextDraft.changeReason,
        activate: true,
      }),
    });
    setDraft(result.item);
    await persistResult(`Versão ${result.item.version} criada e ativada.`);
  });

  const handleRestore = (item: FinanceConfigurationFromApi) => {
    const reason = window.prompt(`Justificativa para restaurar a versão ${item.version}:`, draft?.changeReason || "");
    if (reason === null) return;
    void withBusy(async () => {
      const result = await apiFetch<{ item: FinanceConfigurationFromApi }>(
        `/finance/configuration/${item.version}/restore`,
        {
          method: "POST",
          body: JSON.stringify({ changeReason: reason }),
        },
      );
      setDraft(result.item);
      await persistResult(`Versão ${item.version} restaurada como nova versão ${result.item.version}.`);
    });
  };

  const handleEmergencyStop = () => {
    const reason = window.prompt("Justificativa para registrar a parada de emergência:", draft?.changeReason || "");
    if (reason === null) return;
    void withBusy(async () => {
      const result = await apiFetch<{ item: FinanceConfigurationFromApi }>("/finance/configuration/emergency-stop", {
        method: "POST",
        body: JSON.stringify({ changeReason: reason }),
      });
      setDraft(result.item);
      await persistResult(`Parada de emergência registrada na versão ${result.item.version}.`);
    });
  };

  const handleActivateHistory = (item: FinanceConfigurationFromApi) => {
    const reason = window.prompt(`Justificativa para ativar a versão ${item.version}:`, draft?.changeReason || item.changeReason || "");
    if (reason === null) return;
    void withBusy(async () => {
      await apiFetch(`/finance/configuration/${item.version}/activate`, {
        method: "POST",
        body: JSON.stringify({ changeReason: reason }),
      });
      await persistResult(`Versão ${item.version} ativada.`);
    });
  };

  if (loading) {
    return (
      <div className="mx-auto w-full max-w-[92rem] space-y-5 pb-8">
        <Skeleton className="h-24 w-full rounded-2xl" />
        <Skeleton className="h-16 w-full rounded-2xl" />
        <Skeleton className="h-[32rem] w-full rounded-2xl" />
      </div>
    );
  }

  if (!canRead && role) {
    return <ErrorState title="Acesso restrito" description="Seu perfil não possui permissão para ler as Configurações Financeiras." />;
  }

  if (error && !draft) {
    return <ErrorState title="Falha ao carregar as Configurações Financeiras" description={error} onRetry={() => void load()} />;
  }

  if (!draft) {
    return <ErrorState title="Configuração indisponível" description="Não foi possível preparar a configuração financeira para edição." onRetry={() => void load()} />;
  }

  return (
    <div className="mx-auto w-full max-w-[92rem] space-y-5 pb-8">
      <SimulationBanner />

      <Card>
        <CardHeader className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-xl">
              <SlidersHorizontal className="h-5 w-5 text-dcnet-primary" />
              Configurações Financeiras
            </CardTitle>
            <CardDescription>
              Defina vencimentos, tolerância, multa, juros, avisos, suspensão e reativação dos clientes.
            </CardDescription>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" onClick={handleValidate} disabled={busy || !canWrite}>
              <Sparkles className="h-4 w-4" /> Validar configuração
            </Button>
            <Button type="button" variant="outline" onClick={handleSaveDraft} disabled={busy || !canWrite}>
              <Save className="h-4 w-4" /> Salvar rascunho
            </Button>
            <Button type="button" onClick={handleActivate} disabled={busy || !canActivate}>
              <Zap className="h-4 w-4" /> Ativar versão
            </Button>
            <Button type="button" variant="outline" onClick={() => setActiveTab("historico")} disabled={busy}>
              <History className="h-4 w-4" /> Ver histórico
            </Button>
            <Button type="button" variant="destructive" onClick={handleEmergencyStop} disabled={busy || !canEmergencyStop}>
              <ShieldAlert className="h-4 w-4" /> Parada de emergência
            </Button>
          </div>
        </CardHeader>
      </Card>

      {error ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div>
      ) : null}
      {success ? (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{success}</div>
      ) : null}

      {validation ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <AlertTriangle className="h-4 w-4 text-amber-700" /> Resultado da validação
            </CardTitle>
            <CardDescription>Válido: {validation.valid ? "sim" : "não"} · Impacto estimado protegido por simulação.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 lg:grid-cols-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.08em] text-dcnet-muted">Warnings</p>
              <ul className="mt-2 space-y-2 text-sm text-dcnet-secondary">
                {validation.warnings.length === 0 ? <li>Nenhum warning.</li> : validation.warnings.map((warning) => <li key={warning}>{warning}</li>)}
              </ul>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.08em] text-dcnet-muted">Erros</p>
              <ul className="mt-2 space-y-2 text-sm text-dcnet-secondary">
                {validation.errors.length === 0 ? <li>Nenhum erro.</li> : validation.errors.map((issue) => <li key={`${issue.field}-${issue.message}`}>{issue.field}: {issue.message}</li>)}
              </ul>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.08em] text-dcnet-muted">Impacto estimado</p>
              <ul className="mt-2 space-y-2 text-sm text-dcnet-secondary">
                <li>Canais ativos: {validation.estimatedImpact.notificationChannelsEnabled}</li>
                <li>Alvos de suspensão marcados: {validation.estimatedImpact.suspensionTargetsEnabled}</li>
                <li>Penalidades ligadas: {validation.estimatedImpact.penaltiesEnabled}</li>
                <li>Reativação ligada: {validation.estimatedImpact.reactivationEnabled ? "sim" : "não"}</li>
              </ul>
            </div>
          </CardContent>
        </Card>
      ) : null}

      <div className="flex flex-wrap gap-2">
        {tabs.map((tab) => (
          <Button key={tab.id} type="button" variant={activeTab === tab.id ? "default" : "outline"} size="sm" onClick={() => setActiveTab(tab.id)}>
            {tab.label}
          </Button>
        ))}
      </div>

      {activeTab === "geral" ? <GeneralSettingsCard value={draft} disabled={busy || !canWrite} onChange={setDraft} /> : null}
      {activeTab === "vencimento" ? <DueDateSettingsCard value={draft.due} disabled={busy || !canWrite} onChange={(due) => setDraft({ ...draft, due })} /> : null}
      {activeTab === "penalidades" ? (
        <div className="grid gap-5 xl:grid-cols-2">
          <PenaltySettingsCard value={draft.penalties.lateFee} disabled={busy || !canWrite} onChange={(lateFee) => setDraft({ ...draft, penalties: { ...draft.penalties, lateFee } })} />
          <InterestSettingsCard value={draft.penalties.interest} disabled={busy || !canWrite} onChange={(interest) => setDraft({ ...draft, penalties: { ...draft.penalties, interest } })} />
        </div>
      ) : null}
      {activeTab === "avisos" ? <NotificationSettingsCard value={draft.notifications} disabled={busy || !canWrite} onChange={(notifications) => setDraft({ ...draft, notifications })} /> : null}
      {activeTab === "suspensao" ? <SuspensionSettingsCard value={draft.suspension} disabled={busy || !canWrite} onChange={(suspension) => setDraft({ ...draft, suspension })} /> : null}
      {activeTab === "reativacao" ? <ReactivationSettingsCard value={draft.reactivation} disabled={busy || !canWrite} onChange={(reactivation) => setDraft({ ...draft, reactivation })} /> : null}
      {activeTab === "excecoes" ? <ExceptionsSettingsCard scope={draft.scope} exceptions={draft.exceptions} disabled={busy || !canWrite} onScopeChange={(scope) => setDraft({ ...draft, scope })} onExceptionsChange={(exceptions) => setDraft({ ...draft, exceptions })} /> : null}
      {activeTab === "parcelamento" ? <InstallmentSettingsCard value={draft.installment} disabled={busy || !canWrite} onChange={(installment) => setDraft({ ...draft, installment })} /> : null}
      {activeTab === "seguranca" ? <SecuritySettingsCard value={draft.security} simulationMode={draft.simulationMode} disabled={busy || !canWrite} onChange={(security) => setDraft({ ...draft, security })} /> : null}
      {activeTab === "historico" ? (
        <div className="grid gap-5 xl:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
          <ConfigurationHistory
            items={history}
            selectedVersion={selectedHistoryVersion}
            canActivate={canActivate}
            canRestore={canRestore}
            busy={busy}
            onView={(item) => setSelectedHistoryVersion(item.version)}
            onActivate={handleActivateHistory}
            onRestore={handleRestore}
          />
          <ConfigurationDiff current={draft} compareAgainst={selectedHistory} />
        </div>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Resumo operacional</CardTitle>
          <CardDescription>Este módulo prepara regras e versões, mas não cria nem executa automação real no FIN-1.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-2xl border border-dcnet-border bg-dcnet-surface-muted/60 p-4 text-sm text-dcnet-secondary">Versão atual: <span className="font-semibold text-dcnet-text">v{draft.version || 0}</span></div>
          <div className="rounded-2xl border border-dcnet-border bg-dcnet-surface-muted/60 p-4 text-sm text-dcnet-secondary">Rascunho alterado: <span className="font-semibold text-dcnet-text">{dirty ? "sim" : "não"}</span></div>
          <div className="rounded-2xl border border-dcnet-border bg-dcnet-surface-muted/60 p-4 text-sm text-dcnet-secondary">Histórico disponível: <span className="font-semibold text-dcnet-text">{history.length}</span></div>
          <div className="rounded-2xl border border-dcnet-border bg-dcnet-surface-muted/60 p-4 text-sm text-dcnet-secondary">Role do painel: <span className="font-semibold text-dcnet-text">{role || "—"}</span></div>
        </CardContent>
      </Card>
    </div>
  );
}