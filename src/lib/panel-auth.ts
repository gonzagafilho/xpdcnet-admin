import { getSessionToken } from "./api-client";

export type PanelJwtPayload = {
  role?: string;
  id?: string;
  email?: string;
};

/** Decodifica payload do JWT do painel (sem verificar assinatura — só UX; a API valida). */
export function decodePanelJwtPayload(token: string | null): PanelJwtPayload | null {
  if (!token || typeof token !== "string") return null;
  const parts = token.split(".");
  if (parts.length < 2) return null;
  try {
    let b64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const pad = b64.length % 4;
    if (pad) b64 += "=".repeat(4 - pad);
    const json = atob(b64);
    return JSON.parse(json) as PanelJwtPayload;
  } catch {
    return null;
  }
}

/** Igual a `isAdmin` no backend: admin ou superadmin. */
export function isPanelAdminRole(role: string | null | undefined): boolean {
  return role === "admin" || role === "superadmin";
}

export function getPanelSessionRole(): string | null {
  const payload = decodePanelJwtPayload(getSessionToken());
  return typeof payload?.role === "string" ? payload.role : null;
}

export function isCurrentPanelUserAdmin(): boolean {
  return isPanelAdminRole(getPanelSessionRole());
}
