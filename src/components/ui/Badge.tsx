import type { HTMLAttributes, ReactNode } from "react";
import { clsx } from "clsx";

export type BadgeVariant = "default" | "accent" | "success" | "warning" | "error";

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
  children: ReactNode;
}

const variantClasses: Record<BadgeVariant, string> = {
  default: "bg-high text-t3",
  accent: "border border-[rgba(99,102,241,0.2)] bg-[var(--accent-soft)] text-accent",
  success: "bg-[var(--success-soft)] text-success",
  warning: "bg-[var(--warning-soft)] text-warning",
  error: "bg-[var(--error-soft)] text-error",
};

export function Badge({ variant = "default", className = "", children, ...props }: BadgeProps) {
  return (
    <span
      className={clsx(
        "inline-flex items-center rounded-sm px-2 py-0.5 font-mono text-2xs uppercase tracking-widest",
        variantClasses[variant],
        className,
      )}
      {...props}
    >
      {children}
    </span>
  );
}
