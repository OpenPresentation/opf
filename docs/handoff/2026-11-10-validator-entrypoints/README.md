# RR-117 session-validator entrypoint contract

Source-only test/documentation correction from exact519dd89a80904907a3d0120f90b732065d99a0b1; qualified source93607491053590335c85088b9ff2aca0c9c42c41. **No validator/cache/API implementation or semantics change.** The actual combined-core failure and isolated unchanged baseline remain retained; no aggregate result is relabeled.

Node intentionally wraps createValidator to delegate one shared core session and apply the same default catalog as Node validate() on every call, forwarding clear and the live cache getter. Browser/worker core remains catalog-free. The old cross-entrypoint reference-identity test listed every other Node-default wrapper but omitted this new factory. The correction adds only that explicit wrapper exception; every other class/function still must share exact identity.

Three actual factory-session groups prove real Node gallery resolution, exact browser explicit-registration parity, browser unregistered warnings, explicit catalogs:[] and document default:false opt-outs, explicit custom records/no implicit gallery append, cold/warm/full source-range report equality, separate session caches, forwarded clear/live getter and canonical cross-entrypoint errors. These tests call the actual built public factories with real gallery records; no fonts/validation mocks or synthesized diagnostic results are used.

Vetoable RR117-NODE-FACTORY-CONTRACT: preserve the intended Node defaults and shared implementation; repair the stale identity contract and document the per-call default/opt-out behavior. Do not force reference equality by removing catalog defaults or adding global state. The source/index.ts diff is one comment only.

## Actual qualification

- Pinned Node24.20.0/pnpm10.33.2 offline install and maintained-slot stock baseline build passed. Unchanged runtime-builds script genuinely failed on createValidator reference identity; original root full-core log is preserved too.
- Candidate runtime-builds: **12/12 PASS**, including all original assertions plus three consumer/session groups. Exact qualified working-source bytes and hash are retained.
- Original script-width failure was sparse input, not a width regression. Exactly its two declared HEAD corpus JSONs were restored (152805bytes, raw OID/SHA/exclusive/index/authored-status guards), and only that failed script ran: **35/35 PASS**.
- Required unchanged check:changed --base519 at936 completed **12steps PASS /2sparse RED**. All seven package types passed; full core passed **4281/4281**,327node:test files+6scripts. Build/Biome/browser/catalog-safety/stability and other selected checks passed. Fourteen Biome template-style informational suggestions were nonfailing; no runtime adjustment was made.
- Original text and gallery sparse failures are retained. Only the exact16102byte compressed HEAD text fixture was restored, then only check:text ran: **7/7 PASS**, full9332file scan valid.
- The root-approved source-declared metadata closure restored **1843JSON/MD files /45340055bytes** in one raw Git-object batch, with <=4MB/file and <=64MiB total bounds, exact OIDs/SHA/path/exclusive/index/authored-status guards and both declared catalog proof hashes. No PNG/PPTX/archive, tracker regeneration/override/flag or assertion change. Only failed check:gallery-tracker ran: **18/18 PASS**, committed tracker up-to-date863records/313unaddressed. The initial inventory-only parser rejected an unrelated executable .sh before any writes/check; original driver/refusal summary and parser-only regular-file-mode correction are retained.
- Rebuild proves **65implementation JavaScript files byte-identical** to519. Only dist/docs.js changes, because the normal generator embeds the two authored docs. The initial overbroad all66files identity audit correctly failed on that doc payload; its original script is retained and the narrower complete diff is recorded. This is not a product/validation failure.

Every original aggregate/log is immutable. Both previously failed checks were recovered individually, with no full/package/type/build repeat. No Office, release, golden update, CI observer or provider action occurred in this lane. Final receipt-only metadata does not change the qualified test/index blobs. Root owns source review, integration folding and coherent gates; broader RR117 performance/heap/native/release acceptance remains open separately.

## Resume and verify

Run pinned Node on qualification/verify.mjs. It checks all copied record byte hashes, genuine baseline/focused/core/recovery receipts, exact metadata recovery identities, the complete compiled-JS diff and the comment-only index change. It performs no product tests/build/validation, imports, exports, registry calls or Office work. Git canonical source snapshots and exact physical test-source bytes are distinct named artifacts; no native/raw bytes are normalized.

Raw results are from public repository/synthetic automated checks; no owner decks, secret values or system/font binaries were copied. The current source branch must not receive further pushes after folding.
