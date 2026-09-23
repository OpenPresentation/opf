# pptx.gallery support by dimension (FF-23)

Measured 2026-09-23 (UTC). Program: [README.md](README.md). Tracker:
[burndown.md](burndown.md). Audit scripts, raw results and the per-item
machine-readable file: [gallery-support/](gallery-support/README.md).

This page records what a developer actually gets today when they take a
pptx.gallery value's "OPF Config" snippet and run it through the OpenPresentation
packages. It measures the engines, not the schema: a value that validates but
changes nothing in the preview or the PPTX is not reported as working.

| Repository | Measured head |
| --- | --- |
| opf (core) | `2634350` |
| opf-render | `e500ed9` |
| opf-pptx | `ef8a158` |
| opf-editor | `23bc65b` (audit B) |
| pptx-gallery | `f17e9ae` |

Node 24.21.0. No Office or COM was used; native PowerPoint behaviour is
recorded separately (FF-04, FF-12). Core `main` has since advanced past the
measured head (FF-17, [opf#120](https://github.com/OpenPresentation/opf/pull/120)
at `53be042`); the numbers below are for the measured heads until the audit is
re-run.

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
| `broken` | Schema-invalid, or preview or export throws (audit A); or the export contradicts the value, for example typefaces that differ from the scheme (audit B). No measured value was `broken`. |
| `gallery-only` | The gallery id has no core equivalent: a legacy gallery layout slug with no OPF canonical id, portable only through inline `catalogs.layouts.records` (audit A; its measured class is kept as `measuredStatus`); or a narrative/audience id missing from the core catalog (audit B). |

`support-status.json` also flags `previewOnly` for audit A values whose
preview shows the value while the export has no native equivalent.

## Summary

793 values measured across 13 dimensions; charts are handled by FF-22. Seven
values are `works`.

| Dimension | Values | works | partial | schema-only | authoring-metadata | gallery-only | broken | What actually works for a developer |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| [Layouts](#layouts) | 485 | 0 | 415 | 0 | 0 | 70 | 0 | Snippets validate, preview and export. Only 30 layouts are in the core catalog; 110 change the preview but not PPTX placement; re-import never keeps the layout id. |
| [Color schemes](#color-schemes) | 14 | 0 | 14 | 0 | 0 | 0 | 0 | Preview and PPTX show the scheme colours and agree, but as fixed RGB over an Office-default theme `clrScheme`. |
| [Font schemes](#font-schemes) | 93 | 0 | 93 | 0 | 0 | 0 | 0 | Export without a font registry writes the chosen heading/body families for all 93. A measured preview needs the font: 1 bundled, 7 via substitutes, 85 host-only. |
| [Languages](#languages) | 93 | 0 | 0 | 93 | 0 | 0 | 0 | Nothing from `language` itself; only the font scheme the gallery injects changes. Runs are `lang="en-US"`, no `rtl`. |
| [Backgrounds](#backgrounds) | 6 | 2 | 4 | 0 | 0 | 0 | 0 | Solid and gradient work end to end. Patterns and photos preview but export as solid white. |
| [Narratives](#narratives) | 10 | 0 | 0 | 0 | 1 | 9 | 0 | Authoring metadata only; 9 of 10 gallery ids are not in core. |
| [Charts](#charts) | 76 | | | | | | | Reduction to Aspose.Slides-supported types in progress (FF-22). Not measured here. |
| [Themes](#themes) | 4 | 0 | 4 | 0 | 0 | 0 | 0 | Background and fonts apply in preview and export; the theme `clrScheme` stays Office default. |
| [Audiences](#audiences) | 14 | 0 | 0 | 0 | 2 | 12 | 0 | Authoring metadata only, by design; 12 of 14 gallery ids are not in core. |
| [Tones](#tones) | 7 | 0 | 0 | 0 | 7 | 0 | 0 | Authoring metadata only, by design. |
| [Socials](#socials) | 10 | 0 | 0 | 0 | 10 | 0 | 0 | Handles are stored; nothing is rendered or exported. |
| [Headers & footers](#headers-and-footers) | 10 | 0 | 10 | 0 | 0 | 0 | 0 | Furniture text appears, but slide numbers and dates are static text, not PowerPoint fields. |
| [Content blocks](#content-blocks) | 32 | 5 | 27 | 0 | 0 | 0 | 0 | Blocks render and export; 24 are held back only by gallery narrative ids missing from core. |
| [Image treatments](#image-treatments) | 15 | 0 | 0 | 15 | 0 | 0 | 0 | No visible effect: the snippet's image asset is missing, and even with one the PPTX has no picture for the treatment. |

### Shared export gaps (every exported value, audit B)

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
  not openly licensed; they cannot be bundled and must come from the host or be
  supplied by the caller through `createFontRegistry`
  ([font fidelity](../../font-fidelity.md)). FF-31 covers bundling or a
  documented caller-supplied registry for the open families, and the licensing
  note for Aptos. FF-35 records the owner decision to keep `aptos` as the one
  shared default.

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
- **Fixes.** FF-31 (availability, substitution never rewrites export), FF-35
  (shared default), FF-07 and FF-08 (script slots, no leaked defaults), FF-17
  (code role), FF-32 (re-import).

## Languages

93 values, all `schema-only`. Every id resolves in core.

- **Works.** Nothing reads `language`. Removing it leaves preview and export
  byte-identical; the visible font change comes only from the gallery snippet
  injecting the language record's `design.fontScheme`.
- **Doesn't.**
  - Runs are exported as `lang="en-US"` for all 93 (wrong for 91; the two
    English entries match by coincidence). The 5 right-to-left languages
    (Arabic, Hebrew, Pashto, Persian, Urdu) get no `rtl`.
  - The language's font scheme is not bundled for any of the 93 (strict
    preview `font-unavailable`). The 66 Latin, Cyrillic and Greek languages
    that use `aptos` preview through the office pack (Aptos to Carlito); 26 non-Latin languages fail
    both packs and hit `missing-glyph` on bundled Roboto; 1 fails both packs
    but its sample text is covered by Roboto.
  - Theme and run `ea`/`cs` slots are empty.
- **Re-import.** `language` is dropped silently.
- **Native finding (FF-04, not yet a merged evidence bundle).** PowerPoint's
  `Presentation.Fonts` for an unedited exporter deck lists a nameless font and
  `Aptos` at open. Filling theme major/minor `ea`/`cs` (Carlito) did not change
  that list, so the empty script slots are not the source of the at-open
  `Aptos` (FF-05 continues). Filling the slots is still required for script
  fidelity.
- **Fixes.** FF-18 (language/script model), FF-07 (theme and run `ea`/`cs`,
  `lang`, `rtl`), FF-19 (renderer script fonts), FF-31 (font availability),
  FF-32 (re-import).

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
- **Fixes.** FF-28.

## Charts

76 gallery chart objects. The chart dimension is being reduced to the chart
types Aspose.Slides documents as supported, in both the core catalog and
pptx.gallery (deprecating where the removal is breaking). This is in progress
under FF-22 and was not measured by this audit.

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
- **Fixes.** FF-28.

## Tones

7 values, all `authoring-metadata`. Every id resolves in core.

- **Role.** Authoring-only by design: the tone schema describes voice cues
  that AI-driven generation uses to shape output. Byte-identical preview and
  export when removed.
- **Re-import.** Dropped silently (FF-32 requires a diagnostic).

## Socials

10 values, all `authoring-metadata`. Every id resolves in core.

- **Role.** Organization and speaker socials currently have no effect on
  preview or export; the handle is not rendered. This is not by design: the
  social-platform schema says renderers use the record to format URLs and pick
  icons. Neither the schema nor the gallery record carries a platform size or
  aspect ratio.
- **Re-import.** Organization and speaker are dropped.
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
- **Fixes.** FF-26, FF-33.

## Re-running

The audit is the regression check for FF-24 to FF-36. See
[gallery-support/README.md](gallery-support/README.md) for commands, and
regenerate `support-status.json` after every run.
