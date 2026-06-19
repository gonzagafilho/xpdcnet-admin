"use client";

import { History } from "lucide-react";
import type { MikrotikServerSnapshotHistoryRowFromApi } from "@/lib/api-types";
import { Badge } from "@/components/ui/badge";

type Props = {
  rows: MikrotikServerSnapshotHistoryRowFromApi[];
};

function formatPt(iso: string): string {
  try {
    return new Date(iso).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
  } catch {
    return iso;
  }
}

function memUsePct(t: number | null, f: number | null): string {
  if (t == null || f == null || t <= 0) return "—";
  const pct = 100 - (f / t) * 100;
  return `${Math.round(pct)}%`;
}

function diskUsePct(t: number | null, f: number | null): string {
  if (t == null || f == null || t <= 0) return "—";
  const pct = 100 - (f / t) * 100;
  return `${Math.round(pct)}%`;
}

export function ServerSnapshotHistory({ rows }: Props) {
  if (!rows.length) {
    return (
      <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/50 px-4 py-8 text-center text-sm text-slate-600">
        <History className="mx-auto h-8 w-8 text-slate-300" aria-hidden />
        <p className="mt-2">Ainda não há histórico gravado para este servidor.</p>
        <p className="mt-1 text-xs text-slate-500">As últimas leituras são guardadas a cada consulta do equipamento (máximo de 20).</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-slate-200/90 bg-white">
      <table className="w-full min-w-[640px] border-collapse text-left text-[12px]">
        <thead>
          <tr className="border-b border-slate-200 bg-slate-50/95 text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500">
            <th className="px-3 py-2.5">Quando</th>
            <th className="px-3 py-2.5">Estado</th>
            <th className="px-3 py-2.5">CPU</th>
            <th className="px-3 py-2.5">Memória (uso)</th>
            <th className="px-3 py-2.5">Disco (uso)</th>
            <th className="px-3 py-2.5">Ifaces</th>
            <th className="px-3 py-2.5">PPP activo</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className="border-b border-slate-100 hover:bg-slate-50/80">
              <td className="px-3 py-2 whitespace-nowrap text-slate-700">{formatPt(r.generatedAt)}</td>
              <td className="px-3 py-2">
                {r.online ? (
                  <Badge variant="success" className="text-[10px] font-semibold">
                    Online
                  </Badge>
                ) : (
                  <Badge variant="error" className="text-[10px] font-semibold">
                    Offline
                  </Badge>
                )}
              </td>
              <td className="px-3 py-2 tabular-nums font-medium">
                {r.cpuPercent != null ? `${Math.round(r.cpuPercent)}%` : "—"}
              </td>
              <td className="px-3 py-2 tabular-nums">{memUsePct(r.memoryTotalBytes, r.memoryFreeBytes)}</td>
              <td className="px-3 py-2 tabular-nums">{diskUsePct(r.diskTotalBytes, r.diskFreeBytes)}</td>
              <td className="px-3 py-2 tabular-nums">{r.interfaceCount}</td>
              <td className="px-3 py-2 tabular-nums">{r.activePppTotal}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
