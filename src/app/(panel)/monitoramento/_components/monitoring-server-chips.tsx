"use client";

import { cn } from "@/lib/cn";

export type ServerChip = { id: string; name: string; online?: boolean };

type Props = {
  servers: ServerChip[];
  value: string | null;
  onChange: (serverId: string | null) => void;
  allLabel?: string;
};

export function MonitoringServerChips({ servers, value, onChange, allLabel = "Todos" }: Props) {
  return (
    <div className="flex flex-wrap gap-2">
      <button
        type="button"
        onClick={() => onChange(null)}
        className={cn(
          "rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors",
          value == null
            ? "border-slate-900 bg-slate-900 text-white"
            : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50",
        )}
      >
        {allLabel}
      </button>
      {servers.map((s) => (
        <button
          key={s.id}
          type="button"
          onClick={() => onChange(s.id)}
          className={cn(
            "rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors",
            value === s.id
              ? "border-slate-900 bg-slate-900 text-white"
              : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50",
          )}
        >
          <span className="mr-1.5 inline-block h-1.5 w-1.5 rounded-full align-middle" style={{ background: s.online ? "#10b981" : "#f43f5e" }} aria-hidden />
          {s.name}
        </button>
      ))}
    </div>
  );
}
