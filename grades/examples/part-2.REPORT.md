# Example decks in Keynote 16.0 (OPF 0.36.0), part 2 of 3

Saved by the supervisor from the grader's hand-back (2026-11-27). 51 decks (list lines 52-102, explicit-chart-reference-lines to promoted-region-grid), 39 with a native file, no static file: 90 files, 612 slide records in `part-2.grades.json`. Graded from pictures (grid sheets, full-size reads, preview | default | native montages); scores only ranked.

| Mode | same | small | wrong |
|---|---|---|---|
| default (331 slides) | 46 | 229 | 56 |
| native (281 slides) | 32 | 197 | 52 |

Notes: hidden slides are skipped in Keynote and not graded. Native: 66 slides differ from default (pixel threshold, then looked at); the rest are "as default". "Same" was given by rule (compare score under 0.02 and no override), so the 46 are less certain than small and wrong. Native differs only by how body text re-wraps; it fixes the card overflow in managed-detection 2 and 4; it changes no alpha, bullet or chart finding.

## Recorded findings that recur (default-mode slides)

| Id | Slides | Decks |
|---|---|---|
| Font substituted (known) | about 340 incl. native | all |
| QC-04 live number skips hidden slide | 8 | housing, kiosk, library, mixed-use, policy, port, roadmap, full-feature-tour (slide 11) |
| QC-03 footer behind full-bleed picture | 5 | housing 8, manager-training 8, model-governance 8, port 8, product-launch 8 |
| LY-01 | 1 | layout-sampler 1 |
| SW-01 | 2 | layout-sampler 25 (wrong), 45 (small) |
| SW-02 (native) | 1 | layout-sampler 24 |
| LY-02 | 2 | investor 6, photo-essay 6 |
| QC-10 legend order reversed | 8 | grant, japan, mixed-use, photo-essay, roadmap 7, fy27 3, library 3, manager-training 7 |
| QC-08 axis scale (scatter) | 4 | manager 3, field-enablement 3, kiosk 3, mixed-use 7 |
| #1416 item 5 reference label dropped | 8 | explicit-chart-reference-lines 1, localized-chart-references 1-7 |
| #1416 item 6 stacked line unstacked, line labels dropped | 4 | fan 3, german 3, housing 3, investor 3 |
| #1416 item 1 radar filled | about 5 | manager 7, photo 3, roadmap 7, mixed-use 3, grant 3 |
| Per-point bar colors not drawn | 7 | layout-sampler 22, 23, 28, 39, 40, 41, 48 |
| Monospace faces | 9 | investor, manager, model, photo, pricing, product-launch (slide 9), layout-sampler 26, 47, full-feature-tour 7 |
| `alphaModFix` on a `p:bg` picture dropped (Keynote limit; fill read in XML: model-governance slide 2) | 29 | model-governance (all 10), product-launch (all 10), port-dwell (9; slide 1 wrong) |
| Link in a sentence in the theme hyperlink color | 1 | full-feature-tour 2 |

Background picture: the 20% opacity is lost; saturated purple and magenta squares and bars overprint the title and text. model-governance and product-launch graded wrong on every slide, port-dwell slide 1 wrong, the rest small. Not seen: RT-02, MX-*, LG-* or any chart-cache finding in a picture.

## New findings

1. **EX2-01 (wrong): a pattern-fill background with alpha is drawn at full strength.** Preview: plain light slide. Keynote: strong diagonal hatch over the whole slide. fan-experience-operations-brief 1-6, policy-briefing-for-advisors 1-8 and 10, pricing-and-packaging-decision 1-10, default and native: 37 slides plus 5 overlapping other findings. Read in the file: master `p:bg` is `a:pattFill prst="wdUpDiag"`, `a:fgClr` CBD5E1 alpha 18000, `a:bgClr` FFFFFF alpha 18000; Keynote ignores the alpha. Sheet `EX2-01-pattern-fill-alpha-hatch.jpg`.
2. **EX2-02 (wrong on 2, small on 12): a picture bullet is drawn at its own aspect and pushes the text right.** Preview: tiny mark. Keynote: the 320x96 image at line height (about 3.3 times as wide as high); line 1 starts past the wrapped lines; in german-works 6 and parks 6 line 1 runs off the slide. fan 6, field-enablement 6, german 6, identity 6, investor 10, kiosk 10, library 10, mixed-use 10, online 6, parks 6, photo-essay 10, policy 10, pricing 10, roadmap 10. Read in the file: `a:buBlip`, `a:buSzPct val="100000"`, `marL="427342"`, `indent="-427342"`. PowerPoint not checked. Sheet `EX2-02-picture-bullet-size.jpg`.
3. **EX2-04 (wrong): a two-series doughnut is drawn with one ring.** Preview: two rings with ring labels "Current", "Baseline". Keynote: one ring, no ring labels. policy-briefing-for-advisors 7, port-dwell-time-improvement-plan 7. `back.pptx` keeps `series: 2`. Sheet `EX2-04-doughnut-two-series-one-ring.jpg`.
4. **EX2-05 (wrong): card text written as unwrapped lines leaves the card and the slide.** managed-detection-market-update 2 (default; native wraps it); german 6 together with EX2-02. Inferred: per-line paragraphs, wider in Helvetica (LY-01 family, in a body card). Sheet `EX2-05-card-text-runs-off-slide.jpg`.
5. **EX2-03 (small): line and area charts are drawn on the tick marks.** Preview: points inset (`c:crossBetween val="between"`). Keynote: first point on the left axis edge, last on the right. explicit-chart-reference-lines 1; localized-chart-references 1-7; fy27 3, library 3, promoted-region-grid 2: 14 slides. Not hit: full-feature-tour 3, percentStacked areas. Cause inferred (the second `lineChart` group of the reference line is a candidate). Sheet `EX2-03-category-axis-between-ignored.jpg`.

## Round trip

4 of 90 fail to import back: policy-briefing-for-advisors (default, native), port-dwell-time-improvement-plan (default, native). Run on policy-briefing `back.pptx`: `import-failed`, `invalid-chart-cache`, "Invalid chart cache: point index is outside its declared count." (RT-01, #1477). Exactly the two decks with the two-series doughnut; cause there not confirmed; port-dwell not run by the grader.

## Not looked at

`objects.json`, the user-interface list; native slides under the pixel threshold (copied from default).
