# OpenPresentation shipping checkpoint — September 15, 2026

This is a verified progress snapshot, not completion of the ecosystem goal. Checkboxes separate implementation from merged, published and deployed work. The work below is committed and pushed; draft release preparation is not a completed release.

## Repository state

| Repository | Verified remote default | Delivered or pending work |
| --- | --- | --- |
| [opf](https://github.com/OpenPresentation/opf) | `main`: `f94125a1ff95bf0974a055fe1c081d348dad54f2` | Partner demo, offline lint/design contracts, catalog validation and core/CLI release preparation merged. Core 0.10.0 and CLI 0.8.0 published. Furniture and joint shaping are separate drafts. |
| [opf-editor](https://github.com/OpenPresentation/opf-editor) | `main`: `4557f55ea60c24ac5a8cd407f1810d4a5db6f76f` | Reusable JSON editor, contextual choices, source line endings and installed publication checks merged. Layout grouping is pushed in the feature/release branches. Editor 0.7.0 release is draft. |
| [opf-render](https://github.com/OpenPresentation/opf-render) | `main`: `cbf058eba055ad9ea5787b35c85409d232f5725d` | Corrected catalog example expectations merged. Renderer 0.8.0 release draft has a refreshed registry lock and an unresolved macOS JPEG browser gate. |
| [opf-pptx](https://github.com/OpenPresentation/opf-pptx) | `main`: `e480f4e6225a4ef74bb30be45a493e2c7336baaa` | PPTX 0.8.0 draft separates the audited missing-master declaration fix from version metadata. Furniture provenance and joint rich-run/tab work remain separate drafts. |
| [openpresentation-site](https://github.com/Data-Advantage/openpresentation-site) | `main`: `c37317e2a88c75bb53c0025fa37dd1902b028750` | Homepage/playground JSON and preview editing, code-editor behavior, contextual options and improved layout grouping are merged and deployed. PR36 also merged browser-test timing and publication-history updates; that follow-up deployment is not yet verified here. |
| [pptx-gallery](https://github.com/Data-Advantage/pptx-gallery) | `main`: `24d242658d4f03305c3521846645c1446af4c240` | Default is clean and pushed. No new gallery implementation or deployment in this checkpoint. |
| [pptx-dev](https://github.com/Data-Advantage/pptx-dev) | `master`: `8f61e12e0af17bd278a280b3bf85bc83675b88da` | Default is clean and pushed. Existing workbench reconciliation remains delivered; no new implementation or deployment in this checkpoint. |

## Demo and editing

- [x] Homepage JSON edits update the selected slide preview and retain invalid drafts with the last valid preview.
- [x] Playground JSON editing and slide preview are connected in both directions; preview edits update existing OPF JSON.
- [x] Preserve surrounding JSON formatting, metadata, typing/cancellation, and undo/redo in the tested workflows.
- [x] CodeMirror controls support indentation, paired delimiters, bullet-array continuation, search and explicit formatting.
- [x] Categorical choices use available document/app/built-in context. Current layout is pinned; alternatives show placeholder types/counts and Similar/All filters.
- [x] Website implementation merged through [PR29](https://github.com/Data-Advantage/openpresentation-site/pull/29), [PR30](https://github.com/Data-Advantage/openpresentation-site/pull/30), [PR32](https://github.com/Data-Advantage/openpresentation-site/pull/32), [PR33](https://github.com/Data-Advantage/openpresentation-site/pull/33), [PR34](https://github.com/Data-Advantage/openpresentation-site/pull/34) and [PR35](https://github.com/Data-Advantage/openpresentation-site/pull/35).
- [x] Production deployment of `6d41bf8` is confirmed by GitHub deployment `6462207029` and Vercel success. Public routes are [home](https://www.openpresentation.org/) and [playground](https://www.openpresentation.org/playground).
- [x] Nineteen live JSON/preview workflows passed immediately. The mobile layout test sampled a transient resize frame; a probe confirmed the popup settles inside the viewport within two animation frames. All four repeated runs pass after waiting for full viewport visibility without changing the bounds or keyboard assertions.
- [x] [Website PR36](https://github.com/Data-Advantage/openpresentation-site/pull/36) merged at `c37317e` after site CI and the Vercel preview passed; local main is updated. This is a test/history change, not new runtime styling. Its follow-up production deployment remains to be verified.
- [x] Reusable editor source and publication gates merged through [PR18](https://github.com/OpenPresentation/opf-editor/pull/18), [PR19](https://github.com/OpenPresentation/opf-editor/pull/19) and [PR20](https://github.com/OpenPresentation/opf-editor/pull/20).
- [x] Latest reusable layout grouping is committed separately (`046b04f` on the release branch; original `9c86fd2` integrated as `b9c3d2e` on the feature branch).
- [ ] Merge and publish editor 0.7.0 from [PR22](https://github.com/OpenPresentation/opf-editor/pull/22), after upstream releases and exact registry acceptance.
- [x] Offline partner-demo fallback is preserved in [core PR80](https://github.com/OpenPresentation/opf/pull/80).

## Offline lint and releases

- [x] [Core PR81](https://github.com/OpenPresentation/opf/pull/81) implements local lint with rule IDs, severity, JSON Pointers, original source ranges, contextual suggestions and explicit design contracts. [PR82](https://github.com/OpenPresentation/opf/pull/82) verifies catalog examples offline.
- [x] [Core/CLI release PR84](https://github.com/OpenPresentation/opf/pull/84) merged at `f94125a1ff95bf0974a055fe1c081d348dad54f2`; core CI, coordinated packages and macOS/Windows CLI portability passed.
- [x] Core **0.10.0** published through [workflow 34989097321](https://github.com/OpenPresentation/opf/actions/runs/34989097321) and [release tag opf-v0.10.0](https://github.com/OpenPresentation/opf/releases/tag/opf-v0.10.0).
- [x] CLI **0.8.0** published through [workflow 34989733824](https://github.com/OpenPresentation/opf/actions/runs/34989733824) and tag `cli-v0.8.0`.
- [x] npm metadata confirms both versions, exact git head and provenance attestations. See [core registry record](core-registry.json) and [CLI registry record](cli-registry.json).
- [x] Fresh registry installation on Node 24.21.0 exercises the library and CLI lint APIs, duplicate-key/source locations, contextual catalog diagnostics, expected exit status, CLI help and exact input preservation: [smoke result](registry-smoke.json).
- [x] Renderer 0.8.0 [PR23](https://github.com/OpenPresentation/opf-render/pull/23) is committed and pushed. Its clean registry installation, package tests, typecheck, package validation and isolated 17-file packed check pass with core 0.10.0.
- [ ] Renderer 0.8.0 browser release gate: macOS JPEG orientation 7 with crop exceeds the existing comparison criterion. The [exact failure is preserved](https://github.com/OpenPresentation/opf-render/blob/7ea906b/docs/evidence/release-0.8.0/macos-browser-failure.log); tolerance is unchanged. The subsequent code-browser command did not run.
- [x] PPTX 0.8.0 [PR36](https://github.com/OpenPresentation/opf-pptx/pull/36) is committed and pushed, with package correction `f43822a` separate from metadata `e11a3e2`. The correction and typecheck pass against coordinated sources.
- [ ] Refresh PPTX and editor lockfiles after verified upstream publication, rerun clean registry/package/browser/CI gates, then merge and publish in dependency order. Their current draft lockfiles still represent the predecessor dependency set.
- [ ] Adopt the complete new registry set in the three websites, rebuild generated previews/release references, deploy and verify complete public workflows.

Registry availability lagged the successful core publishing workflow. Publication was not retried. Until the full new graph is accepted, `release-plan.json` and the website showcase retain the last verified complete package set: core 0.9.0, renderer/PPTX 0.7.0, editor 0.6.0 and CLI 0.7.0. The newly verified core/CLI publications are recorded separately above.

## Full ecosystem goal and remaining fidelity gates

- [x] Essential runtime authoring, validation/lint, composition, preview/editing and export operate locally without model calls, API keys, accounts or hosted AI. Optional hosted services remain separate.
- [x] Shared accepted geometry, deterministic candidate selection, readability-floor policy and bounded pagination are implemented and tested. Passing these checks does not establish full automatic layout repair.
- [ ] Finish and release the complete layout/repair and native compatibility goal.
- [x] Shared furniture implementation, source-aware editing/undo and conservative PPTX provenance are committed in [core PR79](https://github.com/OpenPresentation/opf/pull/79), [renderer PR20](https://github.com/OpenPresentation/opf-render/pull/20), [editor PR17](https://github.com/OpenPresentation/opf-editor/pull/17) and [PPTX PR34](https://github.com/OpenPresentation/opf-pptx/pull/34).
- [x] Furniture visual review and source/installed browser evidence exist for the accepted 805-slide checkpoint and the reviewed 657 changed rasters.
- [ ] Furniture PRs merged, released and deployed: still drafts pending the documented native/fidelity requirements.
- [x] Rich-run joint shaping, whole-source grapheme/source spans, tabs and canvas carets are committed in [core PR83](https://github.com/OpenPresentation/opf/pull/83), [renderer PR21](https://github.com/OpenPresentation/opf-render/pull/21), [editor PR21](https://github.com/OpenPresentation/opf-editor/pull/21) and [PPTX PR35](https://github.com/OpenPresentation/opf-pptx/pull/35).
- [x] [Joint-source evidence](https://github.com/OpenPresentation/opf/tree/225b7cb/docs/evidence/joint-source-shaping-20260915) preserves source mappings, style/link/decoration boundaries, native XML runs and 612 byte-matched installed files. New renderer test commit `aec153b` verifies grouped-source link/decorations and passes 30 local rich-flow cases; its full CI is still running at this checkpoint.
- [x] The prepared release candidate graph passes installed model/geometry/font checks, TypeScript/browser bundles, canvas workflows and [seven offline JSON-control workflows](candidate-json-browser.json).
- [x] Tested source paths preserve authored text, whitespace, reading order, rich formatting, metadata and explicit human choices. Regression results are bounded by their recorded fixtures and runtimes.
- [ ] Certify arbitrary native edits/reimport, missing or duplicate provenance, image editing/reordering, current font identity and general Office fidelity across the full goal. Do not infer these from browser or ZIP/XML results.
- [x] Existing published PPTX output uses editable native text/shapes for supported features, with bounded native quote/code/source-recovery evidence.
- [ ] Native tab tolerance remains unmet: recorded maximum drift `0.0226745605469 pt` exceeds `0.02 pt`.
- [ ] Native image acceptance/recovery remains open: nine exports failed Office opening despite ZIP/XML validity, and the earlier native picture control hung. No COM retry or process cleanup was attempted here.
- [ ] Resolve current font/shaping and per-glyph physical-font fidelity gates. Family/style names alone are insufficient. Restricted Aptos 4.40 remains excluded without compatible explicit permission.
- [ ] Resolve the documented notes-master SDK/native ordering disagreement with native evidence; production ordering has not been changed to satisfy only the SDK.
- [ ] After the prerequisite font/layout/native gates, deliver selectable/searchable vector PDF, sanitized general SVG images and the full semantic Mermaid family matrix. Existing raster PDF is not this milestone.

The active goal remains open. Prioritize completing and shipping the existing release scope; preserve failures and source content, and do not bypass native/font/browser requirements to empty the PR list.
