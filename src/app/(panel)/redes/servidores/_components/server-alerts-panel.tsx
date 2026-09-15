"use client";

import { AlertTriangle, CheckCircle2, Info } from "lucide-react";
import type { MikrotikOperationalAlertFromApi } from "@/lib/api-types";
import { cn } from "@/lib/cn";

type Props = {
  alerts: MikrotikOperationalAlertFromApi[];
};

export function ServerAlertsPanel({ alerts }: Props) {
  if (!alerts.length) {
    return (
      <div className="flex items-start gap-3 rounded-xl border border-emerald-200/90 bg-emerald-50/50 px-4 py-3 text-sm text-emerald-900">
        <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" aria-hidden />
        <div>
          <p className="font-semibold">Nenhum alerta comercial nesta consulta</p>
          <p className="mt-0.5 text-xs text-emerald-800/85">Parâmetros dentro dos limiares definidos para esta fase.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {alerts.map((a, idx) => (
        <div
          key={`${a.code}-${idx}`}
          className={cn(
            "flex items-start gap-3 rounded-xl border px-4 py-3 text-sm",
            a.level === "critical" && "border-rose-200/95 bg-rose-50/90 text-rose-950",
            a.level === "warning" && "border-amber-200/95 bg-amber-50/90 text-amber-950",
            a.level === "info" && "border-sky-200/90 bg-sky-50/80 text-sky-950",
          )}
          role="status"
        >
          {a.level === "critical" ? (
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-rose-600" aria-hidden />
          ) : a.level === "warning" ? (
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" aria-hidden />
          ) : (
            <Info className="mt-0.5 h-5 w-5 shrink-0 text-sky-600" aria-hidden />
          )}
          <div className="min-w-0">
            <p className="font-semibold">{a.title}</p>
            <p className="mt-0.5 text-xs opacity-95">{a.message}</p>
            <p className="mt-1 font-mono text-[10px] uppercase tracking-wider opacity-70">{a.code}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
