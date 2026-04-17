import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "bg-primary px-4 py-2.5 text-primary-foreground shadow-sm hover:bg-primary/90",
        outline: "border border-border bg-background px-4 py-2.5 text-foreground hover:bg-accent hover:text-accent-foreground",
        ghost: "px-3 py-2 text-muted-foreground hover:bg-accent hover:text-accent-foreground",
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
