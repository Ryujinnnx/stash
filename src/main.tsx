import "./polyfills";
import React from "react";
import ReactDOM from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Network } from "@aptos-labs/ts-sdk";
import { BrowserRouter } from "react-router-dom";
import { App } from "./App";
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

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
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
  </React.StrictMode>,
);
