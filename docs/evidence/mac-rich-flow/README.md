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
