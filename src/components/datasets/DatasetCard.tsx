import type { CSSProperties } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { clsx } from "clsx";
import type { MarketplaceListing } from "../../lib/marketplace";
import { formatApt, formatBytes } from "../../lib/format";

export interface DatasetCardProps {
  listing: MarketplaceListing;
  showPreview?: boolean;
  className?: string;
}

export interface DatasetCardSkeletonProps {
  showPreview?: boolean;
  shimmerDelay?: number;
  className?: string;
}

type SkeletonStyle = CSSProperties & {
  "--sk-delay": string;
};

const previewAccentClasses: Record<MarketplaceListing["category"], string> = {
  dataset: "bg-[var(--accent-soft)] text-accent",
  model: "bg-[var(--success-soft)] text-success",
  benchmark: "bg-[var(--warning-soft)] text-warning",
  embedding: "bg-high text-t2",
  agent: "bg-[var(--accent-dim)] text-accent",
  other: "bg-high text-t3",
};

export function DatasetCard({ listing, showPreview = false, className = "" }: DatasetCardProps) {
  const demandScore = computeDemandScore(listing);
  const visibleTags = listing.tags.slice(0, 3);
  const hiddenTagCount = Math.max(0, listing.tags.length - visibleTags.length);

  return (
    <Link
      to={`/dataset/${listing.id}`}
      className={clsx(
        "d-card group relative block cursor-pointer overflow-hidden rounded-[var(--r-xl)] border border-[var(--border)] p-7",
        "transition-[transform,border-color,box-shadow] duration-[320ms] ease-expo hover:-translate-y-[5px] hover:border-[var(--border-h)]",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg",
        className,
      )}
    >
      {showPreview && <DatasetPreviewPanel listing={listing} demandScore={demandScore} />}

      <div className="flex items-center justify-between gap-3">
        <span className="d-cat inline-flex items-center rounded-[var(--r-sm)] border border-[rgba(99,102,241,0.18)] bg-[var(--accent-soft)] px-[9px] py-[3px] font-mono text-[10px] uppercase tracking-wide text-accent">
          {listing.category}
        </span>
        <span className="shrink-0 font-mono text-[15px] font-medium tracking-[-0.02em] text-t1 [font-feature-settings:'tnum'_1]">
          {formatApt(listing.priceOctas)}
        </span>
      </div>

      <div className="d-bar my-4 h-0.5 overflow-hidden rounded-[1px] bg-[var(--border)]" data-label="demand">
        <motion.div
          className="d-bar-fill h-full rounded-[1px]"
          initial={{ width: 0 }}
          whileInView={{ width: `${demandScore}%` }}
          viewport={{ once: true, margin: "0px 0px -16% 0px" }}
          transition={{ duration: 1.1, ease: motionEase }}
        />
      </div>

      <h3 className="mb-1.5 truncate font-display text-[15px] font-medium tracking-[-0.015em] text-t1 transition-colors duration-200 ease-expo group-hover:text-white">
        {listing.title}
      </h3>
      <p className="mb-4 line-clamp-2 min-h-10 font-body text-sm font-light text-t2">
        {listing.description || "Creator metadata is indexed on-chain and ready for verification."}
      </p>

      <div className="mb-4 flex min-h-5 flex-wrap gap-1.5">
        {visibleTags.map((tag) => (
          <span key={tag} className="d-tag rounded-[var(--r-sm)] border border-[var(--border)] bg-high px-2 py-0.5 font-mono text-[10px] text-t3">
            {tag}
          </span>
        ))}
        {hiddenTagCount > 0 && (
          <span className="d-tag rounded-[var(--r-sm)] border border-[var(--border)] bg-high px-2 py-0.5 font-mono text-[10px] text-t3">
            +{hiddenTagCount} more
          </span>
        )}
      </div>

      <div className="relative min-h-7 overflow-hidden border-t border-[var(--border)] pt-4">
        <p className="d-meta flex items-center gap-[14px] font-mono text-[11px] text-t3 [font-feature-settings:'tnum'_1]">
          <span>{listing.sizeBytes > 0 ? formatBytes(listing.sizeBytes) : "size pending"}</span>
          <span>{listing.format}</span>
          <span>{listing.purchases} purchases</span>
        </p>
        <p className="d-hover-cta absolute inset-x-0 top-4 flex items-center gap-[5px] font-body text-[13px] text-accent opacity-0">
          View dataset
          <ArrowRight className="h-3 w-3 transition-transform duration-200 ease-expo group-hover:translate-x-[3px]" aria-hidden="true" />
        </p>
      </div>
    </Link>
  );
}

export function DatasetCardSkeleton({ showPreview = false, shimmerDelay = 0, className = "" }: DatasetCardSkeletonProps) {
  const style: SkeletonStyle = { "--sk-delay": `${shimmerDelay}s` };

  return (
    <div
      className={clsx("rounded-[var(--r-xl)] border border-[var(--border)] bg-raised p-7", className)}
      style={style}
      aria-hidden="true"
    >
      {showPreview && <div className="d-skeleton-shimmer mb-5 aspect-video rounded-[var(--r)]" />}
      <div className="d-skeleton-shimmer mb-[14px] h-[22px] w-[90px] rounded-[var(--r-sm)]" />
      <div className="d-skeleton-shimmer mb-[18px] h-0.5 w-full rounded-[1px]" />
      <div className="d-skeleton-shimmer mb-2.5 h-[18px] w-3/4 rounded-[var(--r-sm)]" />
      <div className="d-skeleton-shimmer mb-1.5 h-[13px] w-full rounded-[var(--r-sm)]" />
      <div className="d-skeleton-shimmer mb-[18px] h-[13px] w-3/5 rounded-[var(--r-sm)]" />
      <div className="mb-[18px] flex gap-[5px]">
        <span className="d-skeleton-shimmer inline-block h-5 w-[52px] rounded-[var(--r-sm)]" />
        <span className="d-skeleton-shimmer inline-block h-5 w-[52px] rounded-[var(--r-sm)]" />
        <span className="d-skeleton-shimmer inline-block h-5 w-[52px] rounded-[var(--r-sm)]" />
      </div>
      <div className="border-t border-[var(--border)] pt-4">
        <div className="d-skeleton-shimmer h-[13px] w-[55%] rounded-[var(--r-sm)]" />
      </div>
    </div>
  );
}

function DatasetPreviewPanel({ listing, demandScore }: { listing: MarketplaceListing; demandScore: number }) {
  return (
    <div className="mb-5 aspect-video overflow-hidden rounded-lg border border-[var(--border)] bg-bg">
      <div className="flex h-full flex-col justify-between p-4">
        <div className="flex items-center justify-between gap-3">
          <span
            className={clsx(
              "rounded-sm px-2 py-0.5 font-mono text-2xs uppercase tracking-widest",
              previewAccentClasses[listing.category],
            )}
          >
            {listing.format}
          </span>
          <span className="max-w-[112px] truncate font-mono text-2xs uppercase tracking-widest text-t4">#{listing.id}</span>
        </div>

        <div className="grid gap-2">
          <div className="grid grid-cols-6 gap-1.5">
            <span className="h-1 rounded-full bg-high" />
            <span className="h-1 rounded-full bg-high" />
            <span className="h-1 rounded-full bg-high" />
            <span className="h-1 rounded-full bg-high" />
            <span className="h-1 rounded-full bg-high" />
            <span className="h-1 rounded-full bg-high" />
          </div>
          <div className="grid grid-cols-4 gap-1.5">
            <span className="h-1 rounded-full bg-[var(--border-hover)]" />
            <span className="h-1 rounded-full bg-[var(--border-hover)]" />
            <span className="h-1 rounded-full bg-[var(--border-hover)]" />
            <span className="h-1 rounded-full bg-[var(--border-hover)]" />
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-high">
            <div className="h-full rounded-full bg-accent" style={{ width: `${demandScore}%` }} />
          </div>
        </div>
      </div>
    </div>
  );
}

function computeDemandScore(listing: MarketplaceListing): number {
  const score = Math.min(100, Math.max(10, listing.purchases * 18 + listing.views * 2 + Math.round(listing.revenueOctas / 100_000_000) * 8));
  return Math.round(score / 10) * 10;
}

const motionEase = [0.16, 1, 0.3, 1] as const;
