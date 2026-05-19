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
        "relative w-full overflow-auto rounded-xl border border-slate-200 bg-white shadow-sm",
        containerClassName,
      )}
    >
      <table className={cn("w-full caption-bottom text-sm text-slate-900", className)} {...props} />
    </div>
  );
}

function TableHeader({ className, ...props }: React.HTMLAttributes<HTMLTableSectionElement>) {
  return <thead className={cn("[&_tr]:border-b border-slate-200 bg-slate-50/90", className)} {...props} />;
}

function TableBody({ className, ...props }: React.HTMLAttributes<HTMLTableSectionElement>) {
  return <tbody className={cn("[&_tr:last-child]:border-0", className)} {...props} />;
}

function TableRow({ className, ...props }: React.HTMLAttributes<HTMLTableRowElement>) {
  return (
    <tr
      className={cn(
        "border-b border-slate-100 transition-colors hover:bg-slate-50/90 data-[state=selected]:bg-slate-50",
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
        "h-11 px-4 text-left align-middle text-xs font-semibold uppercase tracking-wide text-slate-600",
        className,
      )}
      {...props}
    />
  );
}

function TableCell({ className, ...props }: React.TdHTMLAttributes<HTMLTableCellElement>) {
  return <td className={cn("p-3.5 align-middle text-sm text-slate-800", className)} {...props} />;
}

export { Table, TableHeader, TableBody, TableRow, TableHead, TableCell };
