import { useEffect, useMemo, useRef } from "react";
import { CircleDollarSign, LockKeyhole, UploadCloud } from "lucide-react";
import { Link } from "react-router-dom";
import { clsx } from "clsx";
import { useMarketplace, useMarketplaceStats } from "../hooks/useMarketplace";
import {
  animateCounter,
  cleanupScrollTriggers,
  initCtaEntrance,
  initDatasetCardStagger,
  initFooterLinks,
  initHeroChoreography,
  initScrollHintFade,
  initSectionEyebrows,
  initStatementLines,
  initStepStagger,
} from "../lib/landingMotion";
import type { MarketplaceFilters, MarketplaceListing, MarketplaceStats } from "../lib/marketplace";
import { DatasetCard, DatasetCardSkeleton } from "../components/datasets/DatasetCard";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { Skeleton } from "../components/ui/Skeleton";

const previewFilters: MarketplaceFilters = {
  category: "all",
  format: "all",
  minPriceApt: "",
  maxPriceApt: "",
  sort: "popular",
  search: "",
};

interface LandingStat {
  target: number;
  label: string;
  caption: string;
  unit?: string;
  prefix?: string;
  decimals?: number;
}

const steps = [
  {
    number: "01",
    icon: UploadCloud,
    title: "Upload once",
    body: "Drop files to Shelby. Encrypted, distributed, sub-second reads.",
  },
  {
    number: "02",
    icon: LockKeyhole,
    title: "Set your price",
    body: "Move contract enforces every rule. No platform overrides your terms.",
  },
  {
    number: "03",
    icon: CircleDollarSign,
    title: "Get paid in APT",
    body: "Payments clear instantly. 2.5% protocol fee, nothing else.",
  },
];

const features = [
  {
    badge: "Censorship-resistant",
    tag: "Shelby storage",
    title: "No takedowns.",
    body: "Stored on Shelby with no single point of control.",
  },
  {
    badge: "Sub-second reads",
    tag: "Hot delivery",
    title: "CDN speed.",
    body: "Shelby delivers globally at CDN latency.",
  },
  {
    badge: "On-chain provenance",
    tag: "Aptos records",
    title: "Every byte.",
    body: "Ownership and access history on Aptos, forever.",
  },
  {
    badge: "Instant settlement",
    tag: "Move payments",
    title: "Pay in APT.",
    body: "Smart contract, no invoices, no waiting periods.",
  },
];

export function Landing() {
  const rootRef = useRef<HTMLDivElement>(null);
  const listings = useMarketplace(previewFilters);
  const marketplaceStats = useMarketplaceStats();
  const previewListings = useMemo(() => (listings.data ?? []).slice(0, 3), [listings.data]);
  const landingStats = useMemo(() => buildLandingStats(marketplaceStats.data), [marketplaceStats.data]);

  useEffect(() => {
    const cleanupEyebrows = initSectionEyebrows(".section-eyebrow");
    initHeroChoreography();
    initStatementLines("[data-statement-line]");
    initStepStagger(".step-item", ".steps-grid");
    initCtaEntrance();
    initFooterLinks(".foot-links a");
    initScrollHintFade("#scroll-hint");

    return () => {
      cleanupEyebrows();
      cleanupScrollTriggers();
    };
  }, []);

  useEffect(() => {
    if (previewListings.length > 0) {
      initDatasetCardStagger(".cards-grid .d-card", ".cards-grid");
    }
  }, [previewListings.length]);

  return (
    <div ref={rootRef} className="landing-page bg-bg text-t1">
      <Hero />
      <StatsBar stats={landingStats} loading={marketplaceStats.isLoading} error={marketplaceStats.error} />
      <StatementBlock />
      <HowItWorks />
      <FeatureGrid />
      <DatasetPreview listings={previewListings} loading={listings.isLoading} error={listings.error} />
      <CtaSection />
      <Footer />
    </div>
  );
}

function Hero() {
  return (
    <section className="landing-hero relative flex min-h-[calc(100vh-56px)] flex-col items-center justify-center overflow-hidden px-5 text-center">
      <div className="pointer-events-none absolute inset-x-0 top-1/2 h-px bg-[var(--border)]" />
      <div className="pointer-events-none absolute left-1/2 top-0 h-full w-px bg-[var(--border)]" />

      <div className="relative z-10 flex flex-col items-center">
        <p className="hero-eyebrow mb-8 flex items-center gap-2 font-mono text-2xs uppercase tracking-widest text-accent">
          <span className="h-1.5 w-1.5 rounded-full bg-accent animate-pulse" />
          Shelby hot storage x Aptos payments
        </p>

        <h1 className="hero-h1 max-w-[14ch] font-display text-t1">
          <span className="block whitespace-nowrap">Your data.</span>
          <span className="block whitespace-nowrap">
            Finally <em className="not-italic">yours.</em>
          </span>
        </h1>

        <p className="hero-sub mt-6 max-w-[44ch] font-body text-lg font-light text-t2">
          Publish datasets and models with files on Shelby, access on Aptos, and revenue paid directly to your wallet.
        </p>

        <div className="hero-actions mt-10 flex flex-col gap-3 sm:flex-row">
          <Link to="/upload">
            <Button size="lg" className="w-full sm:w-auto">
              Start selling
            </Button>
          </Link>
          <Link to="/marketplace">
            <Button variant="ghost" size="lg" className="w-full sm:w-auto">
              Browse datasets <span aria-hidden="true">&rarr;</span>
            </Button>
          </Link>
        </div>

        <ProtocolPanel />
      </div>

      <div
        id="scroll-hint"
        className="absolute bottom-10 flex flex-col items-center gap-3 font-mono text-2xs uppercase tracking-widest text-t4"
      >
        Scroll
        <span className="h-10 w-px bg-gradient-to-b from-t4 to-transparent" />
      </div>
    </section>
  );
}

function ProtocolPanel() {
  const rows = [
    { label: "Storage", value: "Shelby blob", status: "hot" },
    { label: "Access", value: "Move resource", status: "gated" },
    { label: "Payment", value: "APT escrow", status: "settled" },
  ];

  return (
    <div className="protocol-panel mt-14 w-full max-w-3xl" aria-label="Stash protocol flow">
      <div className="protocol-panel-top flex items-center justify-between gap-4 border-b border-[var(--border)] px-4 py-3">
        <span className="font-mono text-2xs uppercase tracking-widest text-t3">Publish route</span>
        <span className="inline-flex items-center gap-2 font-mono text-2xs uppercase tracking-widest text-success">
          <span className="h-1.5 w-1.5 rounded-full bg-success" />
          Event sourced
        </span>
      </div>
      <div className="grid gap-px bg-[var(--border)] sm:grid-cols-3">
        {rows.map((row) => (
          <div key={row.label} className="protocol-cell bg-[var(--bg-raised)] p-4 text-left">
            <p className="mb-2 font-mono text-2xs uppercase tracking-widest text-t3">{row.label}</p>
            <p className="font-display text-base font-medium text-t1">{row.value}</p>
            <p className="mt-4 font-mono text-2xs uppercase tracking-widest text-accent">{row.status}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function StatsBar({ stats, loading, error }: { stats: LandingStat[]; loading: boolean; error: Error | null }) {
  useEffect(() => {
    if (!loading && !error) {
      animateCounter("[data-landing-counter]");
    }
  }, [error, loading, stats]);

  return (
    <section className="stat-bar mx-auto w-[calc(100%-40px)] max-w-5xl">
      <div className="stat-grid grid grid-cols-2 md:grid-cols-4">
        {stats.map((stat, index) => (
          <div
            key={stat.label}
            className={clsx("stat-cell", index === 2 && "stat-cell-primary")}
          >
            <p className="stat-label">{stat.label}</p>
            {loading ? (
              <Skeleton variant="text" className="mb-3 h-10 w-24" />
            ) : error ? (
              <p className="stat-value stat-value-muted">Syncing</p>
            ) : (
              <p
                className="stat-value"
              >
                <span
                  className="stat-num"
                  data-landing-counter
                  data-target={stat.target}
                  data-prefix={stat.prefix ?? ""}
                  data-suffix=""
                  data-decimals={stat.decimals ?? 0}
                >
                  {stat.prefix ?? ""}0
                </span>
                {stat.unit && <span className="stat-unit">{stat.unit}</span>}
              </p>
            )}
            <p className="stat-caption">{stat.caption}</p>
          </div>
        ))}
      </div>
      {error && (
        <p className="border-t border-[var(--border)] px-6 py-3 font-body text-sm font-light text-t2 md:px-8">
          Live stats are waiting on the Aptos Indexer. The marketplace remains available while events sync.
        </p>
      )}
    </section>
  );
}

function StatementBlock() {
  return (
    <section className="statement mx-auto max-w-5xl px-5 py-32 md:px-10">
      <p data-statement-line className="s-line statement-line font-display font-light">
        Platforms rent you reach.
      </p>
      <p data-statement-line className="s-line statement-line font-display font-light">
        Then rewrite the terms.
      </p>
      <p data-statement-line className="s-line statement-line font-display font-medium">
        <span className="s-accent">Stash</span> records the terms.
      </p>
      <p data-statement-line className="s-line statement-line font-display font-light">
        Files stay on Shelby.
      </p>
      <p data-statement-line className="s-line statement-line font-display font-light">
        Revenue moves <span className="s-strong font-medium">straight to you.</span>
      </p>
    </section>
  );
}

function SectionLabel({ children }: { children: string }) {
  return (
    <p className="section-eyebrow mb-5 flex items-center gap-3 font-mono text-2xs uppercase tracking-widest text-t3">
      <span className="section-eyebrow-line h-px bg-t3" />
      {children}
    </p>
  );
}

function HowItWorks() {
  return (
    <section className="mx-auto max-w-5xl px-5 pb-32 md:px-10">
      <SectionLabel>How it works</SectionLabel>
      <h2 className="section-title mb-16 font-display text-3xl text-t1">From private file to paid access.</h2>
      <div className="steps-grid grid overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--border)] md:grid-cols-3">
        {steps.map((step) => (
          <article key={step.number} className="step step-item bg-bg p-8 transition-colors duration-200 ease-expo hover:bg-raised md:p-12">
            <p className="step-n mb-8 font-mono text-2xs uppercase tracking-widest text-t3">{step.number}</p>
            <div className="step-ico mb-6 flex h-11 w-11 items-center justify-center rounded-lg bg-high">
              <step.icon className="h-[22px] w-[22px] text-accent" aria-hidden="true" />
            </div>
            <h3 className="mb-3 font-display text-xl font-medium text-t1">{step.title}</h3>
            <p className="font-body text-sm font-light text-t2">{step.body}</p>
          </article>
        ))}
      </div>
    </section>
  );
}

function FeatureGrid() {
  return (
    <section className="mx-auto max-w-5xl px-5 pb-32 md:px-10">
      <div className="feature-grid grid overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--border)] md:grid-cols-2">
        {features.map((feature) => (
          <article key={feature.title} className="feature relative bg-bg p-8 transition-colors duration-200 ease-expo hover:bg-raised md:p-10">
            <Badge variant="accent" className="feature-badge mb-8 md:absolute md:right-10 md:top-10">
              {feature.badge}
            </Badge>
            <p className="mb-4 font-mono text-2xs uppercase tracking-widest text-t3">{feature.tag}</p>
            <h3 className="mb-3 font-display text-2xl font-medium text-t1">{feature.title}</h3>
            <p className="font-body text-sm font-light text-t2">{feature.body}</p>
          </article>
        ))}
      </div>
    </section>
  );
}

function DatasetPreview({ listings, loading, error }: { listings: MarketplaceListing[]; loading: boolean; error: Error | null }) {
  return (
    <section className="mx-auto max-w-5xl px-5 pb-32 md:px-10">
      <div className="mb-12 flex items-end justify-between gap-6">
        <div>
          <SectionLabel>Dataset preview</SectionLabel>
          <h2 className="section-title font-display text-3xl text-t1">Indexed assets from Aptos events.</h2>
        </div>
        <Link to="/marketplace" className="shrink-0 font-body text-sm text-accent transition-colors duration-150 ease-expo hover:text-t1">
          View all <span aria-hidden="true">&rarr;</span>
        </Link>
      </div>

      {loading && <DatasetSkeletonGrid />}
      {!loading && error && (
        <div className="rounded-xl border border-[var(--border)] bg-raised p-6">
          <p className="font-display text-xl text-t1">Indexer preview is not ready yet.</p>
          <p className="mt-2 font-body text-sm font-light text-t2">
            Stash only shows real on-chain listings here, so this section stays quiet until events are available.
          </p>
        </div>
      )}
      {!loading && !error && listings.length === 0 && (
        <div className="rounded-xl border border-[var(--border)] bg-raised p-6">
          <p className="font-display text-xl text-t1">No indexed listings yet.</p>
          <p className="mt-2 font-body text-sm font-light text-t2">
            Publish the first Shelby-backed dataset and it will appear here after the Aptos event is indexed.
          </p>
        </div>
      )}
      {!loading && !error && listings.length > 0 && (
        <div className="cards-grid grid gap-4 md:grid-cols-3">
          {listings.map((listing) => (
            <DatasetCard key={listing.id} listing={listing} />
          ))}
        </div>
      )}
    </section>
  );
}

function DatasetSkeletonGrid() {
  return (
    <div className="grid gap-4 md:grid-cols-3">
      {Array.from({ length: 3 }, (_, index) => (
        <DatasetCardSkeleton key={index} />
      ))}
    </div>
  );
}

function CtaSection() {
  return (
    <section className="cta-section border-t border-[var(--border)] py-32 text-center">
      <div className="cta-inner relative mx-auto max-w-2xl px-5">
        <div className="absolute left-1/2 top-0 h-px w-40 -translate-x-1/2 bg-gradient-to-r from-transparent via-accent to-transparent" />
        <h2 className="section-title mb-5 pt-12 font-display text-4xl text-t1">List the dataset. Keep the terms.</h2>
        <p className="mx-auto mb-10 max-w-[44ch] font-body text-lg font-light text-t2">Put the file on Shelby, register access on Aptos, and let buyers unlock it from the marketplace.</p>
        <div className="cta-actions flex flex-col justify-center gap-3 sm:flex-row">
          <Link to="/upload">
            <Button size="lg" className="w-full sm:w-auto">
              Get started
            </Button>
          </Link>
          <a href="https://docs.shelby.xyz" target="_blank" rel="noreferrer">
            <Button variant="ghost" size="lg" className="w-full sm:w-auto">
              Read the docs <span aria-hidden="true">&rarr;</span>
            </Button>
          </a>
        </div>
      </div>
    </section>
  );
}

function Footer() {
  const footerLinks = buildFooterLinks();
  const currentYear = new Date().getFullYear();

  return (
    <footer className="footer-premium border-t border-[var(--border)] px-5 py-12 md:px-10">
      <div className="mx-auto flex max-w-6xl flex-col gap-10 md:flex-row md:items-end md:justify-between">
        <div className="max-w-md">
          <div className="mb-5 flex items-center gap-3">
            <span className="footer-mark grid h-9 w-9 grid-cols-2 gap-1 rounded-lg p-1" aria-hidden="true">
              <span className="rounded-[3px] bg-accent" />
              <span className="rounded-[3px] bg-accent opacity-75" />
              <span className="rounded-[3px] bg-accent opacity-75" />
              <span className="rounded-[3px] bg-accent" />
            </span>
            <div>
              <p className="font-display text-base font-medium text-t1">Stash</p>
              <p className="font-mono text-2xs uppercase tracking-widest text-t4">Dataset market protocol</p>
            </div>
          </div>
          <p className="font-body text-sm font-light leading-relaxed text-t2">
            Shelby stores the files. Aptos records the terms. Creators keep direct control of access and revenue.
          </p>
          <div className="mt-6 flex flex-wrap gap-2">
            {["Shelby hot storage", "Move access", "Indexer events"].map((item) => (
              <span key={item} className="footer-chip font-mono text-2xs uppercase tracking-widest text-t3">
                {item}
              </span>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-5 md:items-end">
          <nav className="foot-links flex flex-wrap gap-5" aria-label="Footer links">
            {footerLinks.map((link) => (
              <a
                key={link.label}
                href={link.href}
                target="_blank"
                rel="noreferrer"
                className="font-body text-sm text-t3 transition-colors duration-150 ease-expo hover:text-t1"
              >
                {link.label}
              </a>
            ))}
          </nav>
          <p className="font-mono text-xs text-t4">&copy; {currentYear} Stash Protocol. Built for Aptos builders.</p>
        </div>
      </div>
    </footer>
  );
}

function buildFooterLinks(): Array<{ label: string; href: string }> {
  return [
    { label: "Docs", href: "https://docs.shelby.xyz" },
    { label: "GitHub", href: import.meta.env.VITE_STASH_GITHUB_URL },
    { label: "Twitter", href: import.meta.env.VITE_STASH_TWITTER_URL },
    { label: "Discord", href: import.meta.env.VITE_STASH_DISCORD_URL },
  ].filter((link): link is { label: string; href: string } => Boolean(link.href?.trim()));
}

function buildLandingStats(stats: MarketplaceStats | undefined): LandingStat[] {
  const volumeApt = (stats?.totalVolumeOctas ?? 0) / 100_000_000;

  return [
    {
      target: stats?.totalDatasets ?? 0,
      label: "Datasets",
      caption: "Indexed listings",
    },
    {
      target: stats?.totalCreators ?? 0,
      label: "Creators",
      caption: "Publishing wallets",
    },
    {
      target: volumeApt,
      unit: "APT",
      decimals: volumeApt === 0 ? 0 : volumeApt >= 1 ? 2 : 4,
      label: "Volume",
      caption: "Settled on-chain",
    },
    {
      target: stats?.totalPurchases ?? 0,
      label: "Purchases",
      caption: "Access unlocks",
    },
  ];
}
