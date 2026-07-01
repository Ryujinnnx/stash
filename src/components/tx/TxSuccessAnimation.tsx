import type { ReactNode } from "react";
import { useState } from "react";
import { motion } from "framer-motion";
import { Check, ChevronDown } from "lucide-react";
import { Button, type ButtonVariant } from "../ui/Button";

export interface TxSuccessAction {
  label: string;
  onClick: () => void;
  variant?: ButtonVariant;
  icon?: ReactNode;
}

export interface TxSuccessDetail {
  label: string;
  value: string;
}

export interface TxSuccessAnimationProps {
  title: string;
  description: string;
  actions?: TxSuccessAction[];
  details?: TxSuccessDetail[];
  className?: string;
}

export function TxSuccessAnimation({
  title,
  description,
  actions = [],
  details = [],
  className = "",
}: TxSuccessAnimationProps) {
  const [confirmedAction, setConfirmedAction] = useState<string | null>(null);

  function handleAction(action: TxSuccessAction) {
    action.onClick();

    if (!action.label.toLowerCase().includes("copy")) {
      return;
    }

    setConfirmedAction(action.label);
    window.setTimeout(() => setConfirmedAction(null), 1500);
  }

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay: 0.2, duration: 0.32, ease: [0.16, 1, 0.3, 1] }}
      className={`flex flex-col items-center gap-4 px-6 py-10 text-center ${className}`}
    >
      <div className="tx-success-ring relative flex h-[72px] w-[72px] items-center justify-center rounded-full border border-[rgba(34,197,94,0.2)] bg-[rgba(34,197,94,0.08)]">
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ delay: 0.1, type: "spring", stiffness: 360, damping: 22 }}
        >
          <Check className="h-7 w-7 text-success" strokeWidth={2} aria-hidden="true" />
        </motion.div>
      </div>

      <div className="grid max-w-[32ch] gap-2">
        <h2 className="font-display text-[22px] font-medium tracking-[-0.025em] text-t1">{title}</h2>
        <p className="font-body text-[14px] font-light leading-relaxed text-t2">{description}</p>
      </div>

      {actions.length > 0 && (
        <div className="flex flex-wrap justify-center gap-3">
          {actions.map((action) => {
            const isConfirmed = confirmedAction === action.label;
            return (
              <Button key={action.label} variant={action.variant ?? "primary"} onClick={() => handleAction(action)}>
                {isConfirmed ? <Check className="h-4 w-4" aria-hidden="true" /> : action.icon}
                {action.label}
              </Button>
            );
          })}
        </div>
      )}

      {details.length > 0 && (
        <details className="mt-1 w-full max-w-md text-left">
          <summary className="flex cursor-pointer list-none items-center justify-center gap-2 font-mono text-[11px] text-t3 transition-colors duration-150 ease-expo hover:text-t2">
            On-chain receipt
            <ChevronDown className="h-2.5 w-2.5" aria-hidden="true" />
          </summary>
          <div className="mt-3 grid gap-3">
            {details.map((detail) => (
              <div key={detail.label} className="rounded-[var(--r-lg)] border border-[var(--border)] bg-raised px-4 py-[14px]">
                <p className="mb-1 font-mono text-[10px] uppercase tracking-wide text-t3">{detail.label}</p>
                <p className="break-all font-mono text-[12px] leading-[1.6] text-t2">{detail.value}</p>
              </div>
            ))}
          </div>
        </details>
      )}
    </motion.div>
  );
}
