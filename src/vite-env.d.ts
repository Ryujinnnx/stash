/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_APTOS_NETWORK?: string;
  readonly VITE_APTOS_FULLNODE_URL?: string;
  readonly VITE_APTOS_API_KEY?: string;
  readonly VITE_APTOS_INDEXER_URL?: string;
  readonly VITE_STASH_MODULE_ADDRESS?: string;
  readonly VITE_STASH_GITHUB_URL?: string;
  readonly VITE_STASH_TWITTER_URL?: string;
  readonly VITE_STASH_DISCORD_URL?: string;
  readonly VITE_SHELBY_API_KEY?: string;
  readonly VITE_SHELBY_RPC_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
