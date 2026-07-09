import * as React from "react";
import { cn } from "@/lib/cn";

type Tone = "success" | "error" | "warning" | "info";

type AlertBannerProps = {
  tone?: Tone;
  icon?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
};

const toneClasses: Record<Tone, string> = {
  success: "border-dcnet-success/25 bg-dcnet-success-soft text-dcnet-success",
  error: "border-dcnet-error/25 bg-dcnet-error-soft text-dcnet-error",
  warning: "border-dcnet-warning/25 bg-dcnet-warning-soft text-dcnet-warning",
  info: "border-dcnet-info/20 bg-dcnet-info-soft text-dcnet-secondary",
};

export function AlertBanner({ tone = "info", icon, children, className }: AlertBannerProps) {
  return (
    <div className={cn("flex items-start gap-2 rounded-xl border px-4 py-3 text-sm", toneClasses[tone], className)}>
      {icon ? <span className="mt-0.5 shrink-0">{icon}</span> : null}
      <div className="leading-relaxed">{children}</div>
    </div>
  );
}
