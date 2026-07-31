import { forwardRef, useLayoutEffect, useMemo, useRef } from "react";
import type { RefObject } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useWallet } from "@aptos-labs/wallet-adapter-react";
import { Aptos, AptosConfig } from "@aptos-labs/ts-sdk";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { Archive, Binary, Database, FileArchive, FileJson, FileText, Image, Lock, Music, Video } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useDatasetListing, useMarketplaceActions } from "../hooks/useMarketplace";
import { useDownload, useMetadata } from "../hooks/useShelby";
import { formatBytes, formatDate } from "../lib/format";
import { isMarketplaceConfigured, marketplaceFunction, type MarketplaceListing } from "../lib/marketplace";
import { aptosClientConfig, walletNetworkMatchesConfigured } from "../lib/network";
import { createAccessProof, importBuyerPrivateKey } from "../lib/shelby";
import type { DatasetMetadata } from "../lib/shelby";
import { resolveAccountAddress } from "../lib/wallet";
import { Badge } from "../components/ui/Badge";
import { EmptyState } from "../components/ui/EmptyState";
import { ErrorState } from "../components/ui/ErrorState";
import { Skeleton } from "../components/ui/Skeleton";
import { WalletAddress } from "../components/ui/WalletAddress";
import { useToast } from "../components/ui/useToast";
import { PurchasePanel, type PurchaseState, type WalletState } from "../components/tx/PurchasePanel";
import { WalletButton } from "../components/layout/Nav";

gsap.registerPlugin(ScrollTrigger);

interface DatasetFile {
  id: string;
  name: string;
  sizeBytes: number;
  type: string;
  icon: LucideIcon;
}

type PreviewKind = "image" | "video" | "audio" | "json" | "locked";

const fileRowSelector = "[data-file-row]";

export function DatasetDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const wallet = useWallet();
  const toast = useToast();
  const actions = useMarketplaceActions();
  const listing = useDatasetListing(id);
  const metadata = useMetadata(listing.data?.storageId ?? null);
  const accountAddress = resolveAccountAddress(wallet.account);
  const access = useAccessStatus(accountAddress, id, actions.purchase.isSuccess);
  const download = useDownload(listing.data?.storageId ?? null);

  const coverRef = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const creatorRef = useRef<HTMLDivElement>(null);
  const descriptionRef = useRef<HTMLParagraphElement>(null);
  const purchasePanelRef = useRef<HTMLDivElement>(null);
  const fileListRef = useRef<HTMLDivElement>(null);

  const dataset = useMemo(() => {
    if (!listing.data) {
      return null;
    }
    return composeDatasetView(listing.data, metadata.data);
  }, [listing.data, metadata.data]);

  const purchaseState: PurchaseState = actions.purchase.isPending
    ? "loading"
    : actions.purchase.isSuccess
      ? "success"
      : actions.purchase.isError
        ? "error"
        : "idle";
  const walletState = resolveWalletState(wallet.connected, wallet.network, accountAddress);
  const isPurchased = Boolean(access.data || actions.purchase.isSuccess);

  useDetailAnimations({
    coverRef,
    titleRef,
    creatorRef,
    descriptionRef,
    purchasePanelRef,
    fileListRef,
    enabled: Boolean(dataset),
  });

  async function purchase() {
    if (!id) {
      return;
    }
    try {
      await actions.purchase.mutateAsync(id);
      await access.refetch();
      toast.success("Access granted", "Payment is recorded on-chain. Your dataset access is now active.");
    } catch (error) {
      toast.error("Purchase failed", getErrorMessage(error, "Check your wallet balance and try the transaction again."));
    }
  }

  async function downloadDataset() {
    if (!dataset) {
      return;
    }

    if (!isPurchased) {
      toast.error("Access is still locked", "Complete the on-chain purchase before downloading this dataset.");
      return;
    }

    const privateKey = readLocalAccessKey(dataset.storageId);
    if (!privateKey) {
      toast.error(
        "Delivery key unavailable",
        "Access is confirmed on-chain, but this browser does not have the decryption key for this Shelby object yet.",
      );
      return;
    }

    try {
      const buyerPrivateKey = await importBuyerPrivateKey(privateKey);
      const accessProof = createAccessProof({
        storage_id: dataset.storageId,
        encrypted_key: "",
        expires_at: Date.now() + 5 * 60 * 1000,
        ...(accountAddress ? { issuer: accountAddress } : {}),
      });
      const blob = await download.download(accessProof, buyerPrivateKey);
      saveBlob(blob, dataset.files[0]?.name ?? fileNameForDataset(dataset.title, dataset.format));
      toast.success("Download ready", "The Shelby file was decrypted in your browser.");
    } catch (error) {
      toast.error("Download failed", getErrorMessage(error, "Verify access, network, and Shelby delivery configuration, then try again."));
    }
  }
  if (listing.isLoading) {
    return <DatasetDetailSkeleton />;
  }

  if (listing.isError) {
    return (
      <section className="mx-auto max-w-6xl px-5 py-12 md:px-10">
        <ErrorState
          title="Dataset could not load"
          error={listing.error}
          onRetry={() => {
            void listing.refetch();
          }}
        />
      </section>
    );
  }

  if (!dataset) {
    return (
      <section className="mx-auto max-w-6xl px-5 py-12 md:px-10">
        <EmptyState
          icon={Database}
          title="Dataset not found"
          description="This dataset may have been removed or doesn't exist."
          action={{ label: "Back to marketplace", onClick: () => navigate("/marketplace") }}
        />
      </section>
    );
  }

  return (
    <section className="mx-auto grid max-w-6xl grid-cols-1 items-start gap-10 px-5 py-12 md:px-10 min-[769px]:grid-cols-[minmax(0,1fr)_360px]">
      <div className="min-w-0">
        <DatasetCover ref={coverRef} dataset={dataset} />

        <header className="mb-10">
          <h1 ref={titleRef} className="mb-4 font-display text-3xl leading-tight text-t1">
            {dataset.title}
          </h1>
          <div ref={creatorRef} className="flex flex-wrap items-center gap-3">
            <WalletAddress address={dataset.creator} showExplorer />
            <span className="h-1 w-1 rounded-full bg-t4" aria-hidden="true" />
            <time className="font-mono text-xs text-t3" dateTime={new Date(dataset.createdAt).toISOString()}>
              {formatDate(dataset.createdAt)}
            </time>
          </div>
        </header>

        <p ref={descriptionRef} className="mb-10 max-w-[60ch] font-body text-base font-light leading-relaxed text-t2">
          {dataset.description}
        </p>

        <div className="mb-10 flex flex-wrap gap-2">
          {dataset.tags.map((tag) => (
            <Badge key={tag}>{tag}</Badge>
          ))}
        </div>

        <FileList ref={fileListRef} files={dataset.files} />
        <PreviewSection dataset={dataset} />
      </div>

      <div ref={purchasePanelRef}>
        <PurchasePanel
          dataset={{
            id: dataset.id,
            title: dataset.title,
            priceOctas: dataset.priceOctas,
            storageId: dataset.storageId,
            creator: dataset.creator,
            category: dataset.category,
          }}
          walletState={walletState}
          purchaseState={purchaseState}
          isPurchased={isPurchased}
          onConnect={() => undefined}
          onPurchase={() => void purchase()}
          onDownload={downloadDataset}
          connectSlot={<WalletButton fullWidth />}
        />
      </div>
    </section>
  );
}

const DatasetCover = forwardRef<HTMLDivElement, { dataset: DatasetView }>(function DatasetCover({ dataset }, ref) {
  const coverKind = dataset.preview.kind === "image" ? "image" : "placeholder";

  return (
    <div
      ref={ref}
      className="mb-8 aspect-video w-full overflow-hidden rounded-2xl border border-[var(--border)] bg-raised shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]"
    >
      {coverKind === "image" && dataset.preview.url ? (
        <img src={dataset.preview.url} alt="" className="h-full w-full object-cover" />
      ) : (
        <div className="relative flex h-full flex-col justify-between overflow-hidden bg-[radial-gradient(circle_at_18%_12%,rgba(99,102,241,0.14),transparent_28%),linear-gradient(155deg,rgba(13,13,26,1),rgba(8,8,16,1))] p-6">
          <div
            className="absolute inset-0 opacity-70 [background-image:linear-gradient(rgba(255,255,255,0.018)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.018)_1px,transparent_1px)] [background-size:40px_40px]"
            aria-hidden="true"
          />
          <div className="relative flex items-center justify-between gap-3">
            <Badge variant="accent">{dataset.category}</Badge>
            <span className="font-mono text-2xs uppercase tracking-widest text-t3">Shelby artifact</span>
          </div>
          <div className="relative grid gap-5">
            <div className="flex items-end justify-between gap-6">
              <div className="min-w-0">
                <p className="mb-3 font-mono text-2xs uppercase tracking-widest text-t3">Encrypted storage object</p>
                <p className="truncate font-display text-2xl font-medium leading-tight text-t1">{dataset.title}</p>
              </div>
              <div className="hidden shrink-0 rounded-lg border border-[var(--border)] bg-bg/50 px-3 py-2 font-mono text-2xs uppercase tracking-widest text-t3 sm:block">
                {dataset.format}
              </div>
            </div>
            <div className="grid grid-cols-12 gap-2">
              {Array.from({ length: 36 }, (_, index) => (
                <span
                  key={index}
                  className={index % 5 === 0 ? "h-1 rounded-full bg-accent/70" : "h-1 rounded-full bg-high"}
                />
              ))}
            </div>
            <div className="h-px w-full bg-gradient-to-r from-transparent via-accent/70 to-transparent" />
          </div>
          <div className="relative flex items-center justify-between gap-4">
            <p className="min-w-0 truncate font-mono text-2xs uppercase tracking-widest text-t3">{dataset.storageId}</p>
            <p className="shrink-0 font-mono text-2xs uppercase tracking-widest text-t3">{formatBytes(dataset.sizeBytes)}</p>
          </div>
        </div>
      )}
    </div>
  );
});

const FileList = forwardRef<HTMLDivElement, { files: DatasetFile[] }>(function FileList({ files }, ref) {
  const totalSize = files.reduce((total, file) => total + file.sizeBytes, 0);

  return (
    <div ref={ref} className="mb-10 overflow-hidden rounded-xl border border-[var(--border)]">
      <div className="flex items-center justify-between gap-4 border-b border-[var(--border)] bg-raised px-5 py-3.5">
        <p className="font-mono text-2xs uppercase tracking-widest text-t3">Files &middot; {files.length}</p>
        <p className="font-mono text-xs text-t3">{formatBytes(totalSize)}</p>
      </div>
      <div>
        {files.map((file) => (
          <div
            key={file.id}
            data-file-row
            className="flex items-center gap-3 border-b border-[var(--border)] px-5 py-3.5 transition-colors duration-150 ease-expo last:border-b-0 hover:bg-raised"
          >
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-high">
              <file.icon className="h-4 w-4 text-accent" aria-hidden="true" />
            </div>
            <p className="min-w-0 flex-1 truncate font-body text-sm text-t1">{file.name}</p>
            <p className="shrink-0 font-mono text-xs text-t3">{formatBytes(file.sizeBytes)}</p>
            <Badge variant="accent">{file.type.toUpperCase()}</Badge>
          </div>
        ))}
      </div>
    </div>
  );
});

function PreviewSection({ dataset }: { dataset: DatasetView }) {
  return (
    <section>
      <h2 className="mb-4 font-mono text-2xs uppercase tracking-widest text-t3">Preview</h2>
      <div className="overflow-hidden rounded-xl border border-[var(--border)]">
        <PreviewRenderer preview={dataset.preview} />
      </div>
    </section>
  );
}

function PreviewRenderer({ preview }: { preview: DatasetPreview }) {
  const jsonPreview = useJsonPreview(preview.kind === "json" ? preview.url : null);

  if (preview.kind === "image" && preview.url) {
    return <img src={preview.url} alt="" className="max-h-96 w-full object-contain" />;
  }

  if (preview.kind === "video" && preview.url) {
    return <video src={preview.url} className="w-full rounded-xl" controls />;
  }

  if (preview.kind === "audio" && preview.url) {
    return (
      <div className="bg-raised p-6">
        <audio src={preview.url} className="w-full" controls />
      </div>
    );
  }

  if (preview.kind === "json") {
    return (
      <pre className="max-h-96 overflow-x-auto bg-raised p-6 font-mono text-xs leading-relaxed text-t2">
        {jsonPreview.isLoading ? "Loading preview..." : jsonPreview.data ?? "Preview file is not available yet."}
      </pre>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center gap-3 bg-raised p-12 text-center">
      <Lock className="h-6 w-6 text-t4" aria-hidden="true" />
      <p className="font-body text-sm text-t3">Preview locked for gated content</p>
    </div>
  );
}

function DatasetDetailSkeleton() {
  return (
    <section className="mx-auto grid max-w-6xl grid-cols-1 items-start gap-10 px-5 py-12 md:px-10 min-[769px]:grid-cols-[minmax(0,1fr)_360px]">
      <div>
        <Skeleton variant="image" className="mb-8 rounded-2xl" />
        <Skeleton variant="title" className="mb-4 h-10 w-3/4" />
        <Skeleton className="mb-10 h-8 w-72" />
        <Skeleton className="mb-3 h-5 w-full max-w-[60ch]" />
        <Skeleton className="mb-10 h-5 w-4/5 max-w-[60ch]" />
        <div className="mb-10 flex gap-2">
          <Skeleton className="h-5 w-16 rounded-sm" />
          <Skeleton className="h-5 w-20 rounded-sm" />
          <Skeleton className="h-5 w-14 rounded-sm" />
        </div>
        <div className="mb-10 overflow-hidden rounded-xl border border-[var(--border)]">
          <div className="flex items-center justify-between border-b border-[var(--border)] bg-raised px-5 py-3.5">
            <Skeleton className="h-4 w-24 rounded-sm" />
            <Skeleton className="h-4 w-16 rounded-sm" />
          </div>
          {Array.from({ length: 3 }, (_, index) => (
            <div key={index} className="flex items-center gap-3 border-b border-[var(--border)] px-5 py-3.5 last:border-b-0">
              <Skeleton className="h-8 w-8 rounded-md" />
              <Skeleton className="h-5 flex-1 rounded-sm" />
              <Skeleton className="h-5 w-16 rounded-sm" />
            </div>
          ))}
        </div>
        <Skeleton variant="card" className="rounded-xl" />
      </div>
      <div className="sticky top-20 rounded-2xl border border-[var(--border)] bg-raised p-7">
        <Skeleton className="mb-5 h-5 w-28 rounded-sm" />
        <Skeleton className="mb-5 h-12 w-32 rounded-sm" />
        <Skeleton className="mb-5 h-12 w-full rounded-full" />
        <Skeleton className="h-28 w-full rounded-lg" />
      </div>
    </section>
  );
}

interface DatasetPreview {
  kind: PreviewKind;
  url: string | null;
}

interface DatasetView {
  id: string;
  storageId: string;
  title: string;
  description: string;
  category: string;
  tags: string[];
  priceOctas: number;
  sizeBytes: number;
  format: string;
  creator: string;
  createdAt: number;
  preview: DatasetPreview;
  files: DatasetFile[];
}

function composeDatasetView(listing: MarketplaceListing, metadata: DatasetMetadata | undefined): DatasetView {
  const title = metadata?.title || listing.title;
  const description =
    metadata?.description ||
    listing.description ||
    "Creator metadata is indexed on Aptos. Purchase access to retrieve the encrypted Shelby artifact.";
  const format = normalizeFormat(metadata?.format || listing.format);
  const sizeBytes = metadata?.size ?? listing.sizeBytes;
  const previewUrl = metadata?.preview_url ?? listing.previewUrl ?? null;
  const tags = metadata?.tags.length ? metadata.tags : listing.tags;

  return {
    id: listing.id,
    storageId: listing.storageId,
    title,
    description,
    category: metadata?.category || listing.category,
    tags: tags.length > 0 ? tags : ["verified", "shelby", "aptos"],
    priceOctas: listing.priceOctas,
    sizeBytes,
    format,
    creator: listing.creator,
    createdAt: normalizeTimestamp(metadata?.created_at ?? listing.createdAt),
    preview: {
      kind: resolvePreviewKind(format, previewUrl),
      url: previewUrl,
    },
    files: [
      {
        id: `${listing.id}-primary`,
        name: fileNameForDataset(title, format),
        sizeBytes,
        type: format,
        icon: iconForFormat(format),
      },
    ],
  };
}

function useDetailAnimations({
  coverRef,
  titleRef,
  creatorRef,
  descriptionRef,
  purchasePanelRef,
  fileListRef,
  enabled,
}: {
  coverRef: RefObject<HTMLElement | null>;
  titleRef: RefObject<HTMLElement | null>;
  creatorRef: RefObject<HTMLElement | null>;
  descriptionRef: RefObject<HTMLElement | null>;
  purchasePanelRef: RefObject<HTMLElement | null>;
  fileListRef: RefObject<HTMLElement | null>;
  enabled: boolean;
}) {
  useLayoutEffect(() => {
    if (!enabled || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      return undefined;
    }

    const context = gsap.context(() => {
      const timeline = gsap.timeline({ defaults: { ease: "power3.out" } });
      if (coverRef.current) {
        timeline.fromTo(coverRef.current, { opacity: 0, y: 16 }, { opacity: 1, y: 0, duration: 0.6 });
      }
      if (titleRef.current) {
        timeline.fromTo(titleRef.current, { opacity: 0, y: 12 }, { opacity: 1, y: 0, duration: 0.5 }, "-=0.3");
      }
      if (creatorRef.current) {
        timeline.fromTo(creatorRef.current, { opacity: 0, y: 8 }, { opacity: 1, y: 0, duration: 0.4 }, "-=0.3");
      }
      if (descriptionRef.current) {
        timeline.fromTo(descriptionRef.current, { opacity: 0, y: 8 }, { opacity: 1, y: 0, duration: 0.4 }, "-=0.2");
      }
      if (purchasePanelRef.current) {
        timeline.fromTo(purchasePanelRef.current, { opacity: 0, x: 12 }, { opacity: 1, x: 0, duration: 0.5 }, "-=0.5");
      }

      const fileRows = fileListRef.current?.querySelectorAll(fileRowSelector);
      if (fileRows && fileRows.length > 0 && fileListRef.current) {
        gsap.fromTo(
          fileRows,
          { opacity: 0, y: 10 },
          {
            opacity: 1,
            y: 0,
            duration: 0.34,
            stagger: 0.04,
            ease: "power3.out",
            scrollTrigger: {
              trigger: fileListRef.current,
              start: "top 82%",
            },
          },
        );
      }
    });

    return () => {
      context.revert();
    };
  }, [coverRef, creatorRef, descriptionRef, enabled, fileListRef, purchasePanelRef, titleRef]);
}

function useAccessStatus(accountAddress: string | null, listingId: string | undefined, purchaseSucceeded: boolean) {
  const aptos = useMemo(() => new Aptos(new AptosConfig(aptosClientConfig())), []);

  return useQuery<boolean>({
    queryKey: ["access-status", accountAddress, listingId, purchaseSucceeded],
    enabled: Boolean(accountAddress && listingId && isMarketplaceConfigured()),
    queryFn: async () => {
      const [hasAccess] = await aptos.viewJson<[boolean]>({
        payload: {
          function: marketplaceFunction("access", "verify_access"),
          functionArguments: [accountAddress ?? "", listingId ?? "0"],
        },
      });
      return hasAccess === true;
    },
    retry: false,
    staleTime: 15_000,
    throwOnError: false,
  });
}

function useJsonPreview(url: string | null) {
  return useQuery<string>({
    queryKey: ["dataset-json-preview", url],
    enabled: Boolean(url),
    queryFn: async () => {
      const response = await fetch(url ?? "");
      if (!response.ok) {
        throw new Error(`Preview returned HTTP ${response.status}`);
      }
      const text = await response.text();
      return formatJsonPreview(text);
    },
    retry: false,
  });
}

function resolveWalletState(connected: boolean, network: unknown, accountAddress: string | null): WalletState {
  if (!connected || !accountAddress) {
    return "disconnected";
  }

  if (!walletNetworkMatchesConfigured(network)) {
    return "wrong-network";
  }

  return "connected";
}
function resolvePreviewKind(format: string, url: string | null): PreviewKind {
  if (!url) {
    return "locked";
  }
  if (isImageFormat(format, url)) {
    return "image";
  }
  if (isVideoFormat(format, url)) {
    return "video";
  }
  if (isAudioFormat(format, url)) {
    return "audio";
  }
  if (isJsonFormat(format, url)) {
    return "json";
  }
  return "locked";
}

function iconForFormat(format: string): LucideIcon {
  if (isJsonFormat(format, "")) {
    return FileJson;
  }
  if (format === "zip") {
    return FileArchive;
  }
  if (isImageFormat(format, "")) {
    return Image;
  }
  if (isVideoFormat(format, "")) {
    return Video;
  }
  if (isAudioFormat(format, "")) {
    return Music;
  }
  if (["csv", "txt", "md", "parquet"].includes(format)) {
    return FileText;
  }
  if (["onnx", "safetensors"].includes(format)) {
    return Archive;
  }
  return Binary;
}

function isImageFormat(format: string, url: string): boolean {
  return ["png", "jpg", "jpeg", "webp", "gif", "image/png", "image/jpeg", "image/webp", "image/gif"].includes(format) || /\.(png|jpe?g|webp|gif)$/i.test(url);
}

function isVideoFormat(format: string, url: string): boolean {
  return ["mp4", "webm", "video/mp4", "video/webm"].includes(format) || /\.(mp4|webm)$/i.test(url);
}

function isAudioFormat(format: string, url: string): boolean {
  return ["mp3", "wav", "ogg", "audio/mpeg", "audio/wav", "audio/ogg"].includes(format) || /\.(mp3|wav|ogg)$/i.test(url);
}

function isJsonFormat(format: string, url: string): boolean {
  return ["json", "jsonl", "application/json", "application/x-ndjson"].includes(format) || /\.(json|jsonl)$/i.test(url);
}

function normalizeFormat(format: string): string {
  const normalized = format.trim().toLowerCase();
  if (!normalized) {
    return "other";
  }
  if (normalized.includes("/")) {
    return normalized.split("/").at(-1)?.replace("x-", "") || "other";
  }
  return normalized;
}

function normalizeTimestamp(timestamp: number): number {
  return timestamp < 10_000_000_000 ? timestamp * 1000 : timestamp;
}

function readLocalAccessKey(storageId: string): string | null {
  try {
    return sessionStorage.getItem(`stash:access-key:${storageId}`);
  } catch {
    return null;
  }
}

function saveBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  anchor.rel = "noopener";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function fileNameForDataset(title: string, format: string): string {
  const safeTitle = title
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
  return `${safeTitle || "stash-dataset"}.${format === "other" ? "bin" : format}`;
}

function formatJsonPreview(text: string): string {
  try {
    const parsed = JSON.parse(text) as unknown;
    return JSON.stringify(parsed, null, 2);
  } catch {
    return text;
  }
}

function getErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }
  if (isRecord(error) && typeof error.message === "string") {
    return error.message;
  }
  return fallback;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
