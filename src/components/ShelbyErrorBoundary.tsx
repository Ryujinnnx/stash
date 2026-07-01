import { Component, type ErrorInfo, type ReactNode } from "react";
import type { ShelbyStorageError } from "../lib/shelby";
import { Button } from "./ui/Button";

interface ShelbyErrorBoundaryProps {
  children: ReactNode;
  fallback?: (error: ShelbyStorageError, reset: () => void) => ReactNode;
  resetKey?: string;
}

interface ShelbyErrorBoundaryState {
  error: ShelbyStorageError | null;
}

export class ShelbyErrorBoundary extends Component<ShelbyErrorBoundaryProps, ShelbyErrorBoundaryState> {
  state: ShelbyErrorBoundaryState = {
    error: null,
  };

  static getDerivedStateFromError(error: Error): ShelbyErrorBoundaryState {
    return {
      error: normalizeBoundaryError(error),
    };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error("Shelby storage boundary caught an error", { error, componentStack: info.componentStack });
  }

  componentDidUpdate(previousProps: ShelbyErrorBoundaryProps): void {
    if (this.state.error && previousProps.resetKey !== this.props.resetKey) {
      this.reset();
    }
  }

  render(): ReactNode {
    const { children, fallback } = this.props;
    const { error } = this.state;

    if (!error) {
      return children;
    }

    if (fallback) {
      return fallback(error, this.reset);
    }

    return (
      <main className="min-h-screen bg-bg px-5 py-24 text-t1">
        <section className="mx-auto flex max-w-xl flex-col items-center gap-5 rounded-2xl border border-[var(--border)] bg-raised p-8 text-center shadow-lg">
          <div className="flex h-11 w-11 items-center justify-center rounded-full bg-[var(--error-soft)] font-mono text-sm text-error">
            !
          </div>
          <div className="grid gap-2">
            <h1 className="font-display text-2xl text-t1">This screen stopped rendering</h1>
            <p className="font-body text-sm font-light leading-relaxed text-t2">
              Stash caught a client-side error before it could break the whole app. Try again, or open another page from the navigation.
            </p>
          </div>
          <code className="max-w-full overflow-hidden text-ellipsis rounded-lg border border-[var(--border)] bg-bg px-3 py-2 font-mono text-xs text-t3">
            {error.message || error.code}
          </code>
          <Button variant="secondary" size="sm" onClick={this.reset}>
            Try again
          </Button>
        </section>
      </main>
    );
  }

  private reset = (): void => {
    this.setState({ error: null });
  };
}

function normalizeBoundaryError(error: Error): ShelbyStorageError {
  if ("code" in error) {
    return error as ShelbyStorageError;
  }

  return Object.assign(error, {
    code: "NETWORK_ERROR" as const,
  });
}
