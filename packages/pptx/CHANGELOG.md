# Changelog

## Unreleased

- FF-35: every engine now shares the exporter's last-resort font scheme, `aptos` (core `DEFAULT_FONT_SCHEME`). `test/default-font-scheme.mjs` replaces the FF-17 split pin with a parity check: when the installed core exports `DEFAULT_FONT_SCHEME`, core pagination measures a custom theme without a font scheme in exactly the families exported here. Export behavior is unchanged: all 126 bundled examples export byte-identically (estimated and measured) with the published core and with the FF-35 core. No package version change.

- FF-17: pin the exporter's last-resort font scheme (`aptos`, matching `engine-defaults.json` `fontScheme.pptx.latin`) with `test/default-font-scheme.mjs`. It applies only when the resolved theme names no font scheme. Core pagination, the renderer and the editor then used `roboto`; FF-35 makes every engine use `aptos`. The test also checks that code runs use the shared `resolveFontFamilies()` code role (the scheme's `code`, else Roboto Mono). No export behaviour or bytes change: across the 126 bundled examples, switching this default to `roboto` produced byte-identical PPTX.

- Make the slide master's nine `bodyStyle` bullet fonts follow the theme minor (body) font (`<a:buFont typeface="+mn-lt"/>`). Previously they used the Arial hard-coded in the vendored PptxGenJS master, so a Carlito-only `design.fontScheme` still shipped Arial bullets. The rewrite happens during package normalization, and the vendored bytes are unchanged. Every exported deck's `ppt/slideMasters/slideMaster1.xml` changes in those nine elements. Explicit slide list-marker fonts are unchanged.

## 0.9.1

- Raise the optional `@openpresentation/opf-render` peer to `^0.9.0` so a packed install of editor 0.8.0 + render 0.9.0 + pptx 0.9.1 resolves. Keep `@openpresentation/opf` at `^0.11.0`. No conversion-behavior change.

## 0.9.0

- Require published `@openpresentation/opf@^0.11.0`. Resolve content ColorRef values (hex, effective color-scheme slots and roles, and `var:<id>` variables) through core `resolveColorRef()` to sRGB hex before PptxGenJS export for styled table fill/text/borders and rich text runs. Eight-digit hex alpha is preserved for native transparency (core `normalizeHexColor` strips the AA byte). Unrecognized run colors still validate and fall back to the theme text color (`color:'invalid'` contract). Design backgrounds and gradients are unchanged; native `schemeClr`, theme `clrScheme` writes, and native `p:hf` remain follow-up work. Import still flattens theme colors to hex.

## 0.8.0

- Remove content-type declarations for nonexistent generated slide masters, retaining every actual part and relationship. Add the audited package-integrity regression; notes-master ordering is unchanged.
- Require core 0.10.0 and renderer 0.8.0. Export accepted metric/timeline/card/text geometry with guarded native source recovery, preserving current edits, scalar whitespace, selected readability floors and explicit font style links.
- Keep native chart workbooks and visible text authoritative during supported reimport. Native font identity, tab positioning and image acceptance retain their documented independent compatibility requirements.
- Shared furniture provenance and joint source-shaping/tab drafts are not included in this release.

- Require Node 24 (`24.x`) for the next release and development; upgrade from Node 20 or 22 before installing. Retain browser and operating-system checks, and retire duplicate Node 20 CI jobs. Previously published packages and evidence are unchanged.

- Consume physical family and bold/italic style-link metadata from accepted text styles across headings, scalar/rich text, lists, tables, quotes, code and metrics. Retain the legacy provider fallback and reject malformed selection metadata. Coordinated renderer preferred-family lookup selects installed Roboto 500/600/800 faces exactly; native paint verification remains separate.

## 0.7.0

- Reject XML-forbidden controls and unpaired UTF-16 surrogates in code source/metadata with `invalid-code-text`, the OPF path and character offset, instead of emitting invalid XML or replacement characters. Tabs, line endings and valid supplementary Unicode remain accepted; this does not certify glyph coverage.
- Export accepted code parts as editable native lines with explicit tab stops. Retain complete code source and metadata through guarded native shape tags, including soft-wrap boundaries and CR/LF/CRLF. Missing or ambiguous groups retain visible shapes with diagnostics. See [code round-trip scope](docs/code-roundtrip.md).
- Preserve significant whitespace, empty paragraphs, interleaved native fields and explicit line breaks during text import. Keep complete multiline titles rather than silently taking their first line. Grouped text is retained with a transform/reflow diagnostic.
- Add wide/portrait offline browser and actual Windows PowerPoint source/edit/save/reopen/import checks. Native geometry, styling, font theme and raster equivalence are not reconstructed by this source round-trip feature. Requires core 0.9.0 and renderer 0.7.0 for coordinated preview/font measurement.

## 0.6.0

- Export accepted core quote parts as editable native lines without another fit/style pass. Reject missing geometry or unusable boxes explicitly. Requires core 0.8.0 and renderer 0.6.0 for coordinated preview/font measurement.
- Add twelve controlled Calibri PowerPoint cases for wide/portrait long bodies, expanded sources and pagination readability floors: source lines, native glyph containment/separation, save/reopen and reimport. Raster differences remain measured observations, not equivalence guarantees; import still flattens quotes to editable text blocks.

## 0.5.2

- Match metric, quote, code and timeline payload geometry and measured typography to renderer 0.5.1. Reserve quote footer space before fitting, preserve attribution and source, export timeline lines/markers as editable native shapes, and prevent PowerPoint from rewrapping fitted payload lines.
- Use readable theme colors for native chart axis and legend labels while preserving editable Office charts. Native axis ticks/plot geometry and general scalar-text wrapping still differ from preview.
- Add cross-renderer typography/geometry checks and a 19-slide real PowerPoint candidate comparison. File editability and schema-valid reimport do not establish complete raster or arbitrary Office round-trip equivalence.

## 0.5.1

- Remove the unused, vulnerable image-size dependency from ordinary npm installations by shipping the exact MIT-licensed PptxGenJS 4.0.1 ESM distribution and license with verified upstream hashes. Keep JSZip as a direct dependency; preserve the conversion API and upstream runtime code. No paid service or application-specific package-manager override is required.
- Add weekly grouped dependency updates, reviewed immutable CI actions and unfiltered installation/release audits.

## 0.5.0

- Normalize physical merged-cell perimeter borders and implicit neighboring edges. Native Windows PowerPoint testing exposed truncated dashes and restored zero-width segments that anchor-only XML checks missed.

- Require core 0.7.0 and renderer 0.5.0 for canonical styled and spanning table cells.

- Import conditional table borders with separate outer/interior edges, band/edge/corner precedence, archive-local theme line references, placeholder alpha and partial direct overrides. Invisible or complete direct borders mask unresolved references. Merged anchors use their full spans for frame edges; differing continuation border segments retain the anchor border and report a diagnostic.

- Import and export the coordinated core's styled and spanning table cells as native editable merged grids. Preserve direct fills/text alpha, alignment, padding and individual border widths/dashes. Normalize zero/fractional export padding and dotted/transparent borders that PptxGenJS does not expose consistently. Native cells now return canonical `{value, style}` objects; covered positions are `null`. Malformed merges retain all source cell text with diagnostics. First-row merges crossing into body rows retain explicit formatting as body content.
- Import conditional solid cell fills with whole-table/band/edge/corner precedence and ordered theme fill references, including placeholder alpha and direct overrides. Unequal native column widths and unsupported effects remain explicit fidelity limitations.

- Import supported native table-style character formatting from embedded style parts or inline definitions. Apply whole-table, row/column bands, edge and corner precedence before direct paragraph/run overrides; preserve theme/explicit Latin fonts, bold/italic and supported colors/alpha. Diagnose missing definitions, unsupported effects and right-to-left table geometry.

## 0.4.0

- Use the shared core 0.6.0 table layout for native row heights and font fitting. Multiline cells consume available height and use uniform native paragraph spacing; short-row output remains unchanged. Requires published core 0.6.0 and renderer 0.4.0.

- Import native table cells and headers as canonical rich runs, preserving supported character styles, theme fonts/colors, alpha, external links, paragraph defaults, whitespace and run/field/break order. Explicit normal text stays normal in OPF headers. Styled cells now return arrays instead of flattened strings; unstyled body cells remain strings.
- Retain blank paragraphs and report unsupported conditional table styles, merged geometry, unresolved text fonts/colors/fills and hyperlink actions with native table/cell paths. Field values remain cached text, and full native PowerPoint visual parity remains unverified.

## 0.3.0

- Export canonical rich table cells and headers as editable native runs with measured font sizes, resolved families, emphasis, colors/alpha, links and script baselines. Preserve explicit line breaks and whitespace across styled run boundaries. Requires core 0.5.0 and renderer 0.3.0; native PPTX table import still flattens text, and native PowerPoint rendering remains unverified.

## 0.2.1

- Preserve ordered native luminance and opacity transforms in solid and linear-gradient backgrounds, including theme colors and style placeholders. Retain precision through the full color reference chain; diagnose unsupported transforms.

- Import supported slide backgrounds inherited from layouts and masters, resolving theme colors, color-map overrides, theme overrides and background style references to explicit editable fills.
- Preserve opacity when exporting OPF theme-slot backgrounds. Report unresolved or unsupported native background fills instead of silently ignoring them.
- Add inheritance/style-reference regression coverage; native Keynote/PowerPoint compatibility remains separately qualified in the README.

## 0.2.0

This minor release requires Node 20.9 or later and OPF 0.4.1. Browser entrypoints remain available without native Node dependencies.

- Keep background-only and empty slides blank on import instead of adding a synthetic slide title.
- Add captured Keynote 14.4 native PNG/PPTX regression references for editable gradients, portrait opacity and native import; document the Quick Look thumbnail limitation separately from native viewer evidence.

- Preserve native dimension precision on import so standard-size canvases do not acquire small raster differences through rounded inch values.

- Restore native JPEG quarter-turns and mirrors into EXIF on import without recompressing pixels; preserve source JPEG bytes for this exporter's eight supported orientations.
- Add bounded EXIF insertion/update that retains existing metadata offsets and links, plus import diagnostics for unsupported crop, rotation and metadata cases.

- Preserve fixed solid/linear-gradient backgrounds as editable native fills, including opacity, stop colors, per-slide overrides and inline theme overrides.
- Convert gradient direction and stop intervals between SVG bounding-box and native slide coordinates, with regression coverage across landscape, portrait and square canvases.
- Import supported RGB solid/linear fills and expose path-specific diagnostics for native gradients outside the OPF representation. Keynote appearance is verified by captured native references; Microsoft PowerPoint remains unverified.

- Convert WebP to compatible static PNG pictures by default in Node and browser exports; preserve alpha, EXIF orientation and the first animation frame. Add imageFormat: "preserve" for original WebP embedding.
- Use lazily loaded Sharp 0.35.4 for local Node conversion and browser image/canvas APIs in browser bundles. Raise the Node minimum to 20.9.0. Conversion errors include the image path and enforce a 40-megapixel limit.
- Verify 36 cases against independent Pillow pixel references and 13 browser checks. Keynote 14.4 displays all six converted specimens, replacing its empty-rectangle WebP import.

- Detect PNG/JPEG/GIF/WebP content from embedded bytes, repair native media extensions/content types and import correct data-URI MIME types even when filenames or resolver hints disagree.

- Repair duplicate native object IDs on slides mixing tables with other objects, and sort normalized ZIP paths for stable multi-chart export bytes.

- Preserve headerless table data and empty rows on import. Export native header-row flags and honor explicit XML boolean flags when importing, including edits from other applications.

- Fit native table cell font sizes with the same loaded-font measurements and effective nested composition settings as the SVG preview.
- Match table alignment, line spacing, margins and theme border colors; pad uneven rows so every column remains present.
- Preserve original cell text and native editable tables. Natural wrapping still belongs to the PowerPoint viewer; native raster parity remains unverified.
- Compare 168 cells across two slide sizes, Roboto and Calibri substitution, headers, uneven rows and all text alignments. Twenty-four cases require shrinking.

- Preserve image proportions with centered native fit/crop matching presentation and slide imageFill settings.
- Measure embedded PNG/JPEG/GIF/WebP bytes without a second resolver call or an image-size dependency. Unreadable/unsupported dimensions produce a path-specific error.
- Translate all eight JPEG EXIF orientations into native rotation/mirroring while preserving compressed pixels and normalizing only the embedded orientation tag.

## 0.1.0

- Require core 0.4.0, with an optional renderer 0.1.0 peer for coordinated consumers.
- Share composition and measured rich-text/list geometry while preserving native editable PowerPoint objects.
- Support nested dynamic layouts, stable export bytes and mechanical OOXML import/round-trip checks.
- Pin PptxGenJS 4.0.1 and verify model operations and embedded data/local/resolved images without loading its unused image-size dependency. The transitive security advisory remains documented and unresolved.
- Verify clean registry installs on Node 20 and 24 before provenance publication.

Native PowerPoint raster comparison and full visual/round-trip fidelity remain unfinished; schema-valid import is not proof of faithful rendering.
