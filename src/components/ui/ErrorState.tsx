import { AlertCircle } from "lucide-react";
import { Button } from "./Button";

export interface ErrorStateProps {
  error?: unknown;
  onRetry?: () => void;
  title?: string;
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }
  if (typeof error === "object" && error !== null && "message" in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === "string" && message.trim()) {
      return message;
    }
  }
  return "Please try again.";
}

export function ErrorState({ error, onRetry, title = "Something went wrong" }: ErrorStateProps) {
  return (
    <div className="flex flex-col items-center gap-4 py-32 text-center">
      <AlertCircle className="h-9 w-9 text-t4" aria-hidden="true" />
      <div className="grid max-w-md gap-2">
        <h2 className="font-display text-xl text-t1">{title}</h2>
        <p className="font-body text-sm text-t2">{getErrorMessage(error)}</p>
      </div>
      {onRetry && (
        <Button variant="secondary" size="sm" onClick={onRetry}>
          Try again
        </Button>
      )}
    </div>
  );
}
