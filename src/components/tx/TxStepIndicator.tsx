import { motion } from "framer-motion";
import { Check } from "lucide-react";
import { clsx } from "clsx";

export interface TxStepIndicatorProps {
  steps: string[];
  current: number;
  className?: string;
}

function getStepState(index: number, current: number): "past" | "current" | "future" {
  if (index < current) {
    return "past";
  }
  if (index === current) {
    return "current";
  }
  return "future";
}

export function TxStepIndicator({ steps, current, className = "" }: TxStepIndicatorProps) {
  return (
    <nav aria-label="Transaction steps" className={clsx("mb-[52px] flex w-full items-center", className)}>
      {steps.map((step, index) => {
        const state = getStepState(index, current);
        const isPast = state === "past";
        const isCurrent = state === "current";

        return (
          <div key={`${step}-${index}`} className="flex min-w-0 flex-1 items-center last:flex-none">
            <div className="relative flex h-7 w-7 shrink-0 items-center justify-center">
              <motion.div
                aria-current={isCurrent ? "step" : undefined}
                className={clsx(
                  "flex h-7 w-7 shrink-0 items-center justify-center rounded-full font-mono text-[11px]",
                  "transition-[background-color,border-color,box-shadow,color,transform] duration-[350ms] ease-expo",
                  state === "future" && "border border-[var(--border)] bg-transparent text-t3",
                  isCurrent && "stash-step-current border-[1.5px] border-accent bg-[var(--accent-soft)] text-accent",
                  isPast && "border-[1.5px] border-accent bg-accent text-white shadow-[0_0_8px_rgba(99,102,241,0.25)]",
                )}
              >
                {isPast ? <Check className="h-[11px] w-[11px]" strokeWidth={2.5} aria-hidden="true" /> : index + 1}
              </motion.div>
              <span
                className={clsx(
                  "absolute left-1/2 top-[calc(100%+8px)] -translate-x-1/2 whitespace-nowrap font-body text-[11px]",
                  "transition-colors duration-[350ms] ease-expo",
                  isCurrent ? "text-accent" : "text-t3",
                )}
              >
                {step}
              </span>
            </div>
            {index < steps.length - 1 && (
              <div className="relative mx-1 h-px flex-1 overflow-hidden bg-[var(--border)]">
                <motion.div
                  className="absolute inset-y-0 left-0 w-full origin-left bg-accent"
                  initial={false}
                  animate={{ scaleX: isPast ? 1 : 0 }}
                  transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
                />
              </div>
            )}
          </div>
        );
      })}
    </nav>
  );
}
