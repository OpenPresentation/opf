# RR108: pinned chart/table SVG digest lock

New continuation from fresh actual main afac3f7f, normally fast-forwarded to approved v0.34 f2c135f6692900ce5b916655278159f79ba47843. Previous RR108 PR #1158 remains frozen. No runtime/rendering algorithm changes.

## Confirmed reason and migration

The existing renderer contract packages/render/test/chart-table-data.mjs:105 rejects two intended reviewed changes after LH182 optioned/nested-ring hole filling. Exact SVG token comparison renders the same two legacy test documents through accepted v0.33 and approved v0.34 catalog harnesses on Node 24.20.0. Each after SVG adds only one complete circle: cx607.6,cy404.94,r111.357,fill#011842. Removing that token plus newline reproduces the previous SVG byte-for-byte. All slices, labels, legend, paths and order remain exact. Both old/new short digests match the original failure. Four actual SVGs and full hashes are archived. The initial prefix-substring comparison failed because it consumed a shared angle bracket and accidentally used system Node 26; its observed failure is retained, then corrected to complete-token equality under Node 24.

Migration receipt preserves all 31 existing literal values verbatim in packages/render/test/golden/chart-table-data/reviewed-svg-digests.json. Not one digest value is regenerated locally. The normal test reads that exact fixture and retains its strict deep comparison; the strict control still fails on the exact two known changed values until the final pinned regeneration. This maintenance PR does not pretend the stale lock is green.

## Workflow and security boundary

The existing RR54_PRINT_DIGESTS=1 branch computes and prints the complete 31-case JSON, then exits before reading/comparing the old fixture. The pinned read-only golden job writes its output to the exact new fixture after existing example/core-template/renderer-template generation. The directory is already within the existing renderer golden root and is outside the example corpus baseline subdirectory; no broadening of the write-job allowlist is needed. Existing corpus promotion selects only its per-deck example baseline and cannot delete this sibling fixture.

No new job, token privilege, checkout/download path, untrusted write execution or local-promotion command is added. The separate write job only validates/applies its downloaded patch. Contract controls exercise the actual git-apply path parser for the new fixture and reject the literal JS source, sibling paths and traversals. The real printer must emit exactly the fixture keyset and24-character hex hash format while leaving the reviewed fixture bytes untouched.

Vetoable decisions: migrate the old literal values unchanged rather than refresh locally; use the already-maintained printer in the pinned job; keep strict keyset/hash/deep comparison; preserve the existing read-only versus write-job boundary and unchanged allowlist. Final generated values may change only in the coordinator's single reviewed034golden batch after all source/native acceptance. No tolerance or assertion is weakened.

## Scope and remaining locks

This PR covers the renderer's literal chart/table SVG lock only, alongside existing RR108 core/render controlled goldens. Nine-deck packages/pptx/test/fixtures/chartex-fallback-main.json (strict comparison in chartex.mjs:433) is a separate family from the 21-deck rr-54-unchanged.json handled by review-rr54-archives.mjs. The coordinator owns the separate maintained writer/reviewer for those archives. No PPTX fixture or patch allowlist is changed here.

## Verification

Seven focused workflow/generator tests pass, including the actual31-case printer and unchanged-fixture check. Before/after token equality and original-value migration proofs pass. The normal strict chart/table assertion still rejects exactly the two pending hashes, as intended before the pinned batch. The single mapped receipt and lossless logs records158.9seconds,12/14steps pass: build,Biome,fragments,diagram images,font hotlinks,golden-update,registry goldens,release-report,skill commands,stability andtext. Inherited strict gallery freshness fails17/18controls; the renderer contract correctly stops on the same two unrefreshed hashes with147tests unrun. No generated tracker or digest is altered. Typecheck is unselected(noTSchange). CI builds all packages before its lint/root checks, so the real-printer test has its dependencies. No raster golden regeneration, native run, CI dispatch, publication, deploy or login occurs here.
