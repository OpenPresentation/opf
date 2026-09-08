# Changelog

## Unreleased

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
