import type { HTMLAttributes, ReactNode } from "react";
import { clsx } from "clsx";

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  interactive?: boolean;
  padded?: boolean;
}

export function Card({ children, interactive = false, padded = true, className = "", ...props }: CardProps) {
  return (
    <div
      className={clsx(
        "rounded-xl border border-[var(--border)] bg-overlay shadow-sm",
        padded && "p-5",
        interactive &&
          "transition-[background-color,border-color,transform,box-shadow] duration-150 ease-expo hover:-translate-y-px hover:border-[var(--border-hover)] hover:bg-high hover:shadow-md",
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}
