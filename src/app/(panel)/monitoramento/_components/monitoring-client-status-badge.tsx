"use client";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/cn";

export type MonitoringPppStatus =
  | "online"
  | "sem_sessao"
  | "equipamento_indisponivel"
  | "nao_pppoe"
  | "sem_servidor"
  | string;

const LABELS: Record<string, { label: string; variant: "success" | "error" | "warning" | "default" }> = {
  online: { label: "Conexões ativas", variant: "success" },
  sem_sessao: { label: "Sem conexão activa", variant: "warning" },
  equipamento_indisponivel: { label: "Equipamento indisponível", variant: "error" },
  nao_pppoe: { label: "Outro tipo de acesso", variant: "default" },
  sem_servidor: { label: "Sem servidor no cadastro", variant: "warning" },
};

export function MonitoringClientStatusBadge({ pppStatus }: { pppStatus: MonitoringPppStatus }) {
  const cfg = LABELS[String(pppStatus)] || { label: String(pppStatus), variant: "default" as const };
  return (
    <Badge
      variant={cfg.variant}
      className={cn("px-2.5 py-1 text-xs font-bold tabular-nums shadow-sm ring-2 ring-offset-1 ring-slate-900/[0.06]")}
    >
      {cfg.label}
    </Badge>
  );
}
