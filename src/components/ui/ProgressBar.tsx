import type { CSSProperties } from "react";
import { clsx } from "clsx";

export interface ProgressBarProps {
  value: number;
  max?: number;
  label?: string;
  showValue?: boolean;
  striped?: boolean;
  className?: string;
}

type ProgressStyle = CSSProperties & {
  "--progress": string;
};

function clampProgress(value: number, max: number): number {
  if (!Number.isFinite(value) || !Number.isFinite(max) || max <= 0) {
    return 0;
  }
  return Math.min(1, Math.max(0, value / max));
}

export function ProgressBar({ value, max = 100, label, showValue = false, striped = false, className = "" }: ProgressBarProps) {
  const progress = clampProgress(value, max);
  const percent = Math.round(progress * 100);
  const style: ProgressStyle = { "--progress": progress.toString() };

  return (
    <div className={clsx("grid gap-2", className)}>
      {(label || showValue) && (
        <div className="flex items-center justify-between gap-3 font-body text-xs text-t2">
          {label && <span>{label}</span>}
          {showValue && <span className="font-mono text-t3">{percent}%</span>}
        </div>
      )}
      <div
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={max}
        aria-valuenow={Math.round(progress * max)}
        className="h-2 overflow-hidden rounded-full bg-raised"
      >
        <div
          className={clsx(
            "h-full origin-left scale-x-[var(--progress)] rounded-full bg-accent transition-transform duration-300 ease-expo",
            striped && "stash-progress-stripes",
          )}
          style={style}
        />
      </div>
    </div>
  );
}
