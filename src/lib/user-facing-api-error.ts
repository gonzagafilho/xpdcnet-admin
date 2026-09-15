import { ApiRequestError, ERROR_CODE_DATABASE, ERROR_CODE_MISCONFIGURED } from "./api-client";
import { normalizeApiErrorMessage } from "./api-error-normalizer";

function looksLikeHtml(text: string): boolean {
  const sample = text.trim().toLowerCase();
  return sample.startsWith("<!doctype") || sample.startsWith("<html") || sample.includes("<body") || sample.includes("<head");
}

function isCustomerApiErrorLike(error: unknown): error is { status?: number; code?: string; message?: string } {
  if (!error || typeof error !== "object") return false;
  const maybe = error as { name?: string };
  return maybe.name === "CustomerApiError";
}

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
    if (e.message && looksLikeHtml(e.message)) {
      return "Não foi possível concluir a operação. Tente novamente em alguns instantes.";
    }
    return normalizeApiErrorMessage({ status: e.status, code: e.code, rawMessage: e.message }) || "Pedido falhou.";
  }
  if (isCustomerApiErrorLike(e)) {
    return normalizeApiErrorMessage({ status: e.status, code: e.code, rawMessage: e.message });
  }
  return e instanceof Error ? e.message : String(e);
}
