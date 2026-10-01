# Native PowerPoint checks of FF-62 and the spec-gap closure (2026-09-30 and 2026-10-01)

Run by the supervisor on the Windows 11 host with desktop PowerPoint, through a Windows PowerShell 5.1 helper
with a 45 s deadline per deck (no agent automation of Office). Original decks were opened read-only
(`Presentations.Open(deck, -1, 0, ...)`), every slide was exported as a 1280 x 720 PNG with `Slide.Export`, and
where a round trip was checked a copy was saved with `SaveAs` (`ppSaveAsOpenXMLPresentation`) and imported again
with `fromPptx`. No run showed a repair prompt or a timeout. The decks themselves and the saved copies are not
committed (they name proprietary fonts); this directory keeps the facts and, for the recheck run, the shape
reports and the slide PNGs PowerPoint exported.

## FF-62: chart text at 12 pt (2026-09-30 22:58)

25 decks opened: 16 FF-62 exports (opf-pptx `7561ac5`) and 9 `*-9pt-before` decks from main `71bd94e`.
`Chart.ChartType` was as expected for every construct: column 51, stacked column 52, bar 57, line 4, pie 5,
doughnut -4120, radar -4151, scatter -4169, treemap 117, histogram 118 (two decks), pareto 122,
box-and-whisker 121, waterfall 119, funnel 123.

Fit at 12 pt, judged on the exported PNGs: a 49-category column, a stacked column and a line chart rotate their
category labels 90 degrees with no overlap or clipping; 20 long bar labels, 24 pareto categories (rotated, two
wrap to two lines), 12 radar spokes, treemap tiles and histogram bins all fit. A pie draws no slice labels, as in
the preview; its legend is 12 pt.

## P1 round trip and sections (opf-pptx#122, 2026-09-30 23:22)

- `sections.pptx`: `SectionProperties` reads Default Section (slides 1-2), Introduction (3-4),
  "Findings & results <2026>" (5-6), Default Section (7), Next steps (8), with the footers showing the section
  names on slides 3-6 and 8. Identical after `SaveAs` and reopen. After renaming "Introduction" to "Opening" in
  PowerPoint and saving, `fromPptx` returns the sections as -, -, Opening, Opening, Findings & results <2026> twice,
  -, Next steps, with `section-reference-changed` at `slides.2.section` and `slides.3.section`.
- `nested-groups.pptx`: after a PowerPoint `SaveAs`, `fromPptx` returns slide 1 as a group `outer` (a row) holding
  an item and an inner group of two texts, then a text block with its `x-review` extension; slide 2 with the
  `top:left`, `top:right`, `bottom:left` and `bottom:right` regions; slide 3 as a text with extensions; slide 4 as
  text, list, metric, code, table and chart. No structure diagnostic. After moving "Inner A" by 6 pt and saving,
  slide 1 imports as flat blocks with `slide-reference-changed` at `slides.0.content`; the other slides keep their
  structure.

## P2 design fields (opf-pptx#124 at `6aedbdc`, 2026-10-01 01:42)

Rendering matched the preview:

- Cover and section logo: the dark lockup on a light cover and the light lockup on a dark cover, top-left at the
  heading's left edge (43.2 pt).
- Header and footer logos: the header icon (754.5, 13.5 pt) and the footer icon (178.5, 491.4 pt) sat at the preview
  positions, and the cover lockup too. Both engines centred an image part in its zone, which the follow-up fix
  moved to the zone edge (core 0.11.4, opf#232, opf-render#85).
- Picture bullets: `a:buBlip` bullets with no carrier picture; the description line and a wrapped line carry no
  bullet. PowerPoint draws `a:buSzPct 100000` at about 0.65 em (12 pt: 10 px, 18 pt: 15 px, 24 pt: 20 px in Arial,
  Aptos, Georgia and Courier New; 36 pt: 31 px), where the preview drew 1 em; fixed in core 0.11.4 and
  opf-render 0.11.9 (`PICTURE_BULLET_SCALE`).
- Accent font: the tag and the quote body in Georgia, the title in Aptos Display, the body in Aptos.

Round trip with provenance on the PR branch: the original decks restored `design.logo`, the header and footer logo
flags, the `listBullet` image and `fontScheme.accent`; the picture-bullets deck reported
`content-structure-changed` at `slides.0` (a bug, fixed before release). PowerPoint-saved copies lost the logo
provenance (`invalid-logo-provenance` at `slides.N.design.logo`, `unresolved-asset-reference` at `design.logo`);
the header and footer logo flags and the accent font survived. Sent back to P2 and fixed in opf-pptx 0.11.7
(PowerPoint renames media parts and drops whitespace between elements, so the logo identity no longer depends on
either, and the document and slide tags carry a `mediaHash`).

## P2 recheck (2026-10-01 03:16, `recheck/`)

The four decks again, after the fixes (the same helper; `*.json` are the shape reports with each shape's box, name,
first font and first bullet type, `*.native.png` the slides PowerPoint exported):

- All logos survive a PowerPoint save on re-import, with no `content-structure-changed`.
- The preview's picture bullet is 16 px, PowerPoint's is 16 px.
- The header and footer icons sit flush to their zone edges.
- The cover, section and header/footer logos, the picture bullets and the accent font render as in the preview.

Release status: the fixes shipped as core 0.11.4, opf-render 0.11.9 and opf-pptx 0.11.7 (the lockstep train of
2026-10-01); the FF-61 tag rule, FF-62 chart text size and the design-fields export are measured on those published
packages in [the burndown](../../programs/font-fidelity-everywhere/burndown.md).
