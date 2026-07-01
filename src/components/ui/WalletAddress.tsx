import { useEffect, useMemo, useState } from "react";
import { Check, Copy, ExternalLink } from "lucide-react";
import { clsx } from "clsx";
import { explorerNetworkName } from "../../lib/network";

export interface WalletAddressProps {
  address: string;
  showExplorer?: boolean;
  explorerHref?: string;
  className?: string;
}

function truncateAddress(address: string): string {
  if (address.length <= 13) {
    return address;
  }
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

async function copyText(text: string): Promise<void> {
  if (navigator.clipboard) {
    await navigator.clipboard.writeText(text);
  }
}

export function WalletAddress({ address, showExplorer = false, explorerHref, className = "" }: WalletAddressProps) {
  const [copied, setCopied] = useState(false);
  const displayAddress = useMemo(() => truncateAddress(address), [address]);
  const explorerUrl = explorerHref ?? `https://explorer.aptoslabs.com/account/${address}?network=${explorerNetworkName()}`;

  useEffect(() => {
    if (!copied) {
      return undefined;
    }
    const timeout = window.setTimeout(() => setCopied(false), 1500);
    return () => window.clearTimeout(timeout);
  }, [copied]);

  return (
    <span className={clsx("inline-flex items-center gap-2", className)}>
      <span className="group relative inline-flex">
        <button
          type="button"
          onClick={() => {
            void copyText(address).then(() => setCopied(true));
          }}
          className="inline-flex h-8 items-center gap-2 rounded-full px-2 font-mono text-sm text-t2 transition-colors duration-150 ease-expo hover:bg-raised hover:text-t1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
        >
          <span>{displayAddress}</span>
          {copied ? <Check className="h-3.5 w-3.5 text-success" aria-hidden="true" /> : <Copy className="h-3.5 w-3.5 text-t3" aria-hidden="true" />}
        </button>
        <span
          role="tooltip"
          className="pointer-events-none absolute bottom-full left-1/2 z-20 mb-2 -translate-x-1/2 whitespace-nowrap rounded-lg border border-[var(--border)] bg-overlay px-3 py-2 font-mono text-xs text-t2 opacity-0 shadow-md transition-opacity duration-150 ease-expo group-hover:opacity-100 group-focus-within:opacity-100"
        >
          {address}
        </span>
      </span>
      {showExplorer && (
        <a
          href={explorerUrl}
          target="_blank"
          rel="noreferrer"
          aria-label="Open wallet in Aptos Explorer"
          className="inline-flex h-8 w-8 items-center justify-center rounded-full text-t3 transition-colors duration-150 ease-expo hover:bg-raised hover:text-t1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
        >
          <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
        </a>
      )}
    </span>
  );
}
