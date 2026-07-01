# Stash Memory

This file preserves important context for future sessions when conversation context is compacted or lost.

## Current State

- Frontend/UI is roughly 88% complete.
- Landing page is roughly 90% complete.
- Core pages exist: landing, marketplace, upload, dataset detail, dashboard.
- Wallet connect is working with Petra.
- Smoke route checks previously returned 200 for:
  - `/`
  - `/marketplace`
  - `/upload`
  - `/dashboard`
  - `/dataset/1`
- Move tests previously passed 4/4 with `aptos move test --skip-fetch-latest-git-deps`.
- Shelbinet fullnode and GraphQL were reachable.
- Aptos testnet fullnode and GraphQL were reachable.

## Network Configuration

Default network is `shelbynet` when `VITE_APTOS_NETWORK` is missing.

Shelbinet defaults:
- Fullnode: `https://api.shelbynet.shelby.xyz/v1`
- Indexer: `https://api.shelbynet.shelby.xyz/v1/graphql`
- Shelby RPC: `https://api.shelbynet.shelby.xyz/shelby`

Testnet defaults:
- Fullnode: `https://api.testnet.aptoslabs.com/v1`
- Indexer: `https://api.testnet.aptoslabs.com/v1/graphql`
- Shelby RPC: `https://api.testnet.shelby.xyz/shelby`

Important env vars:
- `VITE_APTOS_NETWORK`
- `VITE_APTOS_FULLNODE_URL`
- `VITE_APTOS_INDEXER_URL`
- `VITE_APTOS_API_KEY`
- `VITE_SHELBY_RPC_URL`
- `VITE_SHELBY_API_KEY`
- `VITE_STASH_MODULE_ADDRESS`

No `.env.local` was present during the last checks.

## Last Shelby Upload Debugging

Original issues:
- Petra popup did not appear.
- Error was `process is not defined` inside Shelby SDK erasure coding.
- Fixed with browser-safe `process` and `Buffer` polyfills in `src/polyfills.ts`.

Next issue:
- `clay.wasm` was served as HTML, causing:
  - `WebAssembly.compile(): expected magic word 00 61 73 6d, found 3c 21 64 6f`
- Fixed in `vite.config.ts` by adding middleware to serve `@shelby-protocol/clay-codes/clay.wasm` and excluding Shelby packages from Vite optimizeDeps.

Latest issue:
- Upload reached Shelby RPC.
- Browser console showed:
  - `POST https://api.shelbynet.shelby.xyz/shelby/v1/multipart-uploads/...`
  - `500 Internal Server Error`
- This suggests the current blocker is Shelby RPC/config/API key/network/upload payload, not Geomi.

## Important UX Bug

When the user rejects wallet or upload fails, the dapp keeps retrying upload. Cause:
- `useUpload()` has TanStack retry.
- `uploadFile()` also has internal retry.
- Wallet reject/user cancel is not classified as non-retryable.

Desired behavior:
- Wallet reject: no retry.
- User cancel: no retry.
- Validation/config errors: no retry.
- Shelby RPC 500: limited retry with clear messaging and cancellation support.

## Geomi

Geomi is not currently integrated and has not been proven necessary. Do not assume Geomi is required. Verify Shelby docs and current RPC behavior first.

## Validation Habits

After code changes, run:
- `npm.cmd run typecheck`
- `npm.cmd run build`
- route smoke check with `Invoke-WebRequest` if dev server is running
- Move tests when touching contracts:
  - `aptos move test --skip-fetch-latest-git-deps`

## Working Style

User prefers direct Indonesian explanations. For implementation tasks, make changes rather than only proposing. Keep public UI real-data consistent and avoid mock/fallback public data.
