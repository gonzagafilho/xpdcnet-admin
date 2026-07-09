"use client";

import { useEffect, useMemo, useState } from "react";
import { apiFetch } from "@/lib/api-client";
import { userFacingApiError } from "@/lib/user-facing-api-error";
import type {
  ClientFromApi,
  ClientMikrotikFromApi,
  ClientNetworkIntentFromApi,
  ClientStatus,
  MikrotikClientMonitoringFromApi,
  MikrotikDeviceStatus,
  MikrotikServerFromApi,
  PlanFromApi,
} from "@/lib/api-types";
import { formatBRL } from "@/lib/api-types";
import {
  CLIENT_STATUS_AUTOMATION_FOOTNOTE,
  CLIENT_STATUS_OPTIONS,
  clientStatusHintPt,
} from "@/lib/client-status";
import type { ClientOverdueRollup } from "@/lib/client-overdue-invoices";
import { fetchClientOverdueRollup } from "@/lib/client-overdue-invoices";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Modal } from "@/components/ui/modal";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { ClientDelinquencyRulerPanel } from "./client-delinquency-ruler";
import { ClienteAutenticacaoModal, type ClienteAuthDraft } from "./cliente-autenticacao-modal";
import { KeyRound } from "lucide-react";

type ClientAccessFromApi = {
  id: string;
  username: string;
  authType: string;
  status: string;
  source: string;
  server: { id: string; name: string; host: string };
  networkNode: { id: string; name: string; code: string } | null;
  plan: { id: string; name: string; speedMbps: number | null; price: number | null };
};

export type ClienteFormState = {
  document: string;
  fullName: string;
  email: string;
  portalPassword: string;
  personType: "fisica" | "juridica";
  rg: string;
  cpf: string;
  birthDate: string;
  phone: string;
  phoneSecondary: string;
  cep: string;
  street: string;
  number: string;
  district: string;
  city: string;
  uf: string;
  mapNote: string;
  geoLat: string;
  geoLng: string;
  monitoringPinned: boolean;
  dueDay: string;
  paymentMethod: string;
  contractModel: string;
  discount: string;
  surcharge: string;
  pendingDays: string;
  blockDays: string;
  contractNotes: string;
  planId: string;
  monthlyPrice: string;
  comodatoNote: string;
  relatedItemsNote: string;
  accessUsername: string;
  accessPassword: string;
  server: string;
  authType: string;
  ip: string;
  mac: string;
  tags: string;
  authOperationalLabel: string;
  mikrotikProfile: string;
  mikrotikComment: string;
  mikrotikLinked: boolean;
  mikrotikServerId: string;
  trustReleaseEnabled: boolean;
  trustReleaseUntil: string;
  trustReleaseReason: string;
  status: ClientStatus;
};

export function emptyClienteFormState(): ClienteFormState {
  return {
    document: "",
    fullName: "",
    email: "",
    portalPassword: "",
    personType: "fisica",
    rg: "",
    cpf: "",
    birthDate: "",
    phone: "",
    phoneSecondary: "",
    cep: "",
    street: "",
    number: "",
    district: "",
    city: "",
    uf: "",
    mapNote: "",
    geoLat: "",
    geoLng: "",
    monitoringPinned: false,
    dueDay: "10",
    paymentMethod: "",
    contractModel: "",
    discount: "",
    surcharge: "",
    pendingDays: "",
    blockDays: "",
    contractNotes: "",
    planId: "",
    monthlyPrice: "",
    comodatoNote: "",
    relatedItemsNote: "",
    accessUsername: "",
    accessPassword: "",
    server: "",
    authType: "pppoe",
    ip: "",
    mac: "",
    tags: "",
    authOperationalLabel: "ativo",
    mikrotikProfile: "",
    mikrotikComment: "",
    mikrotikLinked: false,
    mikrotikServerId: "",
    trustReleaseEnabled: false,
    trustReleaseUntil: "",
    trustReleaseReason: "",
    status: "active",
  };
}

function serverIdFromMikrotikField(serverId: ClientMikrotikFromApi["serverId"]): string {
  if (serverId == null) return "";
  if (typeof serverId === "string") return serverId;
  if (typeof serverId === "object" && serverId !== null && "_id" in serverId) return String(serverId._id);
  return "";
}

function toDatetimeLocalValue(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function buildDocumentField(w: ClienteFormState): string | undefined {
  const parts: string[] = [];
  if (w.cpf.trim()) parts.push(`CPF: ${w.cpf.trim()}`);
  if (w.rg.trim()) parts.push(`RG: ${w.rg.trim()}`);
  if (parts.length === 0) return undefined;
  return parts.join(" · ");
}

function resolvedDocumentForApi(w: ClienteFormState): string {
  const single = w.document.trim();
  const fromIds = buildDocumentField(w);
  return single || fromIds || "";
}

function buildAddressPayload(w: ClienteFormState): Record<string, string> {
  return {
    zip: w.cep.trim(),
    street: w.street.trim(),
    number: w.number.trim(),
    neighborhood: w.district.trim(),
    city: w.city.trim(),
    state: w.uf.trim().toUpperCase(),
    reference: w.mapNote.trim(),
  };
}

function parseGeo(w: ClienteFormState): { lat: number; lng: number } | null {
  const latS = w.geoLat.trim();
  const lngS = w.geoLng.trim();
  if (!latS && !lngS) return null;
  const lat = Number(latS.replace(",", "."));
  const lng = Number(lngS.replace(",", "."));
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
  return { lat, lng };
}

/** Separa notas livres (textarea) do bloco sintetizado guardado na API. */
const NOTES_AUX_MARKER = "__XPDCNET_AUX_V1__";

/** Rodapé fixo de `buildAuxiliaryNotes` — usado para despistar blocos legados sem marcador. */
const NOTES_AUX_FOOTER = "(Use este campo para observações rápidas.)";

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Remove blocos auxiliares antigos (de — … MikroTik … até ao rodapé), possivelmente repetidos. */
function stripLegacyAuxTails(text: string): string {
  const footerRe = escapeRegExp(NOTES_AUX_FOOTER);
  const legacyTail = new RegExp(String.raw`(?:^|\r?\n\r?\n)—\r?\nMikroTik:[\s\S]*?` + footerRe, "g");
  return text.replace(legacyTail, "").replace(/\n{3,}/g, "\n\n").trim();
}

/** Nota livre para o formulário: sem marcador nem caudas sintetizadas legadas. */
function extractFreeNotesFromApi(raw: string | undefined): string {
  const t = (raw ?? "").trim();
  if (!t) return "";
  if (t.includes(NOTES_AUX_MARKER)) {
    return t.split(NOTES_AUX_MARKER)[0].trimEnd();
  }
  return stripLegacyAuxTails(t);
}

/** Valor final para POST/PUT: nota livre + marcador + bloco sintetizado atual (sem duplicar em reedições). */
function composeNotesForApi(freeText: string, form: ClienteFormState): string | undefined {
  const aux = buildAuxiliaryNotes(form).trim();
  const free = freeText.trim();
  if (!aux) return free || undefined;
  if (!free) return `${NOTES_AUX_MARKER}\n\n${aux}`;
  return `${free}\n\n${NOTES_AUX_MARKER}\n\n${aux}`;
}

function buildAuxiliaryNotes(w: ClienteFormState): string {
  const lines: string[] = [];
  if (w.personType === "juridica") lines.push("Tipo de pessoa: jurídica");
  if (w.birthDate.trim()) lines.push(`Data de nascimento: ${w.birthDate.trim()}`);
  if (w.phoneSecondary.trim()) lines.push(`Telefone alternativo: ${w.phoneSecondary.trim()}`);
  if (w.monitoringPinned) lines.push("Monitoramento: cliente marcado para acompanhamento prioritário.");
  if (w.paymentMethod.trim()) lines.push(`Forma de pagamento: ${w.paymentMethod.trim()}`);
  if (w.contractModel.trim()) lines.push(`Modelo de contrato: ${w.contractModel.trim()}`);
  if (w.discount.trim()) lines.push(`Desconto: ${w.discount.trim()}`);
  if (w.surcharge.trim()) lines.push(`Acréscimo: ${w.surcharge.trim()}`);
  if (w.pendingDays.trim()) lines.push(`Dias para pendência: ${w.pendingDays.trim()}`);
  if (w.blockDays.trim()) lines.push(`Dias para bloqueio: ${w.blockDays.trim()}`);
  if (w.comodatoNote.trim()) lines.push(`Comodato: ${w.comodatoNote.trim()}`);
  if (w.relatedItemsNote.trim()) lines.push(`Itens relacionados: ${w.relatedItemsNote.trim()}`);
  if (w.server.trim()) lines.push(`Servidor (auth): ${w.server.trim()}`);
  if (w.authType.trim()) lines.push(`Tipo de autenticação: ${w.authType.trim()}`);
  if (w.ip.trim()) lines.push(`IP: ${w.ip.trim()}`);
  if (w.mac.trim()) lines.push(`MAC: ${w.mac.trim()}`);
  if (w.tags.trim()) lines.push(`Tags: ${w.tags.trim()}`);
  if (w.authOperationalLabel && w.authOperationalLabel !== "ativo") {
    lines.push(`Estado auth (fluxo): ${w.authOperationalLabel}`);
  }
  lines.push("—");
  lines.push("MikroTik: " + (w.mikrotikLinked ? "vínculo previsto no fluxo" : "sem vínculo marcado") + ".");
  if (w.mikrotikProfile.trim()) lines.push(`Perfil / queue (planeado): ${w.mikrotikProfile.trim()}`);
  if (w.mikrotikComment.trim()) lines.push(`Comentário MikroTik (planeado): ${w.mikrotikComment.trim()}`);
  lines.push(NOTES_AUX_FOOTER);
  return lines.join("\n");
}

function validateForm(
  w: ClienteFormState,
  plansLength: number,
  mode: "create" | "edit",
  hasAuthRegistration: boolean,
): string | null {
  if (!w.fullName.trim()) return "Indique o nome completo.";
  if (w.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(w.email.trim())) return "E-mail inválido.";
  const d = Number(w.dueDay) || 0;
  if (d < 1 || d > 28) return "Dia de vencimento deve estar entre 1 e 28.";
  const latS = w.geoLat.trim();
  const lngS = w.geoLng.trim();
  if ((latS && !lngS) || (!latS && lngS)) return "Preencha latitude e longitude ou deixe ambos vazios.";
  if (latS && lngS && !parseGeo(w)) return "Latitude/longitude inválidas (use graus decimais).";
  if (!w.planId) {
    return plansLength === 0
      ? "Não há planos cadastrados. Crie um plano antes."
      : "Selecione o plano de acesso.";
  }
  const price = Number(w.monthlyPrice.replace(",", "."));
  if (Number.isNaN(price)) return "Preço mensal inválido.";
  if (mode === "create") {
    if (!hasAuthRegistration) return "Cadastre a autenticação de rede antes de guardar.";
    if (!w.accessUsername.trim()) return "Indique o login de autenticação.";
    if (!w.accessPassword.trim()) return "Indique a senha de autenticação (Internet / acesso).";
  } else {
    if (!w.accessUsername.trim()) return "Indique o login de autenticação.";
  }
  return null;
}

function sectionTitle(text: string) {
  return (
    <h3 className="border-b border-neutral-200 pb-2 text-sm font-bold tracking-tight text-neutral-900">{text}</h3>
  );
}

function clientToFormState(c: ClientFromApi): ClienteFormState {
  const pid = typeof c.planId === "object" ? c.planId._id : c.planId;
  const addr = c.address;
  const geo = c.geo;
  const base = emptyClienteFormState();
  return {
    ...base,
    document: c.document ?? "",
    fullName: c.fullName,
    email: c.email ?? "",
    phone: c.phone ?? "",
    planId: pid,
    monthlyPrice: String(c.monthlyPrice),
    dueDay: String(c.dueDay ?? 10),
    status: c.status,
    accessUsername: c.access?.username ?? "",
    accessPassword: "",
    authType: c.access?.authType ?? "pppoe",
    cep: addr?.zip ?? "",
    street: addr?.street ?? "",
    number: addr?.number ?? "",
    district: addr?.neighborhood ?? "",
    city: addr?.city ?? "",
    uf: addr?.state ?? "",
    mapNote: addr?.reference ?? "",
    geoLat: geo && typeof geo.lat === "number" ? String(geo.lat) : "",
    geoLng: geo && typeof geo.lng === "number" ? String(geo.lng) : "",
    contractNotes: extractFreeNotesFromApi(c.notes),
    mikrotikProfile: c.mikrotik?.profile ?? "",
    mikrotikComment: c.mikrotik?.comment ?? "",
    mikrotikLinked: Boolean(c.mikrotik?.enabled),
    mikrotikServerId: serverIdFromMikrotikField(c.mikrotik?.serverId),
    trustReleaseEnabled: Boolean(c.trustRelease?.enabled),
    trustReleaseUntil: toDatetimeLocalValue(c.trustRelease?.until ?? undefined),
    trustReleaseReason: c.trustRelease?.reason ?? "",
  };
}

function formToAuthDraft(f: ClienteFormState): ClienteAuthDraft {
  return {
    accessUsername: f.accessUsername,
    accessPassword: f.accessPassword,
    authType: f.authType,
    server: f.server,
    mikrotikProfile: f.mikrotikProfile,
    mikrotikComment: f.mikrotikComment,
    mikrotikLinked: f.mikrotikLinked,
    ip: f.ip,
    mac: f.mac,
    tags: f.tags,
    authOperationalLabel: f.authOperationalLabel,
  };
}

function applyAuthDraftToForm(f: ClienteFormState, next: ClienteAuthDraft): ClienteFormState {
  const keepPass = next.accessPassword.trim() ? next.accessPassword : f.accessPassword;
  return {
    ...f,
    accessUsername: next.accessUsername,
    accessPassword: keepPass,
    authType: next.authType,
    server: next.server,
    mikrotikProfile: next.mikrotikProfile,
    mikrotikComment: next.mikrotikComment,
    mikrotikLinked: next.mikrotikLinked,
    ip: next.ip,
    mac: next.mac,
    tags: next.tags,
    authOperationalLabel: next.authOperationalLabel,
  };
}

export type ClienteFormModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "create" | "edit";
  client: ClientFromApi | null;
  plans: PlanFromApi[];
  onSuccess: (kind: "create" | "edit") => void | Promise<void>;
  onInform?: (message: string, variant?: "success" | "error") => void;
};

export function ClienteFormModal({
  open,
  onOpenChange,
  mode,
  client,
  plans,
  onSuccess,
  onInform,
}: ClienteFormModalProps) {
  const [form, setForm] = useState<ClienteFormState>(() => emptyClienteFormState());
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [hasAuthRegistration, setHasAuthRegistration] = useState(false);
  const [originalAccess, setOriginalAccess] = useState<{ username: string; password: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [overdueRollup, setOverdueRollup] = useState<ClientOverdueRollup | null>(null);
  const [overdueCheckLoading, setOverdueCheckLoading] = useState(false);
  const [markingDelinquent, setMarkingDelinquent] = useState(false);
  const [blockConfirmOpen, setBlockConfirmOpen] = useState(false);
  const [blockingClient, setBlockingClient] = useState(false);
  const [mikrotikServers, setMikrotikServers] = useState<MikrotikServerFromApi[]>([]);
  const [networkIntent, setNetworkIntent] = useState<ClientNetworkIntentFromApi | null>(null);
  const [networkIntentLoading, setNetworkIntentLoading] = useState(false);
  const [mikrotikMonitoring, setMikrotikMonitoring] = useState<MikrotikClientMonitoringFromApi | null>(null);
  const [mikrotikMonitoringLoading, setMikrotikMonitoringLoading] = useState(false);
  const [clientAccesses, setClientAccesses] = useState<ClientAccessFromApi[]>([]);
  const [clientAccessesLoading, setClientAccessesLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    setError(null);
    setSaving(false);
    setAuthModalOpen(false);
    if (mode === "edit" && client) {
      setForm(clientToFormState(client));
      setOriginalAccess({
        username: client.access?.username ?? "",
        password: client.access?.password ?? "",
      });
      setHasAuthRegistration(true);
    } else {
      setForm(emptyClienteFormState());
      setOriginalAccess(null);
      setHasAuthRegistration(false);
    }
  }, [open, mode, client]);

  useEffect(() => {
    const id = client?._id;
    if (!open || mode !== "edit" || !id) {
      setOverdueRollup(null);
      setOverdueCheckLoading(false);
      return;
    }
    let cancelled = false;
    setOverdueCheckLoading(true);
    setOverdueRollup(null);
    (async () => {
      try {
        const r = await fetchClientOverdueRollup(id);
        if (!cancelled) setOverdueRollup(r);
      } catch {
        if (!cancelled) setOverdueRollup(null);
      } finally {
        if (!cancelled) setOverdueCheckLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, mode, client?._id]);

  useEffect(() => {
    if (!open) {
      setNetworkIntent(null);
      setMikrotikMonitoring(null);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const list = await apiFetch<MikrotikServerFromApi[]>("/mikrotik/servers");
        if (!cancelled && Array.isArray(list)) setMikrotikServers(list);
      } catch {
        if (!cancelled) setMikrotikServers([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open]);


  useEffect(() => {
    const clientId = client?._id;
    if (!open || mode !== "edit" || !clientId) {
      setClientAccesses([]);
      setClientAccessesLoading(false);
      return;
    }
    let cancelled = false;
    setClientAccessesLoading(true);
    apiFetch<{ items: ClientAccessFromApi[] }>(`/clients/${clientId}/accesses`)
      .then((response) => { if (!cancelled) setClientAccesses(response.items || []); })
      .catch(() => { if (!cancelled) setClientAccesses([]); })
      .finally(() => { if (!cancelled) setClientAccessesLoading(false); });
    return () => { cancelled = true; };
  }, [open, mode, client?._id]);

  const selectedPlan = useMemo(
    () => plans.find((p) => p._id === form.planId) ?? null,
    [plans, form.planId],
  );

  const planOptions = useMemo(
    () =>
      plans.map((p) => (
        <option key={p._id} value={p._id}>
          {p.name} — {p.speedMbps} Mbps
        </option>
      )),
    [plans],
  );

  const planLabelReadonly = useMemo(() => {
    if (selectedPlan) {
      return `${selectedPlan.name} — ${selectedPlan.speedMbps} Mbps (${formatBRL(selectedPlan.price)})`;
    }
    return "Selecione um plano na ficha";
  }, [selectedPlan]);

  const contractHint = useMemo(() => {
    const d = Number(form.dueDay) || 10;
    return `Vencimento no dia ${d}`;
  }, [form.dueDay]);

  const geoPoint = useMemo(() => parseGeo(form), [form]);
  const mapEmbedSrc = useMemo(() => {
    if (!geoPoint) return null;
    const { lat, lng } = geoPoint;
    const pad = 0.02;
    return `https://www.openstreetmap.org/export/embed.html?bbox=${lng - pad},${lat - pad},${lng + pad},${lat + pad}&layer=mapnik&marker=${lat},${lng}`;
  }, [geoPoint]);

  const showAuthSummary = mode === "edit" || hasAuthRegistration;

  const handleAuthSave = (next: ClienteAuthDraft) => {
    setForm((f) => applyAuthDraftToForm(f, next));
    if (mode === "create") setHasAuthRegistration(true);
  };

  const executeBlockClient = async () => {
    if (!client) return;
    setBlockingClient(true);
    try {
      await apiFetch<ClientFromApi>(`/clients/${client._id}`, {
        method: "PUT",
        body: JSON.stringify({ status: "blocked" }),
      });
      setForm((f) => ({ ...f, status: "blocked" }));
      onInform?.("Cliente marcado como bloqueado no cadastro, sem interrupção automática do acesso à rede.", "success");
      await onSuccess("edit");
    } catch (e) {
      onInform?.(userFacingApiError(e), "error");
      throw e;
    } finally {
      setBlockingClient(false);
    }
  };

  const markDelinquentFromSuggestion = async () => {
    if (!client) return;
    setMarkingDelinquent(true);
    try {
      await apiFetch<ClientFromApi>(`/clients/${client._id}`, {
        method: "PUT",
        body: JSON.stringify({ status: "delinquent" }),
      });
      setForm((f) => ({ ...f, status: "delinquent" }));
      onInform?.("Cliente marcado como inadimplente no cadastro.", "success");
      await onSuccess("edit");
      try {
        const r = await fetchClientOverdueRollup(client._id);
        setOverdueRollup(r);
      } catch {
        /* mantém rollup anterior */
      }
    } catch (e) {
      onInform?.(userFacingApiError(e), "error");
    } finally {
      setMarkingDelinquent(false);
    }
  };

  const clearAuthentication = () => {
    if (mode === "edit") {
      onInform?.(
        "O cliente precisa manter login e senha de acesso. Para alterar estes dados, use «Atualizar acesso».",
        "error",
      );
      return;
    }
    setHasAuthRegistration(false);
    setForm((f) => ({
      ...f,
      accessUsername: "",
      accessPassword: "",
      server: "",
      authType: "pppoe",
      ip: "",
      mac: "",
      tags: "",
      authOperationalLabel: "ativo",
      mikrotikProfile: "",
      mikrotikComment: "",
      mikrotikLinked: false,
      mikrotikServerId: "",
      trustReleaseEnabled: false,
      trustReleaseUntil: "",
      trustReleaseReason: "",
    }));
  };

  const loadNetworkIntentPreview = async () => {
    if (!client?._id) return;
    setNetworkIntentLoading(true);
    try {
      const data = await apiFetch<ClientNetworkIntentFromApi>(`/clients/${client._id}/network-intent`);
      setNetworkIntent(data);
    } catch (e) {
      onInform?.(userFacingApiError(e), "error");
    } finally {
      setNetworkIntentLoading(false);
    }
  };

  const loadMikrotikMonitoring = async () => {
    if (!client?._id) return;
    setMikrotikMonitoringLoading(true);
    try {
      const data = await apiFetch<MikrotikClientMonitoringFromApi>(
        `/mikrotik-monitoring/client/${client._id}`,
      );
      setMikrotikMonitoring(data);
    } catch (e) {
      onInform?.(userFacingApiError(e), "error");
    } finally {
      setMikrotikMonitoringLoading(false);
    }
  };

  const deviceStatusLabelPt = (s: MikrotikDeviceStatus | null | undefined) => {
    if (s == null) return "—";
    if (s === "active") return "Activo (habilitado)";
    if (s === "blocked") return "Bloqueado (disabled)";
    return "Ausente (sem secret)";
  };

  const submit = async () => {
    setError(null);
    const v = validateForm(form, plans.length, mode, hasAuthRegistration);
    if (v) {
      setError(v);
      return;
    }

    const monthlyPrice = Number(form.monthlyPrice.replace(",", "."));
    const dueNum = Number(form.dueDay) || 10;
    const doc = resolvedDocumentForApi(form);
    const notes = composeNotesForApi(form.contractNotes, form);
    const address = buildAddressPayload(form);
    const geoParsed = parseGeo(form);
    const trustUntilIso =
      form.trustReleaseEnabled && form.trustReleaseUntil.trim()
        ? new Date(form.trustReleaseUntil).toISOString()
        : null;
    const trustMikrotikPayload = {
      trustRelease: {
        enabled: form.trustReleaseEnabled,
        until: trustUntilIso,
        reason: form.trustReleaseReason.trim(),
      },
      mikrotik: {
        enabled: form.mikrotikLinked,
        serverId: form.mikrotikServerId.trim() ? form.mikrotikServerId.trim() : null,
        profile: form.mikrotikProfile.trim(),
        comment: form.mikrotikComment.trim(),
      },
    };

    setSaving(true);
    try {
      if (mode === "create") {
        const body: Record<string, unknown> = {
          fullName: form.fullName.trim(),
          document: doc || undefined,
          phone: form.phone.trim() || undefined,
          email: form.email.trim() || undefined,
          notes: notes || undefined,
          address,
          planId: form.planId,
          monthlyPrice,
          dueDay: dueNum,
          status: form.status,
          access: {
            username: form.accessUsername.trim(),
            password: form.accessPassword,
            authType: form.authType || "pppoe",
          },
          ...trustMikrotikPayload,
        };
        if (geoParsed) body.geo = { lat: geoParsed.lat, lng: geoParsed.lng };
        await apiFetch<ClientFromApi>("/clients", {
          method: "POST",
          body: JSON.stringify(body),
        });
        onOpenChange(false);
        await onSuccess("create");
      } else if (client) {
        const pwd = form.accessPassword.trim();
        const body: Record<string, unknown> = {
          fullName: form.fullName.trim(),
          document: doc,
          phone: form.phone.trim() || "",
          email: form.email.trim() || "",
          notes: notes?.trim() ?? "",
          planId: form.planId,
          monthlyPrice,
          dueDay: dueNum,
          status: form.status,
          address,
          access: {
            authType: form.authType || "pppoe",
            username: form.accessUsername.trim(),
            password: pwd || originalAccess?.password || "",
          },
          ...trustMikrotikPayload,
        };
        if (geoParsed) body.geo = { lat: geoParsed.lat, lng: geoParsed.lng };
        await apiFetch<ClientFromApi>(`/clients/${client._id}`, {
          method: "PUT",
          body: JSON.stringify(body),
        });
        onOpenChange(false);
        await onSuccess("edit");
      }
    } catch (e) {
      setError(userFacingApiError(e));
    } finally {
      setSaving(false);
    }
  };

  const title = mode === "create" ? "Novo cliente" : "Editar cliente";
  const description =
    mode === "create"
      ? "Ficha completa com dados pessoais, contactos, endereço, contrato, plano, comodato e acesso do cliente."
      : "Atualize os dados cadastrais, comerciais, de localização e acesso do cliente em uma única ficha.";

  const statusLabelAuth = (() => {
    const m: Record<string, string> = {
      ativo: "Ativo",
      suspenso: "Suspenso",
      em_configuracao: "Em configuração",
    };
    return m[form.authOperationalLabel] ?? form.authOperationalLabel;
  })();

  return (
    <>
      <Modal open={open} onOpenChange={onOpenChange} title={title} description={description} className="max-w-[42rem]">
        <div className="space-y-4">
          {error ? (
            <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</div>
          ) : null}

          <div className="max-h-[min(70vh,620px)] overflow-y-auto pr-1">
            <div className="space-y-10 pb-4">
              <div className="space-y-4">
                {sectionTitle("Dados pessoais")}
                <div className="space-y-1.5">
                  <Label htmlFor="cf-name" className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
                    Nome completo *
                  </Label>
                  <Input
                    id="cf-name"
                    value={form.fullName}
                    onChange={(e) => setForm((x) => ({ ...x, fullName: e.target.value }))}
                    className="border-neutral-200"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="cf-doc" className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
                    Documento
                  </Label>
                  <Input
                    id="cf-doc"
                    value={form.document}
                    onChange={(e) => setForm((x) => ({ ...x, document: e.target.value }))}
                    className="border-neutral-200"
                    placeholder="Ou use CPF/RG abaixo no novo cadastro"
                  />
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="cf-email" className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
                      E-mail
                    </Label>
                    <Input
                      id="cf-email"
                      type="email"
                      value={form.email}
                      onChange={(e) => setForm((x) => ({ ...x, email: e.target.value }))}
                      className="border-neutral-200"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="cf-portal-pw" className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
                      Senha (portal / app)
                    </Label>
                    <Input
                      id="cf-portal-pw"
                      type="password"
                      autoComplete="new-password"
                      value={form.portalPassword}
                      onChange={(e) => setForm((x) => ({ ...x, portalPassword: e.target.value }))}
                      className="border-neutral-200"
                      disabled
                      title="Campo disponível em breve"
                    />
                    <p className="text-[0.65rem] text-neutral-500">Informação ainda não disponível para cadastro.</p>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="cf-person" className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
                    Tipo de pessoa
                  </Label>
                  <Select
                    id="cf-person"
                    value={form.personType}
                    onChange={(e) => setForm((x) => ({ ...x, personType: e.target.value as "fisica" | "juridica" }))}
                    className="border-neutral-200"
                  >
                    <option value="fisica">Pessoa física</option>
                    <option value="juridica">Pessoa jurídica</option>
                  </Select>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="cf-rg" className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
                      RG
                    </Label>
                    <Input
                      id="cf-rg"
                      value={form.rg}
                      onChange={(e) => setForm((x) => ({ ...x, rg: e.target.value }))}
                      className="border-neutral-200"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="cf-cpf" className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
                      CPF
                    </Label>
                    <Input
                      id="cf-cpf"
                      value={form.cpf}
                      onChange={(e) => setForm((x) => ({ ...x, cpf: e.target.value }))}
                      className="border-neutral-200"
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="cf-birth" className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
                    Data de nascimento
                  </Label>
                  <Input
                    id="cf-birth"
                    type="date"
                    value={form.birthDate}
                    onChange={(e) => setForm((x) => ({ ...x, birthDate: e.target.value }))}
                    className="border-neutral-200"
                  />
                </div>
              </div>

              <div className="space-y-4">
                {sectionTitle("Contactos")}
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="cf-phone" className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
                      Telefone principal
                    </Label>
                    <Input
                      id="cf-phone"
                      value={form.phone}
                      onChange={(e) => setForm((x) => ({ ...x, phone: e.target.value }))}
                      className="border-neutral-200"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="cf-phone2" className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
                      Telefone alternativo
                    </Label>
                    <Input
                      id="cf-phone2"
                      value={form.phoneSecondary}
                      onChange={(e) => setForm((x) => ({ ...x, phoneSecondary: e.target.value }))}
                      className="border-neutral-200"
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                {sectionTitle("Endereço e localização")}
                <div className="grid gap-4 sm:grid-cols-3">
                  <div className="space-y-1.5 sm:col-span-1">
                    <Label htmlFor="cf-cep" className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
                      CEP → zip
                    </Label>
                    <Input
                      id="cf-cep"
                      value={form.cep}
                      onChange={(e) => setForm((x) => ({ ...x, cep: e.target.value }))}
                      className="border-neutral-200"
                    />
                  </div>
                  <div className="space-y-1.5 sm:col-span-2">
                    <Label htmlFor="cf-street" className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
                      Logradouro
                    </Label>
                    <Input
                      id="cf-street"
                      value={form.street}
                      onChange={(e) => setForm((x) => ({ ...x, street: e.target.value }))}
                      className="border-neutral-200"
                    />
                  </div>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="cf-num" className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
                      Número
                    </Label>
                    <Input
                      id="cf-num"
                      value={form.number}
                      onChange={(e) => setForm((x) => ({ ...x, number: e.target.value }))}
                      className="border-neutral-200"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="cf-dist" className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
                      Bairro → neighborhood
                    </Label>
                    <Input
                      id="cf-dist"
                      value={form.district}
                      onChange={(e) => setForm((x) => ({ ...x, district: e.target.value }))}
                      className="border-neutral-200"
                    />
                  </div>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="cf-city" className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
                      Cidade
                    </Label>
                    <Input
                      id="cf-city"
                      value={form.city}
                      onChange={(e) => setForm((x) => ({ ...x, city: e.target.value }))}
                      className="border-neutral-200"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="cf-uf" className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
                      UF → state
                    </Label>
                    <Input
                      id="cf-uf"
                      maxLength={2}
                      value={form.uf}
                      onChange={(e) => setForm((x) => ({ ...x, uf: e.target.value.toUpperCase() }))}
                      className="border-neutral-200"
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="cf-map" className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
                    Referência do endereço
                  </Label>
                  <textarea
                    id="cf-map"
                    rows={2}
                    value={form.mapNote}
                    onChange={(e) => setForm((x) => ({ ...x, mapNote: e.target.value }))}
                    className="flex w-full rounded-md border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-900 shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-400"
                    placeholder="Ponto de referência, link, observações de localização…"
                  />
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="cf-lat" className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
                      Latitude
                    </Label>
                    <Input
                      id="cf-lat"
                      inputMode="decimal"
                      placeholder="-23.5505"
                      value={form.geoLat}
                      onChange={(e) => setForm((x) => ({ ...x, geoLat: e.target.value }))}
                      className="border-neutral-200 font-mono text-sm"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="cf-lng" className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
                      Longitude
                    </Label>
                    <Input
                      id="cf-lng"
                      inputMode="decimal"
                      placeholder="-46.6333"
                      value={form.geoLng}
                      onChange={(e) => setForm((x) => ({ ...x, geoLng: e.target.value }))}
                      className="border-neutral-200 font-mono text-sm"
                    />
                  </div>
                </div>
                <p className="text-[0.65rem] text-neutral-500">
                  A localização no mapa é guardada quando latitude e longitude são válidas.
                </p>
                {mapEmbedSrc ? (
                  <div className="overflow-hidden rounded-md border border-neutral-200 bg-neutral-50">
                    <iframe title="Mapa (OpenStreetMap)" className="h-48 w-full" src={mapEmbedSrc} loading="lazy" />
                  </div>
                ) : (
                  <p className="text-xs text-neutral-400">Preencha latitude e longitude para pré-visualizar o mapa.</p>
                )}
                <label className="flex cursor-pointer items-center gap-2 text-sm text-neutral-700">
                  <input
                    type="checkbox"
                    checked={form.monitoringPinned}
                    onChange={(e) => setForm((x) => ({ ...x, monitoringPinned: e.target.checked }))}
                    className="h-4 w-4 rounded border-neutral-300"
                  />
                  Monitoramento fixado por cliente (registado em notas até módulo dedicado)
                </label>
              </div>

              <div className="space-y-4">
                {sectionTitle("Contrato")}
                <p className="text-xs text-neutral-500">
                  Dia de vencimento é persistido no cliente. Demais campos comerciais seguem em notas até existir entidade de
                  contrato.
                </p>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="cf-due" className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
                      Dia de vencimento (1–28) *
                    </Label>
                    <Input
                      id="cf-due"
                      type="number"
                      min={1}
                      max={28}
                      value={form.dueDay}
                      onChange={(e) => setForm((x) => ({ ...x, dueDay: e.target.value }))}
                      className="border-neutral-200"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="cf-pay" className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
                      Forma de pagamento
                    </Label>
                    <Input
                      id="cf-pay"
                      value={form.paymentMethod}
                      onChange={(e) => setForm((x) => ({ ...x, paymentMethod: e.target.value }))}
                      className="border-neutral-200"
                      placeholder="Boleto, PIX, débito…"
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="cf-model" className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
                    Modelo de contrato
                  </Label>
                  <Input
                    id="cf-model"
                    value={form.contractModel}
                    onChange={(e) => setForm((x) => ({ ...x, contractModel: e.target.value }))}
                    className="border-neutral-200"
                    placeholder="Identificador ou nome do modelo"
                  />
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="cf-disc" className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
                      Desconto
                    </Label>
                    <Input
                      id="cf-disc"
                      value={form.discount}
                      onChange={(e) => setForm((x) => ({ ...x, discount: e.target.value }))}
                      className="border-neutral-200"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="cf-sur" className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
                      Acréscimo
                    </Label>
                    <Input
                      id="cf-sur"
                      value={form.surcharge}
                      onChange={(e) => setForm((x) => ({ ...x, surcharge: e.target.value }))}
                      className="border-neutral-200"
                    />
                  </div>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="cf-pend" className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
                      Dias para pendência
                    </Label>
                    <Input
                      id="cf-pend"
                      inputMode="numeric"
                      value={form.pendingDays}
                      onChange={(e) => setForm((x) => ({ ...x, pendingDays: e.target.value }))}
                      className="border-neutral-200"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="cf-block" className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
                      Dias para bloqueio
                    </Label>
                    <Input
                      id="cf-block"
                      inputMode="numeric"
                      value={form.blockDays}
                      onChange={(e) => setForm((x) => ({ ...x, blockDays: e.target.value }))}
                      className="border-neutral-200"
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="cf-cnotes" className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
                    Notas livres (contrato / observações)
                  </Label>
                  <p className="text-[0.65rem] leading-relaxed text-neutral-500">
                    Use este espaço para informações comerciais, contratuais ou observações importantes sobre o cliente.
                  </p>
                  <textarea
                    id="cf-cnotes"
                    rows={3}
                    value={form.contractNotes}
                    onChange={(e) => setForm((x) => ({ ...x, contractNotes: e.target.value }))}
                    className="flex w-full rounded-md border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-900 shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-400"
                  />
                </div>
              </div>

              <div className="space-y-4">
                {sectionTitle("Plano de acesso / comodato")}
                <p className="text-xs text-neutral-500">
                  O plano, o valor mensal e os itens em comodato ficam associados à ficha do cliente.
                </p>
                <div className="space-y-1.5">
                  <Label htmlFor="cf-plan" className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
                    Plano de acesso *
                  </Label>
                  <Select
                    id="cf-plan"
                    value={form.planId}
                    onChange={(e) => {
                      const id = e.target.value;
                      const p = plans.find((pl) => pl._id === id);
                      setForm((x) => ({
                        ...x,
                        planId: id,
                        monthlyPrice: p ? String(p.price) : x.monthlyPrice,
                      }));
                    }}
                    className="border-neutral-200"
                  >
                    <option value="">Selecione…</option>
                    {planOptions}
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="cf-price" className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
                    Preço mensal (R$) *
                  </Label>
                  <Input
                    id="cf-price"
                    inputMode="decimal"
                    value={form.monthlyPrice}
                    onChange={(e) => setForm((x) => ({ ...x, monthlyPrice: e.target.value }))}
                    className="border-neutral-200"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="cf-comodato" className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
                    Comodato (equipamento / termos)
                  </Label>
                  <textarea
                    id="cf-comodato"
                    rows={2}
                    value={form.comodatoNote}
                    onChange={(e) => setForm((x) => ({ ...x, comodatoNote: e.target.value }))}
                    className="flex w-full rounded-md border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-900 shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-400"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="cf-items" className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
                    Itens relacionados
                  </Label>
                  <textarea
                    id="cf-items"
                    rows={2}
                    value={form.relatedItemsNote}
                    onChange={(e) => setForm((x) => ({ ...x, relatedItemsNote: e.target.value }))}
                    className="flex w-full rounded-md border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-900 shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-400"
                    placeholder="ONT, roteador, serviços adicionais…"
                  />
                </div>
                <div className="space-y-1.5">
                  {mode === "edit" && client ? (
                    overdueCheckLoading ? (
                      <p className="text-[0.65rem] text-neutral-500">A carregar situação das cobranças vencidas…</p>
                    ) : overdueRollup && overdueRollup.count > 0 ? (
                      <ClientDelinquencyRulerPanel
                        variant="modal"
                        rollup={overdueRollup}
                        clientStatus={form.status}
                        onMarkDelinquent={() => void markDelinquentFromSuggestion()}
                        onBlockClient={
                          form.status === "delinquent" ? () => setBlockConfirmOpen(true) : undefined
                        }
                        actionDisabled={markingDelinquent || saving || blockingClient}
                      />
                    ) : null
                  ) : null}
                  {mode === "edit" && client && form.status === "delinquent" && !overdueCheckLoading && (!overdueRollup || overdueRollup.count === 0) ? (
                    <div className="rounded-md border border-neutral-200 bg-neutral-50 px-3 py-2 text-xs text-neutral-800">
                      <p className="text-[0.65rem] leading-relaxed text-neutral-600">
                        Nenhuma cobrança vencida foi encontrada. O bloqueio cadastral continua disponível após decisão
                        interna, sem interrupção automática da rede.
                      </p>
                      <Button
                        type="button"
                        size="sm"
                        variant="destructive"
                        className="mt-2 h-8 text-xs font-semibold"
                        disabled={markingDelinquent || saving || blockingClient}
                        onClick={() => setBlockConfirmOpen(true)}
                      >
                        Bloquear cliente
                      </Button>
                    </div>
                  ) : null}
                  {mode === "edit" && form.status === "blocked" ? (
                    <div className="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm font-semibold text-red-950">
                      Cliente bloqueado no cadastro, sem interrupção automática do acesso à rede.
                    </div>
                  ) : null}
                  <Label htmlFor="cf-status" className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
                    Status do cliente
                  </Label>
                  <Select
                    id="cf-status"
                    value={form.status}
                    onChange={(e) => setForm((x) => ({ ...x, status: e.target.value as ClientStatus }))}
                    className="border-neutral-200"
                  >
                    {CLIENT_STATUS_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value} title={o.hint}>
                        {o.label}
                      </option>
                    ))}
                  </Select>
                  <p className="text-[0.65rem] leading-relaxed text-neutral-600">
                    <span className="font-medium text-neutral-800">Estado seleccionado:</span> {clientStatusHintPt(form.status)}
                  </p>
                  <p className="text-[0.65rem] leading-relaxed text-neutral-500">{CLIENT_STATUS_AUTOMATION_FOOTNOTE}</p>
                </div>
                {selectedPlan?.mikrotik ? (
                  <div className="rounded-md border border-neutral-200 bg-neutral-50 px-3 py-2 text-xs text-neutral-600">
                    <span className="font-semibold text-neutral-800">Configuração de velocidade do plano:</span>{" "}
                    {selectedPlan.mikrotik.profile ? `perfil ${selectedPlan.mikrotik.profile}` : ""}
                    {selectedPlan.mikrotik.rateLimit ? ` · limite ${selectedPlan.mikrotik.rateLimit}` : ""}
                    {!selectedPlan.mikrotik.profile && !selectedPlan.mikrotik.rateLimit ? "—" : null}
                  </div>
                ) : (
                  <p className="text-xs text-neutral-500">Este plano ainda não possui configuração de velocidade vinculada.</p>
                )}

                {sectionTitle("Vínculo com a rede")}
                <p className="text-xs leading-relaxed text-neutral-600">
                  Associe o cliente ao equipamento responsável pelo acesso. Esta configuração não interrompe nem libera
                  a conexão automaticamente.
                </p>
                <div className="space-y-1.5">
                  <Label
                    htmlFor="cf-mt-server"
                    className="text-xs font-semibold uppercase tracking-wide text-neutral-500"
                  >
                    Equipamento de rede
                  </Label>
                  <Select
                    id="cf-mt-server"
                    value={form.mikrotikServerId}
                    onChange={(e) => setForm((x) => ({ ...x, mikrotikServerId: e.target.value }))}
                    className="border-neutral-200"
                  >
                    <option value="">— Nenhum —</option>
                    {mikrotikServers.map((s) => (
                      <option key={s._id} value={s._id} disabled={s.isActive === false}>
                        {s.name} ({s.host}){s.isActive === false ? " · inactivo" : ""}
                      </option>
                    ))}
                  </Select>
                  {mikrotikServers.length === 0 ? (
                    <p className="text-[0.65rem] text-amber-800">
                      Nenhum equipamento disponível. Cadastre um equipamento de rede antes de vincular o cliente.
                    </p>
                  ) : null}
                </div>
                {mode === "edit" && client?.mikrotik?.sync ? (
                  <div className="rounded border border-neutral-200 bg-neutral-50 px-2 py-1.5 text-[0.65rem] text-neutral-700">
                    <span className="font-semibold">Situação da atualização de rede:</span>{" "}
                    <span className="font-mono">{client.mikrotik.sync.state ?? "—"}</span>
                    {client.mikrotik.sync.lastAttemptAt
                      ? ` · última tentativa ${new Date(client.mikrotik.sync.lastAttemptAt).toLocaleString("pt-BR")}`
                      : null}
                    {client.mikrotik.sync.lastErrorMessage
                      ? ` · ${client.mikrotik.sync.lastErrorMessage}`
                      : null}
                  </div>
                ) : null}
                <div className="space-y-2 rounded-md border border-amber-200/80 bg-amber-50/40 px-3 py-2">
                  <div className="flex items-center gap-2">
                    <input
                      id="cf-trust-en"
                      type="checkbox"
                      checked={form.trustReleaseEnabled}
                      onChange={(e) => setForm((x) => ({ ...x, trustReleaseEnabled: e.target.checked }))}
                      className="h-4 w-4 rounded border-neutral-300"
                    />
                    <Label htmlFor="cf-trust-en" className="text-xs font-semibold text-neutral-800">
                      Liberação por confiança (excepção auditável)
                    </Label>
                  </div>
                  <div className="space-y-1.5">
                    <Label
                      htmlFor="cf-trust-until"
                      className="text-xs font-semibold uppercase tracking-wide text-neutral-500"
                    >
                      Válido até
                    </Label>
                    <Input
                      id="cf-trust-until"
                      type="datetime-local"
                      value={form.trustReleaseUntil}
                      onChange={(e) => setForm((x) => ({ ...x, trustReleaseUntil: e.target.value }))}
                      disabled={!form.trustReleaseEnabled}
                      className="border-neutral-200"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label
                      htmlFor="cf-trust-reason"
                      className="text-xs font-semibold uppercase tracking-wide text-neutral-500"
                    >
                      Motivo
                    </Label>
                    <textarea
                      id="cf-trust-reason"
                      rows={2}
                      value={form.trustReleaseReason}
                      onChange={(e) => setForm((x) => ({ ...x, trustReleaseReason: e.target.value }))}
                      disabled={!form.trustReleaseEnabled}
                      className="flex w-full rounded-md border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-900 shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-400"
                      placeholder="Ex.: acordo, promessa de pagamento, análise de contestação…"
                    />
                  </div>
                  <p className="text-[0.6rem] leading-relaxed text-neutral-600">
                    Com confiança activa e data futura, a política trata inadimplente como excepção até expirar. Não anula
                    «Bloqueado» nem «Desativado» no cadastro.
                  </p>
                </div>
                {mode === "edit" && client ? (
                  <div className="space-y-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-8 text-xs"
                      disabled={networkIntentLoading}
                      onClick={() => void loadNetworkIntentPreview()}
                    >
                      {networkIntentLoading
                        ? "A carregar…"
                        : "Pré-visualizar política de rede (somente leitura)"}
                    </Button>
                    {networkIntent ? (
                      <pre className="max-h-48 overflow-auto rounded border border-neutral-200 bg-white p-2 text-[0.6rem] leading-relaxed text-neutral-800">
                        {JSON.stringify(networkIntent, null, 2)}
                      </pre>
                    ) : null}
                    <div className="mt-3 space-y-2 rounded-md border border-sky-200/80 bg-sky-50/50 px-3 py-2">
                      <p className="text-xs font-semibold text-sky-950">Situação no equipamento</p>
                      <p className="text-[0.65rem] leading-relaxed text-sky-900/90">
                        Consulte a situação atual do acesso no equipamento vinculado, sem alterar a configuração.
                      </p>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-8 text-xs"
                        disabled={mikrotikMonitoringLoading}
                        onClick={() => void loadMikrotikMonitoring()}
                      >
                        {mikrotikMonitoringLoading ? "A consultar…" : "Consultar situação na rede"}
                      </Button>
                      {mikrotikMonitoring ? (
                        <div className="space-y-2 text-[0.65rem] text-neutral-800">
                          <div className="grid gap-1 sm:grid-cols-2">
                            <div>
                              <span className="font-semibold text-neutral-600">Situação atual</span>
                              <p className="mt-0.5">
                                <span className="font-mono">{deviceStatusLabelPt(mikrotikMonitoring.status)}</span>
                                {mikrotikMonitoring.exists ? (
                                  <>
                                    {" "}
                                    · perfil:{" "}
                                    <span className="font-mono">{mikrotikMonitoring.profile ?? "—"}</span>
                                  </>
                                ) : null}
                              </p>
                            </div>
                            <div>
                              <span className="font-semibold text-neutral-600">Situação esperada</span>
                              <p className="mt-0.5">
                                {mikrotikMonitoring.expected.deviceStatus == null ? (
                                  <span className="text-neutral-600">
                                    Sem alteração prevista — orientação {mikrotikMonitoring.intent.recommendedSyncGoal}
                                  </span>
                                ) : (
                                  <>
                                    <span className="font-mono">
                                      {deviceStatusLabelPt(mikrotikMonitoring.expected.deviceStatus)}
                                    </span>
                                    {mikrotikMonitoring.expected.profileHint ? (
                                      <>
                                        {" "}
                                        · perfil cadastro:{" "}
                                        <span className="font-mono">{mikrotikMonitoring.expected.profileHint}</span>
                                      </>
                                    ) : null}
                                  </>
                                )}
                              </p>
                            </div>
                          </div>
                          <div>
                            <span className="font-semibold text-neutral-600">Divergência</span>
                            <p className="mt-0.5">
                              {mikrotikMonitoring.queryError ? (
                                <span className="text-amber-900">
                                  Erro de ligação: {mikrotikMonitoring.queryError}
                                </span>
                              ) : mikrotikMonitoring.divergent === null ? (
                                <span className="text-neutral-600">Não avaliado</span>
                              ) : mikrotikMonitoring.divergent ? (
                                <span className="font-medium text-red-800">
                                  Sim — {mikrotikMonitoring.divergenceReason ?? "ver política vs equipamento."}
                                </span>
                              ) : (
                                <span className="text-emerald-800">Não (alinhado dentro do verificado)</span>
                              )}
                            </p>
                          </div>
                          {mikrotikMonitoring.skipReason ? (
                            <p className="text-[0.6rem] text-neutral-600">
                              Nota: <span className="font-mono">{mikrotikMonitoring.skipReason}</span>
                            </p>
                          ) : null}
                        </div>
                      ) : null}
                    </div>
                  </div>
                ) : null}
              </div>

              <div className="space-y-4 border-t border-neutral-200 pt-6">
                {mode === "edit" ? (
                  <div className="space-y-2">
                    {sectionTitle("Acessos de internet vinculados")}
                    {clientAccessesLoading ? (
                      <p className="text-xs text-neutral-500">Carregando acessos...</p>
                    ) : clientAccesses.length === 0 ? (
                      <p className="rounded-md border border-neutral-200 bg-neutral-50 px-3 py-2 text-xs text-neutral-600">
                        Nenhum ClientAccess vinculado. O acesso legado permanece disponível abaixo.
                      </p>
                    ) : (
                      <div className="divide-y divide-neutral-100 rounded-md border border-neutral-200 bg-white">
                        {clientAccesses.map((access) => (
                          <div key={access.id} className="grid gap-2 px-3 py-3 text-xs sm:grid-cols-[1.2fr_1fr_auto]">
                            <div>
                              <p className="font-mono font-semibold text-neutral-900">{access.username}</p>
                              <p className="mt-0.5 text-neutral-500">{access.server.name || "Equipamento não identificado"}{access.networkNode ? ` · ${access.networkNode.name}` : ""}</p>
                            </div>
                            <div>
                              <p className="font-medium text-neutral-800">{access.plan.name || "Plano não identificado"}</p>
                              <p className="mt-0.5 text-neutral-500">{access.plan.speedMbps != null ? `${access.plan.speedMbps} Mbps` : "Velocidade não informada"}</p>
                            </div>
                            <div className="text-right">
                              <p className="font-semibold uppercase text-neutral-700">{access.status}</p>
                              <p className="mt-0.5 text-neutral-500">{access.source}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ) : null}

                {sectionTitle("Autenticação de rede")}
                <p className="text-xs text-neutral-500">
                  Login, senha e tipo de acesso ficam associados à ficha; as demais informações são guardadas como observações.
                </p>
                {!showAuthSummary ? (
                  <Button
                    type="button"
                    variant="outline"
                    className="gap-2 border-emerald-200 bg-emerald-50/50 font-semibold text-emerald-900 hover:bg-emerald-50"
                    onClick={() => setAuthModalOpen(true)}
                  >
                    <KeyRound className="h-4 w-4" />
                    Cadastrar autenticação
                  </Button>
                ) : (
                  <div className="rounded-sm border border-neutral-200 bg-neutral-50 p-4 shadow-sm">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0 space-y-1">
                        <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
                          Autenticação registada
                        </p>
                        <p className="font-mono text-sm font-medium text-neutral-900">{form.accessUsername || "—"}</p>
                        <p className="text-xs text-neutral-600">
                          Tipo: {form.authType} · Plano:{" "}
                          {selectedPlan ? `${selectedPlan.name} (${selectedPlan.speedMbps} Mbps)` : "—"}
                        </p>
                        <p className="text-xs text-neutral-600">
                          Estado (fluxo): {statusLabelAuth}
                          {form.server.trim() ? ` · Servidor: ${form.server.trim()}` : null}
                        </p>
                      </div>
                      <div className="flex flex-shrink-0 flex-wrap gap-2">
                        <Button type="button" size="sm" variant="outline" onClick={() => setAuthModalOpen(true)}>
                          Atualizar
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="text-red-700 hover:bg-red-50"
                          onClick={clearAuthentication}
                        >
                          Eliminar
                        </Button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="flex flex-wrap justify-end gap-2 border-t border-neutral-100 pt-4">
            <Button type="button" variant="secondary" onClick={() => onOpenChange(false)} disabled={saving}>
              Cancelar
            </Button>
            <Button
              type="button"
              className="border-0 bg-emerald-600 font-semibold text-white hover:bg-emerald-700"
              onClick={() => void submit()}
              disabled={saving}
            >
              {saving ? "A guardar…" : mode === "create" ? "Criar cliente" : "Guardar alterações"}
            </Button>
          </div>
        </div>
      </Modal>

      <ClienteAutenticacaoModal
        open={authModalOpen}
        onOpenChange={setAuthModalOpen}
        clientName={form.fullName.trim() || "(sem nome)"}
        planLabel={planLabelReadonly}
        contractHint={contractHint}
        passwordOptional={mode === "edit" || hasAuthRegistration}
        value={formToAuthDraft(form)}
        onSave={handleAuthSave}
      />

      <ConfirmDialog
        open={blockConfirmOpen}
        onOpenChange={setBlockConfirmOpen}
        title="Bloquear cliente"
        description={
          client && form.status === "delinquent"
            ? `Confirma bloquear «${client.fullName}» no cadastro? O cliente ficará com o estado «Bloqueado», sem interrupção automática do acesso à rede.`
            : ""
        }
        confirmLabel="Bloquear"
        variant="destructive"
        onConfirm={executeBlockClient}
      />
    </>
  );
}
