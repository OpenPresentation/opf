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
`withAssets` variants. The presence audits below find 362 of 793 values
`works` (7 at the first measurement); see the
[measurement notes](#measurement-notes-2026-09-23-re-run) before reading the
audit B classes.

Two measurements are recorded here:

- **Presence (audits A and B, FF-23).** Does the value have an effect, in
  native form, and does it survive re-import?
- **Parity (FF-38).** Do the preview and the exported PPTX agree element by
  element?

| Repository | Presence audits A and B | Parity scoreboard (FF-38) | Previous parity run (opf#122) | Parity baseline (history) |
| --- | --- | --- | --- | --- |
| opf (core) | `a74f3f6` | `a74f3f6` | `c278532` | `53be042` |
| opf-render | `bc436f3` | `bc436f3` | `47d19b2` | `e500ed9` |
| opf-pptx | `9092954` | `9092954` | `5b657c9` | `cf0bc0c` |
| opf-editor | `214ae69` (audit B) | not used | not used | not used |
| pptx-gallery | `f17e9ae` | `f17e9ae` | `f17e9ae` | `f17e9ae` |

Node 24.21.0. No Office or COM was used; native PowerPoint behaviour is
recorded separately (FF-04, FF-12). All three measurements now run on the same
merged mains. They include FF-07, FF-08, FF-17, FF-18, FF-19, FF-24, FF-28,
FF-32, FF-35, FF-35b and FF-39, the merged engine halves of FF-25, FF-26,
FF-27 and FF-34 (opf-pptx#65 included), FF-31's exporter half
(opf-pptx#63) and FF-22's core half. pptx-gallery is still `f17e9ae`: none
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
| geometry | Text-line anchors and baselines are within 0.02 pt; chart, table, picture and card frames equal the composed box within 0.02 pt. Deltas up to 0.5 pt are near. |
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
previous run (opf#122) for comparison:

| Run | perfect | geometry | text | fills | zOrder | slideSize | typefaces | reimport | fontResolution | theme | mapping |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Current mains | 4 | 774 | 759 | 674 | 784 | 900 | 900 | 899 | 5 | 900 | 672 |
| Previous (opf#122) | 0 | 390 | 326 | 734 | 880 | 900 | 0 | 0 | 5 | 900 | 890 |

The four perfect values are the font schemes `calibri`, `courier-new`,
`times-new-roman` and `roboto`. slideSize, typefaces and theme pass
everywhere. Re-import passes for 899; the `photography` snippet, which has no
asset, loses its background with a specific diagnostic (near).

Per dimension (current mains; slideSize, typefaces and theme pass everywhere):

| Dimension | Values | perfect | geometry | text | fills | zOrder | reimport | fontResolution | mapping |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| layouts | 485 | 0 | 378 | 436 | 332 | 392 | 485 | 0 | 280 |
| color-schemes | 14 | 0 | 0 | 14 | 14 | 14 | 14 | 0 | 14 |
| font-schemes | 89 + 4 legacy | 4 | 93 | 93 | 93 | 93 | 93 | 4 | 93 |
| languages | 93 | 0 | 93 | 93 | 93 | 93 | 93 | 0 | 93 |
| backgrounds | 6 (+6 withAssets) | 0 (0) | 6 (6) | 6 (6) | 5 (6) | 6 (6) | 5 (6) | 0 (0) | 6 (6) |
| narratives | 10 | 0 | 10 | 10 | 10 | 10 | 10 | 0 | 10 |
| charts | 76 | 0 | 76 | 26 | 9 | 76 | 76 | 0 | 76 |
| themes | 4 | 0 | 4 | 4 | 4 | 4 | 4 | 0 | 3 |
| audiences | 14 | 0 | 14 | 14 | 14 | 14 | 14 | 0 | 11 |
| tones | 7 | 0 | 7 | 7 | 7 | 7 | 7 | 0 | 7 |
| socials | 10 | 0 | 10 | 10 | 10 | 10 | 10 | 0 | 10 |
| headers-footers | 10 (+10 withAssets) | 0 (0) | 10 (10) | 0 (0) | 10 (10) | 0 (0) | 10 (10) | 0 (0) | 10 (10) |
| blocks | 32 | 0 | 27 | 25 | 27 | 29 | 32 | 1 | 28 |
| image-treatments | 15 (+15 withAssets) | 0 (0) | 15 (15) | 0 (15) | 15 (15) | 15 (15) | 15 (15) | 0 (0) | 15 (0) |

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
- **Fills 734 to 674, mapping 890 to 672 and zOrder 880 to 784 in this
  re-run.** These follow the FF-26 slide-image composition. 225 values fail
  mapping with `preview element group has no PPTX shape (image)`: the exporter
  now names the picture `OPF slide image slides.N`. The harness recognises
  names `OPF heading|text|card|table|image|chart|code|metric|quote|list <path>`,
  so it does not map that name, and the containment fallback finds no item.
  The same values add `image count` fills failures (106) and `picture frame`
  geometry failures (106). The z-order failures (116) are inversions between
  element groups. This PR does not change the harness. Whether these are
  measurement gaps or real export differences is an open question for the
  harness owner.
- **Audit B classes predate FF-24, FF-32 and FF-34.** Its probes read slide
  colours and the `p:bg` fill only from `srgbClr`. Since FF-24 the export uses
  `schemeClr`, so all 14 colour schemes and all 4 themes are classed `broken`
  ("colour mismatch", "export non-solid"). The parity theme and fills checks
  pass for the same values. Several reason strings are fixed text in
  `summarize.mjs`, for example "re-import loses colorScheme id silently", and
  are printed whatever was measured. Narratives, audiences, tones and socials
  are `works` only because removing the field changes one exporter-written
  part, `ppt/tags/opfDocument.xml`. The preview is identical for all 41, and
  no social handle appears in preview or export (`handleInPreview` and
  `handleInExport` are false), because the pre-program snippet shows no
  footer. Re-import does return the socials for 10 of 10. The results are
  committed as measured; the classifier needs a follow-up before badges
  (FF-36) use audit B.
- **Audit A image treatments.** All 15 are `partial` and still report "export
  adds no native picture for design.slideImage". With the asset supplied, the
  value and its baseline document both export one `p:pic`, so the probe's
  "more pictures than the baseline" rule does not fire. The gallery snippets
  still collapse 13 treatments to two OPF documents and reference `asset:hero`
  without an `assets` entry. Those gallery fixes are pptx-gallery#44 and #45,
  which are still open.

### Universal blockers

One failure still blocks nearly every value. Three earlier universal blockers
no longer fail on current mains: the theme `clrScheme` (FF-24; theme 900
pass), re-import (FF-32; 899 pass, and the one other value loses its
background with a specific diagnostic) and package typefaces (FF-08; 900
pass). FF-07 and FF-08 stay in review pending FF-05. The fourth, centered
preview text against left-aligned PPTX text (FF-39), is much reduced but not
cleared: text passes for 759 and geometry for 774. 39 values still show the
reverse mismatch, "alignment l (preview) vs ctr (pptx)", so FF-39 stays in
review.

| Blocker | Check (passed) | Values hit | Fix |
| --- | --- | --- | --- |
| The preview renders Aptos and Aptos Display with the visual substitute Carlito (754). 93 families have no face at all (133 values). | fontResolution (5) | 754+ | FF-31 (core and renderer halves open: opf#133, opf-render#44) |

Other recurring parity failures:

- Slide images: 225 values fail mapping, 106 fail image count and picture
  frame geometry (see the [measurement notes](#measurement-notes-2026-09-23-re-run)).
- Z-order inversions between element groups: 116 values, including all 10
  headers/footers.
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
| `works` | Schema-valid; every catalog reference resolves; the preview shows the value (differs from the baseline); the export is a valid package with the dimension's native PowerPoint XML; re-import keeps the value; and the audit recorded no reason against it. In audit B, only a metadata value whose catalog id resolves and whose removal changes the preview or export could be `works`; none did. |
| `partial` | Schema-valid, preview and export succeed and the value has an effect in at least one of them, but at least one fidelity check fails (no native XML, preview/export disagreement, re-import loss, unresolved reference, gallery option dropped by the snippet). Audit B: color schemes whose preview and export colours agree; font schemes whose export writes the chosen major/minor families with no foreign typeface; themes whose background and fonts match in both. |
| `schema-only` | Validates and renders/exports without error, but the preview is identical to the baseline and the export has no native equivalent (audit A); or, for languages, no engine reads the field (audit B). |
| `authoring-metadata` | The catalog id resolves in core, and removing the field leaves the SVG and every PPTX part byte-identical. It is consumed only by validator/lint/bundle catalog checks, opf-editor transfer mapping and authoring skills. |
| `broken` | Schema-invalid, or preview or export throws (audit A); or the export contradicts the value, for example typefaces that differ from the scheme (audit B). At the first measurement no value was `broken`; see the measurement notes for the current audit B `broken` rows. |
| `gallery-only` | The gallery id has no core equivalent: a legacy gallery layout slug with no OPF canonical id, portable only through inline `catalogs.layouts.records` (audit A; its measured class is kept as `measuredStatus`); or a narrative/audience id missing from the core catalog (audit B). |

`support-status.json` also flags `previewOnly` for audit A values whose
preview shows the value while the export has no native equivalent.

## Summary

Presence: 793 values measured across 13 dimensions; charts have no presence
status until FF-22. 362 values are `works` (7 at the first measurement).
Parity: 4 of 900 perfect. Counts are for current mains; the "What actually
works" column keeps the first measurement's wording unless marked "Now".

| Dimension | Values | works | partial | schema-only | authoring-metadata | gallery-only | broken | Parity perfect | What actually works for a developer |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| [Layouts](#layouts) | 485 | 289 | 126 | 0 | 0 | 70 | 0 | 0/485 | Snippets validate, preview and export. Only 30 layouts are in the core catalog. Now: re-import keeps design and emits specific diagnostics (FF-32), so 289 are `works`. |
| [Color schemes](#color-schemes) | 14 | 0 | 0 | 0 | 0 | 0 | 14 | 0/14 | Now: theme `clrScheme` and `schemeClr` references (FF-24). The 14 `broken` are an audit B probe artifact; see the measurement notes. |
| [Font schemes](#font-schemes) | 93 | 0 | 93 | 0 | 0 | 0 | 0 | 4/93 | Export without a font registry writes the chosen heading/body families for all 93. Now: `calibri`, `courier-new`, `times-new-roman` and `roboto` are perfect by parity. |
| [Languages](#languages) | 93 | 0 | 0 | 93 | 0 | 0 | 0 | 0/93 | Now: runs carry the language tag, RTL languages export `rtl`, and re-import keeps the language (93/93). The `schema-only` class is a stale classifier; see [Languages](#languages). Parity fails only font resolution. |
| [Backgrounds](#backgrounds) | 6 | 2 | 4 | 0 | 0 | 0 | 0 | 0/6 | Solid and gradient work end to end. Now: `photography` with its asset is `works`; the three pattern slugs still collapse in the gallery snippet (pptx-gallery#43). |
| [Narratives](#narratives) | 10 | 10 | 0 | 0 | 0 | 0 | 0 | 0/10 | Now: every id resolves in core (FF-28). `works` only because the exporter-written `ppt/tags/opfDocument.xml` part changes; the preview is identical when the field is removed. |
| [Charts](#charts) | 76 | | | | | | | 0/76 | Core catalog reduced to the 25 Aspose.Slides-supported types (FF-22, opf#121); the gallery half is pending. No presence status yet. Parity: geometry passes; chart text passes for 26, colours for 9. |
| [Themes](#themes) | 4 | 0 | 0 | 0 | 0 | 0 | 4 | 0/4 | Background and fonts apply in preview and export. The 4 `broken` are an audit B probe artifact; see the measurement notes. |
| [Audiences](#audiences) | 14 | 14 | 0 | 0 | 0 | 0 | 0 | 0/14 | Now: every id resolves in core (FF-28). `works` only because `ppt/tags/opfDocument.xml` changes; the preview is identical. |
| [Tones](#tones) | 7 | 7 | 0 | 0 | 0 | 0 | 0 | 0/7 | `works` only because `ppt/tags/opfDocument.xml` changes; the preview is identical. |
| [Socials](#socials) | 10 | 10 | 0 | 0 | 0 | 0 | 0 | 0/10 | Now: re-import returns the organization and speaker socials for 10/10 (FF-34). The pre-program gallery snippet shows no footer, so no handle is rendered in preview or export; `works` comes from the `ppt/tags/opfDocument.xml` diff. The rendering snippet is pptx-gallery#42. Parity fails only font resolution. |
| [Headers & footers](#headers-and-footers) | 10 | 1 | 9 | 0 | 0 | 0 | 0 | 0/10 | Now: native slide-number and date fields (FF-27). The snippet still drops gallery options (pptx-gallery#45), and 3 dated values report `unresolved-content`. |
| [Content blocks](#content-blocks) | 32 | 29 | 3 | 0 | 0 | 0 | 0 | 0/32 | Blocks render and export. `market-opportunity` and `financial-snapshot` still lose metric text (FF-30, pptx-gallery#44). |
| [Image treatments](#image-treatments) | 15 | 0 | 15 | 0 | 0 | 0 | 0 | 0/15 | Now: `design.slideImage` renders and exports as a picture (FF-26). The snippets still omit the asset and collapse 13 treatments to two documents (pptx-gallery#44, #45). |

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

93 values, all classed `schema-only` by audit B. That class and three of its
reason strings are stale: `summarize.mjs` always adds "no engine reads
`language`" and "re-import drops language", and it adds "RTL language but no
rtl attribute emitted" by language id, whatever was measured. The measured
fields in `audit-b/results.json` on current mains (opf `a74f3f6`, opf-pptx
`9092954`, opf-render `bc436f3`) show the following. Every id resolves in core.

- **Works (FF-07, FF-19, FF-32).**
  - Removing `language` changes both the preview and the export for all 93
    (`previewIdentical` false). The export parts that change include the
    slide, masters, theme and `ppt/tags/opfDocument.xml`.
  - Runs carry the language tag, not a fixed `en-US`. 84 languages export
    exactly their region form, for example Arabic `ar-SA`, Hebrew `he-IL` and
    Japanese `ja-JP`. Only the two English entries export `en-US`.
  - The 9 remaining languages export a normalised tag. Their catalog
    `bcp47` differs, which trips the audit's literal comparison:
    - `zh-Hans` to `zh-CN` and `zh-Hant` to `zh-TW`;
    - `pa-Guru` to `pa-IN` and `vi-Latn` to `vi-VN`;
    - `no` to `nb-NO`, `tl` to `fil-PH` and `zsm` to `ms-MY`;
    - `ctg` to `bn-BD` and `ber-Latn` to `tzm-Latn-DZ`.
  - Right-to-left languages export `rtl` on 39 paragraphs: Arabic, Hebrew,
    Pashto, Persian, Urdu and Punjabi (Shahmukhi).
  - For the 24 languages whose scheme is not `aptos`, theme major/minor `ea`
    and `cs` carry the language's font, for example Arabic Typesetting, Shonar
    Bangla and Microsoft YaHei. No foreign typeface appears in any export.
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
    values are allowed depends on FF-05.
  - The engines do not yet derive the font scheme from `language` alone
    (`engineAppliesLanguageFontScheme` false for all 93). The visible font
    comes from the `design.fontScheme` that the gallery snippet injects.
  - The audit B classifier needs the follow-up noted in the
    [measurement notes](#measurement-notes-2026-09-23-re-run).
- **Native finding (FF-04, not yet a merged evidence bundle).** PowerPoint's
  `Presentation.Fonts` for an unedited exporter deck lists a nameless font and
  `Aptos` at open. Filling theme major/minor `ea`/`cs` (Carlito) did not change
  that list, so the empty script slots are not the source of the at-open
  `Aptos` (FF-05 continues).
- **Parity (FF-38).** 0 of 93 perfect. Geometry, text, fills, z-order,
  typefaces, re-import, theme and mapping pass for all 93; only font
  resolution fails.
- **Fixes.** FF-31 (font availability), FF-19 (script fonts), FF-05 (empty
  `ea`/`cs` policy), and an audit B classifier follow-up.

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
