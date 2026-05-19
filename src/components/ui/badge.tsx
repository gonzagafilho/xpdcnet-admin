import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/cn";

const badgeVariants = cva(
  "inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium transition-colors",
  {
    variants: {
      variant: {
        default: "border-transparent bg-slate-100 text-slate-800",
        success: "border-transparent bg-emerald-50 text-emerald-800",
        info: "border-transparent bg-blue-50 text-blue-800",
        error: "border-transparent bg-red-50 text-red-800",
        warning: "border-transparent bg-amber-50 text-amber-900",
        outline: "border-slate-200 text-slate-700",
        muted: "border-transparent bg-slate-100 text-slate-600",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
