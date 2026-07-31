import { useMemo, useRef, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useWallet } from "@aptos-labs/wallet-adapter-react";
import { resolveAccountAddress } from "../lib/wallet";
import {
  configureShelbyStorage,
  downloadFile,
  getMetadata,
  type DatasetMetadata,
  ShelbyStorageError,
  type ShelbyChallengeSignature,
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
  cancel: () => void;
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
  const abortController = useRef<AbortController | null>(null);
  const [progress, setProgress] = useState<UploadProgress>(IDLE_PROGRESS);

  const mutation = useMutation<string, ShelbyStorageError, UploadInput>({
    mutationFn: async ({ file, metadata, buyerPublicKey }) => {
      const accountAddress = resolveAccountAddress(wallet.account);
      if (!wallet.connected || !accountAddress || !wallet.signAndSubmitTransaction) {
        throw createHookError("CONFIGURATION_ERROR", "Connect an Aptos wallet before uploading to Shelby");
      }

      abortController.current?.abort();
      const currentAbortController = new AbortController();
      abortController.current = currentAbortController;

      configureShelbyStorage({
        accountAddress,
        signAndSubmitTransaction: wallet.signAndSubmitTransaction as SignAndSubmitTransaction,
        signShelbyChallenge: async (challenge: string) => signShelbyChallenge(wallet, challenge),
        buyerPublicKey,
        abortSignal: currentAbortController.signal,
        onProgress: setProgress,
      });

      try {
        return await uploadFile(file, metadata);
      } finally {
        if (abortController.current === currentAbortController) {
          abortController.current = null;
        }
      }
    },
    retry: false,
  });

  function cancel() {
    abortController.current?.abort();
    abortController.current = null;
  }

  return {
    upload: mutation.mutateAsync,
    progress,
    storageId: mutation.data ?? null,
    error: mutation.error ?? null,
    isUploading: mutation.isPending,
    cancel,
    reset: () => {
      cancel();
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
type WalletForShelbyChallenge = ReturnType<typeof useWallet>;

async function signShelbyChallenge(
  wallet: WalletForShelbyChallenge,
  challenge: string,
): Promise<ShelbyChallengeSignature> {
  const response = await wallet.signMessage({
    message: challenge,
    nonce: crypto.randomUUID(),
  });

  return {
    challenge,
    signature: readBytesFromUnknown(response.signature, "Shelby challenge signature"),
    publicKey: readBytesFromUnknown(readPublicKey(wallet.account), "wallet public key"),
  };
}

function readPublicKey(account: unknown): unknown {
  if (typeof account !== "object" || account === null) {
    return null;
  }
  return (account as { publicKey?: unknown }).publicKey;
}

function readBytesFromUnknown(value: unknown, label: string): Uint8Array<ArrayBuffer> {
  if (value instanceof Uint8Array) {
    return toByteArray(value);
  }

  if (typeof value === "string") {
    return parseByteString(value, label);
  }

  if (typeof value === "object" && value !== null) {
    const toUint8Array = (value as { toUint8Array?: unknown }).toUint8Array;
    if (typeof toUint8Array === "function") {
      const bytes = toUint8Array.call(value) as unknown;
      if (bytes instanceof Uint8Array) {
        return toByteArray(bytes);
      }
    }

    const bytes = (value as { bytes?: unknown }).bytes;
    if (bytes instanceof Uint8Array) {
      return toByteArray(bytes);
    }

    const data = (value as { data?: unknown }).data;
    if (data instanceof Uint8Array) {
      return toByteArray(data);
    }
  }

  throw createHookError("CONFIGURATION_ERROR", `${label} was not returned in a supported byte format`);
}

function parseByteString(value: string, label: string): Uint8Array<ArrayBuffer> {
  const normalized = value.trim();
  if (/^0x[0-9a-fA-F]+$/.test(normalized)) {
    return hexToBytes(normalized.slice(2));
  }
  if (/^[0-9a-fA-F]+$/.test(normalized) && normalized.length % 2 === 0) {
    return hexToBytes(normalized);
  }

  try {
    const binary = window.atob(normalized);
    const bytes = new Uint8Array(new ArrayBuffer(binary.length));
    for (let index = 0; index < binary.length; index += 1) {
      bytes[index] = binary.charCodeAt(index);
    }
    return bytes;
  } catch {
    throw createHookError("CONFIGURATION_ERROR", `${label} is not valid hex or base64`);
  }
}

function hexToBytes(hex: string): Uint8Array<ArrayBuffer> {
  const bytes = new Uint8Array(new ArrayBuffer(hex.length / 2));
  for (let index = 0; index < bytes.length; index += 1) {
    bytes[index] = Number.parseInt(hex.slice(index * 2, index * 2 + 2), 16);
  }
  return bytes;
}

function toByteArray(bytes: Uint8Array): Uint8Array<ArrayBuffer> {
  const copy = new Uint8Array(new ArrayBuffer(bytes.byteLength));
  copy.set(bytes);
  return copy;
}
