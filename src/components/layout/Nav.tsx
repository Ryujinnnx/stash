import { useEffect, useRef, useState } from "react";
import { useWallet } from "@aptos-labs/wallet-adapter-react";
import { AnimatePresence, motion } from "framer-motion";
import { Check, ChevronDown, Copy, ExternalLink, LogOut, Menu, ShieldCheck, Wallet } from "lucide-react";
import { Link, NavLink } from "react-router-dom";
import { clsx } from "clsx";
import { explorerNetworkName } from "../../lib/network";
import { resolveAccountAddress } from "../../lib/wallet";
import { Button, type ButtonSize, type ButtonVariant } from "../ui/Button";
import { WalletAddress } from "../ui/WalletAddress";
import { MobileDrawer, type MobileNavLink } from "./MobileDrawer";

const navLinks: MobileNavLink[] = [
  { to: "/marketplace", label: "Marketplace" },
  { to: "/upload", label: "Upload" },
  { to: "/dashboard", label: "Dashboard" },
];

export function Nav() {
  const [scrolled, setScrolled] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);

  useEffect(() => {
    function updateScrollState() {
      setScrolled(window.scrollY > 20);
    }

    updateScrollState();
    window.addEventListener("scroll", updateScrollState, { passive: true });
    return () => window.removeEventListener("scroll", updateScrollState);
  }, []);

  return (
    <>
      <header
        className={clsx(
          "stash-nav fixed top-0 z-50 h-14 w-full border-b transition-[background-color,border-color,box-shadow] duration-300 ease-expo",
          scrolled ? "is-scrolled border-[var(--border)] bg-bg/80 backdrop-blur-xl" : "border-transparent bg-transparent",
        )}
      >
        <div className="stash-nav-inner relative mx-auto flex h-full max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
          <Link to="/" className="nav-logo flex min-h-11 items-center gap-2.5 no-underline">
            <LogoMark />
            <span className="font-display text-base font-medium text-t1">Stash</span>
            <span className="hidden font-mono text-[9px] uppercase tracking-[0.16em] text-t4 sm:inline">Protocol</span>
          </Link>

          <nav className="nav-links absolute left-1/2 hidden -translate-x-1/2 items-center gap-7 md:flex" aria-label="Primary navigation">
            {navLinks.map((link) => (
              <NavLink
                key={link.to}
                to={link.to}
                className={({ isActive }) =>
                  clsx(
                    "font-body text-sm transition-colors duration-150 ease-expo hover:text-t1",
                    isActive ? "text-t1" : "text-t2",
                  )
                }
              >
                {link.label}
              </NavLink>
            ))}
          </nav>

          <div className="flex items-center gap-2">
            <WalletButton />
            <button
              type="button"
              aria-label="Open navigation"
              aria-expanded={drawerOpen}
              onClick={() => setDrawerOpen(true)}
              className="flex h-11 w-11 items-center justify-center rounded-full text-t2 transition-colors duration-150 ease-expo hover:bg-raised hover:text-t1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg md:hidden"
            >
              <Menu className="h-5 w-5" aria-hidden="true" />
            </button>
          </div>
        </div>
      </header>

      <MobileDrawer
        open={drawerOpen}
        links={navLinks}
        onClose={() => setDrawerOpen(false)}
        walletSlot={<WalletButton fullWidth panelPlacement="top" />}
      />
    </>
  );
}

interface WalletButtonProps {
  fullWidth?: boolean;
  panelPlacement?: "top" | "bottom";
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
}

export function WalletButton({
  fullWidth = false,
  panelPlacement = "bottom",
  variant = "secondary",
  size = "sm",
  className = "",
}: WalletButtonProps) {
  const wallet = useWallet();
  const [selectorOpen, setSelectorOpen] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [connectingWallet, setConnectingWallet] = useState<string | null>(null);
  const [connectError, setConnectError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const accountAddress = resolveAccountAddress(wallet.account);
  const walletOptions = buildWalletOptions(wallet);
  const currentWalletName = wallet.wallet?.name ?? "Aptos wallet";
  const networkName = resolveNetworkName(wallet.network);
  const explorerNetwork = explorerNetworkName(wallet.network);

  useEffect(() => {
    if (!dropdownOpen && !selectorOpen) {
      return undefined;
    }

    function handlePointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setDropdownOpen(false);
        setSelectorOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setDropdownOpen(false);
        setSelectorOpen(false);
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [dropdownOpen, selectorOpen]);

  useEffect(() => {
    if (wallet.connected) {
      setSelectorOpen(false);
      setConnectError(null);
      setConnectingWallet(null);
    }
  }, [wallet.connected]);

  useEffect(() => {
    if (!copied) {
      return undefined;
    }

    const timeout = window.setTimeout(() => setCopied(false), 1500);
    return () => window.clearTimeout(timeout);
  }, [copied]);

  if (!wallet.connected || !accountAddress) {
    return (
      <div ref={rootRef} className={clsx("relative", fullWidth && "w-full")}>
        <Button
          variant={variant}
          size={size}
          state={connectingWallet ? "loading" : connectError ? "error" : "idle"}
          className={clsx("wallet-connect-trigger", fullWidth && "w-full", className)}
          onClick={() => {
            setSelectorOpen((open) => !open);
            setConnectError(null);
          }}
        >
          Connect wallet
          <ChevronDown className="h-3.5 w-3.5" aria-hidden="true" />
        </Button>

        <WalletSelector
          open={selectorOpen}
          options={walletOptions}
          connectingWallet={connectingWallet}
          connectError={connectError}
          fullWidth={fullWidth}
          panelPlacement={panelPlacement}
          onConnect={(walletName) => {
            void connectWallet(wallet, walletName, setConnectingWallet, setConnectError);
          }}
        />
      </div>
    );
  }

  return (
    <div ref={rootRef} className={clsx("relative", fullWidth && "w-full")}>
      <div
        role="button"
        tabIndex={0}
        aria-haspopup="menu"
        aria-expanded={dropdownOpen}
        onClick={() => setDropdownOpen((open) => !open)}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            setDropdownOpen((open) => !open);
          }
        }}
        className={clsx(
          "wallet-pill flex min-h-11 cursor-pointer items-center gap-2 rounded-full border border-[var(--border)] bg-raised px-3 py-1.5 transition-colors duration-150 ease-expo hover:border-[var(--border-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg",
          fullWidth && "w-full justify-center",
        )}
      >
        <span className="h-1.5 w-1.5 rounded-full bg-success animate-pulse" aria-hidden="true" />
        <WalletAddress address={accountAddress} />
        <ChevronDown className="h-3.5 w-3.5 text-t3" aria-hidden="true" />
      </div>

      <AnimatePresence>
        {dropdownOpen && (
          <motion.div
            role="menu"
            initial={{ opacity: 0, y: 8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.98 }}
            transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
            className={clsx(
              "wallet-account-menu absolute overflow-hidden rounded-2xl border border-[var(--border)] bg-overlay shadow-lg",
              panelPlacement === "top" ? "bottom-[calc(100%+10px)]" : "top-[calc(100%+10px)]",
              fullWidth ? "left-0 right-0" : "right-0 w-72",
            )}
          >
            <div className="border-b border-[var(--border)] p-4">
              <div className="mb-3 flex items-center gap-3">
                <span className="flex h-9 w-9 items-center justify-center rounded-lg border border-[var(--border)] bg-high">
                  <Wallet className="h-4 w-4 text-accent" aria-hidden="true" />
                </span>
                <div className="min-w-0">
                  <p className="truncate font-body text-sm font-medium text-t1">{currentWalletName}</p>
                  <p className="font-mono text-2xs uppercase tracking-widest text-success">Connected</p>
                </div>
              </div>
              <div className="flex items-center justify-between gap-3 rounded-lg border border-[var(--border)] bg-bg/50 px-3 py-2">
                <span className="font-mono text-2xs uppercase tracking-widest text-t3">Network</span>
                <span className="truncate font-mono text-xs text-t2">{networkName}</span>
              </div>
            </div>
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                void copyText(accountAddress).then(() => setCopied(true));
              }}
              className="flex h-10 w-full items-center gap-2.5 px-4 font-body text-sm text-t2 transition-colors duration-150 ease-expo hover:bg-raised hover:text-t1"
            >
              {copied ? <Check className="h-4 w-4 text-success" aria-hidden="true" /> : <Copy className="h-4 w-4" aria-hidden="true" />}
              {copied ? "Copied" : "Copy address"}
            </button>
            <a
              role="menuitem"
              href={`https://explorer.aptoslabs.com/account/${accountAddress}?network=${explorerNetwork}`}
              target="_blank"
              rel="noreferrer"
              className="flex h-10 w-full items-center gap-2.5 px-4 font-body text-sm text-t2 transition-colors duration-150 ease-expo hover:bg-raised hover:text-t1"
            >
              <ExternalLink className="h-4 w-4" aria-hidden="true" />
              View on Aptos Explorer
            </a>
            <div className="border-t border-[var(--border)]" />
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setDropdownOpen(false);
                void wallet.disconnect();
              }}
              className="flex h-10 w-full items-center gap-2.5 px-4 font-body text-sm text-t2 transition-colors duration-150 ease-expo hover:bg-raised hover:text-error"
            >
              <LogOut className="h-4 w-4" aria-hidden="true" />
              Disconnect
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

interface WalletOption {
  name: string;
  icon?: string;
  url?: string;
  readyState: string;
  canConnect: boolean;
}

interface WalletSelectorProps {
  open: boolean;
  options: WalletOption[];
  connectingWallet: string | null;
  connectError: string | null;
  fullWidth: boolean;
  panelPlacement: "top" | "bottom";
  onConnect: (walletName: string) => void;
}

function WalletSelector({ open, options, connectingWallet, connectError, fullWidth, panelPlacement, onConnect }: WalletSelectorProps) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0, y: 8, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 8, scale: 0.98 }}
          transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
          className={clsx(
            "wallet-selector absolute rounded-2xl border border-[var(--border)] bg-overlay shadow-lg",
            panelPlacement === "top" ? "bottom-[calc(100%+10px)]" : "top-[calc(100%+10px)]",
            fullWidth ? "left-0 right-0" : "right-0 w-[min(360px,calc(100vw-32px))]",
          )}
        >
          <div className="wallet-selector-head border-b border-[var(--border)] p-5">
            <div className="mb-3 flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-[var(--border)] bg-high">
                <ShieldCheck className="h-5 w-5 text-accent" aria-hidden="true" />
              </span>
              <div>
                <p className="font-display text-base font-medium text-t1">Connect wallet</p>
                <p className="font-body text-sm font-light text-t2">Choose an Aptos wallet to sign Stash transactions.</p>
              </div>
            </div>
            {connectError && (
              <p className="rounded-lg border border-[color-mix(in_srgb,var(--error)_24%,transparent)] bg-[var(--error-soft)] px-3 py-2 font-body text-sm text-error">
                {connectError}
              </p>
            )}
          </div>

          <div className="max-h-[360px] overflow-y-auto p-2">
            {options.length === 0 ? (
              <div className="p-4">
                <p className="font-body text-sm text-t1">No Aptos wallet detected.</p>
                <p className="mt-1 font-body text-sm font-light text-t2">Install Petra, Pontem, Martian, or another Aptos wallet, then refresh this page.</p>
              </div>
            ) : (
              options.map((option) => (
                <WalletOptionRow
                  key={`${option.name}-${option.readyState}`}
                  option={option}
                  connecting={connectingWallet === option.name}
                  blocked={connectingWallet !== null && connectingWallet !== option.name}
                  onConnect={() => onConnect(option.name)}
                />
              ))
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function WalletOptionRow({
  option,
  connecting,
  blocked,
  onConnect,
}: {
  option: WalletOption;
  connecting: boolean;
  blocked: boolean;
  onConnect: () => void;
}) {
  const status = option.canConnect ? "Ready" : option.readyState === "Unsupported" ? "Unsupported" : "Install";

  return (
    <div className="wallet-option flex items-center gap-3 rounded-xl p-3">
      <WalletIcon option={option} />
      <div className="min-w-0 flex-1">
        <p className="truncate font-body text-sm font-medium text-t1">{option.name}</p>
        <p className={clsx("font-mono text-2xs uppercase tracking-widest", option.canConnect ? "text-success" : "text-t3")}>{status}</p>
      </div>
      {option.canConnect ? (
        <button
          type="button"
          disabled={connecting || blocked}
          onClick={onConnect}
          className="wallet-option-action rounded-full border border-[var(--border)] px-3 py-1.5 font-body text-xs text-t2 transition-all duration-150 ease-expo hover:border-[var(--border-hover)] hover:text-t1 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {connecting ? "Opening..." : "Connect"}
        </button>
      ) : option.url ? (
        <a
          href={option.url}
          target="_blank"
          rel="noreferrer"
          className="wallet-option-action rounded-full border border-[var(--border)] px-3 py-1.5 font-body text-xs text-t2 transition-all duration-150 ease-expo hover:border-[var(--border-hover)] hover:text-t1"
        >
          Install
        </a>
      ) : (
        <span className="font-mono text-2xs uppercase tracking-widest text-t4">Unavailable</span>
      )}
    </div>
  );
}

function WalletIcon({ option }: { option: WalletOption }) {
  if (option.icon) {
    return (
      <img
        src={option.icon}
        alt=""
        className="h-10 w-10 rounded-xl border border-[var(--border)] bg-high object-cover"
        aria-hidden="true"
      />
    );
  }

  return (
    <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-[var(--border)] bg-high font-mono text-xs uppercase text-accent">
      {option.name.slice(0, 2)}
    </span>
  );
}

function LogoMark() {
  return (
    <span className="logo-icon grid h-[22px] w-[22px] grid-cols-2 gap-0.5 rounded-md" aria-hidden="true">
      <span className="rounded-[2px] bg-accent" />
      <span className="rounded-[2px] bg-accent opacity-75" />
      <span className="rounded-[2px] bg-accent opacity-75" />
      <span className="rounded-[2px] bg-accent" />
    </span>
  );
}

function buildWalletOptions(wallet: ReturnType<typeof useWallet>): WalletOption[] {
  const seen = new Set<string>();
  const detected = wallet.wallets.map((availableWallet) => {
    seen.add(availableWallet.name);
    const readyState = availableWallet.readyState ?? "Installed";
    return {
      name: availableWallet.name,
      icon: availableWallet.icon,
      url: availableWallet.url,
      readyState,
      canConnect: readyState === "Installed",
    };
  });

  const notDetected = wallet.notDetectedWallets
    .filter((availableWallet) => !seen.has(availableWallet.name))
    .map((availableWallet) => ({
      name: availableWallet.name,
      icon: availableWallet.icon,
      url: availableWallet.url,
      readyState: availableWallet.readyState,
      canConnect: false,
    }));

  return [...detected, ...notDetected].sort((a, b) => Number(b.canConnect) - Number(a.canConnect) || a.name.localeCompare(b.name));
}

async function connectWallet(
  wallet: ReturnType<typeof useWallet>,
  walletName: string,
  setConnectingWallet: (walletName: string | null) => void,
  setConnectError: (message: string | null) => void,
): Promise<void> {
  setConnectingWallet(walletName);
  setConnectError(null);
  try {
    await Promise.resolve(wallet.connect(walletName));
    setConnectError(null);
  } catch (error) {
    if (isAlreadyConnectedError(error)) {
      localStorage.removeItem("AptosWalletName");
      setConnectError("Petra has a stale session for this site. Disconnect localhost in Petra, refresh, then connect again.");
      return;
    }

    setConnectError(getConnectErrorMessage(error));
  } finally {
    setConnectingWallet(null);
  }
}

function getConnectErrorMessage(error: unknown): string {
  if (isPetraLegacyApiError(error)) {
    return "Petra blocked the old browser API. Refresh this page and connect through the Petra option again.";
  }
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }
  return "Wallet connection failed. Choose another wallet or unlock the extension first.";
}

function isAlreadyConnectedError(error: unknown): boolean {
  const message = typeof error === "string" ? error : error instanceof Error ? error.message : "";
  return message.toLowerCase().includes("already connected");
}

function isPetraLegacyApiError(error: unknown): boolean {
  const message = typeof error === "string" ? error : error instanceof Error ? error.message : "";
  return message.toLowerCase().includes("direct usage of the petraapiclient");
}

function resolveNetworkName(network: unknown): string {
  if (typeof network !== "object" || network === null) {
    return "Unknown";
  }

  const record = network as Record<string, unknown>;
  return typeof record.name === "string" && record.name.trim() ? record.name : "Unknown";
}

async function copyText(text: string): Promise<void> {
  if (!navigator.clipboard) {
    return;
  }
  await navigator.clipboard.writeText(text);
}
