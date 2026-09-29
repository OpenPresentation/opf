# Raster regression baseline

## Cover centering review

Since renderer 0.11.0, which requires core `^0.11.2`, `opf-examples-png.cover-centering.sha256.json` is the default baseline in `test/golden.mjs`, so the publish workflow (which sets no `OPF_GOLDEN_BASELINE`) checks the installed registry core against it. The ff25-wdupdiag manifest is retained for runs against core 0.11.1 (`OPF_GOLDEN_BASELINE=test/golden/opf-examples-png.ff25-wdupdiag.sha256.json`).


Core now centers the tag/title/subtitle group of cover slides (no body payload on a heading-only layout) between header and footer furniture inside the image-safe area. The renderer draws the composed boxes without change; this changes 103 of 805 slides, with an unchanged source digest, and the manifest is `opf-examples-png.cover-centering.sha256.json`, identical to core's `scripts/fixtures/opf-examples-png.cover-centering.sha256.json`. All 103 are slide 1 of a deck. Only the `y` of the tag, title and subtitle boxes changes (184 to 269 reference pixels); `x`, widths and heights are identical, and the renderer diagnostics are identical (2 `text-overflow`, 26 `unresolved-asset`, no `small-cell`). Rendering unmodified main matches `opf-examples-png.ff25-wdupdiag.sha256.json` exactly, so the other 702 hashes are unchanged. Fifteen before/after pairs covering widescreen, 16:10, 4:3, letter and A4 decks, bold, classic, minimal and dark themes, left, center and right title alignment, header and footer furniture and wrapped titles were inspected at 0.6 scale. CI pins the merged core cover-centering commit (opf#169, `ce3c779a`) and selects this file through `OPF_GOLDEN_BASELINE`. Without that variable `npm test` still uses `opf-examples-png.ff25-wdupdiag.sha256.json`, the default for published core 0.11.1, which has no cover centering. Once a core release containing opf#169 is required by this package, this file becomes the default baseline and the FF-25 manifest is retained for history. `opf-examples-png.furniture.sha256.json` is the pre-`wdUpDiag` history manifest and is not used by CI or `npm test`.

## FF-29 metric anchor review

Metric lines without tabs now anchor at their accepted alignment edge, as native PPTX metric paragraphs do. This changes 54 of 805 slides, with unchanged source digests, and the same 54 entries in both `opf-examples-png.furniture.sha256.json` and `opf-examples-png.ff25-wdupdiag.sha256.json`. Every changed slide contains a centered or right-aligned metric. Core's accepted metric origin comes from the estimated width; resvg shapes the bundled face, so start-anchored text drifted off its edge. Before this change the drift was half the estimation error for centered metrics and all of it for right-aligned ones. Across the 266 affected lines, the median shift is 6.6 px, p90 33.8 px and max 69.0 px at 1280×720. The change was reviewed at golden scale and at full resolution on `gallery/industries/battery-line-supplier-readiness.opf.json#5`, where the right-aligned value now shares its right edge with the label and description. The 54 new hashes are byte-identical to the ones reviewed before the FF-19/FF-25/FF-26/FF-27/FF-34 rebase. The other 751 hashes are unchanged. The preceding approved furniture manifest is `pre-metric-anchor-opf-examples-png.furniture.sha256.json`.

## FF-26 slide image review

Slide-level images (`design.slideImage`, composed by core as `geometry.slideImage`) change 1 of 805 slides, with an unchanged source digest: `technical/slide-design-overrides.opf.json#3`. The same entry changes in both `opf-examples-png.furniture.sha256.json` and `opf-examples-png.ff25-wdupdiag.sha256.json`. That slide sets its own `design.slideImage` with `position: "right"` and uses the same asset as its root image. The image now fills the right half of the slide and the title wraps in the left half. Before, the image was a content item below the title. The asset is not embedded, so both versions show the ordinary "Image unavailable" placeholder. The before and after renders were reviewed at half scale.

A deck-level slide image applies only where the layout declares `slideImage: true`, or where the slide's root `image` is the same source. None of the 81 decks with a deck-level `slideImage` meets either condition, so they keep their hashes. The other 804 hashes are unchanged.

CI pins the FF-26 core, which also contains the opf#127 `wdUpDiag` examples, so `OPF_GOLDEN_BASELINE` selects the FF-25 manifest there.

## FF-25 `wdUpDiag` example corpus (default baseline from core 0.11.1)

`opf-examples-png.ff25-wdupdiag.sha256.json` is the baseline for the core example corpus from [OpenPresentation/opf#127](https://github.com/OpenPresentation/opf/pull/127). That PR changes the pattern-background preset in 11 example decks from the preview-only `diagStripe` to the DrawingML preset `wdUpDiag`. Since #35, `wdUpDiag` draws exactly like `diagStripe`. The manifest was generated with `OPF_EXAMPLES_DIR=<opf#127>/examples node test/golden.mjs --update`. All 805 slide entries are identical to `opf-examples-png.furniture.sha256.json`; only the corpus digest changes, to `d089278ffc10c44d3504f9e53b3369f37178fdb55e8941ccec2b2bb7704a69d4`.

This file was the default baseline in renderer 0.10.0, which required core `^0.11.1` (the first core release containing opf#127). The publish workflow, which does not set `OPF_GOLDEN_BASELINE`, therefore checks the installed registry core's corpus against it, and the core ecosystem CI still selects it explicitly. `opf-examples-png.furniture.sha256.json` is retained for history and for runs against core 0.11.0 or earlier (`OPF_GOLDEN_BASELINE=test/golden/opf-examples-png.furniture.sha256.json`).

## Unreleased shared code review

The shared code integration changes 43 of 805 slides, with the same 126-deck source digest. Every changed image was reproduced against ordinary registry renderer 0.6.0 and reviewed in eight before/after sheets; all three technical slides and one representative gallery code slide were also inspected at full resolution. Filenames now appear, metadata retains case, source indentation survives and code uses left alignment. The other 762 hashes are unchanged. Sparse gallery code panels and existing theme/logo placeholders remain quality limitations.

The preceding approved manifest is `pre-shared-code-opf-examples-png.sha256.json`. `node test/review-code-raster.mjs <registry-consumer>` reproduces comparisons without approving them. The accepted baseline records regression behavior with bundled fonts and estimated layout; separate loaded-font browser and native PowerPoint checks are required. Neither thumbnail review nor matching hashes establishes general readability or pixel equivalence.

The current manifest covers **805 slides in 126 bundled OPF example decks**, identified by a canonical content digest. Every `npm test` runs it against the installed core's example data. An explicit `OPF_EXAMPLES_DIR` must match the same content; missing, empty or changed corpora fail. Git HEAD changes cannot skip this check.

The original 29713f5 baseline is retained as `historical-opf-examples-png.sha256.json` for audit history. It predates shared composition, rich text/lists and the current font/rendering behavior and is superseded, not claimed to pass.

`npm run golden:update` produces `artifacts/golden/candidate.json`, PNGs, an HTML gallery and overview sheets. It does **not** overwrite the approved manifest. Review the artifacts and changes, fix regressions, then deliberately copy the candidate to `test/golden/opf-examples-png.sha256.json`. `npm test` must subsequently pass without an update flag. `test/golden-gate.mjs` exercises missing/changed baselines, source drift and empty corpora.

## September 7 review

All 805 slides were reviewed at overview-sheet scale, with the timeline endpoint defect inspected at individual-slide scale. Timeline label boxes and markers now stay within their allocated content region; measured-font regressions cover one, two, four and eight events on wide and portrait slides. Each corpus image is a deterministic resvg raster using bundled fonts with system-font loading disabled.

This baseline records the current implementation, not complete visual correctness. Thumbnail review cannot establish glyph-level or small-text fidelity. Known limitations include unresolved media placeholders, limited advanced chart families, low-contrast combinations in some source presets, sparse layout/density choices, language shaping and native PowerPoint parity. Those issues remain on the ecosystem roadmap and must not be described as fixed merely because the golden test passes.

## September 8 core 0.4.1 review

The release baseline now matches core 0.4.1. Only `technical/asset-source-forms.opf.json#1` changes: its broken eight-byte PNG signature is replaced with a complete project-authored PNG. The image was inspected individually; all other 804 raster hashes are unchanged. The preceding core 0.4.0 baseline is retained as `core-0.4.0-opf-examples-png.sha256.json`.
