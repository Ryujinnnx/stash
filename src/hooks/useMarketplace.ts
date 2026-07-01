import { useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useWallet } from "@aptos-labs/wallet-adapter-react";
import {
  claimRevenuePayload,
  createListingPayload,
  delistPayload,
  fetchCreatorAnalytics,
  fetchListingById,
  fetchMarketplaceStats,
  fetchMarketplaceListings,
  type CreatorAnalytics,
  type MarketplaceFilters,
  type MarketplaceListing,
  purchasePayload,
  type RegisterListingInput,
} from "../lib/marketplace";
import { hasConnectedAccount } from "../lib/wallet";

interface TransactionResult {
  hash?: string;
}

export function useMarketplace(filters: MarketplaceFilters) {
  return useQuery<MarketplaceListing[]>({
    queryKey: ["marketplace-listings", filters],
    queryFn: () => fetchMarketplaceListings(filters),
    staleTime: 20_000,
  });
}

export function useDatasetListing(id: string | undefined) {
  return useQuery<MarketplaceListing | null>({
    queryKey: ["marketplace-listing", id],
    enabled: Boolean(id),
    queryFn: () => fetchListingById(id ?? ""),
    staleTime: 20_000,
  });
}

export function useMarketplaceStats() {
  return useQuery({
    queryKey: ["marketplace-stats"],
    queryFn: fetchMarketplaceStats,
    staleTime: 30_000,
  });
}

export function useCreatorDashboard(creator: string | null) {
  return useQuery<CreatorAnalytics>({
    queryKey: ["creator-dashboard", creator],
    enabled: Boolean(creator),
    queryFn: () => fetchCreatorAnalytics(creator ?? ""),
    staleTime: 20_000,
  });
}

export function useMarketplaceActions() {
  const wallet = useWallet();
  const queryClient = useQueryClient();
  const signer = wallet.signAndSubmitTransaction;

  const canTransact = useMemo(
    () => Boolean(hasConnectedAccount(wallet.connected, wallet.account) && signer),
    [wallet.account, wallet.connected, signer],
  );

  const createListing = useMutation<TransactionResult, Error, RegisterListingInput>({
    mutationFn: async (input) => {
      if (!signer || !canTransact) {
        throw new Error("Connect a wallet before creating a listing");
      }
      return (await signer(createListingPayload(input))) as TransactionResult;
    },
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["marketplace-listings"] }),
  });

  const purchase = useMutation<TransactionResult, Error, string>({
    mutationFn: async (listingId) => {
      if (!signer || !canTransact) {
        throw new Error("Connect a wallet before purchasing");
      }
      return (await signer(purchasePayload(listingId))) as TransactionResult;
    },
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["marketplace-listings"] }),
  });

  const claimRevenue = useMutation<TransactionResult, Error, string>({
    mutationFn: async (listingId) => {
      if (!signer || !canTransact) {
        throw new Error("Connect a wallet before claiming revenue");
      }
      return (await signer(claimRevenuePayload(listingId))) as TransactionResult;
    },
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["creator-dashboard"] }),
  });

  const delist = useMutation<TransactionResult, Error, string>({
    mutationFn: async (listingId) => {
      if (!signer || !canTransact) {
        throw new Error("Connect a wallet before delisting");
      }
      return (await signer(delistPayload(listingId))) as TransactionResult;
    },
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["creator-dashboard"] }),
  });

  return {
    canTransact,
    createListing,
    purchase,
    claimRevenue,
    delist,
  };
}
