---
type: added
packages: [opf]
---
RR-75 (OPF 0.18): the verbs `edit` and `fill` in both builds of the root, and the layout of `paginate`.
    - **New `edit(deck, patch, options?)`** (both builds): a JSON Patch applied whole or not at all (`OPFPatchError`), the result checked for format and references (`OPFValidationError`, unless `validate: false`), returning `{ presentation, findings, inverse }`.
    - **New `fill(template, data?, options?)` and `fillRecords(text, options?)`** (both builds): a template filled from CSV, TSV or JSON text, a record or a list of records, one deck per record, or one with `combine: true`; returns `{ decks, complete, unfilled, diagnostics, presentation? }`.
    - **`paginate` reports its layout:** the result has `layout: "measured"` when a `fonts` handle chose the page breaks, else `"estimated"`.
