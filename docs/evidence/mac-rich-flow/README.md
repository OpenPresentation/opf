# Natural rich text candidate and native follow-up

The renderer now uses adjacent traced SVG spans within each estimated line when no measurement provider is supplied. The editor recognizes both spans and measured text fragments for selection, formatting, caret geometry and typing. Measured-provider origins remain unchanged. Source harness `0f937d3ee94644ee3df312b7dbbf36b6efe27e70`, renderer `57be896e761af102961521acd7dd6104273296bf`, editor `eeaee72f011ccb3d36259236d46fc9a4124a1eed` and PPTX `8bf8aab4a69e2f89b489ff64cde2ae6b7c46de7e` define this candidate graph.

Both Node 20.20.2 and 24.21.0 pass source-browser rich editing in measured and estimated modes. These tests cover cross-run/reverse selections, formatting/links, typing, draft undo/redo, session undo, cancellation, concurrency, composition guards and blank-line caret geometry. Events in this harness are synthetic browser events; they do not certify native IME behavior.

Fresh candidate tarball consumers pass on both Node versions. Eight installed browser suites pass 276 assertions and eight trusted pointer/keyboard scenarios each: canvas, measured rich text, estimated rich text, layout, blocks, lists, creation and styled tables. Historical registry suites remain pinned to published APIs. The retained manifests bind exact candidate tarballs, installed locks, browser bundles and font assets. These packages have not been published.

The renderer's [immutable visual evidence](https://github.com/OpenPresentation/opf-render/tree/57be896e761af102961521acd7dd6104273296bf/docs/evidence/rich-flow-corpus-review) includes all 188 changed slides in 24 paired sheets and six full-size pairs; 617 hashes remain identical. Its 30-case actual offline browser test passes on both Nodes. Existing sparse layouts, a missing nested-list marker glyph, low contrast text and approximate unmeasured wrapping remain separate work. This regression checkpoint does not establish native fidelity or general visual quality.

The native follow-up is independent of the spacing change. Core #70 at `28ae661a606d0a70ff39d98aac32e84240dbbb23` contains 182 verified files. `scripts/review-native-quote-followup.mjs` independently reimports all 72 native original/saved/edited quote slides on each Node version; exact current title/body/footer order and multiplicity pass. Raw bounds/separation and 24 raster hashes are checked. Quotes remain generic text blocks on import. No new Mac Office execution or per-glyph font identification is claimed.

The native-created tab control reproduces the remaining 0.02pt gate failure without OPF input. Requested 16.27734375pt becomes 16.30pt in the observed native tab position while a directly positioned literal stays near the requested value. Precise DrawingML and the independently extracted PDF coordinates are distinct observations. Private PDFs and proprietary subsets are excluded. No tolerance or runtime offset changed.

Reproduce candidate checks from the core repository with named sibling package checkouts and supported Node:

```sh
node scripts/link-ecosystem.mjs --packages-only
pnpm pack:ecosystem
pnpm test:packed-ecosystem
pnpm test:packed-browser
node scripts/run-rich-text-browser.mjs artifacts/rich-flow-estimated estimated
node scripts/run-rich-text-browser.mjs artifacts/rich-flow-measured measured
node scripts/review-native-quote-followup.mjs docs/evidence/windows-native-quote-tab-2026-09-10 artifacts/native-quote-review.json
```

`manifest.json` hashes every retained file except itself. No version, release plan or deployment changes in this checkpoint.


## Review follow-up

The current source graph updates renderer to `6520f091a95aa95be5993580adf5df567eb439c8` and editor to `f0871842088d2180ed7de606c379d7921e7fbf0e`. The initial reports above retain their original source bindings. Linux controls reproduced measured browser gaps up to 4.533px; geometric precision reduced them but left a 0.1076px fractional-size discrepancy. The renderer now constrains horizontal advances only for accepted outline placement using SVG `textLength`/`spacingAndGlyphs`, while retaining nominal font size and baseline. Width-only providers receive no glyph scaling. Raw intrinsic font comparison remains separate; the browser fixture independently bounds the correction. No tolerance was widened.

Independent editor review exposed a nested code-span selection that could show formatting controls. A text-node selection reproduces the failure; ancestor code-role checking corrects it. Body, filename and language selections pass on both wide and portrait fixtures while edit/undo/export/reimport remain functional. The earlier element-range selection did not exercise that endpoint; both failure and corrected logs are retained.

The Mac also checked all 389 files in native evidence `719ad1e9f3b205d3a3e2ba2f2141954936dcc521` and independently imported 28 font slides on each supported Node version. All nine open files match the bundled pack, native/PDF family/style names agree, and seven PDF raster pairs match across native runtimes. All seven full-size rasters were inspected. `scripts/review-native-font-followup.mjs` reproduces the portable import/name checks. Native images remain blocked after the separately retained PowerPoint-created control timeout; no Office cleanup or image-fidelity pass is inferred.

The final pair passes Linux Node 20.20.2 and 24.20.0 CI ([renderer run 34526853919](https://github.com/OpenPresentation/opf-render/actions/runs/34526853919), [editor run 34526952902](https://github.com/OpenPresentation/opf-editor/actions/runs/34526952902)). Retained Linux reports include all 30 flow cases, eight gallery/control cases and eight installed browser suites. A fresh Mac Node 24.21.0 candidate pack, consumer and installed browser run also passes all eight suites (276 assertions and eight trusted scenarios). These follow-up reports are distinct from the earlier Mac Node 20/24 source graph above.
