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
      className={cn("text-sm font-medium leading-none text-dcnet-900", className)}
      {...props}
    >
      {children}
    </label>
  );
}
