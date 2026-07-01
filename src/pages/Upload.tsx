import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { AnimatePresence, motion, type Variants } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { useWallet } from "@aptos-labs/wallet-adapter-react";
import { Aptos, AptosConfig } from "@aptos-labs/ts-sdk";
import { clsx } from "clsx";
import {
  FileArchive,
  FileText,
  Globe,
  Image,
  Info,
  Lock,
  Music,
  UploadCloud,
  Video,
  Wallet,
  X,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useMarketplaceActions } from "../hooks/useMarketplace";
import { useUpload } from "../hooks/useShelby";
import { formatBytes, parseAptToOctas } from "../lib/format";
import { aptosClientConfig } from "../lib/network";
import type { DatasetMetadata } from "../lib/shelby";
import type { UploadProgress } from "../lib/shelby";
import { hasConnectedAccount } from "../lib/wallet";
import { Button } from "../components/ui/Button";
import { Input } from "../components/ui/Input";
import { useToast } from "../components/ui/useToast";
import { TxStage, type TxStageState } from "../components/tx/TxStage";
import { TxStepIndicator } from "../components/tx/TxStepIndicator";
import { TxSuccessAnimation } from "../components/tx/TxSuccessAnimation";
import { WalletButton } from "../components/layout/Nav";

type UploadStep = 0 | 1 | 2 | 3 | 4;
type AccessType = "public" | "gated" | "paid";
type Currency = "APT" | "ShelbyUSD";
type PublishPhase = "idle" | "shelby" | "signature" | "confirming" | "done" | "error";
type PublishStage = "shelby" | "signature" | "confirming";
type StepDirection = "forward" | "back";

interface MetadataDraft {
  title: string;
  description: string;
  cover: File | null;
}

interface PricingDraft {
  accessType: AccessType;
  price: string;
  currency: Currency;
}

interface PublishedReceipt {
  blobId: string;
  txHash: string;
  listingId: string | null;
}

interface AccessOption {
  value: AccessType;
  icon: LucideIcon;
  title: string;
  description: string;
}

const steps = ["Files", "Metadata", "Pricing", "Review", "Publishing"];
const motionEase = [0.16, 1, 0.3, 1] as const;

const stepTransition: Variants = {
  hidden: (direction: StepDirection) => ({
    opacity: 0,
    x: direction === "forward" ? 24 : -24,
    filter: "blur(4px)",
  }),
  visible: {
    opacity: 1,
    x: 0,
    filter: "blur(0px)",
    transition: { duration: 0.45, ease: motionEase },
  },
  exit: (direction: StepDirection) => ({
    opacity: 0,
    x: direction === "forward" ? -24 : 24,
    filter: "blur(4px)",
    transition: { duration: 0.25, ease: [0.7, 0, 0.84, 0] },
  }),
};

const accessOptions: AccessOption[] = [
  {
    value: "public",
    icon: Globe,
    title: "Public",
    description: "Anyone can access for free",
  },
  {
    value: "gated",
    icon: Lock,
    title: "Gated",
    description: "Only wallets you approve",
  },
  {
    value: "paid",
    icon: Wallet,
    title: "Paid",
    description: "Buyers pay once to download",
  },
];

const initialMetadata: MetadataDraft = {
  title: "",
  description: "",
  cover: null,
};

const initialPricing: PricingDraft = {
  accessType: "paid",
  price: "0.25",
  currency: "APT",
};

export function Upload() {
  const navigate = useNavigate();
  const wallet = useWallet();
  const toast = useToast();
  const upload = useUpload();
  const marketplace = useMarketplaceActions();
  const [step, setStep] = useState<UploadStep>(0);
  const direction = useRef<StepDirection>("forward");
  const [files, setFiles] = useState<File[]>([]);
  const [metadata, setMetadata] = useState<MetadataDraft>(initialMetadata);
  const [pricing, setPricing] = useState<PricingDraft>(initialPricing);
  const [publishPhase, setPublishPhase] = useState<PublishPhase>("idle");
  const [failedStage, setFailedStage] = useState<PublishStage | null>(null);
  const [publishError, setPublishError] = useState<string | null>(null);
  const [receipt, setReceipt] = useState<PublishedReceipt | null>(null);

  const coverUrl = useObjectUrl(metadata.cover);
  const totalSize = useMemo(() => files.reduce((total, file) => total + file.size, 0), [files]);
  const metadataValidation = validateMetadata(metadata);
  const pricingValidation = validatePricing(pricing);
  const walletConnected = hasConnectedAccount(wallet.connected, wallet.account);
  const canContinueFiles = files.length > 0;
  const canContinueMetadata = metadataValidation.valid;
  const canContinuePricing = pricingValidation.valid;
  const canPublish = canContinueFiles && canContinueMetadata && canContinuePricing && publishPhase !== "shelby" && publishPhase !== "signature" && publishPhase !== "confirming";

  function goToStep(nextStep: UploadStep) {
    direction.current = nextStep >= step ? "forward" : "back";
    setStep(nextStep);
  }

  async function publishDataset() {
    if (!canPublish) {
      setPublishError("Complete each step before publishing.");
      return;
    }

    if (!walletConnected) {
      toast.info("Connect wallet first", "Choose an Aptos wallet in the review step, then publish again.");
      return;
    }

    goToStep(4);
    setReceipt(null);
    setFailedStage(null);
    setPublishError(null);
    let activeStage: PublishStage = "shelby";
    setPublishPhase("shelby");

    try {
      const payloadFile = await createUploadPayload(files, metadata.title);
      const datasetMetadata = createDatasetMetadata(files, payloadFile, metadata, pricing);
      const accessKey = await createLocalAccessKey();
      const storageId = await upload.upload({ file: payloadFile, metadata: datasetMetadata, buyerPublicKey: accessKey.publicKey });
      sessionStorage.setItem(`stash:access-key:${storageId}`, accessKey.privateKey);

      activeStage = "signature";
      setPublishPhase("signature");
      const transaction = await marketplace.createListing.mutateAsync({
        storageId,
        metadata: datasetMetadata,
        priceOctas: priceToOctas(pricing),
      });

      activeStage = "confirming";
      setPublishPhase("confirming");
      const txHash = transaction.hash ?? "";
      const listingId = txHash ? await resolveListingIdFromTransaction(txHash) : null;
      await delay(2000);

      setReceipt({ blobId: storageId, txHash: txHash || "pending wallet receipt", listingId });
      setPublishPhase("done");
      toast.success("Dataset published", "Stash registered your Shelby-backed listing on Aptos.");
    } catch (error) {
      const message = getErrorMessage(error, "Check your wallet, file, and pricing fields, then try again.");
      setFailedStage(activeStage);
      setPublishError(message);
      setPublishPhase("error");
      toast.error("Publishing stopped", message);
    }
  }

  function copyShareLink() {
    const path = receipt?.listingId ? `/dataset/${receipt.listingId}` : "/marketplace";
    const href = `${window.location.origin}${path}`;
    void navigator.clipboard?.writeText(href).then(() => {
      toast.success("Link copied", "Share link is ready.");
    });
  }

  function navigateToDataset() {
    if (receipt?.listingId) {
      navigate(`/dataset/${receipt.listingId}`);
      return;
    }
    navigate("/marketplace");
  }

  return (
    <section className="mx-auto max-w-2xl px-5 py-12">
      <TxStepIndicator steps={steps} current={step} />

      <AnimatePresence mode="wait" custom={direction.current}>
        {step === 0 && (
          <StepFrame key="files" direction={direction.current}>
            <FilesStep files={files} setFiles={setFiles} onContinue={() => goToStep(1)} canContinue={canContinueFiles} />
          </StepFrame>
        )}

        {step === 1 && (
          <StepFrame key="metadata" direction={direction.current}>
            <MetadataStep
              metadata={metadata}
              setMetadata={setMetadata}
              coverUrl={coverUrl}
              validation={metadataValidation}
              onBack={() => goToStep(0)}
              onContinue={() => goToStep(2)}
            />
          </StepFrame>
        )}

        {step === 2 && (
          <StepFrame key="pricing" direction={direction.current}>
            <PricingStep
              pricing={pricing}
              setPricing={setPricing}
              validation={pricingValidation}
              onBack={() => goToStep(1)}
              onContinue={() => goToStep(3)}
            />
          </StepFrame>
        )}

        {step === 3 && (
          <StepFrame key="review" direction={direction.current}>
            <ReviewStep
              files={files}
              metadata={metadata}
              pricing={pricing}
              coverUrl={coverUrl}
              totalSize={totalSize}
              canPublish={canPublish}
              walletConnected={walletConnected}
              onBack={() => goToStep(2)}
              onPublish={() => void publishDataset()}
            />
          </StepFrame>
        )}

        {step === 4 && (
          <StepFrame key="publishing" direction={direction.current}>
            <PublishingStep
              phase={publishPhase}
              progress={upload.progress}
              error={publishError}
              receipt={receipt}
              failedStage={failedStage}
              onRetry={() => {
                void publishDataset();
              }}
              onBack={() => goToStep(3)}
              onViewDataset={navigateToDataset}
              onCopyLink={copyShareLink}
            />
          </StepFrame>
        )}
      </AnimatePresence>
    </section>
  );
}

function StepFrame({ children, direction }: { children: ReactNode; direction: StepDirection }) {
  return (
    <motion.div custom={direction} variants={stepTransition} initial="hidden" animate="visible" exit="exit">
      {children}
    </motion.div>
  );
}

function StepHeading({ eyebrow, title, subtitle }: { eyebrow: string; title: string; subtitle: string }) {
  return (
    <header className="mb-10 max-w-[44ch]">
      <p className="mb-3 font-mono text-[10px] uppercase tracking-[0.1em] text-accent">{eyebrow}</p>
      <h2 className="mb-2.5 font-display text-[clamp(26px,4vw,36px)] font-normal leading-[1.05] tracking-[-0.03em] text-t1">
        {title}
      </h2>
      <p className="font-body text-[14px] font-light leading-[1.6] text-t2">{subtitle}</p>
    </header>
  );
}

function FilesStep({
  files,
  setFiles,
  canContinue,
  onContinue,
}: {
  files: File[];
  setFiles: (files: File[]) => void;
  canContinue: boolean;
  onContinue: () => void;
}) {
  const [isDragging, setIsDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  function addFiles(fileList: FileList | null) {
    if (!fileList) {
      return;
    }
    const incoming = Array.from(fileList);
    const merged = [...files];
    incoming.forEach((file) => {
      const exists = merged.some((current) => current.name === file.name && current.size === file.size && current.lastModified === file.lastModified);
      if (!exists) {
        merged.push(file);
      }
    });
    setFiles(merged);
  }

  return (
    <div>
      <StepHeading
        eyebrow="Step 01"
        title="Files"
        subtitle="Add the dataset or model artifacts buyers will receive after access is verified."
      />

      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        onDragEnter={(event) => {
          event.preventDefault();
          setIsDragging(true);
        }}
        onDragOver={(event) => {
          event.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={(event) => {
          event.preventDefault();
          if (event.currentTarget === event.target) {
            setIsDragging(false);
          }
        }}
        onDrop={(event) => {
          event.preventDefault();
          setIsDragging(false);
          addFiles(event.dataTransfer.files);
        }}
        data-dragging={isDragging ? "true" : "false"}
        className={clsx(
          "stash-drop-zone relative flex w-full cursor-pointer flex-col items-center gap-3 overflow-hidden rounded-[var(--r-2xl)]",
          "border-[1.5px] border-dashed border-[rgba(255,255,255,0.1)] bg-raised px-10 py-[72px] text-center",
          "transition-all duration-[250ms] ease-expo",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg",
        )}
      >
        <span className="upload-drop-icon relative z-[1] mb-1 flex h-12 w-12 items-center justify-center rounded-[var(--r-lg)] border border-[var(--border)] bg-high transition-all duration-[250ms] ease-expo">
          <UploadCloud className="h-[22px] w-[22px] text-t3 transition-[color,filter] duration-[250ms] ease-expo" aria-hidden="true" />
        </span>
        <span className="relative z-[1] font-body text-[16px] font-normal tracking-[-0.01em] text-t1">Drop your files here</span>
        <span className="relative z-[1] font-body text-[13px] font-light text-t3">
          or <span className="text-accent underline underline-offset-2">browse</span> to select
        </span>
        <span className="relative z-[1] mt-1 font-mono text-[10px] uppercase tracking-wide text-t4">
          CSV / JSON / Parquet / ZIP / ONNX / Safetensors
        </span>
        <input
          ref={inputRef}
          type="file"
          multiple
          className="sr-only"
          onChange={(event) => addFiles(event.target.files)}
        />
      </button>

      <div className="mt-3 flex flex-col gap-1.5">
        <AnimatePresence initial={false}>
          {files.map((file) => (
            <motion.div
              key={`${file.name}-${file.size}-${file.lastModified}`}
              layout
              initial={{ x: -16, opacity: 0 }}
              animate={{ x: 0, opacity: 1, height: "auto" }}
              exit={{
                x: 16,
                opacity: 0,
                height: 0,
                paddingTop: 0,
                paddingBottom: 0,
                transition: { duration: 0.2, ease: [0.7, 0, 0.84, 0] },
              }}
              transition={{ duration: 0.3, ease: motionEase }}
              className="flex items-center gap-3 overflow-hidden rounded-[var(--r-lg)] border border-[var(--border)] bg-raised p-3.5 transition-colors duration-150 ease-expo hover:border-[var(--border-h)]"
            >
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[var(--r)] border border-[var(--border)] bg-high">
                <FileIcon file={file} />
              </div>
              <p className="min-w-0 flex-1 truncate font-body text-[13px] font-normal text-t1">{file.name}</p>
              <p className="shrink-0 font-mono text-[11px] text-t3 [font-feature-settings:'tnum'_1]">{formatBytes(file.size)}</p>
              <button
                type="button"
                onClick={() => setFiles(files.filter((current) => current !== file))}
                className="rounded-[var(--r-sm)] p-1.5 text-t3 transition-[background-color,color] duration-150 ease-expo hover:bg-[var(--error-soft)] hover:text-error focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
                aria-label={`Remove ${file.name}`}
              >
                <X className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      <div className="mt-8 flex justify-end">
        <Button className="w-full sm:w-auto" disabled={!canContinue} onClick={onContinue}>
          Continue
        </Button>
      </div>
    </div>
  );
}

function MetadataStep({
  metadata,
  setMetadata,
  coverUrl,
  validation,
  onBack,
  onContinue,
}: {
  metadata: MetadataDraft;
  setMetadata: (metadata: MetadataDraft) => void;
  coverUrl: string | null;
  validation: ValidationResult;
  onBack: () => void;
  onContinue: () => void;
}) {
  const coverInputRef = useRef<HTMLInputElement>(null);

  return (
    <div>
      <StepHeading
        eyebrow="Step 02"
        title="Metadata"
        subtitle="Give buyers enough context to understand the asset before they pay."
      />

      <div className="grid gap-5">
        <Input
          label="Title"
          value={metadata.title}
          onChange={(event) => setMetadata({ ...metadata, title: event.target.value })}
          placeholder="A clear, descriptive title"
          {...(validation.field === "title" && validation.message ? { error: validation.message } : {})}
        />

        <TextAreaField
          label="Description"
          value={metadata.description}
          onChange={(value) => setMetadata({ ...metadata, description: value })}
          placeholder="What's in this dataset?"
        />

        <div>
          <div className="mb-1.5 flex items-center">
            <label className="font-body text-sm font-medium text-t1">Cover image</label>
            <span className="ml-2 font-mono text-2xs uppercase text-t3">Optional</span>
          </div>
          <button
            type="button"
            onClick={() => coverInputRef.current?.click()}
            className={clsx(
              "flex h-40 w-full items-center justify-center overflow-hidden rounded-xl border border-dashed border-[var(--border)] bg-bg",
              "transition-all duration-200 ease-expo hover:border-[var(--border-hover)] hover:bg-raised",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg",
            )}
          >
            {coverUrl ? (
              <img src={coverUrl} alt="" className="h-full w-full object-cover" />
            ) : (
              <span className="flex flex-col items-center gap-2 text-center">
                <Image className="h-6 w-6 text-t3" aria-hidden="true" />
                <span className="font-body text-sm text-t2">Add a cover image</span>
              </span>
            )}
          </button>
          <input
            ref={coverInputRef}
            type="file"
            accept="image/*"
            className="sr-only"
            onChange={(event) => setMetadata({ ...metadata, cover: event.target.files?.item(0) ?? null })}
          />
        </div>
      </div>

      <StepActions
        onBack={onBack}
        onContinue={onContinue}
        continueDisabled={!validation.valid}
      />
    </div>
  );
}

function PricingStep({
  pricing,
  setPricing,
  validation,
  onBack,
  onContinue,
}: {
  pricing: PricingDraft;
  setPricing: (pricing: PricingDraft) => void;
  validation: ValidationResult;
  onBack: () => void;
  onContinue: () => void;
}) {
  const priceMessage = validation.field === "price" || validation.field === "currency" ? validation.message : undefined;

  function chooseAccessType(accessType: AccessType) {
    setPricing({ ...pricing, accessType });
  }

  function handleOptionKeyDown(event: KeyboardEvent<HTMLLabelElement>, accessType: AccessType) {
    if (event.key !== "Enter" && event.key !== " ") {
      return;
    }
    event.preventDefault();
    chooseAccessType(accessType);
  }

  return (
    <div>
      <StepHeading
        eyebrow="Step 03"
        title="Pricing"
        subtitle="Choose how access is enforced once the files are stored on Shelby."
      />

      <div className="flex flex-col gap-2" role="radiogroup" aria-label="Access type">
        {accessOptions.map((option) => {
          const selected = pricing.accessType === option.value;
          return (
            <label
              key={option.value}
              role="radio"
              aria-checked={selected}
              tabIndex={0}
              data-selected={selected ? "true" : "false"}
              onKeyDown={(event) => handleOptionKeyDown(event, option.value)}
              className="access-option flex cursor-pointer items-center gap-4 rounded-[var(--r-xl)] border-[1.5px] border-[var(--border)] px-5 py-[18px] text-left transition-all duration-[180ms] ease-expo focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
            >
              <input
                type="radio"
                name="access-type"
                value={option.value}
                checked={selected}
                onChange={() => chooseAccessType(option.value)}
              />
              <span className="access-option-icon flex h-10 w-10 shrink-0 items-center justify-center rounded-[var(--r-lg)] border border-[var(--border)] bg-high transition-all duration-[180ms] ease-expo">
                <option.icon className="h-[18px] w-[18px] text-t3 transition-colors duration-[180ms] ease-expo" aria-hidden="true" />
              </span>
              <span className="min-w-0 pr-7">
                <span className="mb-[3px] block font-display text-[15px] font-medium tracking-[-0.01em] text-t1">{option.title}</span>
                <span className="block font-body text-[12px] font-light leading-[1.5] text-t2">{option.description}</span>
              </span>
            </label>
          );
        })}
      </div>

      <AnimatePresence initial={false}>
        {pricing.accessType === "paid" && (
          <motion.div
            initial={{ height: 0, opacity: 0, y: -8 }}
            animate={{ height: "auto", opacity: 1, y: 0 }}
            exit={{ height: 0, opacity: 0, y: -8, transition: { duration: 0.2, ease: [0.7, 0, 0.84, 0] } }}
            transition={{ duration: 0.3, ease: motionEase }}
            className="overflow-hidden"
          >
            <div className="mt-3 rounded-[var(--r-xl)] border border-[var(--border)] bg-raised p-5">
              <label htmlFor="dataset-price" className="sr-only">
                Price
              </label>
              <div className="flex items-center gap-2">
                <input
                  id="dataset-price"
                  value={pricing.price}
                  inputMode="decimal"
                  aria-invalid={validation.field === "price"}
                  aria-describedby={priceMessage ? "dataset-price-error" : "dataset-price-help"}
                  onChange={(event) => setPricing({ ...pricing, price: event.target.value })}
                  className={clsx(
                    "h-10 min-w-0 flex-1 rounded-[var(--r)] border border-[var(--border)] bg-bg px-3 font-mono text-sm text-t1 outline-none placeholder:text-t3",
                    "transition-[background-color,border-color,box-shadow] duration-150 ease-expo hover:border-[var(--border-h)]",
                    "focus:border-[var(--border-focus)] focus:ring-2 focus:ring-accent/30",
                    validation.field === "price" && "border-error focus:border-error focus:ring-error/20",
                  )}
                />
                <CurrencyToggle value={pricing.currency} onChange={(currency) => setPricing({ ...pricing, currency })} />
              </div>
              <p id="dataset-price-help" className="mt-2 font-mono text-[11px] text-t3">
                Buyers pay once for permanent access
              </p>
              {priceMessage && (
                <p id="dataset-price-error" className="mt-2 font-body text-xs text-error">
                  {priceMessage}
                </p>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <StepActions
        onBack={onBack}
        onContinue={onContinue}
        continueDisabled={!validation.valid}
      />
    </div>
  );
}

function ReviewStep({
  files,
  metadata,
  pricing,
  coverUrl,
  totalSize,
  canPublish,
  walletConnected,
  onBack,
  onPublish,
}: {
  files: File[];
  metadata: MetadataDraft;
  pricing: PricingDraft;
  coverUrl: string | null;
  totalSize: number;
  canPublish: boolean;
  walletConnected: boolean;
  onBack: () => void;
  onPublish: () => void;
}) {
  const priceLabel = pricing.accessType === "paid" ? `${pricing.price} ${pricing.currency}` : "free";

  return (
    <div>
      <StepHeading
        eyebrow="Step 04"
        title="Review"
        subtitle="Confirm the listing details before the wallet and Shelby writes begin."
      />

      <div className="overflow-hidden rounded-2xl border border-[var(--border)] bg-raised">
        {coverUrl && <img src={coverUrl} alt="" className="aspect-video w-full object-cover" />}
        <div className="p-7">
          <h3 className="mb-2 font-display text-xl text-t1">{metadata.title}</h3>
          <p className="mb-4 font-body text-sm font-light text-t2">
            {metadata.description || "Buyer-facing description will be stored with the listing metadata."}
          </p>
          <div className="flex flex-wrap gap-3 font-mono text-xs text-t3">
            <span>{files.length} files</span>
            <span>{formatBytes(totalSize)}</span>
            <span>{pricing.accessType}</span>
            <span>{priceLabel}</span>
          </div>
        </div>
      </div>

      <div className="mt-5 flex items-start gap-3 rounded-xl border border-[var(--border)] bg-raised p-4">
        <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-t3" aria-hidden="true" />
        <p className="font-body text-sm font-light text-t3">
          <span className="font-medium text-t1">Two signatures required.</span> First to upload to Shelby, then to register on Aptos.
        </p>
      </div>

      <div className="mt-8 grid gap-3">
        {walletConnected ? (
          <Button size="lg" className="w-full" disabled={!canPublish} onClick={onPublish}>
            Publish dataset
          </Button>
        ) : (
          <WalletButton fullWidth />
        )}
        <Button variant="ghost" className="w-full" onClick={onBack}>
          Back
        </Button>
      </div>
    </div>
  );
}

function PublishingStep({
  phase,
  progress,
  error,
  receipt,
  failedStage,
  onRetry,
  onBack,
  onViewDataset,
  onCopyLink,
}: {
  phase: PublishPhase;
  progress: UploadProgress;
  error: string | null;
  receipt: PublishedReceipt | null;
  failedStage: PublishStage | null;
  onRetry: () => void;
  onBack: () => void;
  onViewDataset: () => void;
  onCopyLink: () => void;
}) {
  const isDone = phase === "done" && receipt;
  const hasError = phase === "error";
  const shelbyProgressMessage = progress.stage === "idle" ? "Encrypting and uploading to Shelby" : progress.message;

  return (
    <div>
      <StepHeading
        eyebrow="Step 05"
        title={isDone ? "Published" : "Publishing"}
        subtitle={isDone ? "The listing is live on Stash." : "Keep this tab open while Stash writes to Shelby and Aptos."}
      />

      {isDone ? (
        <TxSuccessAnimation
          title="Dataset published"
          description="Live on Stash and accessible to buyers."
          actions={[
            { label: "View dataset", onClick: onViewDataset },
            { label: "Copy link", onClick: onCopyLink, variant: "secondary" },
          ]}
          details={[
            { label: "Blob ID", value: receipt.blobId },
            { label: "Tx Hash", value: receipt.txHash },
          ]}
        />
      ) : (
        <>
          <div
            className={clsx(
              "tx-stages mb-8 overflow-hidden rounded-[var(--r-2xl)] border border-[var(--border)]",
              hasError && "tx-stages-shake",
            )}
          >
            <TxStage
              stepNumber={1}
              state={stageState(phase, "shelby", failedStage)}
              title="Shelby upload"
              descriptions={{
                pending: "Waiting for encrypted payload",
                active: shelbyProgressMessage,
                done: "Stored on Shelby",
                error: "Shelby upload stopped",
              }}
              progress={progress.percent}
            />
            <TxStage
              stepNumber={2}
              state={stageState(phase, "signature", failedStage)}
              title="Wallet signature"
              descriptions={{
                pending: "Waiting for Shelby storage",
                active: "Check your wallet",
                done: "Listing transaction submitted",
                error: "Wallet signature failed",
              }}
            />
            <TxStage
              stepNumber={3}
              isLast
              state={stageState(phase, "confirming", failedStage)}
              title="Aptos confirmation"
              descriptions={{
                pending: "Waiting for wallet signature",
                active: "Confirming on-chain",
                done: "Aptos listing confirmed",
                error: "Aptos confirmation failed",
              }}
            />
          </div>

          {hasError && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2, duration: 0.28, ease: motionEase }}
              className="rounded-[var(--r-xl)] border border-[rgba(239,68,68,0.18)] bg-[var(--error-soft)] p-4"
            >
              <p className="font-body text-sm font-medium text-error">Publishing stopped</p>
              <p className="mt-1 font-body text-sm font-light text-t2">{error ?? "Review the listing and try again."}</p>
              <div className="mt-4 flex flex-col gap-3 sm:flex-row">
                <Button variant="secondary" size="sm" onClick={onRetry}>
                  Try again
                </Button>
                <Button variant="ghost" size="sm" onClick={onBack}>
                  Back to review
                </Button>
              </div>
            </motion.div>
          )}
        </>
      )}
    </div>
  );
}

function StepActions({
  onBack,
  onContinue,
  continueDisabled,
}: {
  onBack: () => void;
  onContinue: () => void;
  continueDisabled: boolean;
}) {
  return (
    <div className="mt-8 flex flex-col-reverse gap-3 sm:flex-row sm:justify-between">
      <Button variant="ghost" onClick={onBack}>
        Back
      </Button>
      <Button disabled={continueDisabled} onClick={onContinue}>
        Continue
      </Button>
    </div>
  );
}

function CurrencyToggle({ value, onChange }: { value: Currency; onChange: (currency: Currency) => void }) {
  return (
    <span className="flex shrink-0 overflow-hidden rounded-[var(--r)] border border-[var(--border)] bg-high">
      {(["APT", "ShelbyUSD"] as const).map((currency) => (
        <button
          key={currency}
          type="button"
          onClick={() => onChange(currency)}
          className={clsx(
            "px-[14px] py-[9px] font-mono text-[11px] uppercase tracking-[0.04em] transition-all duration-150 ease-expo",
            value === currency ? "bg-accent text-white" : "text-t2 hover:bg-raised hover:text-t1",
          )}
        >
          {currency}
        </button>
      ))}
    </span>
  );
}

function TextAreaField({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
}) {
  return (
    <div className="grid gap-2">
      <label className="font-body text-sm font-medium text-t1">{label}</label>
      <textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        rows={5}
        className={clsx(
          "w-full resize-none rounded-lg border border-[var(--border)] bg-bg px-3 py-2.5",
          "font-body text-sm text-t1 outline-none placeholder:text-t3",
          "transition-[background-color,border-color,box-shadow] duration-150 ease-expo hover:border-[var(--border-hover)]",
          "focus:border-[var(--border-focus)] focus:ring-2 focus:ring-accent/30",
        )}
      />
    </div>
  );
}

interface ValidationResult {
  valid: boolean;
  field?: "title" | "price" | "currency";
  message?: string;
}

function validateMetadata(metadata: MetadataDraft): ValidationResult {
  if (!metadata.title.trim()) {
    return { valid: false, field: "title", message: "Title is required before publishing." };
  }
  return { valid: true };
}

function validatePricing(pricing: PricingDraft): ValidationResult {
  if (pricing.accessType !== "paid") {
    return { valid: true };
  }
  if (pricing.currency === "ShelbyUSD") {
    return { valid: false, field: "currency", message: "Use APT for this contract publish." };
  }
  try {
    return parseAptToOctas(pricing.price) > 0
      ? { valid: true }
      : { valid: false, field: "price", message: "Price must be greater than zero." };
  } catch {
    return { valid: false, field: "price", message: "Use a valid APT amount with up to 8 decimals." };
  }
}

function FileIcon({ file }: { file: File }) {
  const format = inferFormat(file);
  const Icon = iconForFormat(format);
  return <Icon className={clsx("h-4 w-4", fileIconTone(format))} aria-hidden="true" />;
}

function iconForFormat(format: string): LucideIcon {
  const normalized = format.toLowerCase();
  if (["zip", "tar", "gz", "safetensors", "onnx"].includes(normalized)) {
    return FileArchive;
  }
  if (["png", "jpg", "jpeg", "webp", "gif", "svg"].includes(normalized)) {
    return Image;
  }
  if (["mp4", "mov", "webm", "avi", "mkv"].includes(normalized)) {
    return Video;
  }
  if (["mp3", "wav", "m4a", "flac", "ogg"].includes(normalized)) {
    return Music;
  }
  return FileText;
}

function fileIconTone(format: string): string {
  const normalized = format.toLowerCase();
  if (["csv", "json", "jsonl", "parquet"].includes(normalized)) {
    return "text-accent";
  }
  if (["png", "jpg", "jpeg", "webp", "gif", "svg"].includes(normalized)) {
    return "text-warning";
  }
  if (["mp4", "mov", "webm", "avi", "mkv"].includes(normalized)) {
    return "text-[#a78bfa]";
  }
  if (["mp3", "wav", "m4a", "flac", "ogg"].includes(normalized)) {
    return "text-success";
  }
  return "text-t3";
}

function createDatasetMetadata(files: File[], uploadFile: File, metadata: MetadataDraft, pricing: PricingDraft): DatasetMetadata {
  return {
    title: metadata.title.trim(),
    description: metadata.description.trim(),
    category: inferCategory(files),
    tags: [pricing.accessType, inferFormat(uploadFile)].filter(Boolean),
    size: files.reduce((total, file) => total + file.size, 0),
    format: inferFormat(uploadFile),
    created_at: Date.now(),
  };
}

async function createUploadPayload(files: File[], title: string): Promise<File> {
  if (files.length === 1 && files[0]) {
    return files[0];
  }
  return createTarFile(files, `${slugify(title) || "stash-dataset"}-bundle.tar`);
}

async function createTarFile(files: File[], name: string): Promise<File> {
  const parts: BlobPart[] = [];
  for (const file of files) {
    const bytes = new Uint8Array(await file.arrayBuffer());
    parts.push(toArrayBuffer(createTarHeader(file.name, bytes.byteLength)));
    parts.push(toArrayBuffer(bytes));
    const padding = tarPadding(bytes.byteLength);
    if (padding > 0) {
      parts.push(new ArrayBuffer(padding));
    }
  }
  parts.push(new ArrayBuffer(1024));
  return new File(parts, name, { type: "application/x-tar" });
}

function createTarHeader(name: string, size: number): Uint8Array {
  const header = new Uint8Array(512);
  writeTarString(header, 0, 100, name.replace(/^\/+/, "").slice(0, 100));
  writeTarString(header, 100, 8, "0000644");
  writeTarString(header, 108, 8, "0000000");
  writeTarString(header, 116, 8, "0000000");
  writeTarString(header, 124, 12, size.toString(8).padStart(11, "0"));
  writeTarString(header, 136, 12, Math.floor(Date.now() / 1000).toString(8).padStart(11, "0"));
  header.fill(32, 148, 156);
  header[156] = "0".charCodeAt(0);
  writeTarString(header, 257, 6, "ustar");
  writeTarString(header, 263, 2, "00");

  const checksum = header.reduce((total, byte) => total + byte, 0);
  writeTarString(header, 148, 8, checksum.toString(8).padStart(6, "0"));
  header[154] = 0;
  header[155] = 32;
  return header;
}

function writeTarString(buffer: Uint8Array, offset: number, length: number, value: string): void {
  const bytes = new TextEncoder().encode(value);
  buffer.set(bytes.slice(0, length), offset);
}

function tarPadding(size: number): number {
  const remainder = size % 512;
  return remainder === 0 ? 0 : 512 - remainder;
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}

interface LocalAccessKey {
  publicKey: CryptoKey;
  privateKey: string;
}

async function createLocalAccessKey(): Promise<LocalAccessKey> {
  const keyPair = await crypto.subtle.generateKey(
    {
      name: "RSA-OAEP",
      modulusLength: 2048,
      publicExponent: new Uint8Array([1, 0, 1]),
      hash: "SHA-256",
    },
    true,
    ["encrypt", "decrypt"],
  );
  const privateKey = await crypto.subtle.exportKey("pkcs8", keyPair.privateKey);
  return {
    publicKey: keyPair.publicKey,
    privateKey: base64UrlEncode(new Uint8Array(privateKey)),
  };
}

function base64UrlEncode(bytes: Uint8Array): string {
  let binary = "";
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return window.btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function priceToOctas(pricing: PricingDraft): number {
  return pricing.accessType === "paid" ? parseAptToOctas(pricing.price) : 0;
}

function inferCategory(files: File[]): string {
  return files.some((file) => ["onnx", "safetensors"].includes(inferFormat(file))) ? "model" : "dataset";
}

function inferFormat(file: File): string {
  const extension = file.name.split(".").pop()?.trim().toLowerCase();
  if (extension) {
    return extension;
  }
  if (file.type.includes("/")) {
    return file.type.split("/").at(-1)?.replace("x-", "") || "other";
  }
  return file.type || "other";
}

function slugify(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function stageState(phase: PublishPhase, stage: PublishStage, failedStage: PublishStage | null): TxStageState {
  const order: Record<PublishStage, number> = {
    shelby: 0,
    signature: 1,
    confirming: 2,
  };

  if (phase === "error") {
    if (!failedStage) {
      return stage === "shelby" ? "error" : "pending";
    }
    if (stage === failedStage) {
      return "error";
    }
    return order[stage] < order[failedStage] ? "done" : "pending";
  }

  const current = phase === "shelby" ? 0 : phase === "signature" ? 1 : phase === "confirming" ? 2 : phase === "done" ? 3 : -1;
  if (current > order[stage]) {
    return "done";
  }
  if (current === order[stage]) {
    return "active";
  }
  return "pending";
}

function useObjectUrl(file: File | null): string | null {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!file) {
      setUrl(null);
      return undefined;
    }
    const nextUrl = URL.createObjectURL(file);
    setUrl(nextUrl);
    return () => URL.revokeObjectURL(nextUrl);
  }, [file]);

  return url;
}

async function resolveListingIdFromTransaction(txHash: string): Promise<string | null> {
  const aptos = new Aptos(new AptosConfig(aptosClientConfig()));
  const transaction = await aptos.waitForTransaction({ transactionHash: txHash, options: { timeoutSecs: 20, checkSuccess: true } });
  return extractListingId(transaction);
}

function extractListingId(transaction: unknown): string | null {
  if (!isRecord(transaction) || !Array.isArray(transaction.events)) {
    return null;
  }
  for (const event of transaction.events) {
    if (!isRecord(event)) {
      continue;
    }
    const eventType = typeof event.type === "string" ? event.type : "";
    const data = isRecord(event.data) ? event.data : null;
    const listingId = data?.listing_id;
    if (eventType.includes("ListingCreatedEvent") && (typeof listingId === "string" || typeof listingId === "number")) {
      return listingId.toString();
    }
  }
  return null;
}

function getErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message) {
    const cause = getErrorMessage(error.cause, "");
    return cause && cause !== error.message ? `${error.message}: ${cause}` : error.message;
  }
  if (isRecord(error) && typeof error.message === "string") {
    const cause = getErrorMessage(error.cause, "");
    return cause && cause !== error.message ? `${error.message}: ${cause}` : error.message;
  }
  if (typeof error === "string" && error.trim()) {
    return error;
  }
  return fallback;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}
