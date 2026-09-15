import { getSessionToken } from "./api-client";

export type PanelJwtPayload = {
  role?: string;
  id?: string;
  email?: string;
};

export type PanelFinanceConfigurationPermission =
  | "read"
  | "write"
  | "activate"
  | "restore"
  | "emergencyStop";

const FINANCE_CONFIGURATION_ROLE_PERMISSIONS: Record<string, PanelFinanceConfigurationPermission[]> = {
  superadmin: ["read", "write", "activate", "restore", "emergencyStop"],
  admin: ["read", "write", "activate", "restore", "emergencyStop"],
  financeiro: ["read", "write"],
  operador: ["read"],
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

export function hasPanelFinanceConfigurationPermission(
  permission: PanelFinanceConfigurationPermission,
  role: string | null | undefined = getPanelSessionRole(),
): boolean {
  const normalized = typeof role === "string" ? role.trim().toLowerCase() : "";
  return (FINANCE_CONFIGURATION_ROLE_PERMISSIONS[normalized] || []).includes(permission);
}

export function isCurrentPanelUserAdmin(): boolean {
  return isPanelAdminRole(getPanelSessionRole());
}
