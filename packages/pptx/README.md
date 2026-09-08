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
- Imported table values are display strings: numeric/boolean/null types, rich cell formatting, whitespace and merged-cell semantics are not losslessly reconstructed.
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

## Shared dynamic composition (local development)

The current checkout uses `@openpresentation/opf/composition` for portable geometry. Slides can select `auto`, `row`, `column`, or `grid`, set weighted tracks, and request path-specific overflow diagnostics. See the sibling OPF repo's `docs/dynamic-composition.md` for the complete contract.

Version 0.1.0 requires published `@openpresentation/opf@^0.4.0`. The optional renderer peer requires `@openpresentation/opf-render@^0.1.0`. Clean registry installs support the new composition APIs without sibling checkouts. For coordinated source development, build OPF and run `node scripts/link-ecosystem.mjs` there; `pnpm test:ecosystem` verifies shared geometry and import/export behavior.

For crowded drafts, run `paginatePresentation` from `@openpresentation/opf/pagination` first, then pass its returned presentation to both preview and `toPptx`. Native table row sizing now follows shared reference geometry; the exporter does not add hidden table continuation slides.

Pass the same `textMeasurement` provider used by preview and pagination to `toPptx`. Plain text and headings retain the measured line breaks and resolved font family in editable PowerPoint shapes. Font binaries are not yet embedded in PPTX; native viewers still need the resolved font installed.

PptxGenJS is pinned to 4.0.1. Its unused `image-size` dependency remains flagged by npm audit; tested OPF operations run with that parser blocked. See [dependency reachability and regression coverage](DEPENDENCY-NOTES.md).

### Native table fitting (unreleased)

The development exporter measures every cell with the same `textMeasurement` provider, font roles and effective nested `minFontSize` used by the SVG preview. Native table cells retain the original strings and values as text, with matching fitted sizes, line spacing, alignment, margins and row/column geometry. Uneven rows receive empty cells for missing columns. Theme border colors now use the same slot as the preview.

`npm test` compares exported OOXML against the published SVG renderer across 168 cells, including 24 cases that require shrinking, Roboto and Calibri-to-Carlito substitution, two canvas sizes, headers and all three alignments. PowerPoint still performs its own natural wrapping and needs the resolved fonts installed. These document-property checks do not establish native raster parity or lossless typed-cell import.

A local macOS Quick Look check opened both Roboto and system-Arial specimens. Quick Look substituted a serif font for uninstalled Roboto; the Arial specimen used a sans-serif face but still differed in table wrapping and row proportions. This is evidence of remaining viewer differences, not a passing PowerPoint raster comparison.

## Image geometry (unreleased)

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


## Native background fills (unreleased)

Fixed solid and linear-gradient backgrounds now export as native slide fills, keeping the background editable without rasterizing slide content. Deck defaults, inline theme overrides and per-slide overrides are resolved before export. Solid opacity, gradient stop colors/positions and combined color/background alpha are preserved. Empty and single-stop gradients follow the SVG preview's transparent/solid behavior; descending stop positions clamp to the preceding stop.

Diagonal gradients require a coordinate conversion: the preview uses an SVG object-bounding-box gradient, while native unscaled DrawingML angles use slide coordinates. Export converts both the physical gradient direction and stop interval. Tests compare 990 sample positions from serialized SVG/native properties across 33 gradients and three aspect ratios, plus solid opacity, inheritance, native edits and repeated imports/exports. Integer native angles/positions introduce small rounding differences. The mapping follows the [DrawingML linear-gradient angle definition](https://learn.microsoft.com/en-us/dotnet/api/documentformat.openxml.drawing.lineargradientfill?view=openxml-3.0.1).

Import reads supported native RGB solid/linear fills directly; it uses no hidden source copy. Uniform alpha becomes OPF background opacity, and differing stop alpha uses eight-bit RGBA colors (which can round alpha). Native path gradients, transformed/theme stop colors, non-default tile/flip geometry and stop intervals outside OPF's fixed-endpoint representation are not imported. Pass `fromPptx(bytes, {onDiagnostic: issue => ...})` to observe `unsupported-background-gradient` with a slide path.

Node 20/24 tests and the 126-deck / 805-slide structural corpus pass. This proves serialization and the mathematical mapping, not native viewer pixels. macOS Quick Look rendered the four gradient specimens as the same flat color; Keynote inspection was blocked by the locked desktop, and Microsoft PowerPoint remains unavailable. Native appearance therefore needs further verification before a release decision. Pattern/image backgrounds, theme-aware native fills, and other design decorations remain separate fidelity work.
