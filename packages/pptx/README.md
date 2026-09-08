# OPF PPTX

Pure local PowerPoint conversion tooling for Open Presentation Format documents. This repo owns the Phase 3 and Phase 4 toolkit lanes: OPF to PPTX export and PPTX to OPF import.

## Scope

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
- Text, lists, metrics, quotes, timelines, code, tables, and inline-data charts are emitted as editable PowerPoint text, table, and chart objects.
- Image assets are embedded only when supplied as data URIs, local paths, or host-resolved bytes/paths. Remote asset URLs are never fetched by the runtime path.
- ZIP entries, generated chart/workbook part names, core-property timestamps, and nested chart workbook timestamps are normalized for reproducible bytes.

This pass did not require an OPF schema change. The deferred full OOXML placeholder mapping from `docs/plans/layout-placeholders.md` remains a later hand-written OOXML emitter concern.

## v1 Import Mapping

The first importer is mechanical and schema-compatible:

- Presentation core properties map to OPF `name`, `description`, and `author`.
- Slide text placeholders and large top-of-slide text boxes map to `title` and `subtitle` when recognizable.
- Remaining text boxes map to `blocks[]` as text or list payloads, sorted by OOXML position.
- PowerPoint tables map to OPF table blocks, embedded images map to data URI image blocks, and cached chart series map to basic OPF chart blocks.
- Table imports retain empty rows. A native `firstRow` flag of `1` or `true` maps the first row to column labels; absent/false flags retain every row as data. New exports set this flag from OPF columns. Older exports without the flag retain their labels as the first data row rather than inferring headers.
- Native table text preserves run/field/break order, significant whitespace, and blank paragraphs. Cells with supported formatting become canonical `TextRun[]`; unstyled body cells stay strings. Explicit normal headers override OPF’s bold header default. Numeric/boolean/null source types cannot be reconstructed from native display text.
- Imported runs retain bold, italic, underline, strike, point sizes, Latin font families, solid colors/alpha, external hyperlink URLs, and superscript/subscript direction. List-level and paragraph defaults apply before run overrides; supported theme fonts/colors resolve from the archive. Field values become their cached text, and underline/strike variants and baseline magnitudes reduce to OPF booleans.
- Conditional table styles, merged-cell geometry, cell fills/borders/alignment, unsupported text fills/colors, and internal hyperlink actions are not fully reconstructed. `onDiagnostic` reports unsupported table style references, merges, fonts/colors/fills and links with native frame/cell paths. Table paths use the native graphic-frame and row indexes, including a header row. The shared core 0.6.0 layout sizes rows from their content and reports `text-overflow` when text cannot fit at the minimum size. These checks establish native XML conversion, not visual parity with PowerPoint.
- Unknown non-text shapes and unsupported graphic frames become editable text fallback blocks instead of failing the import.

There is no AI classification pass in the OSS runtime. Hosts can run optional cleanup or semantic remapping after `fromPptx` returns.

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

Pass the same `textMeasurement` provider used by preview and pagination to `toPptx`. Plain text and headings retain the measured line breaks and resolved font family in editable PowerPoint shapes. Font binaries are not yet embedded in PPTX; native viewers still need the resolved font installed.

PptxGenJS is pinned to 4.0.1. Its unused `image-size` dependency remains flagged by npm audit; tested OPF operations run with that parser blocked. See [dependency reachability and regression coverage](DEPENDENCY-NOTES.md).

### Native table fitting

Version 0.4.0 imports and exports supported rich table cells and headers as editable runs, retaining resolved fonts, emphasis, color/alpha, hyperlinks, script positions and explicit line breaks. Import reads native XML, including paragraph defaults and significant whitespace; unstyled body cells remain strings. Shared core 0.6.0 layout grows rows for multiline content and fits text consistently with renderer 0.4.0 without inserting measured soft wraps. Native PowerPoint rendering remains unverified.

The exporter measures every cell with the same `textMeasurement` provider, font roles and effective nested `minFontSize` used by the SVG preview. Native table cells retain the original strings and values as text, with matching fitted sizes, line spacing, alignment, margins and row/column geometry. Uneven rows receive empty cells for missing columns. Theme border colors now use the same slot as the preview.

`npm test` compares exported OOXML against the published SVG renderer across 168 cells, including 24 cases that require taller rows, Roboto and Calibri-to-Carlito substitution, two canvas sizes, headers and all three alignments. PowerPoint still performs its own natural wrapping and needs the resolved fonts installed. These document-property checks do not establish native raster parity or lossless typed-cell import.

A local macOS Quick Look check opened both Roboto and system-Arial specimens. Quick Look substituted a serif font for uninstalled Roboto; the Arial specimen used a sans-serif face but still differed in table wrapping and row proportions. This is evidence of remaining viewer differences, not a passing PowerPoint raster comparison.

## Image geometry

Native image exports now follow the browser's `design.imageFill`: `fit` (the default) centers an image without changing its aspect ratio, and `crop` fills the allocated box with a centered native crop. Slide settings override presentation settings. Geometry is calculated from the exact bytes embedded after asset resolution, so host resolvers are called once. PNG, JPEG, GIF and WebP dimension headers are supported; unsupported or unreadable dimensions produce a path-specific error rather than a distorted picture. Supply supported raster bytes through `imageResolver` for other formats.

JPEG EXIF orientations 1–8 are represented by native picture rotation and mirroring. The embedded copy's orientation tag is normalized to 1 to avoid viewer-dependent double rotation. Compressed pixels and other metadata remain unchanged; input data is not mutated. EXIF orientation in other containers, animated playback, SVG/vector assets, effects and lossless crop/orientation import are not covered by this change.

Tests compare SVG/native fit and crop geometry across nine synthetic raster fixtures and cover all eight JPEG orientations. Keynote 14.4 visually preserves proportions for wide/tall fit/crop and displays all eight orientations correctly. This does not establish Microsoft PowerPoint raster parity or WebP support in every Office version.

The structural export/import corpus gate covers every installed core example (126 decks / 805 slides for core 0.4.0). It explicitly substitutes a bundled fallback font and synthetic images, then checks slide XML, unique native object IDs, finite geometry, table grids and imported slide counts. It does not establish original-asset, typography or viewer fidelity. The focused table and image tests separately exercise measured geometry and real fixture bytes.

Raster media filenames and package content types are derived from the embedded PNG/JPEG/GIF/WebP bytes. A resolver may change the format without preserving an old asset MIME hint; import likewise detects these formats from their bytes. This metadata repair does not recompress images, validate every compressed pixel stream, fetch resources or establish viewer support for each format.

Native viewer check: Keynote 14.4 displays the PNG/JPEG/GIF media-type specimens, but imports an unchanged WebP as an empty rectangle. The default compatible export now converts WebP to a static PNG locally. Keynote displays all six converted specimens, including alpha, EXIF orientation and the first animation frame. Microsoft PowerPoint has not been verified.

### Compatible WebP pictures

`toPptx` defaults to `imageFormat: "compatible"`. After resolving and embedding an image once, WebP bytes are decoded to a static PNG. Alpha and EXIF orientation are retained in the decoded pixels; animated input uses its first frame. Fit/crop is then calculated from the resulting PNG dimensions. The original OPF input and source bytes are unchanged, but the PPTX contains the PNG rather than the original WebP or its metadata.

Set `imageFormat: "preserve"` to embed WebP unchanged when the receiving application supports it. Other image formats keep their existing export behavior. Conversion errors include the OPF image path; images above 40 megapixels are rejected before compatible conversion. Decoder differences can affect color/alpha rounding, so byte identity across platforms is not promised.

Node conversion lazily loads the pinned open-source Sharp dependency and requires Node 20.9 or later. Normal package installation must include platform optional dependencies for its native binaries. Browser bundles select a separate browser decoder using local Blob/image/canvas APIs; Sharp and Node code are excluded. Neither path uploads images or fetches asset URLs. Source-preserving export and ordinary PNG/JPEG/GIF operations do not load Sharp.

`npm test` includes the Node pixel-reference cases and verifies browser bundling. To run the browser pixel checks, run `npm run build:browser-check`, serve this repository locally, and open `/artifacts/webp-fallback/browser/index.html`. The page reports 13 checks covering embedded PNG pixels, alpha, EXIF, the first animation frame, fit/crop, resolver calls and DOM canvas fallback. These are browser export checks, separate from the recorded Keynote viewing evidence.


## Native background fills

Fixed solid and linear-gradient backgrounds now export as native slide fills, keeping the background editable without rasterizing slide content. Deck defaults, inline theme overrides and per-slide overrides are resolved before export. Solid opacity, gradient stop colors/positions and combined color/background alpha are preserved. Empty and single-stop gradients follow the SVG preview's transparent/solid behavior; descending stop positions clamp to the preceding stop.

Diagonal gradients require a coordinate conversion: the preview uses an SVG object-bounding-box gradient, while native unscaled DrawingML angles use slide coordinates. Export converts both the physical gradient direction and stop interval. Tests compare 990 sample positions from serialized SVG/native properties across 33 gradients and three aspect ratios, plus solid opacity, inheritance, native edits and repeated imports/exports. Integer native angles/positions introduce small rounding differences. The mapping follows the [DrawingML linear-gradient angle definition](https://learn.microsoft.com/en-us/dotnet/api/documentformat.openxml.drawing.lineargradientfill?view=openxml-3.0.1).

Import reads supported native RGB solid/linear fills directly; it uses no hidden source copy. Uniform alpha becomes OPF background opacity, and differing stop alpha uses eight-bit RGBA colors (which can round alpha). Native path gradients, color transforms outside the supported luminance/alpha set, non-default tile/flip geometry and stop intervals outside OPF's fixed-endpoint representation are not imported. Pass `fromPptx(bytes, {onDiagnostic: issue => ...})` to observe `unsupported-background-gradient` with a slide path.

Node 20/24 tests and the 126-deck / 805-slide structural corpus pass. This proves serialization and the mathematical mapping, not native viewer pixels. Keynote 14.4 recognizes the editable native gradients. Twelve captured native PNGs now support 18 comparisons, including a Keynote-generated PPTX import: opaque differences are at most 4/255 per channel (mean below 0.38), and transparent portrait alpha differs by at most 1/255. The checked-in references run in ordinary Node tests without Keynote. Quick Look still renders these specimens as a flat average color, so its thumbnails are not evidence of their native appearance. Microsoft PowerPoint remains unavailable and unverified. Pattern/image backgrounds, theme-aware native fills, and other design decorations remain separate fidelity work.


## JPEG orientation on import

`fromPptx` now preserves native quarter-turns and mirroring for JPEG pictures by writing the combined orientation into EXIF metadata. Existing embedded EXIF orientation is applied before the native transform. This requires no pixel decoder, recompression, upload or new dependency. The original PPTX remains unchanged, and alternative text survives. The eight orientations produced by this exporter restore the exact source JPEG bytes through repeated fit-mode export/import cycles.

When a JPEG has no orientation tag, import either adds a minimal EXIF segment or appends an IFD0 that retains the existing metadata entries, referenced data offsets and next-IFD link. Malformed or full EXIF segments are left untouched and reported. Tests cover both byte orders, embedded metadata plus native transformations, native picture edits, exact compressed-byte retention and independently permuted pixels.

This preserves image orientation, not arbitrary picture geometry. Crop windows, non-quarter-turn rotations, non-JPEG rotations/mirroring and unsupported EXIF structures retain their original image bytes and report `unsupported-image-crop` or `unsupported-image-orientation` through `FromPptxOptions.onDiagnostic`. Picture diagnostic paths identify native picture order, for example `slides.0.pictures.0`. Import still recomposes OPF layout and does not promise exact native placement, crop, effects, groups or full picture round-trip fidelity. Third-party native viewers may handle already-oriented embedded JPEGs differently; the metadata-before-native composition is the importer contract, not a cross-viewer parity claim.

### Inherited native backgrounds (0.2.1)

Since 0.2.1, the importer follows slide → layout → master background inheritance. An explicit slide background, including no-fill or an unsupported fill, takes precedence over inherited content. Solid and representable linear fills resolve theme slots through the master color map and layout/slide overrides; system colors use the saved `lastClr` fallback. Theme overrides can replace the color scheme or format scheme. Background style references use the original XML order in `fillStyleLst`/`bgFillStyleLst`, including placeholder colors and alpha. Theme-slot OPF exports also retain background opacity.

The 0.2.1 importer applies `lum`, `lumMod`, `lumOff`, `alpha`, `alphaMod` and `alphaOff` in XML order, including repeated/interleaved transforms in theme definitions, style placeholders and gradient stops. Following DrawingML’s [luminance modulation](https://learn.microsoft.com/en-us/dotnet/api/documentformat.openxml.drawing.luminancemodulation?view=openxml-3.0.1) and [luminance offset](https://learn.microsoft.com/en-us/dotnet/api/documentformat.openxml.drawing.luminanceoffset?view=openxml-3.0.1) semantics, luminance adjustments retain hue and saturation, and opacity operations clamp after each step. Colors are rounded to RGB only after the full reference/transform chain. Tint/shade, saturation/hue, gamma and other transforms still produce diagnostics. The regression suite covers 70 inheritance, transform and diagnostic cases; these mathematical tests do not establish native viewer pixel parity.

These colors become explicit editable OPF RGB fills. Import does not preserve a live link to the original PowerPoint master/theme. No external theme URL is fetched. Missing themes, unknown colors, unsupported color transforms, and unsupported image/pattern fills report `unsupported-background-fill` (or `unsupported-background-gradient` for gradients) at the slide background path.

The regression fixtures cover inheritance, overrides, interleaved style lists, repeated export/import, source preservation and observable failures. The style indexes follow the [Open XML background-reference definition](https://learn.microsoft.com/en-us/dotnet/api/documentformat.openxml.presentation.backgroundstylereference?view=openxml-3.0.1). They prove conversion semantics, not universal native appearance. Keynote displayed a fixture referencing `fillStyleLst` index 2 as white; native comparison of other reference forms is still incomplete. Microsoft PowerPoint remains unverified. This work is not included in npm 0.2.0.

Native dimensions retain full precision through import. Premature six-decimal inch rounding could change raster edges even on a 1280-pixel slide. With the local JPEG-aware renderer, all eight complete image-slide PNG previews now match their original OPF previews after native export/import; this remains an OPF-renderer comparison, not a native viewer pixel comparison.

Background-only and empty slides now remain blank during PPTX import; the importer no longer inserts a synthetic “Slide N” title. Speaker notes remain separate from visible content. Native fixture verification covers this behavior using an actual Keynote-exported presentation.

Version 0.2.0 requires Node 20.9 or later for native image decoding. Browser bundles continue using browser-safe entrypoints.


## Conditional table text styles (unreleased)

The development importer resolves referenced table styles through the archive's presentation relationship, including custom part paths, and accepts inline definitions. It applies whole-table, alternating row/column, edge and corner text styles using [Microsoft's DrawingML precedence](https://learn.microsoft.com/en-us/openspecs/office_standards/ms-oi29500/90de4085-5fbf-47a7-bc37-d59509481d0a). Direct list-level, paragraph and run properties override the inherited style. Supported character properties are bold/italic, explicit or major/minor-theme Latin fonts, and the existing RGB/system/theme color and alpha transforms. Font-reference placeholder colors resolve after style inheritance. The table-style list's insertion default does not silently restyle existing tables without a reference.

This change is not included in published 0.4.0. Missing definitions (including built-in Office IDs whose definitions are absent from the archive) produce `unsupported-table-style`; no style data is fetched. Unsupported effects and table backgrounds produce `unsupported-table-cell-style`. Supported conditional solid fills, borders and their theme references use the same precedence as character styles. Native right-to-left geometry reports `unsupported-table-direction` and retains source cell order. Script-specific font selection, unsupported border geometry/color models and native PowerPoint raster parity remain separate work. Native re-export preserves effective character formatting but does not reconstruct the original style reference or redundant explicit normal flags.

`test/table-styles.mjs` builds independent native XML fixtures covering band offsets, overlapping first/last flags, all four corners, theme and explicit fonts, placeholder alpha, inheritance/defaults, direct resets, absent/external definitions and repeated conversion. The checked-in `test/fixtures/table-styles/conditional.pptx` is project-authored test data, not a captured native-viewer reference. After `npm run build:browser-check`, serve this repository and open `/artifacts/native-table-styles/browser/index.html` for 11 browser import, preview-trace and re-export checks.


## Styled and merged table cells (unreleased)

The coordinated development importer returns canonical `{value, style}` cell objects. Values retain supported rich runs, and styles retain direct solid fills/alpha, individual borders, horizontal/vertical alignment and reference-pixel padding. Rectangular native merges use `rowSpan`/`colSpan` anchors with explicit `null` at covered grid positions. Numeric source types cannot be recovered from displayed native text.

Import validates native continuation flags, bounds and covered text before applying merges. A malformed merge falls back to separate styled cells and reports `unsupported-table-merge`, retaining every source cell's text. If a valid merge crosses a flagged first row, the table keeps that row in its body with explicit formatting and reports `table-header-in-body`; OPF repeated headers cannot extend into body rows. Mixed/justified paragraph alignment, vertical text, unsupported fills/lines and 3D/diagonal effects remain explicit diagnostics. Unequal native column widths still need canonical representation.

Conditional borders keep the whole-table outer frame separate from interior horizontal/vertical lines. Row/column bands, edges and corners inherit line properties before direct cell overrides. Archive-local line references resolve theme placeholder colors and alpha. Missing references report `unsupported-table-border` unless an invisible or complete direct line masks them. A merged anchor uses its full span to select outer edges; differing native continuation border segments report `unsupported-table-merge-border` and retain the anchor border. `test/table-border-styles.mjs` covers these cases with native XML fixtures and repeated conversion.

Export consumes the same core geometry as SVG. It writes native merged cells and corrects PptxGenJS's padding-unit heuristic and missing dotted/transparent-border options in generated XML. Rich runs retain their own resolved opacity, including opaque overrides within a translucent cell. Tests inspect actual native XML and repeated conversions; native PowerPoint raster parity is not established.

The current changes require the unpublished coordinated core and renderer branches. `npm run test:styled-table` runs export/import regressions. For local browser verification, set `OPF_CORE_ROOT` to the core repository and `OPF_RENDER_ROOT` to the coordinated renderer worktree when running `npm run build:browser-check`. Serve the repository and open `/artifacts/native-styled-table-import/browser/index.html`. Omit those variables to exercise installed package dependencies after the coordinated release.
