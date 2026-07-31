import "./polyfills";
import React from "react";
import ReactDOM from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Network } from "@aptos-labs/ts-sdk";
import { BrowserRouter } from "react-router-dom";
import { App } from "./App";
import { ShelbyErrorBoundary } from "./components/ShelbyErrorBoundary";
import { ToastViewport } from "./components/ui/Toast";
import { StashWalletProvider } from "./components/wallet/StashWalletProvider";
import { resolveAptosNetwork } from "./lib/network";
import "./styles.css";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

const aptosApiKeys: Partial<Record<Network, string>> = {};
if (import.meta.env.VITE_APTOS_API_KEY) {
  aptosApiKeys[resolveAptosNetwork()] = import.meta.env.VITE_APTOS_API_KEY;
}

if ("scrollRestoration" in window.history) {
  window.history.scrollRestoration = "manual";
}

const rootElement = document.getElementById("root");

try {
  if (!rootElement) {
    throw new Error("Stash root element was not found.");
  }

  ReactDOM.createRoot(rootElement).render(
    <React.StrictMode>
      <ShelbyErrorBoundary>
        <QueryClientProvider client={queryClient}>
          <StashWalletProvider
            dappConfig={{
              network: resolveAptosNetwork(),
              aptosApiKeys,
            }}
          >
            <BrowserRouter>
              <App />
              <ToastViewport />
            </BrowserRouter>
          </StashWalletProvider>
        </QueryClientProvider>
      </ShelbyErrorBoundary>
    </React.StrictMode>,
  );
} catch (error) {
  renderBootFailure(rootElement, error);
}

function renderBootFailure(rootElement: HTMLElement | null, error: unknown): void {
  const message = error instanceof Error && error.message ? error.message : "Stash could not start in this browser.";
  const target = rootElement ?? document.body;
  target.innerHTML = `
    <main style="min-height:100vh;background:#080810;color:#f0f0ff;display:grid;place-items:center;padding:24px;font-family:DM Sans,Inter,system-ui,sans-serif;">
      <section style="max-width:520px;border:1px solid rgba(255,255,255,.08);background:#0d0d1a;border-radius:20px;padding:28px;box-shadow:0 16px 48px rgba(0,0,0,.45);">
        <p style="margin:0 0 12px;color:#6366f1;font:500 10px/16px DM Mono,monospace;text-transform:uppercase;letter-spacing:.1em;">Stash runtime</p>
        <h1 style="margin:0 0 10px;font-size:24px;line-height:1.15;font-weight:500;letter-spacing:-.03em;">This deployment could not start</h1>
        <p style="margin:0 0 16px;color:rgba(240,240,255,.62);font-size:14px;line-height:1.6;">Refresh the page once. If it still fails, open DevTools and share the console error so the failing runtime module can be fixed.</p>
        <code style="display:block;overflow:hidden;text-overflow:ellipsis;color:rgba(240,240,255,.55);background:#080810;border:1px solid rgba(255,255,255,.06);border-radius:10px;padding:12px;font:12px/1.6 DM Mono,monospace;">${escapeHtml(message)}</code>
      </section>
    </main>`;
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"]/g, (character) => {
    switch (character) {
      case "&":
        return "&amp;";
      case "<":
        return "&lt;";
      case ">":
        return "&gt;";
      case '"':
        return "&quot;";
      default:
        return character;
    }
  });
}
