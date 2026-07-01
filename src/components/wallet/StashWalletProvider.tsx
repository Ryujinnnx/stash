import type { ReactNode } from "react";
import { AptosWalletAdapterProvider, type DappConfig } from "@aptos-labs/wallet-adapter-react";

interface StashWalletProviderProps {
  children: ReactNode;
  dappConfig: DappConfig;
}

export function StashWalletProvider({ children, dappConfig }: StashWalletProviderProps) {
  return (
    <AptosWalletAdapterProvider
      autoConnect={false}
      disableTelemetry
      dappConfig={dappConfig}
      onError={(error: unknown) => {
        if (import.meta.env.DEV) {
          console.warn("[Stash wallet adapter]", error);
        }
      }}
    >
      {children}
    </AptosWalletAdapterProvider>
  );
}
