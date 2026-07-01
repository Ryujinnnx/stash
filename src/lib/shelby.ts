import { AccountAddress, Aptos, AptosConfig, Network } from "@aptos-labs/ts-sdk";
import {
  createDefaultErasureCodingProvider,
  defaultErasureCodingConfig,
  expectedTotalChunksets,
  generateCommitments,
  ShelbyBlobClient,
  ShelbyClient,
} from "@shelby-protocol/sdk/browser";
import { aptosClientConfig, resolveAptosNetwork, shelbyRpcUrl } from "./network";

export interface DatasetMetadata {
  title: string;
  description: string;
  category: string;
  tags: string[];
  size: number;
  format: string;
  preview_url?: string;
  created_at: number;
}

export type ShelbyStorageErrorCode =
  | "ACCESS_DENIED"
  | "CONFIGURATION_ERROR"
  | "CRYPTO_ERROR"
  | "DOWNLOAD_TIMEOUT"
  | "METADATA_NOT_FOUND"
  | "NETWORK_ERROR"
  | "UPLOAD_FAILED"
  | "VALIDATION_ERROR";

export class ShelbyStorageError extends Error {
  readonly code: ShelbyStorageErrorCode;
  readonly cause?: unknown;

  constructor(code: ShelbyStorageErrorCode, message: string, cause?: unknown) {
    super(message);
    this.name = "ShelbyStorageError";
    this.code = code;
    this.cause = cause;
  }
}

type ByteArray = Uint8Array<ArrayBuffer>;
type ShelbyNetwork = Network.TESTNET | Network.SHELBYNET | Network.LOCAL;

export interface UploadProgress {
  stage: "idle" | "validating" | "encrypting" | "registering" | "uploading" | "metadata" | "complete";
  percent: number;
  message: string;
}

export interface AccessProofPayload {
  storage_id: string;
  encrypted_key: string;
  expires_at: number;
  issuer?: string;
  signature?: string;
}

export interface TransactionRequest {
  data: unknown;
}

export type SignAndSubmitTransaction = (
  transaction: TransactionRequest,
) => Promise<{ hash: string }>;

export interface ShelbyStorageContext {
  accountAddress?: string;
  signAndSubmitTransaction?: SignAndSubmitTransaction;
  buyerPublicKey?: CryptoKey;
  buyerPrivateKey?: CryptoKey;
  aptos?: Aptos;
  apiKey?: string;
  rpcUrl?: string;
  network?: ShelbyNetwork;
  uploadTtlDays?: number;
  maxUploadRetries?: number;
  downloadTimeoutMs?: number;
  verifyAccessProof?: (storageId: string, accessProof: string) => Promise<boolean>;
  onProgress?: (progress: UploadProgress) => void;
}

interface BlobCommitments {
  blob_merkle_root: string;
  raw_data_size: number;
}

interface StorageIdPayload {
  version: 1;
  owner: string;
  manifestBlobName: string;
}

interface EncryptionEnvelope {
  algorithm: "RSA-OAEP-256";
  encrypted_key: string;
}

interface EncryptedFileDescriptor {
  blob_name: string;
  original_name: string;
  mime_type: string;
  plain_size: number;
  encrypted_size: number;
  cipher: "AES-GCM";
  iv: string;
}

interface StashStorageManifest {
  version: 1;
  kind: "stash.dataset.manifest";
  metadata: DatasetMetadata;
  file: EncryptedFileDescriptor;
  key_envelope: EncryptionEnvelope;
  created_at: number;
}

interface ShelbyFetchContext {
  apiKey?: string;
  rpcUrl?: string;
  downloadTimeoutMs?: number;
}

const DEFAULT_UPLOAD_TTL_DAYS = 30;
const DEFAULT_DOWNLOAD_TIMEOUT_MS = 45_000;
const DEFAULT_MAX_UPLOAD_RETRIES = 2;
const TEXT_ENCODER = new TextEncoder();
const TEXT_DECODER = new TextDecoder();

let storageContext: ShelbyStorageContext | null = null;
let shelbyClient: ShelbyClient | null = null;

export function configureShelbyStorage(context: ShelbyStorageContext): void {
  storageContext = context;
  const clientConfig: ConstructorParameters<typeof ShelbyClient>[0] = {
    network: context.network ?? resolveShelbyNetwork(),
  };
  const apiKey = context.apiKey ?? import.meta.env.VITE_SHELBY_API_KEY;
  if (apiKey) {
    clientConfig.apiKey = apiKey;
  }

  shelbyClient = new ShelbyClient(clientConfig);
}

export function clearShelbyStorageContext(): void {
  storageContext = null;
  shelbyClient = null;
}

export async function uploadFile(file: File, metadata: DatasetMetadata): Promise<string> {
  const context = requireContext();
  const client = requireClient();
  const accountAddress = requireAccountAddress(context);
  const normalizedMetadata = normalizeMetadata(file, metadata);

  reportProgress(context, "validating", 5, "Validating dataset metadata");
  validateMetadata(normalizedMetadata);

  return withRetry(
    async () => {
      if (!context.buyerPublicKey) {
        throw new ShelbyStorageError("CONFIGURATION_ERROR", "A buyer public encryption key is required for upload");
      }

      reportProgress(context, "encrypting", 15, "Encrypting dataset payload");
      const encryptedFile = await encryptFile(file, context.buyerPublicKey);
      const fileBlobName = createBlobName("files", file.name);
      const manifestBlobName = createBlobName("metadata", `${file.name}.json`);

      reportProgress(context, "registering", 35, "Registering encrypted dataset blob");
      await registerAndUploadBlob(client, context, fileBlobName, encryptedFile.bytes);

      const manifest: StashStorageManifest = {
        version: 1,
        kind: "stash.dataset.manifest",
        metadata: normalizedMetadata,
        file: {
          blob_name: fileBlobName,
          original_name: file.name,
          mime_type: file.type || "application/octet-stream",
          plain_size: file.size,
          encrypted_size: encryptedFile.bytes.byteLength,
          cipher: "AES-GCM",
          iv: encryptedFile.iv,
        },
        key_envelope: {
          algorithm: "RSA-OAEP-256",
          encrypted_key: encryptedFile.encryptedKey,
        },
        created_at: normalizedMetadata.created_at,
      };

      reportProgress(context, "metadata", 82, "Uploading encrypted dataset manifest");
      await registerAndUploadBlob(client, context, manifestBlobName, encodeJson(manifest));

      const storageId = encodeStorageId({
        version: 1,
        owner: accountAddress,
        manifestBlobName,
      });
      reportProgress(context, "complete", 100, "Dataset stored on Shelby");

      return storageId;
    },
    context.maxUploadRetries ?? DEFAULT_MAX_UPLOAD_RETRIES,
    "UPLOAD_FAILED",
  );
}

export async function downloadFile(storageId: string, accessProof: string): Promise<Blob> {
  const context = requireContext();
  const accessGranted = await verifyAccess(storageId, accessProof, context);
  if (!accessGranted) {
    throw new ShelbyStorageError("ACCESS_DENIED", "Access proof was rejected for this dataset");
  }

  const parsed = parseStorageId(storageId);
  const manifest = await fetchManifest(parsed);
  const encryptedBlob = await fetchShelbyBlob(parsed.owner, manifest.file.blob_name, context);
  const encryptedBytes = new Uint8Array(await encryptedBlob.arrayBuffer());
  const proof = decodeAccessProof(accessProof);
  const encryptedKey = proof.encrypted_key || manifest.key_envelope.encrypted_key;
  const plainBytes = await decryptBytes(toByteArray(encryptedBytes), manifest.file.iv, encryptedKey, context);

  return new Blob([toArrayBuffer(plainBytes)], { type: manifest.file.mime_type });
}

export async function getMetadata(storageId: string): Promise<DatasetMetadata> {
  const manifest = await fetchManifest(parseStorageId(storageId));
  return manifest.metadata;
}

export function createAccessProof(payload: AccessProofPayload): string {
  return base64UrlEncode(encodeJson(payload));
}

export async function importBuyerPublicKey(spkiBase64Url: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "spki",
    base64UrlDecode(spkiBase64Url),
    { name: "RSA-OAEP", hash: "SHA-256" },
    false,
    ["encrypt"],
  );
}

export async function importBuyerPrivateKey(pkcs8Base64Url: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "pkcs8",
    base64UrlDecode(pkcs8Base64Url),
    { name: "RSA-OAEP", hash: "SHA-256" },
    false,
    ["decrypt"],
  );
}

async function registerAndUploadBlob(
  client: ShelbyClient,
  context: ShelbyStorageContext,
  blobName: string,
  blobData: ByteArray,
): Promise<void> {
  const commitments = await generateBlobCommitments(blobData);
  const accountAddress = requireAccountAddress(context);
  const signAndSubmitTransaction = requireSignAndSubmitTransaction(context);
  const erasureConfig = defaultErasureCodingConfig();
  let payload: ReturnType<typeof ShelbyBlobClient.createRegisterBlobPayload>;
  try {
    payload = ShelbyBlobClient.createRegisterBlobPayload({
      account: AccountAddress.fromString(accountAddress),
      blobName,
      blobMerkleRoot: commitments.blob_merkle_root,
      numChunksets: expectedTotalChunksets(commitments.raw_data_size),
      expirationMicros: expirationMicros(context.uploadTtlDays ?? DEFAULT_UPLOAD_TTL_DAYS),
      blobSize: commitments.raw_data_size,
      encoding: erasureConfig.enumIndex,
    });
  } catch (error) {
    throw new ShelbyStorageError("UPLOAD_FAILED", "Could not build the Shelby blob registration transaction", error);
  }

  reportProgress(context, "registering", 48, "Open Petra to register the Shelby blob");
  let submitted: { hash: string };
  try {
    submitted = await signAndSubmitTransaction({ data: payload });
  } catch (error) {
    throw new ShelbyStorageError("UPLOAD_FAILED", "Wallet failed before signing the Shelby blob registration", error);
  }

  reportProgress(context, "registering", 56, "Confirming Shelby blob registration on-chain");
  try {
    await (context.aptos ?? createAptosClient(context)).waitForTransaction({
      transactionHash: submitted.hash,
    });
  } catch (error) {
    throw new ShelbyStorageError("UPLOAD_FAILED", "Shelby blob registration transaction was not confirmed", error);
  }

  reportProgress(context, "uploading", 65, `Uploading ${blobName} to Shelby RPC`);
  try {
    await client.rpc.putBlob({
      account: accountAddress,
      blobName,
      blobData,
    });
  } catch (error) {
    throw new ShelbyStorageError("UPLOAD_FAILED", "Shelby RPC rejected the encrypted blob upload", error);
  }
}

async function generateBlobCommitments(blobData: ByteArray): Promise<BlobCommitments> {
  try {
    const provider = await createDefaultErasureCodingProvider();
    return (await generateCommitments(provider, blobData)) as BlobCommitments;
  } catch (error) {
    throw new ShelbyStorageError("UPLOAD_FAILED", "Could not prepare Shelby blob commitments in this browser", error);
  }
}

async function encryptFile(
  file: File,
  buyerPublicKey: CryptoKey,
): Promise<{ bytes: ByteArray; iv: string; encryptedKey: string }> {
  try {
    const contentKey = await crypto.subtle.generateKey(
      { name: "AES-GCM", length: 256 },
      true,
      ["encrypt", "decrypt"],
    );
    const iv = crypto.getRandomValues(new Uint8Array(new ArrayBuffer(12)));
    const plainBytes = new Uint8Array(await file.arrayBuffer());
    const encryptedBuffer = await crypto.subtle.encrypt(
      { name: "AES-GCM", iv: toArrayBuffer(iv) },
      contentKey,
      toArrayBuffer(plainBytes),
    );
    const rawContentKey = await crypto.subtle.exportKey("raw", contentKey);
    const encryptedKey = await crypto.subtle.encrypt(
      { name: "RSA-OAEP" },
      buyerPublicKey,
      rawContentKey,
    );

    return {
      bytes: new Uint8Array(encryptedBuffer),
      iv: base64UrlEncode(iv),
      encryptedKey: base64UrlEncode(new Uint8Array(encryptedKey)),
    };
  } catch (error) {
    throw new ShelbyStorageError("CRYPTO_ERROR", "Failed to encrypt dataset before Shelby upload", error);
  }
}

async function decryptBytes(
  encryptedBytes: ByteArray,
  iv: string,
  encryptedKey: string,
  context: ShelbyStorageContext,
): Promise<ByteArray> {
  if (!context.buyerPrivateKey) {
    throw new ShelbyStorageError("CONFIGURATION_ERROR", "A buyer private encryption key is required for download");
  }

  try {
    const rawContentKey = await crypto.subtle.decrypt(
      { name: "RSA-OAEP" },
      context.buyerPrivateKey,
      toArrayBuffer(base64UrlDecode(encryptedKey)),
    );
    const contentKey = await crypto.subtle.importKey(
      "raw",
      rawContentKey,
      { name: "AES-GCM" },
      false,
      ["decrypt"],
    );
    const plainBuffer = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: toArrayBuffer(base64UrlDecode(iv)) },
      contentKey,
      toArrayBuffer(encryptedBytes),
    );

    return new Uint8Array(plainBuffer);
  } catch (error) {
    throw new ShelbyStorageError("CRYPTO_ERROR", "Failed to decrypt Shelby dataset payload", error);
  }
}

async function verifyAccess(
  storageId: string,
  accessProof: string,
  context: ShelbyStorageContext,
): Promise<boolean> {
  if (context.verifyAccessProof) {
    return context.verifyAccessProof(storageId, accessProof);
  }

  const proof = decodeAccessProof(accessProof);
  return proof.storage_id === storageId && proof.expires_at > Date.now();
}

async function fetchManifest(storage: StorageIdPayload): Promise<StashStorageManifest> {
  const context = getFetchContext();
  const blob = await fetchShelbyBlob(storage.owner, storage.manifestBlobName, context);
  const text = await blob.text();
  const decoded = parseJson<StashStorageManifest>(text);

  if (decoded.kind !== "stash.dataset.manifest" || decoded.version !== 1) {
    throw new ShelbyStorageError("METADATA_NOT_FOUND", "Shelby metadata manifest is not a Stash dataset manifest");
  }

  return decoded;
}

async function fetchShelbyBlob(
  owner: string,
  blobName: string,
  context: ShelbyFetchContext,
): Promise<Blob> {
  const controller = new AbortController();
  const timeout = window.setTimeout(
    () => controller.abort(),
    context.downloadTimeoutMs ?? DEFAULT_DOWNLOAD_TIMEOUT_MS,
  );

  try {
    const requestInit: RequestInit = { signal: controller.signal };
    if (context.apiKey) {
      requestInit.headers = { Authorization: `Bearer ${context.apiKey}` };
    }

    const response = await fetch(createDownloadUrl(owner, blobName, context), requestInit);

    if (response.status === 403) {
      throw new ShelbyStorageError("ACCESS_DENIED", "Shelby RPC rejected the download request");
    }
    if (response.status === 404) {
      throw new ShelbyStorageError("METADATA_NOT_FOUND", "Requested Shelby blob was not found");
    }
    if (!response.ok) {
      throw new ShelbyStorageError("NETWORK_ERROR", `Shelby RPC returned HTTP ${response.status}`);
    }

    return response.blob();
  } catch (error) {
    if (error instanceof ShelbyStorageError) {
      throw error;
    }
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new ShelbyStorageError("DOWNLOAD_TIMEOUT", "Shelby download timed out", error);
    }
    throw new ShelbyStorageError("NETWORK_ERROR", "Shelby download failed", error);
  } finally {
    window.clearTimeout(timeout);
  }
}

function createDownloadUrl(owner: string, blobName: string, context: ShelbyStorageContext): string {
  const rpcUrl = stripTrailingSlash(context.rpcUrl ?? shelbyRpcUrl());
  const encodedBlobName = blobName.split("/").map(encodeURIComponent).join("/");
  return `${rpcUrl}/v1/blobs/${encodeURIComponent(owner)}/${encodedBlobName}`;
}

function normalizeMetadata(file: File, metadata: DatasetMetadata): DatasetMetadata {
  return {
    ...metadata,
    size: metadata.size || file.size,
    format: metadata.format || file.type || "application/octet-stream",
    created_at: metadata.created_at || Date.now(),
  };
}

function validateMetadata(metadata: DatasetMetadata): void {
  if (!metadata.title.trim()) {
    throw new ShelbyStorageError("VALIDATION_ERROR", "Dataset title is required");
  }
  if (!metadata.category.trim()) {
    throw new ShelbyStorageError("VALIDATION_ERROR", "Dataset category is required");
  }
  if (metadata.size <= 0) {
    throw new ShelbyStorageError("VALIDATION_ERROR", "Dataset file size must be greater than zero");
  }
}

function encodeStorageId(payload: StorageIdPayload): string {
  return `stash:v1:${base64UrlEncode(encodeJson(payload))}`;
}

function parseStorageId(storageId: string): StorageIdPayload {
  if (!storageId.startsWith("stash:v1:")) {
    throw new ShelbyStorageError("VALIDATION_ERROR", "Invalid Stash storage id");
  }

  return parseJson<StorageIdPayload>(TEXT_DECODER.decode(base64UrlDecode(storageId.slice("stash:v1:".length))));
}

function decodeAccessProof(accessProof: string): AccessProofPayload {
  try {
    return parseJson<AccessProofPayload>(TEXT_DECODER.decode(base64UrlDecode(accessProof)));
  } catch (error) {
    throw new ShelbyStorageError("ACCESS_DENIED", "Access proof is malformed", error);
  }
}

function parseJson<T>(json: string): T {
  try {
    return JSON.parse(json) as T;
  } catch (error) {
    throw new ShelbyStorageError("VALIDATION_ERROR", "Failed to parse JSON payload", error);
  }
}

function encodeJson(value: object): ByteArray {
  return TEXT_ENCODER.encode(JSON.stringify(value));
}

function createBlobName(prefix: "files" | "metadata", fileName: string): string {
  const id = crypto.randomUUID();
  const safeName = fileName.replace(/[^a-zA-Z0-9._-]/g, "-");
  return `stash/${prefix}/${id}-${safeName}`;
}

function expirationMicros(ttlDays: number): number {
  return (Date.now() + ttlDays * 24 * 60 * 60 * 1000) * 1000;
}

function requireContext(): ShelbyStorageContext {
  if (!storageContext) {
    throw new ShelbyStorageError("CONFIGURATION_ERROR", "Shelby storage context has not been configured");
  }
  return storageContext;
}

function requireClient(): ShelbyClient {
  if (!shelbyClient) {
    throw new ShelbyStorageError("CONFIGURATION_ERROR", "Shelby client has not been configured");
  }
  return shelbyClient;
}

function requireAccountAddress(context: ShelbyStorageContext): string {
  if (!context.accountAddress) {
    throw new ShelbyStorageError("CONFIGURATION_ERROR", "A wallet account address is required for Shelby upload");
  }
  return context.accountAddress;
}

function requireSignAndSubmitTransaction(context: ShelbyStorageContext): SignAndSubmitTransaction {
  if (!context.signAndSubmitTransaction) {
    throw new ShelbyStorageError("CONFIGURATION_ERROR", "A wallet transaction signer is required for Shelby upload");
  }
  return context.signAndSubmitTransaction;
}

function getFetchContext(): ShelbyFetchContext {
  const context: ShelbyFetchContext = {};
  const apiKey = storageContext?.apiKey ?? import.meta.env.VITE_SHELBY_API_KEY;
  const rpcUrl = storageContext?.rpcUrl ?? shelbyRpcUrl();

  if (apiKey) {
    context.apiKey = apiKey;
  }
  if (rpcUrl) {
    context.rpcUrl = rpcUrl;
  }
  if (storageContext?.downloadTimeoutMs !== undefined) {
    context.downloadTimeoutMs = storageContext.downloadTimeoutMs;
  }

  return context;
}

function createAptosClient(context: ShelbyStorageContext): Aptos {
  return new Aptos(
    new AptosConfig(context.network ? { network: context.network } : aptosClientConfig()),
  );
}

function resolveShelbyNetwork(): ShelbyNetwork {
  const configured = resolveAptosNetwork();
  if (configured === Network.SHELBYNET) {
    return Network.SHELBYNET;
  }
  if (configured === Network.LOCAL) {
    return Network.LOCAL;
  }
  return Network.TESTNET;
}

function reportProgress(
  context: ShelbyStorageContext,
  stage: UploadProgress["stage"],
  percent: number,
  message: string,
): void {
  context.onProgress?.({ stage, percent, message });
}

async function withRetry<T>(
  operation: () => Promise<T>,
  retries: number,
  code: ShelbyStorageErrorCode,
): Promise<T> {
  let attempt = 0;
  let lastError: unknown;

  while (attempt <= retries) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      if (error instanceof ShelbyStorageError && error.code === "VALIDATION_ERROR") {
        throw error;
      }
      attempt += 1;
      if (attempt <= retries) {
        await delay(2 ** attempt * 500);
      }
    }
  }

  throw new ShelbyStorageError(code, describeRetriedFailure(code, lastError), lastError);
}

function describeRetriedFailure(code: ShelbyStorageErrorCode, error: unknown): string {
  const reason = getNestedErrorMessage(error);
  const prefix = code === "UPLOAD_FAILED" ? "Shelby upload failed" : "Shelby operation failed";
  return reason ? `${prefix}: ${reason}` : `${prefix} after retries`;
}

function getNestedErrorMessage(error: unknown): string | null {
  if (error instanceof Error && error.message.trim()) {
    const cause = getNestedErrorMessage(error.cause);
    return cause && cause !== error.message ? `${error.message}: ${cause}` : error.message;
  }
  if (typeof error === "string" && error.trim()) {
    return error;
  }
  if (typeof error === "object" && error !== null) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === "string" && message.trim()) {
      const cause = getNestedErrorMessage((error as { cause?: unknown }).cause);
      return cause && cause !== message ? `${message}: ${cause}` : message;
    }
  }
  return null;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

function base64UrlEncode(bytes: Uint8Array): string {
  let binary = "";
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return window.btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function base64UrlDecode(value: string): ByteArray {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(value.length / 4) * 4, "=");
  const binary = window.atob(padded);
  const bytes = new Uint8Array(new ArrayBuffer(binary.length));
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

function toByteArray(bytes: Uint8Array): ByteArray {
  return new Uint8Array(toArrayBuffer(bytes));
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}

function stripTrailingSlash(value: string): string {
  return value.endsWith("/") ? value.slice(0, -1) : value;
}
