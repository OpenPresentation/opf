# Example decks in Keynote 16.0 (OPF 0.36.0), part 3 of 3

Saved by the supervisor from the grader's hand-back (2026-11-27). 50 decks (list lines 103-152, quarterly-review to workplace-occupancy-reset): 50 default and 36 native files; 600 records in `part-3.grades.json` (319 default, 281 native). Five hidden slides not exported and not graded (quarterly-review 10, supplier-risk-heatmap 9, tax-portal-modernization 9, video-demo-sales-narrative 9, water-utility-capital-plan 9). Every default grid page read; native: 72 slides whose picture differs from default were looked at, the rest are "as default".

| Mode | same | small | wrong |
|---|---|---|---|
| default | 8 | 232 | 79 |
| native | 6 | 197 | 78 |

## Recorded findings that recur (a slide carries one id, so counts undercount)

| Id / Known row | Default slides (decks) | Native |
|---|---|---|
| font substituted | 197 (41) | 171 (36) |
| `alphaModFix` dropped on a `p:bg` picture fill | 21 (revenue-forecast-inspection, tax-portal-modernization, veterinary-staffing-stabilization) | 21 |
| QC-03 footer behind the picture | 7 (recycling-participation-campaign, revenue-forecast-inspection, supplier-risk-heatmap, tax-portal-modernization, video-demo-sales-narrative, wildfire-evacuation-preparedness, workforce-pathway-partnership; all slide 8) | 7 |
| QC-08 axis scale | 7 | 6 |
| QC-10 legend order reversed | 5 | 5 |
| QC-05 stacked-area labels dropped | 1 (tailings 3) | 1 |
| QC-02 percent axis | 1 (singleton-combo-reference-lines 1) | |
| SW-01 | 1 (workforce-pathway-partnership 6, "Workstream") | 1 |
| LY-02 family: quote text runs into the table | strategy-offsite-pre-read 6, tailings-monitoring-investment-brief 6, transit-corridor-alternatives 6, water-stewardship-grower-brief 6 | |
| Direct line labels / stacked lines | 9 (8) | 7 (7) |
| Radar | 2 (water-stewardship-grower-brief 7, workplace-occupancy-reset 3) | 2 |
| Monospace and light faces | 10 (8) | 8 (7) |
| Elbow / curved connector | 3 (shape-overlays 3, 4, 5) | 3 |
| Rotated narrow text, callout | 2 (shape-effects 4, shape-overlays 2) | 1 |
| Inner shadow, glow, soft edge, blur | shape-effects 2 | |
| QS-08 perspective shadow | shape-effects 1 | |
| Vertical text | shapes 6 | |
| Chart title | rows-chart 1 | 1 |
| Link in a sentence in theme blue | rich-text-runs 1 | 1 |
| Pattern fill on a shape draws as a fine dotted texture (graded small; the Known row says "not a difference") | shapes 3 | |

## New findings

- **EX3-02 (wrong): picture bullets draw as the full logo and the wrapped line loses its hanging indent** (same as EX2-02). 16 slides in 16 decks, both modes; text runs off the right edge in robotics-quality-escape-briefing 6, satellite-maintenance-readiness-review 6, workplace-occupancy-reset 6. XML read in `build/036/examples/renewal-save-plan/default.pptx` slide 6: `a:buBlip`, `a:buSzPct 100000` on 30.59 pt text, `marL=427342 indent=-427342`. Sheet `EX3-02-picture-bullets-large.jpg`.
- **EX3-03 (wrong): a pattern-fill slide background with 18% alpha is drawn at full strength** (same as EX2-01). research-grant-pitch (6 slides), student-mental-health-capacity-review (6), visual-brand-system-sampler (6), water-stewardship-grower-brief (10). XML read: `p:bg/p:bgPr/a:pattFill prst="wdUpDiag"`, `a:alpha 18000` on both colors. Sheet `EX3-03-pattern-background-alpha.jpg`.
- **EX3-01 (wrong): a two-series doughnut draws one ring** (same as EX2-04). renewal-save-plan 3, research-findings-report 3, video-demo-sales-narrative 3, water-utility-capital-plan 3. Two `c:ser` in one `c:doughnutChart` (read). These four decks are the 8 files that fail to import back. Sheet `EX3-01-doughnut-two-series-one-ring.jpg`.
- **EX3-04 (wrong): category labels hang below the chart frame and touch the footer.** support-deflection-program 3, water-stewardship-grower-brief 3 (bar plus line combos, legend at the top, manual outer plot area). Probe: chart frame ends at 551 of 612 pt, footer at 570 pt. Inferred: Keynote reads the manual outer plot area as the inner one (MX-02 family, different symptom). Sheet `EX3-04-axis-labels-below-frame.jpg`.
- **EX3-05 (wrong, native only): the native body list is centered.** slide-design-overrides 2. Read in `native.pptx`: the native body paragraphs carry `algn="ctr"` (with `marL=586740 indent=-586740`); the preview and the default export are left-aligned. An OPF file defect (the file differs from its own preview). Sheet `EX3-05-native-list-centered.jpg`.

## Round trip

86 rows; 78 import; 8 fail: renewal-save-plan, research-findings-report, video-demo-sales-narrative, water-utility-capital-plan (default and native). Slide counts match everywhere. Re-run on renewal-save-plan `back.pptx`: `import-failed`, `invalid-chart-cache`, "Invalid chart cache: point index is outside its declared count." (RT-01, #1477).

## Not looked at

`objects.json`, the user-interface list; native slides matching default; 0.35.1 and main; EX3-01's `back.pptx` chart XML; colors on the grader's own native sheets (unconverted pixels).
