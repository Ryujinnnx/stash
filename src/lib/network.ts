import { Network } from "@aptos-labs/ts-sdk";

export type StashNetworkName = "mainnet" | "testnet" | "devnet" | "shelbynet" | "local";

const SHELBYNET_INDEXER_URL = "https://api.shelbynet.shelby.xyz/v1/graphql";
const SHELBYNET_RPC_URL = "https://api.shelbynet.shelby.xyz/shelby";
const SHELBYNET_FULLNODE_URL = "https://api.shelbynet.shelby.xyz/v1";
const TESTNET_INDEXER_URL = "https://api.testnet.aptoslabs.com/v1/graphql";
const TESTNET_RPC_URL = "https://api.testnet.shelby.xyz/shelby";
const TESTNET_FULLNODE_URL = "https://api.testnet.aptoslabs.com/v1";

export function configuredNetworkName(): StashNetworkName {
  const configured = import.meta.env.VITE_APTOS_NETWORK?.trim().toLowerCase();

  if (
    configured === "mainnet" ||
    configured === "testnet" ||
    configured === "devnet" ||
    configured === "shelbynet" ||
    configured === "local"
  ) {
    return configured;
  }

  return "shelbynet";
}

export function resolveAptosNetwork(): Network {
  const configured = configuredNetworkName();
  if (configured === "mainnet") {
    return Network.MAINNET;
  }
  if (configured === "testnet") {
    return Network.TESTNET;
  }
  if (configured === "devnet") {
    return Network.DEVNET;
  }
  if (configured === "local") {
    return Network.LOCAL;
  }
  return Network.SHELBYNET;
}

export function aptosIndexerUrl(): string {
  const configured = import.meta.env.VITE_APTOS_INDEXER_URL?.trim();
  if (configured) {
    return configured;
  }

  return configuredNetworkName() === "testnet" ? TESTNET_INDEXER_URL : SHELBYNET_INDEXER_URL;
}

export function aptosClientConfig(): { network: Network; fullnode?: string } {
  const fullnode = aptosFullnodeUrl();
  return fullnode ? { network: resolveAptosNetwork(), fullnode } : { network: resolveAptosNetwork() };
}

export function aptosFullnodeUrl(): string | undefined {
  const configured = import.meta.env.VITE_APTOS_FULLNODE_URL?.trim();
  if (configured) {
    return stripTrailingSlash(configured);
  }

  const network = configuredNetworkName();
  if (network === "shelbynet") {
    return SHELBYNET_FULLNODE_URL;
  }
  if (network === "testnet") {
    return TESTNET_FULLNODE_URL;
  }
  return undefined;
}

export function shelbyRpcUrl(): string {
  const configured = import.meta.env.VITE_SHELBY_RPC_URL?.trim();
  if (configured) {
    return stripTrailingSlash(configured);
  }

  return configuredNetworkName() === "testnet" ? TESTNET_RPC_URL : SHELBYNET_RPC_URL;
}

export function explorerNetworkName(network?: unknown): "mainnet" | "testnet" | "devnet" | "shelbynet" {
  const walletNetwork = readWalletNetworkName(network);
  if (
    walletNetwork === "mainnet" ||
    walletNetwork === "testnet" ||
    walletNetwork === "devnet" ||
    walletNetwork === "shelbynet"
  ) {
    return walletNetwork;
  }

  const configured = configuredNetworkName();
  return configured === "mainnet" || configured === "testnet" || configured === "devnet" ? configured : "shelbynet";
}

export function walletNetworkMatchesConfigured(network: unknown): boolean {
  const walletNetwork = readWalletNetworkName(network);
  return walletNetwork === null || walletNetwork === configuredNetworkName();
}

export function readWalletNetworkName(network: unknown): StashNetworkName | null {
  if (!isRecord(network)) {
    return null;
  }

  const name = typeof network.name === "string" ? network.name.trim().toLowerCase() : "";
  if (name === "mainnet" || name === "testnet" || name === "devnet" || name === "shelbynet" || name === "local") {
    return name;
  }
  return null;
}

function stripTrailingSlash(value: string): string {
  return value.endsWith("/") ? value.slice(0, -1) : value;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
