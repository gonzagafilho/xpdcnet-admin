import { looksLikeHtml, normalizeApiErrorMessage } from "./api-error-normalizer";

export const CUSTOMER_TOKEN_KEY = "xpdcnet_customer_token";

const DEFAULT_TIMEOUT_MS = 20000;

type CustomerApiOptions = RequestInit & {
  auth?: boolean;
  timeoutMs?: number;
};

export class CustomerApiError extends Error {
  readonly status?: number;
  readonly code?: string;

  constructor(message: string, status?: number, code?: string) {
    super(message);
    this.name = "CustomerApiError";
    this.status = status;
    this.code = code;
  }
}

function apiBase() {
  const base = (process.env.NEXT_PUBLIC_CUSTOMER_API_URL || process.env.NEXT_PUBLIC_API_URL || "").replace(/\/$/, "");
  if (!base) throw new CustomerApiError("URL da API nao configurada.", 0, "API_URL_MISSING");
  return base;
}

export function getCustomerToken() {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(CUSTOMER_TOKEN_KEY);
}

export function setCustomerToken(token: string) {
  if (typeof window === "undefined") return;
  localStorage.setItem(CUSTOMER_TOKEN_KEY, token);
}

export function clearCustomerToken() {
  if (typeof window === "undefined") return;
  localStorage.removeItem(CUSTOMER_TOKEN_KEY);
}

export async function customerApiFetch<T>(path: string, options: CustomerApiOptions = {}): Promise<T> {
  const { auth = true, timeoutMs = DEFAULT_TIMEOUT_MS, headers: inputHeaders, ...rest } = options;
  const headers = new Headers(inputHeaders);

  if (!headers.has("Content-Type") && rest.body) headers.set("Content-Type", "application/json");
  if (auth) {
    const token = getCustomerToken();
    if (token) headers.set("Authorization", `Bearer ${token}`);
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  let res: Response;
  try {
    res = await fetch(`${apiBase()}${path.startsWith("/") ? path : `/${path}`}`, {
      ...rest,
      headers,
      cache: "no-store",
      signal: controller.signal,
    });
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") {
      throw new CustomerApiError(normalizeApiErrorMessage({ code: "TIMEOUT", rawMessage: "timeout" }), 0, "TIMEOUT");
    }
    throw new CustomerApiError(normalizeApiErrorMessage({ code: "NETWORK_ERROR", rawMessage: "network" }), 0, "NETWORK_ERROR");
  } finally {
    clearTimeout(timer);
  }

  if (!res.ok) {
    const contentType = (res.headers.get("content-type") || "").toLowerCase();
    const raw = await res.text();
    let rawMessage = raw;
    let code: string | undefined;
    try {
      const data = JSON.parse(raw) as { message?: string; code?: string; error?: string };
      rawMessage = data.message || data.error || rawMessage;
      code = data.code;
    } catch {
      /* ignore */
    }
    if (res.status === 429 && !code) code = "RATE_LIMITED";
    if (res.status === 502 && !code) code = "UPSTREAM_BAD_GATEWAY";
    if (res.status === 503 && !code) code = "UPSTREAM_UNAVAILABLE";
    if (res.status === 504 && !code) code = "UPSTREAM_TIMEOUT";
    if (contentType.includes("text/html") || looksLikeHtml(raw)) rawMessage = "";
    const message = normalizeApiErrorMessage({ status: res.status, code, rawMessage });
    if (res.status === 401) clearCustomerToken();
    throw new CustomerApiError(message, res.status, code);
  }

  if (res.status === 204) return undefined as T;
  const contentType = (res.headers.get("content-type") || "").toLowerCase();
  if (contentType.includes("application/json") || contentType.includes("+json")) {
    return res.json() as Promise<T>;
  }

  const payload = await res.text();
  if (contentType.includes("text/html") || looksLikeHtml(payload)) {
    throw new CustomerApiError(
      normalizeApiErrorMessage({ code: "INVALID_RESPONSE", rawMessage: payload }),
      res.status,
      "INVALID_RESPONSE",
    );
  }
  try {
    return JSON.parse(payload) as T;
  } catch {
    throw new CustomerApiError(
      normalizeApiErrorMessage({ code: "INVALID_RESPONSE", rawMessage: payload }),
      res.status,
      "INVALID_RESPONSE",
    );
  }
}
