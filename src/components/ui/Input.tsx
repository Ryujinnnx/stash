import type { InputHTMLAttributes, ReactNode } from "react";
import { forwardRef, useId } from "react";
import { clsx } from "clsx";

export interface InputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "size"> {
  label?: string;
  hint?: string;
  error?: string;
  leftIcon?: ReactNode;
  rightElement?: ReactNode;
  wrapperClassName?: string;
  inputClassName?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { id, label, hint, error, leftIcon, rightElement, wrapperClassName = "", inputClassName = "", className = "", ...props },
  ref,
) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const descriptionId = `${inputId}-description`;
  const description = error ?? hint;

  return (
    <div className={clsx("grid gap-2", wrapperClassName, className)}>
      {label && (
        <label htmlFor={inputId} className="font-body text-sm font-medium text-t1">
          {label}
        </label>
      )}
      <div
        className={clsx(
          "group flex h-10 items-center gap-2 rounded-lg border border-[var(--border)] bg-bg px-3",
          "transition-[background-color,border-color,box-shadow] duration-150 ease-expo hover:border-[var(--border-hover)]",
          "focus-within:border-[var(--border-focus)] focus-within:ring-2 focus-within:ring-accent/30",
          error && "border-error focus-within:border-error focus-within:ring-error/20",
        )}
      >
        {leftIcon && <span className="shrink-0 text-t3 group-focus-within:text-t2">{leftIcon}</span>}
        <input
          ref={ref}
          id={inputId}
          aria-invalid={Boolean(error)}
          aria-describedby={description ? descriptionId : undefined}
          className={clsx(
            "h-full min-w-0 flex-1 bg-transparent font-body text-sm text-t1 outline-none placeholder:text-t3",
            inputClassName,
          )}
          {...props}
        />
        {rightElement && <span className="shrink-0">{rightElement}</span>}
      </div>
      {description && (
        <p id={descriptionId} className={clsx("font-body text-xs", error ? "text-error" : "text-t2")}>
          {description}
        </p>
      )}
    </div>
  );
});
