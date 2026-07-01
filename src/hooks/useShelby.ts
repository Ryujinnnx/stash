import { useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useWallet } from "@aptos-labs/wallet-adapter-react";
import { resolveAccountAddress } from "../lib/wallet";
import {
  configureShelbyStorage,
  downloadFile,
  getMetadata,
  type DatasetMetadata,
  ShelbyStorageError,
  type SignAndSubmitTransaction,
  type UploadProgress,
  uploadFile,
} from "../lib/shelby";

export interface UploadInput {
  file: File;
  metadata: DatasetMetadata;
  buyerPublicKey: CryptoKey;
}

export interface UseUploadResult {
  upload: (input: UploadInput) => Promise<string>;
  progress: UploadProgress;
  storageId: string | null;
  error: ShelbyStorageError | null;
  isUploading: boolean;
  reset: () => void;
}

export interface UseDownloadResult {
  download: (accessProof: string, buyerPrivateKey: CryptoKey) => Promise<Blob>;
  file: Blob | null;
  error: ShelbyStorageError | null;
  isDownloading: boolean;
  reset: () => void;
}

const IDLE_PROGRESS: UploadProgress = {
  stage: "idle",
  percent: 0,
  message: "Idle",
};

export function useUpload(): UseUploadResult {
  const wallet = useWallet();
  const [progress, setProgress] = useState<UploadProgress>(IDLE_PROGRESS);

  const mutation = useMutation<string, ShelbyStorageError, UploadInput>({
    mutationFn: async ({ file, metadata, buyerPublicKey }) => {
      const accountAddress = resolveAccountAddress(wallet.account);
      if (!wallet.connected || !accountAddress || !wallet.signAndSubmitTransaction) {
        throw createHookError("CONFIGURATION_ERROR", "Connect an Aptos wallet before uploading to Shelby");
      }

      configureShelbyStorage({
        accountAddress,
        signAndSubmitTransaction: wallet.signAndSubmitTransaction as SignAndSubmitTransaction,
        buyerPublicKey,
        onProgress: setProgress,
      });

      return uploadFile(file, metadata);
    },
    retry: 2,
  });

  return {
    upload: mutation.mutateAsync,
    progress,
    storageId: mutation.data ?? null,
    error: mutation.error ?? null,
    isUploading: mutation.isPending,
    reset: () => {
      setProgress(IDLE_PROGRESS);
      mutation.reset();
    },
  };
}

export function useDownload(storageId: string | null): UseDownloadResult {
  const mutation = useMutation<Blob, ShelbyStorageError, { accessProof: string; buyerPrivateKey: CryptoKey }>({
    mutationFn: async ({ accessProof, buyerPrivateKey }) => {
      if (!storageId) {
        throw createHookError("VALIDATION_ERROR", "Storage id is required before downloading");
      }

      configureShelbyStorage({
        buyerPrivateKey,
      });

      return downloadFile(storageId, accessProof);
    },
    retry: false,
  });

  return {
    download: (accessProof, buyerPrivateKey) => mutation.mutateAsync({ accessProof, buyerPrivateKey }),
    file: mutation.data ?? null,
    error: mutation.error ?? null,
    isDownloading: mutation.isPending,
    reset: mutation.reset,
  };
}

export function useMetadata(storageId: string | null) {
  const queryKey = useMemo(() => ["shelby-metadata", storageId], [storageId]);

  return useQuery<DatasetMetadata, ShelbyStorageError>({
    queryKey,
    enabled: Boolean(storageId),
    queryFn: async () => {
      if (!storageId) {
        throw createHookError("VALIDATION_ERROR", "Storage id is required before loading metadata");
      }
      return getMetadata(storageId);
    },
    retry: 1,
    throwOnError: false,
  });
}

export function useShelby(storageId: string | null = null) {
  const upload = useUpload();
  const download = useDownload(storageId);
  const metadata = useMetadata(storageId);

  return {
    upload,
    download,
    metadata,
  };
}

function createHookError(code: ShelbyStorageError["code"], message: string): ShelbyStorageError {
  return new ShelbyStorageError(code, message);
}
