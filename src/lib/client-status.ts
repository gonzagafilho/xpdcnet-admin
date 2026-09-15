import type { ClientStatus } from "./api-types";

/** Ordem sugerida nos selects (comercial → técnico → baixa). */
export const CLIENT_STATUS_ORDER: ClientStatus[] = [
  "active",
  "pending",
  "suspended",
  "delinquent",
  "blocked",
  "cancelled",
  "disabled",
];

/**
 * Label curto + dica de uma linha (title em options, texto dinâmico na ficha).
 * Definições alinhadas à política operacional; sem automação no backend ainda.
 */
export const CLIENT_STATUS_OPTIONS: { value: ClientStatus; label: string; hint: string }[] = [
  {
    value: "active",
    label: "Ativo",
    hint: "Serviço liberado: contrato em curso e operação normal (futuras integrações podem permitir auth/rede).",
  },
  {
    value: "pending",
    label: "Pendente",
    hint: "Pré-activação: cadastro ainda sem liberação total; use antes de pôr acesso em produção.",
  },
  {
    value: "suspended",
    label: "Suspenso",
    hint: "Pausa temporária por decisão interna — não é o mesmo que inadimplente nem bloqueio técnico.",
  },
  {
    value: "delinquent",
    label: "Inadimplente",
    hint: "Incumprimento de pagamento; alinhe com faturas em atraso no financeiro (marcação manual por agora).",
  },
  {
    value: "blocked",
    label: "Bloqueado",
    hint: "Bloqueio/corte operacional explícito (ex.: ordem de corte, fraude); distinto de suspenso ou só dívida.",
  },
  {
    value: "cancelled",
    label: "Cancelado",
    hint: "Rescisão de contrato; cliente deixou de ser activo comercialmente neste vínculo.",
  },
  {
    value: "disabled",
    label: "Desativado",
    hint: "Baixa operacional no cadastro; útil quando o serviço não deve mais ser tratado como contrato activo.",
  },
];

/** Compare estados facilmente confundidos (texto fixo para painéis de ajuda). */
export const CLIENT_STATUS_DISTINCTION_SUMMARY =
  "Suspenso = pausa administrativa. Inadimplente = sinal de dívida/atraso. Bloqueado = corte técnico explícito. Cancelado = fim de contrato. Desativado = baixa no cadastro operacional. Pendente = ainda não liberado.";

/** Nota de honestidade operacional: prepara futura automação sem prometer o que ainda não existe. */
export const CLIENT_STATUS_AUTOMATION_FOOTNOTE =
  "As alterações de estado são manuais nesta fase. Sincronização automática com faturas, RADIUS ou MikroTik será aplicada quando estiver disponível no backend.";

/** Lista para blocos colapsáveis / «guia do operador». */
export const CLIENT_STATUS_GUIDE_SECTIONS: { label: string; detail: string }[] = CLIENT_STATUS_OPTIONS.map(
  (o) => ({
    label: `${o.label} (${o.value})`,
    detail: o.hint,
  }),
);

export function clientStatusLabelPt(s: ClientStatus): string {
  const row = CLIENT_STATUS_OPTIONS.find((o) => o.value === s);
  return row?.label ?? s;
}

export function clientStatusHintPt(s: ClientStatus): string {
  const row = CLIENT_STATUS_OPTIONS.find((o) => o.value === s);
  return row?.hint ?? "";
}

/** Variantes do componente Badge para estado do cliente. */
export type ClientStatusBadgeVariant = "default" | "success" | "error" | "warning" | "outline";

export function clientStatusBadgeVariant(s: ClientStatus): ClientStatusBadgeVariant {
  switch (s) {
    case "active":
      return "success";
    case "pending":
      return "outline";
    case "suspended":
    case "delinquent":
      return "warning";
    case "blocked":
      return "error";
    case "cancelled":
    case "disabled":
      return "default";
    default:
      return "default";
  }
}
