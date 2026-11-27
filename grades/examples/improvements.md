# Keynote 16.0 and the 0.36.0 example decks: what OPF could write so Keynote shows the preview

Not issues: in each case below OPF's file is valid (it matches OPF's preview and the DrawingML it means), and Keynote 16.0 reads it differently. Each section says what was seen, what the file says, and what OPF could write instead. **Every proposal is untested: no variant was made or opened in Keynote or PowerPoint.** PowerPoint costs come from the repository's docs where they say something, otherwise "unknown". 0.37.0 = the published npm packages of 2026-11-27, exported here with the example sources adapted for the renamed keys (`languageFamily` to `scriptGroup`, `cs` to `complexScript`, `speaker.organizationId` to `organization`, `chart.line` to `lineSeries`).

## EX-01 A doughnut with two series draws one ring

- Seen: 11 slides in 11 decks, default and native, all graded wrong. The preview draws nested rings (first series innermost, ring labels "Current", "Baseline"); Keynote draws one ring and no ring labels. Sheet `sheets/EX-01-doughnut-two-series-one-ring.jpg`.
- File (read): one `c:doughnutChart`, `varyColors 1`, two `c:ser` with four points each. Keynote's `back.pptx` keeps both series (read), so the data is there; only one ring is drawn (inferred: Keynote's doughnut plots one data series).
- Round trip: the same 11 decks are the only example decks that fail to import after Keynote in 0.36.0; 0.37.0 imports them (see `1477-comment-doughnut.md`).
- What OPF could write: (a) the documented fallback of a multi-series doughnut as a picture when the target is Keynote (`--charts picture` does this today for every chart); (b) one single-series doughnut chart frame per ring, stacked concentrically, the outer one with a hole large enough for the inner frame. PowerPoint cost of (b): the rings become separate charts with separate data; (a) loses the native chart. Unknown beyond that.
- 0.37.0: still two `c:ser` in one `c:doughnutChart` (read: defect-escape-reduction-review 3, policy-briefing-for-advisors 7, renewal-save-plan 3).

## EX-02 A slide-background picture with opacity is drawn at full strength

- Seen: 70 graded slides in 11 decks, both modes (106 slide-mode rows wrong, 34 small): purple and magenta artwork at full strength behind titles and text. The file scan predicts 76 slides in the same 11 decks. Sheet `sheets/EX-02-picture-background-alpha.jpg`. Already in the round's list of Keynote limits ("`alphaModFix` ... dropped on a `p:bg` picture fill").
- File (read): `p:bg/p:bgPr/a:blipFill/a:blip/a:alphaModFix amt="20000"` (model-governance-review master and slides; design-backgrounds slide 4 `amt="28000"`). `docs/image-treatments.md` maps a background picture's `opacity` to `a:alphaModFix`.
- What OPF could write: the picture already blended at its opacity over the slide's base color (a pre-composited raster) with no `alphaModFix`. PowerPoint cost: none visible (inferred); the picture's transparency is then no longer an editable setting, and the media part differs from the source asset, so the importer would need the provenance tag to restore `opacity` (unknown whether it reads one).
- 0.37.0: still `alphaModFix amt="20000"` (model-governance-review, read) and 28000 (design-backgrounds 4).

## EX-03 A pattern-fill slide background with alpha is drawn at full strength

- Seen: 65 graded slides in 11 decks (81 wrong, 43 small slide-mode rows): a strong gray diagonal hatch over the whole slide where the preview is almost plain. The file scan predicts 81 slides in the same 11 decks. Sheet `sheets/EX-03-pattern-background-alpha.jpg`. Pattern fills on shapes were judged "not a difference" earlier in the round; this is the background with alpha.
- File (read): master `p:bg/p:bgPr/a:pattFill prst="wdUpDiag"`, `a:fgClr` `CBD5E1` with `a:alpha 18000`, `a:bgClr` `FFFFFF` with `a:alpha 18000` (fan-experience-operations-brief, research-grant-pitch, and 9 more decks; design-backgrounds slide 5 with alpha 20000).
- What OPF could write: opaque pattern colors pre-blended over the base: foreground `CBD5E1` at 18% over white is about `F6F7FA` (computed), background `FFFFFF`. PowerPoint cost: none visible if PowerPoint composites a transparent background over white (inferred, not checked); the pattern's alpha is no longer editable.
- 0.37.0: still `a:alpha 18000` on both pattern colors (fan-experience-operations-brief, policy-briefing-for-advisors, water-stewardship-grower-brief; read).

## EX-04 A picture bullet is drawn at the image's own aspect

- Seen: 39 graded slides in 39 decks (56 wrong, 18 small slide-mode rows); the file scan finds `a:buBlip` on 40 slides in 40 decks. The preview draws a tiny mark; Keynote draws the 320 x 96 logo at about line height, pushes the first line right (off the slide in german-works-council-update 6, parks-master-plan-workshop 6, robotics-quality-escape-briefing 6, satellite-maintenance-readiness-review 6, workplace-occupancy-reset 6) and the wrapped line loses the hanging indent. Sheet `sheets/EX-04-picture-bullet-aspect.jpg`.
- File (read, court-backlog-reduction-plan 6, renewal-save-plan 6): `a:buBlip` on a 320 x 96 PNG (the organization's full logo: these decks give `organization.logo` as one asset, so the `icon` shape falls back to it), `a:buSzPct val="100000"`, `marL="427342" indent="-427342"`. `docs/design-resolution.md` (listBullet) says PowerPoint draws an `a:buBlip` at 100% as a square of 0.65 times the font size and the preview draws the image in that square; that was measured with square images, so what PowerPoint does with a 320 x 96 image is unknown.
- What OPF could write: a square bullet raster, the logo fitted (letterboxed) into a transparent square, as the preview's `bulletBox` draws it; optionally fall back to the character bullet when the logo is far from square and no icon is given. PowerPoint cost: none expected for the square raster (it is the shape PowerPoint was measured with); unknown for the size Keynote then draws.
- Also: the example decks could name an icon (`organization.logo.icon`); several carry a `brand-icon` asset that is not used.
- 0.37.0: still a 320 x 96 `a:buBlip` image (renewal-save-plan 6, read).

## EX-07 Category labels below the chart frame on a combo chart with a manual outer plot area

- See `1492-comment-combo-labels.md`: six slides in six decks, the same cause as #1492 (inferred). What OPF could write: the inner plot area, as #1492 proposes. PowerPoint cost: none expected (the #1425 form); not checked.

## EX-08 The full-feature-tour pull quote runs past the slide's right edge (CT-01)

- Seen: full-feature-tour 5, default; new against 0.35.1 (the control round). The quote is one line `wrap="none"`, 27.6 pt (0.35.1: 24 pt), in a box at x 548640, width 11094720 EMU (ends inside the 12192000 slide; read). Aptos Display is missing on this Mac and Helvetica is wider, so the line runs off the slide. OPF's preview fits it.
- Seen with `--typefaces safe` (`keynote/036/experiments/x-safe__full-feature-tour__default`, slide 5): Keynote wraps the quote to two lines in Arial and it fits.
- What OPF could write: nothing new; `--typefaces safe` already fixes it (cost: Arial instead of the deck's face). Font substitution, same family as LY-01/LG-01.
- 0.37.0: same box, `sz="2760"`, `wrap="none"` (read).

## EX-09 Card text written as unwrapped lines leaves the card and the slide

- Seen: managed-detection-market-update 2, default (native wraps it, per the grader). Four `OPF text slides.1.text line N` boxes, `wrap="none"`, theme minor font Segoe UI, which this Mac lacks (read). Font substitution, as EX-08.
- What OPF could write: `--body-text native` (seen to fix it) or `--typefaces safe` (not run on this deck).
- 0.37.0: still per-line `wrap="none"` boxes (read).

## EX-10 Line and area charts drawn on the tick marks (`c:crossBetween between` ignored)

- Seen: 13 graded slides in 7 decks (all small), plus robotics-quality-escape-briefing 3 seen here. The preview insets the first and last point half a category; Keynote draws them on the axis edges. Sheet `sheets/EX-10-cross-between-ignored.jpg`.
- File (read): every hit chart writes `c:crossBetween val="between"`. Two kinds are hit: a standard (unstacked) `c:areaChart` (6 slides in the file scan: compliance-readiness-review 7, executive-workshop-facilitation 3, fy27-budget-tradeoff-deck 3, library-modernization-roadmap 3, promoted-region-grid 2, robotics-quality-escape-briefing 3), and a line chart whose reference line is a second `c:lineChart` group on the same axes (explicit-chart-reference-lines 1, 3; localized-chart-references 1 to 7). A line chart with one `c:lineChart` group (25 slides, for example full-feature-tour 3) is not hit (seen by the grader). Keynote's `back.pptx` writes `midCat` for the areas (read) and keeps `between` for the two-group lines.
- What OPF could write: for the reference-line charts, the reference series inside the same `c:lineChart` group as the data series; for standard areas no file form is known (Keynote rewrites the axis itself), so the option is to accept edge-to-edge there, as OPF already does for stacked areas (`docs/chart-options.md`, "A stacked area runs edge to edge"). PowerPoint cost: unknown for the merged group (the reference line's own formatting must survive); the area option changes the preview.
- 0.37.0: still `between` with two `c:lineChart` groups (explicit-chart-reference-lines 1, 3) and on the standard area (executive-workshop-facilitation 3) (read).

## EX-12 Step names in a named semibold face come out regular

- Seen: duration-timeline 1, default (graded small). "Discover" and "Launch" are written with the face `Roboto SemiBold` and no `b`; "Build" (the current step) with `b="1"` (read). Roboto SemiBold is not installed here, so Keynote uses Helvetica regular for the two and Helvetica-Bold for "Build" (read in `probe.json`).
- What OPF could write: with a named weight face, also `b="1"` for weights of 600 and up, so a reader without the face falls back to bold. PowerPoint cost: where Roboto SemiBold is installed, `b="1"` on it may be drawn as a synthetic bold of the semibold (unknown); `--typefaces safe` is the existing route (not run on this deck).
- 0.37.0: same runs (read).
