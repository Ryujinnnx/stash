import type { InputTransactionData } from "@aptos-labs/wallet-adapter-react";
import type { DatasetMetadata } from "./shelby";
import { aptosIndexerUrl } from "./network";

export type DatasetCategory = "dataset" | "model" | "benchmark" | "embedding" | "agent" | "other";
export type DatasetFormat = "csv" | "json" | "parquet" | "zip" | "safetensors" | "onnx" | "other";
export type MarketplaceSort = "newest" | "price" | "popular";

export interface MarketplaceListing {
  id: string;
  storageId: string;
  title: string;
  description: string;
  category: DatasetCategory;
  tags: string[];
  priceOctas: number;
  sizeBytes: number;
  format: DatasetFormat;
  creator: string;
  active: boolean;
  createdAt: number;
  purchases: number;
  uniqueBuyers: number;
  views: number;
  revenueOctas: number;
  lastSaleAt: number | null;
  previewUrl?: string;
}

export interface MarketplaceFilters {
  category: DatasetCategory | "all";
  format: DatasetFormat | "all";
  minPriceApt: string;
  maxPriceApt: string;
  sort: MarketplaceSort;
  search: string;
}

export interface CreatorAnalytics {
  totalEarningsOctas: number;
  totalPurchases: number;
  totalUniqueBuyers: number;
  totalViews: number;
  lastSaleAt: number | null;
  listings: MarketplaceListing[];
  recentTransactions: CreatorTransaction[];
}

export interface CreatorTransaction {
  id: string;
  listingId: string;
  datasetTitle: string;
  buyer: string;
  amountOctas: number;
  date: number | null;
  status: "success" | "warning" | "error";
}

export interface MarketplaceStats {
  totalDatasets: number;
  totalVolumeOctas: number;
  totalCreators: number;
  totalPurchases: number;
}

export interface RegisterListingInput {
  storageId: string;
  metadata: DatasetMetadata;
  priceOctas: number;
}

export const MARKETPLACE_MODULE_ADDRESS =
  import.meta.env.VITE_STASH_MODULE_ADDRESS?.trim() ?? "";

export const INDEXER_GRAPHQL_URL =
  aptosIndexerUrl();

interface GraphQlResponse<T> {
  data?: T;
  errors?: { message: string }[];
}

interface EventRow {
  sequence_number?: string | number;
  creation_number?: string | number;
  indexed_type?: string;
  type?: string;
  data?: unknown;
  transaction_version?: string | number;
  account_address?: string;
}

interface EventsQueryResult {
  events?: EventRow[];
}

export async function fetchMarketplaceListings(filters: MarketplaceFilters): Promise<MarketplaceListing[]> {
  const events = await fetchIndexerEvents();
  const listings = materializeListings(events);
  return applyMarketplaceFilters(listings, filters);
}

export async function fetchListingById(id: string): Promise<MarketplaceListing | null> {
  const listings = materializeListings(await fetchIndexerEvents());
  return listings.find((listing) => listing.id === id) ?? null;
}

export async function fetchCreatorAnalytics(creator: string): Promise<CreatorAnalytics> {
  const events = await fetchIndexerEvents();
  const listings = materializeListings(events).filter(
    (listing) => listing.creator.toLowerCase() === creator.toLowerCase(),
  ).sort((left, right) => right.createdAt - left.createdAt);
  const listingIds = new Set(listings.map((listing) => listing.id));
  const listingsById = new Map(listings.map((listing) => [listing.id, listing]));
  const recentTransactions = materializeCreatorTransactions(events, listingIds, listingsById);
  const uniqueBuyers = new Set(
    recentTransactions.map((transaction) => transaction.buyer.toLowerCase()).filter(Boolean),
  );

  return {
    listings,
    totalEarningsOctas: listings.reduce((total, listing) => total + listing.revenueOctas, 0),
    totalPurchases: listings.reduce((total, listing) => total + listing.purchases, 0),
    totalUniqueBuyers: uniqueBuyers.size,
    totalViews: listings.reduce((total, listing) => total + listing.views, 0),
    lastSaleAt: listings.reduce<number | null>((latest, listing) => {
      if (!listing.lastSaleAt) {
        return latest;
      }
      return latest === null || listing.lastSaleAt > latest ? listing.lastSaleAt : latest;
    }, null),
    recentTransactions,
  };
}

export async function fetchMarketplaceStats(): Promise<MarketplaceStats> {
  const listings = materializeListings(await fetchIndexerEvents());
  const creators = new Set(listings.map((listing) => listing.creator.toLowerCase()).filter(Boolean));

  return {
    totalDatasets: listings.filter((listing) => listing.active).length,
    totalVolumeOctas: listings.reduce((total, listing) => total + listing.revenueOctas, 0),
    totalCreators: creators.size,
    totalPurchases: listings.reduce((total, listing) => total + listing.purchases, 0),
  };
}

export function createListingPayload(input: RegisterListingInput): InputTransactionData {
  return {
    data: {
      function: marketplaceFunction("marketplace", "create_listing"),
      functionArguments: [
        input.storageId,
        input.priceOctas,
        input.metadata.title,
        input.metadata.description,
        input.metadata.category,
        input.metadata.tags,
      ],
    },
  };
}

export function purchasePayload(listingId: string): InputTransactionData {
  return {
    data: {
      function: marketplaceFunction("payment", "purchase"),
      functionArguments: [Number(listingId)],
    },
  };
}

export function claimRevenuePayload(listingId: string): InputTransactionData {
  return {
    data: {
      function: marketplaceFunction("payment", "claim_revenue"),
      functionArguments: [Number(listingId)],
    },
  };
}

export function delistPayload(listingId: string): InputTransactionData {
  return {
    data: {
      function: marketplaceFunction("marketplace", "delist"),
      functionArguments: [Number(listingId)],
    },
  };
}

async function fetchIndexerEvents(): Promise<EventRow[]> {
  if (!isMarketplaceConfigured()) {
    return [];
  }

  const query = `
    query StashEvents($modulePrefix: String!) {
      events(
        where: { indexed_type: { _like: $modulePrefix } }
        order_by: { transaction_version: desc }
        limit: 250
      ) {
        sequence_number
        creation_number
        indexed_type
        type
        data
        transaction_version
        account_address
      }
    }
  `;

  const response = await fetch(INDEXER_GRAPHQL_URL, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      query,
      variables: {
        modulePrefix: `${MARKETPLACE_MODULE_ADDRESS}::%`,
      },
    }),
  });

  if (!response.ok) {
    throw new Error(`Aptos Indexer returned HTTP ${response.status}`);
  }

  const payload = (await response.json()) as GraphQlResponse<EventsQueryResult>;
  if (payload.errors?.length) {
    throw new Error(payload.errors.map((error) => error.message).join("; "));
  }

  return payload.data?.events ?? [];
}

export function isMarketplaceConfigured(): boolean {
  return MARKETPLACE_MODULE_ADDRESS.length > 0;
}

export function marketplaceFunction(moduleName: string, functionName: string): `${string}::${string}::${string}` {
  if (!isMarketplaceConfigured()) {
    throw new Error("Marketplace contract is not connected yet. Try again after deployment is configured.");
  }
  return `${MARKETPLACE_MODULE_ADDRESS}::${moduleName}::${functionName}`;
}

function materializeListings(events: EventRow[]): MarketplaceListing[] {
  const listings = new Map<string, MarketplaceListing>();
  const buyersByListing = new Map<string, Set<string>>();

  events
    .slice()
    .reverse()
    .forEach((event) => {
      const eventType = event.indexed_type ?? event.type ?? "";
      const data = asRecord(event.data);

      if (eventType.includes("ListingCreatedEvent")) {
        const id = readString(data, "listing_id", "0");
        listings.set(id, {
          id,
          storageId: readString(data, "storage_id", ""),
          title: readString(data, "title", "Untitled dataset"),
          description: readString(data, "description", ""),
          category: normalizeCategory(readString(data, "category", "other")),
          tags: readStringArray(data, "tags"),
          priceOctas: readNumber(data, "price", 0),
          sizeBytes: 0,
          format: "other",
          creator: readString(data, "creator", ""),
          active: true,
          createdAt: readNumber(data, "created_at", 0) * 1000,
          purchases: 0,
          uniqueBuyers: 0,
          views: 0,
          revenueOctas: 0,
          lastSaleAt: null,
        });
      }

      if (eventType.includes("ListingPriceUpdatedEvent")) {
        const listing = listings.get(readString(data, "listing_id", ""));
        if (listing) {
          listing.priceOctas = readNumber(data, "new_price", listing.priceOctas);
        }
      }

      if (eventType.includes("ListingDelistedEvent")) {
        const listing = listings.get(readString(data, "listing_id", ""));
        if (listing) {
          listing.active = false;
        }
      }

      if (eventType.includes("PurchaseEvent")) {
        const listingId = readString(data, "listing_id", "");
        const listing = listings.get(listingId);
        if (listing) {
          const buyer = readString(data, "buyer", "").toLowerCase();
          if (buyer) {
            const buyers = buyersByListing.get(listingId) ?? new Set<string>();
            buyers.add(buyer);
            buyersByListing.set(listingId, buyers);
            listing.uniqueBuyers = buyers.size;
          }

          const purchasedAt = readNumber(data, "purchased_at", 0) * 1000;
          listing.purchases += 1;
          listing.revenueOctas += readNumber(data, "creator_amount", 0);
          if (purchasedAt > 0 && (!listing.lastSaleAt || purchasedAt > listing.lastSaleAt)) {
            listing.lastSaleAt = purchasedAt;
          }
        }
      }
    });

  return Array.from(listings.values());
}

function materializeCreatorTransactions(
  events: EventRow[],
  listingIds: Set<string>,
  listingsById: Map<string, MarketplaceListing>,
): CreatorTransaction[] {
  return events
    .filter((event) => {
      const eventType = event.indexed_type ?? event.type ?? "";
      const data = asRecord(event.data);
      return eventType.includes("PurchaseEvent") && listingIds.has(readString(data, "listing_id", ""));
    })
    .map((event) => {
      const data = asRecord(event.data);
      const listingId = readString(data, "listing_id", "");
      const listing = listingsById.get(listingId);
      const version = readEventNumber(event.transaction_version, 0);
      const purchasedAt = readNumber(data, "purchased_at", 0) * 1000;

      return {
        id: version > 0 ? `v${version}` : `${listingId}-${readString(data, "buyer", "buyer")}`,
        listingId,
        datasetTitle: listing?.title ?? "Dataset",
        buyer: readString(data, "buyer", ""),
        amountOctas: readNumber(data, "creator_amount", 0),
        date: purchasedAt > 0 ? purchasedAt : null,
        status: "success" as const,
      };
    })
    .sort((left, right) => {
      const leftTime = left.date ?? readVersionId(left.id);
      const rightTime = right.date ?? readVersionId(right.id);
      return rightTime - leftTime;
    })
    .slice(0, 10);
}

function applyMarketplaceFilters(
  listings: MarketplaceListing[],
  filters: MarketplaceFilters,
): MarketplaceListing[] {
  const minPrice = Number(filters.minPriceApt || "0") * 100_000_000;
  const maxPrice = filters.maxPriceApt ? Number(filters.maxPriceApt) * 100_000_000 : Number.POSITIVE_INFINITY;
  const search = filters.search.trim().toLowerCase();

  return listings
    .filter((listing) => listing.active)
    .filter((listing) => filters.category === "all" || listing.category === filters.category)
    .filter((listing) => filters.format === "all" || listing.format === filters.format)
    .filter((listing) => listing.priceOctas >= minPrice && listing.priceOctas <= maxPrice)
    .filter((listing) => {
      if (!search) {
        return true;
      }
      return `${listing.title} ${listing.description} ${listing.tags.join(" ")}`.toLowerCase().includes(search);
    })
    .sort((left, right) => {
      if (filters.sort === "price") {
        return left.priceOctas - right.priceOctas;
      }
      if (filters.sort === "popular") {
        return right.purchases - left.purchases;
      }
      return right.createdAt - left.createdAt;
    });
}

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null ? (value as Record<string, unknown>) : {};
}

function readString(record: Record<string, unknown>, key: string, fallback: string): string {
  const value = record[key];
  if (typeof value === "string") {
    return value;
  }
  if (typeof value === "number") {
    return value.toString();
  }
  return fallback;
}

function readNumber(record: Record<string, unknown>, key: string, fallback: number): number {
  const value = record[key];
  if (typeof value === "number") {
    return value;
  }
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }
  return fallback;
}

function readEventNumber(value: EventRow["transaction_version"], fallback: number): number {
  if (typeof value === "number") {
    return value;
  }
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }
  return fallback;
}

function readVersionId(value: string): number {
  const parsed = Number(value.replace(/^v/, ""));
  return Number.isFinite(parsed) ? parsed : 0;
}

function readStringArray(record: Record<string, unknown>, key: string): string[] {
  const value = record[key];
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter((item): item is string => typeof item === "string");
}

function normalizeCategory(value: string): DatasetCategory {
  const allowed: DatasetCategory[] = ["dataset", "model", "benchmark", "embedding", "agent", "other"];
  return allowed.includes(value as DatasetCategory) ? (value as DatasetCategory) : "other";
}
