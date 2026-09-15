import * as React from "react";
import { cn } from "@/lib/cn";

type EmptyStateProps = {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
};

export function EmptyState({ icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div
      className={cn(
        "xp-empty-surface flex flex-col items-center justify-center px-8 py-14 text-center",
        className,
      )}
    >
      {icon ? <div className="mb-3 text-dcnet-muted">{icon}</div> : null}
      <h3 className="text-sm font-semibold text-dcnet-text">{title}</h3>
      {description ? <p className="mt-1 max-w-sm text-sm text-dcnet-muted">{description}</p> : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}
