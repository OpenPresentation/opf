# Changelog

## Unreleased

- Require Node 24 (`24.x`) for the next release and development; upgrade from Node 20 or 22 before installing. Retain browser and operating-system checks, and retire duplicate Node 20 CI jobs. Previously published packages and evidence are unchanged.

## 0.6.0

- Edit code source and metadata through accepted renderer trace targets, including empty source and shorthand values. Preserve source line endings through no-op commits and edits; insert literal tabs and support cancel/undo. Generated labels are not editable source targets, and code selection does not offer invalid rich-text formatting.
- Verify offline pointer/keyboard edits, pagination policy, undo/redo, native export and exact code/metadata/source-boundary reimport in wide and portrait canvases. The source textarea uses native browser editing, while committed preview uses accepted SVG geometry. Native formatting/font theme and pixel equivalence remain separate gaps. Requires core 0.9.0 and renderer 0.7.0; verified examples use PPTX 0.7.0.

## 0.5.0

- Commit pagination readability changes even when content stays on one slide, with undo/redo and no duplicate history after an unchanged repeat. Requires core 0.8.0 and renderer 0.6.0 for persisted minimums and shared quote geometry.
- Verify quote source editing, pagination, preview and PPTX export/reimport offline in Edge. Imported native quote lines retain text but do not reconstruct OPF quote structure, typography or readability policy.

## 0.4.0

- Require core 0.7.0 and renderer 0.5.0 for canonical styled and spanning table cells.

- Add coordinated styled-table regression coverage for `.value` typing/formatting, style/span preservation, empty cells, field discovery, rejected structural edits and atomic undo. The existing model supports these cells through the core 0.7.0 schema. Browser verification with actual Roboto fonts passes merged rich typing, scalar promotion and formatting, partial selection, empty styled values, cancellation and undo.

## 0.3.0

- Require core 0.6.0 and renderer 0.4.0 so the editor uses shared content-aware table rows. Multiline cells grow into available space while retaining formatting, typing, empty-cell editing and undo behavior.

## 0.2.0

- Verify existing formatting, mixed-style typing, empty-cell editing and undo controls against canonical rich table cells and headers. Requires core 0.5.0 and renderer 0.3.0; core 0.4.1 does not accept rich table arrays. Reproduce the 14 browser checks with the core repository's `scripts/build-rich-table-browser.mjs` harness.

## 0.1.2

- Accept renderer 0.2.x alongside 0.1.x through the optional peer dependency, allowing the new image-fidelity releases in a coordinated installation.
- Require core 0.4.1 with the corrected embedded image example. Editor behavior and browser entrypoints are unchanged.

## 0.1.1

- Require renderer 0.1.1 when using the canvas so empty-line caret geometry is available.
- Add native mixed-style typing with glyph-aligned caret and pointer selection, composition lifecycle handling, draft undo/redo, cancellation and guarded commit.
- Preserve run styles, links and metadata during typing, repeated-character edits and grapheme-safe changes; keep insertion style after deleting all text.
- Keep empty blocks editable and use renderer trace geometry for trailing blank-line carets.
- Verify 46 rich-text browser checks plus native keystrokes and a measured pointer hit. Real OS IME, bidi/complex-script and cross-browser behavior still require verification.

## 0.1.0

- Require core 0.4.0 and renderer 0.1.0 for compatible standalone installation.
- Add an embeddable canvas, schema-driven properties, rich range formatting, clipboard/gallery/data imports and content starters.
- Support guarded edits, resize/reorder/move operations, nested composition, duplication, deletion and atomic undo.
- Verify model, component, transfer, schema, rich-text and layout suites on Node 20 and 24 before provenance publication.

Continuous native caret/IME editing, complete visual spec coverage and native PowerPoint parity remain unfinished. Model tests do not establish browser interaction fidelity.
