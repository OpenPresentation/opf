# pptx.gallery support by dimension (FF-23)

Measured 2026-09-23 (UTC). Program: [README.md](README.md). Tracker:
[burndown.md](burndown.md). Audit scripts, raw results and the per-item
machine-readable file: [gallery-support/](gallery-support/README.md).

This page records what a developer actually gets today when they take a
pptx.gallery value's "OPF Config" snippet and run it through the OpenPresentation
packages. It measures the engines, not the schema: a value that validates but
changes nothing in the preview or the PPTX is not reported as working.

**Headline: 4 of 900 gallery values are perfect by parity** (FF-38, current
mains on 2026-09-23, after the FF-20, FF-25, FF-26, FF-27 and FF-34 merges).
This is the program's progress metric. The 900 values are the 793
presence-audited values plus 107 parity-only records: 76 charts and 31
`withAssets` variants. The presence audits below find 352 of 793 values
`works` (7 at the first measurement). Audit B now resolves theme colours and
classifies languages from measured fields, and audit A detects the native
slide-image picture; see the
[measurement notes](#measurement-notes-2026-09-23-re-run).

Two measurements are recorded here:

- **Presence (audits A and B, FF-23).** Does the value have an effect, in
  native form, and does it survive re-import?
- **Parity (FF-38).** Do the preview and the exported PPTX agree element by
  element?

| Repository | Presence audits A and B | Parity scoreboard (FF-38) | Previous parity run (opf#122) | Parity baseline (history) |
| --- | --- | --- | --- | --- |
| opf (core) | `1ad25df` | `6263985` | `c278532` | `53be042` |
| opf-render | `bc436f3` | `bc436f3` | `47d19b2` | `e500ed9` |
| opf-pptx | `9092954` | `9092954` | `5b657c9` | `cf0bc0c` |
| opf-editor | `214ae69` (audit B) | not used | not used | not used |
| pptx-gallery | `f17e9ae` | `f17e9ae` | `f17e9ae` | `f17e9ae` |

Node 24.21.0. No Office or COM was used; native PowerPoint behaviour is
recorded separately (FF-04, FF-12). All three measurements now run on the same
merged mains. They include FF-07, FF-08, FF-17, FF-18, FF-19, FF-24, FF-28,
FF-32, FF-35, FF-35b and FF-39, the merged engine halves of FF-25, FF-26,
FF-27 and FF-34 (opf-pptx#65 included), FF-31's exporter half
(opf-pptx#63) and FF-22's core half. The parity scoreboard was re-run at opf
`6263985` (opf#139; documentation and harness only since `a74f3f6`) after
the harness learned to map the FF-26 slide-image picture and, since, to fail
non-finite geometry and check crop position; the run before the mapping is
kept at
[parity/history/2026-09-23-opf137/PARITY.md](gallery-support/parity/history/2026-09-23-opf137/PARITY.md).
The presence audits were re-run at opf `33d636d` (documentation and harness
only since `a74f3f6`) with the FF-36 audit probe update; unmodified, they
reproduce the committed `a74f3f6` classes exactly. They were re-run again at
opf `1ad25df` (documentation only since `33d636d`) after the FF-36 audit
hardening, with no class change. pptx-gallery is still `f17e9ae`: none
of its program PRs (#40 to #46) has merged, so every snippet is the
pre-program snippet. The per-dimension prose below the summary
table describes the first measurement unless a paragraph says otherwise.

## Method

Each value uses the exact document the gallery page emits: `lib/opf-snippets.ts`
from pptx-gallery is bundled with esbuild and linked to the local core build.
Two audits split the 14 dimensions.

- **Audit A** (layouts, content blocks, image treatments, backgrounds,
  headers/footers): core `validatePresentation`; catalog and reference
  resolution; opf-render SVG compared with a baseline document without the
  dimension; opf-pptx export with OPC and dimension-specific native XML checks;
  `fromPptx` re-import; docs/evidence hits. Values whose snippet references an
  undeclared `asset:*` id are re-run with a real raster (`withAssets`).
- **Audit B** (color schemes, font schemes, languages, themes, narratives,
  audiences, tones, socials): core validate and lint; catalog lookup;
  opf-render in three font modes (no registry, the strict bundled base pack,
  and the office pack with visual substitution); opf-pptx export with a
  full-package inventory (every `typeface=`, script fonts, `lang`/`rtl`, theme
  `clrScheme`, slide colours, `app.xml`); re-import; and for metadata
  dimensions a consumption diff (field removed, SVG and every PPTX part compared
  byte for byte).
- **Parity (FF-38)** covers every dimension, charts included. It renders the
  traced preview (`renderSvgDeck` with `trace: true`, plus
  `resolvePresentation` geometry) and exports with `toPptx` (default options,
  no registry). It maps PPTX shapes to preview items, first by the exporter's
  stable object names and otherwise by geometric containment, then compares
  them check by check. Scripts and results are in
  [gallery-support/parity/](gallery-support/parity/PARITY.md).

## Parity scoreboard

A value is **perfect** when every check passes, **near** when the only
failures are near deltas, and **mismatch** when at least one check fails. The
checks are:

| Check | Passes when |
| --- | --- |
| geometry | Text-line anchors and baselines are within 0.02 pt; chart, table, picture and card frames equal the composed box within 0.02 pt; a picture's crop places the image content where the preview does, within 0.02 pt at the visible edges. Deltas up to 0.5 pt are near; a non-finite delta fails. |
| text | Same line text and run segmentation. Per run: the same family in the script slot the text uses (`latin`/`ea`/`cs`), size within 0.005 pt, bold, italic and resolved colour. Also the same paragraph alignment and list markers. Native charts: preview labels are in the chart caches, and the chart XML names the preview font. |
| fills | Same background kind and colour; per element group, the same solid fill colours and the same images (sha256); chart series colours appear in the preview. |
| zOrder | The order of mapped element groups in `spTree` matches the SVG paint order, and the slide count matches. |
| slideSize | `p:sldSz` equals the SVG viewBox within 0.02 pt. |
| typefaces | Every `typeface=` in every part, charts and embedded workbooks included, and every font in `app.xml` is a family the preview uses. Theme per-script supplements are reported but not gated. |
| reimport | `fromPptx` preserves color scheme, font scheme, theme, background, dimensions, language, narrative, tone, audience and slide layout ids. A loss with a specific diagnostic is near; a silent loss fails. |
| fontResolution | Every family the preview uses resolves, in the office pack with visual substitution, to the real face or a metric-compatible substitute. |
| theme | Theme major/minor `latin` equal the preview heading/body fonts, and the theme `clrScheme` equals the document color scheme. |
| mapping | Every preview element group has PPTX shapes and the reverse; an unmapped PPTX shape is near. |

Checks passed, all 900 values (current mains, 2026-09-23 re-run), with the
run before the slide-image mapping (opf#137) and the opf#122 run for
comparison:

| Run | perfect | geometry | text | fills | zOrder | slideSize | typefaces | reimport | fontResolution | theme | mapping |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Current mains | 4 | 880 | 759 | 766 | 880 | 900 | 900 | 899 | 5 | 900 | 890 |
| Before slide-image mapping (opf#137) | 4 | 774 | 759 | 674 | 784 | 900 | 900 | 899 | 5 | 900 | 672 |
| Previous (opf#122) | 0 | 390 | 326 | 734 | 880 | 900 | 0 | 0 | 5 | 900 | 890 |

The four perfect values are the font schemes `calibri`, `courier-new`,
`times-new-roman` and `roboto`. slideSize, typefaces and theme pass
everywhere. Re-import passes for 899; the `photography` snippet, which has no
asset, loses its background with a specific diagnostic (near).

Per dimension (current mains; slideSize, typefaces and theme pass everywhere):

| Dimension | Values | perfect | geometry | text | fills | zOrder | reimport | fontResolution | mapping |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| layouts | 485 | 0 | 481 | 436 | 421 | 485 | 485 | 0 | 475 |
| color-schemes | 14 | 0 | 0 | 14 | 14 | 14 | 14 | 0 | 14 |
| font-schemes | 89 + 4 legacy | 4 | 93 | 93 | 93 | 93 | 93 | 4 | 93 |
| languages | 93 | 0 | 93 | 93 | 93 | 93 | 93 | 0 | 93 |
| backgrounds | 6 (+6 withAssets) | 0 (0) | 6 (6) | 6 (6) | 5 (6) | 6 (6) | 5 (6) | 0 (0) | 6 (6) |
| narratives | 10 | 0 | 10 | 10 | 10 | 10 | 10 | 0 | 10 |
| charts | 76 | 0 | 76 | 26 | 9 | 76 | 76 | 0 | 76 |
| themes | 4 | 0 | 4 | 4 | 4 | 4 | 4 | 0 | 4 |
| audiences | 14 | 0 | 14 | 14 | 14 | 14 | 14 | 0 | 14 |
| tones | 7 | 0 | 7 | 7 | 7 | 7 | 7 | 0 | 7 |
| socials | 10 | 0 | 10 | 10 | 10 | 10 | 10 | 0 | 10 |
| headers-footers | 10 (+10 withAssets) | 0 (0) | 10 (10) | 0 (0) | 10 (10) | 0 (0) | 10 (10) | 0 (0) | 10 (10) |
| blocks | 32 | 0 | 30 | 25 | 30 | 32 | 32 | 1 | 32 |
| image-treatments | 15 (+15 withAssets) | 0 (0) | 15 (15) | 0 (15) | 15 (15) | 15 (15) | 15 (15) | 0 (0) | 15 (15) |

Socials, tones, narratives, languages and the other non-layout metadata
dimensions now fail only font resolution (the Aptos to Carlito visual
substitute).

### Measurement notes (2026-09-23 re-run)

- **Fills 842 to 734 at opf#122 is a stricter check, not a regression.** The
  chart series-colour comparison was already in the baseline harness, but the
  baseline built chart part names as `ppt/slides/` plus the relationship
  target. The exporter writes absolute targets (`/ppt/charts/chartN.xml`), so
  no chart part was found and the comparison passed vacuously. opf#122 resolves
  targets per OPC, so the comparison now runs. In the committed opf#122
  results, 166 values fail fills; exactly 108 of them fail only on
  `chart series colors not in preview` (charts 67, layouts 39, blocks 2), and
  those are exactly the per-dimension drops from the baseline (charts 76 to 9,
  layouts 442 to 403, blocks 25 to 23). 842 minus 108 is 734. The other 58
  failures are the same as the baseline's.
- **Fills 734 to 674, mapping 890 to 672 and zOrder 880 to 784 at opf#137
  were a harness gap, now closed.** The FF-26 exporter writes
  `design.slideImage` as one picture named `OPF slide image slides.N`, which
  the name matcher did not recognise. The containment fallback left it
  unmapped or put it in a content item's group, so 225 values failed mapping,
  106 of them also image count and picture frame geometry, and 96 z-order.
  The 225 are every value whose snippet has a slide image: 202 layouts, 4
  blocks, 3 audiences, `themes/dark` and the 15 image treatments with assets.
  Compared directly, every one has exactly one preview slide image and one
  exported picture, with 0 pt frame delta, identical image bytes and the
  picture first in `spTree`. Cropped side and band placements carry the
  preview's 25% `a:srcRect` crop; fit placements use a -50% inset that
  letterboxes the image as the preview does. The harness now maps the picture
  to the preview slide-image group and compares its visible image rect (see
  the [gallery-support README](gallery-support/README.md#slide-image-mapping-ff-26)).
  No tolerance changed and no value regressed.
- **Audit B probes and classifier (FF-36 audit update).** Before the update,
  audit B read slide colours and the `p:bg` fill only from `srgbClr`, so after
  FF-24 all 14 colour schemes and all 4 themes were `broken` ("colour
  mismatch", "export non-solid"), and several reasons were fixed text printed
  whatever was measured. Now:
  - Slide colours resolve `a:schemeClr` through each slide's own chain,
    followed by relationships: slide to layout to master to theme. The colour
    map is the innermost override (slide `clrMapOvr`, then layout `clrMapOvr`,
    then the master `p:clrMap`). A missing or ambiguous link, or a master
    without `p:clrMap`, is a reason in every dimension, and nothing falls back
    to master 1, theme 1 or a default map. If the slides reach more than one
    theme, that is also a reason, because the theme font and `clrScheme`
    checks read one theme. Current exports have one master and one theme, with
    no override. A colour with child transforms (`lumMod`, `lumOff`, `tint`,
    `shade`, `alpha`) is reported as unresolved and can never count as
    agreeing, because the audit, like the parity harness, does not compute
    transforms. None occurs in current exports.
  - Preview and export are compared deck-wide and slide by slide: scheme slots
    used, any resolved export colour the preview slide does not paint, and the
    slide background. All 14 schemes and 4 themes agree on every slide, with
    the theme `clrScheme` at 12/12. They are `partial` because 42 of the 55
    slide colour uses in each colour-scheme deck (2 of 3 in each theme deck)
    still write a scheme slot colour as literal `srgbClr`, for example text in
    `light1` `FFFFFF`. The FF-24 acceptance asks for `schemeClr` there.
  - Languages are classified from the catalog `ooxmlLang`, `direction` and the
    script slot of the gallery's native name, against the slide runs, `rtl`
    paragraphs, run and theme `ea`/`cs` faces, the preview and re-import.
    All 93 are `partial`; see [Languages](#languages).
  - Every reason is conditional on a measured field, and `works` needs an
    empty reason list. Socials therefore move from `works` to `partial`: the
    pre-program snippet renders no handle in preview or export
    (`handleInPreview` and `handleInExport` false), although re-import returns
    the socials for 10 of 10. Narratives, audiences and tones stay `works`:
    removing the field changes `ppt/tags/opfDocument.xml` and re-import returns
    the value for all 31; the preview is identical, as expected for authoring
    metadata.
  - `sharedExportGaps` is now measured over the 245 exports. The only gap
    every export shares is the `heading-import-reflow` re-import diagnostic.
  - Mutation checks, run on scratch copies of the exported packages: pointing
    the slides' `accent1` references at `accent2`, swapping `bg2`/`tx2` in the
    master colour map, or recolouring theme `accent1` makes every colour scheme
    `broken`; adding `lumMod` to `accent1` references reports the unresolved
    transform. None of these leaves a value `works`. Pointing the master at a
    second theme part (`accent1` and `dk2` changed, `theme1.xml` left in
    place), or giving the layout a `bg2`/`tx2`-swapped `clrMapOvr`, makes every
    colour scheme `broken`. Dropping slide 1's layout relationship adds
    "export colour chain unresolved" to all 245 values (0 `works`). The
    previous audit, which read `theme1.xml` and `slideMaster1.xml` by name,
    ignored all three.
  - `handleInExport` searches only slide, layout and master XML. Before, it
    also searched `ppt/tags/opfDocument.xml`, which embeds the OPF document
    (hex-encoded today, so the result was the same). With the handles written
    in plain text into that part, the previous audit dropped the "not in the
    export" reason; the current one keeps it, and drops it only when the
    handles are in slide text.
- **Audit A image treatments (FF-36 audit update).** The probe used to require
  more pictures than a baseline document, but the baseline keeps the slide's
  own image as a picture, so it never fired. It now finds the picture named
  `OPF slide image slides.N`, requires its `r:embed` to resolve to an image
  part, and compares its visible frame and crop with the traced preview at
  0.02 pt, using the parity harness geometry (`visibleImage`, `placedImage`,
  `cropDelta`). With the asset supplied, all 15 pictures match at 0 pt with
  the preview's image bytes, and `side-by-side` and `image-strip` are `works`.
  The other 13 are `partial` because their treatment collapses to the same OPF
  document as others. The published snippets have no asset, so neither preview
  nor export has a slide image and all 15 stay `partial`. In mutation checks,
  removing or renaming the picture, taking its crop from one side (240 pt and
  135 pt crop deltas), or moving it by 1 pt turns both `works` values
  `partial` with a named reason. When the probe does not run (the value or
  baseline export failed), the value gets "slide-image probe not run" and
  cannot be `works`. Before, a failing baseline left `native` null, and
  `side-by-side` and `image-strip` stayed `works` without a probe. The gallery fixes are
  pptx-gallery#44 and #45, which are still open.

### Universal blockers

One failure still blocks nearly every value. Three earlier universal blockers
no longer fail on current mains: the theme `clrScheme` (FF-24; theme 900
pass), re-import (FF-32; 899 pass, and the one other value loses its
background with a specific diagnostic) and package typefaces (FF-08; 900
pass). FF-07 and FF-08 stay in review pending FF-05. The fourth, centered
preview text against left-aligned PPTX text (FF-39), is much reduced but not
cleared: text passes for 759 and geometry for 880. 39 values still show the
reverse mismatch, "alignment l (preview) vs ctr (pptx)", so FF-39 stays in
review.

| Blocker | Check (passed) | Values hit | Fix |
| --- | --- | --- | --- |
| The preview renders Aptos and Aptos Display with the visual substitute Carlito (754). 93 families have no face at all (133 values). | fontResolution (5) | 754+ | FF-31 (core and renderer halves open: opf#133, opf-render#44) |

Other recurring parity failures:

- Z-order inversions between element groups: 20 values, all of them
  headers/footers (10, plus 10 with assets).
- Charts and chart blocks: series colours are missing from the preview (108
  values), and preview labels are missing from the chart cache (46 values;
  FF-22, FF-22b).
- Text: 45 values have a preview line missing in the PPTX, and 39 are still
  left-aligned in the preview but centered in the PPTX (FF-39, FF-29 opf#132).

The per-item parity status is in `support-status.json` (`parity`, plus
`parityOnly` for charts). The full report, with a before/after table against
the previous run, is [PARITY.md](gallery-support/parity/PARITY.md).

### Baseline (history)

First run, 2026-09-23, at opf `53be042`, opf-render `e500ed9`, opf-pptx
`cf0bc0c` and pptx-gallery `f17e9ae`, before both opf#122 harness fixes
(relationship targets resolved per OPC; single text lines compared by rendered
extent). 0 of 900 were perfect. Checks passed:

| geometry | text | fills | zOrder | slideSize | typefaces | reimport | fontResolution | theme | mapping |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 378 | 273 | 842 | 880 | 900 | 0 | 0 | 5 | 0 | 890 |

The report is kept at
[parity/history/2026-09-23-baseline/PARITY.md](gallery-support/parity/history/2026-09-23-baseline/PARITY.md).
The previous run (opf#122, after both fixes) is kept at
[parity/history/2026-09-23-opf122/PARITY.md](gallery-support/parity/history/2026-09-23-opf122/PARITY.md).

## Status legend

The definitions are the audits' own classifiers
([audit A `classify`](gallery-support/audit-a/scripts/audit.mjs),
[audit B `classify`](gallery-support/audit-b/scripts/summarize.mjs)).

| Status | Definition |
| --- | --- |
| `works` | Schema-valid; every catalog reference resolves; the preview shows the value (differs from the baseline); the export is a valid package with the dimension's native PowerPoint XML; re-import keeps the value; and the audit recorded no reason against it. In audit B every reason is a measured result, and `works` needs an empty reason list. |
| `partial` | Schema-valid, preview and export succeed and the value has an effect in at least one of them, but at least one fidelity check fails (no native XML, preview/export disagreement, re-import loss, unresolved reference, gallery option dropped by the snippet). Audit B: color schemes and themes whose preview and export colours agree deck-wide and slide by slide; font schemes whose export writes the chosen major/minor families with no foreign typeface; languages whose field changes the preview or export. |
| `schema-only` | Validates and renders/exports without error, but the preview is identical to the baseline and the export has no native equivalent (audit A); or, for languages, removing the field changes neither the preview nor any PPTX part (audit B). |
| `authoring-metadata` | The catalog id resolves in core, and removing the field leaves the SVG and every PPTX part byte-identical. It is consumed only by validator/lint/bundle catalog checks, opf-editor transfer mapping and authoring skills. |
| `broken` | Schema-invalid, or preview, export or re-import throws; or the export contradicts the value, for example typefaces that differ from the scheme, or slide colours (`a:schemeClr` resolved through the exported theme) or backgrounds that differ from the preview (audit B). No value is `broken` on current mains. |
| `gallery-only` | The gallery id has no core equivalent: a legacy gallery layout slug with no OPF canonical id, portable only through inline `catalogs.layouts.records` (audit A; its measured class is kept as `measuredStatus`); or a narrative/audience id missing from the core catalog (audit B). |

`support-status.json` also flags `previewOnly` for audit A values whose
preview shows the value while the export has no native equivalent.

## Summary

Presence: 793 values measured across 13 dimensions; charts have no presence
status until FF-22. 352 values are `works` (7 at the first measurement; 362
before the FF-36 audit probe update moved socials to `partial`).
Parity: 4 of 900 perfect. Counts are for current mains; the "What actually
works" column keeps the first measurement's wording unless marked "Now".

| Dimension | Values | works | partial | schema-only | authoring-metadata | gallery-only | broken | Parity perfect | What actually works for a developer |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| [Layouts](#layouts) | 485 | 289 | 126 | 0 | 0 | 70 | 0 | 0/485 | Snippets validate, preview and export. Only 30 layouts are in the core catalog. Now: re-import keeps design and emits specific diagnostics (FF-32), so 289 are `works`. |
| [Color schemes](#color-schemes) | 14 | 0 | 14 | 0 | 0 | 0 | 0 | 0/14 | Now: theme `clrScheme` 12/12 and `schemeClr` references (FF-24); preview and export colours agree slide by slide. `partial` because 42 of 55 slide colour uses still write scheme slot colours as literal `srgbClr`. |
| [Font schemes](#font-schemes) | 93 | 0 | 93 | 0 | 0 | 0 | 0 | 4/93 | Export without a font registry writes the chosen heading/body families for all 93. Now: `calibri`, `courier-new`, `times-new-roman` and `roboto` are perfect by parity. |
| [Languages](#languages) | 93 | 0 | 93 | 0 | 0 | 0 | 0 | 0/93 | Now: slide runs carry the catalog `ooxmlLang` (93/93), right-to-left text exports `rtl` and previews right-to-left (6/6), and re-import keeps the language (93/93). `partial` on font availability and engine font-scheme derivation. Parity fails only font resolution. |
| [Backgrounds](#backgrounds) | 6 | 2 | 4 | 0 | 0 | 0 | 0 | 0/6 | Solid and gradient work end to end. Now: `photography` with its asset is `works`; the three pattern slugs still collapse in the gallery snippet (pptx-gallery#43). |
| [Narratives](#narratives) | 10 | 10 | 0 | 0 | 0 | 0 | 0 | 0/10 | Now: every id resolves in core (FF-28). `works` only because the exporter-written `ppt/tags/opfDocument.xml` part changes; the preview is identical when the field is removed. |
| [Charts](#charts) | 76 | | | | | | | 0/76 | Core catalog reduced to the 25 Aspose.Slides-supported types (FF-22, opf#121); the gallery half is pending. No presence status yet. Parity: geometry passes; chart text passes for 26, colours for 9. |
| [Themes](#themes) | 4 | 0 | 4 | 0 | 0 | 0 | 0 | 0/4 | Background and fonts apply in preview and export. Now: background and colours resolve through the theme and agree with the preview; `partial` on literal scheme colours and font availability. |
| [Audiences](#audiences) | 14 | 14 | 0 | 0 | 0 | 0 | 0 | 0/14 | Now: every id resolves in core (FF-28). `works` only because `ppt/tags/opfDocument.xml` changes; the preview is identical. |
| [Tones](#tones) | 7 | 7 | 0 | 0 | 0 | 0 | 0 | 0/7 | `works` only because `ppt/tags/opfDocument.xml` changes; the preview is identical. |
| [Socials](#socials) | 10 | 0 | 10 | 0 | 0 | 0 | 0 | 0/10 | Now: re-import returns the organization and speaker socials for 10/10 (FF-34). The pre-program gallery snippet shows no footer, so no handle is rendered in preview or export, and audit B now classes them `partial` for that. The rendering snippet is pptx-gallery#42. Parity fails only font resolution. |
| [Headers & footers](#headers-and-footers) | 10 | 1 | 9 | 0 | 0 | 0 | 0 | 0/10 | Now: native slide-number and date fields (FF-27). The snippet still drops gallery options (pptx-gallery#45), and 3 dated values report `unresolved-content`. |
| [Content blocks](#content-blocks) | 32 | 29 | 3 | 0 | 0 | 0 | 0 | 0/32 | Blocks render and export. `market-opportunity` and `financial-snapshot` still lose metric text (FF-30, pptx-gallery#44). |
| [Image treatments](#image-treatments) | 15 | 0 | 15 | 0 | 0 | 0 | 0 | 0/15 | Now: `design.slideImage` renders and exports as a native picture (FF-26); with the asset supplied, all 15 match the preview frame and crop at 0 pt, and `side-by-side` and `image-strip` are `works`. The snippets still omit the asset and collapse 13 treatments to two documents (pptx-gallery#44, #45). |

### Shared export gaps (every exported value, audit B)

At the first measurement. On current mains FF-24, FF-07, FF-08 and FF-32 have
merged, and the parity theme, typefaces and re-import checks pass for 900,
900 and 899 values.

- The theme `clrScheme` is the Office default (`accent1` `4472C4`); only
  `dk1`/`lt1` match a chosen scheme, and only by coincidence (FF-24).
- Theme major/minor `ea`/`cs` are `typeface=""` (FF-07).
- `docProps/app.xml` "Fonts Used" lists Arial and Calibri (FF-08).
- Every run is `lang="en-US"`, with no `rtl` (FF-07).
- `fromPptx` keeps only `design.dimensions`: colour scheme, font scheme, theme,
  language, narrative, tone, audience, organization and speaker are dropped
  with no diagnostic, and every re-import emits `heading-import-reflow`
  (FF-32).

### Fonts in every environment

- **Export.** With no font registry, `toPptx` writes the chosen family names
  and needs no installed fonts, so it behaves the same locally and in
  containers or serverless functions without system fonts. With the office
  pack and `substitutionPolicy: 'visual'`, `toPptx` writes the substitute
  (Carlito, Cousine, Gelasio, Arimo or Tinos) instead of the chosen family, for
  7 font schemes and the `minimal` theme (FF-31). Do not pass a substituting
  registry to export until FF-31 lands.
- **Preview.** Without a registry the SVG names the family and the host
  resolves it; in a browser that is the installed or web font, and on a
  fontless server it is an unmeasured fallback. The strict bundled pack throws
  `font-unavailable` for 92 of 93 font schemes (only `roboto` passes). Under
  `loadOfficeFontRegistry()`, 547 of the 548 audit A values throw
  `font-unavailable`, mostly because the default `aptos` scheme's
  `Aptos Display` has no local face there (the others name Segoe UI Semibold,
  Georgia, Montserrat, Poppins, Grandview Display or Open Sans).
- **Licensing.** 30 of 89 upstream schemes and all 4 legacy gallery schemes
  use openly licensed families (Roboto, Montserrat, Open Sans, Poppins,
  PT Serif, Raleway, 24 Noto families; Playfair Display, Source Sans Pro,
  Bebas Neue, Lora, Merriweather Sans). Only Roboto is bundled. The other 59
  upstream schemes, including the default Aptos, use Microsoft fonts that are
  not openly licensed; they cannot be bundled. Today they must come from the
  host or be supplied by the caller through `createFontRegistry`
  ([font fidelity](../../font-fidelity.md)). FF-31 implements the owner font
  policy. Licensed (proprietary) families are never bundled or embedded: they
  render through shipped open replacements, and the PPTX keeps the real name.
  Open families are bundled, and they may be embedded only through the
  explicit FF-13 embed path.
  FF-35 records the owner decision to keep `aptos` as the one shared default.

## Layouts

485 measured entries: 415 canonical OPF layout ids (30 in the core bundled
catalog: 15 under the Dark master and 15 under the OPF master; 385 carried by
the snippet as inline `catalogs.layouts.records`) plus 70 legacy gallery-master
slugs with no OPF canonical id (`gallery-only`; all 70 measured `partial`).

- **Works.** Every snippet validates, previews and exports. None is `works`.
- **Doesn't.**
  - The core catalog has 30 of the 415 canonical ids; the rest are portable
    only as inline records.
  - The preview shows a layout effect for 387; export placement differs from
    the no-layout default for 277. 98 are identical to the default in both.
  - Re-import keeps the layout id for 0 of 485: 81 drop it silently (geometry
    flattened), 404 with import diagnostics that do not name the layout (for
    example `heading-import-reflow`).
  - If a re-import that drops the id with any diagnostic counted as a pass,
    211 of 485 would be `works`.
- **Preview vs export.** 110 layouts change the preview but not the PPTX
  shape placement.
- **Fonts.** Layout snippets use the default scheme; see the registry probe
  above.
- **Parity (FF-38).** 0 of 485 perfect. Geometry passes for 281, text for
  266, fills for 403 and mapping for 475. Most geometry and text failures are
  alignment: the preview centers text that the PPTX left-aligns (FF-39).
  Layouts with charts fail fills on series colours and fail chart fonts.
- **Fixes.** FF-29 (catalog parity, export placement, re-import id or specific
  diagnostic); FF-31 (fonts).

## Color schemes

14 values, all `partial`. Every id resolves in core.

- **Works.** Preview and export apply the scheme colours and agree slot for
  slot (at least five scheme colours used per deck).
- **Doesn't.** Colours are exported as literal `srgbClr`, not `schemeClr`, and
  the theme `clrScheme` is the Office default: it matches 2 of 12 slots (4 of
  12 for `corporate-blue`). Recolouring the deck in PowerPoint therefore does
  not follow the chosen scheme.
- **Re-import.** The colour scheme id is dropped silently (14/14).
- **Now (audit B, opf `33d636d`).** `partial` 14. The theme `clrScheme`
  matches 12/12 slots, 11 of 55 slide colour uses per deck are `schemeClr`,
  and resolved through the theme they agree with the preview on every slide,
  backgrounds included. 42 uses still write a scheme slot colour as literal
  `srgbClr` (for example text in `light1`), which FF-24 asks to be
  `schemeClr`. Re-import returns the colour scheme id for 14 of 14.
- **Parity (FF-38).** 0 of 14 perfect. Fills, z-order, mapping and, since
  FF-24, the theme check pass. Text and geometry fail on the centered-text
  blocker.
- **Fixes.** FF-24 (theme colours and scheme references), FF-32 (re-import).

## Font schemes

93 values (89 upstream catalog schemes and 4 legacy gallery schemes that the
gallery inlines, not in the core catalog), all `partial`.

- **Works.** Export without a registry writes the chosen major/minor families
  into the theme and runs, with no foreign typeface, for all 93.
- **Doesn't.**
  - Theme `ea`/`cs` are empty for all 93 (FF-07).
  - Preview tier: bundled 1 (`roboto`); office-pack substitute 7 (`aptos`,
    `calibri` to Carlito; `consolas`, `courier-new` to Cousine; `georgia` to
    Gelasio; `tahoma` to Arimo; `times-new-roman` to Tinos); host-only 85
    (strict preview throws `font-unavailable`; host-font preview is an
    unmeasured fallback).
  - 5 non-Latin schemes also fail their sample text under the strict pack.
- **Preview vs export.** With the office pack and visual substitution, the
  preview renders the substitute and the export then writes it, so the chosen
  family is lost (7 schemes plus the `minimal` theme). With the strict pack
  both throw for 92 of 93. Without a registry, export always succeeds with the
  chosen names.
- **Re-import.** `fontScheme` is dropped silently.
- **Fonts and licensing.** See [Fonts in every environment](#fonts-in-every-environment).
- **Parity (FF-38).** 0 of 93 perfect. Font resolution passes for 4 of 89
  upstream schemes (real face or metric substitute) and none of the legacy
  four.
- **Fixes.** FF-31 (availability, substitution never rewrites export), FF-35
  (shared default), FF-07 and FF-08 (script slots, no leaked defaults), FF-17
  (code role), FF-32 (re-import).

## Languages

93 values, all `partial`. Audit B derives the class from measured fields
only (re-run at opf `33d636d`, opf-pptx `9092954`, opf-render `bc436f3`;
see the [measurement notes](#measurement-notes-2026-09-23-re-run)). Every id
resolves in core.

- **Works (FF-07, FF-19, FF-32).**
  - Removing `language` changes both the preview and the export for all 93.
    In the preview the only change is the SVG `lang` attribute. The export
    parts that change include the slide, masters, theme and
    `ppt/tags/opfDocument.xml`.
  - Slide runs carry exactly the catalog `ooxmlLang` for 93 of 93, for
    example Arabic `ar-SA`, Japanese `ja-JP`, Norwegian `nb-NO` and
    Chittagonian `bn-BD`. Only the two English entries export `en-US`.
  - Direction is measured on the gallery's native name used as the title. The
    six right-to-left languages (Arabic, Hebrew, Pashto, Persian, Urdu and
    Punjabi (Shahmukhi)) export `rtl="1"` on that paragraph, and the preview
    marks the same line right-to-left, 1 of 1 each. No left-to-right language
    has an `rtl` paragraph. The snippet's own Latin subtitle is written
    `rtl="0"`. The earlier count of 39 `rtl` attributes was package-wide
    (presentation, master and notes defaults), not slide paragraphs.
  - The native name uses the `cs` font slot for 21 languages and `ea` for 4
    (the parity harness's script test). In each, the runs name the language's
    font in that slot. For the 24 languages whose scheme is not `aptos`,
    theme major/minor `ea` and `cs` carry the language's font, for example
    Arabic Typesetting, Shonar Bangla and Microsoft YaHei. No foreign typeface
    appears in any export.
  - Re-import returns the language id for 93 of 93, and the font scheme with
    it.
- **Remaining gaps.**
  - The language's font scheme is not bundled for any of the 93, so the strict
    preview reports `font-unavailable`. The 66 languages on `aptos` preview
    through the office pack (Aptos to Carlito). The other 27 fail both packs;
    26 of them also hit `missing-glyph` on bundled Roboto (Amharic, Arabic,
    Armenian, the Indic scripts, CJK, Georgian, Hebrew, Khmer, Persian, Pashto,
    Thai, Urdu and others). This is FF-31 and FF-19.
  - Theme `ea`/`cs` stay empty for 69 languages: the 66 on `aptos`, plus
    Amharic (Nyala), Armenian and Georgian (Sylfaen). Whether those empty
    values are allowed depends on FF-05. Amharic and Georgian native text uses
    the `cs` slot, so audit B records it as a reason for those two.
  - The engines do not yet derive the font scheme from `language` alone
    (`engineAppliesLanguageFontScheme` false for all 93). The visible font
    comes from the `design.fontScheme` that the gallery snippet injects.
- **Native finding (FF-04, not yet a merged evidence bundle).** PowerPoint's
  `Presentation.Fonts` for an unedited exporter deck lists a nameless font and
  `Aptos` at open. Filling theme major/minor `ea`/`cs` (Carlito) did not change
  that list, so the empty script slots are not the source of the at-open
  `Aptos` (FF-05 continues).
- **Parity (FF-38).** 0 of 93 perfect. Geometry, text, fills, z-order,
  typefaces, re-import, theme and mapping pass for all 93; only font
  resolution fails.
- **Fixes.** FF-31 (font availability), FF-19 (script fonts), FF-05 (empty
  `ea`/`cs` policy).

## Backgrounds

6 values: `works` 2 (`solid-color`, `subtle-gradient`), `partial` 4.

- **Works.** Solid and gradient backgrounds export as native `solidFill` and
  `gradFill` and re-import.
- **Doesn't.**
  - `geometric-pattern`, `abstract-shapes` and `minimal-texture` produce the
    same OPF background, so the three gallery choices are indistinguishable.
    The preview draws a pattern; the export writes solid white with no
    `pattFill`; re-import does not return a pattern.
  - `photography` references `asset:cover` without an `assets` entry (preview
    `unresolved-asset`). With a real image supplied it is still `partial`: no
    `blipFill` in `p:bg`, and re-import does not return an image background.
- **Preview vs export.** 4 disagree (preview shows it, export has no native
  equivalent).
- **Parity (FF-38).** 0 of 6 perfect, and 0 of 6 with an image supplied. Fills
  pass only for solid and gradient; for patterns and photos the background
  kind and colour differ.
- **Fixes.** FF-25.

## Narratives

10 values: `authoring-metadata` 1 (`problem-solution`), `gallery-only` 9.

- **Role.** Narrative is authoring metadata: it is consumed by
  validator/lint/bundle catalog checks, opf-editor transfer mapping and
  authoring skills. It currently has no effect on preview or export
  (byte-identical when removed). The narrative schema describes a story arc of
  beats and does not state a render role.
- **Doesn't.** 9 of 10 gallery ids (`heros-journey`, `what-so-what-now-what`,
  `situation-complication-resolution`, `star-method`, `pyramid-principle`,
  `sparkline`, `data-story`, `change-story`, `vision-roadmap`) are not in the
  core narratives catalog. Validator and lint warn. The same ids make 24
  content blocks `partial`.
- **Re-import.** Dropped silently.
- **Parity (FF-38).** 0 of 10 perfect. Re-import drops the narrative with no
  diagnostic.
- **Fixes.** FF-28.

## Charts

76 gallery chart objects, reduced under FF-22 to the chart types Aspose.Slides
supports:
- **Core half, merged.** [opf#121](https://github.com/OpenPresentation/opf/pull/121) (`13ab00b`) keeps 25 chart-type records, one
  per supported Aspose.Slides `ChartType`. It deprecates the other 51 with a
  named replacement rather than deleting them. See
  [aspose-chart-types.md](aspose-chart-types.md).
- **Gallery half, pending.** [pptx-gallery#40](https://github.com/Data-Advantage/pptx-gallery/pull/40).
- **Follow-up.** FF-22b covers native `chartex` export and full renderer
  coverage for the kept types.

The presence audits did not measure charts, and the parity numbers below
predate the reduction.

Parity (FF-38) measured all 76 on current mains: 0 perfect. Geometry,
z-order and mapping pass for all 76; text passes for 26 and fills for 9. The
rest miss preview labels in the chart cache or preview series colours.
Typefaces fail for all 76: the chart XML uses Arial, and the embedded workbook
uses Geneva, Arial and Calibri (FF-08). These numbers predate the gallery half
of FF-22. Per-chart parity is in `support-status.json`
`parityOnly`.

## Themes

4 values, all `partial`. Every id resolves in core.

- **Works.** Background and fonts apply in preview and export, and a
  theme-only document applies the bundle: `minimal` `011842` with Aptos
  Display/Aptos; `classic` `FFFFFF` with Tenorite; `dark` `000000` with
  Seaford; `bold` `FFFFFF` with Impact/Grandview.
- **Doesn't.** The theme `clrScheme` is the Office default (2 of 12 slots).
  Fonts: `minimal` previews only through the Carlito substitute (and exports
  Carlito if that registry is passed to `toPptx`); `classic` and `dark` fonts
  are not bundled and have no substitute; `bold` substitutes (Anton, Oswald)
  are not bundled.
- **Re-import.** Keeps only `dimensions`; the theme id is dropped silently.
- **Now (audit B, opf `33d636d`).** `partial` 4. The theme `clrScheme`
  matches 12/12, the `p:bg` `schemeClr` resolves to the expected
  background, and colours agree with the preview. Reasons: text written in a
  scheme slot colour as literal `srgbClr` (2 uses each), and fonts that are
  not bundled (`minimal` previews through Carlito). Re-import returns the
  theme id for 4 of 4.
- **Parity (FF-38).** 0 of 4 perfect. Geometry and text pass for 3 of 4.
- **Fixes.** FF-24, FF-31, FF-32.

## Audiences

14 values: `authoring-metadata` 2 (`board`, `all-hands`), `gallery-only` 12.

- **Role.** Authoring-only by design: the audience schema describes records as
  hints "used by AI-driven generation". Byte-identical preview and export when
  removed.
- **Doesn't.** 12 of 14 gallery ids are not in core. Some differ only in form
  from core ids (gallery `executive`, `investor`, `customer`, `regulatory`;
  core `executives`, `investors`, `customers`, `regulators`). Unlike
  narratives, the validator does not warn on an unknown audience. 12 snippets
  also reference a narrative missing from core.
- **Re-import.** Dropped silently.
- **Parity (FF-38).** 0 of 14 perfect. Geometry and text pass for 10 of 14.
- **Fixes.** FF-28.

## Tones

7 values, all `authoring-metadata`. Every id resolves in core.

- **Role.** Authoring-only by design: the tone schema describes voice cues
  that AI-driven generation uses to shape output. Byte-identical preview and
  export when removed.
- **Re-import.** Dropped silently (FF-32 requires a diagnostic).
- **Parity (FF-38).** 0 of 7 perfect. Re-import drops the tone with no
  diagnostic.

## Socials

10 values, all `authoring-metadata`. Every id resolves in core.

- **Role.** Organization and speaker socials currently have no effect on
  preview or export; the handle is not rendered. This is not by design: the
  social-platform schema says renderers use the record to format URLs and pick
  icons. Neither the schema nor the gallery record carries a platform size or
  aspect ratio.
- **Re-import.** Organization and speaker are dropped.
- **Now (audit B, opf `33d636d`).** `partial` 10. Re-import returns the
  organization and speaker socials for 10 of 10 (FF-34), and removing them
  changes `ppt/tags/opfDocument.xml`, but the pre-program gallery snippet
  renders no handle in preview or export (pptx-gallery#42).
- **Parity (FF-38).** 0 of 10 perfect.
- **Fixes.** FF-34.

## Headers and footers

10 values, all `partial`. Headers and footers are OPF furniture; native
PowerPoint `p:hf` objects stay out of scope.

- **Works.** Furniture text appears in preview and export.
- **Doesn't.**
  - Slide numbers are exported as static text, not `a:fld type="slidenum"`,
    so they do not renumber in PowerPoint (10/10).
  - Dates are static text with no `datetime` field (3/3 dated values).
  - 3 slot collisions: `dated-footer`, `client-delivery-footer` and
    `version-control-footer` merge date and slide number into one
    `footer.right` slot.
  - The snippet drops gallery options: `hideOnTitleSlide` (6), slide-number
    formats `{current} / {total}` and `A-{current}` (2), date formats (3), and
    the legal line of `classification-banner` (the classification line wins
    `footer.center`). `slide-number-only` and `slide-number-progress` emit
    identical OPF.
- **Preview vs export.** 10 disagree (preview furniture, no native field).
- **Re-import.** The 3 dated values lose furniture
  (`invalid-furniture-provenance`); they also report `unresolved-content` in
  preview and export.
- **Editor.** `/editor?config=headers-footers:<slug>` uses the generic
  snippet builder and emits the same design for every slug.
- **Parity (FF-38).** 0 of 10 perfect, with or without assets. Z-order fails
  for all 10: element groups are inverted (2 to 8 inversions) between the
  preview paint order and `spTree`.
- **Fixes.** FF-27, FF-33.

## Content blocks

32 values: `works` 5 (`pitch-deck-intro`, `problem-statement`,
`solution-overview`, `pricing-options`, `closing-cta`), `partial` 27.

- **Doesn't.**
  - 24 are `partial` only because their narrative id is missing from core
    (29 of 32 would be `works` without that).
  - `market-opportunity` and `financial-snapshot` lose metric text in both
    preview and export (1 and 4 strings, for example "Revenue +22%");
    `financial-snapshot` also overflows in preview.
  - `quote-slide` loses the `quote` payload kind on re-import.
- **Preview vs export.** 1 disagrees (`text-overflow` reported by the preview
  only).
- **Editor.** `/editor?config=blocks:<slug>` emits the same design for every
  slug.
- **Parity (FF-38).** 0 of 32 perfect. Geometry passes for 20, text for 21,
  fills for 23 and font resolution for 1.
- **Fixes.** FF-28, FF-30, FF-33.

## Image treatments

15 values, all `schema-only`. With a real image supplied: `partial` 9,
`schema-only` 6.

- **Doesn't.**
  - Every snippet references `asset:hero` without an `assets` entry, so the
    preview reports `unresolved-asset` and is identical to the baseline.
  - The 15 treatments collapse to 4 distinct OPF documents: 7 are
    `{position: background, fill: crop}` (`full-bleed`, `text-overlay`,
    `caption-overlay`, `duotone`, `background-blur`, `watermark`,
    `cinematic-crop`), 6 are `{position: right, fill: fit}` (`masked-shape`,
    `circular-crop`, `rounded-card`, `collage-grid`, `device-frame`,
    `cutout-subject`), plus `side-by-side` and `image-strip`. Effects such as
    duotone, blur, masks and frames are not expressed.
  - With an image supplied, the right/fit group still has no preview effect,
    and no treatment adds a native picture for `design.slideImage` to the
    PPTX.
- **Re-import.** `design.slideImage` is dropped (15/15; with an image, also
  `unsupported-image-crop`).
- **Now (audit A, opf `33d636d`).** `partial` 15. With the asset supplied,
  each treatment exports one picture named `OPF slide image slides.0` with
  its image part, the preview's image bytes, and the preview's visible frame
  and crop (0 pt). `side-by-side` and `image-strip` are `works`; the other
  13 are `partial` only because their OPF documents collapse. Without the
  asset, neither preview nor export has a slide image.
- **Editor.** `/editor?config=image-treatments:<slug>` emits the same design
  for every slug.
- **Parity (FF-38).** 0 of 15 perfect, with or without an image supplied.
  Without an image, preview and PPTX text lines also differ.
- **Fixes.** FF-26, FF-33.

## Re-running

The presence audits are the regression check for the gaps fixed by FF-24 to
FF-39. The FF-38 parity audit is the progress scoreboard: the baseline is 0 of
900 perfect, against a presence baseline of 7 of 793 `works`. See
[gallery-support/README.md](gallery-support/README.md) for the commands for
both, and regenerate `support-status.json` after every run.
