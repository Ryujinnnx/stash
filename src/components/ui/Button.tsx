import type { ButtonHTMLAttributes, ReactNode } from "react";
import { useEffect, useState } from "react";
import { AlertCircle, Check } from "lucide-react";
import { clsx } from "clsx";
import { OrbitalSpinner } from "./OrbitalSpinner";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
export type ButtonSize = "sm" | "md" | "lg";
export type ButtonState = "idle" | "loading" | "success" | "error";

export interface ButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "disabled"> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  state?: ButtonState;
  disabled?: boolean;
  className?: string;
  children: ReactNode;
}

const sizeClasses: Record<ButtonSize, string> = {
  sm: "h-8 px-3 text-xs",
  md: "h-10 px-5 py-2.5 text-sm",
  lg: "h-12 px-6 text-base",
};

const variantClasses: Record<ButtonVariant, string> = {
  primary: "bg-accent text-white hover:bg-[var(--accent-hover)] hover:-translate-y-px hover:shadow-accent",
  secondary: "border border-[var(--border-hover)] bg-transparent text-t1 hover:border-[var(--border-strong)] hover:bg-raised",
  ghost: "border border-transparent bg-transparent text-t2 hover:bg-raised hover:text-t1",
  danger: "border border-[var(--error-soft)] bg-transparent text-error hover:bg-[var(--error-soft)]",
};

const stateClasses: Partial<Record<ButtonState, string>> = {
  success: "border-transparent bg-success text-white hover:bg-success hover:shadow-none",
  error: "border-transparent bg-error text-white hover:bg-error hover:shadow-none",
};

export function Button({
  variant = "primary",
  size = "md",
  state = "idle",
  disabled = false,
  className = "",
  children,
  type = "button",
  ...props
}: ButtonProps) {
  const [visibleState, setVisibleState] = useState<ButtonState>(state);

  useEffect(() => {
    setVisibleState(state);

    if (state !== "success") {
      return undefined;
    }

    const timeout = window.setTimeout(() => setVisibleState("idle"), 2000);
    return () => window.clearTimeout(timeout);
  }, [state]);

  const isLoading = visibleState === "loading";
  const isDisabled = disabled || isLoading;

  return (
    <button
      type={type}
      disabled={isDisabled}
      aria-busy={isLoading}
      data-variant={variant}
      data-state={visibleState}
      className={clsx(
        "stash-button relative isolate inline-flex select-none items-center justify-center gap-2 overflow-hidden rounded-full font-body font-medium",
        "transition-[background-color,border-color,transform,box-shadow,opacity] duration-150 ease-expo",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg",
        "active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50",
        sizeClasses[size],
        visibleState === "idle" || visibleState === "loading" ? variantClasses[variant] : stateClasses[visibleState],
        className,
      )}
      {...props}
    >
      {visibleState === "loading" && <OrbitalSpinner size="sm" className="-ml-0.5" label="Loading action" />}
      {visibleState === "success" && <Check className="h-4 w-4" aria-hidden="true" />}
      {visibleState === "error" && <AlertCircle className="h-4 w-4" aria-hidden="true" />}
      <span className={clsx("relative z-10 inline-flex items-center gap-2", visibleState === "loading" && "opacity-80")}>
        {visibleState === "success" ? "Done" : visibleState === "error" ? "Failed" : children}
      </span>
    </button>
  );
}
