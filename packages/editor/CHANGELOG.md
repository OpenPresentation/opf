# Changelog

## 0.2.0

- Verify existing formatting, mixed-style typing, empty-cell editing and undo controls against canonical rich table cells and headers. Requires core 0.5.0 and renderer 0.3.0; core 0.4.1 does not accept rich table arrays. Reproduce the 12 browser checks with the core repository's `scripts/build-rich-table-browser.mjs` harness.

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
