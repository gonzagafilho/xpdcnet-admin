import { ApiRequestError, ERROR_CODE_DATABASE, ERROR_CODE_MISCONFIGURED } from "./api-client";

/** Mensagens consistentes para listas, toasts e drawer (alinhado ao módulo Planos). */
export function userFacingApiError(e: unknown): string {
  if (e instanceof ApiRequestError) {
    if (e.code === ERROR_CODE_DATABASE) {
      return "Sistema temporariamente indisponível (banco de dados).";
    }
    if (e.code === ERROR_CODE_MISCONFIGURED) {
      return e.message;
    }
    if (e.code === "NETWORK_ERROR") {
      return e.message || "Não foi possível contactar o servidor.";
    }
    if (e.code === "INVOICE_DUPLICATE_COMPETENCE") {
      return e.message || "Já existe cobrança para este cliente nesta competência.";
    }
    if (e.code === "SYNC_JOB_OPEN") {
      return e.message || "Existe outro job em aberto para o mesmo cliente; conclua-o ou aguarde antes de reenviar.";
    }
    if (e.status === 409) {
      return e.message || "Operação em conflito com dados existentes.";
    }
    return e.message || "Pedido falhou.";
  }
  return e instanceof Error ? e.message : String(e);
}
