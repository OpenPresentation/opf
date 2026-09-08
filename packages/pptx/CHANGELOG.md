# Changelog

## Unreleased

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
