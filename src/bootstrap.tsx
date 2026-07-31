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

export function mountStashApp(rootElement: HTMLElement): void {
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
}
