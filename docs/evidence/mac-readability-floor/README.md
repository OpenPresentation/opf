# Readability floor candidate evidence

The predecessor capped plain/list text at 25 pixels, tags at 16 and table cells at 15 even when the selected floor was 32. Both Node runtimes reproduce that policy failure. Large nominal requests also exceeded 65 distinct trial sizes in plain, rich and list fitting. The retained before probes record these results; they are not native font comparisons.

Core now applies the selected floor to actual scalar and rich fragment sizes, including script-size reductions and list descriptions. It preserves source text, rich metadata and size ratios. Small explicit runs can require a larger shared base size; `fit.fontSize` is a layout scale, not necessarily any painted run's size. The prior relative shrink bound remains. Already-readable explicit table requests stay unchanged. Irreducible content overflows or rejects under strict policy. Each fitting search evaluates at most 65 candidate sizes, including the floor; the final jump is conservative and does not promise the largest fitting size or a bound on all shaping work. Explanation is versioned `grid-score-v7`.

Draft failures remain retained: the first rich minimum allowed unwanted extra shrinking, then existing tests exposed changed absolute-size expectations. The converter caught inflation of an already-readable 18pt table run to 19.2pt. Resolving the implicit table base before interpreting explicit runs restores 18pt without weakening that test. The intermediate passing core log predates this final converter-driven correction; final logs are named separately.

The final core suite passes 496 node tests plus composition, nested groups, pagination, 40 data checks, 16 rich checks and list checks on Node 20.20.2 and 24.21.0. Full renderer and converter suites pass on both runtimes, including their respective 805-slide regression/structural corpora. Editor Node 24's full suite passed before the final implicit table-base correction; final installed editing checks cover the corrected graph. Coordinated source pagination/layout/list/rich/data/font checks pass on both runtimes. Their native claims concern parsed editable PPTX structure, not execution in PowerPoint.

Fresh candidate installations on both runtimes pass package APIs, declarations and browser bundles. Each passes eight installed browser suites with 276 assertions and eight trusted interaction scenarios, twelve source-whitespace edit/undo/redo/export/reimport workflows, and four additional separate-keyboard controls. All candidate tarballs remain unpublished. `candidate-manifest.json`, `source-graph.json`, installed locks, browser manifests and verifier hashes bind the evidence; subsequent commits contain evidence and CI coordination.

The new `scripts/test-readability-browser.mjs` passes 48 cases on each runtime against both source and installed packages: measured/estimated placement, wide/portrait canvases, floors 16/24/32 and plain/rich/list/table payloads. It inspects actual SVG computed font sizes and independently parses native PPTX run sizes. Every observed minimum margin is zero or positive; no external request or browser error occurs. The gates allow 0.0001px SVG serialization and half a 0.01pt native size unit. Four complete measured fixture screenshots were visually inspected, including the intentionally amplified rich-run ratios. This does not certify glyph coverage, raw font equivalence, raster/native ink parity or all visible template text.

The renderer's [portable review](https://github.com/OpenPresentation/opf-render/tree/85eb290bde665f9bdfffc9ad487007ea237ea676/docs/evidence/readability-corpus-review) retains 33 paired sheets for all 262 changed slides and six full-size before/after pairs. All were visually inspected. The source remains 126 decks / 805 slides; 543 hashes remain unchanged. The exact predecessor reproduces the accepted source-whitespace baseline. A separate readability checkpoint is accepted; historical baselines remain intact. No new clipping was observed in the reviewed slides. Sparse layouts, unresolved assets/data, low contrast, small template footers/page numbers, chart/timeline internals and missing nested marker glyphs remain active work.

Native Office acceptance is separate. The six retained metric-tab outliers per runtime still exceed the unchanged 0.02pt gate, Akasia stays experimental, and per-glyph native identity remains unresolved. Native image automation remains blocked pending user-reviewed Office recovery; this checkpoint makes no further COM attempt. The authorized Windows source-whitespace handoff is recorded at https://github.com/OpenPresentation/opf/pull/71#issuecomment-5625857758. Published versions, release plans and deployments remain unchanged.

Reproduce from coordinated checkouts with Node 20 or 24:

```sh
pnpm build
node scripts/link-ecosystem.mjs --packages-only
pnpm test:packages
pnpm test:packed-browser
node scripts/test-plain-whitespace-workflow.mjs artifacts/readability-whitespace-installed installed
node scripts/test-readability-browser.mjs artifacts/readability-installed installed
```

`test:packages` builds, packs and freshly installs the local candidates. `manifest.json` hashes every retained evidence file except itself.
