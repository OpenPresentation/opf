# Author/Inspector categorical completion: bounded follow-up

Status: a concrete existing defect, proposed correction only. No product edits, PR, release, deployment, or acceptance replacement. Reviewed app head `59e888580c38ca5cfbf5105b2ec09c2bfc956ca1` (app46); adapter unchanged from the accepted predecessor. Repository status was clean after this investigation.

## Finding

`lib/playground/register-json-field-completion.ts:54–73` passes the published editor's `fieldOptionEdit` directly to Monaco's `CompletionItem.range`. This function returns a **general source diff**, which can be multiline and need not contain the requested cursor. Monaco completions require a single-line range containing that cursor. The same adapter serves Author and Inspector.

The captured production source at line 11, column 18 produces 32 layout choices. The actual installed Monaco 0.56.0 `CompletionItem` constructor rejects **28**: the current AAA Document Layout maps an empty no-op to EOF at 44:1; Title Subtitle, Text 2x/3x, chart/image/list/media/metric/quote/table/timeline choices require multiline structural changes. Only AAB Loaded Layout, Text 1x, Blank, and Title pass constructor validation. The current Dark theme is also rejected as an EOF no-op.

Monaco's constructor rejects multiline and wrong-line ranges; its API contract additionally requires cursor containment. AAB's common-prefix/suffix diff does not contain a cursor farther into `document-layout`, despite passing the constructor. Requests on the property key can similarly return ranges on the value. `completionModel.js` discards invalid items.

**AAB Loaded Layout is valid at the original captured position. This finding does not explain the separate third-trigger popup failure.** The production replay and this reproduction agree on that distinction.

## Minimal adapter correction to implement next

1. Anchor the main range to the complete scalar token from `context.offset/length`; insert the selected JSON token. Handle only requests actually contained in that token unless a separate, explicitly tested same-line range extension preserves intervening source. A context returned for a property key is not automatically a valid completion range. Retain option labels, catalog provenance, descriptions, and placeholder descriptions.
2. For an unchanged value, keep the original raw token exactly. Published `replaceFieldOption` itself normalizes escaped spellings such as `document-\u006cayout` when asked to select the current value; avoid calling it for that no-op.
3. For a changed value, derive the desired source through the **public** `replaceFieldOption` export so layout placeholder semantics are retained. Find the selected scalar in the result by `context.path` using the app's existing `parseJsonSource` parser. Do not search for a matching string or import transitive `jsonc-parser` as a direct dependency. Diff the original and desired prefixes and suffixes outside this scalar separately. Supply those nonoverlapping edits as synchronous `additionalTextEdits`; keep the main scalar edit single-line. Assert the combined edits reconstruct the intended source exactly.
4. Update `filterText` for the quoted main range. The prototype uses `JSON.stringify(option.label) + ' ' + rawInsertedToken`. The **actual** Monaco `CompletionModel` retains all 32 at the original cursor with this mapping. Naively retaining the existing unquoted filter text retains zero because the filter prefix now includes the opening quote. Include escaped-current-value filtering in the regression.
5. Keep whitespace insertion rules explicit. Use synchronous additional edits, not a later whole-document assignment or an asynchronous command that creates a second history step. Monaco's installed `suggestController.js:276–301,365–376` surrounds synchronous extra edits and the main insertion with common undo stops. That implementation supports the proposed design; it is not a browser undo test.

Keep completion results tied to their source/model snapshot. Verify popup cancellation and recomputation when source, format, document identity, or catalogs change. Do not claim an arbitrary model version check at provider invocation protects later acceptance; the host lifecycle and Monaco reuse behavior must be tested. No stale whole-source replacement should be introduced.

## Evidence and limits

`reproduce.mjs` resolves `@openpresentation/opf-editor/json-options` through the consumer's public package export map and invokes the current TypeScript adapter after stripping types. It imports Monaco's unmodified `CompletionItem` and `CompletionModel`; CSS is ignored and minimal browser module-initialization globals are supplied. This runs the real validation/filtering code, **not a browser widget**.

The mapping prototype passes **256 design cases**: 32 choices × LF/CRLF × opening/middle/end token positions. Every proposed range passes the real constructor, contains the cursor, has nonoverlapping additional edits, and reconstructs the published desired source exactly. An additional escaped-current-value case preserves raw spelling. This is **design evidence only**: browser selection, real undo/redo, stale-source cancellation, focus, keyboard navigation, rendering, and export remain unverified for the proposed correction.

Exact reconstruction of the published result does not establish that all structural placeholder changes preserve all original bytes. The package intentionally moves/adds content, and its structural formatting must be checked with compact objects, unusual whitespace/escaping, metadata, notes, rich runs, and layout fields in different property positions. Never replace the whole document with `JSON.stringify`. The separate existing Author canvas/JSON-download serialization limitations remain outside this correction.

Next meaningful regressions: choose Title Subtitle and Text 2x through the real popup; verify added slots and existing rich text/notes/metadata; assert exact intended LF/CRLF source and one-step undo/redo; retain escaped no-op spelling and unchanged history; trigger inside value at several offsets and on key/colon boundaries; change/reorder/replace/invalidate source or catalogs while the popup is open and prove stale edits cannot apply. Preserve the existing built-in/document/loaded-choice browser tests and the separate third-trigger investigation.

## Reproduce and retain

Working directory: `/private/tmp/opf-issue88-explicit-formatting-20260921/pptx-dev`, Node `24.21.0`, macOS arm64. Installed editor `0.8.0`, Monaco `0.56.0`.

```sh
fnm exec --using=24 node /private/tmp/opf-author-completion-review-20260921/reproduce.mjs > /private/tmp/opf-author-completion-review-20260921/reproduce.log 2>&1
```

The script uses the exact worktree and original production trace paths recorded in `report.json`; rerun against that checkout while those paths remain available. `original-source.json` retains the input independently. `report.json` records every actual suggestion/range and proposal, exact public resolver paths, installed-module SHA-256s, adapter/parser/source/lock hashes, runtime, and filtering results. `SHA256SUMS` identifies this handoff's files.

Key hashes: source `e87a0370a80db80b94aadab7c03032284760e292e8976eab8296712f16ce7650`; lock `f362abf89c57fe9e93197a54520fa5fc712e85bf78b2e011285456f37283b76f`; adapter `7a7e7c5a667c73f9610beb39209d96c7beeb893bacb4855d52ca061d2527d118`.
