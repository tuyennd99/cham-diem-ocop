import { forwardRef } from "react";
import { cn } from "@/lib/utils";
import type { InputProps } from "@/types/ui";

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { className, ...props },
  ref,
) {
  return <input ref={ref} className={cn("font-ui text-fg", className)} {...props} />;
});
