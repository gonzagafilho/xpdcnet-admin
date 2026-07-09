"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  CalendarDays,
  CheckCircle2,
  CreditCard,
  FileText,
  MessageSquare,
  MessageCircle,
  PauseCircle,
  PenSquare,
  Phone,
  PlayCircle,
  PlusCircle,
  QrCode,
  Ticket,
  UserRound,
  Wifi,
} from "lucide-react";
import { apiFetch } from "@/lib/api-client";
import { userFacingApiError } from "@/lib/user-facing-api-error";
import { clientStatusBadgeVariant, clientStatusLabelPt } from "@/lib/client-status";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";

type DetailPayload = {
  client: {
    id: string;
    fullName: string;
    document: string;
    phone: string;
    email: string;
    address: {
      zip?: string;
      street?: string;
      number?: string;
      neighborhood?: string;
      city?: string;
      state?: string;
      reference?: string;
    };
    plan: { id: string; name: string; speedMbps: number; price: number } | null;
    monthlyPrice: number;
    dueDay: number;
    status: string;
    notes: string;
    contract: Record<string, unknown>;
    createdAt: string | null;
  };
  accesses: Array<{
    id: string;
    username: string;
    status: string;
    plan: { name: string; speedMbps: number | null; price: number | null };
    server: { name: string; host: string };
    networkNode: { name: string; code: string } | null;
    source: string;
  }>;
  invoices: Array<{ id: string; amount: number; dueDate: string; status: string; competence: string }>;
  tickets: Array<{ protocol: string; subject: string; status: string; createdAt: string }>;
  logs: Array<{ action: string; status: string; createdAt: string; errorMessage: string }>;
};

type TimelinePayload = {
  events: Array<{ type: string; title: string; detail: string; at: string }>;
};

type TimelineItem = {
  when: string;
  title: string;
  detail: string;
  source: string;
};

function money(value?: number | null) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(value || 0));
}

function dateTime(value?: string | null) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(new Date(value));
}

function normalizePhone(phone?: string | null) {
  return String(phone || "").replace(/\D/g, "");
}

function addressLabel(address: DetailPayload["client"]["address"]) {
  const line = [address.street, address.number, address.neighborhood, address.city, address.state].filter(Boolean).join(", ");
  return line || "Não informado";
}

function summarizeFinance(invoices: DetailPayload["invoices"]) {
  const pending = invoices.filter((invoice) => invoice.status === "pending").length;
  const overdue = invoices.filter((invoice) => invoice.status === "overdue").length;
  const paid = invoices.filter((invoice) => invoice.status === "paid").length;
  const openAmount = invoices
    .filter((invoice) => ["pending", "overdue"].includes(invoice.status))
    .reduce((sum, invoice) => sum + Number(invoice.amount || 0), 0);
  return { pending, overdue, paid, openAmount };
}

export default function Cliente360Page() {
  const params = useParams<{ id: string }>();
  const clientId = String(params?.id || "");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [data, setData] = useState<DetailPayload | null>(null);
  const [timelineApi, setTimelineApi] = useState<TimelinePayload | null>(null);

  const load = useCallback(async () => {
    if (!clientId) return;
    setError(null);
    const [details, timeline] = await Promise.all([
      apiFetch<DetailPayload>(`/clients/${clientId}/operational-details`),
      apiFetch<TimelinePayload>(`/operations/client/${clientId}/timeline`).catch(() => null),
    ]);
    setData(details);
    setTimelineApi(timeline);
  }, [clientId]);

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

  const finance = useMemo(() => summarizeFinance(data?.invoices || []), [data?.invoices]);

  const timeline = useMemo<TimelineItem[]>(() => {
    const items: TimelineItem[] = [];

    for (const event of timelineApi?.events || []) {
      items.push({ when: event.at, title: event.title, detail: event.detail, source: "Resumo" });
    }
    for (const ticket of data?.tickets || []) {
      items.push({
        when: ticket.createdAt,
        title: `Chamado ${ticket.protocol}`,
        detail: ticket.subject,
        source: "Atendimento",
      });
    }
    for (const invoice of data?.invoices || []) {
      items.push({
        when: invoice.dueDate,
        title: `Fatura ${invoice.competence}`,
        detail: `${money(invoice.amount)} · ${invoice.status}`,
        source: "Financeiro",
      });
    }
    for (const log of data?.logs || []) {
      items.push({
        when: log.createdAt,
        title: log.action,
        detail: log.status,
        source: "Histórico",
      });
    }

    return items
      .filter((item) => item.when)
      .sort((a, b) => new Date(b.when).getTime() - new Date(a.when).getTime());
  }, [data?.invoices, data?.logs, data?.tickets, timelineApi?.events]);

  const currentStatus = data?.client.status || "";
  const canSuspend = currentStatus === "active";
  const canReactivate = ["disabled", "pending"].includes(currentStatus);

  const changeStatus = async (status: "active" | "disabled") => {
    if (!data?.client.id) return;
    setSaving(true);
    setNotice(null);
    try {
      await apiFetch(`/clients/${data.client.id}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      });
      setNotice(status === "active" ? "Cliente reativado." : "Cliente suspenso.");
      await load();
    } catch (reason) {
      setError(userFacingApiError(reason));
    } finally {
      setSaving(false);
    }
  };

  const whatsappHref = useMemo(() => {
    const digits = normalizePhone(data?.client.phone);
    if (!digits) return "https://wa.me/5561996627145";
    return `https://wa.me/55${digits}`;
  }, [data?.client.phone]);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <Button type="button" variant="outline" size="sm" asChild>
              <Link href="/clientes">
                <ArrowLeft className="h-4 w-4" /> Voltar
              </Link>
            </Button>
          </div>
          <h1 className="mt-2 text-xl font-bold tracking-tight text-dcnet-text">Cliente 360°</h1>
          <p className="text-sm text-dcnet-muted">Tudo do cliente em um lugar.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" asChild>
            <a href={whatsappHref} target="_blank" rel="noreferrer">
              <MessageCircle className="h-4 w-4" /> WhatsApp
            </a>
          </Button>
          <Button type="button" variant="outline" asChild>
            <Link href="/financeiro">
              <QrCode className="h-4 w-4" /> PIX
            </Link>
          </Button>
          <Button type="button" variant="outline" asChild>
            <Link href="/financeiro">
              <PlusCircle className="h-4 w-4" /> Nova fatura
            </Link>
          </Button>
          <Button type="button" variant="outline" asChild>
            <Link href="/chamados">
              <MessageSquare className="h-4 w-4" /> Abrir chamado
            </Link>
          </Button>
          <Button type="button" variant="outline" asChild>
            <Link href="/clientes">
              <PenSquare className="h-4 w-4" /> Editar cadastro
            </Link>
          </Button>
          <Button type="button" variant="outline" disabled={!canSuspend || saving} onClick={() => void changeStatus("disabled")}>
            <PauseCircle className="h-4 w-4" /> Suspender
          </Button>
          <Button type="button" disabled={!canReactivate || saving} onClick={() => void changeStatus("active")}>
            <PlayCircle className="h-4 w-4" /> Reativar
          </Button>
        </div>
      </div>

      {error ? <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</div> : null}
      {notice ? <div className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{notice}</div> : null}

      {loading ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <Card key={index} className="xp-card-surface">
              <CardContent className="space-y-3 p-4">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-6 w-40" />
                <Skeleton className="h-4 w-32" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : null}

      {data ? (
        <>
          <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <Card className="xp-card-surface">
              <CardContent className="p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-dcnet-muted">Cliente</p>
                <p className="mt-1 text-base font-semibold text-dcnet-text">{data.client.fullName}</p>
                <div className="mt-2 flex items-center gap-2">
                  <Badge variant={clientStatusBadgeVariant(data.client.status as never)}>{clientStatusLabelPt(data.client.status as never)}</Badge>
                </div>
              </CardContent>
            </Card>
            <Card className="xp-card-surface">
              <CardContent className="p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-dcnet-muted">Internet</p>
                <p className="mt-1 text-base font-semibold text-dcnet-text">{data.accesses.length} acesso(s)</p>
                <p className="mt-1 text-xs text-dcnet-muted">{data.accesses[0]?.plan?.name || "Plano não informado"}</p>
              </CardContent>
            </Card>
            <Card className="xp-card-surface">
              <CardContent className="p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-dcnet-muted">Financeiro</p>
                <p className="mt-1 text-base font-semibold text-dcnet-text">{money(finance.openAmount)}</p>
                <p className="mt-1 text-xs text-dcnet-muted">Em aberto no momento.</p>
              </CardContent>
            </Card>
            <Card className="xp-card-surface">
              <CardContent className="p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-dcnet-muted">Atendimento</p>
                <p className="mt-1 text-base font-semibold text-dcnet-text">{data.tickets.length} chamado(s)</p>
                <p className="mt-1 text-xs text-dcnet-muted">Acompanhe o histórico recente.</p>
              </CardContent>
            </Card>
          </section>

          <section className="grid gap-3 xl:grid-cols-2">
            <Card className="xp-card-surface">
              <CardHeader>
                <CardTitle className="text-base">Cliente</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-3 text-sm sm:grid-cols-2">
                <Info icon={UserRound} label="Nome" value={data.client.fullName} />
                <Info icon={Phone} label="Telefone" value={data.client.phone || "Não informado"} />
                <Info icon={MessageCircle} label="E-mail" value={data.client.email || "Não informado"} />
                <Info icon={FileText} label="Documento" value={data.client.document || "Não informado"} />
                <Info icon={CalendarDays} label="Vencimento" value={`Dia ${data.client.dueDay || 10}`} />
                <Info icon={CreditCard} label="Mensalidade" value={money(data.client.monthlyPrice)} />
                <div className="sm:col-span-2">
                  <Info icon={UserRound} label="Endereço" value={addressLabel(data.client.address)} />
                </div>
              </CardContent>
            </Card>

            <Card className="xp-card-surface">
              <CardHeader>
                <CardTitle className="text-base">Internet</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                {data.accesses.length ? (
                  data.accesses.slice(0, 3).map((access) => (
                    <div key={access.id} className="rounded-xl border border-dcnet-border p-3">
                      <p className="font-semibold text-dcnet-text">{access.username}</p>
                      <p className="text-xs text-dcnet-muted">{access.plan?.name || "Plano não informado"}</p>
                      <p className="text-xs text-dcnet-muted">{access.server?.name || "Servidor não informado"}</p>
                    </div>
                  ))
                ) : (
                  <EmptyState title="Sem internet vinculada" description="Vínculo será exibido aqui." icon={<Wifi className="h-5 w-5" />} className="py-8" />
                )}
              </CardContent>
            </Card>

            <Card className="xp-card-surface">
              <CardHeader>
                <CardTitle className="text-base">Financeiro</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-3 sm:grid-cols-2">
                <Info icon={CreditCard} label="Pendentes" value={String(finance.pending)} />
                <Info icon={CreditCard} label="Vencidas" value={String(finance.overdue)} />
                <Info icon={CheckCircle2} label="Pagas" value={String(finance.paid)} />
                <Info icon={CreditCard} label="Total aberto" value={money(finance.openAmount)} />
              </CardContent>
            </Card>

            <Card className="xp-card-surface">
              <CardHeader>
                <CardTitle className="text-base">Atendimento</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                {data.tickets.length ? (
                  data.tickets.slice(0, 4).map((ticket) => (
                    <div key={ticket.protocol} className="rounded-xl border border-dcnet-border p-3">
                      <p className="font-semibold text-dcnet-text">{ticket.protocol}</p>
                      <p className="text-xs text-dcnet-muted">{ticket.subject}</p>
                      <p className="text-xs text-dcnet-muted">{dateTime(ticket.createdAt)}</p>
                    </div>
                  ))
                ) : (
                  <EmptyState title="Sem chamados" description="Atendimento está em dia." icon={<Ticket className="h-5 w-5" />} className="py-8" />
                )}
              </CardContent>
            </Card>

            <Card className="xp-card-surface">
              <CardHeader>
                <CardTitle className="text-base">Contratos</CardTitle>
              </CardHeader>
              <CardContent>
                {Object.entries(data.client.contract || {}).filter(([, value]) => value != null && String(value).trim()).length ? (
                  <div className="space-y-2 text-sm">
                    {Object.entries(data.client.contract || {})
                      .filter(([, value]) => value != null && String(value).trim())
                      .slice(0, 8)
                      .map(([key, value]) => (
                        <div key={key} className="flex items-start justify-between gap-3 rounded-xl border border-dcnet-border px-3 py-2">
                          <p className="text-xs font-semibold uppercase text-dcnet-muted">{key}</p>
                          <p className="text-right text-sm text-dcnet-text">{String(value)}</p>
                        </div>
                      ))}
                  </div>
                ) : (
                  <EmptyState title="Sem contratos" description="Contrato aparecerá quando disponível." icon={<FileText className="h-5 w-5" />} className="py-8" />
                )}
              </CardContent>
            </Card>

            <Card className="xp-card-surface">
              <CardHeader>
                <CardTitle className="text-base">Timeline</CardTitle>
              </CardHeader>
              <CardContent>
                {timeline.length ? (
                  <div className="space-y-2">
                    {timeline.slice(0, 12).map((item, index) => (
                      <div key={`${item.when}-${index}`} className="rounded-xl border border-dcnet-border p-3">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-sm font-semibold text-dcnet-text">{item.title}</p>
                          <p className="text-xs text-dcnet-muted">{dateTime(item.when)}</p>
                        </div>
                        <p className="mt-1 text-xs text-dcnet-muted">{item.source}</p>
                        <p className="mt-1 text-sm text-dcnet-text">{item.detail || "Sem detalhe"}</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <EmptyState title="Sem histórico" description="Novos eventos aparecerão aqui." icon={<CalendarDays className="h-5 w-5" />} className="py-8" />
                )}
              </CardContent>
            </Card>
          </section>
        </>
      ) : null}
    </div>
  );
}

function Info({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl border border-dcnet-border px-3 py-2">
      <p className="flex items-center gap-2 text-xs font-semibold uppercase text-dcnet-muted">
        <Icon className="h-3.5 w-3.5" /> {label}
      </p>
      <p className="mt-1 text-sm text-dcnet-text">{value}</p>
    </div>
  );
}
