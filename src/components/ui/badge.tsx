import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/cn";

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors",
  {
    variants: {
      variant: {
        default: "border-transparent bg-dcnet-primary-soft text-dcnet-primary",
        success: "border-transparent bg-dcnet-success-soft text-dcnet-success",
        info: "border-transparent bg-dcnet-info-soft text-dcnet-secondary",
        error: "border-transparent bg-dcnet-error-soft text-dcnet-error",
        warning: "border-transparent bg-dcnet-warning-soft text-dcnet-warning",
        outline: "border-dcnet-border text-dcnet-secondary",
        muted: "border-transparent bg-dcnet-info-soft text-dcnet-muted",
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
