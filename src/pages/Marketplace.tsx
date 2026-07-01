import { forwardRef, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion, type Variants } from "framer-motion";
import { ChevronDown, Database, Search } from "lucide-react";
import { clsx } from "clsx";
import { useMarketplace } from "../hooks/useMarketplace";
import type { MarketplaceFilters } from "../lib/marketplace";
import { Button } from "../components/ui/Button";
import { ErrorState } from "../components/ui/ErrorState";
import { DatasetCard, DatasetCardSkeleton } from "../components/datasets/DatasetCard";

type OpenFilter = "category" | "format" | "sort" | null;

interface FilterOption<T extends string> {
  value: T;
  label: string;
}

const motionEase = [0.16, 1, 0.3, 1] as const;
const pageSize = 9;

const defaultFilters: MarketplaceFilters = {
  category: "all",
  format: "all",
  minPriceApt: "",
  maxPriceApt: "",
  sort: "newest",
  search: "",
};

const categoryOptions: FilterOption<MarketplaceFilters["category"]>[] = [
  { value: "all", label: "All categories" },
  { value: "dataset", label: "Datasets" },
  { value: "model", label: "Models" },
  { value: "benchmark", label: "Benchmarks" },
  { value: "embedding", label: "Embeddings" },
  { value: "agent", label: "Agents" },
  { value: "other", label: "Other" },
];

const formatOptions: FilterOption<MarketplaceFilters["format"]>[] = [
  { value: "all", label: "All formats" },
  { value: "csv", label: "CSV" },
  { value: "json", label: "JSON" },
  { value: "parquet", label: "Parquet" },
  { value: "zip", label: "ZIP" },
  { value: "safetensors", label: "Safetensors" },
  { value: "onnx", label: "ONNX" },
  { value: "other", label: "Other" },
];

const sortOptions: FilterOption<MarketplaceFilters["sort"]>[] = [
  { value: "newest", label: "Newest" },
  { value: "price", label: "Price" },
  { value: "popular", label: "Popular" },
];

const fadeUp: Variants = {
  hidden: (index: number) => ({
    opacity: 0,
    y: 16,
    scale: 1,
    transition: { delay: index * 0.05 },
  }),
  visible: (index: number) => ({
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { duration: 0.4, delay: index * 0.05, ease: motionEase },
  }),
  exit: {
    opacity: 0,
    scale: 0.95,
    transition: { duration: 0.2, ease: [0.7, 0, 0.84, 0] },
  },
};

const filterBarEntrance: Variants = {
  hidden: { opacity: 0, y: -8 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5, delay: 0.08, ease: motionEase } },
};

export function Marketplace() {
  const [filters, setFilters] = useState<MarketplaceFilters>(defaultFilters);
  const [openFilter, setOpenFilter] = useState<OpenFilter>(null);
  const [visibleCount, setVisibleCount] = useState(pageSize);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const filterBarRef = useRef<HTMLDivElement>(null);
  const loadMoreTimeoutRef = useRef<number | null>(null);
  const listings = useMarketplace(filters);

  const allListings = listings.data ?? [];
  const visibleListings = useMemo(() => allListings.slice(0, visibleCount), [allListings, visibleCount]);
  const hasMore = visibleCount < allListings.length;

  useEffect(() => {
    function closeOnPointerDown(event: PointerEvent) {
      if (!(event.target instanceof Node)) {
        return;
      }
      if (!filterBarRef.current?.contains(event.target)) {
        setOpenFilter(null);
      }
    }

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpenFilter(null);
      }
    }

    document.addEventListener("pointerdown", closeOnPointerDown);
    document.addEventListener("keydown", closeOnEscape);

    return () => {
      document.removeEventListener("pointerdown", closeOnPointerDown);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, []);

  useEffect(() => {
    if (loadMoreTimeoutRef.current !== null) {
      window.clearTimeout(loadMoreTimeoutRef.current);
      loadMoreTimeoutRef.current = null;
    }
    setIsLoadingMore(false);
    setVisibleCount(pageSize);
  }, [filters]);

  useEffect(() => {
    return () => {
      if (loadMoreTimeoutRef.current !== null) {
        window.clearTimeout(loadMoreTimeoutRef.current);
      }
    };
  }, []);

  const updateFilter = <Key extends keyof MarketplaceFilters>(key: Key, value: MarketplaceFilters[Key]) => {
    setFilters((current) => ({ ...current, [key]: value }));
  };

  const clearFilters = () => {
    setFilters(defaultFilters);
    setOpenFilter(null);
  };

  const loadMore = () => {
    if (isLoadingMore || !hasMore) {
      return;
    }

    setIsLoadingMore(true);
    loadMoreTimeoutRef.current = window.setTimeout(() => {
      setVisibleCount((current) => current + pageSize);
      setIsLoadingMore(false);
      loadMoreTimeoutRef.current = null;
    }, 220);
  };

  return (
    <div className="min-h-[calc(100vh-56px)] bg-bg text-t1">
      <FilterBar
        ref={filterBarRef}
        filters={filters}
        openFilter={openFilter}
        resultCount={allListings.length}
        setOpenFilter={setOpenFilter}
        updateFilter={updateFilter}
      />

      <section className="mx-auto max-w-6xl px-5 py-8 pb-20 md:px-10">
        {listings.isLoading && <MarketplaceSkeletonGrid />}

        {listings.isError && (
          <ErrorState
            title="Marketplace data could not load"
            error={listings.error}
            onRetry={() => {
              void listings.refetch();
            }}
          />
        )}

        {listings.isSuccess && allListings.length === 0 && (
          <MarketplaceEmptyState onClear={clearFilters} />
        )}

        {allListings.length > 0 && (
          <>
            <motion.div layout className="cards-grid grid grid-cols-1 gap-4 min-[581px]:grid-cols-2 min-[901px]:grid-cols-3">
              <AnimatePresence mode="popLayout">
                {visibleListings.map((listing, index) => (
                  <motion.div key={listing.id} layout custom={index} variants={fadeUp} initial="hidden" animate="visible" exit="exit">
                    <DatasetCard listing={listing} />
                  </motion.div>
                ))}
              </AnimatePresence>
            </motion.div>

            {hasMore && (
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "0px 0px -10% 0px" }}
                transition={{ duration: 0.32, ease: motionEase }}
                className="mt-8 flex justify-center"
              >
                <Button variant="secondary" size="md" state={isLoadingMore ? "loading" : "idle"} onClick={loadMore}>
                  Load more datasets
                </Button>
              </motion.div>
            )}
          </>
        )}
      </section>
    </div>
  );
}

interface FilterBarProps {
  filters: MarketplaceFilters;
  openFilter: OpenFilter;
  resultCount: number;
  setOpenFilter: (filter: OpenFilter) => void;
  updateFilter: <Key extends keyof MarketplaceFilters>(key: Key, value: MarketplaceFilters[Key]) => void;
}

const FilterBar = forwardRef<HTMLDivElement, FilterBarProps>(function FilterBar(
  { filters, openFilter, resultCount, setOpenFilter, updateFilter }: FilterBarProps,
  ref,
) {
  return (
    <motion.div
      ref={ref}
      variants={filterBarEntrance}
      initial="hidden"
      animate="visible"
      className="sticky top-14 z-40 flex h-[52px] items-center gap-2 overflow-x-auto border-b border-[var(--border)] bg-[rgba(8,8,16,0.82)] px-5 transition-[border-color] duration-300 ease-expo backdrop-blur-[20px] backdrop-saturate-[180%] md:px-12"
    >
      <label className="flex h-[34px] flex-[0_0_260px] items-center gap-2 rounded-[var(--r)] border border-[var(--border)] bg-raised px-3 transition-[border-color,box-shadow] duration-150 ease-expo focus-within:border-[var(--border-focus)] focus-within:shadow-[0_0_0_3px_var(--accent-dim)]">
        <Search className="h-3.5 w-3.5 shrink-0 text-t3" aria-hidden="true" />
        <input
          value={filters.search}
          onChange={(event) => updateFilter("search", event.target.value)}
          className="min-w-0 flex-1 border-0 bg-transparent font-body text-sm text-t1 outline-none placeholder:text-t3"
          placeholder="Search datasets"
          aria-label="Search datasets"
        />
      </label>

      <FilterChip
        id="category"
        label="Category"
        value={filters.category}
        valueLabel={activeOptionLabel(categoryOptions, filters.category)}
        options={categoryOptions}
        openFilter={openFilter}
        setOpenFilter={setOpenFilter}
        selected={filters.category !== "all"}
        onSelect={(value) => updateFilter("category", value)}
      />
      <FilterChip
        id="format"
        label="Format"
        value={filters.format}
        valueLabel={activeOptionLabel(formatOptions, filters.format)}
        options={formatOptions}
        openFilter={openFilter}
        setOpenFilter={setOpenFilter}
        selected={filters.format !== "all"}
        onSelect={(value) => updateFilter("format", value)}
      />

      <div className="h-5 w-px shrink-0 bg-[var(--border)]" aria-hidden="true" />

      <p className="ml-auto shrink-0 font-mono text-[11px] uppercase tracking-wide text-t3" aria-live="polite">
        {resultCount} datasets
      </p>

      <FilterChip
        id="sort"
        label="Sort"
        value={filters.sort}
        valueLabel={activeOptionLabel(sortOptions, filters.sort)}
        options={sortOptions}
        openFilter={openFilter}
        setOpenFilter={setOpenFilter}
        selected={filters.sort !== "newest"}
        onSelect={(value) => updateFilter("sort", value)}
      />
    </motion.div>
  );
});

interface FilterChipProps<T extends string> {
  id: Exclude<OpenFilter, null>;
  label: string;
  value: T;
  valueLabel: string;
  options: FilterOption<T>[];
  openFilter: OpenFilter;
  setOpenFilter: (filter: OpenFilter) => void;
  selected: boolean;
  onSelect: (value: T) => void;
}

function FilterChip<T extends string>({
  id,
  label,
  value,
  valueLabel,
  options,
  openFilter,
  setOpenFilter,
  selected,
  onSelect,
}: FilterChipProps<T>) {
  const isOpen = openFilter === id;

  return (
    <div className="relative shrink-0">
      <button
        type="button"
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        onClick={() => setOpenFilter(isOpen ? null : id)}
        className={clsx(
          "inline-flex h-[34px] cursor-pointer items-center gap-[5px] rounded-[var(--r)] border px-3 font-mono text-[11px] transition-all duration-150 ease-expo",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg",
          selected
            ? "border-[rgba(99,102,241,0.25)] bg-[var(--accent-soft)] text-accent"
            : "border-[var(--border)] bg-raised text-t2 hover:border-[var(--border-h)] hover:text-t1",
        )}
      >
        <span>{label}</span>
        <span className={clsx("max-w-[128px] truncate", selected ? "text-accent" : "text-t3")}>{valueLabel}</span>
        <ChevronDown className={clsx("h-[11px] w-[11px] transition-transform duration-200 ease-expo", isOpen && "rotate-180")} />
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, scaleY: 0.92 }}
            animate={{ opacity: 1, scaleY: 1 }}
            exit={{ opacity: 0, scaleY: 0.92, transition: { duration: 0.14, ease: [0.7, 0, 0.84, 0] } }}
            transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
            className="absolute left-0 top-[calc(100%+6px)] z-[100] min-w-[180px] origin-top overflow-hidden rounded-[var(--r-lg)] border border-[var(--border-h)] bg-overlay shadow-[0_16px_48px_rgba(0,0,0,0.5),0_4px_12px_rgba(0,0,0,0.3)]"
            role="listbox"
            aria-label={label}
          >
            {options.map((option) => {
              const optionSelected = option.value === value;

              return (
                <button
                  key={option.value}
                  type="button"
                  role="option"
                  aria-selected={optionSelected}
                  onClick={() => {
                    onSelect(option.value);
                    setOpenFilter(null);
                  }}
                  className={clsx(
                    "flex w-full items-center px-4 py-2.5 text-left font-body text-sm transition-colors duration-150 ease-expo",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-overlay",
                    optionSelected ? "text-accent" : "text-t2 hover:bg-high hover:text-t1",
                  )}
                >
                  <span>{option.label}</span>
                  {optionSelected && <span className="ml-auto h-1.5 w-1.5 rounded-full bg-accent" aria-hidden="true" />}
                </button>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function MarketplaceEmptyState({ onClear }: { onClear: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.4, ease: motionEase }}
      className="flex flex-col items-center gap-4 px-10 py-[120px] text-center"
    >
      <div className="mb-2 flex h-14 w-14 items-center justify-center rounded-[var(--r-xl)] border border-[var(--border)] bg-raised text-t4">
        <Database className="h-6 w-6" aria-hidden="true" />
      </div>
      <div className="grid max-w-[36ch] gap-2">
        <h2 className="font-display text-[22px] font-normal tracking-[-0.025em] text-t1">No datasets found</h2>
        <p className="font-body text-[14px] font-light leading-[1.6] text-t2">
          Try different keywords or clear the filters.
        </p>
      </div>
      <Button variant="secondary" size="sm" onClick={onClear}>
        Clear filters
      </Button>
    </motion.div>
  );
}

function MarketplaceSkeletonGrid() {
  return (
    <div className="grid grid-cols-1 gap-4 min-[581px]:grid-cols-2 min-[901px]:grid-cols-3">
      {Array.from({ length: 9 }, (_, index) => (
        <DatasetCardSkeleton key={index} shimmerDelay={index * 0.15} />
      ))}
    </div>
  );
}

function activeOptionLabel<T extends string>(options: FilterOption<T>[], value: T): string {
  return options.find((option) => option.value === value)?.label ?? value;
}
