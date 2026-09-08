# Changelog

## Unreleased

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
