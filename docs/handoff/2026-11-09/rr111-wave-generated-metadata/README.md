# RR111 current-wave generated metadata repair

This branch repairs generated-data currency for the reviewed current wave. It does not add runtime behavior or complete RR111, native qualification, chart design agreement or release readiness. The integration base is `de693209caf392e3b86c30cc810a7fe9078a8ec9`, tree `6329fe9a452473fea224b2b900732bb7b99a49d9`; runtime remains the already reviewed `5b9e4386c00319da1fa4370dcc0b3eb6e93c9578`.

Worktree `C:/opf-work/rr111-gen-meta`, branch `codex/rr-111-wave-generated-metadata`, was created from freshly fetched `origin/main` (`9545016583ccfa151077cda4d51043ac6505a140`) then normally fast-forwarded to that exact published integration. Eventual PR base is `codex/integration-034`. No push is authorized before coordinator review.

## Actual generated changes

- `packages/gallery/previews/layouts/org-chart.svg` and `hierarchy.svg` now match the existing portable SVG generator. Only the order of identical connector path elements changes; every path/coordinate/text/style and all other markup remain exact. The other 38 SVGs and preview index remain byte-identical.
- Generated gallery-tracker JSON/Markdown now count all 111 release-readiness rows, including RR111, instead of 110. No acceptance status, gap, override, native evidence or measurement changes.
- The font tracker was regenerated first and remains byte-identical. Both tracker generators/tests and all authored overrides remain unchanged.

Vetoable **RR111-WAVE-GENERATED**: use the existing local portable preview generator and related tracker regeneration; do not change workflows or regenerate core/render golden hashes here. The integration already changes font-tracker overrides for LH177/LH183, satisfying the explicit AGENTS/CONTRIBUTING exception. Font tracker runs before gallery tracker. Public `/previews` SVG strings change, so the fragment names `gallery`; no drawing declaration is added because the record drawing, geometry and controlled raster output do not change. RR111 stays `review` and the original full-scope/native/chart gates remain open.

## Genuine before and after checks

Exact HEAD sparse inputs were restored from local Git: 4,356 files, 113,711,152 bytes, with no substitutions or index changes. Node 24.20.0 and pnpm 10.33.2 use a frozen offline installation. Initial missing-built-bin install warnings remain retained; actual engine builds and subsequent checks completed.

Before generation, maintained `check:previews` failed specifically for org-chart/hierarchy; strict gallery-tracker failed only freshness (17/18 tests). Font-tracker and release-report passed. Original logs are retained. Existing generators ran in this order:

```sh
pnpm --filter @openpresentation/gallery --fail-if-no-match run previews
pnpm build:font-tracker
pnpm build:gallery-tracker
```

Afterward, maintained preview check, font-tracker check, strict gallery-tracker check and release-report all passed. Tracker mode is explicitly `fail`, never `warn`. No tracker rule, tolerance, test assertion or source was altered. Required `check:changed --base de693209caf392e3b86c30cc810a7fe9078a8ec9` passed at source-stage commit `db27bad2d71f3bb17706dbc3b507797a7cd6d7a8`, tree `3435aac96128b01a650c4be34259d12511993ada`: 16 mapped steps passed in 98.8 seconds; typecheck correctly skipped because no TypeScript changed. This includes Gallery tests and strict freshness, catalog, schema/example, font-hotlink, palette, stability and documentation checks. `qualification.json` and all 16 step logs retain the exact outcomes; full integration CI remains separate.

## Before/after inspection

The unchanged `scripts/layout-sampler-sheet.mjs` tiles the two actual before/after pairs. Each individual PNG rasterizes the exact stored SVG string with the public `toPng` API. Pinned base Roboto is the explicit sans fallback for the raw SVGs' Aptos/Aptos Display family references; system fonts are disabled. This is a controlled local raster comparison, not native Aptos/PowerPoint or cross-platform pixel qualification. Source SVG font names are preserved.

Both raw-pixel pairs are exactly equal. All non-path markup matches and the complete path multiset is identical; only path element ordering differs. The sheet has org-chart before/after in row one and hierarchy before/after in row two. Visual inspection found the same content and connector geometry in each pair, without clipping or newly moved text. It is not a new design-quality acceptance for the unchanged hierarchy design. The first QA attempt failed before rendering because its diagnostic resolved Sharp from the root instead of the owning render package; original driver/log/exit are retained, and only that ignored QA driver was corrected.

`files.json` records lossless transports. The original generated-file inventory references all 45 baseline files by exact Git blob/hash; unchanged baseline copies are recoverable from the integration ancestor rather than redundantly archived. Exact changed before SVGs/tracker files and all generated/check/QA receipts are retained, including the initial QA setup failure.

## Resume boundary

The source/geometry/pixel proof binds actual outputs and protects runtime, catalog records, overrides, schemas, font bytes, scripts/workflows, lock/pins, all renderer/core golden fixtures and PPTX archives. A local offline verifier checks hashes and source scope without regenerating anything. No provider, API, CI watcher/dispatch, Office, release, source/override edit or golden/archive promotion occurs here.

Coordinator review/push and eventual integration PR qualification are still required. Managed pinned golden regeneration remains a separate later wave action. Pending chart representation agreement, native glyph/SmartArt/Office qualification, the original interrupted suites and full original scope remain open. No third release or fake 0.34 package/version is introduced.

- 2026-11-09 UTC: Preserved genuine baseline failures, refreshed only four generated files through maintained generators, inspected exact before/after geometry and controlled pixels, and retained strict focused passes. Required mapped check and coordinator source review follow.

Final documentation/progress qualification passed separately at `e58f26a17f6ca510d289c37b81aef0ad65a98b78`, tree `49173af254e92d9e59070e67cdab24c417bd2150`: seven steps PASS and typecheck correctly SKIP in 33.8 seconds, including strict tracker freshness and release-report. `final-docs/` retains only the seven executed step logs plus main log/exit; leftover prior logs are not relabeled as new runs. The final archival append and offline proof do not change the tested four generated outputs. Coordinator review and actual integration/CI/native/full-scope gates remain pending.
