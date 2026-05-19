"use client";

import { AUTH_COOKIE } from "./constants";

/**
 * Cliente HTTP do painel: o cookie httpOnly (definido em /api/auth/login) protege rotas Next.js
 * no middleware, mas fetch() ao backend precisa do header Authorization.
 * O token é guardado em sessionStorage após login — conveniente, mas com risco residual XSS
 * (mitigar com CSP, evitar scripts de terceiros não confiáveis). Remover sessionStorage exigiria
 * BFF que injete o Bearer a partir do cookie em cada rota API Route.
 */
const SESSION_KEY = "dcnet_token_session";

const DEFAULT_TIMEOUT_MS = 20000;
const RETRY_DELAY_MS = 400;

export const ERROR_CODE_DATABASE = "DATABASE_UNAVAILABLE";
export const ERROR_CODE_MISCONFIGURED = "SERVER_MISCONFIGURED";

export function setSessionToken(token: string) {
  if (typeof window === "undefined") return;
  sessionStorage.setItem(SESSION_KEY, token);
}

export function clearSessionToken() {
  if (typeof window === "undefined") return;
  sessionStorage.removeItem(SESSION_KEY);
}

export function getSessionToken(): string | null {
  if (typeof window === "undefined") return null;
  return sessionStorage.getItem(SESSION_KEY);
}

export type ApiFetchOptions = RequestInit & {
  /** Se true, envia Bearer com token da sessão. */
  auth?: boolean;
  /** Timeout em ms (predefinido 20000). */
  timeoutMs?: number;
  /** Se true (predefinido), faz uma nova tentativa em GET após falha de rede/timeout. */
  retry?: boolean;
};

function getApiBase(): string {
  const base = process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "");
  if (!base) throw new Error("NEXT_PUBLIC_API_URL não configurada.");
  return base;
}

function isNetworkishFailure(e: unknown): boolean {
  if (e instanceof TypeError) return true;
  if (e instanceof DOMException && e.name === "AbortError") return true;
  return false;
}

function shouldRetryGet(e: unknown): boolean {
  if (isNetworkishFailure(e)) return true;
  return e instanceof ApiRequestError && e.code === "NETWORK_ERROR";
}

export class ApiRequestError extends Error {
  readonly status?: number;
  readonly code?: string;

  constructor(message: string, status?: number, code?: string) {
    super(message);
    this.name = "ApiRequestError";
    this.status = status;
    this.code = code;
  }
}

export async function apiFetch<T = unknown>(
  path: string,
  options: ApiFetchOptions = {},
): Promise<T> {
  const { auth = true, headers: hdrs, timeoutMs = DEFAULT_TIMEOUT_MS, retry = true, ...rest } = options;
  const method = (rest.method || "GET").toUpperCase();
  const allowRetry = retry && method === "GET";

  const runOnce = async (): Promise<T> => {
    const headers = new Headers(hdrs);
    if (!headers.has("Content-Type") && rest.body) {
      headers.set("Content-Type", "application/json");
    }
    if (auth) {
      const t = getSessionToken();
      if (t) headers.set("Authorization", `Bearer ${t}`);
    }
    /**
     * /plans e /clients: tenant resolvido no backend (DEFAULT_TENANT_SLUG / dcnet).
     * Legado ou testes: apiFetch(path, { headers: { "x-tenant": "slug" } }).
     */

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    let res: Response;
    try {
      res = await fetch(`${getApiBase()}${path.startsWith("/") ? path : `/${path}`}`, {
        ...rest,
        headers,
        cache: "no-store",
        signal: controller.signal,
      });
    } catch (e) {
      if (isNetworkishFailure(e)) {
        throw new ApiRequestError(
          "Não foi possível contactar o servidor. Verifique a rede ou se a API está disponível.",
          0,
          "NETWORK_ERROR",
        );
      }
      throw e;
    } finally {
      clearTimeout(timer);
    }

    if (!res.ok) {
      const text = await res.text();
      let msg = text;
      let code: string | undefined;
      try {
        const j = JSON.parse(text) as { message?: string; code?: string };
        if (j?.message) msg = j.message;
        if (j?.code) code = j.code;
      } catch {
        /* ignore */
      }
      if (res.status >= 500 && !code) {
        code = "SERVER_ERROR";
      }
      if (res.status === 401 && auth && typeof window !== "undefined") {
        clearSessionToken();
        void fetch("/api/auth/logout", { method: "POST" }).finally(() => {
          const path = window.location.pathname || "/dashboard";
          window.location.assign(`/login?from=${encodeURIComponent(path)}&session=expired`);
        });
      }
      throw new ApiRequestError(msg || `HTTP ${res.status}`, res.status, code);
    }

    if (res.status === 204) return undefined as T;
    return res.json() as Promise<T>;
  };

  try {
    return await runOnce();
  } catch (e) {
    if (allowRetry && shouldRetryGet(e)) {
      await new Promise((r) => setTimeout(r, RETRY_DELAY_MS));
      try {
        return await runOnce();
      } catch (e2) {
        throw e2;
      }
    }
    throw e;
  }
}

export { AUTH_COOKIE };
