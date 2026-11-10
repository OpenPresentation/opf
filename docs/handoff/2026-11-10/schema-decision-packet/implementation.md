# Approved schema implementation in progress

The owner approved S1–S4 on November 10. The review packet at `4da9d8653` and its approval addendum at `bd496d333` remain immutable prior-state records. This successor normally merged canonical integration `7618e916dacc166463cddf5f2ea029f523bbe51d` and selectively ports approved features from the two original implementation commits; it does not merge the review-only PR #1269 or the 552-path implementation branch.

The first original commit (`4a8e47d02c4bd3d25c4831e3a8c44338aa38760c`) supplied 45 selected file patches; 46 paths were excluded. The second (`c7d396520c324c2d448757e906c00cf326dbd99e`) supplied the logical-word and rich-run-language patches, excluding its unsafe generic upgrader, its matching incomplete test, historical burndown claims and generated schema-reference files. The maintained schema-doc generator produces the latter from this successor's actual schemas. The final Git diff, rather than the original branch tree, is the implementation authority.

## Preserved contracts and corrected findings

- Keep current explicit-reference supported types and suppression of title/prose focus. The old first commit would re-enable prose focus beside explicit references and expand reference support to stacked charts; neither behavior is part of these four approved schema groups.
- Keep the existing `pyramidDirection` catalog contract. The old first commit's unrelated inverted-pyramid representation change is excluded.
- Do not add the old first commit's wholly-offstage warning or arbitrary eight-slide size cap. Positive anchor dimensions and nonnegative free-shape dimensions may exceed a target/slide, subject to actual finite representable geometry. Pixel keys retain their existing 1,280 reference-pixel bound. Conflicting unit keys refuse even when schema validation was skipped.
- Use `start` / `end` only for logical layout words. Physical chart label positions, picture coordinates, crop, borders and padding remain unchanged. Public rich runs use `language`; internal measured styles and native XML retain `lang`.
- Shared basic `Line` supports partial styles and `none`, preserving contextual table/reference defaults. Zero-width native reference strokes use transparent paint because PowerPoint can otherwise draw a hairline; unedited owned paint can recover the original authored stroke without introducing defaults.

## Typed native provenance

`legacy-tags.js` is a new implementation, replacing the proposed untyped tree walk. The actual document, slide, data, datasets, image, annotation and furniture readers select their own family. Only declared structural paths, zones, alignment fields and old anchor size keys are adapted. Unknown fields, literal values, extension subtrees, ids and XML/hash evidence are opaque. Collisions refuse instead of overwriting either spelling.

New owned tag records carry internal `vocabulary: 2`. This distinguishes a current `width: 1.01` fraction from a pre-0.34 `width: 1.01` pixel value; the latter becomes `widthPx: 1.01`. A datasets map is not a tag-record object and is never stamped: `vocabulary` remains a legal authored dataset id.

Two additional binding issues were addressed during selective review. Legacy color slots were enumerated in the lexical order of old region names, which differs after renaming; an internal WeakMap retains the verified old order without adding authored properties. Original dataset values remain available for their original hash checks after typed rich-run/alignment adaptation. Known generated shape-name paths resolve to the new logical region key while actual native names remain unchanged. Overlay provenance now accepts the new pixel keys; the original implementation omitted this validator update.

## Actual checks so far

- Node 24.21.0 / Ajv 8.20.0 schema probe: all 149 current `.opf.json` example decks validate against this successor's authoritative schema.
- Dependency-free typed-provenance regression passes: all reader families; six literal/key preservation controls; current/legacy 1.01 unit distinction; opaque extensions and ids; physical borders; original dataset hash input; region color-slot order; prototype/unknown keys; collision refusal; unsupported marker and bounded-depth controls.
- Maintained schema documentation regenerated. `git diff --check` passes.
- Sparse prerequisites restored from 1,844 exact declared Git blobs at `49a10cdb46550d768dc3ae3068c259d81d48de34`; every materialized blob was independently SHA-1 checked. No empty fixture, test guard relaxation or golden update was used.

Build, strict types, package/mapper checks, current and legacy export/import tests, browser controls, reviewed images and native Save/reopen/edit qualification are pending. The new `schema-vocabulary-roundtrip.mjs` exercises current tags and constructed legacy tags plus a native XML text edit; it remains unrun until the build slot is available and does not substitute for actual PowerPoint qualification. Nothing in this checkpoint is a release or final acceptance claim.
