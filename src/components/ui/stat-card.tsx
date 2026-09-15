import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/cn";

type StatTone = "primary" | "success" | "error" | "warning" | "info";

type StatCardProps = {
  label: string;
  value: string | number;
  icon: LucideIcon;
  tone?: StatTone;
  compact?: boolean;
};

const toneMap: Record<StatTone, string> = {
  primary: "border-dcnet-primary/20 bg-dcnet-primary-soft text-dcnet-primary",
  success: "border-dcnet-success/20 bg-dcnet-success-soft text-dcnet-success",
  error: "border-dcnet-error/20 bg-dcnet-error-soft text-dcnet-error",
  warning: "border-dcnet-warning/20 bg-dcnet-warning-soft text-dcnet-warning",
  info: "border-dcnet-border bg-dcnet-surface text-dcnet-secondary",
};

export function StatCard({ label, value, icon: Icon, tone = "info", compact = false }: StatCardProps) {
  return (
    <div
      className={cn(
        "flex items-center justify-between rounded-2xl border px-4 shadow-xp-xs",
        compact ? "h-20" : "h-24",
        toneMap[tone],
      )}
    >
      <div className="min-w-0">
        <p className="text-xs font-semibold uppercase tracking-wide opacity-80">{label}</p>
        <p className={cn("mt-1 tabular-nums text-dcnet-text", compact ? "text-xl font-bold" : "text-2xl font-bold")}>{value}</p>
      </div>
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/85 shadow-xp-xs">
        <Icon className="h-5 w-5" />
      </div>
    </div>
  );
}
