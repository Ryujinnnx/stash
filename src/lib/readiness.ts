import { aptosFullnodeUrl, aptosIndexerUrl, configuredNetworkName, shelbyRpcUrl } from "./network";
import { MARKETPLACE_MODULE_ADDRESS, isMarketplaceConfigured } from "./marketplace";

export interface RuntimeReadiness {
  networkName: string;
  aptosFullnodeUrl: string | null;
  aptosIndexerUrl: string;
  shelbyRpcUrl: string;
  marketplaceModuleAddress: string | null;
  marketplaceConfigured: boolean;
  hasAptosApiKey: boolean;
  hasShelbyApiKey: boolean;
  canReadIndexer: boolean;
  canPublish: boolean;
  blockers: string[];
  warnings: string[];
}

export function getRuntimeReadiness(): RuntimeReadiness {
  const marketplaceModuleAddress = MARKETPLACE_MODULE_ADDRESS || null;
  const marketplaceConfigured = isMarketplaceConfigured() && isAptosAddressLike(MARKETPLACE_MODULE_ADDRESS);
  const hasShelbyApiKey = Boolean(import.meta.env.VITE_SHELBY_API_KEY?.trim());
  const hasAptosApiKey = Boolean(import.meta.env.VITE_APTOS_API_KEY?.trim());
  const fullnode = aptosFullnodeUrl() ?? null;
  const blockers: string[] = [];
  const warnings: string[] = [];

  if (!marketplaceConfigured) {
    blockers.push("Set VITE_STASH_MODULE_ADDRESS to the deployed Stash Move package on Shelbinet.");
  }

  if (!fullnode) {
    blockers.push("Set an Aptos fullnode URL for the active network.");
  }

  if (!hasShelbyApiKey) {
    warnings.push("Shelby SDK docs recommend an API key. If RPC upload returns 401, 403, or repeated 500 responses, set VITE_SHELBY_API_KEY.");
  }

  if (!hasAptosApiKey) {
    warnings.push("No Aptos API key is configured. Public endpoints can work, but rate limits may affect indexer and transaction confirmation.");
  }

  if (configuredNetworkName() === "shelbynet") {
    warnings.push("Shelbynet browser uploads require ShelbyUSD and a Shelby write location for the connected wallet. CLI validation succeeded with location `shelbynet-1`.");
  }

  return {
    networkName: configuredNetworkName(),
    aptosFullnodeUrl: fullnode,
    aptosIndexerUrl: aptosIndexerUrl(),
    shelbyRpcUrl: shelbyRpcUrl(),
    marketplaceModuleAddress,
    marketplaceConfigured,
    hasAptosApiKey,
    hasShelbyApiKey,
    canReadIndexer: marketplaceConfigured,
    canPublish: blockers.length === 0,
    blockers,
    warnings,
  };
}

export function assertCanPublish(readiness: RuntimeReadiness = getRuntimeReadiness()): void {
  if (!readiness.canPublish) {
    throw new Error(readiness.blockers[0] ?? "Stash is not ready to publish on the active network.");
  }
}

export function readinessSummary(readiness: RuntimeReadiness = getRuntimeReadiness()): string {
  return [
    `network=${readiness.networkName}`,
    `fullnode=${readiness.aptosFullnodeUrl ?? "missing"}`,
    `indexer=${readiness.aptosIndexerUrl}`,
    `shelbyRpc=${readiness.shelbyRpcUrl}`,
    `module=${readiness.marketplaceModuleAddress ?? "missing"}`,
    `shelbyApiKey=${readiness.hasShelbyApiKey ? "set" : "missing"}`,
  ].join("; ");
}

function isAptosAddressLike(value: string): boolean {
  return /^0x[a-fA-F0-9]+$/.test(value.trim());
}