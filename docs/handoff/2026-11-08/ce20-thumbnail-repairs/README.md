# CE-20 thumbnail repair batch

This source combines the independently reviewed unused-cache fix `7e8ef4f12f1d40ad7b3d7cd4416a89a853011de7` and portrait-fit fix `efe28780948ea9d33aa49834a37c3eca445f0fd0` on current integration `e99e6607336c9294685a7f491be3d66490eebc05`. The new branch started from freshly fetched main `9545016583ccfa151077cda4d51043ac6505a140`, then normally merged the current assembly and both frozen source branches. A tracking-only conflict preserved the newest cache qualification row, the separate portrait row and every progress line; no code conflict occurred.

Vetoable CE20-THUMBNAIL-BATCH: one coherent item PR and one remote editor CI run cover both thumbnail repairs, retaining both fragments, original failures and separate evidence packets. No source branch is pushed after folding. This changes no chart representation or release authorization.

merge-proof.json proves all six changed package paths exactly match the qualified source files; no other package path differs from the current integration. The runtime changes are only one cache-consumer condition and one CSS height value. The real strip/cache/API/source readiness and all authored slide content remain unchanged.

Root reviewed both patches and original/forward images. The current Org portrait source witness proves metadata/content, while the separate painted-fit control proves whole slide/title/body containment in manager/sorter frames with uniform SVG meet scaling. These are local source witnesses, not a published 0.34 consumer or hosted preview.

Historical isolated cache source has 12 actual real-renderer phases and four browser suites passing. All 144 selected Node scripts were exercised, 142 passing, with unchanged Windows symlink EPERM and fake-Office child Get-FileHash failures retained. Portrait source has 7 actual painted-fit phases passing; its missing sparse fixture was restored from exact Git objects and narrow text check passed 6/6. Original mapped package results remain RED. The combined source still requires full passing remote CI before integration acceptance.

The coordinator runs required mapped checks and the actual combined workspace browser suite on this source. Their receipts will be preserved alongside these source bindings. Final 0.34 goldens/full/slow/native/release/site gates remain separate, and no release is run here.


## Combined source qualification

Exact source `21a3143cbc20fdacbef92ef5594441e886fccfcb`, tree `b7eba30fd82024b7fa8fd4c53da04d61e3f0b86e`. The required mapped run passed every applicable step (8); TypeScript was correctly not selected because this batch has no TypeScript/configuration change. The actual combined editor contract completed **146/146 scripts**, including the unchanged CodeMirror guard. Earlier isolated Windows failures remain in their original packets; they are not the current combined result.

One actual combined workspace-browser run through the maintained machine-wide slot with pinned Node 24.20.0 passed: **24 existing workspace checks**, **12 real-renderer cache phases**, and **7 painted-fit phases**. Its before/after source identity remained exact. No second attempt, historical 125-case continuation or runtime/test change was made. These results preserve the fragments, rows, normal merges and source bindings.

`combined-receipt.json` and the five compressed raw logs/exit receipts record the source and results; `files.json` seals their sizes and SHA-256s. Verify with `node docs/handoff/2026-11-08/ce20-thumbnail-repairs/verify-combined.mjs`. No remote CI/provider/API/Office/push/release action was performed. Remote CI and all later release/site gates remain the coordinator's responsibility.
