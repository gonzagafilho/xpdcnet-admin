const FRIENDLY_STATUS_MESSAGE: Record<number, string> = {
  401: "Faça login novamente.",
  403: "Você não possui permissão.",
  404: "Informação não encontrada.",
  409: "A solicitação está em conflito com o estado atual.",
  422: "Não foi possível processar a solicitação.",
  429: "Muitas requisições. Aguarde alguns instantes.",
  500: "Ocorreu um erro interno.",
  502: "Serviço temporariamente indisponível.",
  503: "Serviço temporariamente indisponível.",
  504: "Serviço temporariamente indisponível.",
};

const FRIENDLY_CODE_MESSAGE: Record<string, string> = {
  TIMEOUT: "A operação demorou mais do que o esperado.",
  UPSTREAM_TIMEOUT: "A operação demorou mais do que o esperado.",
  NETWORK_ERROR: "Falha de rede. Verifique sua conexão e tente novamente.",
  INVALID_RESPONSE: "Resposta inválida do servidor.",
  RATE_LIMITED: "Muitas requisições. Aguarde alguns instantes.",
  UPSTREAM_BAD_GATEWAY: "Serviço temporariamente indisponível.",
  UPSTREAM_UNAVAILABLE: "Serviço temporariamente indisponível.",
  DATABASE_UNAVAILABLE: "Serviço temporariamente indisponível.",
};

export function looksLikeHtml(text: string): boolean {
  const sample = String(text || "").trim().toLowerCase();
  return sample.startsWith("<!doctype") || sample.startsWith("<html") || sample.includes("<body") || sample.includes("<head");
}

function looksLikeJson(text: string): boolean {
  const sample = String(text || "").trim();
  if (!sample) return false;
  if ((sample.startsWith("{") && sample.endsWith("}")) || (sample.startsWith("[") && sample.endsWith("]"))) {
    return true;
  }
  return false;
}

export function stripMarkup(payload: string): string {
  return String(payload || "")
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?>[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function messageByStatus(status?: number): string {
  if (typeof status === "number" && FRIENDLY_STATUS_MESSAGE[status]) return FRIENDLY_STATUS_MESSAGE[status];
  return "Não foi possível concluir a operação no momento.";
}

export function messageByCode(code?: string): string | null {
  if (!code) return null;
  return FRIENDLY_CODE_MESSAGE[code] || null;
}

export function normalizeApiErrorMessage(input: {
  status?: number;
  code?: string;
  rawMessage?: string | null;
}): string {
  const fromCode = messageByCode(input.code);
  if (fromCode) return fromCode;

  const fromStatus = messageByStatus(input.status);

  const cleaned = stripMarkup(String(input.rawMessage || ""));
  if (!cleaned) return fromStatus;
  if (looksLikeHtml(cleaned) || looksLikeJson(cleaned)) return fromStatus;

  if (typeof input.status === "number") {
    if (Object.prototype.hasOwnProperty.call(FRIENDLY_STATUS_MESSAGE, input.status)) {
      return fromStatus;
    }
    if (input.status >= 500) return messageByStatus(500);
  }

  if (/stack|trace|exception|syntaxerror|mongo|mongoose|ecconnrefused|token|jwt/i.test(cleaned)) {
    return fromStatus;
  }

  return cleaned;
}
