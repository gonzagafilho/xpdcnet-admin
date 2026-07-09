"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  CalendarDays,
  CheckCircle2,
  Clock3,
  FileText,
  Search,
  TrendingUp,
  UserCheck,
  UserMinus,
  UserPlus,
  Users,
  Wallet,
} from "lucide-react";
import { apiFetch } from "@/lib/api-client";
import { formatBRL, type ClientFromApi, type InvoiceFromApi, type InvoiceStatus } from "@/lib/api-types";
import { userFacingApiError } from "@/lib/user-facing-api-error";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { StatCard } from "@/components/ui/stat-card";

function currentCompetence(): string {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  return `${d.getFullYear()}-${m}`;
}

function dateTimeLabel(value?: string | null) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(new Date(value));
}

function dateKey(value?: string | null) {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${dd}`;
}

function statusLabel(status?: string): string {
  const map: Record<string, string> = {
    pending: "Pendente",
    paid: "Pago",
    overdue: "Em atraso",
    cancelled: "Cancelado",
    active: "Ativo",
    suspended: "Suspenso",
    disabled: "Desativado",
  };
  return map[String(status || "")] || String(status || "-");
}

export default function ComercialExecutivoPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [clients, setClients] = useState<ClientFromApi[]>([]);
  const [invoices, setInvoices] = useState<InvoiceFromApi[]>([]);
  const [competence, setCompetence] = useState(currentCompetence);
  const [debouncedCompetence, setDebouncedCompetence] = useState(currentCompetence);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedCompetence(competence.trim()), 320);
    return () => clearTimeout(timer);
  }, [competence]);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search.trim().toLowerCase()), 280);
    return () => clearTimeout(timer);
  }, [search]);

  const load = useCallback(async () => {
    setError(null);
    const [clientRows, invoiceRows] = await Promise.all([
      apiFetch<ClientFromApi[]>("/clients"),
      apiFetch<InvoiceFromApi[]>("/invoices"),
    ]);
    setClients(Array.isArray(clientRows) ? clientRows : []);
    setInvoices(Array.isArray(invoiceRows) ? invoiceRows : []);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await load();
      } catch (reason) {
        if (!cancelled) setError(userFacingApiError(reason));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [load]);

  const filteredClients = useMemo(() => {
    if (!debouncedSearch) return clients;
    return clients.filter((client) => {
      const text = [client.fullName, client.document, client.phone, client.email]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return text.includes(debouncedSearch);
    });
  }, [clients, debouncedSearch]);

  const invoicesByCompetence = useMemo(() => {
    if (!/^\d{4}-\d{2}$/.test(debouncedCompetence)) return [];
    return invoices.filter((invoice) => invoice.competence === debouncedCompetence);
  }, [invoices, debouncedCompetence]);

  const leads = useMemo(
    () => filteredClients.filter((client) => ["pending", "delinquent"].includes(client.status)).length,
    [filteredClients],
  );

  const propostas = useMemo(
    () => invoicesByCompetence.filter((invoice) => invoice.status === ("pending" as InvoiceStatus)).length,
    [invoicesByCompetence],
  );

  const instalacoes = useMemo(
    () => filteredClients.filter((client) => client.status === "active").length,
    [filteredClients],
  );

  const conversao = useMemo(() => {
    const base = leads + instalacoes;
    if (!base) return 0;
    return (instalacoes / base) * 100;
  }, [instalacoes, leads]);

  const today = useMemo(() => {
    const now = new Date();
    const m = String(now.getMonth() + 1).padStart(2, "0");
    const d = String(now.getDate()).padStart(2, "0");
    return `${now.getFullYear()}-${m}-${d}`;
  }, []);

  const agendaHoje = useMemo(
    () => invoicesByCompetence.filter((invoice) => dateKey(invoice.dueDate) === today),
    [invoicesByCompetence, today],
  );

  const vendasMes = useMemo(
    () =>
      invoicesByCompetence
        .filter((invoice) => invoice.status === "paid")
        .reduce((sum, invoice) => sum + Number(invoice.amount || 0), 0),
    [invoicesByCompetence],
  );

  const clientesGanhos = useMemo(
    () =>
      filteredClients.filter((client) => {
        const created = (client as { createdAt?: string | null }).createdAt;
        return client.status === "active" && String(created || "").startsWith(`${debouncedCompetence}-`);
      }).length,
    [filteredClients, debouncedCompetence],
  );

  const clientesPerdidos = useMemo(
    () =>
      filteredClients.filter((client) => {
        const created = (client as { createdAt?: string | null }).createdAt;
        return ["cancelled", "disabled"].includes(client.status) && String(created || "").startsWith(`${debouncedCompetence}-`);
      }).length,
    [filteredClients, debouncedCompetence],
  );

  const topRows = useMemo(() => filteredClients.slice(0, 10), [filteredClients]);

  const setQuickCompetence = (kind: "current" | "previous") => {
    const base = new Date();
    if (kind === "previous") base.setMonth(base.getMonth() - 1);
    const m = String(base.getMonth() + 1).padStart(2, "0");
    setCompetence(`${base.getFullYear()}-${m}`);
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-dcnet-text">Comercial executivo</h1>
          <p className="text-sm text-dcnet-muted">Visão rápida para decidir hoje.</p>
        </div>
        <div className="flex gap-2">
          <Button type="button" variant="outline" onClick={() => void load()} disabled={loading}>
            Atualizar
          </Button>
          <Button type="button" asChild>
            <Link href="/dashboard">Voltar dashboard</Link>
          </Button>
        </div>
      </div>

      {error ? <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</div> : null}

      <Card>
        <CardContent className="grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-1.5 sm:col-span-2 lg:col-span-1">
            <Label htmlFor="comercial-competence" className="text-xs font-semibold uppercase tracking-wide text-dcnet-muted">
              Mês
            </Label>
            <Input
              id="comercial-competence"
              value={competence}
              onChange={(event) => setCompetence(event.target.value)}
              placeholder="2026-07"
              className="font-mono"
            />
            <div className="flex flex-wrap gap-2 pt-1">
              <Button type="button" size="sm" variant="outline" onClick={() => setQuickCompetence("current")}>Atual</Button>
              <Button type="button" size="sm" variant="outline" onClick={() => setQuickCompetence("previous")}>Anterior</Button>
            </div>
          </div>
          <div className="space-y-1.5 sm:col-span-2 lg:col-span-3">
            <Label htmlFor="comercial-search" className="text-xs font-semibold uppercase tracking-wide text-dcnet-muted">
              Busca
            </Label>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-dcnet-muted" />
              <Input
                id="comercial-search"
                placeholder="Buscar cliente"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                className="pl-9"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {loading ? (
          Array.from({ length: 8 }).map((_, idx) => (
            <div key={idx} className="xp-card-surface h-20 p-4">
              <Skeleton className="h-3 w-24" />
              <Skeleton className="mt-3 h-6 w-16" />
            </div>
          ))
        ) : (
          <>
            <StatCard label="Novos leads" value={leads} icon={UserPlus} tone="info" compact />
            <StatCard label="Propostas" value={propostas} icon={FileText} tone="primary" compact />
            <StatCard label="Instalações" value={instalacoes} icon={Users} tone="success" compact />
            <StatCard label="Conversão" value={`${conversao.toFixed(1)}%`} icon={TrendingUp} tone="primary" compact />
            <StatCard label="Agenda" value={agendaHoje.length} icon={Clock3} tone="warning" compact />
            <StatCard label="Vendas do mês" value={formatBRL(vendasMes)} icon={Wallet} tone="success" compact />
            <StatCard label="Clientes ganhos" value={clientesGanhos} icon={UserCheck} tone="success" compact />
            <StatCard label="Clientes perdidos" value={clientesPerdidos} icon={UserMinus} tone="error" compact />
          </>
        )}
      </section>

      <section className="grid gap-3 lg:grid-cols-2">
        <Card className="xp-card-surface">
          <CardHeader>
            <CardTitle className="text-base">Agenda de hoje</CardTitle>
          </CardHeader>
          <CardContent>
            {agendaHoje.length ? (
              <div className="space-y-2">
                {agendaHoje.slice(0, 8).map((invoice) => (
                  <div key={invoice._id} className="rounded-xl border border-dcnet-border px-3 py-2">
                    <p className="text-sm font-semibold text-dcnet-text">{invoice.competence}</p>
                    <p className="text-xs text-dcnet-muted">Vence em {dateTimeLabel(invoice.dueDate)}</p>
                    <p className="text-sm text-dcnet-text">{formatBRL(invoice.amount)}</p>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState
                icon={<CalendarDays className="h-5 w-5" />}
                title="Sem agenda hoje"
                description="Sem vencimentos para hoje."
                className="py-8"
              />
            )}
          </CardContent>
        </Card>

        <Card className="xp-card-surface">
          <CardHeader>
            <CardTitle className="text-base">Clientes na busca</CardTitle>
          </CardHeader>
          <CardContent>
            {topRows.length ? (
              <div className="space-y-2">
                {topRows.map((client) => (
                  <div key={client._id} className="flex items-center justify-between gap-3 rounded-xl border border-dcnet-border px-3 py-2">
                    <div>
                      <p className="text-sm font-semibold text-dcnet-text">{client.fullName}</p>
                      <p className="text-xs text-dcnet-muted">{client.email || client.phone || "Sem contato"}</p>
                    </div>
                    <Badge variant={client.status === "active" ? "success" : "warning"}>{statusLabel(client.status)}</Badge>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState
                icon={<CheckCircle2 className="h-5 w-5" />}
                title="Sem clientes aqui"
                description="Tente outra busca."
                className="py-8"
              />
            )}
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
