import * as React from "react";
import { cn } from "@/lib/cn";

type TableProps = React.HTMLAttributes<HTMLTableElement> & {
  /** Classes no wrapper externo (ex.: integrar num card sem borda duplicada). */
  containerClassName?: string;
};

function Table({ className, containerClassName, ...props }: TableProps) {
  return (
    <div
      className={cn(
        "relative w-full overflow-auto rounded-2xl border border-dcnet-border bg-dcnet-surface shadow-xp-card",
        containerClassName,
      )}
    >
      <table className={cn("w-full caption-bottom text-sm text-dcnet-text", className)} {...props} />
    </div>
  );
}

function TableHeader({ className, ...props }: React.HTMLAttributes<HTMLTableSectionElement>) {
  return <thead className={cn("[&_tr]:border-b border-dcnet-border bg-dcnet-surface-muted", className)} {...props} />;
}

function TableBody({ className, ...props }: React.HTMLAttributes<HTMLTableSectionElement>) {
  return <tbody className={cn("[&_tr:last-child]:border-0", className)} {...props} />;
}

function TableRow({ className, ...props }: React.HTMLAttributes<HTMLTableRowElement>) {
  return (
    <tr
      className={cn(
        "border-b border-dcnet-border/55 transition-colors hover:bg-dcnet-surface-muted data-[state=selected]:bg-dcnet-primary-soft/35",
        className,
      )}
      {...props}
    />
  );
}

function TableHead({ className, ...props }: React.ThHTMLAttributes<HTMLTableCellElement>) {
  return (
    <th
      className={cn(
        "h-11 px-4 text-left align-middle text-xs font-semibold uppercase tracking-wide text-dcnet-muted",
        className,
      )}
      {...props}
    />
  );
}

function TableCell({ className, ...props }: React.TdHTMLAttributes<HTMLTableCellElement>) {
  return <td className={cn("p-3.5 align-middle text-sm text-dcnet-secondary", className)} {...props} />;
}

export { Table, TableHeader, TableBody, TableRow, TableHead, TableCell };
