# Raster regression baseline

## FF-26 slide image review

Slide-level images (`design.slideImage`, composed by core as `geometry.slideImage`) change 1 of 805 slides, with an unchanged source digest: `technical/slide-design-overrides.opf.json#3`. The same entry changes in both `opf-examples-png.furniture.sha256.json` and `opf-examples-png.ff25-wdupdiag.sha256.json`. That slide sets its own `design.slideImage` with `position: "right"` and uses the same asset as its root image. The image now fills the right half of the slide and the title wraps in the left half. Before, the image was a content item below the title. The asset is not embedded, so both versions show the ordinary "Image unavailable" placeholder. The before and after renders were reviewed at half scale.

A deck-level slide image applies only where the layout declares `slideImage: true`, or where the slide's root `image` is the same source. None of the 81 decks with a deck-level `slideImage` meets either condition, so they keep their hashes. The other 804 hashes are unchanged.

CI pins the FF-26 core, which also contains the opf#127 `wdUpDiag` examples, so `OPF_GOLDEN_BASELINE` selects the FF-25 manifest there.

## FF-25 `wdUpDiag` example corpus (pending core release)

`opf-examples-png.ff25-wdupdiag.sha256.json` is the baseline for the core example corpus from [OpenPresentation/opf#127](https://github.com/OpenPresentation/opf/pull/127). That PR changes the pattern-background preset in 11 example decks from the preview-only `diagStripe` to the DrawingML preset `wdUpDiag`. Since #35, `wdUpDiag` draws exactly like `diagStripe`. The manifest was generated with `OPF_EXAMPLES_DIR=<opf#127>/examples node test/golden.mjs --update`. All 805 slide entries are identical to `opf-examples-png.furniture.sha256.json`; only the corpus digest changes, to `d089278ffc10c44d3504f9e53b3369f37178fdb55e8941ccec2b2bb7704a69d4`.

The core ecosystem CI selects this file through `OPF_GOLDEN_BASELINE`. `npm test` here keeps `opf-examples-png.furniture.sha256.json`, because the installed and pinned core still use `diagStripe`. Once a core release containing opf#127 is pinned here, this file becomes the default baseline, and the furniture manifest is retained for history.

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
