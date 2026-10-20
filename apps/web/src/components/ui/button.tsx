import { cva } from "class-variance-authority";
import { cn } from "@/lib/utils";
import type { ButtonProps } from "@/types/ui";

const buttonVariants = cva(
  "button inline-flex min-h-11 items-center justify-center gap-2 rounded-md px-4 py-2 font-ui text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus)] focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        primary: "button-primary bg-accent text-white hover:bg-accent-hover",
        secondary: "button-secondary border border-border bg-surface text-fg hover:border-accent hover:bg-accent-soft",
      },
    },
    defaultVariants: { variant: "primary" },
  },
);

export function Button({ className, variant, ...props }: ButtonProps) {
  return <button className={cn(buttonVariants({ variant }), className)} {...props} />;
}
