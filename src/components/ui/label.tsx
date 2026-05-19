import * as React from "react";
import { cn } from "@/lib/cn";

export function Label({
  className,
  htmlFor,
  children,
  ...props
}: React.LabelHTMLAttributes<HTMLLabelElement>) {
  return (
    <label
      htmlFor={htmlFor}
      className={cn("text-sm font-medium leading-none text-slate-700", className)}
      {...props}
    >
      {children}
    </label>
  );
}
