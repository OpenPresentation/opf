# Mac owner checkpoint — 10 September 2026

The active goal covers the full OpenPresentation ecosystem, with font/layout reliability before vector PDF, then SVG/Mermaid, followed by coordinated new releases and public-site verification. This checkpoint does not complete that goal. Read the full [8 September handoff](handoff-2026-09-08.md), [10 September wrap-up](handoff-2026-09-10-wrap-up.md), [ecosystem objective](plans/ecosystem-objective-2026-09-09.md), [font roadmap](plans/font-roadmap.md) and [text placement plan](plans/text-placement.md).

## PR backlog and current state

The seven-repository audit found only core [PR #60](https://github.com/OpenPresentation/opf/pull/60) open initially. Its TypeScript 7 compatibility changes were reviewed, updated to current main and tested on the exact updated head. Node 20/24 coordinated CI, Mac/Windows portability and Bugbot passed. Local TypeScript 7/core tests and clean packed TypeScript 5.9/7 NodeNext/Bundler consumers passed. Merge: `e882f357cd7860b3e0905fdf0b2fb3ff8c2464d8`; issue #41 is closed.

The separate Windows agent subsequently opened PPTX [PR #17](https://github.com/OpenPresentation/opf-pptx/pull/17), retaining the owned verifier's process handle so Windows PowerShell 5.1 preserves its exit code. The exact head `95f5b9e0387dabb467a26d0fbbbdbe0171439a55` passed Linux/Windows Node 20/24 and Bugbot. Reviewed and merged as `24e7b2f12462df246e35a8a714a47923ecbd2bfe`. The [GitHub coordination handoff](https://github.com/OpenPresentation/opf-pptx/pull/17#issuecomment-5623170599) requests immutable native findings and preserved failures.

The initial audit found no open Dependabot security alerts in core, renderer, PPTX, editor or the three sites. Published versions remain core 0.9.0, CLI 0.7.0, renderer/PPTX 0.7.0 and editor 0.6.0. All three public origins returned HTTP 200 with successful production deployment records. That is a state check, not fresh deployed workflow certification. No npm version, release plan or deployment changed in this checkpoint.

## Verified font preparation

Renderer [PR #13](https://github.com/OpenPresentation/opf-render/pull/13), commit `91fe43e25dca9e4f04a2a18b1c6ee74e7e3d2863`, adds `prepareNodeFonts` and an immutable manifest for 33 existing open faces/eight license notices. Exact package versions and file/notice hashes are checked before use. Shared options carry measurement, embedded SVG bytes and raster paths; system fonts are disabled. Visual substitutions remain explicit and authored documents are preserved.

The old raster default omitted semibold, italic and bold italic from the nine-face base registry. A direct probe preserves the three failing outputs and shows all nine matching after correction. All 143 changed corpus slides were inspected in 18 paired sheets and six at full size. The separate baseline preserves all 662 unchanged hashes and identical source. Complete renderer suites/805 slides pass under Node 20.20.2 and 24.21.0. Nine exact base faces pass actual offline Chromium loading and advance checks; accepted-text and rich-spacing browser checks also pass. [Portable renderer evidence](https://github.com/OpenPresentation/opf-render/tree/91fe43e25dca9e4f04a2a18b1c6ee74e7e3d2863/docs/evidence/font-preparation) includes failures, paired images, hashes and reproduction instructions.

Core's coordinated font harness now passes the same preparation options through pagination, editor composition, SVG/PNG and PPTX. Fresh candidate installations verify source preservation, edit/undo, rendering, editable export and heading reimport. The new declaration consumer checks the shared API and immutable catalog. TypeScript 5.9 and 7 pass. Historical registry harnesses remain version-pinned and do not call unpublished APIs.

Both Node 20 and 24 Mac installed-browser runs pass seven suites: canvas, rich text, layout, blocks, lists, creation and styled tables, totaling 230 assertions and eight trusted interaction scenarios. The initial Mac styled-table run failed because `Control+End` left all text selected. A direct Chromium control reproduced that behavior; `Meta+ArrowDown` collapses the selection at the end. The harness now uses the native platform shortcut and asserts the selection before typing. The original failure screenshot/log remain in [Mac evidence](evidence/mac-font-preparation/README.md). Product editing behavior was not changed.

CI pins the reviewed renderer source, editor `6e0b7d2f1b4369fc0a228391cf36e913e05188f8` and PPTX `24e7b2f12462df246e35a8a714a47923ecbd2bfe`. Candidate PR review and CI must finish before accepting this source checkpoint.

## Remaining work and ownership

The Windows agent owns bounded native harness work and Office evidence. It reported that explicit `Chart.SetSourceData` after embedded workbook edits refreshed stale chart caches and passed 24 slide-one import comparisons; no importer runtime fix was indicated. A subsequent read-only RPC failure and PowerPoint AutoRecovered file interrupted that study. Those reports are provisional until portable evidence is committed. Office activity remains paused pending recovery review. Do not duplicate the agent's text/chart harness changes or treat the process-control merge as native fidelity acceptance.

Continue the font roadmap: weight/family naming, real measurement integration in user workflows, text features and rich spacing, bounded repair/readability, diagnostic paths, multilingual shaping/coverage, Akasia/Aptos evaluation and native portability. Existing wide rich-run gaps, sparse cards and unresolved assets/data remain visible; the 805-slide hashes do not certify quality. Keep optional font packs openly licensed with provenance and bounded downloads. No silent content loss or synthetic compatibility claims.

Vector PDF remains gated on font/layout acceptance; sanitized SVG and the complete Mermaid support matrix follow afterward. Publication must use new versions in dependency order, then clean registry workflows, installed-package browser tests and all three deployed sites. The current releases and prior failures must remain distinguishable from source candidates throughout.
