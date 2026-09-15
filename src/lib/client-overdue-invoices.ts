import { apiFetch } from "@/lib/api-client";
import type { ClientStatus } from "@/lib/api-types";
import type { InvoiceFromApi, InvoiceSummaryFromApi } from "@/lib/api-types";

/** Normaliza `clientId` da fatura (populate ou string) para comparação com `client._id`. */
export function invoiceClientIdKey(clientId: InvoiceFromApi["clientId"]): string {
  if (clientId && typeof clientId === "object" && "_id" in clientId) {
    return String((clientId as { _id: string })._id);
  }
  return String(clientId ?? "");
}

/** Linha resumida para a régua (competência / valor / vencimento). */
export type ClientOverdueLine = {
  competence: string;
  amount: number;
  dueDate: string;
};

/** Agregado por cliente a partir de `GET /invoices?status=overdue` (e opcionalmente `clientId`). */
export type ClientOverdueRollup = {
  count: number;
  totalAmount: number;
  lines: ClientOverdueLine[];
};

const MAX_LINES_TABLE = 4;
const MAX_LINES_MODAL = 14;

function sortLinesByDueDesc(lines: ClientOverdueLine[]): ClientOverdueLine[] {
  return [...lines].sort((a, b) => {
    const ta = new Date(a.dueDate).getTime();
    const tb = new Date(b.dueDate).getTime();
    return (Number.isFinite(tb) ? tb : 0) - (Number.isFinite(ta) ? ta : 0);
  });
}

/** Monta rollup a partir de uma lista já filtrada `overdue` (sem chamada HTTP). */
export function buildClientOverdueRollup(
  invoices: InvoiceFromApi[],
  maxLines: number,
): ClientOverdueRollup {
  let totalAmount = 0;
  const raw: ClientOverdueLine[] = [];
  for (const inv of invoices) {
    const amount = typeof inv.amount === "number" && Number.isFinite(inv.amount) ? inv.amount : 0;
    totalAmount += amount;
    raw.push({
      competence: (inv.competence ?? "").trim() || "—",
      amount,
      dueDate: inv.dueDate ?? "",
    });
  }
  const lines = sortLinesByDueDesc(raw).slice(0, maxLines);
  return {
    count: invoices.length,
    totalAmount,
    lines,
  };
}

/** Agrupa todas as faturas `overdue` do tenant por `clientId` (uma leitura). */
export function rollupOverdueInvoicesByClientId(
  invoices: InvoiceFromApi[],
  maxLinesPerClient: number,
): Map<string, ClientOverdueRollup> {
  const by = new Map<string, InvoiceFromApi[]>();
  for (const inv of invoices) {
    const id = invoiceClientIdKey(inv.clientId);
    if (!id) continue;
    if (!by.has(id)) by.set(id, []);
    by.get(id)!.push(inv);
  }
  const out = new Map<string, ClientOverdueRollup>();
  for (const [clientId, invs] of by) {
    out.set(clientId, buildClientOverdueRollup(invs, maxLinesPerClient));
  }
  return out;
}

/** `GET /invoices?status=overdue` → mapa cliente → totais e linhas resumidas. */
export async function fetchOverdueRollupByClientId(): Promise<Map<string, ClientOverdueRollup>> {
  const list = await apiFetch<InvoiceFromApi[]>("/invoices?status=overdue");
  if (!Array.isArray(list)) return new Map();
  return rollupOverdueInvoicesByClientId(list, MAX_LINES_TABLE);
}

/** `GET /invoices?clientId=&status=overdue` → detalhe para a ficha. */
export async function fetchClientOverdueRollup(clientId: string): Promise<ClientOverdueRollup | null> {
  const params = new URLSearchParams();
  params.set("clientId", clientId);
  params.set("status", "overdue");
  const list = await apiFetch<InvoiceFromApi[]>(`/invoices?${params.toString()}`);
  if (!Array.isArray(list) || list.length === 0) return null;
  return buildClientOverdueRollup(list, MAX_LINES_MODAL);
}

/** Contagem via summary (leve) — útil se só o número for necessário. */
export async function fetchClientOverdueInvoiceCount(clientId: string): Promise<number> {
  const params = new URLSearchParams();
  params.set("clientId", clientId);
  params.set("status", "overdue");
  const summary = await apiFetch<InvoiceSummaryFromApi>(`/invoices/summary?${params.toString()}`);
  return summary?.overdue?.count ?? 0;
}

/** Transparência para o operador: critério financeiro desta fase. */
export const DELINQUENCY_RULE_SOURCE_NOTE =
  "Critério desta régua: apenas faturas com estado «overdue» na API. Faturas «pending» vencidas pelo calendário não entram.";

/** Honestidade: manual hoje; técnico depois. */
export const DELINQUENCY_NO_AUTO_STATUS =
  "O estado do cliente não muda sozinho com base no financeiro. Marcar «Inadimplente» é sempre decisão manual nesta fase.";

export const DELINQUENCY_NO_AUTO_BLOCK =
  "«Inadimplente» não aplica bloqueio técnico nem MikroTik automaticamente — apenas alinha o cadastro para operação e fases futuras.";

export function delinquencyRecommendation(
  clientStatus: ClientStatus,
  rollup: ClientOverdueRollup,
): { headline: string; detail: string } {
  if (rollup.count === 0) {
    return { headline: "", detail: "" };
  }
  if (clientStatus === "blocked") {
    return {
      headline: "Cliente bloqueado no cadastro",
      detail:
        "O estado «Bloqueado» aplica-se ao registo do cliente. Não há integração MikroTik nem corte automático de acesso nesta fase — apenas alinhamento operacional.",
    };
  }
  if (clientStatus === "delinquent") {
    return {
      headline: "Estado do cadastro alinhado: inadimplente",
      detail:
        "O cliente já está marcado como inadimplente. Revise as cobranças abaixo e o financeiro. Pode bloquear no cadastro abaixo se a política interna o exigir — sem automação de rede.",
    };
  }
  return {
    headline: "Recomendação operacional",
    detail:
      "Há faturas vencidas (overdue) em aberto. Após conferir o financeiro, pode marcar o cliente como «Inadimplente» — só com o botão abaixo ou pelo campo de estado (PUT /clients/:id).",
  };
}
