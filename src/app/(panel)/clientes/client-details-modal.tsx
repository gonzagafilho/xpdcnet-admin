"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api-client";
import { userFacingApiError } from "@/lib/user-facing-api-error";
import { formatBRL } from "@/lib/api-types";
import { clientStatusBadgeVariant, clientStatusLabelPt } from "@/lib/client-status";
import { Modal } from "@/components/ui/modal";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Pencil, Router, UserRound } from "lucide-react";

type DetailPayload = {
  client: {
    id: string;
    fullName: string;
    document: string;
    phone: string;
    email: string;
    address: { zip?: string; street?: string; number?: string; neighborhood?: string; city?: string; state?: string; reference?: string };
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
  attachments: unknown[];
};

type Tab = "personal" | "contracts" | "billing" | "tickets" | "logs" | "attachments" | "accesses";

const tabs: Array<{ id: Tab; label: string }> = [
  { id: "personal", label: "Dados pessoais" },
  { id: "contracts", label: "Contratos" },
  { id: "billing", label: "Cobranças" },
  { id: "tickets", label: "Chamados" },
  { id: "logs", label: "Logs de conexão" },
  { id: "attachments", label: "Anexos" },
  { id: "accesses", label: "Acessos de internet" },
];

function dateLabel(value?: string | null) {
  if (!value) return "Não informado";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Não informado" : date.toLocaleDateString("pt-BR");
}

function Field({ label, value }: { label: string; value?: string | number | null }) {
  return (
    <div>
      <dt className="text-[11px] font-semibold uppercase text-slate-500">{label}</dt>
      <dd className="mt-1 break-words text-sm text-slate-900">{value === "" || value == null ? "Não informado" : value}</dd>
    </div>
  );
}

export function ClientDetailsModal({
  open,
  onOpenChange,
  clientId,
  onEdit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clientId: string | null;
  onEdit: () => void;
}) {
  const [tab, setTab] = useState<Tab>("personal");
  const [data, setData] = useState<DetailPayload | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !clientId) return;
    let cancelled = false;
    setTab("personal");
    setLoading(true);
    setError(null);
    setData(null);
    apiFetch<DetailPayload>(`/clients/${clientId}/operational-details`)
      .then((payload) => { if (!cancelled) setData(payload); })
      .catch((reason) => { if (!cancelled) setError(userFacingApiError(reason)); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [open, clientId]);

  const address = data?.client.address;
  const addressLine = address
    ? [address.street, address.number, address.neighborhood, address.city, address.state].filter(Boolean).join(", ")
    : "";

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title={data?.client.fullName || "Detalhes do cliente"}
      description="Visão geral consolidada, sem credenciais sensíveis."
      className="max-w-5xl"
    >
      {loading ? <p className="py-16 text-center text-sm text-slate-500">Carregando dados do cliente...</p> : null}
      {error ? <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</div> : null}
      {data ? (
        <div className="space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700"><UserRound className="h-5 w-5" /></div>
              <div>
                <Badge variant={clientStatusBadgeVariant(data.client.status as never)}>{clientStatusLabelPt(data.client.status as never)}</Badge>
                <p className="mt-1 text-xs text-slate-500">Cliente desde {dateLabel(data.client.createdAt)}</p>
              </div>
            </div>
            <Button type="button" variant="outline" size="sm" onClick={onEdit}><Pencil className="h-3.5 w-3.5" /> Editar cadastro</Button>
          </div>

          <div className="flex gap-1 overflow-x-auto border-b border-slate-200" role="tablist">
            {tabs.map((item) => (
              <button key={item.id} type="button" onClick={() => setTab(item.id)} className={`whitespace-nowrap border-b-2 px-3 py-2 text-xs font-medium ${tab === item.id ? "border-emerald-600 text-emerald-700" : "border-transparent text-slate-500 hover:text-slate-800"}`}>
                {item.label}
              </button>
            ))}
          </div>

          {tab === "personal" ? (
            <div className="grid gap-6 lg:grid-cols-2">
              <section className="rounded-lg border border-slate-200 p-4">
                <h3 className="text-sm font-semibold text-slate-900">Cadastro</h3>
                <dl className="mt-4 grid gap-4 sm:grid-cols-2">
                  <Field label="Nome" value={data.client.fullName} />
                  <Field label="CPF/CNPJ" value={data.client.document} />
                  <Field label="Telefone" value={data.client.phone} />
                  <Field label="E-mail" value={data.client.email} />
                  <Field label="Plano" value={data.client.plan?.name} />
                  <Field label="Valor mensal" value={formatBRL(data.client.monthlyPrice || 0)} />
                  <Field label="Vencimento" value={`Dia ${data.client.dueDay || 10}`} />
                  <Field label="Status" value={clientStatusLabelPt(data.client.status as never)} />
                </dl>
              </section>
              <section className="rounded-lg border border-slate-200 p-4">
                <h3 className="text-sm font-semibold text-slate-900">Endereço e observações</h3>
                <dl className="mt-4 space-y-4">
                  <Field label="Endereço" value={addressLine} />
                  <Field label="CEP" value={address?.zip} />
                  <Field label="Referência" value={address?.reference} />
                  <Field label="Observações" value={data.client.notes} />
                </dl>
              </section>
            </div>
          ) : null}

          {tab === "accesses" ? (
            <div className="space-y-3">
              {data.accesses.length === 0 ? <p className="rounded-lg border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500">Nenhum acesso Internet vinculado.</p> : data.accesses.map((access) => (
                <div key={access.id} className="grid gap-3 rounded-lg border border-slate-200 p-4 sm:grid-cols-[1.3fr_1fr_1fr_auto] sm:items-center">
                  <div className="flex items-center gap-3"><Router className="h-4 w-4 text-emerald-700" /><div><p className="font-mono text-sm font-semibold text-slate-900">{access.username}</p><p className="text-xs text-slate-500">{access.source}</p></div></div>
                  <Field label="Plano" value={access.plan.name} />
                  <Field label="Concentrador" value={access.server.name} />
                  <Badge variant={access.status === "active" ? "success" : "warning"}>{access.status}</Badge>
                </div>
              ))}
            </div>
          ) : null}

          {tab === "contracts" ? <InfoList empty="Nenhum contrato detalhado disponível nesta fase." items={Object.entries(data.client.contract || {}).filter(([, value]) => value != null && String(value).trim()).map(([key, value]) => `${key}: ${String(value)}`)} /> : null}
          {tab === "billing" ? <InfoList empty="Nenhuma cobrança encontrada." items={data.invoices.map((invoice) => `${invoice.competence} · ${formatBRL(invoice.amount)} · ${invoice.status} · venc. ${dateLabel(invoice.dueDate)}`)} /> : null}
          {tab === "tickets" ? <InfoList empty="Nenhum chamado encontrado." items={data.tickets.map((ticket) => `${ticket.protocol} · ${ticket.subject} · ${ticket.status}`)} /> : null}
          {tab === "logs" ? <InfoList empty="Nenhum log comercial encontrado." items={data.logs.map((log) => `${dateLabel(log.createdAt)} · ${log.action} · ${log.status}`)} /> : null}
          {tab === "attachments" ? <InfoList empty="Nenhum anexo disponível nesta fase." items={[]} /> : null}
        </div>
      ) : null}
    </Modal>
  );
}

function InfoList({ items, empty }: { items: string[]; empty: string }) {
  if (!items.length) return <p className="rounded-lg border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500">{empty}</p>;
  return <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200">{items.map((item, index) => <li key={`${item}-${index}`} className="px-4 py-3 text-sm text-slate-700">{item}</li>)}</ul>;
}
