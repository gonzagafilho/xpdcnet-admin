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
      throw new CustomerApiError("Tempo esgotado ao contactar a API.", 0, "TIMEOUT");
    }
    throw new CustomerApiError("Nao foi possivel contactar a API.", 0, "NETWORK_ERROR");
  } finally {
    clearTimeout(timer);
  }

  if (!res.ok) {
    let message = `HTTP ${res.status}`;
    let code: string | undefined;
    try {
      const data = (await res.json()) as { message?: string; code?: string; error?: string };
      message = data.message || data.error || message;
      code = data.code;
    } catch {
      /* ignore */
    }
    if (res.status === 401) clearCustomerToken();
    throw new CustomerApiError(message, res.status, code);
  }

  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}
