"use client";

import { Badge } from "@/components/ui/badge";
import type { MikrotikServerMonitoringInterfaceDetailFromApi } from "@/lib/api-types";
import { cn } from "@/lib/cn";

type Props = {
  interfaces: MikrotikServerMonitoringInterfaceDetailFromApi[];
  online: boolean;
  /** Nomes das interfaces com maior tráfego acumulado (destaque NOC). */
  topInterfaceNames?: Set<string>;
};

function statusLabel(iface: MikrotikServerMonitoringInterfaceDetailFromApi): string {
  if (iface.disabled) return "Desactivada";
  if (iface.running) return "Activa";
  return "Inactiva";
}

export function ServerInterfacesTable({ interfaces, online, topInterfaceNames }: Props) {
  if (!online) {
    return (
      <p className="text-sm text-slate-500">
        Equipamento offline — sem leitura de interfaces nesta consulta.
      </p>
    );
  }

  if (!interfaces.length) {
    return (
      <p className="text-sm text-slate-500">Sem dados de interfaces nesta consulta.</p>
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-slate-200/90 bg-white shadow-[inset_0_1px_0_rgba(255,255,255,0.9)]">
      <table className="w-full min-w-[1100px] border-collapse text-left text-[13px]">
        <thead>
          <tr className="border-b border-slate-200 bg-slate-50/95 text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500">
            <th className="px-3 py-2.5">Interface</th>
            <th className="px-3 py-2.5">Estado</th>
            <th className="px-3 py-2.5 font-mono">Rx taxa</th>
            <th className="px-3 py-2.5 font-mono">Tx taxa</th>
            <th className="px-3 py-2.5 font-mono">Rx bytes</th>
            <th className="px-3 py-2.5 font-mono">Tx bytes</th>
            <th className="px-3 py-2.5 font-mono">Link / limite</th>
            <th className="px-3 py-2.5 font-mono">MAC</th>
            <th className="px-3 py-2.5 font-mono">MTU</th>
            <th className="px-3 py-2.5">Tipo</th>
            <th className="px-3 py-2.5">Comentário</th>
          </tr>
        </thead>
        <tbody className="text-slate-800">
          {interfaces.map((iface, idx) => {
            const isTop = topInterfaceNames?.has(iface.name) ?? false;
            return (
              <tr
                key={`${iface.name}-${idx}`}
                className={cn(
                  "border-b border-slate-100 transition-colors hover:bg-slate-50/80",
                  iface.running && !iface.disabled && "bg-emerald-50/[0.35]",
                  iface.disabled && "opacity-70",
                  isTop && "bg-sky-50/50 ring-1 ring-inset ring-sky-200/70",
                )}
              >
                <td className="px-3 py-2 font-semibold text-slate-900">
                  {iface.name || "—"}
                  {isTop ? (
                    <span className="ml-1.5 rounded bg-sky-100 px-1 py-0.5 text-[9px] font-bold uppercase text-sky-800">
                      top
                    </span>
                  ) : null}
                </td>
                <td className="px-3 py-2">
                  {iface.running && !iface.disabled ? (
                    <Badge variant="success" className="font-semibold">
                      {statusLabel(iface)}
                    </Badge>
                  ) : iface.disabled ? (
                    <Badge variant="muted" className="font-semibold">
                      {statusLabel(iface)}
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="font-semibold">
                      {statusLabel(iface)}
                    </Badge>
                  )}
                </td>
                <td className="px-3 py-2 font-mono text-xs text-slate-700">{iface.rxRate ?? "—"}</td>
                <td className="px-3 py-2 font-mono text-xs text-slate-700">{iface.txRate ?? "—"}</td>
                <td className="px-3 py-2 font-mono tabular-nums text-slate-700">{iface.rx ?? iface.rxBytes ?? "—"}</td>
                <td className="px-3 py-2 font-mono tabular-nums text-slate-700">{iface.tx ?? iface.txBytes ?? "—"}</td>
                <td className="px-3 py-2 font-mono text-xs text-slate-600">
                  {iface.linkSpeed ?? iface.rxMax ?? iface.txMax ?? "—"}
                </td>
                <td className="max-w-[120px] truncate px-3 py-2 font-mono text-[11px] text-slate-600" title={iface.macAddress ?? undefined}>
                  {iface.macAddress ?? "—"}
                </td>
                <td className="px-3 py-2 font-mono text-xs text-slate-600">{iface.mtu ?? "—"}</td>
                <td className="px-3 py-2 text-slate-600">{iface.type ?? "—"}</td>
                <td className="max-w-[180px] truncate px-3 py-2 text-slate-600" title={iface.comment ?? undefined}>
                  {iface.comment ?? "—"}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
