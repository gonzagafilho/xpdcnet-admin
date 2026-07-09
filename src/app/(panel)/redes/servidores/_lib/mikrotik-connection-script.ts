/**
 * Geração client-side de scripts Equipamento para o operador colar manualmente.
 * Não executa nada no equipamento.
 */

const GROUP_NAME = "xpdcnet-lab-grp";
const ADDRESS_LIST_NAME = "xpdcnet-lab-allowed";

/** Aspas e barras para uso em :local VAR "..." no Equipamento. */
export function escapeRouterOsDoubleQuotedString(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

export type MikrotikActivationScriptInput = {
  /** IP do servidor XPDCNET autorizado a ligar à API. */
  allowedServerIp: string;
  apiUsername: string;
  apiPassword: string;
  /** Texto exacto de comentário em regras / utilizador (ex.: XPDCNET LAB). */
  commentTag: string;
  apiPort: number;
  /** Nome amigável só no cabeçalho do script (opcional). */
  equipmentLabel?: string;
};

export type MikrotikDeactivationScriptInput = {
  commentTag: string;
  /** Se true, inclui /ip service set api disabled=yes */
  disableApiService: boolean;
  /** Se true, inclui limpeza do campo address do serviço api (aceitar de qualquer origem). */
  clearApiServiceAddress: boolean;
};

function assertPort(p: number): void {
  if (!Number.isFinite(p) || p < 1 || p > 65535) {
    throw new Error("Porta de acesso inválida (use 1–65535).");
  }
}

export function buildMikrotikActivationScript(input: MikrotikActivationScriptInput): string {
  const tag = input.commentTag.trim();
  const allow = input.allowedServerIp.trim();
  const user = input.apiUsername.trim();
  const pass = input.apiPassword;
  const port = Math.floor(Number(input.apiPort));
  assertPort(port);
  if (!tag) throw new Error("Indique o comentário / prefixo identificador.");
  if (!allow) throw new Error("Indique o IP permitido do servidor XPDCNET.");
  if (!user) throw new Error("Indique o usuário de acesso.");
  if (!pass) throw new Error("Indique a senha de acesso.");

  const t = escapeRouterOsDoubleQuotedString(tag);
  const a = escapeRouterOsDoubleQuotedString(allow);
  const u = escapeRouterOsDoubleQuotedString(user);
  const p = escapeRouterOsDoubleQuotedString(pass);
  const headerRef = input.equipmentLabel?.trim() || "—";

  return [
    "# ============================================",
    "# XPDCNET — Ativar monitoramento do equipamento",
    "# Colar no terminal do MikroTik. Não executa automaticamente a partir do painel.",
    `# Equipamento (referência): ${headerRef}`,
    "# ============================================",
    `:local TAG ${t}`,
    `:local ALLOW ${a}`,
    `:local U ${u}`,
    `:local P ${p}`,
    `:local PPORT ${port}`,
    "",
    "# --- limpeza de artefactos anteriores XPDCNET (mesmo TAG / lista dedicada) ---",
    "/ip firewall filter remove [find comment=$TAG]",
    `/ip firewall address-list remove [find list=${ADDRESS_LIST_NAME}]`,
    "/user remove [find comment=$TAG]",
    `/user group remove [find name=${GROUP_NAME}]`,
    "",
    "# --- grupo e utilizador dedicados ---",
    `/user group add name=${GROUP_NAME} comment=$TAG policy=local,read,write,api,test`,
    "/user add name=$U password=$P group=" + GROUP_NAME + " comment=$TAG",
    "",
    "# --- porta e restrição de origem ao servidor XPDCNET ---",
    "/ip service set [find name=api] disabled=no port=$PPORT address=$ALLOW",
    "",
    "# --- address-list e regra input (defesa em profundidade) ---",
    `/ip firewall address-list add list=${ADDRESS_LIST_NAME} address=$ALLOW comment=$TAG`,
    `/ip firewall filter add chain=input action=accept protocol=tcp dst-port=$PPORT src-address-list=${ADDRESS_LIST_NAME} comment=$TAG place-before=*0`,
    "",
    "# --- fim ---",
  ].join("\n");
}

export function buildMikrotikDeactivationScript(input: MikrotikDeactivationScriptInput): string {
  const tag = input.commentTag.trim();
  if (!tag) throw new Error("Indique o comentário / prefixo usado no script de ativação.");
  const t = escapeRouterOsDoubleQuotedString(tag);

  const lines = [
    "# ============================================",
    "# XPDCNET — Desativar monitoramento (rollback manual)",
    "# Remove apenas regras/lista/utilizador/grupo criados pelo script de ativação XPDCNET.",
    "# Este script remove apenas o acesso criado para o XPDCNET monitorar o MikroTik.",
    "# ============================================",
    `:local TAG ${t}`,
    "",
    "# --- remoção conservadora: comentário exacto + lista dedicada + grupo com nome fixo ---",
    "/ip firewall filter remove [find comment=$TAG]",
    `/ip firewall address-list remove [find list=${ADDRESS_LIST_NAME}]`,
    "/user remove [find comment=$TAG]",
    `/user group remove [find name=${GROUP_NAME}]`,
  ];

  if (input.clearApiServiceAddress) {
    lines.push("", "# --- opcional: limpar restrição de IP do serviço de acesso ---", '/ip service set [find name=api] address=""');
  }
  if (input.disableApiService) {
    lines.push("", "# --- opcional: desativar o serviço de acesso ---", "/ip service set [find name=api] disabled=yes");
  }

  lines.push("", "# --- fim ---");
  return lines.join("\n");
}

export { GROUP_NAME as MIKROTIK_XPDCNET_GROUP_NAME, ADDRESS_LIST_NAME as MIKROTIK_XPDCNET_ADDRESS_LIST_NAME };
