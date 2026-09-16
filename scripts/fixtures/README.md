# Coordinated renderer baseline

`opf-examples-png.sha256.json` identifies the current core examples for coordinated renderer CI. The renderer standalone suite retains its baseline for published core 0.4.0. Both enforce exact corpus and raster hashes; this file is selected explicitly only for coordinated source checks.

Reviewed against renderer 87663fb on 2026-09-08: 126 decks / 805 slides. Compared with the published-example baseline, only `technical/asset-source-forms.opf.json#1` changes. Its truncated eight-byte PNG signature is replaced with a complete project-authored PNG; the newly visible image was inspected at individual-slide scale. The other 804 PNG hashes are unchanged. This does not establish complete visual or PowerPoint parity.

`opf-examples-png.placeholder-geometry.sha256.json` is the coordinated packages golden for unpublished heading defaults (`composeSlide` cover recenter and content title band). It uses the same 126-deck / 805-slide corpus digest as the renderer furniture file. Compared with `opf-render/test/golden/opf-examples-png.furniture.sha256.json` after inspecting representative before/after rasters: 103 cover slides recenter, 653 content slides move the body with the two-line title band, 8 region slides are capped so stacked metrics still fit, and 41 slides are unchanged — including every gallery `*.opf.json#5` operating-model metric slide (`compliance-readiness-review#5` among them). Furniture header/footer bands do not move. No new overflow diagnostics. Do not copy this candidate into the renderer furniture file: that gate still matches published core 0.10.1.

`ecosystem-ci.yml` selects this fixture via `OPF_GOLDEN_BASELINE`. The renderer standalone suite keeps `opf-examples-png.furniture.sha256.json`.

Regenerate a candidate with the renderer golden test and `OPF_EXAMPLES_DIR` pointing to this checkout's examples. Inspect the changed images and source before copying the candidate here. Never update a baseline automatically to bypass a failing check. Do not weaken the 0.1px accepted-text gate to make hashes match.
