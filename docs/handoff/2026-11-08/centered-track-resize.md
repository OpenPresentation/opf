# RR-20 centered track resize

Separate branch codex/rr-20-centered-track-resize in C:/opf-work/rr-track-resize. Fresh main9545016583ccfa151077cda4d51043ac6505a140 normally merged exact integration5049cb53768df5c420d6591ec3021461253df370 and frozen QA1210/c9a6e479477c5a31e37d8b41ca67a95c3ad7e106. QA1210 is now folded into coordinator integration67dd9ec10b7019cb95807f59c75186482c800f10 and must never receive another push. Normal alignment with67 precedes final source qualification below.

## Confirmed bug and bounded correction

Actual current three-row column: leading130.98px, row heights68.32px, gap24px, body y147.48/h514.92,56px text. Old drawnTracks ignored offsets and allocated all slack to the last row, so an at-rest resize materialized weights[2,2,9.669] and jumped divider0.482 to0.300. Original failure plus actual geometry are retained from QA1210 and this exact new baseline.

Use the existing Composition schema. Exact no-motion requests on implicit tracks return no-op source/history and preserve every accepted text/box. The private plan assigns leading/trailing slack to first/last rows and uses an affine fraction transform. Current scene child bounds conservatively strengthen implicit-conversion minima where flow metadata is shorter than displayed content. Requests clamp to those minima or report a refusal; existing authored weighted behavior stays unchanged. The original positive-first +0.1 case remains an explicit no-shrink refusal; negative-first and positive-last moves use available outer space. No global body-fill, font, schema, chart or title-inference changes.

The canvas bridge now uses the actual physical gap midpoint, removes the half-gap from its fraction origin and uses a signed logical pair length in RTL. A real browser witness on untouched frozen QA source fails the requested/actual pointer-delta check; corrected LTR/RTL both move24.96 requested pixels within0.08pixels, with exact no-motion source, one undo step and exact undo restoration. The first witness attempt used an intercepted locator click; its timeout is retained, then the maintained canvas-coordinate mouse protocol is used without force.

## Vetoable coordinator decisions

1. At rest means exact no-op and no history step.
2. Implicit content-sized conversion must not introduce smaller text; clamp/refuse infeasible directions, keep the original +0.1 request as a meaningful refusal control. Existing explicit weighted semantics remain.
3. Preserve actual divider coordinates and use each pair's physical gap/logical direction; two-track snapping retains small integer ratios after normalized bounds checks.
4. A deliberate authored weighted layout can reflow text. It is not glyph-position identity: all four measured cases move first text up130.98px, while all type remains56px and unrelated dividers stay fixed. This larger visible reflow is disclosed and must be judged, not called full visual-quality closure from divider counts alone.
5. Keep the current schema and auto-layout model. The accepted no-free-XY decision is cloud-editor/burndown.md line45, distinct from the owner's still-open D2 diagrams decision; no broader owner ban is inferred.

## Actual controls and visual scope

Nine focused controls pass: English/Arabic/Japanese two/three-row exact rest; leading/trailing physical allocation; feasible/infeasible directions and extreme/free/snapped movement; unchanged unrelated dividers/content/type; current four-block composition no-shrink safety; actual LTR/RTL pair bounds; two-track whole-ratio and snapped-no-op behavior; implicit filled-row rest; unchanged explicit weights. Original studio-tracks passes with its infeasible request retained as refusal. The maintained studio browser suite passes16checks, including keyboard first nudge, one-step history, readonly, a11y and the new real LTR/RTL pointer witness. It exposed a candidate two-track pair-total normalization error (17%jump), retained and fixed with its own regression.

The [actual four-row sheet](centered-track-data/review-sheet.png) shows English first-up/last-down, Arabic first-up and Japanese last-down, using actual pinned Office visual replacements plus automatic script preparation, no system font discovery. Raw before/after source, PNG, SVG and visual-receipt.json are retained. They are synthetic fixtures, with no Claude comparison panel. Viewed at original detail: type/content remain readable with no overlap; weighted cells produce asymmetric spacing and the disclosed large first-line reflow. No native raster equivalence is claimed. Two bare-core measurement attempts failed at Arabic glyph selection despite loaded script faces; the corrected harness uses renderer-resolved geometry, the path expressly supported by the slide adapter's documented geometry option. These are retained harness failures, not product font fixes.

## Separate current core-flow witness: still open

Four short text blocks configured as a column currently render as a2×2 display-tile arrangement with actual69.32px boxes/56px text, while flow.rows still says four34.16px rows at0/58.16/116.32/174.48. This branch does not repair that emitter or pretend the tracks match. It preserves exact at-rest output and refuses implicit conversion that would consume existing content height. The coordinator owns the independent core-flow diagnosis/fix. A bounds refusal does not close its layout/affordance issue.

Required mapped check on frozen source and exact coordinator integration base follows. Original baseline/build/install, focused failures/recoveries, measured paired images and browser attempts are kept losslessly in centered-track-data. No golden regeneration, Office, provider, deploy, CI observer or chart implementation. Parent owns independent review, integration/full CI, release and site/native acceptance.
