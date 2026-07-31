<div align="center">

# Stash

**A decentralized dataset and AI model marketplace on Aptos.**

Stash is a wallet-native marketplace for publishing, buying, and accessing datasets or model artifacts without centralized custody. Files and metadata live on Shelby decentralized hot storage, while ownership, payments, revenue, and access control are enforced on Aptos.

[![Aptos](https://img.shields.io/badge/Aptos-Shelbynet-6366f1?style=for-the-badge)](https://aptos.dev)
[![Move](https://img.shields.io/badge/Move-Smart%20Contracts-080810?style=for-the-badge)](https://move-language.github.io/move/)
[![Shelby](https://img.shields.io/badge/Shelby-Hot%20Storage-121224?style=for-the-badge)](https://docs.shelby.xyz)
[![React](https://img.shields.io/badge/React%20%2B%20TypeScript-Production%20UI-0d0d1a?style=for-the-badge)](https://react.dev)

</div>

---

## Why Stash

AI datasets and model artifacts are valuable assets. Most platforms still depend on centralized hosting, account-level permissions, platform fees, and opaque takedown rules. Stash takes a different route:

- **Creators own the listing** through Aptos accounts and Move resources.
- **Files stay decentralized** through Shelby hot storage.
- **Access is paid and verifiable** through on-chain purchase and access records.
- **Revenue settlement is automatic** with protocol fees encoded in contract logic.
- **The UI is built for trust**: clear wallet states, transaction stages, and real loading/error states.

## Product Status

Stash is currently in active development and not yet production-ready.

| Area | Status |
| --- | --- |
| Frontend shell | Built |
| Wallet connection | Working with Petra |
| Upload flow UI | Built |
| Shelby SDK browser integration | Integrated |
| Move contract scaffold | Built |
| Marketplace pages | Built |
| Dashboard pages | Built |
| Full creator E2E | In progress |
| Full buyer E2E | In progress |
| Production deployment | Pending |

Current main blocker: Shelby RPC upload must be verified with the correct network/API-key/runtime configuration.

## Architecture

```mermaid
flowchart LR
  creator[Creator Wallet] --> ui[Stash React dApp]
  buyer[Buyer Wallet] --> ui

  ui --> wallet[Aptos Wallet Adapter]
  wallet --> petra[Petra / Aptos Wallets]

  ui --> shelby[Shelby SDK]
  shelby --> hot[Decentralized Hot Storage]

  ui --> aptos[Aptos Fullnode]
  aptos --> move[Move Contracts]

  move --> marketplace[marketplace.move]
  move --> payment[payment.move]
  move --> access[access.move]

  move --> indexer[Aptos Indexer GraphQL]
  indexer --> ui
```

### Storage Layer

Shelby stores encrypted dataset payloads and metadata manifests. Stash keeps a storage identifier on-chain, not the raw file.

### Contract Layer

Move modules define the marketplace behavior:

| Module | Responsibility |
| --- | --- |
| `marketplace.move` | Listing creation, price updates, delisting, listing events |
| `payment.move` | Purchases, escrow/revenue accounting, protocol fee logic |
| `access.move` | Buyer access grants and access verification |

### Indexing Layer

Aptos Indexer GraphQL is used for marketplace search, dataset pages, dashboard analytics, and event-driven state.

## Core Flows

### Creator Publish Flow

```mermaid
sequenceDiagram
  actor Creator
  participant UI as Stash dApp
  participant Shelby as Shelby Storage
  participant Wallet as Petra Wallet
  participant Aptos as Aptos Move Contracts
  participant Indexer as Aptos Indexer

  Creator->>UI: Select files and metadata
  UI->>UI: Encrypt file payload
  UI->>Shelby: Prepare blob commitments
  UI->>Wallet: Request Shelby registration signature
  Wallet->>Aptos: Submit blob registration
  UI->>Shelby: Upload encrypted blob and manifest
  UI->>Wallet: Request listing transaction
  Wallet->>Aptos: create_listing()
  Aptos->>Indexer: Emit listing events
  Indexer->>UI: Listing appears in marketplace
```

### Buyer Purchase Flow

```mermaid
sequenceDiagram
  actor Buyer
  participant UI as Stash dApp
  participant Wallet as Petra Wallet
  participant Aptos as Payment + Access Contracts
  participant Shelby as Shelby Storage

  Buyer->>UI: Open dataset detail
  UI->>Wallet: Request purchase signature
  Wallet->>Aptos: purchase(listing_id)
  Aptos->>Aptos: Grant access record
  UI->>Aptos: verify_access(buyer, listing_id)
  UI->>Shelby: Download encrypted file
  UI->>UI: Decrypt after access proof
```

## Tech Stack

| Layer | Technology |
| --- | --- |
| Frontend | Vite, React, TypeScript |
| Styling | Tailwind CSS, custom design tokens |
| Motion | Framer Motion, GSAP |
| Wallet | Aptos Wallet Adapter, Petra |
| Blockchain | Aptos, Move |
| Storage | Shelby SDK |
| Indexing | Aptos Indexer GraphQL |
| Build | Vite production build with Shelby WASM handling |

## Application Routes

| Route | Purpose |
| --- | --- |
| `/` | Landing page and protocol overview |
| `/marketplace` | Dataset discovery, filters, sorting, indexer-backed grid |
| `/upload` | Creator upload and publish flow |
| `/dataset/:id` | Dataset detail, purchase, access, download |
| `/dashboard` | Creator listings, revenue, transactions, analytics |

## Local Development

### Requirements

- Node.js 20+
- npm
- Aptos CLI
- Petra wallet for browser E2E testing

### Install

```bash
npm install
```

### Run Dev Server

```bash
npm run dev
```

### Typecheck

```bash
npm run typecheck
```

### Production Build

```bash
npm run build
```

### Move Compile / Test

```bash
aptos move compile
aptos move test --skip-fetch-latest-git-deps
```

## Environment Variables

Create `.env.local` for local dApp configuration.

```bash
VITE_APTOS_NETWORK=shelbynet
VITE_APTOS_FULLNODE_URL=https://api.shelbynet.shelby.xyz/v1
VITE_APTOS_INDEXER_URL=https://api.shelbynet.shelby.xyz/v1/graphql
VITE_SHELBY_RPC_URL=https://api.shelbynet.shelby.xyz/shelby
VITE_STASH_MODULE_ADDRESS=0x2d82e8802ab2a3fcce32df2f663a05efcbba9ae00d755b76d242dffb087a4a83

# Optional, depending on network/provider requirements
VITE_APTOS_API_KEY=
VITE_SHELBY_API_KEY=
```

Supported network names in the frontend:

- `shelbynet`
- `testnet`
- `devnet`
- `mainnet`
- `local`

When no network is configured, Stash defaults to `shelbynet`.

## Shelby Browser Notes

The Shelby SDK depends on browser-compatible polyfills and a WASM asset for erasure coding. This repo includes handling for:

- `Buffer` and `process` browser compatibility
- Shelby `clay.wasm` serving through Vite middleware
- Vite dependency optimization exclusions for Shelby packages
- Upload cancellation and non-retryable wallet rejection handling

## Reliability Rules

Stash treats transaction and storage flows as first-class UX:

- Wallet rejection must stop the flow immediately.
- Validation/config errors must not retry silently.
- Shelby RPC 5xx errors may retry only in a limited, explicit way.
- Upload state must be cancellable and resettable.
- Public UI should not present mock data as real marketplace state.

## Project Structure

```text
sources/
  marketplace.move       Move listing module
  payment.move           Move purchase and revenue module
  access.move            Move access-control module

src/
  components/            Shared UI, layout, wallet, tx components
  hooks/                 dApp hooks for Shelby and marketplace actions
  lib/                   Aptos, Shelby, network, format, wallet utilities
  pages/                 Landing, marketplace, upload, detail, dashboard
  styles/                Design tokens and global styling
```

## Deployment Checklist

Before public release:

- Deploy Move modules to the target Aptos network.
- Set `VITE_STASH_MODULE_ADDRESS` to the deployed package address.
- Verify Shelby upload on the target network with a small file.
- Confirm Aptos Indexer events for listing, purchase, access, and claims.
- Run creator E2E: upload, register listing, view listing.
- Run buyer E2E: purchase, verify access, download/decrypt.
- Run production build and route smoke checks.
- Verify no fallback/mock data appears as public marketplace truth.

## License

License is not finalized yet. Treat this repository as proprietary during active development unless a license file is added.

---

<div align="center">

**Stash is built for data ownership, on-chain access, and decentralized distribution.**

</div>

## Current Shelbinet Deployment

The Stash Move package is deployed on Shelbinet.

| Item | Value |
| --- | --- |
| Network | `shelbynet` |
| Package address | `0x2d82e8802ab2a3fcce32df2f663a05efcbba9ae00d755b76d242dffb087a4a83` |
| Publish transaction | `0x005794789e05b80ae3dbb91bd0027180bd4f754b633fa3b82e9c8ad5faf7153c` |
| Fullnode | `https://api.shelbynet.shelby.xyz/v1` |
| Indexer | `https://api.shelbynet.shelby.xyz/v1/graphql` |
| Shelby RPC | `https://api.shelbynet.shelby.xyz/shelby` |

The frontend includes this package address as the default Shelbinet module address. `VITE_STASH_MODULE_ADDRESS` can still override it for future redeployments.
## Shelbinet Launch Runbook

Stash is configured to target Shelbinet by default and includes the current Shelbinet package address. A real Shelby CLI upload has been validated on Shelbinet; browser uploads still depend on the connected wallet having ShelbyUSD, a Shelby write location, and any API key required by the active early-access RPC policy.

### 1. Create a Shelbinet Aptos CLI profile

Use the deploy wallet you want to own the Stash Move package. Do not commit private keys.

```powershell
aptos init --network custom `
  --rest-url https://api.shelbynet.shelby.xyz/v1 `
  --skip-faucet `
  --profile shelbynet
```

If you already have the deploy key, initialize with `--private-key` or `--private-key-file`. The account must have enough gas on Shelbinet before publishing.

### 2. Publish the Move package

Replace `<deployer-address>` with the account address from the `shelbynet` profile.

```powershell
.\scripts\publish-shelbynet.ps1 -Address <deployer-address> -Profile shelbynet
```

The script compiles the Move package with `stash=<deployer-address>`, runs Move tests, then publishes against the Shelbinet fullnode.

### 3. Set frontend environment

Create `.env.local` locally and mirror the same values in the hosting provider.

```env
VITE_APTOS_NETWORK=shelbynet
VITE_APTOS_FULLNODE_URL=https://api.shelbynet.shelby.xyz/v1
VITE_APTOS_INDEXER_URL=https://api.shelbynet.shelby.xyz/v1/graphql
VITE_SHELBY_RPC_URL=https://api.shelbynet.shelby.xyz/shelby
VITE_STASH_MODULE_ADDRESS=0x2d82e8802ab2a3fcce32df2f663a05efcbba9ae00d755b76d242dffb087a4a83
VITE_SHELBY_API_KEY=
VITE_APTOS_API_KEY=
```

`VITE_STASH_MODULE_ADDRESS` is mandatory for marketplace, dashboard, upload publish, purchase, claim revenue, and access verification. `0xcafe` is intentionally rejected by the frontend because it is only the dev-test address from `Move.toml`.

### 4. Verify Shelby storage

A real Shelbinet upload was completed with the Shelby CLI using the deployed package wallet.

| Item | Value |
| --- | --- |
| CLI context | `shelbynet` |
| Write location | `shelbynet-1` |
| Upload transaction | `0x9fcd01ba1721359c22543a7bb00a06b214c45e6b93afb0c3e1d3928ca9fdc8be` |
| Explorer | `https://explorer.shelby.xyz/shelbynet/account/0x2d82e8802ab2a3fcce32df2f663a05efcbba9ae00d755b76d242dffb087a4a83` |

If browser upload fails before the Petra signature, confirm the connected wallet has ShelbyUSD and a Shelby write location. The CLI validation used `shelbynet-1` explicitly.

### 5. Verify the app

```powershell
.\scripts\check-shelbynet.ps1
npm.cmd run build
```

Manual E2E checklist:

1. Connect Petra on Shelbinet.
2. Upload a small file from `/upload`.
3. Confirm the Shelby blob registration popup appears.
4. Confirm the Stash listing registration popup appears.
5. Confirm the listing appears in `/marketplace` from Aptos Indexer events.
6. Purchase from another wallet.
7. Confirm `access::verify_access` returns `true`.
8. Download and decrypt the Shelby file.

Current delivery note: the browser can decrypt downloads only when it has the matching local access key for the Shelby object. Production buyer delivery still needs a proper buyer key handoff/key-wrapping path before this can be called fully trustless for arbitrary buyers.
