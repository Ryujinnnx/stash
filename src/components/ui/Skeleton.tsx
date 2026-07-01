import type { HTMLAttributes } from "react";
import { clsx } from "clsx";

export type SkeletonVariant = "text" | "title" | "card" | "image";

export interface SkeletonProps extends HTMLAttributes<HTMLDivElement> {
  variant?: SkeletonVariant;
}

const variantClasses: Record<SkeletonVariant, string> = {
  text: "h-4 w-full",
  title: "h-8 w-2/3",
  card: "h-40 w-full",
  image: "aspect-video w-full",
};

export function Skeleton({ variant = "text", className = "", ...props }: SkeletonProps) {
  return <div aria-hidden="true" className={clsx("stash-skeleton rounded-lg bg-raised", variantClasses[variant], className)} {...props} />;
}
