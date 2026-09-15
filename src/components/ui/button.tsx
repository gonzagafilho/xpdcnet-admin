import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/cn";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl text-sm font-semibold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-dcnet-primary/45 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default: "bg-dcnet-primary text-white shadow-xp-xs hover:bg-dcnet-primary-dark",
        secondary: "bg-dcnet-primary-soft text-dcnet-primary hover:bg-dcnet-primary-soft/70",
        outline: "border border-dcnet-border bg-white text-dcnet-secondary hover:bg-dcnet-surface-muted",
        ghost: "text-dcnet-secondary hover:bg-dcnet-surface-muted",
        destructive: "bg-dcnet-error text-white shadow-xp-xs hover:bg-dcnet-error/90",
        success: "bg-dcnet-success text-white shadow-xp-xs hover:bg-dcnet-success/90",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-8 rounded-lg px-3 text-xs",
        lg: "h-11 rounded-xl px-6",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />;
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
