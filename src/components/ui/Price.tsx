import { clsx } from "clsx";
import { Skeleton } from "./Skeleton";

export type PriceSize = "sm" | "md" | "lg";

export interface PriceProps {
  amount: number | string;
  currency?: string;
  size?: PriceSize;
  loading?: boolean;
  className?: string;
}

const sizeClasses: Record<PriceSize, string> = {
  sm: "text-lg",
  md: "text-2xl",
  lg: "text-3xl",
};

const skeletonHeight: Record<PriceSize, string> = {
  sm: "h-7",
  md: "h-9",
  lg: "h-11",
};

function formatAmount(amount: number | string): string {
  if (typeof amount === "string") {
    return amount;
  }
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 8,
  }).format(amount);
}

export function Price({ amount, currency = "APT", size = "md", loading = false, className = "" }: PriceProps) {
  if (loading) {
    return <Skeleton className={clsx("w-20", skeletonHeight[size], className)} />;
  }

  return (
    <span className={clsx("inline-flex items-baseline font-mono", className)}>
      <span className={clsx("tracking-[-0.02em] text-t1", sizeClasses[size])}>{formatAmount(amount)}</span>
      <span className="ml-1 text-sm text-t3">{currency}</span>
    </span>
  );
}
