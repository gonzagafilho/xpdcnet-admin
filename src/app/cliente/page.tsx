"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Banknote,
  CircleHelp,
  Copy,
  CreditCard,
  ExternalLink,
  FileText,
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
  Wifi,
} from "lucide-react";
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

type TabKey = "dashboard" | "plan" | "connection" | "invoices" | "payment" | "support" | "tickets";

type CustomerLoginResponse = {
  token: string;
  client: { _id: string; fullName: string; status: string };
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
  server: { _id: string; name: string; isActive: boolean } | null;
  networkNode: { _id: string; name: string; status: string; healthLevel?: string | null; healthScore?: number | null; agentLastSeenAt?: string | null } | null;
  lastSession: { sampledAt: string | null; activePppTotal: number | null; pppSecretCount: number | null } | null;
  mikrotikSync?: { enabled: boolean; state: string; lastSuccessAt: string | null; lastAttemptAt: string | null };
  alerts?: { type: string; severity: string; message: string }[];
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

const tabs: { key: TabKey; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { key: "dashboard", label: "Início", icon: Home },
  { key: "plan", label: "Meu Plano", icon: ShieldCheck },
  { key: "connection", label: "Minha Conexão", icon: Wifi },
  { key: "invoices", label: "Minhas Faturas", icon: FileText },
  { key: "payment", label: "PIX / Segunda Via", icon: CreditCard },
  { key: "support", label: "Suporte", icon: Headphones },
  { key: "tickets", label: "Protocolos", icon: CircleHelp },
];

function money(value?: number | null) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(value || 0));
}

function date(value?: string | null) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short" }).format(new Date(value));
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
    unknown: "Indisponível",
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


export default function ClientePage() {
  const [tokenReady, setTokenReady] = useState(false);
  const [loggedIn, setLoggedIn] = useState(false);
  const [document, setDocument] = useState("");
  const [phone, setPhone] = useState("");
  const [loginError, setLoginError] = useState("");
  const [loadingLogin, setLoadingLogin] = useState(false);
  const [tab, setTab] = useState<TabKey>("dashboard");

  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [plan, setPlan] = useState<PlanResponse | null>(null);
  const [connection, setConnection] = useState<ConnectionInfo | null>(null);
  const [invoices, setInvoices] = useState<InvoiceItem[]>([]);
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<string>("");
  const [payment, setPayment] = useState<PaymentResponse | null>(null);
  const [loadingPayment, setLoadingPayment] = useState(false);
  const [copyStatus, setCopyStatus] = useState("");
  const [tickets, setTickets] = useState<Ticket[]>([]);
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

  const firstName = useMemo(() => dashboard?.client.fullName?.split(" ")[0] || "cliente", [dashboard]);

  const handleAuthError = useCallback((err: unknown) => {
    if (err instanceof CustomerApiError && err.status === 401) {
      clearCustomerToken();
      setLoggedIn(false);
      setDashboard(null);
      setLoginError("Sua sessão expirou. Entre novamente.");
      return true;
    }
    return false;
  }, []);

  const loadAll = useCallback(async () => {
    setLoadingData(true);
    setDataError("");
    try {
      setLoadingTickets(true);
      const [me, planData, connData, invoiceData, ticketData] = await Promise.all([
        customerApiFetch<Dashboard>("/customer-app/me"),
        customerApiFetch<PlanResponse>("/customer-app/plan"),
        customerApiFetch<ConnectionInfo>("/customer-app/connection"),
        customerApiFetch<{ items: InvoiceItem[] }>("/customer-app/invoices?limit=24"),
        customerApiFetch<{ items: Ticket[] }>("/customer-app/support/tickets?limit=20"),
      ]);
      setDashboard(me);
      setPlan(planData);
      setConnection(connData);
      setInvoices(invoiceData.items || []);
      setTickets(ticketData.items || []);
      setSelectedTicketId((current) => current || ticketData.items?.[0]?._id || "");
      const firstPayable = (invoiceData.items || []).find((item) => item.hasBillingInvoice) || invoiceData.items?.[0];
      setSelectedInvoiceId((current) => current || firstPayable?._id || "");
      setLoggedIn(true);
    } catch (err) {
      if (!handleAuthError(err)) setDataError(err instanceof Error ? err.message : "Falha ao carregar dados.");
    } finally {
      setLoadingData(false);
      setLoadingTickets(false);
    }
  }, [handleAuthError]);

  useEffect(() => {
    const token = getCustomerToken();
    setTokenReady(true);
    if (token) void loadAll();
  }, [loadAll]);

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
    setLoadingLogin(true);
    try {
      const res = await customerApiFetch<CustomerLoginResponse>("/customer-app/auth/login", {
        auth: false,
        method: "POST",
        body: JSON.stringify({ document, phone }),
      });
      setCustomerToken(res.token);
      setLoggedIn(true);
      await loadAll();
    } catch (err) {
      setLoginError(err instanceof Error ? err.message : "Não foi possível entrar.");
    } finally {
      setLoadingLogin(false);
    }
  }

  function logout() {
    clearCustomerToken();
    setLoggedIn(false);
    setDashboard(null);
    setPlan(null);
    setConnection(null);
    setInvoices([]);
    setTickets([]);
    setPayment(null);
    setCopyStatus("");
    setTicketDetail(null);
    setSelectedTicketId("");
    setLastProtocol("");
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
                    <Input id="customer-document" inputMode="numeric" autoComplete="off" value={document} onChange={(e) => setDocument(e.target.value)} required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="customer-phone">WhatsApp</Label>
                    <Input id="customer-phone" inputMode="tel" autoComplete="tel" value={phone} onChange={(e) => setPhone(e.target.value)} required />
                  </div>
                  {loginError ? <p className="text-sm text-red-600">{loginError}</p> : null}
                  <Button type="submit" className="h-11 w-full bg-emerald-600 hover:bg-emerald-700" disabled={loadingLogin}>
                    {loadingLogin ? "Entrando..." : "Entrar"}
                  </Button>
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
            <h1 className="text-2xl font-semibold tracking-tight">Olá, {firstName}</h1>
          </div>
          <div className="flex items-center gap-2">
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
          {tab === "dashboard" ? <DashboardView dashboard={dashboard} setTab={setTab} /> : null}
          {tab === "plan" ? <PlanView plan={plan} /> : null}
          {tab === "connection" ? <ConnectionView connection={connection} /> : null}
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

function DashboardView({ dashboard, setTab }: { dashboard: Dashboard | null; setTab: (tab: TabKey) => void }) {
  if (!dashboard) return null;
  return (
    <div className="space-y-5">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard title="Meu Plano" value={dashboard.plan?.name || "-"} hint={`${dashboard.plan?.speedMbps || 0} Mbps`} icon={ShieldCheck} />
        <MetricCard title="Minha Conexão" value={statusLabel(dashboard.connection.status)} hint="Última leitura disponível" icon={Router} />
        <MetricCard title="Próximo Vencimento" value={date(dashboard.mainDueDate)} hint="Fatura em aberto mais próxima" icon={FileText} />
        <MetricCard title="Faturas Pendentes" value={String(dashboard.financialSummary.openInvoices)} hint={money(dashboard.financialSummary.openAmount)} icon={Banknote} />
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Atalhos</CardTitle>
          <CardDescription>Acesse as áreas mais usadas do portal.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-3">
          <Button variant="outline" className="h-12 justify-start" onClick={() => setTab("invoices")}><FileText className="h-4 w-4" /> Faturas</Button>
          <Button variant="outline" className="h-12 justify-start" onClick={() => setTab("payment")}><CreditCard className="h-4 w-4" /> PIX / Segunda Via</Button>
          <Button variant="outline" className="h-12 justify-start" onClick={() => setTab("support")}><Headphones className="h-4 w-4" /> Suporte</Button>
        </CardContent>
      </Card>
      {dashboard.alerts.length ? (
        <Card>
          <CardHeader><CardTitle>Alertas</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {dashboard.alerts.map((alert) => <div key={`${alert.type}-${alert.message}`} className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">{alert.message}</div>)}
          </CardContent>
        </Card>
      ) : null}
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

function ConnectionView({ connection }: { connection: ConnectionInfo | null }) {
  if (!connection) return null;
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader><CardTitle>Minha Conexão</CardTitle><CardDescription>Status baseado na última leitura disponível.</CardDescription></CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between"><span>Status</span><Badge tone={toneForStatus(connection.status)}>{statusLabel(connection.status)}</Badge></div>
          <div className="flex items-center justify-between"><span>Equipamento</span><span className="font-medium">{connection.server?.name || "Não informado"}</span></div>
          <div className="flex items-center justify-between"><span>Ponto de rede</span><span className="font-medium">{connection.networkNode?.name || "Não informado"}</span></div>
          <div className="flex items-center justify-between"><span>Última leitura</span><span className="font-medium">{date(connection.lastSession?.sampledAt)}</span></div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle>Sessões</CardTitle><CardDescription>Resumo sem comandos em tempo real.</CardDescription></CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2">
          <MetricCard title="PPPoE online" value={String(connection.lastSession?.activePppTotal ?? "-")} hint="No equipamento vinculado" icon={Router} />
          <MetricCard title="Identidades" value={String(connection.lastSession?.pppSecretCount ?? "-")} hint="Último snapshot" icon={ShieldCheck} />
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
                  <p className="text-xs text-slate-500">Última atualização</p>
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
