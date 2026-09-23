# OPF PPTX

Version 0.9.1 keeps core `^0.11.0` and raises the optional `@openpresentation/opf-render` peer to `^0.9.0` so it coexists with editor 0.8.0. ColorRef / `variables` on content colors still hex-resolve through core `resolveColorRef()` before PptxGenJS `srgbClr` export. Unrecognized run colors such as `color:'invalid'` still validate and fall back to the theme text color. Native DrawingML `schemeClr` and theme `clrScheme` writes, and native `p:hf` headers/footers, are not in this release. Import still flattens theme colors to hex. Metric, quote and timeline layout placeholders and the corrected text-bullet contract from 0.8.1 are retained.

Unfinished prepared shaping work is preserved in the [September 15 roadmap](docs/roadmap-shaping-20260915.md); it is not part of the published runtime.

Version 0.8.0 and this checkout require Node 24 (`24.x`). Use `.nvmrc` for local development. Earlier published versions retain their original engine declarations. Browser entrypoints remain browser-safe; native application compatibility is verified separately.

Version 0.8.0 consumes shared heading/scalar/rich line placement, including `textRasterPadding`, through editable native line boxes without autofit. Complete heading tags retain title/subtitle/tag roles, line ordering and current edited text during import. Source boundary metadata also records hard-line separators, so complete scalar/heading groups recover current native text with spaces, tabs and exact authored line endings. Incomplete, duplicate, ambiguous or bulleted groups fall back to ordinary import with diagnostics. Legacy heading tags retain their prior native-line behavior; arbitrary formatting, nesting and geometry are not reconstructed. See the [source contract and limits](https://github.com/OpenPresentation/opf/blob/f94125a1ff95bf0974a055fe1c081d348dad54f2/docs/plans/text-placement.md). Native raster certification remains separate.

Pure local PowerPoint conversion tooling for Open Presentation Format documents. This repo owns the Phase 3 and Phase 4 toolkit lanes: OPF to PPTX export and PPTX to OPF import.

Version 0.7.0's [shared-code integration](docs/code-roundtrip.md) preserves exact source/metadata through guarded native tags and editable lines. XML-forbidden code characters reject export with `invalid-code-text`, the OPF field path and UTF-16 offset; schema validation alone does not establish XML representability. Native source recovery does not reconstruct formatting, geometry or font theme.

Version 0.8.0 includes [shared metric integration](docs/metric-roundtrip.md). Native alignment and exact tested field recovery are implemented; tab-position and raster fidelity gates remain open.

The [native text verifier](docs/native-text-checks.md) has completed 24 separately bounded cases on each supported Node runtime against its recorded source baseline. All 72 imports and 96 original-text ink masks per runtime pass; parent-owned temporary fonts are removed after success, failure and timeout controls. Those historical results do not cover subsequent font-selection changes, edited-text reflow, arbitrary native fidelity or the unresolved chart and metric gates.

Version 0.8.0 physical-font selection consumes optional `fontFace` metadata on accepted text styles. The provider supplies the physical family and its boolean bold/italic style-link flags independently of logical numeric weight. This lets a resolved Roboto SemiBold or ExtraBold face keep its regular legacy-family style rather than requesting a second bold style. Providers without metadata retain the previous numeric-weight behavior; malformed metadata fails with `invalid-font-selection`. Use core 0.10.0 and renderer 0.8.0. [Verification and limits](docs/evidence/font-variants/README.md) distinguish native selection flags from actual Office paint.

Version 0.8.0 also measures `design.contentBox` cards through core's padded interior and exports editable rounded frames at their outer allocation. Native tags identify unchanged empty generated frames on reimport, with a `content-card-reflow` diagnostic: frame appearance and placement are not reconstructed. A name alone never hides a shape; edited, untagged or ambiguous frames use ordinary native import, retaining text or an unsupported-shape description. These source checks do not establish native PowerPoint raster fidelity.

## Scope

Version 0.8.0 requires core 0.10.0 and uses renderer 0.8.0 for coordinated preview/font measurement. Quotes and code export their accepted internal lines and styles without another fitting pass. [Controlled Windows PowerPoint quote evidence](docs/evidence/shared-quote-integration/comparison.json) records glyph containment, separation, save/reopen and text reimport against its exact source/font hashes. Native quote import returns editable text blocks and does not restore the original OPF quote structure, typography or readability policy. Native chart geometry and general scalar-text wrapping also remain different from preview; editability and valid reimport do not establish raster equivalence.

- Package: `@openpresentation/opf-pptx`
- Repository: `OpenPresentation/opf-pptx`
- License: MIT
- Compatibility target: `@openpresentation/opf`
- Renderer relationship: may use `@openpresentation/opf-render` for chart rasterization and visual verification
- Public export API: `toPptx(opf, opts)`
- Public import API: `fromPptx(buffer, opts)`

The export path validates OPF with `@openpresentation/opf`, maps slide titles and common content payloads to editable PowerPoint objects through `pptxgenjs`, then normalizes the generated ZIP for stable entry ordering, fixed timestamps, and reproducible bytes.

```js
import { toPptx } from "@openpresentation/opf-pptx";

const bytes = await toPptx({
  $schema: "https://openpresentation.org/schema/opf/v1",
  name: "Quarterly Review",
  slides: [
    {
      title: "Revenue grew across all regions",
      items: ["North America +18%", "EMEA +14%", "APAC +11%"]
    }
  ]
});

await fs.promises.writeFile("quarterly-review.pptx", bytes);
```

`toPptx` returns a `Uint8Array` containing a PowerPoint-openable `.pptx`. It does not fetch remote assets. Data URI images and local paths can be embedded directly; hosts that need private asset loading should pass `imageResolver(src, context)`. Set `strictAssets: true` to turn unresolved or remote image assets into structured `OPFPptxError` failures instead of editable placeholder boxes.

`fromPptx` parses an existing `.pptx` buffer locally and returns an OPF document that validates with `@openpresentation/opf`:

```js
import { fromPptx, toPptx } from "@openpresentation/opf-pptx";

const opf = await fromPptx(await fs.promises.readFile("source.pptx"));
const roundTripBytes = await toPptx(opf);

await fs.promises.writeFile("round-trip.pptx", roundTripBytes);
```

The importer reads core properties, slide order, text boxes, speaker notes, embedded images, tables, and basic cached chart data from the OOXML parts. Slides or objects that do not map cleanly fall back to editable `blocks[]` payloads; OOXML positions are used for deterministic ordering and title/subtitle detection while keeping the emitted OPF schema-valid.

## v1 Placeholder and OOXML Mapping

The first exporter keeps the public API stable while using `pptxgenjs` internally:

- `Slide.title`, `Slide.subtitle`, and `Slide.tag` become editable text boxes, not PowerPoint master placeholders.
- Root payloads, `blocks[]`, and promoted region keys become editable slide objects in deterministic regions. Promoted keys use the OPF 3x3 region vocabulary (`top`, `middle`, `bottom`, `left`, `center`, `right`).
- Text, lists, metrics, quotes, timelines, code, tables, and inline-data charts are emitted as editable PowerPoint text, table, and chart objects. Content ColorRef values (hex, scheme slots/roles, and `var:<id>`) resolve through core `resolveColorRef()`. Slot and role names become native `a:schemeClr` references when the exported theme holds that exact color; hex, `var:<id>` and slide-override colors stay `a:srgbClr` (see [Theme color scheme](#theme-color-scheme)).
- Image assets are embedded only when supplied as data URIs, local paths, or host-resolved bytes/paths. Remote asset URLs are never fetched by the runtime path.
- ZIP entries, generated chart/workbook part names, core-property timestamps, and nested chart workbook timestamps are normalized for reproducible bytes.
- The package names only the document's chosen fonts. Chart text (data labels, axes, legend, titles) uses the chart slide's body font in `latin`/`ea`/`cs`; each embedded chart workbook uses the same fonts in its styles and theme; run `pitchFamily` follows the font scheme type (monospace is fixed pitch, serif is roman); and `docProps/app.xml` "Fonts Used" lists the fonts the package actually uses. The theme keeps PptxGenJS's per-script supplements (`THEME_SCRIPT_SUPPLEMENTS`) and empty `ea`/`cs` slots.
- `checkPptxTypefaces(bytes, {fonts, monospace})` inventories every `typeface`, workbook font name and "Fonts Used" entry in every XML part, including nested packages, and reports each font outside that policy. `inventoryPptxTypefaces()` returns the raw inventory.

This pass did not require an OPF schema change. The deferred full OOXML placeholder mapping from `docs/plans/layout-placeholders.md` remains a later hand-written OOXML emitter concern.

## v1 Import Mapping

The first importer is mechanical and schema-compatible:

- Presentation core properties map to OPF `name`, `description`, and `author`.
- The first slide master's theme `clrScheme` maps to `design.colorScheme`: a catalog id on an exact twelve-slot match, otherwise inline slots. A theme named like a catalog theme maps to `design.theme` when its colors or heading/body fonts corroborate it (see [Theme color scheme](#theme-color-scheme)).
- Native title/subtitle placeholders retain their roles. On slides without complete OPF heading tags, recognizable text-box positions and sizes provide a fallback. If any complete OPF heading role is recovered, untagged body text stays in `blocks[]` instead of being promoted into an absent heading role. Damaged tags retain visible text through ordinary import and diagnostics.
- Remaining text boxes map to `blocks[]` as text or list payloads, sorted by OOXML position.
- PowerPoint tables map to OPF table blocks, embedded images map to data URI image blocks, and cached chart series map to basic OPF chart blocks.
- Table imports retain empty rows. A native `firstRow` flag of `1` or `true` maps the first row to column labels; absent/false flags retain every row as data. New exports set this flag from OPF columns. Older exports without the flag retain their labels as the first data row rather than inferring headers.
- Native table text preserves run/field/break order, significant whitespace, and blank paragraphs. Cells return canonical `{value, style}` objects; `value` retains scalar text or supported rich runs. Covered merge positions are `null`. Explicit normal headers override OPF’s bold header default. Numeric/boolean/null source types cannot be reconstructed from native display text.
- Run `lang` maps back to the presentation `language` (a catalog id when it round-trips, else the tag); see [Languages, right-to-left text and script fonts](#languages-right-to-left-text-and-script-fonts).
- Imported runs retain bold, italic, underline, strike, point sizes, Latin font families, solid colors/alpha, external hyperlink URLs, and superscript/subscript direction. List-level and paragraph defaults apply before run overrides; supported theme fonts/colors resolve from the archive. Field values become their cached text, and underline/strike variants and baseline magnitudes reduce to OPF booleans.
- Conditional table styles, merged-cell geometry, cell fills/borders/alignment, unsupported text fills/colors, and internal hyperlink actions are not fully reconstructed. `onDiagnostic` reports unsupported table style references, merges, fonts/colors/fills and links with native frame/cell paths. Table paths use the native graphic-frame and row indexes, including a header row. The shared core 0.6.0 layout sizes rows from their content and reports `text-overflow` when text cannot fit at the minimum size. These checks establish native XML conversion, not visual parity with PowerPoint.
- Unknown non-text shapes and unsupported graphic frames become editable text fallback blocks instead of failing the import.
- Catalog references (`design.theme`, `colorScheme`, `fontScheme`, `dimensions`, `background`, slide `layout`), slide ids and authoring metadata (`narrative`, `tone`, `audience`, `purpose`, `language`, `organization`, `speaker`, ...) are stored at export in `OPF_DOCUMENT_V1` / `OPF_SLIDE_V1` customer-data tags. Import restores a reference while the theme colors, theme fonts, slide size, background or slide arrangement it produced are unchanged. After an edit, the observed native values stay and `design-reference-changed` / `layout-reference-changed` name the reference. `toPptx` option `provenance: 'references-only' | false` limits or disables these invisible tags. See [document round trips](docs/document-roundtrip.md) for exactly what is embedded.

There is no AI classification pass in the OSS runtime. Hosts can run optional cleanup or semantic remapping after `fromPptx` returns.

## Languages, right-to-left text and script fonts

The exporter reads the presentation `language` through core `resolveScriptFonts()` (FF-07; the model is core `docs/programs/font-fidelity-everywhere/script-font-model.md`):

- Every run, end-of-paragraph and default run property carries `lang` set to the resolved OOXML tag instead of a fixed `en-US`. That tag is the catalog's curated `ooxmlLang` (for example `ja-JP` or `ar-SA`) or an authored region tag such as `en-NZ`. `altLang` is not written: it names the editing-UI language, which OPF does not model.
- For a language that uses an East Asian or complex-script slot (CJK, Arabic, Hebrew, Indic, Thai and others), theme major/minor `a:ea`/`a:cs` name the resolved heading/body fonts instead of the vendored empty values. For a language written in the latin slot (Latin, Cyrillic, Greek and others) they stay empty unless the design font scheme sets `eastAsian`/`complexScript` explicitly. Filling them with the latin family is gated on FF-05: native evidence shows it does not remove the nameless and Aptos entries PowerPoint lists at open, and empty slots keep PowerPoint's per-script theme fallback for CJK or Arabic text typed later. So en-US decks export byte-identically.
- The theme's per-script entry for the language's own script (for example `Jpan`, `Hang`, `Arab` or `Deva`) names the resolver's supplement. The rest of the vendored Office per-script list is unchanged; that list is FF-08's call.
- Run `a:ea`/`a:cs` name the resolved slot when the language or the font scheme supplies a script-specific font, for example Meiryo in `a:ea` for Japanese or Arabic Typesetting in `a:cs` for Arabic. Headings take the heading font and other text the body font. Otherwise the slots keep repeating the run's latin face, so Latin, Cyrillic and Greek decks keep their run bytes.
- In a right-to-left deck, each slide and notes paragraph takes its direction from core `paragraphDirection(text, direction)`, the same rule the renderer uses: `rtl="1"` when its first strong character is right-to-left or it has none (digits, punctuation, empty), else an explicit `rtl="0"` (an English quote, a code line). The master, layout and presentation default paragraph levels start right-to-left only in a right-to-left deck. Left-to-right decks write no paragraph direction. Alignment is unchanged: `algn` stays the composed absolute alignment (left stays `l`), so native line placement keeps matching the renderer's geometry. Right-aligning RTL text by default is a composition decision in core; until then, set `contentAlignment` or `titleAlignment` to `right`.
- The PPTX names the chosen fonts only and never embeds font programs. Catalog names such as Meiryo must be installed where the deck is opened.

Charts keep their `c:lang` and left-to-right label paragraphs. The embedded chart workbook is untouched.

When the package carries an FF-32 stored `language` ([document round trip](docs/document-roundtrip.md)), that reference is restored while the runs still carry its OOXML tag (or none); if the runs now use another tag, the observed language below is kept and `metadata-reference-changed` is reported once. Otherwise `fromPptx` sets `language` from the most common run `lang`. It uses a catalog id when that record exports the same tag (`ja-JP` imports as `japanese`, `en-US` as `english-us`). Otherwise it keeps the tag itself (`en-NZ`), which still resolves to its catalog record. `english` (`en`) exports `en-US`, so it imports as `english-us`. Diagnostics:

- `mixed-run-languages`: runs use several tags; the most common one is imported.
- `language-ambiguous`: records share one curated tag and none has it as its own tag (`bn-BD` is Bengali and Chittagonian, `fil-PH` Filipino and Tagalog); the record of the same primary language is imported.
- `language-uncatalogued`: no catalog record matches; the tag is imported.
- `rtl-language-mismatch`: right-to-left paragraphs under a left-to-right language.
- `script-font-not-imported`: theme `ea`/`cs` name a font that neither repeats latin nor matches the language default. Imported OPF does not yet carry explicit font-scheme script slots.

Exports report `language-unresolved` when the document's language cannot be resolved locally (a URL, `pkg:` reference or unknown id) and `en-US` is used.

**Core without the resolver.** Published `@openpresentation/opf` 0.11.0 has no `resolveScriptFonts`. Export with it is byte-identical to the output before FF-07 (`lang="en-US"`, empty theme `ea`/`cs`, no `rtl`), and a document that names a language gets a `language-export-unavailable` diagnostic. A core with the resolver but without `paragraphDirection` marks no paragraph direction and reports `paragraph-direction-unavailable` for a right-to-left deck. Import then matches run tags against the installed catalog's `bcp47` and primary language. `npm run test:packed` exercises this path against the registry release. CI links core at a pinned commit that has the resolver.

## Runtime Policy

The package runtime must stay local and deterministic:

- No hosted service in the critical path
- No telemetry or hidden analytics
- No commercial SDK dependency in the critical path
- No required network calls
- No required AI dependency
- No required AI cleanup or classification pass for PPTX import
- No required LibreOffice dependency in the runtime path; LibreOffice is allowed only as an optional verification tool in CI
- Host applications own auth, storage, queues, analytics, collaboration, branding, and product workflow

## Development

```sh
npm ci
npm run build
npm run typecheck
npm test
npm run validate
```

LibreOffice is not a runtime dependency. When it is installed in CI or a local verification environment, generated `.pptx` files can be smoke-opened there as an optional export check.

## Release Lane

Public npm package publication is handled by `.github/workflows/release.yml` with npm provenance.

Required first-publish setup:

1. An npm owner for the `@openpresentation` scope must run the first publish or reserve/grant the `@openpresentation/opf-pptx` package.
2. Configure npm Trusted Publishing for GitHub repository `OpenPresentation/opf-pptx` and workflow `.github/workflows/release.yml`.
3. Publish by creating a GitHub Release or manually running the Release workflow after CI passes.

This repo does not require an npm automation token when Trusted Publishing is configured.

## Shared dynamic composition

The current checkout uses `@openpresentation/opf/composition` for portable geometry. Slides can select `auto`, `row`, `column`, or `grid`, set weighted tracks, and request path-specific overflow diagnostics. See the sibling OPF repo's `docs/dynamic-composition.md` for the complete contract.

Version 0.4.0 requires published `@openpresentation/opf@^0.6.0`. The optional renderer peer requires `@openpresentation/opf-render@^0.4.0`. Clean registry installs support the new composition APIs without sibling checkouts. For coordinated source development, build OPF and run `node scripts/link-ecosystem.mjs` there; `pnpm test:ecosystem` verifies shared geometry and import/export behavior.

For crowded drafts, run `paginatePresentation` from `@openpresentation/opf/pagination` first, then pass its returned presentation to both preview and `toPptx`. Native table row sizing now follows shared reference geometry; the exporter does not add hidden table continuation slides.

Pass the same `textMeasurement` provider used by preview and pagination to `toPptx`. Plain text and headings retain the measured line breaks in editable PowerPoint shapes.

The PPTX always names the font family the document chose. A provider may preview that family with another face: a metric-compatible substitute (Carlito for Calibri), a visual one (Carlito for Aptos), a caller alias or a generic fallback. That face changes measurement and drawing only. It never reaches the theme, runs, bullets or chart parts. Faces of the chosen family itself, such as Roboto Medium for Roboto at weight 500, keep their native style-link names. `test/export-chosen-fonts.mjs` checks this for every renderer Office-pack substitute. The exporter does not embed font binaries. Viewers resolve the named family themselves. When the preview used a non-metric substitute, PowerPoint can break lines differently from the preview.

Since 0.5.1, the exact PptxGenJS 4.0.1 ESM distribution is shipped with its MIT license and verified upstream hashes. Its unused `image-size` dependency is not installed; JSZip is declared directly. See [dependency provenance and regression coverage](DEPENDENCY-NOTES.md). The published 0.5.0 package retains the older dependency graph.

### Native table fitting

Version 0.4.0 imports and exports supported rich table cells and headers as editable runs, retaining resolved fonts, emphasis, color/alpha, hyperlinks, script positions and explicit line breaks. Import reads native XML, including paragraph defaults and significant whitespace; unstyled body cells remain strings. Shared core 0.6.0 layout grows rows for multiline content and fits text consistently with renderer 0.4.0 without inserting measured soft wraps. Native PowerPoint rendering remains unverified.

The exporter measures every cell with the same `textMeasurement` provider, font roles and effective nested `minFontSize` used by the SVG preview. Native table cells retain the original strings and values as text, with matching fitted sizes, line spacing, alignment, margins and row/column geometry. Uneven rows receive empty cells for missing columns. Theme border colors now use the same slot as the preview.

`npm test` compares exported OOXML against the published SVG renderer across 168 cells, including 24 cases that require taller rows, Roboto, and Calibri measured with its metric-compatible Carlito substitute (the cells still name Calibri), two canvas sizes, headers and all three alignments. PowerPoint still performs its own natural wrapping and needs the named fonts installed. These document-property checks do not establish native raster parity or lossless typed-cell import.

A local macOS Quick Look check opened both Roboto and system-Arial specimens. Quick Look substituted a serif font for uninstalled Roboto; the Arial specimen used a sans-serif face but still differed in table wrapping and row proportions. This is evidence of remaining viewer differences, not a passing PowerPoint raster comparison.

## Image geometry

Native image exports now follow the browser's `design.imageFill`: `fit` (the default) centers an image without changing its aspect ratio, and `crop` fills the allocated box with a centered native crop. Slide settings override presentation settings. Geometry is calculated from the exact bytes embedded after asset resolution, so host resolvers are called once. PNG, JPEG, GIF and WebP dimension headers are supported; unsupported or unreadable dimensions produce a path-specific error rather than a distorted picture. Supply supported raster bytes through `imageResolver` for other formats.

JPEG EXIF orientations 1–8 are represented by native picture rotation and mirroring. The embedded copy's orientation tag is normalized to 1 to avoid viewer-dependent double rotation. Compressed pixels and other metadata remain unchanged; input data is not mutated. EXIF orientation in other containers, animated playback, SVG/vector assets, effects and lossless crop/orientation import are not covered by this change.

A slide-level image (`design.slideImage`, composed by core as `geometry.slideImage`) exports as one native picture named `OPF slide image slides.N`. It sits beneath the slide's other shapes. Its frame is the shared composition frame for both fills: `crop` writes positive `a:srcRect` insets and `fit` writes negative insets that pad the centered image. The frame therefore matches the preview's `<image>` box exactly. An `OPF_SLIDE_IMAGE_V1` shape tag records the placement and the native picture geometry. On import, an unchanged tagged picture becomes the slide's `design.slideImage` again, with the embedded bytes as its data URI source and `imageFill: "fit"` when the frame was fitted. An edited, duplicated or ambiguous tagged picture is imported as an ordinary image block and reports `invalid-slide-image-provenance` at `slides.N.design.slideImage`. Native PowerPoint raster parity for negative `a:srcRect` insets has not been checked with Office yet.

Slide-image treatments export from core's normalized geometry as native DrawingML:

- `shape` becomes the picture's `a:prstGeom` (`rect`, `roundRect`, `ellipse` or `hexagon`) with core's guide values.
- `border` becomes a centered solid `a:ln` with a miter join.
- `recolor` becomes `a:grayscl` or `a:duotone`, followed by `a:alphaModFix` for `opacity`, on the blip only.
- `overlay` becomes one tagged `OPF slide image overlay slides.N` shape directly above the picture.

An unchanged export imports every treatment field back. An edited overlay drops only the overlay and reports `invalid-slide-image-provenance`. An edited picture or effect drops the slide image. See core `docs/image-treatments.md` for the vocabulary and the unsupported effects: blur, shadows, soft edges and background removal. PowerPoint's luminance weights for grayscale and duotone are unverified natively.

Tests compare SVG/native fit and crop geometry across nine synthetic raster fixtures and cover all eight JPEG orientations. Keynote 14.4 visually preserves proportions for wide/tall fit/crop and displays all eight orientations correctly. This does not establish Microsoft PowerPoint raster parity or WebP support in every Office version.

The structural export/import corpus gate covers every installed core example (126 decks / 805 slides for core 0.4.0). It explicitly substitutes a bundled fallback font and synthetic images, then checks slide XML, unique native object IDs, finite geometry, table grids and imported slide counts. It does not establish original-asset, typography or viewer fidelity. The focused table and image tests separately exercise measured geometry and real fixture bytes.

Raster media filenames and package content types are derived from the embedded PNG/JPEG/GIF/WebP bytes. A resolver may change the format without preserving an old asset MIME hint; import likewise detects these formats from their bytes. This metadata repair does not recompress images, validate every compressed pixel stream, fetch resources or establish viewer support for each format.

Native viewer check: Keynote 14.4 displays the PNG/JPEG/GIF media-type specimens, but imports an unchanged WebP as an empty rectangle. The default compatible export now converts WebP to a static PNG locally. Keynote displays all six converted specimens, including alpha, EXIF orientation and the first animation frame. Microsoft PowerPoint has not been verified.

### Compatible WebP pictures

`toPptx` defaults to `imageFormat: "compatible"`. After resolving and embedding an image once, WebP bytes are decoded to a static PNG. Alpha and EXIF orientation are retained in the decoded pixels; animated input uses its first frame. Fit/crop is then calculated from the resulting PNG dimensions. The original OPF input and source bytes are unchanged, but the PPTX contains the PNG rather than the original WebP or its metadata.

Set `imageFormat: "preserve"` to embed WebP unchanged when the receiving application supports it. Other image formats keep their existing export behavior. Conversion errors include the OPF image path; images above 40 megapixels are rejected before compatible conversion. Decoder differences can affect color/alpha rounding, so byte identity across platforms is not promised.

Node conversion lazily loads the pinned open-source Sharp dependency and requires Node 24. Normal package installation must include platform optional dependencies for its native binaries. Browser bundles select a separate browser decoder using local Blob/image/canvas APIs; Sharp and Node code are excluded. Neither path uploads images or fetches asset URLs. Source-preserving export and ordinary PNG/JPEG/GIF operations do not load Sharp.

`npm test` includes the Node pixel-reference cases and verifies browser bundling. To run the browser pixel checks, run `npm run build:browser-check`, serve this repository locally, and open `/artifacts/webp-fallback/browser/index.html`. The page reports 13 checks covering embedded PNG pixels, alpha, EXIF, the first animation frame, fit/crop, resolver calls and DOM canvas fallback. These are browser export checks, separate from the recorded Keynote viewing evidence.


## Native background fills

Fixed solid and linear-gradient backgrounds now export as native slide fills, keeping the background editable without rasterizing slide content. Deck defaults, inline theme overrides and per-slide overrides are resolved before export. Solid opacity, gradient stop colors/positions and combined color/background alpha are preserved. Empty and single-stop gradients follow the SVG preview's transparent/solid behavior; descending stop positions clamp to the preceding stop.

Diagonal gradients require a coordinate conversion: the preview uses an SVG object-bounding-box gradient, while native unscaled DrawingML angles use slide coordinates. Export converts both the physical gradient direction and stop interval. Tests compare 990 sample positions from serialized SVG/native properties across 33 gradients and three aspect ratios, plus solid opacity, inheritance, native edits and repeated imports/exports. Integer native angles/positions introduce small rounding differences. The mapping follows the [DrawingML linear-gradient angle definition](https://learn.microsoft.com/en-us/dotnet/api/documentformat.openxml.drawing.lineargradientfill?view=openxml-3.0.1).

Import reads supported native RGB solid/linear fills directly; it uses no hidden source copy. Uniform alpha becomes OPF background opacity, and differing stop alpha uses eight-bit RGBA colors (which can round alpha). Native path gradients, color transforms outside the supported luminance/alpha set, non-default tile/flip geometry and stop intervals outside OPF's fixed-endpoint representation are not imported. Pass `fromPptx(bytes, {onDiagnostic: issue => ...})` to observe `unsupported-background-gradient` with a slide path.

Node 20/24 tests and the 126-deck / 805-slide structural corpus pass. This proves serialization and the mathematical mapping, not native viewer pixels. Keynote 14.4 recognizes the editable native gradients. Twelve captured native PNGs now support 18 comparisons, including a Keynote-generated PPTX import: opaque differences are at most 4/255 per channel (mean below 0.38), and transparent portrait alpha differs by at most 1/255. The checked-in references run in ordinary Node tests without Keynote. Quick Look still renders these specimens as a flat average color, so its thumbnails are not evidence of their native appearance. Microsoft PowerPoint remains unavailable and unverified. Theme-aware native fills and other design decorations remain separate fidelity work.

### Pattern and picture backgrounds (FF-25)

Pattern backgrounds export as a native `<a:pattFill>` with explicit foreground and background colors. OPF presets named by DrawingML's 54 `ST_PresetPatternVal` values (for example `pct5`, `ltHorz`, `openDmnd`, `wave`) are written unchanged. As in the SVG preview, a missing foreground uses the slide text color and a missing background uses white; text contrast follows the pattern's background color. The preview's engine id `diagStripe` has no DrawingML name. It is still accepted and is written as the closest preset, `wdUpDiag`; new documents should use `wdUpDiag` so that re-import keeps the name. Any other engine-defined id keeps only its background color, like the preview, and reports `unsupported-pattern`. Opacity becomes alpha on both colors. Under the FF-24 theme-color rule, a pattern color authored as a scheme slot or role becomes `a:schemeClr`, with the background opacity as alpha, when the deck theme holds exactly the color the preview draws. Like the preview, pattern colors resolve only hex, so any other name is drawn as the default color and stays literal RGB. Import resolves theme pattern colors to RGB.

Image backgrounds export as a native `<a:blipFill>` for the embedded raster: `data:` sources, declared `asset:` ids and `imageResolver` results. `cover` (the default) crops the centered source to the slide aspect with `a:srcRect`. `contain` letterboxes the source with `a:fillRect` insets. `tile` repeats square cells that are min(width, height)/4 in size, from the top-left, as the preview does. The deck `imageFill` decides whether each cell is covered or contained; contained cells use negative (transparent) source insets. With `dpi="0"`, a native tile is sized from the raster's own resolution: PNG `pHYs` in metres; JPEG JFIF density in inches or centimetres, otherwise EXIF `XResolution`/`YResolution`; 96 dpi when absent. The tile scale compensates on each axis, so a cell matches the preview's CSS pixels. WebP sources become PNG parts as for pictures. Opacity becomes `a:alphaModFix`. An unresolved image keeps the background color and reports `unresolved-asset` (`strictAssets` throws). A JPEG EXIF orientation cannot rotate a background fill, so it reports `unsupported-background-image-orientation`.

Import reads `a:pattFill` with a DrawingML preset and resolvable foreground/background colors, including slide/layout/master inheritance and theme references, as an OPF pattern background. Import does not guess undefined default colors. Import also reads embedded `a:blipFill` pictures as an image background with the exact image bytes as a `data:` URI. Tiles become `tile`. If the tile scale, offset, alignment, flip or source insets differ from the geometry OPF `tile` exports (contained cells at the raster's resolution), the import reports `approximate-background-image`. A centered crop matching the slide aspect becomes `cover`, and centered fill insets matching the image aspect become `contain`. Off-center, distorted or effect-bearing fills become the closest `cover` and report `approximate-background-image`. Linked or unreadable pictures report `unsupported-background-image`. `test/background-fills.mjs` covers export, import, native edits, inheritance and diagnostics. Microsoft PowerPoint rendering of these fills, especially its resolution-based tile scale and negative tile insets, has not been verified.


## Theme color scheme

Export writes the deck's resolved color scheme into `ppt/theme/theme1.xml` `a:clrScheme`, named after the scheme. The OPF slots map one to one: `dark1`/`light1`/`dark2`/`light2` to `dk1`/`lt1`/`dk2`/`lt2`, `accent1`-`accent6` to themselves, and `hyperlink`/`followedHyperlink` to `hlink`/`folHlink`. An abstract role fills a slot only when the scheme leaves that slot unset. Previously every export carried the vendored Office palette (`accent1` `4472C4`). When the deck names a catalog `design.theme`, `a:theme` and its `thm15:themeFamily` take that theme's name. The rewrite happens during package normalization; the vendored PptxGenJS bytes are unchanged.

Document colors that name a slot or role (`accent2`, `textSecondary`, `surface`, ...) become `a:schemeClr` in runs, table cell fills and text, and table borders. Theme-slot backgrounds (`{type:'theme', slot}` or a slot name) do the same. Slide content reaches the theme through the master color map, so `dark1`, `light1`, `dark2` and `light2` are written as `tx1`, `bg1`, `tx2` and `bg2`. A reference becomes `schemeClr` only when the deck theme slot holds exactly the color the slide resolved. PowerPoint has one theme per master, so a slide-level `design.colorScheme` that changes a slot keeps that color literal. These stay `a:srgbClr`:

- literal hex colors, even when they equal a scheme slot;
- `var:<id>` variables;
- translucent colors;
- engine-derived chrome: default text, headings, list markers, muted text, card and chart panels, chart series, and default table header fill. These colors are contrast-selected per slide, not named by the document.
- `hyperlink` and `followedHyperlink` run and cell colors, because PptxGenJS 4.0.1 cannot emit `hlink`/`folHlink`. Borders and backgrounds can.

Import reads the first slide master's theme. An exact twelve-slot match with a bundled catalog scheme returns its id; the `clrScheme` name breaks ties. Otherwise the importer returns inline slots, relative to the catalog scheme the `clrScheme` is named after when there is one (`{id:'boost', accent1:'#123456'}`). A theme whose name equals a catalog theme's name maps to `design.theme` only if the package's color scheme or heading/body fonts match that theme; otherwise `theme-unverified` is reported. A missing theme, or slots that are not opaque sRGB/system colors, report `unsupported-theme-colors` on `design.colorScheme`. Slide colors are still imported as resolved hex. Role overrides such as `primary` have no theme slot and are not recovered. `test/theme-colors.mjs` covers all 14 catalog schemes and 4 catalog themes, override, foreign and damaged themes, and the literal-color boundaries. This establishes package structure and round-trip, not PowerPoint rendering.

## JPEG orientation on import

`fromPptx` now preserves native quarter-turns and mirroring for JPEG pictures by writing the combined orientation into EXIF metadata. Existing embedded EXIF orientation is applied before the native transform. This requires no pixel decoder, recompression, upload or new dependency. The original PPTX remains unchanged, and alternative text survives. The eight orientations produced by this exporter restore the exact source JPEG bytes through repeated fit-mode export/import cycles.

When a JPEG has no orientation tag, import either adds a minimal EXIF segment or appends an IFD0 that retains the existing metadata entries, referenced data offsets and next-IFD link. Malformed or full EXIF segments are left untouched and reported. Tests cover both byte orders, embedded metadata plus native transformations, native picture edits, exact compressed-byte retention and independently permuted pixels.

This preserves image orientation, not arbitrary picture geometry. Crop windows, non-quarter-turn rotations, non-JPEG rotations/mirroring and unsupported EXIF structures retain their original image bytes and report `unsupported-image-crop` or `unsupported-image-orientation` through `FromPptxOptions.onDiagnostic`. Picture diagnostic paths identify native picture order, for example `slides.0.pictures.0`. Import still recomposes OPF layout and does not promise exact native placement, crop, effects, groups or full picture round-trip fidelity. Third-party native viewers may handle already-oriented embedded JPEGs differently; the metadata-before-native composition is the importer contract, not a cross-viewer parity claim.

### Inherited native backgrounds (0.2.1)

Since 0.2.1, the importer follows slide → layout → master background inheritance. An explicit slide background, including no-fill or an unsupported fill, takes precedence over inherited content. Solid and representable linear fills resolve theme slots through the master color map and layout/slide overrides; system colors use the saved `lastClr` fallback. Theme overrides can replace the color scheme or format scheme. Background style references use the original XML order in `fillStyleLst`/`bgFillStyleLst`, including placeholder colors and alpha. Theme-slot OPF exports also retain background opacity.

The 0.2.1 importer applies `lum`, `lumMod`, `lumOff`, `alpha`, `alphaMod` and `alphaOff` in XML order, including repeated/interleaved transforms in theme definitions, style placeholders and gradient stops. Following DrawingML’s [luminance modulation](https://learn.microsoft.com/en-us/dotnet/api/documentformat.openxml.drawing.luminancemodulation?view=openxml-3.0.1) and [luminance offset](https://learn.microsoft.com/en-us/dotnet/api/documentformat.openxml.drawing.luminanceoffset?view=openxml-3.0.1) semantics, luminance adjustments retain hue and saturation, and opacity operations clamp after each step. Colors are rounded to RGB only after the full reference/transform chain. Tint/shade, saturation/hue, gamma and other transforms still produce diagnostics. The regression suite covers 70 inheritance, transform and diagnostic cases; these mathematical tests do not establish native viewer pixel parity.

These colors become explicit editable OPF RGB fills. Import does not preserve a live link to the original PowerPoint master/theme. No external theme URL is fetched. Missing themes, unknown colors, unsupported color transforms, and unsupported fills (including patterns without a DrawingML preset or explicit colors) report `unsupported-background-fill` (or `unsupported-background-gradient` for gradients) at the slide background path.

The regression fixtures cover inheritance, overrides, interleaved style lists, repeated export/import, source preservation and observable failures. The style indexes follow the [Open XML background-reference definition](https://learn.microsoft.com/en-us/dotnet/api/documentformat.openxml.presentation.backgroundstylereference?view=openxml-3.0.1). They prove conversion semantics, not universal native appearance. Keynote displayed a fixture referencing `fillStyleLst` index 2 as white; native comparison of other reference forms is still incomplete. Microsoft PowerPoint remains unverified. This work is not included in npm 0.2.0.

Native dimensions retain full precision through import. Premature six-decimal inch rounding could change raster edges even on a 1280-pixel slide. With the local JPEG-aware renderer, all eight complete image-slide PNG previews now match their original OPF previews after native export/import; this remains an OPF-renderer comparison, not a native viewer pixel comparison.

Background-only and empty slides now remain blank during PPTX import; the importer no longer inserts a synthetic “Slide N” title. Speaker notes remain separate from visible content. Native fixture verification covers this behavior using an actual Keynote-exported presentation.

Version 0.2.0 requires Node 20.9 or later for native image decoding. Browser bundles continue using browser-safe entrypoints.


## Conditional table text styles (since 0.5.0)

The importer resolves referenced table styles through the archive's presentation relationship, including custom part paths, and accepts inline definitions. It applies whole-table, alternating row/column, edge and corner text styles using [Microsoft's DrawingML precedence](https://learn.microsoft.com/en-us/openspecs/office_standards/ms-oi29500/90de4085-5fbf-47a7-bc37-d59509481d0a). Direct list-level, paragraph and run properties override the inherited style. Supported character properties are bold/italic, explicit or major/minor-theme Latin fonts, and the existing RGB/system/theme color and alpha transforms. Font-reference placeholder colors resolve after style inheritance. The table-style list's insertion default does not silently restyle existing tables without a reference.

Version 0.5.0 adds conditional table styles. Missing definitions (including built-in Office IDs whose definitions are absent from the archive) produce `unsupported-table-style`; no style data is fetched. Unsupported effects and table backgrounds produce `unsupported-table-cell-style`. Supported conditional solid fills, borders and their theme references use the same precedence as character styles. Native right-to-left geometry reports `unsupported-table-direction` and retains source cell order. Script-specific font selection, unsupported border geometry/color models and native PowerPoint raster parity remain separate work. Native re-export preserves effective character formatting but does not reconstruct the original style reference or redundant explicit normal flags.

`test/table-styles.mjs` builds independent native XML fixtures covering band offsets, overlapping first/last flags, all four corners, theme and explicit fonts, placeholder alpha, inheritance/defaults, direct resets, absent/external definitions and repeated conversion. The checked-in `test/fixtures/table-styles/conditional.pptx` is project-authored test data, not a captured native-viewer reference. After `npm run build:browser-check`, serve this repository and open `/artifacts/native-table-styles/browser/index.html` for 11 browser import, preview-trace and re-export checks.


## Styled and merged table cells (since 0.5.0)

The importer returns canonical `{value, style}` cell objects. Values retain supported rich runs, and styles retain direct solid fills/alpha, individual borders, horizontal/vertical alignment and reference-pixel padding. Rectangular native merges use `rowSpan`/`colSpan` anchors with explicit `null` at covered grid positions. Numeric source types cannot be recovered from displayed native text.

Import validates native continuation flags, bounds and covered text before applying merges. A malformed merge falls back to separate styled cells and reports `unsupported-table-merge`, retaining every source cell's text. If a valid merge crosses a flagged first row, the table keeps that row in its body with explicit formatting and reports `table-header-in-body`; OPF repeated headers cannot extend into body rows. Mixed/justified paragraph alignment, vertical text, unsupported fills/lines and 3D/diagonal effects remain explicit diagnostics. Unequal native column widths still need canonical representation.

Conditional borders keep the whole-table outer frame separate from interior horizontal/vertical lines. Row/column bands, edges and corners inherit line properties before direct cell overrides. Archive-local line references resolve theme placeholder colors and alpha. Missing references report `unsupported-table-border` unless an invisible or complete direct line masks them. A merged anchor uses its full span to select outer edges; differing native continuation border segments report `unsupported-table-merge-border` and retain the anchor border. `test/table-border-styles.mjs` covers these cases with native XML fixtures and repeated conversion.

Export consumes the same core geometry as SVG. It writes native merged cells and corrects PptxGenJS's padding-unit heuristic and missing dotted/transparent-border options in generated XML. Rich runs retain their own resolved opacity, including opaque overrides within a translucent cell. Tests inspect actual native XML and repeated conversions; native PowerPoint raster parity is not established.

Version 0.5.0 requires core 0.7.0 and renderer 0.5.0 for coordinated previews. `npm run test:styled-table` runs export/import regressions. For local browser verification, set `OPF_CORE_ROOT` to the core repository and `OPF_RENDER_ROOT` to the coordinated renderer worktree when running `npm run build:browser-check`. Serve the repository and open `/artifacts/native-styled-table-import/browser/index.html`. Omit those variables to exercise installed package dependencies.

Version 0.8.0 exports editable native lines with explicit four-space tab stops. Boundary tags contain no original source words, so native edits and deletions remain authoritative. XML-unrepresentable scalar controls reject with an actionable path rather than silently losing characters. Twenty wide/portrait measured/estimated export cases, current-text mutation controls and damaged-tag fallbacks pass; native Office acceptance remains separate. The coordinated core browser workflow also verifies editing, undo and exact reimport.

Version 0.9.1 exports core's accepted header/footer text and picture geometry as editable tagged slide shapes. Native Office Header/Footer objects (`p:hf` / notes master) remain deferred [core issue87](https://github.com/OpenPresentation/opf/issues/87) work. Dedicated `OPF_FURNITURE_V1` tags describe roles, line boundaries, inactive flags and global/local scope. A slide manifest represents empty or disabled definitions without adding a visible shape. Tags contain no original text, image bytes or alt text. Reimport reads those values from current native shapes; complete groups recover literal dates, section/organization metadata and page-number intent when the current number matches the current slide position.

Slide numbers inside those shapes are native PowerPoint slide-number fields (`<a:fld type="slidenum">`), so PowerPoint renumbers them when slides move. A `slideNumberFormat` such as `"A-{current}"` or `"{current} / {total}"` keeps its literal text and `{total}` (the exported slide count) as fixed runs around the field; PowerPoint has no slide-count field. A current date (`date: true`) needs the host's `date` option (ISO `YYYY-MM-DD`); it becomes a native `datetime1`–`datetime7` field when its `dateFormat` matches that en-US field type, and otherwise fixed text with a `furniture-date-fixed` diagnostic. A string date with `dateFormat` is fixed text. The slide manifest records `slideNumberFormat`/`dateFormat` settings, never their rendered words: reimport keeps a format only while the current native text still matches it (a slide number at its current position, a fixed date that parses back to the same ISO date), and a live date keeps the pattern of its current field type. Otherwise the current words import as literal text. Hiding furniture on a title slide is a slide-level `design.footer: false`/`design.header: false`, which round-trips as before.

Missing, duplicated or inconsistent furniture tags fall back to current native content with an `invalid-furniture-provenance` diagnostic. Conflicting organization or section values also fall back. Inherited definitions become global only when every slide has a valid definition/override and all inherited values agree; otherwise recovered definitions stay local. Reordering slides with unchanged visible page numbers preserves those numbers as ordinary text instead of silently renumbering them. Native typography, positioning, crop and unrelated metadata are not reconstructed; `furniture-import-reflow` requests review. `npm run test:furniture` exercises XML conversion and mutation controls. Native Office, visual corpus and clean installed-package acceptance remain separate gates; published tagged-shape furniture does not establish native Header/Footer support.
