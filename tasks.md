# Stash Tasks

## P0 - Current Upload Blocker

1. Fix retry behavior in Shelby upload.
   - Remove TanStack retry for wallet/user rejection.
   - Prevent internal retry for non-retryable errors.
   - Keep limited retry only for transient Shelby RPC/network failures.

2. Add non-retryable error classification.
   - Wallet reject/user cancel.
   - Missing wallet signer.
   - Invalid metadata.
   - Missing config.
   - Browser crypto/WASM setup failure.

3. Add cancel-safe upload flow.
   - Stop repeated upload after rejection.
   - Add abort/cancel support where possible.
   - Reset UI state cleanly on retry/back.

4. Debug Shelby RPC `500 Internal Server Error`.
   - Confirm whether `VITE_SHELBY_API_KEY` is required.
   - Confirm Shelbinet RPC endpoint and upload API path.
   - Inspect exact SDK request payload and response body.
   - Verify wallet network and gas on Shelbinet.

5. Improve upload stage UX.
   - Split visible stages into:
     - Encrypt file
     - Prepare Shelby commitments
     - Register Shelby blob in wallet
     - Upload to Shelby RPC
     - Register Stash listing
     - Confirm on Aptos
   - Petra popup should be expected only at wallet registration/listing stages.

## P1 - Real End-to-End

6. Create `.env.local` for the active network.
   - `VITE_APTOS_NETWORK=shelbynet`
   - `VITE_STASH_MODULE_ADDRESS=<deployed address>`
   - Add Shelby/API keys only if required.

7. Deploy/confirm Move package address.
   - Publish marketplace/payment/access modules.
   - Set `VITE_STASH_MODULE_ADDRESS`.
   - Verify events appear in Aptos Indexer.

8. Run full creator flow.
   - Connect Petra.
   - Upload small file.
   - Register Shelby blob.
   - Register listing on Stash contract.
   - Confirm listing appears in marketplace.

9. Run full buyer flow.
   - Browse listing.
   - Purchase with APT.
   - Verify access record.
   - Download/decrypt file.

## P1 - UI/UX Polish

10. Final browser QA.
    - Desktop, tablet, mobile.
    - Routes: `/`, `/marketplace`, `/upload`, `/dataset/:id`, `/dashboard`.
    - Check no blank page regressions.

11. Real-data consistency pass.
    - No mock data shown as public truth.
    - Honest empty/error states for empty indexer.
    - No fallback addresses like `0xcafe` in public UI.

12. Landing final polish.
    - Hero impact.
    - Live stats states.
    - Dataset preview empty/error/loading states.
    - Reduced-motion check.

13. Accessibility pass.
    - Keyboard navigation.
    - Focus visible.
    - Contrast.
    - Reduced motion.
    - No color-only indicators.

## P2 - Engineering Hardening

14. Add automated frontend tests.
    - At minimum route smoke tests.
    - Prefer Playwright for walletless UI state checks.

15. Add E2E test plan documentation.
    - Manual wallet test checklist.
    - Network/env checklist.
    - Known Shelby RPC failure modes.

16. Performance review.
    - Shelby SDK chunk size.
    - Aptos SDK chunk size.
    - Landing animation performance.
    - Lazy-load heavy SDK routes where practical.

17. Production deployment readiness.
    - Vercel/static hosting env vars.
    - SPA fallback.
    - WASM asset serving.
    - Content security considerations.
