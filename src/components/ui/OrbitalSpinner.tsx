import { clsx } from "clsx";

export type OrbitalSpinnerSize = "sm" | "md" | "lg";

interface OrbitalSpinnerProps {
  size?: OrbitalSpinnerSize;
  className?: string;
  label?: string;
}

const outerSize: Record<OrbitalSpinnerSize, string> = {
  sm: "h-5 w-5",
  md: "h-8 w-8",
  lg: "h-12 w-12",
};

const innerSize: Record<OrbitalSpinnerSize, string> = {
  sm: "h-3 w-3",
  md: "h-5 w-5",
  lg: "h-8 w-8",
};

export function OrbitalSpinner({ size = "md", className = "", label = "Loading" }: OrbitalSpinnerProps) {
  return (
    <span
      role="status"
      aria-label={label}
      className={clsx("relative inline-flex shrink-0 items-center justify-center text-accent", outerSize[size], className)}
    >
      <span className="stash-orbit-counter absolute inset-0 rounded-full border-[1.5px] border-transparent border-t-accent" />
      <span className={clsx("stash-orbit-clockwise absolute rounded-full border-[1.5px] border-transparent border-t-[rgba(99,102,241,0.6)]", innerSize[size])} />
      <span className="stash-orbit-dot h-1 w-1 rounded-full bg-accent" />
    </span>
  );
}
