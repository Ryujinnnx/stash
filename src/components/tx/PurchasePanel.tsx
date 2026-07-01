import type { ReactNode } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { AlertTriangle, CheckCircle2, Download, FileCheck2, LockKeyhole, ShieldCheck, Zap } from "lucide-react";
import { clsx } from "clsx";
import { Badge } from "../ui/Badge";
import { Button, type ButtonState } from "../ui/Button";
import { Price } from "../ui/Price";
import { configuredNetworkName } from "../../lib/network";

export type WalletState = "disconnected" | "wrong-network" | "connected";
export type PurchaseState = "idle" | "loading" | "success" | "error";

export interface Dataset {
  id: string;
  title: string;
  priceOctas: number;
  storageId?: string;
  creator?: string;
  category?: string;
}

export interface PurchasePanelProps {
  dataset: Dataset;
  walletState: WalletState;
  purchaseState: PurchaseState;
  isPurchased: boolean;
  onConnect: () => void;
  onPurchase: () => void;
  onDownload: () => void;
  onSwitchNetwork?: () => void;
  connectSlot?: ReactNode;
  className?: string;
}

const trustSignals = [
  { icon: ShieldCheck, label: "Secured by Move contract" },
  { icon: Zap, label: "Delivered by Shelby" },
  { icon: FileCheck2, label: "Payment recorded on-chain" },
];

function octasToApt(octas: number): number {
  return octas / 100_000_000;
}

function formatApt(octas: number): string {
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 8,
  }).format(octasToApt(octas));
}

function accessBadge(isPurchased: boolean, isPaid: boolean) {
  if (isPurchased) {
    return <Badge variant="success">Access granted</Badge>;
  }
  if (isPaid) {
    return <Badge variant="accent">Paid access</Badge>;
  }
  return <Badge variant="default">Open access</Badge>;
}

function WalletMessage({ walletState }: { walletState: WalletState }) {
  const targetNetwork = configuredNetworkName();

  return (
    <AnimatePresence mode="wait">
      {walletState === "wrong-network" && (
        <motion.div
          key="wrong-network"
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
          className="flex items-center gap-2 rounded-lg border border-[rgba(245,158,11,0.22)] bg-[var(--warning-soft)] px-3 py-2 text-warning"
        >
          <AlertTriangle className="h-4 w-4" aria-hidden="true" />
          <p className="font-body text-sm font-medium">Switch to Aptos {targetNetwork}</p>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function PurchaseButtonContent({ dataset, walletState, purchaseState, isPurchased }: {
  dataset: Dataset;
  walletState: WalletState;
  purchaseState: PurchaseState;
  isPurchased: boolean;
}) {
  if (walletState === "disconnected") {
    return <>Connect wallet</>;
  }
  if (walletState === "wrong-network") {
    return <>Switch network</>;
  }
  if (isPurchased) {
    return (
      <>
        <Download className="h-4 w-4" aria-hidden="true" />
        Download all files
      </>
    );
  }
  if (purchaseState === "loading") {
    return <>Confirm in wallet...</>;
  }
  if (purchaseState === "error") {
    return <>Transaction failed · Try again</>;
  }
  return <>Unlock for {formatApt(dataset.priceOctas)} APT</>;
}

export function PurchasePanel({
  dataset,
  walletState,
  purchaseState,
  isPurchased,
  onConnect,
  onPurchase,
  onDownload,
  onSwitchNetwork,
  connectSlot,
  className = "",
}: PurchasePanelProps) {
  const reduceMotion = useReducedMotion();
  const isPaid = dataset.priceOctas > 0;
  const shouldShake = purchaseState === "error" && walletState === "connected" && !isPurchased && !reduceMotion;
  const ctaState: ButtonState =
    walletState === "connected" && purchaseState === "loading" && !isPurchased
      ? "loading"
      : walletState === "connected" && purchaseState === "success" && !isPurchased
        ? "success"
        : "idle";

  function handleCta() {
    if (walletState === "disconnected") {
      onConnect();
      return;
    }
    if (walletState === "wrong-network") {
      (onSwitchNetwork ?? onConnect)();
      return;
    }
    if (isPurchased) {
      onDownload();
      return;
    }
    onPurchase();
  }

  return (
    <aside className={clsx("sticky top-20 flex flex-col gap-5 rounded-2xl border border-[var(--border)] bg-raised p-7", className)}>
      <div className="flex items-center justify-between gap-3">
        {accessBadge(isPurchased, isPaid)}
        {isPurchased && (
          <span className="inline-flex items-center gap-2 font-mono text-xs text-success">
            <span className="h-2 w-2 rounded-full bg-success" />
            Access granted
          </span>
        )}
      </div>

      {isPaid && <Price amount={octasToApt(dataset.priceOctas)} size="lg" />}

      <WalletMessage walletState={walletState} />

      {walletState === "disconnected" && connectSlot ? (
        <div>{connectSlot}</div>
      ) : (
        <motion.div
          animate={shouldShake ? { x: [0, -7, 7, -5, 5, 0] } : { x: 0 }}
          transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
        >
          <Button
            className={clsx(
              "w-full",
              purchaseState === "loading" && "disabled:opacity-100",
              walletState === "wrong-network" &&
                "border-[rgba(245,158,11,0.24)] bg-[var(--warning-soft)] text-warning hover:bg-[var(--warning-soft)] hover:shadow-none",
            )}
            variant={purchaseState === "error" && walletState === "connected" && !isPurchased ? "danger" : "primary"}
            size="lg"
            state={ctaState}
            disabled={purchaseState === "loading"}
            onClick={handleCta}
          >
            <PurchaseButtonContent dataset={dataset} walletState={walletState} purchaseState={purchaseState} isPurchased={isPurchased} />
          </Button>
        </motion.div>
      )}

      {walletState === "disconnected" && (
        <p className="text-center font-mono text-xs text-t3">Supports Petra, Martian, Pontem</p>
      )}

      <div className="grid gap-2 border-y border-[var(--border)] py-4">
        {trustSignals.map((item) => (
          <div key={item.label} className="flex items-center gap-2">
            <item.icon className="h-3 w-3 text-t3" aria-hidden="true" />
            <span className="font-mono text-2xs text-t3">{item.label}</span>
          </div>
        ))}
      </div>

      <details className="rounded-lg bg-bg px-4 py-3">
        <summary className="cursor-pointer font-mono text-xs text-t3 transition-colors duration-150 ease-expo hover:text-t2">
          On-chain details
        </summary>
        <div className="mt-3 grid gap-2 font-mono text-2xs text-t2">
          <p className="break-all">
            <span className="uppercase text-t3">Listing: </span>
            {dataset.id}
          </p>
          {dataset.storageId && (
            <p className="break-all">
              <span className="uppercase text-t3">Blob: </span>
              {dataset.storageId}
            </p>
          )}
          {dataset.creator && (
            <p className="break-all">
              <span className="uppercase text-t3">Creator: </span>
              {dataset.creator}
            </p>
          )}
          {dataset.category && (
            <p>
              <span className="uppercase text-t3">Category: </span>
              {dataset.category}
            </p>
          )}
        </div>
      </details>
    </aside>
  );
}
