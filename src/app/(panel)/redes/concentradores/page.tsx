"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Activity,
  BellRing,
  Cable,
  CheckCircle2,
  Clock3,
  Edit3,
  Loader2,
  Plus,
  RefreshCw,
  Router,
  Server,
  ShieldAlert,
  ShieldCheck,
  TriangleAlert,
  Wifi,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Modal } from "@/components/ui/modal";
import { Select } from "@/components/ui/select";
import { ApiRequestError, apiFetch } from "@/lib/api-client";
import type {
  MonitoringConcentratorAlert,
  MonitoringConcentratorAlertsResponse,
  MonitoringConcentratorDetailResponse,
  MonitoringConcentratorHealth,
  MonitoringConcentratorTelemetrySnapshot,
  MonitoringConcentratorItem,
  MonitoringConcentratorsResponse,
  NetworkNodeFromApi,
} from "@/lib/api-types";

type SnapshotSummary = {
  total: number;
  online: number;
  offline: number;
  lastSyncAt: string | null;
};

type NetworkConcentrator = {
  id: string;
  tenantId: string | null;
  name: string;
  type: string;
  agentNodeId: string | null;
  host: string;
  port: number | null;
  username: string;
  protocol: string;
  tls: boolean;
  enabled: boolean;
  status: string;
  lastTestAt: string | null;
  lastErrorSafe: string;
  metadata?: Record<string, unknown>;
  snapshotSummary: SnapshotSummary | null;
  createdAt?: string | null;
  updatedAt?: string | null;
  health?: MonitoringConcentratorHealth;
  healthScore?: number;
  cpuPercent?: number;
  memoryPercent?: number;
  pppOnline?: number;
  pppOffline?: number;
  pppTotal?: number;
  interfaceRunning?: number;
  interfaceTotal?: number;
  version?: string;
  uptime?: string;
  openAlerts?: number;
  criticalAlerts?: number;
  warningAlerts?: number;
};

type FormState = {
  name: string;
  type: string;
  protocol: string;
  host: string;
  port: string;
  username: string;
  password: string;
  tls: boolean;
  enabled: boolean;
  agentNodeId: string;
  via: string;
  notes: string;
};

const EMPTY_FORM: FormState = {
  name: "",
  type: "mikrotik",
  protocol: "routeros",
  host: "",
  port: "8728",
  username: "",
  password: "",
  tls: false,
  enabled: true,
  agentNodeId: "",
  via: "",
  notes: "",
};

const CHACARA_PRESET: FormState = {
  ...EMPTY_FORM,
  name: "CHACARA STARLINK",
  host: "10.201.201.10",
  username: "xpdcnet",
  via: "WireGuard",
  notes: "Concentrador remoto via Starlink e túnel WireGuard com servidor XPDCNET.",
};

function formatDate(value?: string | null) {
  if (!value) return "Sem registro";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Sem registro";
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(date);
}

function formatTime(value?: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit" }).format(date);
}

function statusLabel(status?: string) {
  const labels: Record<string, string> = {
    online: "Online",
    offline: "Offline",
    auth_error: "Falha de autenticação",
    timeout: "Tempo esgotado",
    unsupported: "Não suportado",
    unknown: "Não testado",
  };
  return labels[String(status || "unknown")] || status || "Não testado";
}

function statusVariant(status?: string): "success" | "error" | "warning" | "muted" {
  if (status === "online") return "success";
  if (["offline", "auth_error"].includes(String(status))) return "error";
  if (["timeout", "unsupported"].includes(String(status))) return "warning";
  return "muted";
}

function healthVariant(health?: string): "success" | "error" | "warning" | "muted" {
  if (health === "healthy") return "success";
  if (health === "critical") return "error";
  if (health === "warning" || health === "degraded") return "warning";
  return "muted";
}

function healthTone(score?: number): "green" | "yellow" | "orange" | "red" {
  if (Number(score) >= 90) return "green";
  if (Number(score) >= 70) return "yellow";
  if (Number(score) >= 40) return "orange";
  return "red";
}

function mergeConcentrator(
  admin: NetworkConcentrator,
  monitoring?: MonitoringConcentratorItem,
): NetworkConcentrator {
  if (!monitoring) return admin;
  return {
    ...admin,
    status: monitoring.status?.trim() || admin.status,
    health: monitoring.health,
    healthScore: monitoring.healthScore,
    cpuPercent: monitoring.cpuPercent,
    memoryPercent: monitoring.memoryPercent,
    pppOnline: monitoring.pppOnline,
    pppOffline: monitoring.pppOffline,
    pppTotal: monitoring.pppTotal,
    interfaceRunning: monitoring.interfaceRunning,
    interfaceTotal: monitoring.interfaceTotal,
    version: monitoring.version,
    uptime: monitoring.uptime,
    openAlerts: monitoring.openAlerts,
    criticalAlerts: monitoring.criticalAlerts,
    warningAlerts: monitoring.warningAlerts,
  };
}

function metadataText(metadata: Record<string, unknown> | undefined, key: string) {
  const value = metadata?.[key];
  return typeof value === "string" ? value : "";
}

function apiError(error: unknown) {
  return error instanceof ApiRequestError
    ? error.message
    : error instanceof Error
      ? error.message
      : "Não foi possível concluir a operação.";
}

export default function ConcentradoresPage() {
  const [rows, setRows] = useState<NetworkConcentrator[]>([]);
  const [agents, setAgents] = useState<NetworkNodeFromApi[]>([]);
  const [monitoring, setMonitoring] = useState<MonitoringConcentratorsResponse | null>(null);
  const [monitoringDetail, setMonitoringDetail] = useState<MonitoringConcentratorDetailResponse | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState("");
  const [openAlerts, setOpenAlerts] = useState<MonitoringConcentratorAlert[]>([]);
  const [resolvingAlertId, setResolvingAlertId] = useState<string | null>(null);
  const [alertsError, setAlertsError] = useState("");
  const [selectedId, setSelectedId] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [testingId, setTestingId] = useState<string | null>(null);

  const selected = useMemo(
    () => rows.find((row) => row.id === selectedId) || rows[0] || null,
    [rows, selectedId],
  );

  const monitoringById = useMemo(
    () => new Map((monitoring?.items || []).map((item) => [item.id, item])),
    [monitoring],
  );
  const selectedMonitoring: MonitoringConcentratorItem | null = monitoringDetail?.item?.id === selectedId
    ? monitoringDetail.item
    : monitoringById.get(selectedId) || null;

  const agentById = useMemo(
    () => new Map(agents.map((agent) => [agent._id, agent])),
    [agents],
  );

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    setAlertsError("");
    try {
      const alertsRequest = apiFetch<MonitoringConcentratorAlertsResponse>(
        "/monitoring/alerts/open",
        { timeoutMs: 60_000 },
      ).catch((err) => {
        setAlertsError(apiError(err));
        return null;
      });
      const [concentrators, central, nodes, alerts] = await Promise.all([
        apiFetch<NetworkConcentrator[]>("/api/admin/network/concentrators", { timeoutMs: 60_000 }),
        apiFetch<MonitoringConcentratorsResponse>("/monitoring/concentrators", { timeoutMs: 60_000 }),
        apiFetch<NetworkNodeFromApi[]>("/network-nodes", { timeoutMs: 60_000 }),
        alertsRequest,
      ]);
      const monitoringItems = Array.isArray(central?.items) ? central.items : [];
      const operationalById = new Map(monitoringItems.map((item) => [item.id, item]));
      const adminRows = Array.isArray(concentrators) ? concentrators : [];
      const nextRows = adminRows.map((admin) => mergeConcentrator(admin, operationalById.get(admin.id)));
      setRows(nextRows);
      setMonitoring(central);
      if (alerts) setOpenAlerts(Array.isArray(alerts.items) ? alerts.items : []);
      setAgents((Array.isArray(nodes) ? nodes : []).filter((node) => node.type === "REMOTE_AGENT"));
      setSelectedId((current) => (
        current && nextRows.some((row) => row.id === current) ? current : nextRows[0]?.id || ""
      ));
    } catch (err) {
      setError(apiError(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!selectedId) {
      setMonitoringDetail(null);
      setDetailError("");
      return;
    }
    let cancelled = false;
    setMonitoringDetail(null);
    setDetailLoading(true);
    setDetailError("");
    void apiFetch<MonitoringConcentratorDetailResponse>(
      `/monitoring/concentrators/${encodeURIComponent(selectedId)}`,
      { timeoutMs: 30_000 },
    ).then((detail) => {
      if (!cancelled) setMonitoringDetail(detail);
    }).catch((err) => {
      if (!cancelled) setDetailError(apiError(err));
    }).finally(() => {
      if (!cancelled) setDetailLoading(false);
    });
    return () => { cancelled = true; };
  }, [selectedId]);

  function openCreate(preset = false) {
    setEditingId(null);
    setForm(preset ? { ...CHACARA_PRESET, agentNodeId: agents[0]?._id || "" } : { ...EMPTY_FORM, agentNodeId: agents[0]?._id || "" });
    setModalOpen(true);
    setError("");
    setNotice("");
  }

  function openEdit(row: NetworkConcentrator) {
    setEditingId(row.id);
    setForm({
      name: row.name,
      type: row.type,
      protocol: row.protocol,
      host: row.host,
      port: String(row.port || 8728),
      username: row.username,
      password: "",
      tls: row.tls,
      enabled: row.enabled,
      agentNodeId: row.agentNodeId || "",
      via: metadataText(row.metadata, "via"),
      notes: metadataText(row.metadata, "notes"),
    });
    setModalOpen(true);
    setError("");
    setNotice("");
  }

  async function save(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setNotice("");
    try {
      const payload: Record<string, unknown> = {
        name: form.name.trim(),
        type: form.type,
        protocol: form.protocol,
        host: form.host.trim(),
        port: Number(form.port),
        username: form.username.trim(),
        tls: form.tls,
        enabled: form.enabled,
        agentNodeId: form.agentNodeId,
        metadata: {
          via: form.via.trim(),
          notes: form.notes.trim(),
        },
      };
      if (form.password) payload.password = form.password;

      const path = editingId
        ? `/api/admin/network/concentrators/${encodeURIComponent(editingId)}`
        : "/api/admin/network/concentrators";
      const saved = await apiFetch<NetworkConcentrator>(path, {
        method: editingId ? "PATCH" : "POST",
        body: JSON.stringify(payload),
      });
      setModalOpen(false);
      setNotice(editingId ? "Concentrador atualizado com sucesso." : "Concentrador criado com sucesso.");
      await load();
      setSelectedId(saved.id);
    } catch (err) {
      setError(apiError(err));
    } finally {
      setSaving(false);
    }
  }

  async function resolveAlert(alert: MonitoringConcentratorAlert) {
    const alertId = String(alert.id || alert._id || '');
    if (!alertId) {
      setAlertsError("Alerta sem identificador válido.");
      return;
    }
    setResolvingAlertId(alertId);
    setAlertsError("");
    try {
      if (!alertId) return;
    await apiFetch(`/monitoring/alerts/${encodeURIComponent(alertId)}/resolve`, { method: "POST" });
      setNotice("Alerta resolvido com sucesso.");
      await load();
    } catch (err) {
      setAlertsError(apiError(err));
    } finally {
      setResolvingAlertId(null);
    }
  }

  async function testConnection(row: NetworkConcentrator) {
    setTestingId(row.id);
    setError("");
    setNotice("");
    try {
      await apiFetch(`/api/admin/network/concentrators/${encodeURIComponent(row.id)}/test`, {
        method: "POST",
      });
      setNotice(`Teste de ${row.name} enviado ao agente vinculado.`);
      window.setTimeout(() => void load(), 2500);
    } catch (err) {
      setError(apiError(err));
    } finally {
      setTestingId(null);
    }
  }

  return (
    <div className="mx-auto w-full max-w-[90rem] space-y-6 pb-10">
      <div className="flex flex-col gap-4 border-b border-slate-200 pb-5 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-[11px] font-semibold uppercase text-slate-500">Rede DC NET</p>
          <h1 className="mt-1 text-2xl font-semibold text-slate-950">Concentradores</h1>
          <p className="mt-2 max-w-3xl text-sm text-slate-600">
            Cadastre e acompanhe cada concentrador RouterOS de forma individual, com vínculo ao agente responsável.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => openCreate(true)} disabled={!agents.length}>
            <Wifi className="h-4 w-4" /> Modelo Chácara
          </Button>
          <Button variant="outline" onClick={() => void load()} disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />} Atualizar
          </Button>
          <Button onClick={() => openCreate(false)} disabled={!agents.length} className="bg-emerald-600 hover:bg-emerald-700">
            <Plus className="h-4 w-4" /> Novo concentrador
          </Button>
        </div>
      </div>

      {!agents.length && !loading ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          Cadastre ou ative uma Unidade Remota antes de criar concentradores.
        </div>
      ) : null}
      {error ? <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">{error}</div> : null}
      {notice ? <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">{notice}</div> : null}

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 2xl:grid-cols-7" aria-label="Resumo dos concentradores">
        <ExecutiveCard label="Concentradores" value={loading ? "—" : monitoring?.total ?? rows.length} icon={Server} tone="blue" />
        <ExecutiveCard label="Online" value={loading ? "—" : monitoring?.online ?? 0} icon={CheckCircle2} tone="green" />
        <ExecutiveCard label="PPP Online" value={loading ? "—" : monitoring?.pppOnline ?? 0} icon={Wifi} tone="cyan" />
        <ExecutiveCard label="Interfaces UP" value={loading ? "—" : String(monitoring?.interfaceRunning ?? 0) + "/" + String(monitoring?.interfaceTotal ?? 0)} icon={Cable} tone="slate" />
        <ExecutiveCard label="Alertas abertos" value={loading ? "—" : monitoring?.openAlerts ?? openAlerts.length} icon={BellRing} tone="amber" />
        <ExecutiveCard label="Críticos" value={loading ? "—" : monitoring?.criticalAlerts ?? openAlerts.filter((alert) => alert.severity === "critical").length} icon={ShieldAlert} tone="red" />
        <ExecutiveCard label="Avisos" value={loading ? "—" : monitoring?.warningAlerts ?? openAlerts.filter((alert) => alert.severity === "warning").length} icon={TriangleAlert} tone="yellow" />
      </section>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Alertas Inteligentes</CardTitle>
          <CardDescription>Condições operacionais detectadas automaticamente nos concentradores.</CardDescription>
        </CardHeader>
        <CardContent>
          {alertsError ? (
            <div className="border border-red-200 bg-red-50 p-4 text-sm text-red-800">Não foi possível carregar os alertas: {alertsError}</div>
          ) : !openAlerts.length ? (
            <div className="flex items-center gap-3 border border-emerald-200 bg-emerald-50 p-4 text-sm font-medium text-emerald-900">
              <CheckCircle2 className="h-5 w-5" /> Sem alertas ativos
            </div>
          ) : (
            <div className="grid gap-3 lg:grid-cols-2">
              {openAlerts.map((alert) => {
                const alertId = alert.id || alert._id || `${alert.concentratorId}-${alert.type}`;
                const critical = alert.severity === "critical";
                return (
                  <div key={alertId} className={`border p-4 ${critical ? "border-red-200 bg-red-50" : "border-amber-200 bg-amber-50"}`}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex min-w-0 gap-3">
                        <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white ${critical ? "text-red-600" : "text-amber-600"}`}>
                          {critical ? <ShieldAlert className="h-5 w-5" /> : <TriangleAlert className="h-5 w-5" />}
                        </div>
                        <div className="min-w-0">
                          <p className="font-semibold text-slate-950">{alert.title}</p>
                          <p className="mt-0.5 text-xs font-medium text-slate-600">{alert.concentratorName}</p>
                        </div>
                      </div>
                      <Badge variant={critical ? "error" : "warning"}>{critical ? "Crítico" : "Aviso"}</Badge>
                    </div>
                    <p className="mt-3 text-sm text-slate-700">{alert.description}</p>
                    <div className="mt-3 flex flex-wrap items-center justify-between gap-3 border-t border-black/5 pt-3">
                      <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-slate-600">
                        <span>{alert.type}</span>
                        <span>{formatDate(alert.openedAt)}</span>
                      </div>
                      <Button variant="outline" size="sm" onClick={() => void resolveAlert(alert)} disabled={resolvingAlertId === (alert.id || alert._id)}>
                        {resolvingAlertId === (alert.id || alert._id) ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />} Resolver
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {loading ? (
        <div className="flex items-center gap-2 py-16 text-sm text-slate-500">
          <Loader2 className="h-5 w-5 animate-spin" /> Carregando concentradores...
        </div>
      ) : !rows.length ? (
        <div className="border border-slate-200 bg-white p-10 text-center">
          <Router className="mx-auto h-9 w-9 text-slate-300" />
          <p className="mt-3 font-medium text-slate-800">Nenhum concentrador cadastrado</p>
          <p className="mt-1 text-sm text-slate-500">Use “Novo concentrador” para preparar Matriz ou Chácara.</p>
        </div>
      ) : (
        <div className="grid gap-5 xl:grid-cols-[0.9fr_1.1fr]">
          <div className="space-y-3">
            {rows.map((row) => {
              const agent = row.agentNodeId ? agentById.get(row.agentNodeId) : null;
              const active = selected?.id === row.id;
              return (
                <button
                  type="button"
                  key={row.id}
                  onClick={() => setSelectedId(row.id)}
                  className={`w-full border p-4 text-left transition ${active ? "border-emerald-300 bg-emerald-50" : "border-slate-200 bg-white hover:border-slate-300"}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-slate-950">{row.name}</p>
                      <p className="mt-1 text-sm text-slate-500">{row.host}:{row.port || "—"}</p>
                    </div>
                    <Badge variant={statusVariant(row.status)}>{statusLabel(row.status)}</Badge>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
                    <span>{row.type} / {row.protocol}</span>
                    <span>{agent?.name || "Agente não localizado"}</span>
                    <span>Health {row.healthScore !== undefined ? String(row.healthScore) + "%" : "—"}</span>
                    <span>CPU {row.cpuPercent !== undefined ? String(row.cpuPercent) + "%" : "—"}</span>
                    <span>RAM {row.memoryPercent !== undefined ? String(row.memoryPercent) + "%" : "—"}</span>
                    <span className="text-red-600">Críticos {row.criticalAlerts ?? 0}</span>
                    <span className="text-amber-600">Avisos {row.warningAlerts ?? 0}</span>
                    <span>Alertas {row.openAlerts ?? 0}</span>
                  </div>
                </button>
              );
            })}
          </div>

          {selected ? (
            <div className="space-y-5">
              <Card>
                <CardHeader>
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <CardTitle>{selected.name}</CardTitle>
                      <CardDescription>{metadataText(selected.metadata, "notes") || "Concentrador individual da rede DC NET."}</CardDescription>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {selectedMonitoring ? <Badge variant={healthVariant(selectedMonitoring.health)}>{selectedMonitoring.health}</Badge> : null}
                      <Badge variant={statusVariant(selected.status)}>{statusLabel(selected.status)}</Badge>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-5">
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    <Info label="Host" value={`${selected.host}:${selected.port || "—"}`} icon={Server} />
                    <Info label="Tipo e protocolo" value={`${selected.type} / ${selected.protocol}`} icon={Router} />
                    <Info label="Agente vinculado" value={selected.agentNodeId ? agentById.get(selected.agentNodeId)?.name || "Não localizado" : "Não vinculado"} icon={Cable} />
                    <Info label="Último teste" value={formatDate(selected.lastTestAt)} icon={Clock3} />
                    <Info label="Via" value={metadataText(selected.metadata, "via") || "Não informada"} icon={ShieldCheck} />
                    <Info label="Situação" value={selected.enabled ? "Ativo" : "Desativado"} icon={Activity} />
                  </div>

                  {selected.lastErrorSafe ? (
                    <div className="flex gap-3 border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                      <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
                      <div><p className="font-medium">Último erro seguro</p><p className="mt-1 break-words">{selected.lastErrorSafe}</p></div>
                    </div>
                  ) : null}

                  <div className="flex flex-wrap gap-2">
                    <Button onClick={() => void testConnection(selected)} disabled={!selected.enabled || testingId === selected.id}>
                      {testingId === selected.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />} Testar conexão
                    </Button>
                    <Button variant="outline" onClick={() => openEdit(selected)}>
                      <Edit3 className="h-4 w-4" /> Editar
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {selectedMonitoring ? (
                <Card>
                  <CardHeader>
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <CardTitle className="text-base">Saúde operacional</CardTitle>
                        <CardDescription>Última telemetria consolidada pela Central de Concentradores.</CardDescription>
                      </div>
                      <Badge variant={healthVariant(selectedMonitoring.health)}>{selectedMonitoring.health}</Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                      <Metric label="CPU" value={String(selectedMonitoring.cpuPercent) + "%"} tone="slate" />
                      <Metric label="RAM" value={String(selectedMonitoring.memoryPercent) + "%"} tone="slate" />
                      <Metric label="PPP Online" value={String(selectedMonitoring.pppOnline)} tone="green" />
                      <Metric label="PPP Offline" value={String(selectedMonitoring.pppOffline)} tone="slate" />
                      <Metric label="Interfaces" value={String(selectedMonitoring.interfaceRunning) + "/" + String(selectedMonitoring.interfaceTotal)} tone="slate" />
                      <Metric label="RouterOS" value={selectedMonitoring.version || "—"} tone="slate" />
                      <Metric label="Uptime" value={selectedMonitoring.uptime || "—"} tone="slate" />
                      <Metric label="Health Score" value={String(selectedMonitoring.healthScore) + "%"} tone={healthTone(selectedMonitoring.healthScore)} />
                    </div>
                    <p className="mt-3 text-xs text-slate-500">Última telemetria: {formatDate(selectedMonitoring.telemetryAt)}</p>
                  </CardContent>
                </Card>
              ) : null}

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">PPPoE do concentrador</CardTitle>
                  <CardDescription>Resumo das leituras já persistidas para este concentrador.</CardDescription>
                </CardHeader>
                <CardContent>
                  {selected.snapshotSummary ? (
                    <div className="grid gap-3 sm:grid-cols-3">
                      <Metric label="Online" value={String(selected.snapshotSummary.online)} tone="green" />
                      <Metric label="Offline" value={String(selected.snapshotSummary.offline)} tone="slate" />
                      <Metric label="Última sincronização" value={formatDate(selected.snapshotSummary.lastSyncAt)} tone="slate" />
                    </div>
                  ) : (
                    <div className="border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
                      Leitura PPPoE será exibida após ativação do worker multi-concentrador.
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Histórico 24 snapshots</CardTitle>
                  <CardDescription>Evolução recente da telemetria do concentrador selecionado.</CardDescription>
                </CardHeader>
                <CardContent>
                  {detailLoading ? (
                    <div className="flex min-h-40 items-center justify-center gap-2 text-sm text-slate-500">
                      <Loader2 className="h-5 w-5 animate-spin" /> Carregando histórico...
                    </div>
                  ) : detailError ? (
                    <div className="border border-red-200 bg-red-50 p-4 text-sm text-red-800">
                      Não foi possível carregar o histórico: {detailError}
                    </div>
                  ) : !monitoringDetail?.telemetryHistory?.length ? (
                    <div className="border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
                      Nenhum snapshot de telemetria disponível para este concentrador.
                    </div>
                  ) : (
                    <div className="grid gap-5 2xl:grid-cols-[minmax(0,1fr)_18rem]">
                      <div className="grid gap-3 lg:grid-cols-3">
                        <MiniLineChart title="CPU" data={monitoringDetail.telemetryHistory} valueKey="cpuPercent" suffix="%" emptyLabel="Sem dados de CPU" />
                        <MiniLineChart title="RAM" data={monitoringDetail.telemetryHistory} valueKey="memoryPercent" suffix="%" emptyLabel="Sem dados de RAM" />
                        <MiniLineChart title="PPP Online" data={monitoringDetail.telemetryHistory} valueKey="pppOnline" suffix="" emptyLabel="Sem dados PPP" />
                      </div>
                      <div className="border border-slate-200 bg-slate-50 p-4">
                        <p className="text-sm font-semibold text-slate-900">Últimos registros</p>
                        <div className="mt-3 space-y-2">
                          {monitoringDetail.telemetryHistory.slice(0, 8).map((snapshot, index) => (
                            <div key={`${snapshot.createdAt}-${index}`} className="border-l-2 border-emerald-400 bg-white px-3 py-2 shadow-sm">
                              <div className="flex items-center justify-between gap-3">
                                <span className="text-xs font-semibold text-slate-700">{formatTime(snapshot.createdAt)}</span>
                                <span className="text-[11px] text-slate-500">Interfaces {snapshot.interfaceRunning}/{snapshot.interfaceTotal}</span>
                              </div>
                              <p className="mt-1 text-xs text-slate-600">CPU {snapshot.cpuPercent}% · RAM {snapshot.memoryPercent}% · PPP {snapshot.pppOnline}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          ) : null}
        </div>
      )}

      <Modal
        open={modalOpen}
        onOpenChange={setModalOpen}
        title={editingId ? "Editar concentrador" : "Novo concentrador"}
        description="A senha é enviada apenas ao backend e nunca volta na listagem."
        className="sm:max-w-3xl"
      >
        <form onSubmit={save} className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Nome" htmlFor="concentrator-name"><Input id="concentrator-name" value={form.name} onChange={(e) => setForm((v) => ({ ...v, name: e.target.value }))} required /></Field>
            <Field label="Agente vinculado" htmlFor="concentrator-agent">
              <Select id="concentrator-agent" value={form.agentNodeId} onChange={(e) => setForm((v) => ({ ...v, agentNodeId: e.target.value }))} required>
                <option value="">Selecione</option>
                {agents.map((agent) => <option key={agent._id} value={agent._id}>{agent.name} ({agent.code})</option>)}
              </Select>
            </Field>
            <Field label="Tipo" htmlFor="concentrator-type">
              <Select id="concentrator-type" value={form.type} onChange={(e) => setForm((v) => ({ ...v, type: e.target.value }))}>
                <option value="mikrotik">MikroTik</option><option value="huawei_olt">Huawei OLT</option><option value="fiberhome_olt">FiberHome OLT</option><option value="zte_olt">ZTE OLT</option><option value="intelbras">Intelbras</option><option value="other">Outro</option>
              </Select>
            </Field>
            <Field label="Protocolo" htmlFor="concentrator-protocol">
              <Select id="concentrator-protocol" value={form.protocol} onChange={(e) => setForm((v) => ({ ...v, protocol: e.target.value }))}>
                <option value="routeros">RouterOS</option><option value="snmp">SNMP</option><option value="http">HTTP</option><option value="ssh">SSH</option><option value="other">Outro</option>
              </Select>
            </Field>
            <Field label="Host/IP" htmlFor="concentrator-host"><Input id="concentrator-host" value={form.host} onChange={(e) => setForm((v) => ({ ...v, host: e.target.value }))} required /></Field>
            <Field label="Porta" htmlFor="concentrator-port"><Input id="concentrator-port" type="number" min={1} max={65535} value={form.port} onChange={(e) => setForm((v) => ({ ...v, port: e.target.value }))} required /></Field>
            <Field label="Usuário" htmlFor="concentrator-user"><Input id="concentrator-user" autoComplete="off" value={form.username} onChange={(e) => setForm((v) => ({ ...v, username: e.target.value }))} required /></Field>
            <Field label={editingId ? "Nova senha (opcional)" : "Senha"} htmlFor="concentrator-password"><Input id="concentrator-password" type="password" autoComplete="new-password" value={form.password} onChange={(e) => setForm((v) => ({ ...v, password: e.target.value }))} required={!editingId} /></Field>
            <Field label="Via" htmlFor="concentrator-via"><Input id="concentrator-via" value={form.via} onChange={(e) => setForm((v) => ({ ...v, via: e.target.value }))} placeholder="Ex.: WireGuard" /></Field>
            <div className="flex items-end gap-5 pb-2">
              <label className="flex items-center gap-2 text-sm text-slate-700"><input type="checkbox" checked={form.tls} onChange={(e) => setForm((v) => ({ ...v, tls: e.target.checked }))} /> TLS</label>
              <label className="flex items-center gap-2 text-sm text-slate-700"><input type="checkbox" checked={form.enabled} onChange={(e) => setForm((v) => ({ ...v, enabled: e.target.checked }))} /> Ativo</label>
            </div>
          </div>
          <Field label="Observações/metadados" htmlFor="concentrator-notes">
            <textarea id="concentrator-notes" value={form.notes} onChange={(e) => setForm((v) => ({ ...v, notes: e.target.value }))} className="min-h-24 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-400" maxLength={500} />
          </Field>
          <div className="flex justify-end gap-2 border-t border-slate-200 pt-4">
            <Button type="button" variant="outline" onClick={() => setModalOpen(false)} disabled={saving}>Cancelar</Button>
            <Button type="submit" disabled={saving}>{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}{editingId ? "Salvar alterações" : "Criar concentrador"}</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

function ExecutiveCard({ label, value, icon: Icon, tone }: { label: string; value: string | number; icon: React.ComponentType<{ className?: string }>; tone: "blue" | "green" | "cyan" | "slate" | "amber" | "yellow" | "red" }) {
  const tones = {
    blue: "border-blue-200 bg-blue-50 text-blue-950",
    green: "border-emerald-200 bg-emerald-50 text-emerald-950",
    cyan: "border-cyan-200 bg-cyan-50 text-cyan-950",
    slate: "border-slate-200 bg-white text-slate-950",
    amber: "border-amber-200 bg-amber-50 text-amber-950",
    yellow: "border-yellow-200 bg-yellow-50 text-yellow-950",
    red: "border-red-200 bg-red-50 text-red-950",
  };
  return <div className={"flex h-20 items-center justify-between rounded-lg border px-4 shadow-sm " + tones[tone]}><div><p className="text-xs font-medium opacity-70">{label}</p><p className="mt-1 text-2xl font-semibold tabular-nums">{value}</p></div><div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/80 shadow-sm"><Icon className="h-5 w-5" /></div></div>;
}

function Field({ label, htmlFor, children }: { label: string; htmlFor: string; children: React.ReactNode }) {
  return <div className="space-y-2"><Label htmlFor={htmlFor}>{label}</Label>{children}</div>;
}

function Info({ label, value, icon: Icon }: { label: string; value: string; icon: React.ComponentType<{ className?: string }> }) {
  return <div className="border border-slate-200 p-3"><div className="flex items-center gap-2 text-xs text-slate-500"><Icon className="h-4 w-4" />{label}</div><p className="mt-2 break-words text-sm font-medium text-slate-900">{value}</p></div>;
}


function MiniLineChart({ title, data, valueKey, suffix, emptyLabel }: {
  title: string;
  data: MonitoringConcentratorTelemetrySnapshot[];
  valueKey: "cpuPercent" | "memoryPercent" | "pppOnline";
  suffix: string;
  emptyLabel: string;
}) {
  const ordered = [...data].reverse();
  const values = ordered.map((snapshot) => Number(snapshot[valueKey])).filter((value) => Number.isFinite(value));
  if (!values.length) {
    return <div className="flex min-h-48 items-center justify-center border border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">{emptyLabel}</div>;
  }
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const width = 320;
  const height = 96;
  const padding = 8;
  const drawableWidth = width - padding * 2;
  const drawableHeight = height - padding * 2;
  const points = values.map((value, index) => {
    const x = values.length === 1 ? width / 2 : padding + (index / (values.length - 1)) * drawableWidth;
    const y = padding + ((max - value) / range) * drawableHeight;
    return `${x},${y}`;
  }).join(" ");
  const lastValue = values[values.length - 1];
  return (
    <div className="min-w-0 border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div><p className="text-xs font-medium text-slate-500">{title}</p><p className="mt-1 text-xl font-semibold tabular-nums text-slate-950">{lastValue}{suffix}</p></div>
        <p className="text-right text-[11px] text-slate-500">mín. {min}{suffix}<br />máx. {max}{suffix}</p>
      </div>
      <svg className="mt-3 h-24 w-full" viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`Histórico de ${title}`} preserveAspectRatio="none">
        <line x1={padding} y1={height - padding} x2={width - padding} y2={height - padding} stroke="#e2e8f0" strokeWidth="1" />
        <line x1={padding} y1={padding} x2={width - padding} y2={padding} stroke="#f1f5f9" strokeWidth="1" />
        <polyline points={points} fill="none" stroke="#059669" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <div className="mt-2 flex justify-between text-[11px] text-slate-500"><span>{formatTime(ordered[0]?.createdAt)}</span><span>{formatTime(ordered[ordered.length - 1]?.createdAt)}</span></div>
    </div>
  );
}

function Metric({ label, value, tone }: { label: string; value: string; tone: "green" | "slate" | "yellow" | "orange" | "red" }) {
  const tones = {
    green: "border-emerald-200 bg-emerald-50",
    slate: "border-slate-200 bg-slate-50",
    yellow: "border-amber-200 bg-amber-50",
    orange: "border-orange-200 bg-orange-50",
    red: "border-red-200 bg-red-50",
  };
  return <div className={"border p-3 " + tones[tone]}><p className="text-xs text-slate-500">{label}</p><p className="mt-1 break-words text-lg font-semibold text-slate-950">{value}</p></div>;
}
