# Stash Soul

Stash is a decentralized dataset and AI model marketplace on Aptos. Think HuggingFace for valuable AI artifacts, but decentralized, censorship-resistant, and governed by on-chain ownership, payments, and access control.

## Product Promise

Creators upload datasets or models once, store files on Shelby hot storage, register listing terms on Aptos, and receive direct APT revenue when buyers unlock access.

Buyers browse real indexed listings, pay on-chain, receive verified access, and download from Shelby without centralized marketplace custody.

## Non-Negotiables

- Zero centralized app dependencies. No Firebase, Supabase, private database, or hidden server state.
- Shelby stores raw files and metadata manifests.
- Aptos Move contracts handle ownership, pricing, access control, payment, and revenue.
- Aptos Indexer GraphQL powers marketplace discovery, dashboard analytics, and stats.
- Wallet flow uses Aptos Wallet Adapter and Petra first, with multiple wallet options exposed.
- TypeScript stays strict. No `any`.
- Move code must use explicit abort conditions, clear events, and test coverage.
- Public UI must not show mock/fake data as if real.
- Errors must be human-readable and suggest the next action.

## Design Direction

- Base: `#080810`
- Accent: Electric Indigo `#6366f1`
- Tone: premium, technical, geometric, calm, precise.
- Typography: display/body/mono tokens from the design system.
- Motion has meaning: route continuity, transaction confidence, upload progress, hover feedback.
- No generic AI slop, decorative blobs, stock-looking visuals, or corporate filler copy.
- Every screen should have one clear primary action.
- Loading content uses skeletons, not generic spinners.
- Buttons and critical actions must show loading, success, and error states.
- Empty states must explain what is happening and what to do next.

## Architecture

Frontend:
- Vite + React + TypeScript
- Tailwind tokens in `tailwind.config.ts` and `src/styles/tokens.css`
- Framer Motion for UI transitions
- GSAP for landing/scroll choreography

Storage:
- Shelby SDK browser integration
- File encrypted before upload
- Manifest stored on Shelby
- `storage_id` points to the Shelby manifest

Blockchain:
- Aptos Move modules:
  - `marketplace.move`
  - `payment.move`
  - `access.move`
- Frontend payload builders live in `src/lib/marketplace.ts`
- Network config lives in `src/lib/network.ts`

Indexer:
- Aptos Indexer GraphQL reads emitted events.
- Marketplace and dashboard must derive public state from real events.

## Current Quality Bar

Stash should feel like serious infrastructure for high-value AI assets, not a demo app. UI polish matters, but real-data consistency, wallet reliability, and clean transaction states matter more.
