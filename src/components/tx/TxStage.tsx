import { AnimatePresence, motion } from "framer-motion";
import { Check, X } from "lucide-react";
import { clsx } from "clsx";
import { OrbitalSpinner } from "../ui/OrbitalSpinner";

export type TxStageState = "pending" | "active" | "done" | "error";

export interface TxStageDescriptions {
  pending: string;
  active: string;
  done: string;
  error: string;
}

export interface TxStageProps {
  state: TxStageState;
  title: string;
  descriptions: TxStageDescriptions;
  progress?: number;
  stepNumber?: number;
  isLast?: boolean;
  className?: string;
}

const indicatorClasses: Record<TxStageState, string> = {
  pending: "border border-[var(--border)] bg-transparent text-t3",
  active: "border-[1.5px] border-accent bg-transparent text-accent",
  done: "border-[1.5px] border-accent bg-accent text-white shadow-[0_0_12px_rgba(99,102,241,0.3)]",
  error: "border-[1.5px] border-error bg-error text-white",
};

const rowClasses: Record<TxStageState, string> = {
  pending: "bg-transparent",
  active: "bg-[rgba(99,102,241,0.03)]",
  done: "bg-[rgba(34,197,94,0.02)]",
  error: "bg-[rgba(239,68,68,0.02)]",
};

function StageIndicator({ state, stepNumber }: { state: TxStageState; stepNumber: number }) {
  return (
    <motion.div
      className={clsx(
        "mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full font-mono text-[11px]",
        "transition-all duration-[350ms] ease-expo",
        indicatorClasses[state],
      )}
    >
      {state === "active" && <OrbitalSpinner size="sm" label="Transaction stage active" />}
      {state === "done" && <Check className="tx-checkmark h-3.5 w-3.5 text-white" strokeWidth={2.5} aria-hidden="true" />}
      {state === "error" && <X className="h-3.5 w-3.5 text-white" strokeWidth={2.5} aria-hidden="true" />}
      {state === "pending" && stepNumber}
    </motion.div>
  );
}

function clampPercent(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Math.min(100, Math.max(0, value));
}

export function TxStage({
  state,
  title,
  descriptions,
  progress,
  stepNumber = 1,
  isLast = false,
  className = "",
}: TxStageProps) {
  const description = descriptions[state];
  const progressValue = typeof progress === "number" ? clampPercent(progress) : 0;

  return (
    <div
      className={clsx(
        "flex items-start gap-4 px-6 py-[22px] transition-colors duration-[250ms] ease-expo",
        !isLast && "border-b border-[var(--border)]",
        rowClasses[state],
        className,
      )}
    >
      <StageIndicator state={state} stepNumber={stepNumber} />

      <div className="min-w-0 flex-1">
        <p className="mb-1 font-body text-[14px] font-medium text-t1 transition-colors duration-200 ease-expo">{title}</p>
        <AnimatePresence mode="wait">
          <motion.p
            key={`${state}-${description}`}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -2 }}
            transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
            className={clsx(
              "font-body text-[13px] font-light leading-[1.5] text-t2",
              state === "done" && "font-normal text-success",
            )}
          >
            {description}
          </motion.p>
        </AnimatePresence>
        {state === "active" && typeof progress === "number" && (
          <div
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(progressValue)}
            className="mt-3 h-[3px] overflow-hidden rounded-[2px] bg-[var(--border)]"
          >
            <div
              className="tx-progress-fill h-full rounded-[2px] transition-[width] duration-300 ease-expo"
              style={{ width: `${progressValue}%` }}
            />
          </div>
        )}
      </div>
    </div>
  );
}
