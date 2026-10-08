---
type: changed
packages: [opf]
---
OPF 0.15 core API for engines and editors:
- `resolveSlideContext().resolved.provenance` and `resolveDesignRecords().provenance` tell an engine where each resolved layout, theme, colour scheme and font scheme came from: `{ kind, reference, id, group, source?, origin }`, typed `RecordProvenance`. Engines no longer need to resolve a second time.
- `opf/undeclared-catalog` is now a format error, so the engines' format check rejects a `name:id` prefix that names no catalog group instead of drawing a fallback.
- A `catalogs` option that is not an array of registered catalogs throws `OPFCatalogsOptionError` (`code: "invalid-catalogs"`) at every entry point.
- The new `moveToCustom(document, { kind, reference }, { catalogs, id? })` moves an embedded record into `catalogs.custom` and rewrites the references that named it. It returns `{ document, from, to, references, patch, renamed? }`, and it is the fix that `opf/catalog-record-not-in-source` suggests. With `id` it forks the record: the copy gets the new id, every reference is rewritten to it, and the original is removed.
- `copySlides` lists a record in `renamed` only when it creates that record under a new id.
- `/composition` exports `intrinsicImageAspect` and `intrinsicImageSize`.
