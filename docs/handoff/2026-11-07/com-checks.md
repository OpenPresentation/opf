# PowerPoint (COM) checks still owed

All checks run through PowerPoint's object model on Windows, under the rules in [working-rules.md](working-rules.md#powerpoint-com-work). Run the v0.33.0 final pass on the integration build (see [README.md](README.md)) together with the RR-105 manifest in `scripts/native-acceptance/qualification/` (README there). Export with the shipped CLI, with fonts; export each slide at 1280 x 720; compare with OPF's preview.

## SH-10: text in large shapes grows (#1115)
Check that shape text has the same point size as the preview, breaks at the same lines, and has no autofit.
- `examples/technical/shapes.opf.json`
  - Slide 1 stays at 28 px: eight presets, the siblings at the body size.
  - Slide 2: "path", "can", "cube".
  - Slide 3: the Fills labels.
  - Slide 4: Strokes. "thickThin inside" and "gradient, sketch" wrap to 2 lines.
  - Slide 5: Theme styles. "intense" is bold (SH-11).
  - Slide 6: top and bottom anchoring. "Bottom, with rich runs" wraps.
  - Slide 7: rotated, flipped and linked shapes.
- `examples/technical/shape-effects.opf.json`, slides 1 to 3
  - Labels: "soft", "hard", "perspective", "object", "inner shadow", "glow", "blur", "reflection", "rotated" (turned 20°), "intense style" (bold).
  - The star's "glow and shadow" stays small.
- `examples/technical/shape-overlays.opf.json`, slides 3 and 4
  - Labels: "Plan", "Build", "Ship", "Source", "Upper", "Lower".
  - The "Review" diamond stays small.
- `examples/technical/shape-overlays-rtl.opf.json`, slide 1: "Second" and "First", right to left.

## Charts (#1104, #1105, #1106, #1108, #1111)
1. LH-176 (#1105): bar thickness and gap per category equal the preview. The PPTX keeps `c:gapWidth` 150/50, so PowerPoint should look as before; the preview moved to match it. Slides:
   - `examples/gallery/education/athletics-budget-review` #3
   - `examples/technical/chart-colors` #1
   - `examples/technical/color-variants` #2 and #4
   - `examples/technical/full-feature-tour` #4
   - `examples/gallery/business-functions/investor-relations-update` #7 (now labeled bars, no value axis)
2. LH-182 (#1108): no watermark tiles inside the hole. The surface ellipse ("OPF chart N mark under 1 hole") sits exactly on PowerPoint's hole, with no ring of motif or fill at the inner edge, and the doughnut sits where the preview draws it (plot pinned inner). Slides:
   - `renewal-save-plan` #3
   - `alumni-giving-campaign` #3
   - `research-findings-report` #3
   - `demand-generation-campaign-brief` #7 (a doughnut on a card)
3. RR-105 finding 5 (#1106), qualification corpus `layout-harvest.pptx`:
   - Slide 17: bin labels read [1.2, 3.1], (3.1, 4.9], (4.9, 6.8], (6.8, 8.6].
   - Slide 18: the value axis is 0 to 5,000 by 1,000, and the percentage axis 0% to 100% by 20% (`cx:valScaling`).
   - The file opens with no repair prompt.
4. LH-175 (#1104): native clustered columns of both series, matching the preview. Slides:
   - `partner-ecosystem-launch-kit` #3
   - `visual-brand-system-sampler` #3
   - `curriculum-approval-brief` #7
   - `wildfire-evacuation-preparedness` #3
   - `consulting-margin-recovery-plan` #3
   - `product-launch-narrative` #7
5. LH-93 (#1111): on the two-chart evidence deck described in PR #1111 (horizontal bar siblings), slides 1 and 2, both charts' PlotArea InsideWidth, InsideHeight and InsideTop are equal.
6. LH-110 (#1118, wave 2): on the German and French evidence decks described in PR #1118, the dashed line sits at 92% (label "92 %") on slide 1, and at 30 on slide 2.

## LH-174 (#1110)
- A deck whose lists have icons on only some entries (build it from the cases in `packages/javascript/test/lh-173-174-list-markers.test.mjs`): entries without an icon draw a bullet centered in the icon-chip column, at the preview's position. Sheet: `supervisor/lh-173-174.png` on the evidence branch `handoff/review-sheets-2026-11-07`.

## Later wave, not in 0.33 integration unless folded
- SH-12, `examples/technical/dot-diagrams.opf.json`, slides 1 to 5 (diagrams "shapes"):
  - cluster group
  - "Approved?" diamond
  - stadium shape (roundRect at 50%)
  - dashed labeled back edge
  - undirected graph with open connectors
  - "Deck store" cylinder
  - dark variant with circles and a double circle
  - alt text
- SH-13, `examples/technical/plantuml-diagrams.opf.json`, slides 1 to 8:
  - sequence, with an alt frame
  - class, with a composition diamond, cardinalities and a dashed realization
  - state
  - activity
  - use case, with the «include» relation
  - component
  - mind map
  - gantt, with a milestone
  - alt text on slide 8

## Wave 2: PPTX fixes (#1114, head b7aff87f8)
1. `examples/technical/layout-sampler.opf.json` exported with `--body-text native`:
   - Slide 41: all six cards wrap as the preview does, and "Share results with both teams." stays on one line inside its card.
   - Slide 22: the lead breaks after "before ", not after "deciding".
   - Slide 20: the lead is drawn as measured lines.
   - Spot-check the other native bodies on slides 3 to 42.
2. The #1091 repro deck (one 20 pt title run), plus `examples/gallery/design-and-media/data-story-academy-corporate-programs.opf.json` (default export) slides 1, 5, 6 and 16: the title baseline is within about 1 pt of the preview's (repro: box top + 40.5 pt). This confirms the three-quarters rule at a pitch of about 2.7 times the run size.

## RR-87 (#1099)
- First real Office run of the bounded owned-copy playground helper. The suggested first run is in the PR #1099 body.

## SmartArt live-gate sweep (SH-20 to SH-23)
See [com-job-sh-live-extras.md](com-job-sh-live-extras.md). Its decks are generated by the SmartArt sweep build (the job file lists how). The results feed SH-19's `gate.mjs`.
