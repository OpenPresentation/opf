# Raster regression baseline

The current manifest covers **805 slides in 126 bundled OPF example decks**, identified by a canonical content digest. Every `npm test` runs it against the installed core's example data. An explicit `OPF_EXAMPLES_DIR` must match the same content; missing, empty or changed corpora fail. Git HEAD changes cannot skip this check.

The original 29713f5 baseline is retained as `historical-opf-examples-png.sha256.json` for audit history. It predates shared composition, rich text/lists and the current font/rendering behavior and is superseded, not claimed to pass.

`npm run golden:update` produces `artifacts/golden/candidate.json`, PNGs, an HTML gallery and overview sheets. It does **not** overwrite the approved manifest. Review the artifacts and changes, fix regressions, then deliberately copy the candidate to `test/golden/opf-examples-png.sha256.json`. `npm test` must subsequently pass without an update flag. `test/golden-gate.mjs` exercises missing/changed baselines, source drift and empty corpora.

## September 7 review

All 805 slides were reviewed at overview-sheet scale, with the timeline endpoint defect inspected at individual-slide scale. Timeline label boxes and markers now stay within their allocated content region; measured-font regressions cover one, two, four and eight events on wide and portrait slides. Each corpus image is a deterministic resvg raster using bundled fonts with system-font loading disabled.

This baseline records the current implementation, not complete visual correctness. Thumbnail review cannot establish glyph-level or small-text fidelity. Known limitations include unresolved media placeholders, limited advanced chart families, low-contrast combinations in some source presets, sparse layout/density choices, language shaping and native PowerPoint parity. Those issues remain on the ecosystem roadmap and must not be described as fixed merely because the golden test passes.

## September 8 core 0.4.1 review

The release baseline now matches core 0.4.1. Only `technical/asset-source-forms.opf.json#1` changes: its broken eight-byte PNG signature is replaced with a complete project-authored PNG. The image was inspected individually; all other 804 raster hashes are unchanged. The preceding core 0.4.0 baseline is retained as `core-0.4.0-opf-examples-png.sha256.json`.
