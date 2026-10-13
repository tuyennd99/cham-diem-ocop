import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

type CardTag = "article" | "div" | "section";

export interface CardProps extends HTMLAttributes<HTMLElement> {
  as?: CardTag;
}

export function Card({ as = "div", className, ...props }: CardProps) {
  const mergedClassName = cn("rounded-lg border border-border bg-surface text-fg", className);
  if (as === "article") return <article className={mergedClassName} {...props} />;
  if (as === "section") return <section className={mergedClassName} {...props} />;
  return <div className={mergedClassName} {...props} />;
}
