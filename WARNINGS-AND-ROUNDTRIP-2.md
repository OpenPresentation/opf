# Warnings window and round trip after the runs of 2026-11-27

Saved by the supervisor from the summary agent's hand-back. Generated table: `WARNINGS-2.md` (script `_ops/warnings2.py`; 469 effective files, a rerun2 capture replaces the older one). Scratch: `_ops/work-summary/`.

## Capture quality (469 files)

| Root | Captured, with list | Idle panel ("To view warnings, click or open a presentation.") | No panel |
|---|---|---|---|
| 036/examples (274) | 63 | 140 | 71 |
| 0351/qualification (67) | 39 | 27 | 1 |
| 036/qualification (67, after rerun2) | 55 (11 truncated by a scrollbar) | 6 | 6 |
| main/qualification (1) | 1 | 0 | 0 |
| rerun families (60) | 25 | 35 | 0 |
| Total | 183 | 208 | 78 |

About 171 complete lists. No stale panel found (title equals the document name in the corpus roots; layout names, slide numbers and fonts fit each deck everywhere; for panels titled only "default"/"native" this is not proof). 40 pictures read against the OCR: they agree. The window shows 3 rows; 133 captures show exactly 3 rows, so a hidden fourth row cannot be excluded. OCR reads "Segoe UI" as "Segoe Ul"; `WARNINGS-2.md` counts the idle text as a line (it is not a warning). 115 of 152 example decks have no usable panel in either mode.

## Distinct lines (captured panels; q036 / q0351 / examples / rerun families / main)

- Unsupported media were removed. Slide Layout(s): Cover, Gallery, Hero, Image, Image beside: 50 / 37 / 63 / 23 / 1 (every captured panel except font test D; variants add "Cover 0", "Cover 1", "Cover 2", "Image beside 2").
- The font Aptos is missing: 47 / 32 / 31 / 22 / 1. Aptos Display: 43 / 32 / 28 / 21 / 1.
- SVG images were converted to PNG: 2 / 2 / 7.
- Roboto 5 / 4; Roboto Mono 3 / 0 / 3 / 1; Roboto Medium 1 / 1; Open Sans 1 / 1; Noto Naskh Arabic 1.
- Examples only: Segoe UI 4, Grandview 4, Grandview Display 2, Montserrat 2, Segoe UI Semibold 2, Lucida Sans 2, Segoe UI Light 2, Tenorite and Tenorite Display 1 each, Constantia 1.
- Stacked Line charts aren't supported and were converted to regular Line chart type. Slide(s) 3: district-literacy-acceleration-plan (default, native).
- There aren't any warnings for this presentation: font test D only.

(a) 0.35.1 against 0.36.0, same corpus deck: 38 decks have a panel in both; none differs (33 identical in full, 5 identical in the visible rows).
(b) Lines outside the four known kinds: none.
(c) Example decks with no warning: none confirmed; 14 captured example files show only the media line (branch-modernization-investment-case, digital-services-modernization, fy27-budget-tradeoff-deck, japan-market-entry-readout, onboarding-experience-redesign, school-safety-preparedness-brief, special-education-services-plan; both modes).

## Round trip

- 036/examples: 274 rows; 252 imported, 22 failed; no slide-count mismatch. 036/qualification: 67 rows, 1 failed (coverage-charts).
- 0351/qualification: no round trip (that run exported no `back.pptx`), so 0.35.1 against 0.36.0 cannot be compared for the corpus.
- The TSV error column is cut off; `opf-036 convert` was re-run on all 23 failures (outputs in `_ops/work-summary/err/`).
- One failure group, 23 files: `import-failed`, `invalid-chart-cache`, "Invalid chart cache: point index is outside its declared count. Repair the chart data before importing." All match opf#1477 (XML read in every `back.pptx`). No `c:multiLvlStrRef` failure (opf#1478) among the examples.
  - The 22 example files (11 decks, both modes): alumni-giving-campaign, boutique-hotel-revenue-recovery, defect-escape-reduction-review, demand-generation-campaign-brief, drive-thru-throughput-playbook, policy-briefing-for-advisors, port-dwell-time-improvement-plan, renewal-save-plan, research-findings-report, video-demo-sales-narrative, water-utility-capital-plan. Fails at `c:ser[1]/c:tx/c:strRef/c:strCache`: `c:f` `Sheet1!$A$3`, `c:ptCount` 1, the only `c:pt` has `idx="1"` (the second series' name cache of the two-series doughnut).
  - coverage-charts: `chart25.xml` `c:val/c:numRef/c:numCache`, `ptCount` 3 with points at idx 0, 1, 3.

## Not checked

Rows hidden below the third row; the 71 no-panel and the idle files; whether the missing fonts are really not installed (from `installed-fonts.json`); the 0.35.1 matrix `back.pptx` files; main and experiments round trips.
