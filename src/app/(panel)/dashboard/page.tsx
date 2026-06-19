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
  PieChart,
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

function todayLabelPt(): string {
  return new Date().toLocaleDateString("pt-BR", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

function planLabel(planId: ClientFromApi["planId"]): string {
  if (planId && typeof planId === "object" && "name" in planId) return planId.name || "—";
  return "—";
}

const TABLE_PREVIEW = 20;

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
  const openItemsCount = pendingCount + overdueCount;
  const openItemsAmount = pendingAmount + overdueAmount;
  const hasReceivablesPressure = !bootLoading && summaryGlobal && openItemsCount > 0;

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

  return (
    <div className="mx-auto w-full max-w-[92rem] space-y-7 pb-10">
      {/* 1. TOPO */}
      <header className="rounded-xl border border-[rgba(38,215,255,.20)] bg-[#0B1220] px-5 py-5 shadow-sm ring-1 ring-[#26D7FF]/10 sm:px-6 sm:py-5">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="min-w-0 space-y-2.5">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#CFE4FF]">Painel Principal DC NET</p>
            <p className="max-w-2xl text-sm leading-relaxed text-[#EAF3FF] sm:text-[0.9375rem]">
              Visão geral da sua operação em tempo real. O período que escolher abaixo vale para os gráficos e
              números do meio da tela.
            </p>
            <p className="text-sm text-[#CFE4FF]">
              <span className="font-medium text-[#EAF3FF]">Mês de referência:</span>{" "}
              <span className="rounded-md border border-[rgba(38,215,255,.30)] bg-[rgba(38,215,255,.08)] px-2 py-0.5 font-mono text-sm text-[#CFE4FF] tabular-nums">
                {debouncedCompetence}
              </span>
              <span className="ml-2 text-[rgba(207,228,255,0.6)]">· {competencePretty(debouncedCompetence)}</span>
            </p>
          </div>
          <div className="flex flex-shrink-0 flex-col gap-3 sm:flex-row sm:items-end">
            <div className="space-y-1">
              <Label htmlFor="dash-comp" className="text-[11px] font-semibold uppercase tracking-[0.1em] text-[#CFE4FF]">
                Mês de referência
              </Label>
              <p className="text-[10px] text-[rgba(207,228,255,0.5)]">Ex.: 2026-04</p>
              <Input
                id="dash-comp"
                value={competence}
                onChange={(e) => setCompetence(e.target.value)}
                disabled={bootLoading}
                placeholder="Ex.: 2026-04"
                className="w-40 font-mono tabular-nums border-[rgba(38,215,255,.20)] bg-[rgba(38,215,255,.05)] text-[#CFE4FF] placeholder:text-[rgba(207,228,255,0.3)]"
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

      {hasReceivablesPressure ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[rgba(255,165,0,.25)] bg-[rgba(255,165,0,.08)] px-5 py-3.5 text-sm text-[#FFD700] shadow-sm ring-1 ring-[#FFA500]/5">
          <p>
            <span className="font-semibold">Cobranças em aberto:</span> {openItemsCount} cobranças ·{" "}
            {brl(openItemsAmount)}
          </p>
          <Button type="button" variant="outline" size="sm" className="border-[rgba(38,215,255,.30)] bg-[rgba(38,215,255,.08)] text-[#CFE4FF] hover:bg-[rgba(38,215,255,.12)]" asChild>
            <Link href="/financeiro">Ir para financeiro</Link>
          </Button>
        </div>
      ) : null}

      {/* 2. PRIMEIRA FAIXA — faturamento diário + confirmações hoje */}
      <div className="grid gap-5 lg:grid-cols-5 lg:items-stretch">
        <section className="flex min-h-[19rem] flex-col rounded-xl border border-[rgba(38,215,255,.20)] bg-[#0B1220] p-5 shadow-sm ring-1 ring-[#26D7FF]/10 md:p-6 lg:col-span-3">
          <h2 className="text-base font-semibold tracking-tight text-[#CFE4FF] sm:text-[1.05rem]">
            Recebimentos do mês — {competencePretty(debouncedCompetence)}
          </h2>
          <p className="mt-1.5 text-sm leading-relaxed text-[#EAF3FF]">
            Quanto entrou por dia, só com valores <span className="font-medium text-[#CFE4FF]">já recebidos</span>, ao longo
            do mês que escolheu.
          </p>
          <div className="mt-6 flex flex-1 flex-col justify-end">
            {!/^\d{4}-\d{2}$/.test(debouncedCompetence) ? (
              <p className="text-sm text-[#FFB84D]">Indique um mês válido, por exemplo 2026-04.</p>
            ) : invoicesMonthLoading ? (
              <p className="py-10 text-center text-sm text-[rgba(207,228,255,0.5)]">A carregar dados do mês…</p>
            ) : dailyPaidBuckets.days.length === 0 ? (
              <p className="py-10 text-center text-sm text-[rgba(207,228,255,0.5)]">Sem registos neste período.</p>
            ) : (
              <div className="flex h-52 items-end gap-px rounded-b-md border-b border-[rgba(38,215,255,.20)] bg-[rgba(38,215,255,.05)] px-1 pt-2">
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
              <div className="mt-2 flex justify-between text-[0.65rem] text-[rgba(207,228,255,0.4)]">
                <span>1</span>
                <span>Dias</span>
                <span>{dailyPaidBuckets.days.length}</span>
              </div>
            ) : null}
          </div>
        </section>

        <section className="flex min-h-[19rem] flex-col rounded-xl border border-[rgba(38,215,255,.20)] bg-[#0B1220] p-5 shadow-sm ring-1 ring-[#26D7FF]/10 md:p-6 lg:col-span-2">
          <h2 className="text-base font-semibold tracking-tight text-[#CFE4FF] sm:text-[1.05rem]">Entradas confirmadas hoje</h2>
          <p className="mt-1.5 text-sm leading-relaxed text-[#EAF3FF]">
            Entradas registadas hoje, no horário do seu computador.
          </p>
          <div className="mt-auto space-y-3 pt-8">
            {bootLoading ? (
              <p className="text-sm text-[rgba(207,228,255,0.5)]">A carregar…</p>
            ) : paidLoadFailed ? (
              <p className="text-sm text-[#FFB84D]">
                Não foi possível carregar estes números. Atualize a página ou tente mais tarde.
              </p>
            ) : (
              <>
                <div className="rounded-xl border border-[rgba(38,215,255,.20)] bg-[rgba(38,215,255,.08)] px-4 py-3 shadow-sm">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-[#CFE4FF]">Pagamentos recebidos</p>
                  <p className="mt-1 text-3xl font-bold tabular-nums tracking-tight text-[#26D7FF]">{confirmacoesHoje.count}</p>
                </div>
                <div className="rounded-xl border border-[rgba(6,182,212,.25)] bg-[rgba(6,182,212,.08)] px-4 py-3 shadow-sm">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-[#22D3EE]">Recebido hoje</p>
                  <p className="mt-1 text-xl font-bold tabular-nums tracking-tight text-[#06B6D4]">{brl(confirmacoesHoje.sum)}</p>
                </div>
              </>
            )}
          </div>
        </section>
      </div>

      {/* 3. SEGUNDA FAIXA — balanço doughnut + contratos */}
      <div className="grid gap-5 lg:grid-cols-5 lg:items-stretch">
        <section className="flex min-h-[21rem] flex-col rounded-xl border border-[rgba(38,215,255,.20)] bg-[#0B1220] p-5 shadow-sm ring-1 ring-[#26D7FF]/10 md:p-6 lg:col-span-3">
          <h2 className="text-base font-semibold tracking-tight text-[#CFE4FF] sm:text-[1.05rem]">
            Resumo do mês — {competencePretty(debouncedCompetence)}
          </h2>
          <p className="mt-1.5 text-sm leading-relaxed text-[#EAF3FF]">
            Como os recebimentos estão distribuídos entre pagos, em aberto e cancelados neste mês.
          </p>
          <div className="mt-8 flex flex-1 items-center justify-center">
            {!/^\d{4}-\d{2}$/.test(debouncedCompetence) ? (
              <p className="text-sm text-[#FFB84D]">Período inválido. Use o formato ano-mês, por exemplo 2026-04.</p>
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

        <section className="flex min-h-[21rem] flex-col rounded-xl border border-[rgba(38,215,255,.20)] bg-[#0B1220] p-5 shadow-sm ring-1 ring-[#26D7FF]/10 md:p-6 lg:col-span-2">
          <h2 className="text-base font-semibold tracking-tight text-[#CFE4FF] sm:text-[1.05rem]">Situação dos clientes</h2>
          <p className="mt-1.5 text-sm leading-relaxed text-[#EAF3FF]">
            Números de <span className="font-medium text-[#CFE4FF]">{todayLabelPt()}</span>. Contam o estado de cada
            cliente tal como está registado hoje.
          </p>
          <p className="mt-2 rounded-lg border border-[rgba(38,215,255,.15)] bg-[rgba(38,215,255,.05)] px-3 py-2 text-[11px] leading-relaxed text-[rgba(207,228,255,0.6)]">
            Suspenso: pausa por decisão interna. Inadimplente: há dívida em atraso. Bloqueado: corte ou bloqueio explícito.
            Cancelado ou desativado: contrato fora da operação do dia a dia.
          </p>
          <ul className="mt-6 space-y-0 text-sm">
            <li className="flex items-baseline justify-between border-b border-[rgba(38,215,255,.15)] py-3.5">
              <span className="text-[#EAF3FF]">Clientes ativos</span>
              <span className="text-xl font-bold tabular-nums tracking-tight text-[#26D7FF] sm:text-2xl">
                {bootLoading ? "—" : activeClients}
              </span>
            </li>
            <li className="flex items-baseline justify-between border-b border-[rgba(38,215,255,.15)] py-3.5">
              <span className="text-[#EAF3FF]">Suspensos</span>
              <span className="text-lg font-bold tabular-nums tracking-tight text-[#FFB84D] sm:text-xl">
                {bootLoading ? "—" : suspendedClients}
              </span>
            </li>
            <li className="flex items-baseline justify-between border-b border-[rgba(38,215,255,.15)] py-3.5">
              <span className="text-[#EAF3FF]">Cancelados</span>
              <span className="text-lg font-bold tabular-nums tracking-tight text-[rgba(207,228,255,0.7)] sm:text-xl">
                {bootLoading ? "—" : cancelledClients}
              </span>
            </li>
            <li className="flex items-baseline justify-between border-b border-[rgba(38,215,255,.15)] py-3.5">
              <span className="text-[#EAF3FF]">Outras situações</span>
              <span className="text-lg font-bold tabular-nums tracking-tight text-[#CFE4FF] sm:text-xl">
                {bootLoading ? "—" : otherStatusClients}
              </span>
            </li>
            <li className="flex items-baseline justify-between pt-1">
              <span className="font-medium text-[#26D7FF]">Total de clientes</span>
              <span className="text-lg font-bold tabular-nums tracking-tight text-[#CFE4FF] sm:text-xl">
                {bootLoading ? "—" : totalClients}
              </span>
            </li>
          </ul>
          <div className="mt-auto pt-6">
            <Button type="button" variant="outline" size="sm" className="w-full border-[rgba(38,215,255,.30)] text-[#CFE4FF] hover:bg-[rgba(38,215,255,.08)] sm:w-auto" asChild>
              <Link href="/clientes">Ver todos os clientes</Link>
            </Button>
          </div>
        </section>
      </div>

      {/* 4. FAIXA INFERIOR — placeholders honestos */}
      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-xl border border-[rgba(38,215,255,.15)] bg-[rgba(38,215,255,.05)] px-5 py-5 shadow-sm ring-1 ring-[#26D7FF]/5">
          <h3 className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#CFE4FF]">Aniversariantes</h3>
          <p className="mt-2.5 text-sm leading-relaxed text-[#EAF3FF]">
            Em breve: aniversários dos clientes, quando o cadastro passar a incluir data de nascimento.
          </p>
        </div>
        <div className="rounded-xl border border-[rgba(38,215,255,.15)] bg-[rgba(38,215,255,.05)] px-5 py-5 shadow-sm ring-1 ring-[#26D7FF]/5">
          <h3 className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#CFE4FF]">
            Ativações — {debouncedCompetence}
          </h3>
          <p className="mt-2.5 text-sm leading-relaxed text-[#EAF3FF]">
            Em breve: quantas novas ativações houve no mês, assim que o histórico estiver disponível para mostrar com
            segurança.
          </p>
        </div>
        <div className="rounded-xl border border-[rgba(38,215,255,.15)] bg-[rgba(38,215,255,.05)] px-5 py-5 shadow-sm ring-1 ring-[#26D7FF]/5">
          <h3 className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#CFE4FF]">
            Desativações — {debouncedCompetence}
          </h3>
          <p className="mt-2.5 text-sm leading-relaxed text-[#EAF3FF]">
            Em breve: quantos contratos deixaram de estar ativos no mês, com histórico claro por período.
          </p>
        </div>
      </div>

      {/* 5. CARDS FINANCEIROS — faixa horizontal */}
      <section className="space-y-2.5">
        <div className="px-0.5">
          <h2 className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#CFE4FF]">Panorama geral do financeiro</h2>
          <p className="mt-0.5 text-xs leading-relaxed text-[rgba(207,228,255,0.5)]">Soma de todo o histórico; não depende do mês escolhido acima.</p>
        </div>
        <div className="grid auto-rows-fr gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <div className="relative flex min-h-[4.65rem] items-center gap-2 overflow-hidden rounded-xl border border-[rgba(59,130,246,.35)] bg-gradient-to-br from-[#1e40af] to-[#1e3a8a] px-4 py-2 shadow-sm ring-1 ring-[#60A5FA]/20">
            <div className="relative z-10 flex min-w-0 flex-1 flex-col justify-center gap-1">
              <div className="flex flex-wrap items-baseline gap-x-1 gap-y-0">
                <span className="text-[9px] font-semibold uppercase tracking-[0.1em] text-[#BAE6FD]">Por receber</span>
                <span className="rounded-full bg-[#0369A1]/40 px-1 py-0 text-[8px] font-semibold tabular-nums leading-none text-[#E0F2FE] ring-1 ring-[#06B6D4]/30">
                  {bootLoading || !summaryGlobal ? "—" : pendingCount}
                </span>
              </div>
              <p className="text-[1.4rem] font-bold leading-[1.05] tracking-tight text-[#E0F2FE] tabular-nums sm:text-[1.5rem]">
                {bootLoading || !summaryGlobal ? "—" : brl(pendingAmount)}
              </p>
            </div>
            <div className="relative z-10 flex shrink-0 items-center pl-0.5" aria-hidden>
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#0369A1]/30 shadow-[inset_0_1px_0_rgba(255,255,255,0.1)] ring-1 ring-[#06B6D4]/40">
                <Wallet className="h-3.5 w-3.5 text-[#BAE6FD]" strokeWidth={2} />
              </div>
            </div>
          </div>

          <div className="relative flex min-h-[4.65rem] items-center gap-2 overflow-hidden rounded-xl border border-[rgba(239,68,68,.35)] bg-gradient-to-br from-[#991B1B] to-[#7F1D1D] px-4 py-2 shadow-sm ring-1 ring-[#FCA5A5]/20">
            <div className="relative z-10 flex min-w-0 flex-1 flex-col justify-center gap-1">
              <div className="flex flex-wrap items-baseline gap-x-1 gap-y-0">
                <span className="text-[9px] font-semibold uppercase tracking-[0.1em] text-[#FECACA]">Em atraso</span>
                <span className="rounded-full bg-[#7F1D1D]/40 px-1 py-0 text-[8px] font-semibold tabular-nums leading-none text-[#FEE2E2] ring-1 ring-[#EF4444]/30">
                  {bootLoading || !summaryGlobal ? "—" : overdueCount}
                </span>
              </div>
              <p className="text-[1.4rem] font-bold leading-[1.05] tracking-tight text-[#FECACA] tabular-nums sm:text-[1.5rem]">
                {bootLoading || !summaryGlobal ? "—" : brl(overdueAmount)}
              </p>
            </div>
            <div className="relative z-10 flex shrink-0 items-center pl-0.5" aria-hidden>
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#7F1D1D]/40 shadow-[inset_0_1px_0_rgba(255,255,255,0.1)] ring-1 ring-[#EF4444]/40">
                <AlertCircle className="h-3.5 w-3.5 text-[#FECACA]" strokeWidth={2} />
              </div>
            </div>
          </div>

          <div className="relative flex min-h-[4.65rem] items-center gap-2 overflow-hidden rounded-xl border border-[rgba(34,197,94,.35)] bg-gradient-to-br from-[#065F46] to-[#0B5345] px-4 py-2 shadow-sm ring-1 ring-[#86EFAC]/20">
            <div className="relative z-10 flex min-w-0 flex-1 flex-col justify-center gap-1">
              <div className="flex flex-wrap items-baseline gap-x-1 gap-y-0">
                <span className="text-[9px] font-semibold uppercase tracking-[0.1em] text-[#BBFBEE]">Já recebido</span>
                <span className="rounded-full bg-[#0B5345]/40 px-1 py-0 text-[8px] font-semibold tabular-nums leading-none text-[#CCFBF1] ring-1 ring-[#14B8A6]/30">
                  {bootLoading || !summaryGlobal ? "—" : (summaryGlobal.paid?.count ?? 0)}
                </span>
              </div>
              <p className="text-[1.4rem] font-bold leading-[1.05] tracking-tight text-[#BBFBEE] tabular-nums sm:text-[1.5rem]">
                {bootLoading || !summaryGlobal ? "—" : brl(summaryGlobal.paid?.amount)}
              </p>
            </div>
            <div className="relative z-10 flex shrink-0 items-center pl-0.5" aria-hidden>
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#0B5345]/40 shadow-[inset_0_1px_0_rgba(255,255,255,0.1)] ring-1 ring-[#14B8A6]/40">
                <BadgeCheck className="h-3.5 w-3.5 text-[#BBFBEE]" strokeWidth={2} />
              </div>
            </div>
          </div>

          <div className="relative flex min-h-[4.65rem] items-center gap-2 overflow-hidden rounded-xl border border-[rgba(38,215,255,.25)] bg-[rgba(38,215,255,.08)] px-4 py-2 shadow-sm ring-1 ring-[#26D7FF]/10">
            <div className="relative z-10 flex min-w-0 flex-1 flex-col justify-center gap-1">
              <div className="flex flex-wrap items-baseline gap-x-1 gap-y-0">
                <span className="text-[9px] font-semibold uppercase tracking-[0.1em] text-[#CFE4FF]">Volume total</span>
                <span className="rounded-full bg-[rgba(38,215,255,.15)] px-1 py-0 text-[8px] font-semibold tabular-nums leading-none text-[#CFE4FF] ring-1 ring-[#26D7FF]/30">
                  {bootLoading || !summaryGlobal ? "—" : (summaryGlobal.totalInvoices ?? 0)}
                </span>
              </div>
              <p className="text-[1.4rem] font-bold leading-[1.05] tracking-tight text-[#26D7FF] tabular-nums sm:text-[1.5rem]">
                {bootLoading || !summaryGlobal ? "—" : brl(summaryGlobal.totalAmount)}
              </p>
            </div>
            <div className="relative z-10 flex shrink-0 items-center pl-0.5" aria-hidden>
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[rgba(38,215,255,.15)] ring-1 ring-[#26D7FF]/30 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]">
                <PieChart className="h-3.5 w-3.5 text-[#CFE4FF]" strokeWidth={2} />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Sistema + planos — linha compacta */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-xl border border-[rgba(38,215,255,.20)] bg-[#0B1220] px-5 py-3.5 text-sm text-[#EAF3FF] shadow-sm ring-1 ring-[#26D7FF]/10">
        <span className="flex items-center gap-2 font-medium text-[#CFE4FF]">
          <Activity className="h-4 w-4 text-[#26D7FF]" />
          Situação do Painel DC NET
        </span>
        {bootLoading ? (
          <span className="text-[rgba(207,228,255,0.5)]">…</span>
        ) : sysOk ? (
          <Badge variant="success">Tudo a funcionar</Badge>
        ) : (
          <Badge variant="warning">Com limitações</Badge>
        )}
        <span className="text-[rgba(207,228,255,0.7)]">
          {health?.systemMode ?? "—"}
          {" · "}
          {health?.database === "connected"
            ? "Sistema conectado"
            : `Ligação: ${health?.database ?? "—"}`}
        </span>
        <span className="hidden h-4 w-px bg-[rgba(38,215,255,.20)] sm:inline-block" />
        <span className="flex items-center gap-1 text-[rgba(207,228,255,0.7)]">
          <Wallet className="h-4 w-4 text-[#CFE4FF]" />
          Planos em uso: {bootLoading ? "—" : plans.filter((p) => p.isActive !== false).length} / {bootLoading ? "—" : plans.length}
        </span>
        <span className="flex items-center gap-1 text-[rgba(207,228,255,0.7)]">
          <Users className="h-4 w-4 text-[#CFE4FF]" />
          <Link href="/planos" className="font-medium text-[#26D7FF] underline-offset-2 hover:underline">
            Ver planos
          </Link>
        </span>
      </div>

      {/* Tabela resumo de clientes */}
      <div className="overflow-hidden rounded-xl border border-[rgba(38,215,255,.20)] bg-[#0B1220] shadow-sm ring-1 ring-[#26D7FF]/10">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[rgba(38,215,255,.20)] bg-[rgba(38,215,255,.05)] px-5 py-3.5">
          <div>
            <h3 className="text-sm font-semibold tracking-tight text-[#CFE4FF]">Resumo dos clientes</h3>
            <p className="mt-0.5 text-[11px] text-[rgba(207,228,255,0.5)]">Até {TABLE_PREVIEW} linhas · ajuste a pesquisa ao lado</p>
          </div>
          <div className="flex min-w-[12rem] flex-1 flex-col gap-1 sm:max-w-xs">
            <Label htmlFor="dash-client-filter" className="sr-only">
              Pesquisar clientes
            </Label>
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#CFE4FF]" />
              <Input
                id="dash-client-filter"
                placeholder="Nome, documento, telefone, e-mail…"
                value={clientFilter}
                onChange={(e) => setClientFilter(e.target.value)}
                disabled={bootLoading}
                className="border-[rgba(38,215,255,.20)] bg-[rgba(38,215,255,.05)] text-[#CFE4FF] placeholder:text-[rgba(207,228,255,0.3)] pl-9"
              />
            </div>
          </div>
          <Button
            type="button"
            size="sm"
            className="border-0 bg-[#26D7FF] font-semibold text-[#020617] hover:bg-[#CFE4FF]"
            asChild
          >
            <Link href="/clientes">Ver todos</Link>
          </Button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-[rgba(38,215,255,.15)] bg-[rgba(38,215,255,.05)] text-[10px] font-semibold uppercase tracking-[0.08em] text-[#CFE4FF]">
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
                  <td colSpan={5} className="px-5 py-10 text-center text-sm text-[rgba(207,228,255,0.5)]">
                    A carregar a lista…
                  </td>
                </tr>
              ) : tableRows.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-5 py-10 text-center text-sm text-[rgba(207,228,255,0.5)]">
                    {clients.length === 0
                      ? "Ainda não há clientes para mostrar."
                      : "Nenhum cliente corresponde à pesquisa."}
                  </td>
                </tr>
              ) : (
                tableRows.map((c) => (
                  <tr key={c._id} className="border-b border-[rgba(38,215,255,.10)] transition-colors hover:bg-[rgba(38,215,255,.08)]">
                    <td className="px-5 py-3 font-medium text-[#CFE4FF]">{c.fullName}</td>
                    <td className="px-5 py-3 tabular-nums text-[rgba(207,228,255,0.6)]">{c.document ?? "—"}</td>
                    <td className="px-5 py-3">
                      <Badge variant={clientStatusBadgeVariant(c.status)}>{clientStatusLabelPt(c.status)}</Badge>
                    </td>
                    <td className="max-w-[12rem] truncate px-5 py-3 text-[#EAF3FF]">{planLabel(c.planId)}</td>
                    <td className="px-5 py-3 text-right">
                      <Link
                        href="/clientes"
                        className="text-xs font-semibold text-[#26D7FF] underline-offset-2 hover:underline"
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
