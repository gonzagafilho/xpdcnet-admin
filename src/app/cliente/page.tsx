"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Activity,
  AlertTriangle,
  Bell,
  Banknote,
  CalendarDays,
  CheckCheck,
  CircleHelp,
  Clock,
  Copy,
  CreditCard,
  Download,
  ExternalLink,
  FileText,
  Globe2,
  Gauge,
  Headphones,
  Home,
  Inbox,
  LogOut,
  MessageSquarePlus,
  PhoneCall,
  QrCode,
  Router,
  ShieldCheck,
  Smartphone,
  TimerReset,
  Upload,
  UserRound,
  Wifi,
} from "lucide-react";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  CustomerApiError,
  clearCustomerToken,
  customerApiFetch,
  getCustomerToken,
  setCustomerToken,
} from "@/lib/customer-app-api";

type TabKey = "dashboard" | "plan" | "connection" | "networkMap" | "pppoe" | "speedTest" | "whatsapp" | "invoices" | "payment" | "support" | "tickets" | "notifications";

type CustomerLoginResponse = {
  token: string;
  client: { _id: string; fullName: string; status: string };
};

type CustomerOtpRequestResponse = {
  ok: boolean;
  message: string;
  devCode?: string;
};

type Dashboard = {
  client: { _id: string; fullName: string; email?: string; phone?: string; status: string; dueDay?: number | null; monthlyPrice?: number };
  plan: Plan | null;
  status: string;
  mainDueDate: string | null;
  financialSummary: {
    openInvoices: number;
    overdueInvoices: number;
    paidInvoices: number;
    openAmount: number;
    nextInvoice: InvoiceItem | null;
  };
  connection: ConnectionInfo;
  alerts: { type: string; severity: string; message: string }[];
};

type Plan = {
  _id: string;
  name: string;
  speedMbps: number;
  price: number;
  billingCycle: string;
  authType: string;
  mikrotik?: { rateLimit?: string };
  isActive: boolean;
};

type PlanResponse = {
  plan: Plan | null;
  speedMbps: number | null;
  amount: number;
  dueDay: number | null;
  status: string;
  billingCycle: string;
};

type ConnectionInfo = {
  status: "online" | "offline" | "unknown" | string;
  plan?: Plan | null;
  access?: { authType: string; usernameMasked: string };
  server: { _id: string; name: string; isActive: boolean } | null;
  networkNode: { _id: string; name: string; status: string; healthLevel?: string | null; healthScore?: number | null; agentLastSeenAt?: string | null } | null;
  lastSession: { sampledAt: string | null; activePppTotal: number | null; pppSecretCount: number | null } | null;
  lastSignal?: {
    sampledAt: string | null;
    source: string;
    health?: string | null;
    cpuPercent?: number | null;
    pppOnline?: number | null;
    totalRxMbps?: number | null;
    totalTxMbps?: number | null;
  } | null;
  lastUpdateAt?: string | null;
  lastCommand?: { kind: string; status: string; success?: boolean | null; completedAt?: string | null; updatedAt?: string | null } | null;
  mikrotikSync?: { enabled: boolean; state: string; lastSuccessAt: string | null; lastAttemptAt: string | null };
  alerts?: { type: string; severity: string; message: string }[];
};


type PppoeInfo = {
  status: "online" | "offline" | "unknown" | string;
  usernameMasked: string;
  currentIp: string | null;
  serverName: string | null;
  uptime: string | null;
  connectedAt: string | null;
  lastUpdateAt: string | null;
  trafficNow: {
    downloadMbps: number | null;
    uploadMbps: number | null;
  };
  quality: {
    pingMs: number | null;
    jitterMs: number | null;
    packetLoss: number | null;
  };
  series: { time: string; downloadMbps: number | null; uploadMbps: number | null }[];
  alerts: { type: string; severity: string; message: string }[];
};

type PppoeUsageBucket = {
  downloadGB: number;
  uploadGB: number;
  totalGB: number;
};

type PppoeHistory = {
  today: PppoeUsageBucket;
  yesterday: PppoeUsageBucket;
  month: PppoeUsageBucket;
  series7d: ({ date: string } & PppoeUsageBucket)[];
  series30d: ({ date: string } & PppoeUsageBucket)[];
  source: "snapshot" | "empty" | string;
  message: string;
};

type PppoeLive = {
  status: "online" | "offline" | "unknown" | string;
  downloadMbps: number;
  uploadMbps: number;
  currentIp: string | null;
  uptime: string | null;
  pingMs: number | null;
  jitterMs: number | null;
  packetLoss: number | null;
  lastUpdateAt: string | null;
  source: "snapshot" | "empty" | string;
  message: string;
};

type PppoeLivePoint = {
  time: string;
  downloadMbps: number;
  uploadMbps: number;
};

type PppoeLiveState = "idle" | "loading" | "fresh" | "empty" | "error";

type NetworkMapNode = {
  type: "internet" | "pop" | "router" | "olt" | "customer" | string;
  label: string;
  status: "online" | "offline" | "unknown" | string;
};

type CustomerNetworkMap = {
  status: "online" | "offline" | "unknown" | string;
  client: { name: string };
  path: NetworkMapNode[];
  quality: {
    pingMs: number | null;
    jitterMs: number | null;
    packetLoss: number | null;
  };
  lastUpdateAt: string | null;
  source: "snapshot" | "fallback" | string;
  message: string;
};

type InvoiceItem = {
  _id: string;
  amount: number;
  dueDate: string | null;
  status: string;
  paidAt?: string | null;
  competence: string;
  description?: string;
  hasBillingInvoice: boolean;
  billingInvoiceId: string | null;
  billingStatus: string | null;
};

type PaymentResponse = {
  invoice: InvoiceItem;
  payment: {
    _id: string;
    providerStatus: string;
    internalStatus: string;
    checkoutUrl?: string;
    pixPayload?: string;
    pixCopyPaste?: string;
    pixQrCodeUrl?: string;
    boletoUrl?: string;
    boletoBarcode?: string;
  } | null;
  canIssueNewCharge: boolean;
};

type Ticket = {
  _id: string;
  protocol: string;
  subject: string;
  message: string;
  status: string;
  createdAt: string;
  updatedAt: string;
};

type ExecutiveDashboard = {
  client: { fullName: string; status: string };
  internet: { status: "online" | "offline" | "unknown" | string; healthScore: number | null };
  plan: { name: string; speed: string };
  billing: { pendingInvoices: number; nextDueDate: string | null; overdueInvoices: number };
  support: { openTickets: number };
  notifications?: { unreadCount: number };
  connection: { lastUpdateAt: string | null };
};

type CustomerNotification = {
  _id: string;
  type: "billing" | "support" | "network" | "system" | string;
  title: string;
  message: string;
  isRead: boolean;
  createdAt: string | null;
  readAt?: string | null;
};

type SpeedTestResult = {
  id: string;
  downloadMbps: number;
  uploadMbps: number;
  pingMs: number;
  jitterMs: number;
  createdAt: string;
  provider: "dcnet-speedtest";
};

type SpeedTestStep = "idle" | "ping" | "download" | "upload" | "finishing";

const SPEED_TEST_BASE_URL = "https://speed.dcinfinity.net.br";
const SPEED_TEST_HISTORY_KEY = "dcnet:cliente:speed-tests";
const WHATSAPP_DCNET = "https://wa.me/5561996627145";

const tabs: { key: TabKey; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { key: "dashboard", label: "Início", icon: Home },
  { key: "plan", label: "Meu Plano", icon: ShieldCheck },
  { key: "connection", label: "Minha Conexão", icon: Wifi },
  { key: "networkMap", label: "Mapa da Conexão", icon: Globe2 },
  { key: "pppoe", label: "Sua Internet", icon: Router },
  { key: "speedTest", label: "Speed Test", icon: Gauge },
  { key: "whatsapp", label: "WhatsApp", icon: PhoneCall },
  { key: "invoices", label: "Minhas Faturas", icon: FileText },
  { key: "payment", label: "PIX / Segunda Via", icon: CreditCard },
  { key: "support", label: "Suporte", icon: Headphones },
  { key: "tickets", label: "Protocolos", icon: CircleHelp },
  { key: "notifications", label: "Notificações", icon: Bell },
];

function money(value?: number | null) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(value || 0));
}

function date(value?: string | null) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short" }).format(new Date(value));
}

function dateTime(value?: string | null) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(new Date(value));
}

function timeLabel(value?: string | null) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit" }).format(new Date(value));
}

function statusLabel(status?: string) {
  const map: Record<string, string> = {
    active: "Ativo",
    pending: "Pendente",
    paid: "Pago",
    overdue: "Vencido",
    cancelled: "Cancelado",
    delinquent: "Em atraso",
    blocked: "Bloqueado",
    suspended: "Suspenso",
    online: "Online",
    offline: "Offline",
    unknown: "Atualizando informações",
    open: "Aberto",
    in_progress: "Em atendimento",
    resolved: "Resolvido",
    closed: "Fechado",
  };
  return map[String(status || "")] || status || "-";
}

function Badge({ children, tone = "slate" }: { children: React.ReactNode; tone?: "green" | "red" | "amber" | "slate" }) {
  const cls = {
    green: "border-emerald-200 bg-emerald-50 text-emerald-700",
    red: "border-red-200 bg-red-50 text-red-700",
    amber: "border-amber-200 bg-amber-50 text-amber-700",
    slate: "border-slate-200 bg-slate-50 text-slate-700",
  }[tone];
  return <span className={`inline-flex h-7 items-center rounded-full border px-2.5 text-xs font-medium ${cls}`}>{children}</span>;
}

function toneForStatus(status?: string): "green" | "red" | "amber" | "slate" {
  if (["active", "paid", "online", "resolved"].includes(String(status))) return "green";
  if (["overdue", "blocked", "disabled", "cancelled", "offline"].includes(String(status))) return "red";
  if (["pending", "delinquent", "suspended", "in_progress", "open"].includes(String(status))) return "amber";
  return "slate";
}

function invoicePaymentMessage(invoice: InvoiceItem) {
  if (invoice.status === "paid") return "Fatura paga";
  if (invoice.status === "overdue") return invoice.hasBillingInvoice ? "Pagamento disponível" : "Fatura vencida";
  if (invoice.status === "pending") return invoice.hasBillingInvoice ? "Pagamento disponível" : "Segunda via ainda não gerada";
  if (invoice.status === "cancelled") return "Fatura cancelada";
  return invoice.hasBillingInvoice ? "Pagamento disponível" : "Segunda via ainda não gerada";
}

function isPayableInvoice(invoice: InvoiceItem) {
  return ["pending", "overdue"].includes(invoice.status);
}

function supportStatusTone(status?: string): "green" | "red" | "amber" | "slate" {
  if (["resolved", "closed"].includes(String(status))) return "green";
  if (["in_progress"].includes(String(status))) return "amber";
  if (["open"].includes(String(status))) return "slate";
  return "slate";
}

function supportStatusText(status?: string) {
  const map: Record<string, string> = {
    open: "Aberto",
    in_progress: "Em atendimento",
    resolved: "Resolvido",
    closed: "Fechado",
  };
  return map[String(status || "")] || status || "-";
}

function connectionMessage(status?: string) {
  if (status === "online") return "Conexão ativa.";
  if (status === "offline") return "Não encontramos sua internet ativa na última consulta.";
  return "Estamos atualizando as informações da sua internet.";
}

function healthLabel(value?: string | null) {
  const map: Record<string, string> = {
    healthy: "Normal",
    warning: "Atenção",
    critical: "Crítico",
  };
  return map[String(value || "")] || value || "Atualizando informações";
}

function metricValue(value?: number | null, suffix = "") {
  if (value == null || Number.isNaN(Number(value))) return "-";
  return `${Number(value)}${suffix}`;
}

function connectionTone(connection: ConnectionInfo): "green" | "red" | "amber" | "slate" {
  if (connection.status === "online" && !connection.alerts?.length) return "green";
  if (connection.status === "offline") return "red";
  if (connection.alerts?.length) return "amber";
  return "slate";
}

function healthTone(score?: number | null): "green" | "red" | "amber" | "slate" {
  if (score == null) return "slate";
  if (score >= 85) return "green";
  if (score >= 55) return "amber";
  return "red";
}

function billingTone(pending: number, overdue: number): "green" | "red" | "amber" | "slate" {
  if (overdue > 0) return "red";
  if (pending > 0) return "amber";
  return "green";
}

function scoreText(score?: number | null) {
  if (score == null) return "Atualizando informações";
  return `${Math.max(0, Math.min(100, Math.round(score)))}%`;
}

function speedValue(value?: number | null) {
  if (value == null || Number.isNaN(Number(value))) return "-";
  return `${Number(value).toFixed(1)} Mbps`;
}

function latencyValue(value?: number | null) {
  if (value == null || Number.isNaN(Number(value))) return "-";
  return `${Math.round(Number(value))} ms`;
}
function dataGb(value?: number | null) {
  if (value == null || Number.isNaN(Number(value))) return "0 GB";
  return `${Number(value).toFixed(3)} GB`;
}

function hasUsageSeries(items?: PppoeHistory["series7d"]) {
  return Boolean(items?.some((item) => Number(item.totalGB || 0) > 0));
}

function pppoeLivePointFromData(data: PppoeLive): PppoeLivePoint {
  return {
    time: timeLabel(new Date().toISOString()),
    downloadMbps: Number(data.downloadMbps || 0),
    uploadMbps: Number(data.uploadMbps || 0),
  };
}

function liveStatusText(status: PppoeLiveState, data: PppoeLive | null) {
  if (status === "loading") return "Atualizando...";
  if (status === "error") return "Não foi possível atualizar agora; mantendo a última informação.";
  if (status === "empty" || data?.source === "empty") return "Atualizando informações";
  if (status === "fresh") return "Última consulta agora";
  return "Atualizando informações";
}

function networkMapIcon(type?: string) {
  const map: Record<string, React.ComponentType<{ className?: string }>> = {
    internet: Globe2,
    pop: Wifi,
    router: Router,
    olt: Activity,
    customer: Home,
  };
  return map[String(type || "")] || Activity;
}

function networkLineClass(status?: string) {
  if (status === "online") return "bg-emerald-500";
  if (status === "offline") return "bg-red-500";
  return "bg-slate-300";
}

function networkNodeClass(status?: string) {
  if (status === "online") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (status === "offline") return "border-red-200 bg-red-50 text-red-700";
  return "border-slate-200 bg-slate-50 text-slate-600";
}

function friendlyNetworkLabel(label?: string, type?: string) {
  const byType: Record<string, string> = {
    router: "Centro da rede DC NET",
    olt: "Ponto de distribuição",
    customer: "Sua casa",
  };
  const fallback = byType[String(type || "")] || label || "Atualizando informações";
  const value = String(label || fallback);
  if (/pppoe|servidor|equipamento|olt|ccr/i.test(value)) return fallback;
  return value;
}

function worseStatusForUi(...statuses: (string | undefined)[]) {
  if (statuses.includes("offline")) return "offline";
  if (statuses.includes("unknown")) return "unknown";
  return "online";
}

function readSpeedTestHistory() {
  if (typeof window === "undefined") return [];
  try {
    const parsed = JSON.parse(window.localStorage.getItem(SPEED_TEST_HISTORY_KEY) || "[]");
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((item): item is SpeedTestResult => Boolean(item?.id && item?.createdAt))
      .slice(0, 10);
  } catch {
    return [];
  }
}

function saveSpeedTestHistory(items: SpeedTestResult[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(SPEED_TEST_HISTORY_KEY, JSON.stringify(items.slice(0, 10)));
}

function speedTestUrl(path: string) {
  return `${SPEED_TEST_BASE_URL}${path}`;
}

function speedTestErrorMessage(error: unknown) {
  if (error instanceof DOMException && error.name === "AbortError") return "Tempo limite excedido ao conectar ao Speed Test.";
  if (error instanceof TypeError) return "Speed Test indisponível no momento.";
  if (error instanceof Error) return error.message;
  return "Não foi possível executar o Speed Test agora.";
}

async function fetchWithTimeout(url: string, options: RequestInit = {}, timeoutMs = 15000) {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { ...options, signal: controller.signal, cache: "no-store" });
    if (!response.ok) throw new Error("Speed Test respondeu com erro.");
    return response;
  } finally {
    window.clearTimeout(timer);
  }
}

async function measureSpeedTestLatency(samples = 6) {
  const measures: number[] = [];
  for (let i = 0; i < samples; i += 1) {
    const startedAt = performance.now();
    await fetchWithTimeout(speedTestUrl(`/empty?cache=${Date.now()}-${i}`), undefined, 5000);
    measures.push(performance.now() - startedAt);
  }
  const ping = measures.reduce((sum, value) => sum + value, 0) / measures.length;
  const jitter = measures.reduce((sum, value) => sum + Math.abs(value - ping), 0) / measures.length;
  return { ping, jitter };
}

async function measureSpeedTestDownload() {
  const startedAt = performance.now();
  const response = await fetchWithTimeout(speedTestUrl(`/garbage?ckSize=32&cache=${Date.now()}`), undefined, 30000);
  let bytes = 0;

  if (response.body) {
    const reader = response.body.getReader();
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
    }
  } else {
    bytes = (await response.arrayBuffer()).byteLength;
  }

  const seconds = Math.max((performance.now() - startedAt) / 1000, 0.001);
  return (bytes * 8) / seconds / 1000000;
}

async function measureSpeedTestUpload() {
  const bytes = 8 * 1024 * 1024;
  const payload = new Uint8Array(bytes);
  const startedAt = performance.now();
  await fetchWithTimeout(speedTestUrl(`/upload?cache=${Date.now()}`), {
    method: "POST",
    body: payload,
  }, 30000);
  const seconds = Math.max((performance.now() - startedAt) / 1000, 0.001);
  return (bytes * 8) / seconds / 1000000;
}

async function runCustomerSpeedTest(onStep: (step: SpeedTestStep) => void): Promise<SpeedTestResult> {
  onStep("ping");
  const latency = await measureSpeedTestLatency();

  onStep("download");
  const downloadMbps = await measureSpeedTestDownload();

  onStep("upload");
  const uploadMbps = await measureSpeedTestUpload();

  onStep("finishing");
  await new Promise((resolve) => window.setTimeout(resolve, 250));

  return {
    id: typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : String(Date.now()),
    downloadMbps,
    uploadMbps,
    pingMs: latency.ping,
    jitterMs: latency.jitter,
    createdAt: new Date().toISOString(),
    provider: "dcnet-speedtest",
  };
}
function notificationTypeLabel(type?: string) {
  const map: Record<string, string> = {
    billing: "Financeiro",
    support: "Suporte",
    network: "Rede",
    system: "Sistema",
  };
  return map[String(type || "")] || "Sistema";
}

function notificationTypeClass(type?: string) {
  const map: Record<string, string> = {
    billing: "border-emerald-200 bg-emerald-50 text-emerald-700",
    support: "border-blue-200 bg-blue-50 text-blue-700",
    network: "border-amber-200 bg-amber-50 text-amber-700",
    system: "border-slate-200 bg-slate-50 text-slate-700",
  };
  return map[String(type || "")] || map.system;
}

function openOfficialWhatsapp() {
  window.open(WHATSAPP_DCNET, "_blank");
}

function firstNameFromFullName(value?: string | null) {
  return String(value || "").trim().split(/\s+/).filter(Boolean)[0] || "";
}

function customerGreeting(value?: string | null) {
  const firstName = firstNameFromFullName(value);
  return firstName ? `Olá, ${firstName} 👋` : "Bem-vindo ao Portal DC NET";
}


export default function ClientePage() {
  const [tokenReady, setTokenReady] = useState(false);
  const [loggedIn, setLoggedIn] = useState(false);
  const [document, setDocument] = useState("");
  const [phone, setPhone] = useState("");
  const [loginError, setLoginError] = useState("");
  const [loginMessage, setLoginMessage] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [otpRequested, setOtpRequested] = useState(false);
  const [otpDevCode, setOtpDevCode] = useState("");
  const [loadingLogin, setLoadingLogin] = useState(false);
  const [tab, setTab] = useState<TabKey>("dashboard");

  const [loginClient, setLoginClient] = useState<CustomerLoginResponse["client"] | null>(null);
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [executiveDashboard, setExecutiveDashboard] = useState<ExecutiveDashboard | null>(null);
  const [plan, setPlan] = useState<PlanResponse | null>(null);
  const [connection, setConnection] = useState<ConnectionInfo | null>(null);
  const [networkMap, setNetworkMap] = useState<CustomerNetworkMap | null>(null);
  const [pppoe, setPppoe] = useState<PppoeInfo | null>(null);
  const [pppoeHistory, setPppoeHistory] = useState<PppoeHistory | null>(null);
  const [pppoeLive, setPppoeLive] = useState<PppoeLive | null>(null);
  const [pppoeLivePoints, setPppoeLivePoints] = useState<PppoeLivePoint[]>([]);
  const [pppoeLiveState, setPppoeLiveState] = useState<PppoeLiveState>("idle");
  const [invoices, setInvoices] = useState<InvoiceItem[]>([]);
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<string>("");
  const [payment, setPayment] = useState<PaymentResponse | null>(null);
  const [loadingPayment, setLoadingPayment] = useState(false);
  const [copyStatus, setCopyStatus] = useState("");
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [notifications, setNotifications] = useState<CustomerNotification[]>([]);
  const [unreadNotifications, setUnreadNotifications] = useState(0);
  const [loadingNotifications, setLoadingNotifications] = useState(false);
  const [selectedTicketId, setSelectedTicketId] = useState<string>("");
  const [ticketDetail, setTicketDetail] = useState<Ticket | null>(null);
  const [loadingTickets, setLoadingTickets] = useState(false);
  const [loadingTicketDetail, setLoadingTicketDetail] = useState(false);
  const [supportSubject, setSupportSubject] = useState("");
  const [supportMessage, setSupportMessage] = useState("");
  const [supportStatus, setSupportStatus] = useState("");
  const [lastProtocol, setLastProtocol] = useState("");
  const [openingTicket, setOpeningTicket] = useState(false);
  const [loadingData, setLoadingData] = useState(false);
  const [dataError, setDataError] = useState("");

  const greetingSourceName = dashboard?.client.fullName || executiveDashboard?.client.fullName || loginClient?.fullName || "";
  const greetingText = useMemo(() => customerGreeting(greetingSourceName), [greetingSourceName]);

  const handleAuthError = useCallback((err: unknown) => {
    if (err instanceof CustomerApiError && err.status === 401) {
      clearCustomerToken();
      setLoggedIn(false);
      setDashboard(null);
      setExecutiveDashboard(null);
      setLoginClient(null);
      setNotifications([]);
      setUnreadNotifications(0);
      setLoginMessage("");
      setOtpCode("");
      setOtpRequested(false);
      setOtpDevCode("");
      setLoginError("Seu acesso expirou. Entre novamente.");
      return true;
    }
    return false;
  }, []);

  const loadAll = useCallback(async () => {
    setLoadingData(true);
    setDataError("");
    try {
      setLoadingTickets(true);
      setLoadingNotifications(true);
      const [me, executive, planData, connData, networkMapData, pppoeData, pppoeHistoryData, pppoeLiveData, invoiceData, ticketData, notificationData, unreadData] = await Promise.all([
        customerApiFetch<Dashboard>("/customer-app/me"),
        customerApiFetch<ExecutiveDashboard>("/customer-app/dashboard"),
        customerApiFetch<PlanResponse>("/customer-app/plan"),
        customerApiFetch<ConnectionInfo>("/customer-app/connection"),
        customerApiFetch<CustomerNetworkMap>("/customer-app/network-map"),
        customerApiFetch<PppoeInfo>("/customer-app/pppoe"),
        customerApiFetch<PppoeHistory>("/customer-app/pppoe/history"),
        customerApiFetch<PppoeLive>("/customer-app/pppoe/live"),
        customerApiFetch<{ items: InvoiceItem[] }>("/customer-app/invoices?limit=24"),
        customerApiFetch<{ items: Ticket[] }>("/customer-app/support/tickets?limit=20"),
        customerApiFetch<{ items: CustomerNotification[] }>("/customer-app/notifications?limit=50"),
        customerApiFetch<{ unreadCount: number }>("/customer-app/notifications/unread-count"),
      ]);
      setLoginClient(me.client);
      setDashboard(me);
      setExecutiveDashboard(executive);
      setPlan(planData);
      setConnection(connData);
      setNetworkMap(networkMapData);
      setPppoe(pppoeData);
      setPppoeHistory(pppoeHistoryData);
      setPppoeLive(pppoeLiveData);
      setPppoeLiveState(pppoeLiveData.source === "empty" ? "empty" : "fresh");
      setPppoeLivePoints(pppoeLiveData.source === "empty" ? [] : [pppoeLivePointFromData(pppoeLiveData)]);
      setInvoices(invoiceData.items || []);
      setTickets(ticketData.items || []);
      setNotifications(notificationData.items || []);
      setUnreadNotifications(Number(unreadData.unreadCount || executive.notifications?.unreadCount || 0));
      setSelectedTicketId((current) => current || ticketData.items?.[0]?._id || "");
      const firstPayable = (invoiceData.items || []).find((item) => item.hasBillingInvoice) || invoiceData.items?.[0];
      setSelectedInvoiceId((current) => current || firstPayable?._id || "");
      setLoggedIn(true);
    } catch (err) {
      if (!handleAuthError(err)) setDataError(err instanceof Error ? err.message : "Falha ao carregar dados.");
    } finally {
      setLoadingData(false);
      setLoadingTickets(false);
      setLoadingNotifications(false);
    }
  }, [handleAuthError]);

  const loadPppoeLive = useCallback(async (silent = false) => {
    if (!silent) setPppoeLiveState("loading");
    try {
      const liveData = await customerApiFetch<PppoeLive>("/customer-app/pppoe/live");
      setPppoeLive(liveData);
      setPppoeLiveState(liveData.source === "empty" ? "empty" : "fresh");
      if (liveData.source !== "empty") {
        setPppoeLivePoints((items) => [...items, pppoeLivePointFromData(liveData)].slice(-60));
      }
    } catch (err) {
      if (!handleAuthError(err)) setPppoeLiveState("error");
    }
  }, [handleAuthError]);

  useEffect(() => {
    const token = getCustomerToken();
    setTokenReady(true);
    if (token) void loadAll();
  }, [loadAll]);

  useEffect(() => {
    if (!loggedIn || tab !== "pppoe") return undefined;
    void loadPppoeLive();
    const timer = window.setInterval(() => void loadPppoeLive(), 5000);
    return () => window.clearInterval(timer);
  }, [loggedIn, tab, loadPppoeLive]);

  useEffect(() => {
    if (!selectedInvoiceId || !loggedIn) return;
    setLoadingPayment(true);
    setCopyStatus("");
    customerApiFetch<PaymentResponse>(`/customer-app/invoices/${selectedInvoiceId}/payment`)
      .then(setPayment)
      .catch((err) => {
        if (!handleAuthError(err)) setPayment(null);
      })
      .finally(() => setLoadingPayment(false));
  }, [selectedInvoiceId, loggedIn, handleAuthError]);

  useEffect(() => {
    if (!selectedTicketId || !loggedIn) return;
    setLoadingTicketDetail(true);
    customerApiFetch<Ticket>(`/customer-app/support/tickets/${selectedTicketId}`)
      .then(setTicketDetail)
      .catch((err) => {
        if (!handleAuthError(err)) setTicketDetail(null);
      })
      .finally(() => setLoadingTicketDetail(false));
  }, [selectedTicketId, loggedIn, handleAuthError]);

  async function login(e: React.FormEvent) {
    e.preventDefault();
    setLoginError("");
    setLoginMessage("");
    setLoadingLogin(true);
    try {
      if (!otpRequested) {
        const res = await customerApiFetch<CustomerOtpRequestResponse>("/customer-app/auth/request-otp", {
          auth: false,
          method: "POST",
          body: JSON.stringify({ document, phone }),
        });
        setOtpRequested(true);
        setOtpDevCode(res.devCode || "");
        setLoginMessage(res.message || "Código enviado para o WhatsApp informado.");
        return;
      }

      const res = await customerApiFetch<CustomerLoginResponse>("/customer-app/auth/verify-otp", {
        auth: false,
        method: "POST",
        body: JSON.stringify({ document, phone, code: otpCode }),
      });
      setCustomerToken(res.token);
      setLoginClient(res.client);
      setLoggedIn(true);
      setOtpCode("");
      setOtpRequested(false);
      setOtpDevCode("");
      await loadAll();
    } catch (err) {
      setLoginError(err instanceof Error ? err.message : "Não foi possível entrar.");
    } finally {
      setLoadingLogin(false);
    }
  }

  function resetOtpLogin() {
    setOtpRequested(false);
    setOtpCode("");
    setOtpDevCode("");
    setLoginError("");
    setLoginMessage("");
  }

  function logout() {
    clearCustomerToken();
    setLoggedIn(false);
    setLoginClient(null);
    setDashboard(null);
    setExecutiveDashboard(null);
    setPlan(null);
    setConnection(null);
    setNetworkMap(null);
    setPppoe(null);
    setPppoeHistory(null);
    setPppoeLive(null);
    setPppoeLivePoints([]);
    setPppoeLiveState("idle");
    setInvoices([]);
    setTickets([]);
    setNotifications([]);
    setUnreadNotifications(0);
    setPayment(null);
    setCopyStatus("");
    setTicketDetail(null);
    setSelectedTicketId("");
    setLastProtocol("");
    setLoginMessage("");
    setOtpCode("");
    setOtpRequested(false);
    setOtpDevCode("");
    setTab("dashboard");
  }

  async function createTicket(e: React.FormEvent) {
    e.preventDefault();
    setSupportStatus("");
    setLastProtocol("");
    setOpeningTicket(true);
    try {
      const created = await customerApiFetch<Ticket>("/customer-app/support/tickets", {
        method: "POST",
        body: JSON.stringify({ subject: supportSubject, message: supportMessage }),
      });
      setSupportSubject("");
      setSupportMessage("");
      setSupportStatus("Chamado aberto com sucesso");
      setLastProtocol(created.protocol || "");
      setSelectedTicketId(created._id);
      setTicketDetail(created);
      setLoadingTickets(true);
      const data = await customerApiFetch<{ items: Ticket[] }>("/customer-app/support/tickets?limit=20");
      setTickets(data.items || []);
      setTab("tickets");
    } catch (err) {
      if (!handleAuthError(err)) setSupportStatus(err instanceof Error ? err.message : "Falha ao abrir chamado.");
    } finally {
      setOpeningTicket(false);
      setLoadingTickets(false);
    }
  }

  async function refreshNotifications() {
    setLoadingNotifications(true);
    try {
      const [notificationData, unreadData] = await Promise.all([
        customerApiFetch<{ items: CustomerNotification[] }>("/customer-app/notifications?limit=50"),
        customerApiFetch<{ unreadCount: number }>("/customer-app/notifications/unread-count"),
      ]);
      setNotifications(notificationData.items || []);
      setUnreadNotifications(Number(unreadData.unreadCount || 0));
      setExecutiveDashboard((current) => current ? { ...current, notifications: { unreadCount: Number(unreadData.unreadCount || 0) } } : current);
    } catch (err) {
      if (!handleAuthError(err)) setDataError(err instanceof Error ? err.message : "Falha ao carregar notificações.");
    } finally {
      setLoadingNotifications(false);
    }
  }

  async function markNotificationRead(notification: CustomerNotification) {
    if (notification.isRead) return;
    try {
      const updated = await customerApiFetch<CustomerNotification>(`/customer-app/notifications/${notification._id}/read`, { method: "PATCH" });
      setNotifications((items) => items.map((item) => item._id === updated._id ? updated : item));
      setUnreadNotifications((count) => Math.max(0, count - 1));
      setExecutiveDashboard((current) => current ? { ...current, notifications: { unreadCount: Math.max(0, (current.notifications?.unreadCount || 0) - 1) } } : current);
    } catch (err) {
      if (!handleAuthError(err)) setDataError(err instanceof Error ? err.message : "Falha ao marcar notificação.");
    }
  }

  async function markAllNotificationsRead() {
    try {
      await customerApiFetch<{ updated: number }>("/customer-app/notifications/read-all", { method: "PATCH" });
      setNotifications((items) => items.map((item) => ({ ...item, isRead: true, readAt: item.readAt || new Date().toISOString() })));
      setUnreadNotifications(0);
      setExecutiveDashboard((current) => current ? { ...current, notifications: { unreadCount: 0 } } : current);
    } catch (err) {
      if (!handleAuthError(err)) setDataError(err instanceof Error ? err.message : "Falha ao marcar notificações.");
    }
  }

  if (!tokenReady) {
    return <div className="min-h-screen bg-white" />;
  }

  if (!loggedIn) {
    return (
      <main className="min-h-screen bg-white text-slate-950">
        <section className="mx-auto flex min-h-screen w-full max-w-6xl flex-col justify-center px-4 py-8 sm:px-6 lg:px-8">
          <div className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
            <div className="space-y-8">
              <div className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-sm font-medium text-emerald-700">
                <Smartphone className="h-4 w-4" /> Portal do Cliente DC NET
              </div>
              <div className="space-y-4">
                <h1 className="max-w-2xl text-4xl font-semibold tracking-tight text-slate-950 sm:text-5xl">
                  Sua internet, faturas e suporte em um só lugar.
                </h1>
                <p className="max-w-xl text-base leading-7 text-slate-600">
                  Acesse com CPF/CNPJ e WhatsApp cadastrados para consultar plano, conexão, segunda via e protocolos.
                </p>
              </div>
              <div className="grid max-w-xl grid-cols-3 gap-3 text-sm">
                <div className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
                  <Wifi className="mb-2 h-5 w-5 text-emerald-600" /> Conexão
                </div>
                <div className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
                  <Banknote className="mb-2 h-5 w-5 text-emerald-600" /> Faturas
                </div>
                <div className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
                  <Headphones className="mb-2 h-5 w-5 text-emerald-600" /> Suporte
                </div>
              </div>
            </div>
            <Card className="mx-auto w-full max-w-md border-slate-200 shadow-xl">
              <CardHeader>
                <CardTitle>Entrar no portal</CardTitle>
                <CardDescription>Use os dados cadastrados no atendimento DC NET.</CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={login} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="customer-document">CPF/CNPJ</Label>
                    <Input id="customer-document" inputMode="numeric" autoComplete="off" value={document} onChange={(e) => setDocument(e.target.value)} disabled={otpRequested} required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="customer-phone">WhatsApp</Label>
                    <Input id="customer-phone" inputMode="tel" autoComplete="tel" value={phone} onChange={(e) => setPhone(e.target.value)} disabled={otpRequested} required />
                  </div>
                  {otpRequested ? (
                    <div className="space-y-2">
                      <Label htmlFor="customer-otp">Código de 6 dígitos</Label>
                      <Input
                        id="customer-otp"
                        inputMode="numeric"
                        autoComplete="one-time-code"
                        maxLength={6}
                        value={otpCode}
                        onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                        required
                      />
                    </div>
                  ) : null}
                  {loginMessage ? <p className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">{loginMessage}</p> : null}
                  {otpDevCode ? <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">Código de teste: {otpDevCode}</p> : null}
                  {loginError ? <p className="text-sm text-red-600">{loginError}</p> : null}
                  <Button type="submit" className="h-11 w-full bg-emerald-600 hover:bg-emerald-700" disabled={loadingLogin || (otpRequested && otpCode.length !== 6)}>
                    {loadingLogin ? "Aguarde..." : otpRequested ? "Entrar" : "Receber código"}
                  </Button>
                  {otpRequested ? (
                    <Button type="button" variant="ghost" className="h-10 w-full" onClick={resetOtpLogin} disabled={loadingLogin}>
                      Corrigir CPF/CNPJ ou WhatsApp
                    </Button>
                  ) : null}
                </form>
              </CardContent>
            </Card>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50 text-slate-950">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-5 sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:px-8">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-emerald-600">DC NET</p>
            <h1 className="text-2xl font-semibold tracking-tight">{greetingText}</h1>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => setTab("notifications")} className="relative">
              <Bell className="h-4 w-4" />
              {unreadNotifications > 0 ? <span className="ml-1 font-semibold">{unreadNotifications}</span> : null}
            </Button>
            <Button variant="outline" onClick={() => void loadAll()} disabled={loadingData}>Atualizar</Button>
            <Button variant="ghost" onClick={logout}><LogOut className="h-4 w-4" /> Sair</Button>
          </div>
        </div>
      </header>

      <div className="mx-auto grid max-w-7xl gap-5 px-4 py-5 sm:px-6 lg:grid-cols-[240px_1fr] lg:px-8">
        <nav className="flex gap-2 overflow-x-auto rounded-lg border border-slate-200 bg-white p-2 lg:flex-col lg:overflow-visible">
          {tabs.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.key}
                type="button"
                onClick={() => setTab(item.key)}
                className={`flex h-10 shrink-0 items-center gap-2 rounded-md px-3 text-left text-sm font-medium transition ${
                  tab === item.key ? "bg-slate-950 text-white" : "text-slate-600 hover:bg-slate-100 hover:text-slate-950"
                }`}
              >
                <Icon className="h-4 w-4" /> {item.label}
              </button>
            );
          })}
        </nav>

        <section className="space-y-5">
          {dataError ? <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{dataError}</div> : null}
          {tab === "dashboard" ? <DashboardView dashboard={dashboard} executive={executiveDashboard} pppoe={pppoe} pppoeLive={pppoeLive} setTab={setTab} /> : null}
          {tab === "plan" ? <PlanView plan={plan} /> : null}
          {tab === "connection" ? <ConnectionView connection={connection} /> : null}
          {tab === "networkMap" ? <NetworkMapView data={networkMap} /> : null}
          {tab === "pppoe" ? <PppoeView data={pppoe} history={pppoeHistory} live={pppoeLive} livePoints={pppoeLivePoints} liveState={pppoeLiveState} /> : null}
          {tab === "speedTest" ? <SpeedTestView /> : null}
          {tab === "whatsapp" ? <WhatsappView /> : null}
          {tab === "invoices" ? <InvoicesView invoices={invoices} onPayment={(id) => { setSelectedInvoiceId(id); setTab("payment"); }} /> : null}
          {tab === "payment" ? (
            <PaymentView
              invoices={invoices}
              selectedInvoiceId={selectedInvoiceId}
              setSelectedInvoiceId={setSelectedInvoiceId}
              payment={payment}
              loading={loadingPayment}
              copyStatus={copyStatus}
              setCopyStatus={setCopyStatus}
            />
          ) : null}
          {tab === "support" ? (
            <SupportView
              subject={supportSubject}
              message={supportMessage}
              status={supportStatus}
              lastProtocol={lastProtocol}
              loading={openingTicket}
              setSubject={setSupportSubject}
              setMessage={setSupportMessage}
              onSubmit={createTicket}
            />
          ) : null}
          {tab === "tickets" ? (
            <TicketsView
              tickets={tickets}
              selectedTicketId={selectedTicketId}
              setSelectedTicketId={setSelectedTicketId}
              ticketDetail={ticketDetail}
              loadingTickets={loadingTickets}
              loadingTicketDetail={loadingTicketDetail}
            />
          ) : null}
          {tab === "notifications" ? (
            <NotificationsView
              notifications={notifications}
              unreadCount={unreadNotifications}
              loading={loadingNotifications}
              onRefresh={refreshNotifications}
              onRead={markNotificationRead}
              onReadAll={markAllNotificationsRead}
            />
          ) : null}
        </section>
      </div>
    </main>
  );
}

function MetricCard({ title, value, hint, icon: Icon }: { title: string; value: string; hint: string; icon: React.ComponentType<{ className?: string }> }) {
  return (
    <Card>
      <CardContent className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm text-slate-500">{title}</p>
          <p className="mt-2 text-2xl font-semibold tracking-tight">{value}</p>
          <p className="mt-1 text-xs text-slate-500">{hint}</p>
        </div>
        <div className="rounded-lg bg-emerald-50 p-2 text-emerald-700"><Icon className="h-5 w-5" /></div>
      </CardContent>
    </Card>
  );
}

function ExecutiveCard({
  title,
  value,
  hint,
  icon: Icon,
  tone,
}: {
  title: string;
  value: string;
  hint: string;
  icon: React.ComponentType<{ className?: string }>;
  tone: "green" | "red" | "amber" | "slate";
}) {
  const cls = {
    green: "border-emerald-400/30 bg-emerald-400/10 text-emerald-100",
    red: "border-red-400/30 bg-red-400/10 text-red-100",
    amber: "border-amber-400/30 bg-amber-400/10 text-amber-100",
    slate: "border-slate-500/40 bg-white/5 text-slate-100",
  }[tone];
  return (
    <div className={`rounded-lg border p-3 ${cls}`}>
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-medium uppercase text-white/60">{title}</p>
        <Icon className="h-4 w-4 shrink-0" />
      </div>
      <p className="mt-3 truncate text-lg font-semibold tracking-tight text-white">{value}</p>
      <p className="mt-1 truncate text-xs text-white/65">{hint}</p>
    </div>
  );
}

function PremiumMetric({ label, value, hint, icon: Icon }: { label: string; value: string; hint?: string; icon: React.ComponentType<{ className?: string }> }) {
  return (
    <div className="rounded-3xl border border-white/10 bg-white/[0.12] p-4 shadow-lg shadow-slate-950/10 backdrop-blur">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-300">{label}</p>
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-cyan-300/15 text-cyan-100">
          <Icon className="h-4 w-4" />
        </span>
      </div>
      <p className="mt-3 break-words text-lg font-semibold tracking-tight text-white">{value}</p>
      {hint ? <p className="mt-1 text-xs text-slate-300">{hint}</p> : null}
    </div>
  );
}

function PremiumStatusCard({
  title,
  value,
  hint,
  icon: Icon,
  tone,
  onClick,
}: {
  title: string;
  value: string;
  hint: string;
  icon: React.ComponentType<{ className?: string }>;
  tone: "green" | "red" | "amber" | "slate";
  onClick?: () => void;
}) {
  const toneClass = {
    green: "border-emerald-200/80 bg-white shadow-emerald-950/5",
    red: "border-red-200/80 bg-white shadow-red-950/5",
    amber: "border-amber-200/80 bg-white shadow-amber-950/5",
    slate: "border-slate-200 bg-white shadow-slate-950/5",
  }[tone];
  const iconClass = {
    green: "bg-emerald-50 text-emerald-700 ring-emerald-100",
    red: "bg-red-50 text-red-700 ring-red-100",
    amber: "bg-amber-50 text-amber-700 ring-amber-100",
    slate: "bg-slate-950 text-white ring-slate-200",
  }[tone];
  return (
    <button
      type="button"
      onClick={onClick}
      className={`min-h-28 rounded-3xl border px-3.5 py-3 text-left shadow-lg transition hover:-translate-y-0.5 hover:shadow-xl md:min-h-28 xl:min-h-28 ${toneClass}`}
    >
      <div className="flex h-full flex-col justify-between gap-2.5">
        <div className="flex items-start justify-between gap-2.5">
          <div className="min-w-0">
            <p className="text-[11px] font-bold uppercase leading-4 tracking-wide text-[#020617]">{title}</p>
            <p className="mt-1.5 break-words text-lg font-bold leading-5 tracking-tight text-[#020617]">{value}</p>
          </div>
          <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl shadow-sm ring-1 ${iconClass}`}>
            <Icon className="h-4 w-4" />
          </span>
        </div>
        <p className="text-[13px] font-medium leading-4 text-slate-700">{hint}</p>
      </div>
    </button>
  );
}

function DashboardView({
  dashboard,
  executive,
  pppoe,
  pppoeLive,
  setTab,
}: {
  dashboard: Dashboard | null;
  executive: ExecutiveDashboard | null;
  pppoe: PppoeInfo | null;
  pppoeLive: PppoeLive | null;
  setTab: (tab: TabKey) => void;
}) {
  if (!dashboard) return null;
  const summary = executive || {
    client: { fullName: dashboard.client.fullName, status: dashboard.client.status },
    internet: { status: dashboard.connection.status, healthScore: dashboard.connection.networkNode?.healthScore ?? null },
    plan: { name: dashboard.plan?.name || "", speed: dashboard.plan?.speedMbps ? `${dashboard.plan.speedMbps} Mbps` : "" },
    billing: { pendingInvoices: dashboard.financialSummary.openInvoices, nextDueDate: dashboard.mainDueDate, overdueInvoices: dashboard.financialSummary.overdueInvoices },
    support: { openTickets: 0 },
    notifications: { unreadCount: 0 },
    connection: { lastUpdateAt: dashboard.connection.lastUpdateAt || dashboard.connection.lastSession?.sampledAt || null },
  };
  const greetingText = customerGreeting(summary.client.fullName);
  const planName = summary.plan.name || dashboard.plan?.name || "Atualizando informações";
  const planSpeed = summary.plan.speed || (dashboard.plan?.speedMbps ? `${dashboard.plan.speedMbps} Mbps` : "Atualizando informações");
  const internetTone = toneForStatus(summary.internet.status);
  const connectionStatus = statusLabel(summary.internet.status);
  const ping = pppoeLive?.pingMs ?? pppoe?.quality?.pingMs ?? null;
  const currentIp = pppoeLive?.currentIp || pppoe?.currentIp || "Atualizando informações";
  const uptime = pppoeLive?.uptime || pppoe?.uptime || "Atualizando informações";
  const lastUpdate = summary.connection.lastUpdateAt || pppoeLive?.lastUpdateAt || pppoe?.lastUpdateAt || null;
  const healthScore = scoreText(summary.internet.healthScore);
  const nextInvoice = dashboard.financialSummary.nextInvoice;
  const nextInvoiceValue = nextInvoice ? money(nextInvoice.amount) : date(summary.billing.nextDueDate);
  const nextInvoiceHint = nextInvoice
    ? `Vence em ${date(nextInvoice.dueDate)}`
    : summary.billing.nextDueDate ? "Próxima fatura" : "Sem fatura em aberto";

  return (
    <div className="space-y-5">
      <section className="overflow-hidden rounded-[32px] border border-slate-900/10 bg-slate-950 text-white shadow-2xl shadow-slate-950/15">
        <div className="relative isolate p-5 sm:p-6 lg:p-6">
          <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_12%_8%,rgba(16,185,129,0.42),transparent_34%),radial-gradient(circle_at_88%_10%,rgba(34,211,238,0.28),transparent_30%),linear-gradient(135deg,#020617_0%,#071426_48%,#064e3b_100%)]" />
          <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
            <div className="max-w-2xl">
              <p className="text-sm font-semibold uppercase tracking-wide text-emerald-200">Seu portal DC NET</p>
              <p className="mt-1 text-sm font-medium text-slate-300">{greetingText}</p>
              <div className="mt-3 flex flex-wrap items-center gap-3">
                <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">Sua Internet</h2>
                <Badge tone={internetTone}>{connectionStatus}</Badge>
              </div>
              <p className="mt-3 max-w-xl text-sm leading-6 text-slate-300">Sua internet DC NET em destaque, com plano, velocidade e qualidade da conexão.</p>
            </div>
            <div className="rounded-3xl border border-white/10 bg-white/10 p-4 text-left shadow-lg shadow-slate-950/10 backdrop-blur lg:min-w-72">
              <div className="flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-300">Seu plano</p>
                  <p className="mt-2 break-words text-xl font-semibold tracking-tight text-white">{planName}</p>
                  <p className="mt-1 text-sm text-emerald-200">{planSpeed}</p>
                </div>
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-emerald-300/15 text-emerald-100 ring-1 ring-white/10">
                  <ShieldCheck className="h-5 w-5" />
                </span>
              </div>
            </div>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <PremiumMetric label="Ping" value={latencyValue(ping)} hint="Latência" icon={TimerReset} />
            <PremiumMetric label="Sua identificação" value={currentIp} hint="Qualidade da conexão" icon={Globe2} />
            <PremiumMetric label="Tempo conectado" value={uptime} hint="Tempo conectado" icon={Clock} />
            <PremiumMetric label="Última consulta" value={dateTime(lastUpdate)} hint="Última consulta" icon={Activity} />
          </div>
        </div>
      </section>

      <section className="grid auto-rows-fr gap-4 md:grid-cols-2 xl:grid-cols-5">
        <PremiumStatusCard title="Próxima fatura" value={nextInvoiceValue} hint={nextInvoiceHint} icon={CalendarDays} tone={summary.billing.overdueInvoices > 0 ? "red" : summary.billing.pendingInvoices > 0 ? "amber" : "green"} onClick={() => setTab("payment")} />
        <PremiumStatusCard title="Pagamentos" value={`${summary.billing.pendingInvoices} pendente(s)`} hint={`${summary.billing.overdueInvoices} vencida(s)`} icon={Banknote} tone={billingTone(summary.billing.pendingInvoices, summary.billing.overdueInvoices)} onClick={() => setTab("invoices")} />
        <PremiumStatusCard title="Suporte" value={String(summary.support.openTickets)} hint="Abertos ou em atendimento" icon={Headphones} tone={summary.support.openTickets > 0 ? "amber" : "green"} onClick={() => setTab("tickets")} />
        <PremiumStatusCard title="Avisos" value={String(summary.notifications?.unreadCount || 0)} hint="Não lidos" icon={Bell} tone={(summary.notifications?.unreadCount || 0) > 0 ? "amber" : "green"} onClick={() => setTab("notifications")} />
        <PremiumStatusCard title="Rede" value={healthScore} hint="Tudo funcionando normalmente" icon={Activity} tone={healthTone(summary.internet.healthScore)} onClick={() => setTab("connection")} />
      </section>

      <Card className="rounded-3xl border-slate-200 shadow-sm">
        <CardHeader>
          <CardTitle>WhatsApp Oficial DC NET</CardTitle>
          <CardDescription>Atendimento automático e suporte.</CardDescription>
        </CardHeader>
        <CardContent>
          <Button className="h-11 rounded-2xl bg-emerald-600 hover:bg-emerald-700" onClick={openOfficialWhatsapp}>
            <PhoneCall className="h-4 w-4" /> Falar no WhatsApp
          </Button>
        </CardContent>
      </Card>

      <Card className="rounded-3xl border-slate-200 shadow-sm">
        <CardHeader>
          <CardTitle>Atalhos</CardTitle>
          <CardDescription>Acesse as áreas mais usadas do portal.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Button variant="outline" className="h-12 justify-start rounded-2xl" onClick={() => setTab("invoices")}><FileText className="h-4 w-4" /> Faturas</Button>
          <Button variant="outline" className="h-12 justify-start rounded-2xl" onClick={() => setTab("payment")}><CreditCard className="h-4 w-4" /> PIX / Segunda Via</Button>
          <Button variant="outline" className="h-12 justify-start rounded-2xl" onClick={() => setTab("support")}><Headphones className="h-4 w-4" /> Suporte</Button>
          <Button variant="outline" className="h-12 justify-start rounded-2xl" onClick={() => setTab("whatsapp")}><PhoneCall className="h-4 w-4" /> WhatsApp</Button>
          <Button variant="outline" className="h-12 justify-start rounded-2xl" onClick={() => setTab("speedTest")}><Gauge className="h-4 w-4" /> Speed Test</Button>
          <Button variant="outline" className="h-12 justify-start rounded-2xl" onClick={() => setTab("pppoe")}><Router className="h-4 w-4" /> Sua Internet</Button>
          <Button variant="outline" className="h-12 justify-start rounded-2xl" onClick={() => setTab("connection")}><Wifi className="h-4 w-4" /> Minha Conexão</Button>
          <Button variant="outline" className="h-12 justify-start rounded-2xl" onClick={() => setTab("networkMap")}><Globe2 className="h-4 w-4" /> Mapa da Conexão</Button>
        </CardContent>
      </Card>
      {dashboard.alerts.length ? (
        <Card className="rounded-3xl border-amber-200 shadow-sm">
          <CardHeader><CardTitle>Alertas</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {dashboard.alerts.map((alert) => <div key={`${alert.type}-${alert.message}`} className="rounded-2xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">{alert.message}</div>)}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}

function WhatsappView() {
  return (
    <div className="space-y-5">
      <Card className="overflow-hidden border-slate-200 bg-slate-950 text-white">
        <CardContent className="grid gap-6 p-5 sm:p-6 md:grid-cols-[1fr_auto] md:items-center">
          <div>
            <div className="inline-flex h-11 w-11 items-center justify-center rounded-lg bg-emerald-500/15 text-emerald-300">
              <PhoneCall className="h-5 w-5" />
            </div>
            <h2 className="mt-4 text-2xl font-semibold tracking-tight">WhatsApp Oficial DC NET</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300">Atendimento rápido através do WhatsApp oficial da DC NET.</p>
          </div>
          <Button className="h-11 bg-emerald-600 hover:bg-emerald-700" onClick={openOfficialWhatsapp}>
            <PhoneCall className="h-4 w-4" /> Falar no WhatsApp
          </Button>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Canal oficial</CardTitle>
          <CardDescription>Número oficial da DC NET para atendimento.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm text-slate-500">WhatsApp</p>
            <p className="mt-1 text-2xl font-semibold tracking-tight text-slate-950">(61) 99662-7145</p>
          </div>
          <Button className="h-11 bg-emerald-600 hover:bg-emerald-700" onClick={openOfficialWhatsapp}>
            <PhoneCall className="h-4 w-4" /> Falar no WhatsApp
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

function PlanView({ plan }: { plan: PlanResponse | null }) {
  return (
    <Card>
      <CardHeader><CardTitle>Meu Plano</CardTitle><CardDescription>Informações comerciais do plano contratado.</CardDescription></CardHeader>
      <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard title="Plano" value={plan?.plan?.name || "-"} hint="Nome comercial" icon={ShieldCheck} />
        <MetricCard title="Velocidade" value={`${plan?.speedMbps || 0} Mbps`} hint={plan?.plan?.mikrotik?.rateLimit || "Velocidade contratada"} icon={Wifi} />
        <MetricCard title="Valor" value={money(plan?.amount)} hint="Mensalidade atual" icon={Banknote} />
        <MetricCard title="Vencimento" value={plan?.dueDay ? `Dia ${plan.dueDay}` : "-"} hint={statusLabel(plan?.status)} icon={FileText} />
      </CardContent>
    </Card>
  );
}

function NetworkMapView({ data }: { data: CustomerNetworkMap | null }) {
  if (!data) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Mapa da Conexão</CardTitle>
          <CardDescription>Carregando caminho da sua conexão.</CardDescription>
        </CardHeader>
        <CardContent><p className="text-sm text-slate-500">Aguarde...</p></CardContent>
      </Card>
    );
  }

  const statusTone = toneForStatus(data.status);

  return (
    <div className="space-y-5">
      <Card className="overflow-hidden border-slate-200 bg-slate-950 text-white">
        <CardContent className="space-y-5 p-5 sm:p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-sm font-medium text-emerald-300">Mapa da Conexão</p>
              <h2 className="mt-1 text-2xl font-semibold tracking-tight">Caminho até sua internet</h2>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300">Visão simplificada e segura do trajeto da sua conexão DC NET.</p>
            </div>
            <Badge tone={statusTone}>{statusLabel(data.status)}</Badge>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-lg border border-white/10 bg-white/5 p-4">
              <p className="text-sm text-slate-300">Última consulta</p>
              <p className="mt-2 text-lg font-semibold">{dateTime(data.lastUpdateAt)}</p>
            </div>
            <div className="rounded-lg border border-white/10 bg-white/5 p-4">
              <p className="text-sm text-slate-300">Fonte</p>
              <p className="mt-2 text-lg font-semibold">{data.source === "fallback" ? "Mapa simplificado" : "Consulta DC NET"}</p>
            </div>
            <div className="rounded-lg border border-white/10 bg-white/5 p-4">
              <p className="text-sm text-slate-300">Cliente</p>
              <p className="mt-2 text-lg font-semibold">{data.client?.name || "Cliente"}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {data.message ? (
        <div className="flex gap-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{data.message}</span>
        </div>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Caminho visual</CardTitle>
          <CardDescription>Resumo simples do caminho da sua internet até sua casa.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="mx-auto max-w-3xl">
            {(data.path || []).map((item, index) => {
              const Icon = networkMapIcon(item.type);
              const next = data.path[index + 1];
              const lineStatus = next ? worseStatusForUi(item.status, next.status) : item.status;
              return (
                <div key={item.type + "-" + index} className="flex flex-col items-center text-center">
                  <div className={"flex w-full items-center gap-4 rounded-lg border p-4 shadow-sm " + networkNodeClass(item.status)}>
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-white/70">
                      <Icon className="h-5 w-5" />
                    </div>
                    <div className="min-w-0 flex-1 text-left">
                      <p className="truncate text-base font-semibold text-slate-950">{friendlyNetworkLabel(item.label, item.type)}</p>
                      <p className="mt-1 text-sm text-slate-500">{statusLabel(item.status)}</p>
                    </div>
                    <Badge tone={toneForStatus(item.status)}>{statusLabel(item.status)}</Badge>
                  </div>
                  {index < data.path.length - 1 ? <div className={"h-8 w-1 " + networkLineClass(lineStatus)} /> : null}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Qualidade</CardTitle>
          <CardDescription>Qualidade da conexão disponível agora.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-3">
          <MetricCard title="Ping" value={latencyValue(data.quality?.pingMs)} hint="Latência" icon={TimerReset} />
          <MetricCard title="Jitter" value={latencyValue(data.quality?.jitterMs)} hint="Variação" icon={Activity} />
          <MetricCard title="Perda" value={data.quality?.packetLoss == null ? "-" : Number(data.quality.packetLoss).toFixed(1) + "%"} hint="Estabilidade" icon={ShieldCheck} />
        </CardContent>
      </Card>
    </div>
  );
}

function ConnectionView({ connection }: { connection: ConnectionInfo | null }) {
  if (!connection) return null;
  const plan = connection.plan;
  const speed = plan?.speedMbps ? `${plan.speedMbps} Mbps` : "Atualizando informações";
  const equipment = connection.server?.name || connection.networkNode?.name || "Atualizando informações";
  const lastUpdate = connection.lastUpdateAt || connection.lastSignal?.sampledAt || connection.lastSession?.sampledAt || connection.networkNode?.agentLastSeenAt || null;
  const traffic = connection.lastSignal?.totalRxMbps != null || connection.lastSignal?.totalTxMbps != null
    ? `${metricValue(connection.lastSignal?.totalRxMbps, " Mbps")} down · ${metricValue(connection.lastSignal?.totalTxMbps, " Mbps")} up`
    : "Atualizando informações";

  return (
    <div className="space-y-5">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <Card>
          <CardContent className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm text-slate-500">Sua Internet</p>
              <div className="mt-2"><Badge tone={connectionTone(connection)}>{statusLabel(connection.status)}</Badge></div>
              <p className="mt-3 text-sm text-slate-600">{connectionMessage(connection.status)}</p>
            </div>
            <div className="rounded-lg bg-emerald-50 p-2 text-emerald-700"><Wifi className="h-5 w-5" /></div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm text-slate-500">Seu plano</p>
              <p className="mt-2 text-xl font-semibold tracking-tight text-slate-950">{plan?.name || "Atualizando informações"}</p>
              <p className="mt-1 text-sm text-slate-500">{speed}</p>
            </div>
            <div className="rounded-lg bg-emerald-50 p-2 text-emerald-700"><ShieldCheck className="h-5 w-5" /></div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm text-slate-500">Sua identificação</p>
              <p className="mt-2 text-xl font-semibold tracking-tight text-slate-950">{connection.access?.usernameMasked || "Atualizando informações"}</p>
              <p className="mt-1 text-sm text-slate-500">{"Acesso do cliente"}</p>
            </div>
            <div className="rounded-lg bg-emerald-50 p-2 text-emerald-700"><UserRound className="h-5 w-5" /></div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm text-slate-500">Ponto de conexão</p>
              <p className="mt-2 text-xl font-semibold tracking-tight text-slate-950">{equipment}</p>
              <p className="mt-1 text-sm text-slate-500">{connection.networkNode?.healthLevel ? healthLabel(connection.networkNode.healthLevel) : "Tudo funcionando normalmente"}</p>
            </div>
            <div className="rounded-lg bg-emerald-50 p-2 text-emerald-700"><Router className="h-5 w-5" /></div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm text-slate-500">Última consulta</p>
              <p className="mt-2 text-xl font-semibold tracking-tight text-slate-950">{dateTime(lastUpdate)}</p>
              <p className="mt-1 text-sm text-slate-500">{connection.lastSignal ? "Tudo funcionando normalmente" : "Atualizando informações"}</p>
            </div>
            <div className="rounded-lg bg-emerald-50 p-2 text-emerald-700"><Clock className="h-5 w-5" /></div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm text-slate-500">Qualidade da conexão</p>
              <p className="mt-2 text-xl font-semibold tracking-tight text-slate-950">{metricValue(connection.lastSession?.activePppTotal ?? connection.lastSignal?.pppOnline)}</p>
              <p className="mt-1 text-sm text-slate-500">Conexão ativa · {traffic}</p>
            </div>
            <div className="rounded-lg bg-emerald-50 p-2 text-emerald-700"><Activity className="h-5 w-5" /></div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Alertas</CardTitle>
          <CardDescription>Central de avisos da sua internet.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {connection.alerts?.length ? connection.alerts.map((alert) => (
            <div key={`${alert.type}-${alert.message}`} className="flex gap-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{alert.message}</span>
            </div>
          )) : <p className="text-sm text-slate-500">Tudo funcionando normalmente.</p>}
        </CardContent>
      </Card>
    </div>
  );
}

function PppoeLivePanel({ live, points, state }: { live: PppoeLive | null; points: PppoeLivePoint[]; state: PppoeLiveState }) {
  const hasChartPoints = points.length > 0;
  const statusTone = toneForStatus(live?.status);
  const noticeClass = state === "error"
    ? "border-amber-200 bg-amber-50 text-amber-800"
    : "border-slate-200 bg-slate-50 text-slate-600";

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <CardTitle>Sua Internet agora</CardTitle>
            <CardDescription>Atualizando informações da sua conexão automaticamente.</CardDescription>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-sm text-slate-500">
            <Badge tone={statusTone}>{statusLabel(live?.status)}</Badge>
            <span>{liveStatusText(state, live)}</span>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        {state === "error" || live?.message ? (
          <div className={"flex gap-3 rounded-lg border p-3 text-sm " + noticeClass}>
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{state === "error" ? "Não foi possível atualizar agora. A última informação foi mantida." : live?.message}</span>
          </div>
        ) : null}

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <MetricCard title="Download atual" value={speedValue(live?.downloadMbps)} hint="Última consulta" icon={Download} />
          <MetricCard title="Upload atual" value={speedValue(live?.uploadMbps)} hint="Última consulta" icon={Upload} />
          <MetricCard title="Ping" value={latencyValue(live?.pingMs)} hint="Qualidade da conexão" icon={TimerReset} />
          <MetricCard title="Jitter" value={latencyValue(live?.jitterMs)} hint="Variação de latência" icon={Activity} />
          <MetricCard title="Sua identificação" value={live?.currentIp || "-"} hint="Qualidade da conexão" icon={Wifi} />
          <MetricCard title="Tempo conectado" value={live?.uptime || "-"} hint={live?.lastUpdateAt ? "Última consulta em " + dateTime(live.lastUpdateAt) : "Atualizando informações"} icon={Clock} />
        </div>

        {hasChartPoints ? (
          <div className="h-72 min-h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={points} margin={{ top: 12, right: 16, left: 0, bottom: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="time" tickLine={false} axisLine={false} />
                <YAxis tickLine={false} axisLine={false} width={44} />
                <Tooltip formatter={(value) => speedValue(Number(value))} />
                <Line type="monotone" dataKey="downloadMbps" name="Download" stroke="#10b981" strokeWidth={2} dot={false} connectNulls />
                <Line type="monotone" dataKey="uploadMbps" name="Upload" stroke="#0f172a" strokeWidth={2} dot={false} connectNulls />
              </LineChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-5 text-center text-sm text-slate-500">
            <Activity className="mx-auto mb-2 h-6 w-6 text-slate-400" />
            Estamos atualizando as informações para montar o gráfico.
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function PppoeConsumptionChart({ title, description, data }: { title: string; description: string; data: PppoeHistory["series7d"] }) {
  if (!hasUsageSeries(data)) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-5 text-center text-sm text-slate-500">
            <Activity className="mx-auto mb-2 h-6 w-6 text-slate-400" />
            Estamos atualizando seu histórico de consumo.
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="h-72 min-h-72 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ top: 12, right: 16, left: 0, bottom: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="date" tickLine={false} axisLine={false} />
              <YAxis tickLine={false} axisLine={false} width={44} />
              <Tooltip formatter={(value) => dataGb(Number(value))} />
              <Line type="monotone" dataKey="downloadGB" name="Download" stroke="#10b981" strokeWidth={2} dot={false} connectNulls />
              <Line type="monotone" dataKey="uploadGB" name="Upload" stroke="#0f172a" strokeWidth={2} dot={false} connectNulls />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
function PppoeView({
  data,
  history,
  live,
  livePoints,
  liveState,
}: {
  data: PppoeInfo | null;
  history: PppoeHistory | null;
  live: PppoeLive | null;
  livePoints: PppoeLivePoint[];
  liveState: PppoeLiveState;
}) {
  if (!data) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Sua Internet</CardTitle>
          <CardDescription>Atualizando informações da sua internet.</CardDescription>
        </CardHeader>
        <CardContent><p className="text-sm text-slate-500">Aguarde...</p></CardContent>
      </Card>
    );
  }

  const chartData = (data.series || []).filter((item) => item.downloadMbps != null || item.uploadMbps != null);
  const statusTone = toneForStatus(data.status);

  return (
    <div className="space-y-5">
      <Card className="border-slate-200 bg-slate-950 text-white">
        <CardContent className="space-y-5 p-5 sm:p-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-sm font-medium text-emerald-300">Sua Internet</p>
              <h2 className="mt-1 text-2xl font-semibold tracking-tight">Qualidade da conexão</h2>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300">Informações da sua última consulta disponível.</p>
            </div>
            <Badge tone={statusTone}>{statusLabel(data.status)}</Badge>
          </div>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <ExecutiveCard title="Sua identificação" value={data.usernameMasked || "-"} hint="Dados protegidos" icon={UserRound} tone="slate" />
            <ExecutiveCard title="Sua identificação" value={data.currentIp || "-"} hint="Última consulta" icon={Wifi} tone={data.currentIp ? "green" : "slate"} />
            <ExecutiveCard title="Ponto de conexão" value={data.serverName || "-"} hint="Tudo funcionando normalmente" icon={Router} tone={data.serverName ? "green" : "slate"} />
            <ExecutiveCard title="Conectado" value={data.uptime || "-"} hint={data.connectedAt ? dateTime(data.connectedAt) : "Tempo conectado"} icon={Clock} tone={data.uptime ? "green" : "slate"} />
          </div>
        </CardContent>
      </Card>

      <PppoeLivePanel live={live} points={livePoints} state={liveState} />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard title="Download atual" value={speedValue(data.trafficNow?.downloadMbps)} hint="Última consulta" icon={Download} />
        <MetricCard title="Upload atual" value={speedValue(data.trafficNow?.uploadMbps)} hint="Última consulta" icon={Upload} />
        <MetricCard title="Ping" value={latencyValue(data.quality?.pingMs)} hint="Qualidade da conexão" icon={TimerReset} />
        <MetricCard title="Jitter" value={latencyValue(data.quality?.jitterMs)} hint="Variação de latência" icon={Activity} />
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <CardTitle>Uso da sua internet</CardTitle>
              <CardDescription>Histórico recente de download e upload da sua internet.</CardDescription>
            </div>
            <span className="text-sm text-slate-500">Última consulta em {dateTime(data.lastUpdateAt)}</span>
          </div>
        </CardHeader>
        <CardContent>
          {chartData.length ? (
            <div className="h-72 min-h-72 w-full">
              <ResponsiveContainer width="100%" height="100%" minHeight={260}>
                <LineChart data={chartData} margin={{ top: 12, right: 16, left: 0, bottom: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="time" tickLine={false} axisLine={false} />
                  <YAxis tickLine={false} axisLine={false} width={44} />
                  <Tooltip />
                  <Line type="monotone" dataKey="downloadMbps" name="Download Mbps" stroke="#10b981" strokeWidth={2} dot={false} connectNulls />
                  <Line type="monotone" dataKey="uploadMbps" name="Upload Mbps" stroke="#0f172a" strokeWidth={2} dot={false} connectNulls />
                </LineChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-5 text-center text-sm text-slate-500">
              <Activity className="mx-auto mb-2 h-6 w-6 text-slate-400" />
              Atualizando informações para o gráfico.
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Histórico de Consumo</CardTitle>
          <CardDescription>{history?.message || "Consumo calculado com as informações disponíveis."}</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <MetricCard title="Download Hoje" value={dataGb(history?.today.downloadGB)} hint="Consumo recebido hoje" icon={Download} />
          <MetricCard title="Upload Hoje" value={dataGb(history?.today.uploadGB)} hint="Consumo enviado hoje" icon={Upload} />
          <MetricCard title="Total Hoje" value={dataGb(history?.today.totalGB)} hint="Download + upload" icon={Activity} />
          <MetricCard title="Download Mês" value={dataGb(history?.month.downloadGB)} hint="Acumulado do mês" icon={Download} />
          <MetricCard title="Upload Mês" value={dataGb(history?.month.uploadGB)} hint="Acumulado do mês" icon={Upload} />
          <MetricCard title="Total Mês" value={dataGb(history?.month.totalGB)} hint="Download + upload" icon={Activity} />
        </CardContent>
      </Card>

      <div className="grid gap-5 xl:grid-cols-2">
        <PppoeConsumptionChart
          title="Consumo dos últimos 7 dias"
          description="Download e upload por dia."
          data={history?.series7d || []}
        />
        <PppoeConsumptionChart
          title="Consumo dos últimos 30 dias"
          description="Visão diária do consumo no mês."
          data={history?.series30d || []}
        />
      </div>
      <Card>
        <CardHeader><CardTitle>Alertas</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {data.alerts?.length ? data.alerts.map((alert) => (
            <div key={`${alert.type}-${alert.message}`} className="flex gap-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{alert.message}</span>
            </div>
          )) : <p className="text-sm text-slate-500">Tudo funcionando normalmente no momento.</p>}
        </CardContent>
      </Card>
    </div>
  );
}
function SpeedTestMetricCard({
  title,
  value,
  hint,
  icon: Icon,
  loading,
}: {
  title: string;
  value: string;
  hint: string;
  icon: React.ComponentType<{ className?: string }>;
  loading: boolean;
}) {
  return (
    <Card className="border-slate-200">
      <CardContent className="flex min-h-32 items-start justify-between gap-4 p-4 sm:p-5">
        <div className="min-w-0">
          <p className="text-sm text-slate-500">{title}</p>
          {loading ? (
            <div className="mt-3 h-8 w-28 animate-pulse rounded-md bg-slate-200" />
          ) : (
            <p className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">{value}</p>
          )}
          <p className="mt-2 text-xs text-slate-500">{loading ? "Medindo..." : hint}</p>
        </div>
        <div className="rounded-lg bg-emerald-50 p-2 text-emerald-700">
          <Icon className={`h-5 w-5 ${loading ? "animate-pulse" : ""}`} />
        </div>
      </CardContent>
    </Card>
  );
}

function SpeedTestView() {
  const [history, setHistory] = useState<SpeedTestResult[]>([]);
  const [running, setRunning] = useState(false);
  const [step, setStep] = useState<SpeedTestStep>("idle");
  const [error, setError] = useState("");
  const latest = history[0] || null;
  const progressText: Record<SpeedTestStep, string> = {
    idle: "Pronto para iniciar",
    ping: "Medindo ping",
    download: "Medindo download",
    upload: "Medindo upload",
    finishing: "Finalizando",
  };

  useEffect(() => {
    setHistory(readSpeedTestHistory());
  }, []);

  async function executeTest() {
    setRunning(true);
    setError("");
    try {
      const result = await runCustomerSpeedTest(setStep);
      setHistory((current) => {
        const next = [result, ...current].slice(0, 10);
        saveSpeedTestHistory(next);
        return next;
      });
    } catch (err) {
      setError(speedTestErrorMessage(err));
    } finally {
      setRunning(false);
      setStep("idle");
    }
  }

  return (
    <div className="space-y-5">
      <Card className="border-slate-200 bg-slate-950 text-white">
        <CardContent className="flex flex-col gap-5 p-5 sm:p-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 rounded-full border border-emerald-400/30 bg-emerald-400/10 px-3 py-1 text-sm font-medium text-emerald-200">
              <Gauge className="h-4 w-4" /> Speed Test DC NET
            </div>
            <h2 className="text-2xl font-semibold tracking-tight">Teste sua conexão agora</h2>
            <p className="max-w-2xl text-sm leading-6 text-slate-300">
              Execute uma medição real pela DC NET e acompanhe seus últimos resultados neste aparelho.
            </p>
          </div>
          <Button onClick={() => void executeTest()} disabled={running} className="h-11 bg-emerald-600 hover:bg-emerald-700 lg:min-w-44">
            <Activity className={`h-4 w-4 ${running ? "animate-spin" : ""}`} /> {running ? progressText[step] : "Executar Teste"}
          </Button>
        </CardContent>
      </Card>

      {running ? (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm font-medium text-emerald-800">
          {progressText[step]}...
        </div>
      ) : null}

      {error ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
          <p className="font-medium">Não foi possível concluir o Speed Test.</p>
          <p className="mt-1">{error}</p>
          {latest ? <p className="mt-1 text-xs">Mantendo o último resultado salvo como referência visual.</p> : null}
        </div>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <SpeedTestMetricCard title="Download" value={speedValue(latest?.downloadMbps)} hint="Velocidade de recebimento" icon={Download} loading={running} />
        <SpeedTestMetricCard title="Upload" value={speedValue(latest?.uploadMbps)} hint="Velocidade de envio" icon={Upload} loading={running} />
        <SpeedTestMetricCard title="Ping" value={latencyValue(latest?.pingMs)} hint="Tempo de resposta" icon={TimerReset} loading={running} />
        <SpeedTestMetricCard title="Jitter" value={latencyValue(latest?.jitterMs)} hint="Variação de latência" icon={Activity} loading={running} />
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <CardTitle>Histórico local</CardTitle>
              <CardDescription>Últimos 10 testes salvos neste dispositivo.</CardDescription>
            </div>
            {latest ? <Badge tone="green">Último teste {dateTime(latest.createdAt)}</Badge> : null}
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {!history.length ? (
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-5 text-center text-sm text-slate-500">
              <Gauge className="mx-auto mb-2 h-6 w-6 text-slate-400" />
              Nenhum teste executado neste aparelho
            </div>
          ) : null}
          {history.map((item) => (
            <div key={item.id} className="grid gap-3 rounded-lg border border-slate-200 p-3 text-sm sm:grid-cols-[1.2fr_repeat(4,0.8fr)] sm:items-center">
              <div>
                <p className="font-medium text-slate-950">{dateTime(item.createdAt)}</p>
                <p className="mt-1 text-xs text-slate-500">DC NET</p>
              </div>
              <div><p className="text-xs text-slate-500">Download</p><p className="font-semibold text-slate-950">{speedValue(item.downloadMbps)}</p></div>
              <div><p className="text-xs text-slate-500">Upload</p><p className="font-semibold text-slate-950">{speedValue(item.uploadMbps)}</p></div>
              <div><p className="text-xs text-slate-500">Ping</p><p className="font-semibold text-slate-950">{latencyValue(item.pingMs)}</p></div>
              <div><p className="text-xs text-slate-500">Jitter</p><p className="font-semibold text-slate-950">{latencyValue(item.jitterMs)}</p></div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
function InvoicesView({ invoices, onPayment }: { invoices: InvoiceItem[]; onPayment: (id: string) => void }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Minhas Faturas</CardTitle>
        <CardDescription>Status, valores e disponibilidade de segunda via.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {invoices.map((invoice) => {
          const available = invoice.hasBillingInvoice;
          return (
            <div key={invoice._id} className="flex flex-col gap-3 rounded-lg border border-slate-200 p-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-medium">{invoice.competence || invoice.description || "Fatura"}</p>
                  <Badge tone={toneForStatus(invoice.status)}>{statusLabel(invoice.status)}</Badge>
                </div>
                <p className="mt-1 text-sm text-slate-500">Vencimento {date(invoice.dueDate)} · {money(invoice.amount)}</p>
                <p className={`mt-1 text-xs ${available ? "text-emerald-700" : "text-slate-500"}`}>
                  {invoicePaymentMessage(invoice)}
                </p>
              </div>
              <Button variant="outline" size="sm" onClick={() => onPayment(invoice._id)} disabled={!isPayableInvoice(invoice) && !available}>
                {available ? "Ver pagamento" : "Detalhes"}
              </Button>
            </div>
          );
        })}
        {!invoices.length ? <p className="text-sm text-slate-500">Nenhuma fatura encontrada.</p> : null}
      </CardContent>
    </Card>
  );
}

function PaymentView({
  invoices,
  selectedInvoiceId,
  setSelectedInvoiceId,
  payment,
  loading,
  copyStatus,
  setCopyStatus,
}: {
  invoices: InvoiceItem[];
  selectedInvoiceId: string;
  setSelectedInvoiceId: (id: string) => void;
  payment: PaymentResponse | null;
  loading: boolean;
  copyStatus: string;
  setCopyStatus: (value: string) => void;
}) {
  const payableInvoices = invoices.filter(isPayableInvoice);
  const selectedInvoice = invoices.find((invoice) => invoice._id === selectedInvoiceId) || payment?.invoice || null;
  const copyText = payment?.payment?.pixCopyPaste || payment?.payment?.pixPayload || "";
  const paymentAvailable = Boolean(payment?.payment);

  async function copyPix() {
    if (!copyText) return;
    await navigator.clipboard.writeText(copyText);
    setCopyStatus("PIX copiado");
    window.setTimeout(() => setCopyStatus(""), 2500);
  }

  return (
    <div className="grid gap-5 xl:grid-cols-[0.95fr_1.05fr]">
      <Card>
        <CardHeader>
          <CardTitle>PIX / Segunda Via</CardTitle>
          <CardDescription>Faturas pendentes e vencidas disponíveis para consulta.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {payableInvoices.map((invoice) => (
            <button
              type="button"
              key={invoice._id}
              onClick={() => setSelectedInvoiceId(invoice._id)}
              className={`w-full rounded-lg border p-3 text-left transition ${
                selectedInvoiceId === invoice._id ? "border-emerald-300 bg-emerald-50" : "border-slate-200 bg-white hover:bg-slate-50"
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-medium">{invoice.competence || invoice.description || "Fatura"}</p>
                  <p className="mt-1 text-sm text-slate-500">{money(invoice.amount)} · vence em {date(invoice.dueDate)}</p>
                  <p className={`mt-1 text-xs ${invoice.hasBillingInvoice ? "text-emerald-700" : "text-slate-500"}`}>
                    {invoice.hasBillingInvoice ? "Pagamento disponível" : "Segunda via ainda não gerada"}
                  </p>
                </div>
                <Badge tone={toneForStatus(invoice.status)}>{statusLabel(invoice.status)}</Badge>
              </div>
              <span className="mt-3 inline-flex h-8 items-center rounded-md border border-slate-200 bg-white px-3 text-xs font-medium text-slate-700">
                Ver pagamento
              </span>
            </button>
          ))}
          {!payableInvoices.length ? <p className="text-sm text-slate-500">Nenhuma fatura pendente ou vencida no momento.</p> : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Dados de pagamento</CardTitle>
          <CardDescription>Use apenas os dados exibidos para a fatura selecionada.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {!selectedInvoice ? <p className="text-sm text-slate-500">Selecione uma fatura para ver PIX ou segunda via.</p> : null}
          {selectedInvoice ? (
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-lg border border-slate-200 p-3">
                <p className="text-xs text-slate-500">Valor</p>
                <p className="mt-1 font-semibold">{money(selectedInvoice.amount)}</p>
              </div>
              <div className="rounded-lg border border-slate-200 p-3">
                <p className="text-xs text-slate-500">Vencimento</p>
                <p className="mt-1 font-semibold">{date(selectedInvoice.dueDate)}</p>
              </div>
              <div className="rounded-lg border border-slate-200 p-3">
                <p className="text-xs text-slate-500">Status</p>
                <div className="mt-1"><Badge tone={toneForStatus(selectedInvoice.status)}>{statusLabel(selectedInvoice.status)}</Badge></div>
              </div>
            </div>
          ) : null}

          {loading ? <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">Carregando pagamento...</div> : null}

          {!loading && selectedInvoice && !paymentAvailable ? (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
              Segunda via ainda não gerada para esta fatura. O portal não emite nova cobrança nesta fase.
            </div>
          ) : null}

          {!loading && paymentAvailable ? (
            <div className="space-y-4">
              {payment?.payment?.pixQrCodeUrl ? (
                <div className="flex items-center gap-4 rounded-lg border border-slate-200 p-3">
                  <div
                    role="img"
                    aria-label="QR Code PIX"
                    className="h-28 w-28 rounded-md border border-slate-200 bg-white bg-contain bg-center bg-no-repeat"
                    style={{ backgroundImage: `url(${payment.payment.pixQrCodeUrl})` }}
                  />
                  <div>
                    <div className="flex items-center gap-2 text-sm font-medium text-slate-900"><QrCode className="h-4 w-4" /> QR Code PIX</div>
                    <p className="mt-1 text-sm text-slate-500">Aponte a câmera do banco para pagar.</p>
                  </div>
                </div>
              ) : null}

              <div>
                <div className="mb-2 flex items-center justify-between gap-2">
                  <p className="text-sm font-medium text-slate-900">Código PIX copia e cola</p>
                  {copyStatus ? <span className="text-xs font-medium text-emerald-700">{copyStatus}</span> : null}
                </div>
                <div className="max-h-36 overflow-auto rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm break-words text-slate-700">
                  {copyText || "PIX não disponível para esta cobrança."}
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                <Button variant="outline" onClick={copyPix} disabled={!copyText}>
                  <Copy className="h-4 w-4" /> Copiar PIX
                </Button>
                {payment?.payment?.boletoUrl ? (
                  <Button asChild variant="outline">
                    <a href={payment.payment.boletoUrl} target="_blank" rel="noreferrer">
                      <ExternalLink className="h-4 w-4" /> Abrir boleto
                    </a>
                  </Button>
                ) : null}
              </div>

              {!copyText && !payment?.payment?.boletoUrl ? (
                <p className="text-sm text-slate-500">Pagamento disponível, mas sem PIX ou boleto exibível no momento.</p>
              ) : null}
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}

function SupportView({
  subject,
  message,
  status,
  lastProtocol,
  loading,
  setSubject,
  setMessage,
  onSubmit,
}: {
  subject: string;
  message: string;
  status: string;
  lastProtocol: string;
  loading: boolean;
  setSubject: (value: string) => void;
  setMessage: (value: string) => void;
  onSubmit: (event: React.FormEvent) => void;
}) {
  return (
    <div className="grid gap-5 lg:grid-cols-[1fr_0.8fr]">
      <Card>
        <CardHeader>
          <CardTitle>Suporte</CardTitle>
          <CardDescription>Descreva sua solicitação para abrir um chamado.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="support-subject">Assunto</Label>
              <Input
                id="support-subject"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="Ex.: Internet oscilando"
                maxLength={160}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="support-message">Mensagem</Label>
              <textarea
                id="support-message"
                className="min-h-36 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none transition focus:ring-2 focus:ring-emerald-500"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Conte o que está acontecendo. Quanto mais detalhes, melhor."
                maxLength={4000}
                required
              />
              <p className="text-xs text-slate-500">{message.length}/4000 caracteres</p>
            </div>
            {status ? (
              <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
                <p className="font-medium">{status}</p>
                {lastProtocol ? <p className="mt-1">Protocolo: {lastProtocol}</p> : null}
              </div>
            ) : null}
            <Button type="submit" className="h-11 bg-emerald-600 hover:bg-emerald-700" disabled={loading}>
              <MessageSquarePlus className="h-4 w-4" /> {loading ? "Abrindo chamado..." : "Abrir Chamado"}
            </Button>
          </form>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Atendimento DC NET</CardTitle>
          <CardDescription>Seu protocolo fica salvo para acompanhamento.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 text-sm text-slate-600">
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
            <PhoneCall className="mb-2 h-5 w-5 text-emerald-600" />
            Informe um assunto curto e uma mensagem clara para agilizar o atendimento.
          </div>
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
            Você pode acompanhar a situação na aba Protocolos logo após abrir o chamado.
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function TicketsView({
  tickets,
  selectedTicketId,
  setSelectedTicketId,
  ticketDetail,
  loadingTickets,
  loadingTicketDetail,
}: {
  tickets: Ticket[];
  selectedTicketId: string;
  setSelectedTicketId: (value: string) => void;
  ticketDetail: Ticket | null;
  loadingTickets: boolean;
  loadingTicketDetail: boolean;
}) {
  return (
    <div className="grid gap-5 xl:grid-cols-[0.9fr_1.1fr]">
      <Card>
        <CardHeader>
          <CardTitle>Protocolos</CardTitle>
          <CardDescription>Acompanhe suas solicitações de suporte.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {loadingTickets ? <p className="text-sm text-slate-500">Carregando protocolos...</p> : null}
          {!loadingTickets && !tickets.length ? (
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-5 text-center text-sm text-slate-500">
              <Inbox className="mx-auto mb-2 h-6 w-6 text-slate-400" />
              Nenhum protocolo encontrado
            </div>
          ) : null}
          {tickets.map((ticket) => (
            <button
              key={ticket._id}
              type="button"
              onClick={() => setSelectedTicketId(ticket._id)}
              className={`w-full rounded-lg border p-3 text-left transition ${
                selectedTicketId === ticket._id ? "border-emerald-300 bg-emerald-50" : "border-slate-200 bg-white hover:bg-slate-50"
              }`}
            >
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Protocolo {ticket.protocol}</p>
                  <p className="mt-1 truncate font-medium text-slate-950">{ticket.subject}</p>
                  <p className="mt-1 text-sm text-slate-500">Aberto em {date(ticket.createdAt)}</p>
                </div>
                <Badge tone={supportStatusTone(ticket.status)}>{supportStatusText(ticket.status)}</Badge>
              </div>
            </button>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Detalhes do protocolo</CardTitle>
          <CardDescription>Informações do chamado selecionado.</CardDescription>
        </CardHeader>
        <CardContent>
          {loadingTicketDetail ? <p className="text-sm text-slate-500">Carregando protocolo...</p> : null}
          {!loadingTicketDetail && !ticketDetail ? (
            <p className="text-sm text-slate-500">Selecione um protocolo para ver os detalhes.</p>
          ) : null}
          {!loadingTicketDetail && ticketDetail ? (
            <div className="space-y-4">
              <div className="flex flex-col gap-3 rounded-lg border border-slate-200 bg-slate-50 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Protocolo</p>
                  <p className="mt-1 text-lg font-semibold text-slate-950">{ticketDetail.protocol}</p>
                </div>
                <Badge tone={supportStatusTone(ticketDetail.status)}>{supportStatusText(ticketDetail.status)}</Badge>
              </div>
              <div>
                <p className="text-sm font-medium text-slate-900">Assunto</p>
                <p className="mt-1 text-sm text-slate-600">{ticketDetail.subject}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-slate-900">Mensagem</p>
                <p className="mt-1 whitespace-pre-wrap rounded-lg border border-slate-200 bg-white p-3 text-sm text-slate-700">{ticketDetail.message}</p>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-lg border border-slate-200 p-3">
                  <p className="text-xs text-slate-500">Data de abertura</p>
                  <p className="mt-1 text-sm font-medium">{date(ticketDetail.createdAt)}</p>
                </div>
                <div className="rounded-lg border border-slate-200 p-3">
                  <p className="text-xs text-slate-500">Última consulta</p>
                  <p className="mt-1 text-sm font-medium">{date(ticketDetail.updatedAt)}</p>
                </div>
              </div>
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}


function NotificationsView({
  notifications,
  unreadCount,
  loading,
  onRefresh,
  onRead,
  onReadAll,
}: {
  notifications: CustomerNotification[];
  unreadCount: number;
  loading: boolean;
  onRefresh: () => void;
  onRead: (notification: CustomerNotification) => void;
  onReadAll: () => void;
}) {
  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle>Notificações</CardTitle>
            <CardDescription>Eventos importantes da sua conta.</CardDescription>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={onRefresh} disabled={loading}>Atualizar</Button>
            <Button variant="outline" size="sm" onClick={onReadAll} disabled={!unreadCount || loading}>
              <CheckCheck className="h-4 w-4" /> Marcar todas como lidas
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {loading ? <p className="text-sm text-slate-500">Carregando notificações...</p> : null}
        {!loading && !notifications.length ? (
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-5 text-center text-sm text-slate-500">
            <Inbox className="mx-auto mb-2 h-6 w-6 text-slate-400" />
            Nenhuma notificação encontrada
          </div>
        ) : null}
        {notifications.map((notification) => (
          <button
            key={notification._id}
            type="button"
            onClick={() => void onRead(notification)}
            className={`w-full rounded-lg border p-4 text-left transition ${notification.isRead ? "border-slate-200 bg-white hover:bg-slate-50" : "border-emerald-200 bg-emerald-50/50 hover:bg-emerald-50"}`}
          >
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`inline-flex h-7 items-center rounded-full border px-2.5 text-xs font-medium ${notificationTypeClass(notification.type)}`}>
                    {notificationTypeLabel(notification.type)}
                  </span>
                  {!notification.isRead ? <span className="text-xs font-medium text-emerald-700">Não lida</span> : null}
                </div>
                <p className="mt-3 font-semibold text-slate-950">{notification.title}</p>
                <p className="mt-1 text-sm text-slate-600">{notification.message}</p>
              </div>
              <p className="shrink-0 text-sm text-slate-500">{dateTime(notification.createdAt)}</p>
            </div>
          </button>
        ))}
      </CardContent>
    </Card>
  );
}
