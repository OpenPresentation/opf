# Schema consistency: decisions ready for review

This packet advances W05 / FA-34 with executed schema examples and a narrower adoption plan. It changes no product schema or runtime. The existing [full review](https://github.com/OpenPresentation/opf/blob/5b7c64225e2100539deacb270cb266b68820b116/docs/handoff/2026-11-10/schema-consistency-review/README.md) and its 17-schema inventory remain the detailed reference. PR #1269 remains review-only and must never be merged. The 552-path implementation branch is also not an integration candidate as a whole.

## Owner decision — November 10, 2026

The owner approved **all S1–S4** in the takeover coordinator's asynchronous scope question: strict typed objects, explicit anchor pixel units, logical start/end vocabulary, rich-run `lang` → `language`, and shared basic `Line`. Implementation and qualification now proceed without requesting the same design permission again. The original review-only branch still must not be merged wholesale. The recommendations and pre-approval execution results below remain a dated review record, not a claim that implementation has passed.

## Original decision packet

The original request calls for recommendations and concrete JSON before adoption. Its transcript does not establish approval of the later branch's complete M/H/O implementation. The coordinator should obtain one explicit scope choice: **approve the recommended S1 and S2 scope below, approve all S1–S4, or retain the current vocabulary and accept only existing-contract correctness fixes.** The first option is recommended. An answer authorizes implementation and qualification, not release acceptance.

| Scope | Recommendation | Author-visible change and migration |
| --- | --- | --- |
| **S1: strict authoring and explicit anchor units** | Adopt for 0.34 after approval. | Reject unknown keys in typed objects with located typo suggestions; intentional custom data belongs in `extensions`. Make anchor `width` / `height` fractions only, and add `widthPx` / `heightPx` for reference pixels. Migrate existing anchored values above 1 to the pixel key without changing their actual size. Mutually exclusive units must be refused. Do not introduce an arbitrary maximum fraction merely to simplify validation; retain positive dimensions and actual finite geometry checks. |
| **S2: logical layout vocabulary** | Adopt for 0.34 after approval and the typed-provenance fix below. | Use `start` / `end` for direction-dependent alignment, furniture zones, promoted regions, image placement and overlay bands. Keep physical chart positions, image focus/callout coordinates, borders, padding and crop sides unchanged. Update all source formats, catalogs, APIs and sites in the same release; prove LTR and RTL geometry rather than assuming a spelling change proves fidelity. |
| **S3: rich-run `lang` → `language`** | Defer unless the owner prefers the complete vocabulary cleanup now. | Rename the document field and its producers/importers. An omitted override follows slide language, then deck language. Keep standard Markdown `lang=` and OOXML `lang`, and avoid gratuitous internal `TextStyle.lang` changes. This does not repair native Arabic glyph ordering. |
| **S4: shared basic `Line`** | Defer unless explicitly selected. | Allow `none` or a partial `{color,width,dash}` for table borders and reference strokes. Preserve contextual defaults: table rules are solid; references are dashed and 4/3 reference pixels wide. Keep rich shape `Stroke` separate. |

Existing approved explicit chart reference lines and signed positioning do not need renewed design approval. Truthful validation and preservation of authored data remain correctness work under their existing contracts. Stacked-reference expansion, inferred period bands, a global null/default normalization, whole-slide offstage warnings and unrelated catalog/default redesigns are not silently included in S1–S4.

## Concrete JSON

Every snippet here is represented as a complete validated document in examples.json.

S1 keeps the size of an existing fixed badge:

```json
{"at":{"block":"note","edge":"end","width":160,"height":64}}
```

```json
{"at":{"block":"note","edge":"end","widthPx":160,"heightPx":64}}
```

Today `width:1.01` means 1.01 reference pixels; its exact migration is `widthPx:1.01`. Under S1 a new `width:1.01` would mean 101% of the anchored target. Reference pixels are 720-short-edge design units, not device pixels.

S2 changes logical words while preserving physical borders:

```json
{"design":{"titleAlignment":"left","footer":{"right":{"text":"Confidential"}}},"slides":[{"title":"Decision","left":{"text":"Launch now"}}]}
```

```json
{"design":{"titleAlignment":"start","footer":{"end":{"text":"Confidential"}}},"slides":[{"title":"Decision","start":{"text":"Launch now"}}]}
```

The table alignment `style.align:"left"` becomes `"start"`; `style.borders.left` stays `left`. S3 changes `{ "text":"Bonjour", "lang":"fr-FR" }` to `{ "text":"Bonjour", "language":"fr-FR" }`. S4 can shorten `{ "color":"accent1", "width":2 }` only when the author deliberately accepts a different contextual color; omitting that explicit color is not an equivalent migration.

## Executed evidence

Results record Node 24.21.0, Ajv 8.20.0 and ajv-formats 3.0.1, plus exact schema and source SHA-256 identities. All **20 complete documents** from the previous report validate against their declared schema: current canonical `7618e916dacc166463cddf5f2ea029f523bbe51d`, or proposed `c7d396520c324c2d448757e906c00cf326dbd99e`. A misspelled `design.titleAlignmnt` is accepted by current schema and refused by the proposed schema. This establishes schema behavior only; it does not establish improved diagnostics or runtime behavior.

The exact unadopted `legacy-tags.js` reproduces **six actual corruption cases**: path-like text, code source, a table cell, an extension string, an extension's `titleAlignment` value, and an extension's path-like object key. The last two are new controls. The module rewrites both arbitrary keys and arbitrary values, so merely exempting text strings would leave silent data corruption. Known structural caption paths still upgrade and the existing footer-key collision control preserves both spellings. The probe intentionally records the unchanged defective implementation; success of the probe means the finding reproduced, not that a repair passed.

No `legacy-tags.js` exists in current main or canonical integration. Adding that migration module to current product source before adopting the vocabulary would create unnecessary behavior. The next implementation should start from current integration and port only approved features, with safe provenance handling built alongside them.

To replay from a checkout containing the two exact refs, use installed workspace Ajv dependencies. An alternate existing module directory can be supplied through `OPF_SCHEMA_REVIEW_MODULES`:

```sh
node docs/handoff/2026-11-10/schema-decision-packet/verify.mjs
```

This is a read-only Git/schema/pure-module probe. It neither fetches dependencies nor merges branches.

## Required implementation and acceptance

1. Replace the untyped recursive upgrader with readers selected by provenance record kind. The five families are document/topology/design, data, image, annotation and furniture. Their readers already know which family they decode. Only declared structural path/zone/alignment fields may migrate. `text`, code sources, dataset values, notes, extension trees and unknown properties remain exact; detect collisions without overwriting either side. Do not infer the type of an arbitrary nested object from the presence of `text`, `lang`, `kind` or `titleAlignment`.
2. Test current and legacy tags, all six literal/key controls, genuine structural positives, collisions, unsupported shapes, malformed/deep input and current native edits. Import must retain the current edited value instead of replaying stale provenance. Passing pure helper tests alone is insufficient.
3. For each approved schema group, update authoritative schemas, generated outputs through maintained builds, core, SVG, editor edits/undo, PPTX export/import, CLI/SDK/source formats, docs, examples, catalogs and all three site consumers. Keep per-group fragments and acceptance accounting.
4. Run mapped checks and exact examples on the final implementation; inspect geometry changes with before/after images and maintained pinned goldens. Obtain native PowerPoint Save/reopen/edit qualification for affected provenance and geometry. No cross-engine or native acceptance was run in this packet.

W05 is now **review packet executed; all S1–S4 approved; selective implementation and cross-engine acceptance pending**. The vocabulary branch is not adopted or shipped. The original recommendation to select S1+S2 and defer S3+S4 was superseded by the owner's all-four choice. Never use the existence of old implementation commits as an acceptance shortcut.
