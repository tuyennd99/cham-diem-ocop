import { forwardRef, type DialogHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export const Dialog = forwardRef<HTMLDialogElement, DialogHTMLAttributes<HTMLDialogElement>>(function Dialog(
  { className, ...props },
  ref,
) {
  return <dialog ref={ref} className={cn("border border-border bg-surface text-fg", className)} {...props} />;
});
