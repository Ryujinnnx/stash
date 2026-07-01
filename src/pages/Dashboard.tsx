import { useEffect, useMemo, useRef, useState } from "react";
import { useWallet } from "@aptos-labs/wallet-adapter-react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { ArrowRight, ArrowUpDown, BarChart2, Database, UploadCloud, Wallet } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { clsx } from "clsx";
import { useCreatorDashboard } from "../hooks/useMarketplace";
import { formatApt, formatDate } from "../lib/format";
import type { CreatorTransaction, MarketplaceListing } from "../lib/marketplace";
import { resolveAccountAddress } from "../lib/wallet";
import { Button } from "../components/ui/Button";
import { ErrorState } from "../components/ui/ErrorState";
import { Skeleton } from "../components/ui/Skeleton";
import { WalletAddress } from "../components/ui/WalletAddress";
import { WalletButton } from "../components/layout/Nav";

gsap.registerPlugin(ScrollTrigger);

interface SummaryStat {
  label: string;
  value: string;
  primary?: boolean;
  counter?: {
    target: number;
    decimals: number;
  };
  delta?: {
    value: string;
    direction: "up" | "down";
  };
}

type DatasetSortKey = "title" | "purchases" | "revenue" | "lastSale";
type SortDirection = "asc" | "desc";

interface DatasetSortState {
  key: DatasetSortKey;
  direction: SortDirection;
}

export function Dashboard() {
  const wallet = useWallet();
  const navigate = useNavigate();
  const pageRef = useRef<HTMLElement>(null);
  const accountAddress = resolveAccountAddress(wallet.account);
  const dashboard = useCreatorDashboard(accountAddress);
  const connected = Boolean(wallet.connected && accountAddress);

  useEffect(() => {
    const page = pageRef.current;
    if (!connected || !page || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      return undefined;
    }

    const ctx = gsap.context(() => {
      gsap
        .timeline({ delay: 0.1 })
        .fromTo(
          ".dashboard-page-header",
          { opacity: 0, y: 16, filter: "blur(4px)" },
          { opacity: 1, y: 0, filter: "blur(0px)", duration: 0.6, ease: "power3.out" },
        )
        .fromTo(
          ".summary-cell",
          { opacity: 0, y: 12 },
          { opacity: 1, y: 0, duration: 0.5, stagger: 0.07, ease: "power2.out" },
          "-=0.35",
        )
        .fromTo(
          ".dashboard-table",
          { opacity: 0, y: 20 },
          { opacity: 1, y: 0, duration: 0.5, ease: "power2.out" },
          "-=0.2",
        );
    }, page);

    return () => ctx.revert();
  }, [connected]);

  if (!connected || !accountAddress) {
    return <ConnectPrompt />;
  }

  return (
    <section ref={pageRef} className="dashboard-page mx-auto max-w-6xl px-5 md:px-10">
      <header className="dashboard-page-header">
        <div className="grid gap-1.5">
          <h1 className="dashboard-page-title">Dashboard</h1>
          <WalletAddress address={accountAddress} className="-ml-2 justify-self-start" />
        </div>
        <Button
          variant="secondary"
          size="sm"
          className="dashboard-publish-button"
          onClick={() => navigate("/upload")}
        >
          <UploadCloud className="h-3.5 w-3.5" aria-hidden="true" />
          Publish dataset
        </Button>
      </header>

      {dashboard.isError && (
        <ErrorState
          error={dashboard.error}
          title="Dashboard could not load"
          onRetry={() => void dashboard.refetch()}
        />
      )}

      {!dashboard.isError && (
        <>
          <SummaryBar
            loading={dashboard.isLoading}
            stats={buildSummaryStats(
              dashboard.data?.totalEarningsOctas ?? 0,
              dashboard.data?.listings.length ?? 0,
              dashboard.data?.totalUniqueBuyers ?? 0,
              dashboard.data?.lastSaleAt ?? null,
            )}
          />

          <DatasetTable
            loading={dashboard.isLoading}
            listings={dashboard.data?.listings ?? []}
            onPublish={() => navigate("/upload")}
          />

          <RecentTransactions transactions={dashboard.data?.recentTransactions ?? []} />
        </>
      )}
    </section>
  );
}

function ConnectPrompt() {
  return (
    <section className="dashboard-disconnected px-5">
      <div className="dashboard-disconnected-card">
        <div className="dashboard-disconnected-icon">
          <Wallet className="h-7 w-7" aria-hidden="true" />
        </div>
        <div className="grid max-w-md gap-2">
          <h2 className="dashboard-disconnected-title">Connect your wallet</h2>
          <p className="dashboard-disconnected-sub">See your datasets, sales, and revenue.</p>
        </div>
        <WalletButton variant="primary" size="lg" />
        <p className="font-mono text-[11px] text-t4">Supports Petra, Martian, Pontem</p>
      </div>
    </section>
  );
}

function SummaryBar({ stats, loading }: { stats: SummaryStat[]; loading: boolean }) {
  const summaryRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = summaryRef.current;
    if (!container || loading || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      return undefined;
    }

    const tweens: gsap.core.Tween[] = [];
    const counters = gsap.utils.toArray<HTMLElement>("[data-dashboard-counter]", container);
    const trigger = ScrollTrigger.create({
      trigger: container,
      start: "top 85%",
      once: true,
      onEnter: () => {
        counters.forEach((counter) => {
          const target = Number(counter.dataset.target ?? "0");
          const decimals = Number(counter.dataset.decimals ?? "0");
          const value = { n: 0 };

          counter.textContent = formatCounter(0, decimals);
          counter.style.filter = "blur(8px)";
          counter.style.opacity = "0.2";

          tweens.push(
            gsap.to(counter, {
              filter: "blur(0px)",
              opacity: 1,
              duration: 0.7,
              ease: "power2.out",
            }),
            gsap.to(value, {
              n: target,
              duration: 1.6,
              ease: "power2.out",
              onUpdate: () => {
                counter.textContent = formatCounter(value.n, decimals);
              },
              onComplete: () => {
                counter.textContent = formatCounter(target, decimals);
              },
            }),
          );
        });
      },
    });

    return () => {
      trigger.kill();
      tweens.forEach((tween) => tween.kill());
    };
  }, [loading, stats]);

  return (
    <div
      ref={summaryRef}
      className="summary-bar mb-10"
    >
      {stats.map((stat, index) => (
        <div
          key={stat.label}
          className={clsx("summary-cell", stat.primary && "summary-cell-primary")}
        >
          {loading ? (
            <>
              <Skeleton variant="text" className="mb-3 h-8 w-28" />
              <Skeleton variant="text" className="h-3 w-32" />
            </>
          ) : (
            <>
              {stat.delta && (
                <span className={clsx("summary-delta", stat.delta.direction === "up" ? "summary-delta-up" : "summary-delta-down")}>
                  {stat.delta.value}
                </span>
              )}
              <p
                className={clsx(
                  "summary-value",
                  stat.label.startsWith("Total revenue") ? "summary-value-revenue" : "summary-value-count",
                )}
                data-dashboard-counter={stat.counter ? "true" : undefined}
                data-target={stat.counter?.target}
                data-decimals={stat.counter?.decimals}
              >
                {stat.value}
              </p>
              <p className="summary-label">{stat.label}</p>
            </>
          )}
        </div>
      ))}
    </div>
  );
}

function DatasetTable({
  loading,
  listings,
  onPublish,
}: {
  loading: boolean;
  listings: MarketplaceListing[];
  onPublish: () => void;
}) {
  const tableRef = useRef<HTMLDivElement>(null);
  const [sort, setSort] = useState<DatasetSortState>({ key: "lastSale", direction: "desc" });
  const sortedListings = useMemo(() => sortListings(listings, sort), [listings, sort]);

  useEffect(() => {
    const table = tableRef.current;
    if (!table || loading || sortedListings.length === 0 || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      return undefined;
    }

    const rows = gsap.utils.toArray<HTMLElement>(".dashboard-table-row", table);
    const tween = gsap.fromTo(
      rows,
      { opacity: 0, x: -12 },
      {
        opacity: 1,
        x: 0,
        duration: 0.45,
        stagger: 0.05,
        ease: "power2.out",
        scrollTrigger: {
          trigger: table,
          start: "top 85%",
          once: true,
        },
      },
    );

    return () => {
      tween.scrollTrigger?.kill();
      tween.kill();
    };
  }, [loading, sortedListings]);

  function updateSort(key: DatasetSortKey) {
    setSort((current) => ({
      key,
      direction: current.key === key && current.direction === "desc" ? "asc" : "desc",
    }));
  }

  return (
    <section>
      <h2 className="mb-5 font-mono text-2xs uppercase tracking-widest text-t3">Datasets</h2>
      <div ref={tableRef} className="dashboard-table">
        <div className="overflow-x-auto">
          <div className="dashboard-table-inner">
            <div className="dashboard-table-grid dashboard-table-header">
              <SortableHeader label="Dataset" sortKey="title" sort={sort} onSort={updateSort} />
              <SortableHeader label="Sales" sortKey="purchases" sort={sort} onSort={updateSort} />
              <SortableHeader label="Revenue" sortKey="revenue" sort={sort} onSort={updateSort} />
              <SortableHeader label="Last sale" sortKey="lastSale" sort={sort} onSort={updateSort} />
              <span aria-hidden="true" />
            </div>

            {loading && <DatasetTableSkeleton />}

            {!loading && sortedListings.length > 0 && (
              <div>
                {sortedListings.map((listing) => (
                  <div key={listing.id} className="dashboard-table-grid dashboard-table-row">
                    <div className="dashboard-dataset-cell">
                      <DatasetThumb listing={listing} />
                      <p className="dashboard-dataset-name">{listing.title}</p>
                    </div>
                    <p className="dashboard-sales">{listing.purchases}</p>
                    <p className="dashboard-revenue">{formatApt(listing.revenueOctas)}</p>
                    <p className="dashboard-date">{formatLastSale(listing.lastSaleAt)}</p>
                    <Link
                      to={`/dataset/${listing.id}`}
                      aria-label={`Open ${listing.title}`}
                      className="dashboard-row-link"
                    >
                      <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                    </Link>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {!loading && sortedListings.length === 0 && (
          <div className="dashboard-table-empty">
            <BarChart2 className="h-7 w-7 text-t4" aria-hidden="true" />
            <div className="grid gap-2">
              <h3 className="font-display text-[20px] text-t1">No datasets yet</h3>
              <p className="font-body text-[13px] text-t2">Publish your first dataset to start earning.</p>
            </div>
            <Button size="sm" onClick={onPublish}>
              Publish dataset
            </Button>
          </div>
        )}
      </div>
    </section>
  );
}

function SortableHeader({
  label,
  sortKey,
  sort,
  onSort,
}: {
  label: string;
  sortKey: DatasetSortKey;
  sort: DatasetSortState;
  onSort: (key: DatasetSortKey) => void;
}) {
  const sorted = sort.key === sortKey;

  return (
    <button
      type="button"
      onClick={() => onSort(sortKey)}
      className={clsx("dashboard-sort-header", sorted && "dashboard-sort-header-active")}
      aria-sort={sorted ? (sort.direction === "asc" ? "ascending" : "descending") : "none"}
    >
      {label}
      <ArrowUpDown className={clsx("h-2.5 w-2.5 transition-transform duration-150 ease-expo", sorted && sort.direction === "asc" && "rotate-180")} />
    </button>
  );
}

function DatasetTableSkeleton() {
  return (
    <div>
      {Array.from({ length: 5 }).map((_, index) => (
        <div key={index} className="dashboard-table-grid dashboard-table-row">
          <div className="dashboard-dataset-cell">
            <span className="dashboard-table-skeleton h-9 w-9 rounded-full" />
            <span className="dashboard-table-skeleton h-[14px] w-[55%] rounded-[var(--r-sm)]" />
          </div>
          <span className="dashboard-table-skeleton h-[13px] w-8 rounded-[var(--r-sm)]" />
          <span className="dashboard-table-skeleton h-[13px] w-20 rounded-[var(--r-sm)]" />
          <span className="dashboard-table-skeleton h-[11px] w-24 rounded-[var(--r-sm)]" />
          <span className="dashboard-table-skeleton h-5 w-7 rounded-[var(--r-sm)]" />
        </div>
      ))}
    </div>
  );
}

function RecentTransactions({ transactions }: { transactions: CreatorTransaction[] }) {
  const [showAll, setShowAll] = useState(false);
  const visibleTransactions = showAll ? transactions : transactions.slice(0, 5);

  return (
    <section className="mt-10">
      <div className="mb-4 flex items-center justify-between gap-4">
        <h2 className="font-mono text-[11px] uppercase tracking-wide text-t3">Recent transactions</h2>
        {transactions.length > 5 && (
          <button
            type="button"
            onClick={() => setShowAll((current) => !current)}
            className="font-mono text-[11px] text-accent transition-colors duration-150 ease-expo hover:text-t1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
          >
            {showAll ? "Show less" : "View all →"}
          </button>
        )}
      </div>

      <div className="dashboard-tx-list">
        {transactions.length === 0 ? (
          <p className="px-5 py-8 font-body text-sm font-light text-t2">
            Sales will appear here after buyers unlock access to your datasets.
          </p>
        ) : (
          visibleTransactions.map((transaction) => <TransactionItem key={transaction.id} transaction={transaction} />)
        )}
      </div>
    </section>
  );
}

function TransactionItem({ transaction }: { transaction: CreatorTransaction }) {
  return (
    <div className="dashboard-tx-item">
      <span className={clsx("dashboard-tx-dot", txStatusClass(transaction.status))} aria-hidden="true" />
      <p className="dashboard-tx-name">{transaction.datasetTitle}</p>
      <p className="dashboard-tx-amount">{formatApt(transaction.amountOctas)}</p>
      <p className="dashboard-tx-date">{transaction.date ? formatDate(transaction.date) : "Indexing"}</p>
      <button
        type="button"
        onClick={() => void navigator.clipboard?.writeText(transaction.id)}
        className="dashboard-tx-hash"
        aria-label={`Copy transaction hash ${transaction.id}`}
      >
        {compactHash(transaction.id)}
      </button>
    </div>
  );
}

function DatasetThumb({ listing }: { listing: MarketplaceListing }) {
  if (listing.previewUrl) {
    return (
      <img
        src={listing.previewUrl}
        alt=""
        className="dashboard-thumb object-cover"
      />
    );
  }

  return (
    <span className="dashboard-thumb flex items-center justify-center text-t3" aria-hidden="true">
      <Database className="h-4 w-4" />
    </span>
  );
}

function buildSummaryStats(
  totalEarningsOctas: number,
  datasetsPublished: number,
  totalUniqueBuyers: number,
  lastSaleAt: number | null,
): SummaryStat[] {
  const earningsApt = totalEarningsOctas / 100_000_000;

  return [
    {
      label: "Total revenue (APT)",
      value: formatCounter(earningsApt, 1),
      primary: true,
      counter: { target: earningsApt, decimals: 1 },
    },
    {
      label: "Datasets published",
      value: datasetsPublished.toLocaleString(),
      counter: { target: datasetsPublished, decimals: 0 },
    },
    {
      label: "Unique buyers",
      value: totalUniqueBuyers.toLocaleString(),
      counter: { target: totalUniqueBuyers, decimals: 0 },
    },
    {
      label: "Last sale",
      value: formatLastSale(lastSaleAt),
    },
  ];
}

function formatCounter(value: number, decimals: number): string {
  return new Intl.NumberFormat("en", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);
}

function formatLastSale(timestamp: number | null): string {
  return timestamp ? formatDate(timestamp) : "No sales yet";
}

function sortListings(listings: MarketplaceListing[], sort: DatasetSortState): MarketplaceListing[] {
  const direction = sort.direction === "asc" ? 1 : -1;

  return [...listings].sort((a, b) => {
    if (sort.key === "title") {
      return a.title.localeCompare(b.title) * direction;
    }
    if (sort.key === "purchases") {
      return (a.purchases - b.purchases) * direction;
    }
    if (sort.key === "revenue") {
      return (a.revenueOctas - b.revenueOctas) * direction;
    }
    return ((a.lastSaleAt ?? 0) - (b.lastSaleAt ?? 0)) * direction;
  });
}

function compactHash(value: string): string {
  if (value.length <= 13) {
    return value;
  }
  return `${value.slice(0, 6)}...${value.slice(-4)}`;
}

function txStatusClass(status: CreatorTransaction["status"]): string {
  if (status === "error") {
    return "dashboard-tx-dot-error";
  }
  if (status === "warning") {
    return "dashboard-tx-dot-pending";
  }
  return "dashboard-tx-dot-success";
}
