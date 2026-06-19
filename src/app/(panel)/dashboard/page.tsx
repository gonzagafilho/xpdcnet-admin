"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { apiFetch } from "@/lib/api-client";
import { userFacingApiError } from "@/lib/user-facing-api-error";
import type {
  ClientFromApi,
  HealthFromApi,
  InvoiceFromApi,
  InvoiceSummaryFromApi,
  PlanFromApi,
} from "@/lib/api-types";
import { formatBRL } from "@/lib/api-types";
import { clientStatusBadgeVariant, clientStatusLabelPt } from "@/lib/client-status";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Activity,
  AlertCircle,
  ArrowRight,
  BadgeCheck,
  ChevronLeft,
  ChevronRight,
  Gift,
  PieChart,
  QrCode,
  Rocket,
  Search,
  Settings,
  Users,
  Wallet,
} from "lucide-react";

/** Evita crash se o resumo financeiro vier incompleto. */
function brl(value: unknown): string {
  const n = typeof value === "number" && Number.isFinite(value) ? value : 0;
  return formatBRL(n);
}

function currentCompetence(): string {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  return `${d.getFullYear()}-${m}`;
}

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

function localDayKey(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function competencePretty(ym: string): string {
  if (!/^\d{4}-\d{2}$/.test(ym)) return ym;
  const [y, m] = ym.split("-").map(Number);
  const d = new Date(y, m - 1, 1);
  const s = d.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function planLabel(planId: ClientFromApi["planId"]): string {
  if (planId && typeof planId === "object" && "name" in planId) return planId.name || "—";
  return "—";
}

const TABLE_PREVIEW = 20;
const COMMERCIAL_CAMPAIGNS = [
  {
    eyebrow: "Mais velocidade para crescer",
    title: "Upgrade para",
    accent: "700 Mega",
    description: "Mais desempenho para conectar todos os dispositivos, trabalhar e aproveitar sem travamentos.",
    cta: "Conhecer planos",
    href: "/planos",
    icon: Rocket,
  },
  {
    eyebrow: "Pagamento simples e rápido",
    title: "Conheça o",
    accent: "BolePix DC NET",
    description: "Boleto e Pix no mesmo lugar para deixar a rotina de pagamentos muito mais prática.",
    cta: "Ver no financeiro",
    href: "/financeiro",
    icon: QrCode,
  },
  {
    eyebrow: "Benefício para todo mundo",
    title: "Indique e",
    accent: "Ganhe",
    description: "Apresente a DC NET para quem você conhece e aproveite vantagens exclusivas.",
    cta: "Ver clientes",
    href: "/clientes",
    icon: Gift,
  },
] as const;

function DonutBalanço({
  pending,
  overdue,
  paid,
  cancelled,
  loading,
}: {
  pending: number;
  overdue: number;
  paid: number;
  cancelled: number;
  loading: boolean;
}) {
  const segments = useMemo(() => {
    const parts = [
      { key: "paid", value: Math.max(0, paid), color: "#059669" },
      { key: "pending", value: Math.max(0, pending), color: "#737373" },
      { key: "overdue", value: Math.max(0, overdue), color: "#d97706" },
      { key: "cancelled", value: Math.max(0, cancelled), color: "#a3a3a3" },
    ];
    const total = parts.reduce((s, p) => s + p.value, 0);
    return { parts, total };
  }, [pending, overdue, paid, cancelled]);

  if (loading) {
    return (
      <div className="flex h-56 items-center justify-center text-sm text-slate-500">A carregar…</div>
    );
  }

  if (segments.total === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-8">
        <div
          className="h-44 w-44 rounded-full border-[14px] border-slate-200 bg-slate-50"
          aria-hidden
        />
        <p className="text-center text-sm text-slate-500">Ainda não há valores neste mês para mostrar aqui.</p>
      </div>
    );
  }

  let acc = 0;
  const stops: string[] = [];
  for (const p of segments.parts) {
    if (p.value <= 0) continue;
    const pct = (p.value / segments.total) * 100;
    const start = acc;
    acc += pct;
    stops.push(`${p.color} ${start.toFixed(2)}% ${acc.toFixed(2)}%`);
  }

  return (
    <div className="flex flex-col items-center gap-5 sm:flex-row sm:items-center sm:justify-center sm:gap-8">
      <div
        className="h-40 w-40 shrink-0 rounded-full shadow-sm ring-1 ring-slate-200/60 sm:h-44 sm:w-44"
        style={{
          background: `conic-gradient(${stops.join(", ")})`,
          boxShadow: "inset 0 0 0 10px white",
        }}
        role="img"
        aria-label="Valores do mês por situação"
      />
      <ul className="min-w-[12rem] space-y-0 rounded-xl border border-slate-100 bg-slate-50/40 px-3 py-2 text-sm ring-1 ring-slate-900/[0.02]">
        <li className="flex items-center justify-between gap-4 border-b border-slate-100/90 py-2">
          <span className="flex items-center gap-2 text-slate-600">
            <span className="h-2.5 w-2.5 shrink-0 rounded-sm bg-emerald-600" />
            Pagas
          </span>
          <span className="font-semibold tabular-nums text-slate-900">{brl(paid)}</span>
        </li>
        <li className="flex items-center justify-between gap-4 border-b border-slate-100/90 py-2">
          <span className="flex items-center gap-2 text-slate-600">
            <span className="h-2.5 w-2.5 shrink-0 rounded-sm bg-slate-500" />
            Pendentes
          </span>
          <span className="font-semibold tabular-nums text-slate-900">{brl(pending)}</span>
        </li>
        <li className="flex items-center justify-between gap-4 border-b border-slate-100/90 py-2">
          <span className="flex items-center gap-2 text-slate-600">
            <span className="h-2.5 w-2.5 shrink-0 bg-amber-600" />
            Em atraso
          </span>
          <span className="font-semibold tabular-nums text-slate-900">{brl(overdue)}</span>
        </li>
        <li className="flex items-center justify-between gap-4 py-2">
          <span className="flex items-center gap-2 text-slate-600">
            <span className="h-2.5 w-2.5 shrink-0 rounded-sm bg-slate-400" />
            Canceladas
          </span>
          <span className="font-semibold tabular-nums text-slate-900">{brl(cancelled)}</span>
        </li>
        <li className="border-t border-slate-100/80 pt-2 text-[11px] leading-snug text-slate-500">Partes do total, em valor, neste mês.</li>
      </ul>
    </div>
  );
}

export default function DashboardPage() {
  const [bootLoading, setBootLoading] = useState(true);
  const [monthLoading, setMonthLoading] = useState(false);
  const [invoicesMonthLoading, setInvoicesMonthLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [health, setHealth] = useState<HealthFromApi | null>(null);
  const [clients, setClients] = useState<ClientFromApi[]>([]);
  const [plans, setPlans] = useState<PlanFromApi[]>([]);
  const [summaryGlobal, setSummaryGlobal] = useState<InvoiceSummaryFromApi | null>(null);
  const [summaryMonth, setSummaryMonth] = useState<InvoiceSummaryFromApi | null>(null);
  const [monthInvoices, setMonthInvoices] = useState<InvoiceFromApi[]>([]);
  const [paidInvoices, setPaidInvoices] = useState<InvoiceFromApi[]>([]);
  const [paidLoadFailed, setPaidLoadFailed] = useState(false);
  const [competence, setCompetence] = useState(currentCompetence);
  const [debouncedCompetence, setDebouncedCompetence] = useState(currentCompetence);
  const [clientFilter, setClientFilter] = useState("");
  const [campaignIndex, setCampaignIndex] = useState(0);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setCampaignIndex((current) => (current + 1) % COMMERCIAL_CAMPAIGNS.length);
    }, 7000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedCompetence(competence.trim()), 350);
    return () => clearTimeout(t);
  }, [competence]);

  const loadCore = useCallback(async () => {
    const [h, c, p, sg] = await Promise.all([
      apiFetch<HealthFromApi>("/health", { auth: false }),
      apiFetch<ClientFromApi[]>("/clients"),
      apiFetch<PlanFromApi[]>("/plans"),
      apiFetch<InvoiceSummaryFromApi>("/invoices/summary"),
    ]);
    setHealth(h);
    setClients(Array.isArray(c) ? c : []);
    setPlans(Array.isArray(p) ? p : []);
    setSummaryGlobal(sg);
  }, []);

  const loadPaidInvoices = useCallback(async () => {
    setPaidLoadFailed(false);
    try {
      const paidList = await apiFetch<InvoiceFromApi[]>("/invoices?status=paid");
      setPaidInvoices(Array.isArray(paidList) ? paidList : []);
    } catch {
      setPaidInvoices([]);
      setPaidLoadFailed(true);
    }
  }, []);

  const loadMonthSummary = useCallback(async () => {
    const c = debouncedCompetence;
    if (!/^\d{4}-\d{2}$/.test(c)) {
      setSummaryMonth(null);
      return;
    }
    const sm = await apiFetch<InvoiceSummaryFromApi>(`/invoices/summary?competence=${encodeURIComponent(c)}`);
    setSummaryMonth(sm);
  }, [debouncedCompetence]);

  const loadMonthInvoices = useCallback(async () => {
    const c = debouncedCompetence;
    if (!/^\d{4}-\d{2}$/.test(c)) {
      setMonthInvoices([]);
      return;
    }
    const list = await apiFetch<InvoiceFromApi[]>(`/invoices?competence=${encodeURIComponent(c)}`);
    setMonthInvoices(Array.isArray(list) ? list : []);
  }, [debouncedCompetence]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setBootLoading(true);
      setError(null);
      try {
        await loadCore();
        if (!cancelled) await loadPaidInvoices();
      } catch (e) {
        if (!cancelled) setError(userFacingApiError(e));
      } finally {
        if (!cancelled) setBootLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [loadCore, loadPaidInvoices]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setMonthLoading(true);
      try {
        await loadMonthSummary();
      } catch (e) {
        if (!cancelled) setError(userFacingApiError(e));
      } finally {
        if (!cancelled) setMonthLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [loadMonthSummary]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setInvoicesMonthLoading(true);
      try {
        await loadMonthInvoices();
      } catch (e) {
        if (!cancelled) setError(userFacingApiError(e));
        if (!cancelled) setMonthInvoices([]);
      } finally {
        if (!cancelled) setInvoicesMonthLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [loadMonthInvoices]);

  const totalClients = clients.length;
  const activeClients = useMemo(() => clients.filter((x) => x.status === "active").length, [clients]);
  const suspendedClients = useMemo(() => clients.filter((x) => x.status === "suspended").length, [clients]);
  const cancelledClients = useMemo(() => clients.filter((x) => x.status === "cancelled").length, [clients]);
  const otherStatusClients = useMemo(
    () => clients.filter((x) => ["pending", "delinquent", "blocked", "disabled"].includes(x.status)).length,
    [clients],
  );

  const sysOk = health?.status === "ok" && health?.database === "connected";

  const overdueCount = summaryGlobal?.overdue?.count ?? 0;
  const overdueAmount = summaryGlobal?.overdue?.amount ?? 0;
  const pendingCount = summaryGlobal?.pending?.count ?? 0;
  const pendingAmount = summaryGlobal?.pending?.amount ?? 0;
  

  const todayKey = useMemo(() => {
    const n = new Date();
    return `${n.getFullYear()}-${pad2(n.getMonth() + 1)}-${pad2(n.getDate())}`;
  }, []);

  const confirmacoesHoje = useMemo(() => {
    const list = paidInvoices.filter((inv) => inv.paidAt && localDayKey(inv.paidAt) === todayKey);
    const count = list.length;
    const sum = list.reduce((s, x) => s + (typeof x.amount === "number" ? x.amount : 0), 0);
    return { count, sum, list };
  }, [paidInvoices, todayKey]);

  const dailyPaidBuckets = useMemo(() => {
    const ym = debouncedCompetence;
    if (!/^\d{4}-\d{2}$/.test(ym)) return { days: [] as { day: number; amount: number }[], max: 0 };
    const [Y, M] = ym.split("-").map(Number);
    const dim = new Date(Y, M, 0).getDate();
    const buckets = Array.from({ length: dim }, () => 0);
    for (const inv of monthInvoices) {
      if (inv.status !== "paid" || !inv.paidAt) continue;
      const d = new Date(inv.paidAt);
      if (Number.isNaN(d.getTime())) continue;
      if (d.getFullYear() !== Y || d.getMonth() + 1 !== M) continue;
      buckets[d.getDate() - 1] += inv.amount;
    }
    const days = buckets.map((amount, i) => ({ day: i + 1, amount }));
    const max = Math.max(...buckets, 1);
    return { days, max };
  }, [monthInvoices, debouncedCompetence]);

  const filteredClients = useMemo(() => {
    const q = clientFilter.trim().toLowerCase();
    if (!q) return clients;
    return clients.filter((c) => {
      const hay = [c.fullName, c.document, c.email, c.phone, planLabel(c.planId)]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }, [clients, clientFilter]);

  const tableRows = useMemo(() => filteredClients.slice(0, TABLE_PREVIEW), [filteredClients]);

  const donutAmounts = summaryMonth
    ? {
        pending: summaryMonth.pending?.amount ?? 0,
        overdue: summaryMonth.overdue?.amount ?? 0,
        paid: summaryMonth.paid?.amount ?? 0,
        cancelled: summaryMonth.cancelled?.amount ?? 0,
      }
    : { pending: 0, overdue: 0, paid: 0, cancelled: 0 };

  const activeCampaign = COMMERCIAL_CAMPAIGNS[campaignIndex];
  const CampaignIcon = activeCampaign.icon;

  return (
    <div className="mx-auto w-full max-w-[92rem] space-y-7 bg-[#E7EEF8] pb-10">
      {/* Banner comercial rotativo */}
      <section
        className="relative isolate overflow-hidden rounded-2xl border border-white/10 bg-[linear-gradient(118deg,#020617_0%,#041A3D_52%,#0A6CFF_100%)] px-3 py-2 text-white shadow-[0_14px_32px_rgba(4,26,61,0.18)] sm:px-6 sm:py-5"
        aria-roledescription="carrossel"
        aria-label="Campanhas DC NET"
      >
        <div className="pointer-events-none absolute -right-16 -top-24 h-72 w-72 rounded-full bg-[#26D7FF]/20 blur-3xl" />
        <div className="pointer-events-none absolute bottom-[-7rem] left-[42%] h-56 w-56 rounded-full bg-white/10 blur-3xl" />
         <div className="relative grid min-h-[3.5rem] items-center gap-2 lg:grid-cols-[minmax(0,1fr)_auto]">
          <div key={campaignIndex} className="max-w-3xl">
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#26D7FF]">
              {activeCampaign.eyebrow}
            </p>
            <h1 className="mt-1 text-lg font-bold leading-tight tracking-tight sm:text-xl">
              {activeCampaign.title}{" "}
              <span className="text-[#26D7FF]">{activeCampaign.accent}</span>
            </h1>
            <p className="mt-1 max-w-2xl text-xs leading-relaxed text-slate-200 sm:text-sm">
              {activeCampaign.description}
            </p>
            <Button
              type="button"
              className="mt-2 h-9 border border-white/70 bg-white font-semibold text-[#041A3D] shadow-sm hover:bg-[#EAF8FF]"
              asChild
            >
              <Link href={activeCampaign.href}>
                {activeCampaign.cta}
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </div>

          <div
            className="hidden h-12 w-12 items-center justify-center rounded-full border border-white/20 bg-white/10 shadow-[inset_0_1px_0_rgba(255,255,255,0.2)] backdrop-blur-sm lg:flex"
            aria-hidden
          >
            <CampaignIcon className="h-6 w-6 ... text-[#26D7FF]" strokeWidth={1.5} />
          </div>
        </div>

        <div className="relative mt-1 flex items-center justify-between gap-2 border-t border-white/15 pt-1">
          <div className="flex items-center gap-2" aria-label="Selecionar campanha">
            {COMMERCIAL_CAMPAIGNS.map((campaign, index) => (
              <button
                key={campaign.accent}
                type="button"
                onClick={() => setCampaignIndex(index)}
                className={`h-2 rounded-full transition-all ${
                  index === campaignIndex ? "w-8 bg-[#26D7FF]" : "w-2 bg-white/45 hover:bg-white/70"
                }`}
                aria-label={`Mostrar campanha ${index + 1}: ${campaign.title} ${campaign.accent}`}
                aria-current={index === campaignIndex ? "true" : undefined}
              />
            ))}
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() =>
                setCampaignIndex(
                  (current) => (current - 1 + COMMERCIAL_CAMPAIGNS.length) % COMMERCIAL_CAMPAIGNS.length,
                )
              }
              className="flex h-8 w-8 items-center justify-center rounded-full border border-white/20 bg-white/10 text-white transition-colors hover:bg-white/20"
              aria-label="Campanha anterior"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => setCampaignIndex((current) => (current + 1) % COMMERCIAL_CAMPAIGNS.length)}
              className="flex h-8 w-8 items-center justify-center rounded-full border border-white/20 bg-white/10 text-white transition-colors hover:bg-white/20"
              aria-label="Próxima campanha"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </section>

      {/* 1. TOPO */}
      <header className="rounded-xl border border-[#D7E0EC] bg-[#F8FBFF] px-5 py-3 shadow-sm sm:px-6 sm:py-3">
        <div className="flex flex-col gap-2 lg:flex-row lg:items-end lg:justify-between">
          <div className="min-w-0 space-y-2.5">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#0A6CFF]">Painel Principal DC NET</p>
            <p className="text-sm text-[#334155]">
              <span className="font-medium text-[#041A3D]">Mês de referência:</span>{" "}
              <span className="rounded-md border border-[rgba(38,215,255,.22)] bg-[#F4F8FF] px-2 py-0.5 font-mono text-sm text-[#0A6CFF] tabular-nums">
                {debouncedCompetence}
              </span>
              <span className="ml-2 text-[#94A3B8]">· {competencePretty(debouncedCompetence)}</span>
            </p>
          </div>
          <div className="flex flex-shrink-0 flex-col gap-3 sm:flex-row sm:items-end">
            <div className="space-y-1">
              <Label htmlFor="dash-comp" className="text-[11px] font-semibold uppercase tracking-[0.1em] text-[#041A3D]">
                Mês de referência
              </Label>
              <p className="text-[10px] text-[#94A3B8]">Ex.: 2026-04</p>
              <Input
                id="dash-comp"
                value={competence}
                onChange={(e) => setCompetence(e.target.value)}
                disabled={bootLoading}
                placeholder="Ex.: 2026-04"
                className="w-40 font-mono tabular-nums border-[rgba(38,215,255,.22)] bg-white text-[#041A3D] placeholder:text-[#CBD5E1]"
              />
            </div>
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" size="sm" asChild>
                <Link href="/financeiro">
                  Financeiro <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </Button>
              <Button type="button" variant="outline" size="sm" asChild>
                <Link href="/clientes">Clientes</Link>
              </Button>
              <Button type="button" variant="outline" size="sm" asChild>
                <Link href="/dashboard/executivo">Executivo</Link>
              </Button>
              <Button type="button" variant="outline" size="sm" asChild>
                <Link href="/configuracoes">
                  <Settings className="h-3.5 w-3.5" />
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </header>

      {error ? (
        <div
          className="rounded-xl border border-red-200/90 bg-red-50/90 px-5 py-3.5 text-sm text-red-900 shadow-sm ring-1 ring-red-900/5"
          role="alert"
        >
          {error}
        </div>
      ) : null}

      {/* 2. PRIMEIRA FAIXA — faturamento diário + confirmações hoje */}
      <div className="grid gap-5 lg:grid-cols-5 lg:items-stretch">
        <section className="flex min-h-[19rem] flex-col rounded-xl border border-[#D7E0EC] bg-white p-5 shadow-sm md:p-6 lg:col-span-3">
          <h2 className="text-base font-semibold tracking-tight text-[#041A3D] sm:text-[1.05rem]">
            Recebimentos do mês — {competencePretty(debouncedCompetence)}
          </h2>
          <div className="mt-6 flex flex-1 flex-col justify-end">
            {!/^\d{4}-\d{2}$/.test(debouncedCompetence) ? (
              <p className="text-sm text-[#CA8A04]">Indique um mês válido, por exemplo 2026-04.</p>
            ) : invoicesMonthLoading ? (
              <p className="py-10 text-center text-sm text-[#94A3B8]">A carregar dados do mês…</p>
            ) : dailyPaidBuckets.days.length === 0 ? (
              <p className="py-10 text-center text-sm text-[#94A3B8]">Sem registos neste período.</p>
            ) : (
              <div className="flex h-52 items-end gap-px rounded-b-md border-b border-[rgba(38,215,255,.22)] bg-[#F4F8FF] px-1 pt-2">
                {dailyPaidBuckets.days.map(({ day, amount }) => {
                  const h = Math.round((amount / dailyPaidBuckets.max) * 100) || 0;
                  return (
                    <div
                      key={day}
                      className="group flex min-w-0 flex-1 flex-col items-center justify-end"
                      title={`Dia ${day}: ${brl(amount)}`}
                    >
                      <div
                        className="w-full max-w-[14px] bg-emerald-600/90 transition-colors group-hover:bg-emerald-700"
                        style={{ height: `${Math.max(h, amount > 0 ? 8 : 2)}%` }}
                      />
                    </div>
                  );
                })}
              </div>
            )}
            {dailyPaidBuckets.days.length > 0 ? (
              <div className="mt-2 flex justify-between text-[0.65rem] text-[#94A3B8]">
                <span>1</span>
                <span>Dias</span>
                <span>{dailyPaidBuckets.days.length}</span>
              </div>
            ) : null}
          </div>
        </section>

        <section className="flex min-h-[19rem] flex-col rounded-xl border border-[#D7E0EC] bg-white p-5 shadow-sm md:p-6 lg:col-span-2">
          <h2 className="text-base font-semibold tracking-tight text-[#041A3D] sm:text-[1.05rem]">Entradas confirmadas hoje</h2>  
          <div className="mt-auto space-y-3 pt-8">
            {bootLoading ? (
              <p className="text-sm text-[#94A3B8]">A carregar…</p>
            ) : paidLoadFailed ? (
              <p className="text-sm text-[#CA8A04]">
                Não foi possível carregar estes números. Atualize a página ou tente mais tarde.
              </p>
            ) : (
              <>
                <div className="rounded-xl border border-[rgba(38,215,255,.22)] bg-[#F4F8FF] px-4 py-3 shadow-sm">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-[#0A6CFF]">Pagamentos recebidos</p>
                  <p className="mt-1 text-3xl font-bold tabular-nums tracking-tight text-[#0A6CFF]">{confirmacoesHoje.count}</p>
                </div>
                <div className="rounded-xl border border-[rgba(6,182,212,.25)] bg-[#EEF5FB] px-4 py-3 shadow-sm">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-[#0369A1]">Recebido hoje</p>
                  <p className="mt-1 text-xl font-bold tabular-nums tracking-tight text-[#06B6D4]">{brl(confirmacoesHoje.sum)}</p>
                </div>
              </>
            )}
          </div>
        </section>
      </div>

      {/* 3. SEGUNDA FAIXA — balanço doughnut + contratos */}
      <div className="grid gap-5 lg:grid-cols-5 lg:items-stretch">
        <section className="flex min-h-[21rem] flex-col rounded-xl border border-[#D7E0EC] bg-white p-5 shadow-sm md:p-6 lg:col-span-3">
          <h2 className="text-base font-semibold tracking-tight text-[#041A3D] sm:text-[1.05rem]">
            Resumo do mês — {competencePretty(debouncedCompetence)}
          </h2>
          <div className="mt-8 flex flex-1 items-center justify-center">
            {!/^\d{4}-\d{2}$/.test(debouncedCompetence) ? (
              <p className="text-sm text-[#CA8A04]">Período inválido. Use o formato ano-mês, por exemplo 2026-04.</p>
            ) : (
              <DonutBalanço
                pending={donutAmounts.pending}
                overdue={donutAmounts.overdue}
                paid={donutAmounts.paid}
                cancelled={donutAmounts.cancelled}
                loading={monthLoading && !summaryMonth}
              />
            )}
          </div>
        </section>

        <section className="flex min-h-[21rem] flex-col rounded-xl border border-[#D7E0EC] bg-white p-5 shadow-sm md:p-6 lg:col-span-2">
          <h2 className="text-base font-semibold tracking-tight text-[#041A3D] sm:text-[1.05rem]">Situação dos clientes</h2>
          <ul className="mt-6 space-y-0 text-sm">
            <li className="flex items-baseline justify-between border-b border-[#E2E8F0] py-3.5">
              <span className="text-[#475569]">Clientes ativos</span>
              <span className="text-xl font-bold tabular-nums tracking-tight text-[#0A6CFF] sm:text-2xl">
                {bootLoading ? "—" : activeClients}
              </span>
            </li>
            <li className="flex items-baseline justify-between border-b border-[#E2E8F0] py-3.5">
              <span className="text-[#475569]">Suspensos</span>
              <span className="text-lg font-bold tabular-nums tracking-tight text-[#CA8A04] sm:text-xl">
                {bootLoading ? "—" : suspendedClients}
              </span>
            </li>
            <li className="flex items-baseline justify-between border-b border-[#E2E8F0] py-3.5">
              <span className="text-[#475569]">Cancelados</span>
              <span className="text-lg font-bold tabular-nums tracking-tight text-[#64748B] sm:text-xl">
                {bootLoading ? "—" : cancelledClients}
              </span>
            </li>
            <li className="flex items-baseline justify-between border-b border-[#E2E8F0] py-3.5">
              <span className="text-[#475569]">Outras situações</span>
              <span className="text-lg font-bold tabular-nums tracking-tight text-[#475569] sm:text-xl">
                {bootLoading ? "—" : otherStatusClients}
              </span>
            </li>
            <li className="flex items-baseline justify-between pt-1">
              <span className="font-medium text-[#041A3D]">Total de clientes</span>
              <span className="text-lg font-bold tabular-nums tracking-tight text-[#041A3D] sm:text-xl">
                {bootLoading ? "—" : totalClients}
              </span>
            </li>
          </ul>
          <div className="mt-auto pt-6">
            <Button type="button" variant="outline" size="sm" className="w-full border-[rgba(38,215,255,.22)] text-[#0A6CFF] hover:bg-[#F4F8FF] sm:w-auto" asChild>
              <Link href="/clientes">Ver todos os clientes</Link>
            </Button>
          </div>
        </section>
      </div>

      {/* 4. FAIXA INFERIOR — placeholders honestos */}
      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-xl border border-[#D7E0EC] bg-[#F8FBFF] px-5 py-5 shadow-sm">
          <h3 className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#0A6CFF]">Aniversariantes</h3>
          <p className="mt-2.5 text-sm leading-relaxed text-[#64748B]">
            Em breve: aniversários dos clientes, quando o cadastro passar a incluir data de nascimento.
          </p>
        </div>
        <div className="rounded-xl border border-[#D7E0EC] bg-[#F8FBFF] px-5 py-5 shadow-sm">
          <h3 className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#0A6CFF]">
            Ativações — {debouncedCompetence}
          </h3>
          <p className="mt-2.5 text-sm leading-relaxed text-[#64748B]">
            Em breve: quantas novas ativações houve no mês, assim que o histórico estiver disponível para mostrar com
            segurança.
          </p>
        </div>
        <div className="rounded-xl border border-[#D7E0EC] bg-[#F8FBFF] px-5 py-5 shadow-sm">
          <h3 className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#0A6CFF]">
            Desativações — {debouncedCompetence}
          </h3>
          <p className="mt-2.5 text-sm leading-relaxed text-[#64748B]">
            Em breve: quantos contratos deixaram de estar ativos no mês, com histórico claro por período.
          </p>
        </div>
      </div>

      {/* 5. CARDS FINANCEIROS — faixa horizontal */}
      <section className="space-y-2.5">
        <div className="px-0.5">
          <h2 className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#041A3D]">Financeiro</h2>
        </div>
        <div className="grid auto-rows-fr gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <div className="relative flex min-h-[4.65rem] items-center gap-2 overflow-hidden rounded-xl border border-[#93C5FD]/40 bg-[#EFF6FF] px-4 py-2 shadow-sm ring-1 ring-[#0A6CFF]/10">
            <div className="relative z-10 flex min-w-0 flex-1 flex-col justify-center gap-1">
              <div className="flex flex-wrap items-baseline gap-x-1 gap-y-0">
                <span className="text-[9px] font-semibold uppercase tracking-[0.1em] text-[#1e40af]">receber</span>
                <span className="rounded-full bg-[#DBEAFE]/60 px-1 py-0 text-[8px] font-semibold tabular-nums leading-none text-[#1e40af] ring-1 ring-[#93C5FD]/40">
                  {bootLoading || !summaryGlobal ? "—" : pendingCount}
                </span>
              </div>
              <p className="text-[1.4rem] font-bold leading-[1.05] tracking-tight text-[#0A6CFF] tabular-nums sm:text-[1.5rem]">
                {bootLoading || !summaryGlobal ? "—" : brl(pendingAmount)}
              </p>
            </div>
            <div className="relative z-10 flex shrink-0 items-center pl-0.5" aria-hidden>
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#DBEAFE]/60 shadow-[inset_0_1px_0_rgba(59,130,246,0.1)] ring-1 ring-[#93C5FD]/40">
                <Wallet className="h-3.5 w-3.5 text-[#0A6CFF]" strokeWidth={2} />
              </div>
            </div>
          </div>

          <div className="relative flex min-h-[4.65rem] items-center gap-2 overflow-hidden rounded-xl border border-[#FECACA]/40 bg-[#FEF2F2] px-4 py-2 shadow-sm ring-1 ring-[#EF4444]/10">
            <div className="relative z-10 flex min-w-0 flex-1 flex-col justify-center gap-1">
              <div className="flex flex-wrap items-baseline gap-x-1 gap-y-0">
                <span className="text-[9px] font-semibold uppercase tracking-[0.1em] text-[#7F1D1D]">Em atraso</span>
                <span className="rounded-full bg-[#FEE2E2]/60 px-1 py-0 text-[8px] font-semibold tabular-nums leading-none text-[#7F1D1D] ring-1 ring-[#FECACA]/40">
                  {bootLoading || !summaryGlobal ? "—" : overdueCount}
                </span>
              </div>
              <p className="text-[1.4rem] font-bold leading-[1.05] tracking-tight text-[#DC2626] tabular-nums sm:text-[1.5rem]">
                {bootLoading || !summaryGlobal ? "—" : brl(overdueAmount)}
              </p>
            </div>
            <div className="relative z-10 flex shrink-0 items-center pl-0.5" aria-hidden>
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#FEE2E2]/60 shadow-[inset_0_1px_0_rgba(239,68,68,0.1)] ring-1 ring-[#FECACA]/40">
                <AlertCircle className="h-3.5 w-3.5 text-[#DC2626]" strokeWidth={2} />
              </div>
            </div>
          </div>

          <div className="relative flex min-h-[4.65rem] items-center gap-2 overflow-hidden rounded-xl border border-[#A7F3D0]/40 bg-[#F0FDF4] px-4 py-2 shadow-sm ring-1 ring-[#10B981]/10">
            <div className="relative z-10 flex min-w-0 flex-1 flex-col justify-center gap-1">
              <div className="flex flex-wrap items-baseline gap-x-1 gap-y-0">
                <span className="text-[9px] font-semibold uppercase tracking-[0.1em] text-[#065F46]">Recebido</span>
                <span className="rounded-full bg-[#D1FAE5]/60 px-1 py-0 text-[8px] font-semibold tabular-nums leading-none text-[#065F46] ring-1 ring-[#A7F3D0]/40">
                  {bootLoading || !summaryGlobal ? "—" : (summaryGlobal.paid?.count ?? 0)}
                </span>
              </div>
              <p className="text-[1.4rem] font-bold leading-[1.05] tracking-tight text-[#059669] tabular-nums sm:text-[1.5rem]">
                {bootLoading || !summaryGlobal ? "—" : brl(summaryGlobal.paid?.amount)}
              </p>
            </div>
            <div className="relative z-10 flex shrink-0 items-center pl-0.5" aria-hidden>
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#D1FAE5]/60 shadow-[inset_0_1px_0_rgba(16,185,129,0.1)] ring-1 ring-[#A7F3D0]/40">
                <BadgeCheck className="h-3.5 w-3.5 text-[#059669]" strokeWidth={2} />
              </div>
            </div>
          </div>

          <div className="relative flex min-h-[4.65rem] items-center gap-2 overflow-hidden rounded-xl border border-[rgba(38,215,255,.25)] bg-[#F0F9FF] px-4 py-2 shadow-sm ring-1 ring-[#0A6CFF]/10">
            <div className="relative z-10 flex min-w-0 flex-1 flex-col justify-center gap-1">
              <div className="flex flex-wrap items-baseline gap-x-1 gap-y-0">
                <span className="text-[9px] font-semibold uppercase tracking-[0.1em] text-[#0A6CFF]">Total</span>
                <span className="rounded-full bg-[#BFDBFE]/60 px-1 py-0 text-[8px] font-semibold tabular-nums leading-none text-[#0A6CFF] ring-1 ring-[rgba(38,215,255,.25)]">
                  {bootLoading || !summaryGlobal ? "—" : (summaryGlobal.totalInvoices ?? 0)}
                </span>
              </div>
              <p className="text-[1.4rem] font-bold leading-[1.05] tracking-tight text-[#0A6CFF] tabular-nums sm:text-[1.5rem]">
                {bootLoading || !summaryGlobal ? "—" : brl(summaryGlobal.totalAmount)}
              </p>
            </div>
            <div className="relative z-10 flex shrink-0 items-center pl-0.5" aria-hidden>
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#BFDBFE]/60 ring-1 ring-[rgba(38,215,255,.25)] shadow-[inset_0_1px_0_rgba(10,108,255,0.1)]">
                <PieChart className="h-3.5 w-3.5 text-[#0A6CFF]" strokeWidth={2} />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Sistema + planos — linha compacta */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-xl border border-[#D7E0EC] bg-[#F8FBFF] px-5 py-3.5 text-sm text-[#334155] shadow-sm">
        <span className="flex items-center gap-2 font-medium text-[#041A3D]">
          <Activity className="h-4 w-4 text-[#0A6CFF]" />
          Situação do Painel DC NET
        </span>
        {bootLoading ? (
          <span className="text-[#94A3B8]">…</span>
        ) : sysOk ? (
          <Badge variant="success">Tudo a funcionar</Badge>
        ) : (
          <Badge variant="warning">Com limitações</Badge>
        )}
        <span className="text-[#64748B]">
          {health?.systemMode ?? "—"}
          {" · "}
          {health?.database === "connected"
            ? "Sistema conectado"
            : `Ligação: ${health?.database ?? "—"}`}
        </span>
        <span className="hidden h-4 w-px bg-[#E2E8F0] sm:inline-block" />
        <span className="flex items-center gap-1 text-[#64748B]">
          <Wallet className="h-4 w-4 text-[#0A6CFF]" />
          Planos em uso: {bootLoading ? "—" : plans.filter((p) => p.isActive !== false).length} / {bootLoading ? "—" : plans.length}
        </span>
        <span className="flex items-center gap-1 text-[#64748B]">
          <Users className="h-4 w-4 text-[#0A6CFF]" />
          <Link href="/planos" className="font-medium text-[#0A6CFF] underline-offset-2 hover:underline">
            Ver planos
          </Link>
        </span>
      </div>

      {/* Tabela resumo de clientes */}
      <div className="overflow-hidden rounded-xl border border-[#D7E0EC] bg-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#E2E8F0] bg-[#F8FAFC] px-5 py-3.5">
          <div>
            <h3 className="text-sm font-semibold tracking-tight text-[#041A3D]">Resumo dos clientes</h3>
            <p className="mt-0.5 text-[11px] text-[#94A3B8]">Até {TABLE_PREVIEW} linhas · ajuste a pesquisa ao lado</p>
          </div>
          <div className="flex min-w-[12rem] flex-1 flex-col gap-1 sm:max-w-xs">
            <Label htmlFor="dash-client-filter" className="sr-only">
              Pesquisar clientes
            </Label>
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#64748B]" />
              <Input
                id="dash-client-filter"
                placeholder="Nome, documento, telefone, e-mail…"
                value={clientFilter}
                onChange={(e) => setClientFilter(e.target.value)}
                disabled={bootLoading}
                className="border-[rgba(38,215,255,.22)] bg-white text-[#041A3D] placeholder:text-[#CBD5E1] pl-9"
              />
            </div>
          </div>
          <Button
            type="button"
            size="sm"
            className="border-0 bg-[#0A6CFF] font-semibold text-white hover:bg-[#0858D4]"
            asChild
          >
            <Link href="/clientes">Ver todos</Link>
          </Button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-[#E2E8F0] bg-[#F8FAFC] text-[10px] font-semibold uppercase tracking-[0.08em] text-[#041A3D]">
                <th className="px-5 py-3">Cliente</th>
                <th className="px-5 py-3">Documento</th>
                <th className="px-5 py-3">Estado</th>
                <th className="px-5 py-3">Plano</th>
                <th className="px-5 py-3 text-right">Ver</th>
              </tr>
            </thead>
            <tbody>
              {bootLoading ? (
                <tr>
                  <td colSpan={5} className="px-5 py-10 text-center text-sm text-[#94A3B8]">
                    A carregar a lista…
                  </td>
                </tr>
              ) : tableRows.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-5 py-10 text-center text-sm text-[#94A3B8]">
                    {clients.length === 0
                      ? "Ainda não há clientes para mostrar."
                      : "Nenhum cliente corresponde à pesquisa."}
                  </td>
                </tr>
              ) : (
                tableRows.map((c) => (
                  <tr key={c._id} className="border-b border-[#E2E8F0] transition-colors hover:bg-[#F9FAFB]">
                    <td className="px-5 py-3 font-medium text-[#041A3D]">{c.fullName}</td>
                    <td className="px-5 py-3 tabular-nums text-[#64748B]">{c.document ?? "—"}</td>
                    <td className="px-5 py-3">
                      <Badge variant={clientStatusBadgeVariant(c.status)}>{clientStatusLabelPt(c.status)}</Badge>
                    </td>
                    <td className="max-w-[12rem] truncate px-5 py-3 text-[#475569]">{planLabel(c.planId)}</td>
                    <td className="px-5 py-3 text-right">
                      <Link
                        href="/clientes"
                        className="text-xs font-semibold text-[#0A6CFF] underline-offset-2 hover:underline"
                      >
                        Ficha
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
