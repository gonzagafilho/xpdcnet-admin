import * as React from "react";
import { cn } from "@/lib/cn";

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  error?: string;
}

const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, error, id, children, ...props }, ref) => {
    return (
      <div className="w-full space-y-1">
        <select
          id={id}
          ref={ref}
          className={cn(
            "flex h-10 w-full appearance-none rounded-xl border border-dcnet-border bg-white px-3 py-1 pr-8 text-sm text-dcnet-text shadow-xp-xs",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-dcnet-primary/45 focus-visible:ring-offset-1",
            "disabled:cursor-not-allowed disabled:opacity-50",
            error && "border-red-400",
            className,
          )}
          aria-invalid={error ? "true" : undefined}
          {...props}
        >
          {children}
        </select>
        {error ? (
          <p className="text-xs text-red-600" role="alert">
            {error}
          </p>
        ) : null}
      </div>
    );
  },
);
Select.displayName = "Select";

export { Select };
