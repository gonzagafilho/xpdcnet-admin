"use client";

import { useMemo } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { MikrotikServerSnapshotHistoryRowFromApi } from "@/lib/api-types";

function parseCounter(s: string | null | undefined): number {
  if (s == null || s === "") return 0;
  const n = Number(String(s).replace(/\s/g, ""));
  return Number.isFinite(n) ? n : 0;
}

function totalFromSnapshot(s: MikrotikServerSnapshotHistoryRowFromApi): number {
  const it = s.interfaceTraffic;
  if (Array.isArray(it) && it.length) {
    return it.reduce((acc, row) => acc + parseCounter(row.rxBytes) + parseCounter(row.txBytes), 0);
  }
  const top = s.topInterfaces;
  if (Array.isArray(top) && top.length) {
    return top.reduce((acc, row) => acc + parseCounter(row.rx) + parseCounter(row.tx), 0);
  }
  return 0;
}

type Props = {
  snapshots: MikrotikServerSnapshotHistoryRowFromApi[];
};

/**
 * Histórico leve (últimas consultas persistidas no servidor). Não é amostragem contínua ao segundo.
 */
export function MonitoringTrafficHistoryChart({ snapshots }: Props) {
  const data = useMemo(() => {
    const sorted = [...snapshots].sort(
      (a, b) => new Date(a.generatedAt).getTime() - new Date(b.generatedAt).getTime(),
    );
    return sorted.map((s, idx) => ({
      idx,
      label: new Date(s.generatedAt).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" }),
      total: totalFromSnapshot(s),
    }));
  }, [snapshots]);

  if (data.length < 2) return null;

  return (
    <div className="space-y-2">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Histórico leve</h3>
      <p className="text-[11px] leading-relaxed text-slate-500">
        Cada ponto é uma consulta guardada ao equipamento (até 10 últimas). Valor = soma aproximada de download +
        upload nos contadores das portas registadas.
      </p>
      <div className="h-48 w-full rounded-lg border border-slate-200/90 bg-white p-2">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis dataKey="label" tick={{ fontSize: 9 }} interval="preserveStartEnd" />
            <YAxis
              tick={{ fontSize: 9 }}
              tickFormatter={(v) => (v >= 1e9 ? `${(v / 1e9).toFixed(1)}G` : v >= 1e6 ? `${(v / 1e6).toFixed(1)}M` : `${v}`)}
            />
            <Tooltip
              formatter={(value) => [
                typeof value === "number" ? value.toLocaleString("pt-BR") : String(value ?? ""),
                "Total (contadores)",
              ]}
              labelFormatter={(l) => String(l)}
              contentStyle={{ fontSize: 11 }}
            />
            <Line type="monotone" dataKey="total" stroke="#0ea5e9" strokeWidth={2} dot={{ r: 3 }} name="Total" />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
