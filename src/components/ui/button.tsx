import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full text-sm font-medium transition-all outline-none ring-offset-background disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "bg-[var(--panel-strong)] px-4 py-2.5 text-[var(--primary-foreground)] shadow-md hover:-translate-y-0.5 hover:shadow-lg",
        outline: "border border-border/80 bg-white/70 px-4 py-2.5 text-[var(--foreground)] hover:bg-white",
        ghost: "px-3 py-2 text-[var(--muted-foreground)] hover:bg-white/70 hover:text-[var(--foreground)]",
      },
      size: {
        default: "h-10",
        sm: "h-9 px-3",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, ...props }, ref) => <button className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />,
);
Button.displayName = "Button";

export { Button, buttonVariants };
