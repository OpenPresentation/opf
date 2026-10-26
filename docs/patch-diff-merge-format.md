# Patch, diff, merge and format

Status: in core 0.12.0 (RR-31) as the `@openpresentation/opf/patch`, `/diff` and `/format` entrypoints; the CLI commands `opf diff`, `opf merge` and `opf format` are in CLI 0.10.0 and later, not in CLI 0.9.2 (which has `opf edit`, JSON Patch). Core 0.11.4 and earlier lack the entrypoints. Check `opf --help` and the installed package exports before relying on them.

Four deterministic, local pieces share one implementation: no network, no model call, no clock, no randomness. The same inputs always give the same output.

| Piece | Core entrypoint | CLI |
| --- | --- | --- |
| JSON Patch (RFC 6902) with inverse patches | `@openpresentation/opf/patch` | `opf edit` |
| Semantic diff of two documents | `@openpresentation/opf/diff` | `opf diff` |
| Three-way merge with conflict objects | `@openpresentation/opf/diff` | `opf merge` |
| Canonical key order and layout | `@openpresentation/opf/format` | `opf format` |
| Ids, id-addressed paths, document hash, patch scope | `@openpresentation/opf/ids` (the patch parts also on `/patch`) | |

## One patch module

`opf edit`, the editor session (`@openpresentation/opf-editor`, undo/redo) and the diff output all use `@openpresentation/opf/patch`. There is no second implementation.

```ts
import { applyPatch, applyPatchWithInverse, invertPatch, OPFPatchError } from "@openpresentation/opf/patch";

const next = applyPatch(presentation, [
  { op: "test", path: "/slides/0/id", value: "intro" },
  { op: "replace", path: "/slides/0/title", value: "Welcome" },
  { op: "move", from: "/slides/3", path: "/slides/1" },
]);
// applyPatch clones: `presentation` is never changed, and any failure applies nothing.

const { presentation: after, inverse } = applyPatchWithInverse(presentation, patch);
applyPatch(after, inverse); // deep-equals `presentation`: this is the undo patch
```

- All six RFC 6902 operations: `add`, `remove`, `replace`, `move`, `copy`, `test`. Unknown members of an operation are ignored (RFC 6902 section 4); unknown `op` values are errors.
- Pointers are strict RFC 6901. `-` is accepted only as the final token of an `add`, `move` target or `copy` target. Array indexes are canonical decimal (`01`, `-1` and `1.0` are errors). `parsePointer`, `formatPointer`, `escapePointerToken`, `pointerFromPath` (a pointer, an OPF dotted path such as `slides.0.title`, or a segment array) and `splitPointer` give every caller the same path handling; build pointers with `formatPointer` rather than joining unescaped keys.
- Errors are `OPFPatchError` with a stable `code` (`patch-test-failed`, `patch-path-missing`, `patch-parent-missing`, `invalid-array-index`, `invalid-json-pointer`, `invalid-patch`, `invalid-patch-operation`, `unsupported-patch-operation`, `patch-invalid-move`, `patch-root-remove`, `patch-invalid-document`, `patch-id-not-found`, `patch-id-ambiguous`, `invalid-expect-hash`, `patch-hash-mismatch`), the failing operation's `index` and `path`, and a message that starts with `Operation <n>:`.
- `test` fails on a missing path, and compares by JSON value: member order is irrelevant, `0` equals `-0`, arrays compare in order. `move` onto itself is a no-op; moving a value into its own descendant is an error; removing the document root is an error. A `__proto__` key is data and never reaches a prototype.
- Optional schema validation of the result: `applyPatch(presentation, patch, { validate: true })` (or a custom validator; add `strict: true` to reject warnings) throws `OPFPatchValidationError` with the full validation report when the final document is invalid. Intermediate states are not validated, so a patch may pass through an invalid state. `opf edit` validates the saved document itself, as before.
- Inverse patches: `applyPatchWithInverse` and `invertPatch` return operations that restore the input exactly, in reverse order, with concrete array indexes (the inverse of an `add` at `-` removes the real index). `test` has no inverse. The editor stores these in its undo stack.

## Ids, id-addressed paths, hashes and patch scope

Indexes move: `/slides/3/blocks/1` is another block once a slide is inserted above it. Anything that edits with other people or other programs (remote patches, comments, review, an agent's proposal) needs paths that name the thing, and a way to say "only if nothing changed". Slides and content payloads (blocks, groups, regions) already have an optional `id`, unique among slide and payload ids; these pieces build on it. They live in `@openpresentation/opf/ids` and on the package root (the pointer, hash and `expectHash` parts are also on `/patch`); all of them are deterministic, offline and browser-safe.

### `assignIds`

```ts
import { assignIds } from "@openpresentation/opf/ids";

const { document, patch, assigned } = assignIds(presentation);
// document: a copy where every slide and payload has an id
// patch:    the same change as `add` operations (`/slides/0/id`, ...), for an editor to apply as one undoable edit
// assigned: [{ pointer: "/slides/0", kind: "slide", id: "slide-1" }, ...]
```

Missing ids are filled in document order (slides, then each slide's blocks, nested groups and promoted regions), as `slide-1`, `slide-2`, ... and `block-1`, `block-2`, ..., skipping ids already in use, so the same document always gets the same ids and the result is valid against the schema. An existing id is never changed. Pass `generate({ kind, pointer, node, parentId })` to choose the ids yourself (a UUID, a slug of the title); it must return a non-empty string no slide or payload uses, or `assignIds` throws `OPFIdError` (`invalid-id`, `duplicate-id`). The id is added as the node's last member; `format` puts it in canonical order. List items, table rows and runs have no id.

### Id-addressed paths

In an array, the pointer token `@intro` is the element whose `id` is `intro`: `/slides/@kpis/blocks/@note/text`. It is a valid RFC 6901 pointer, so every JSON Pointer tool can carry it; it resolves in OPF's own `readPointer`, `getAtPointer`, `applyPatch` (every operation, `from` and `path`) and the editor's `get`, `set` and `applyPatch`.

```ts
import { applyPatch, resolveIdPointer, toIdPointer, resolveIdPatch, toIdPatch } from "@openpresentation/opf/patch";

resolveIdPointer(doc, "/slides/@kpis/blocks/@note/text"); // "/slides/1/blocks/1/text"
toIdPointer(doc, "/slides/1/blocks/1/text");              // "/slides/@kpis/blocks/@note/text"
applyPatch(doc, [{ op: "replace", path: "/slides/@kpis/blocks/@note/text", value: "Edited" }]);
toIdPatch(doc, patch);      // every index that names an element with an id, operation by operation
resolveIdPatch(doc, patch); // the reverse: every id token as the index it has when its operation runs
```

- **Why `@`.** It is legal in a pointer token and in a URI fragment (`#/slides/@intro`) without percent-encoding; `{id:intro}` would need `%7B` and `%7D` there. Arrays have no other use for a token that is not an index, and the token is read as an id only where the value is an array, so an object key such as an extension's `@context` is still a plain key. An id that begins with `@` is written `@@id`; `/` and `~` in an id escape as in any pointer (`~1`, `~0`).
- **Resolution.** `resolveIdPointer` throws `patch-id-not-found` for an id no element has and `patch-id-ambiguous` for an id several elements of the array share (an invalid document; `readPointer` reports it as not found). A path that does not exist is not an error: only the id tokens are resolved. `toIdPointer` writes an id token only where the element's `id` is a non-empty string no other element of the array has; other indexes stay.
- **`move` and insertion.** An id as the last token of `add`, `copy` or `move` inserts before that element (an index does the same). A `move` resolves its destination after the value has left, as RFC 6902 reads an index. The `patch` and `inverse` that `applyPatchWithInverse` returns keep the paths as written and in index form respectively: an inverse never depends on ids.
- **`toIdPatch`** writes each operation against the document it applies to, so a host that syncs by id sends a patch that still means the same thing after the receiver has reordered. Where an operation inserts, the last token stays an index (or `-`): there is no element yet to name; its ancestors are named by the ids they have before the insertion.

### `documentHash` and `expectHash`

```ts
import { documentHash, applyPatch, OPFPatchHashError } from "@openpresentation/opf/patch";

const hash = documentHash(doc); // "sha256:" + 64 hex digits
applyPatch(doc, patch, { expectHash: hash }); // throws OPFPatchHashError (code patch-hash-mismatch) when doc is not the document hashed; nothing is applied
```

The hash is SHA-256 over the document's canonical JSON: the members of every object sorted by UTF-16 code unit at every depth (RFC 8785), no whitespace. Two documents hash alike exactly when `jsonEqual` calls them equal: key order, a JSON, YAML or Markdown round trip, and formatting do not matter; any content change, including array order, does. (`format` is not the canonical form here: it keeps keys the schema does not declare in their written order, which is right for a file and wrong for an identity.) The digest is pure JavaScript and synchronous, with no Node import and no Web Crypto, so it is the same in Node, browsers and edge runtimes and can be checked inside the synchronous `applyPatch`. `expectHash` also takes the bare 64-digit hex; a value that is not a hash throws `invalid-expect-hash`. `edit(deck, patch, { expectHash })` takes it too. A server that holds the document answers a client's patch with `expectHash` as optimistic concurrency, without writing its own etag code. This is not the CLI's `--expect-sha256`, which is the digest of a file's bytes.

### `touches`

```ts
import { touches } from "@openpresentation/opf/ids";

const scope = touches(patch, document);
scope.writes; // [{ operation: 1, op: "replace", pointer: "/slides/1/title", idPointer: "/slides/@kpis/title", kind: "slide", ids: ["kpis"], slideIds: ["kpis"] }]
scope.reads;  // `test`, and the source of `copy`
scope.ids, scope.slideIds, scope.kinds;
```

What a patch reads and writes, for conflict detection and permission checks. With the `document` the patch was made for, the patch is walked operation by operation, so every `pointer` is the index path as it is when its operation runs, every `idPointer` is its id form, and a `remove`, `replace` or `move` of a slide or group lists the ids inside it. Without a document, the pointers are as written and `ids` holds the id tokens and the ids of the values the operations insert. A patch that does not apply throws the error `applyPatch` throws. `kind` is the part of the deck a location belongs to: `document`, `slide-order` (the `slides` array, or a slide added, removed or moved), `slide`, `block` (a payload or the `blocks` array that holds it), `design`, `assets`, `catalogs` or `metadata`.

Two patches made against the same document conflict when a write of one has the same `idPointer` as, or sits inside or above, a location the other reads or writes, or the other destroys what is in its `ids`. A `move` changes where an element sits, not what is inside it: do not count the descendants of a `move` location. A permission check reads `kind`, `slideIds` and `ids` of `writes` (moves included). What counts as a conflict and who may touch what stays with the host; the library only reports the scope.

The editor reports the same patches by id (`createEditorSession(doc, { idPaths: true })`), accepts `expectHash` on `applyPatch` and assigns ids as one edit (`session.assignIds()`); see the editor README.

## Diff

```ts
import { diff, formatDiffReport } from "@openpresentation/opf/diff";

const result = diff(a, b);
result.equal;     // true when nothing differs
result.patch;     // RFC 6902 patch: applyPatch(a, result.patch) deep-equals b
result.changes;   // typed, categorised changes
result.slides;    // how each slide was matched, and its status
result.summary;   // counts by type, category and slide status
formatDiffReport(result); // plain-text report
```

**Matching.** Arrays are matched element by element, in this order, and the same rule applies to slides, blocks, list items, table rows and every other array:

1. a shared string `id`;
2. identical content (an order-preserving match first, then anywhere, so a moved slide with no `id` is still found);
3. content similarity for objects and arrays: the share of scalar leaves with the same path and value, with partial credit for text that shares words. The default threshold is 0.5 (`threshold` option); two elements that both carry an `id` and differ in it must reach 0.8, so an unrelated added slide is not mistaken for a renamed one;
4. leftover primitives between matched neighbours pair by position (an edited bullet is one `replace`).

Ties break by index, so the result never depends on iteration order or object key order. Arrays too large for the similarity pass (over 250,000 element pairs) fall back to id and equality matching.

**Moves.** Matched elements that are out of order are found with a longest in-order chain, so moving one slide is one `move` operation and one `moved` change, not a remove and an add.

**Changes.** Each change has a `type` (`added`, `removed`, `changed`, `moved`), a `category` (`slide`, `block`, `field`, `design`, `metadata`, `assets`, `catalogs`, `variables`, `narrative`, `extensions`), a JSON Pointer in A (`aPath`) and/or B (`bPath`), the `before` and `after` values, and the `slide` it belongs to (`id`, `title`, `aIndex`, `bIndex`). Root keys other than `slides`, `design`, `assets`, `catalogs`, `variables`, `narrative` and `extensions` are `metadata`; a slide's own `design` is `design`; adding, removing or moving a `blocks` element or a region payload (`left`, `center+right`, `top:left`, ...) is `block`; everything else inside a slide is `field`.

**The patch** applies removals (highest index first), then moves, then insertions in ascending order, then edits inside matched elements at their final positions, so every path is valid when its operation runs.

```text
$ opf diff before.opf.json after.opf.json
7 changes (slides: 1 added, 1 removed, 1 moved, 2 modified; metadata: 1; design: 1)

Metadata
  ~ name  "Deck" -> "Renamed"

Design
  ~ design.theme  "bold" -> "minimal"

Slides
  ~ slide #1 "End" (id end)
      + blocks[1]  chart
  ~ slide #2 "Welcome" (id intro) (moved from #1)
      ~ title  "Intro" -> "Welcome"
  + slide #3 "New" (id new)
  - slide #2 "Old" (id old)
```

CLI: `opf diff <a|-> <b|-> [--format text|json|patch] [--exit-code] [--threshold <0-1>]`. `--format json` prints the report `{command, ok, input, outputs, findings, counts, equal, summary, slides, changes, patch}` (CLI 0.18; `{equal, summary, slides, changes, patch}` before); `--format patch` prints only the patch (feed it to `opf edit --patch`). Exit 0 unless `--exit-code` is given and the documents differ (then 1); usage and I/O errors exit 2. `-` reads one side from stdin.

## Merge

```ts
import { merge } from "@openpresentation/opf/diff";

const { merged, conflicts, clean, applied } = merge(base, ours, theirs, { prefer: "ours" });
```

Changes in different places merge automatically; the same change on both sides is applied once. Arrays merge element by element with the diff matcher:

- insertions from both sides are kept (ours first where both inserted at the same position); an identical insertion, or the same `id` inserted twice, appears once (same `id` with different content merges field by field);
- a deletion of an untouched element wins; a deletion against an edit is a conflict;
- a move on one side is applied on top of the other side's edits; the same move on both sides agrees; different moves of the same element conflict.

**Conflicts are never silent.** Each is an object with `kind` (`modify-modify`, `modify-delete`, `delete-modify`, `add-add`, `move-move`), `path` (JSON Pointer in the merged document), `base`, `ours` and `theirs` values (absent when that side deleted the value; `deletedBy` names the deleting side), `resolution` (which side the merged document took), the `slide` it is inside, and a `message`. The merged document always holds one side's value at a conflict (`prefer`, default `ours`), and the conflict keeps the other side's value, so neither side is dropped without a record. `clean` is `true` only when there are no conflicts. `applied` counts the places taken from only one side or identical on both.

The merge result is not schema-validated by the library; `opf merge` validates it before writing, because two valid documents can merge into an invalid one (for example duplicate ids).

CLI: `opf merge <base> <ours> <theirs> [output|-] [-i] [--force] [--prefer ours|theirs] [--report <file>] [--threshold <0-1>] [--fail-on <level>]`. With conflicts and no `--prefer`, nothing is written, the conflict report goes to stderr as JSON and the exit code is 1. With `--prefer`, the chosen side's value is written, the report lists every conflict, and the exit code is 0. `--report <file>` saves the `{clean, conflicts, applied}` summary. `-i` (`--in-place`) rewrites the *ours* file (like `git merge-file`) with the same guard as `opf edit`. The usual output rules apply: stdout without an output, `--force` to replace a file.

## Format

```ts
import { format, sortPresentationKeys, isFormatted } from "@openpresentation/opf/format";

const text = format(sourceTextOrDocument);
```

- **Key order** follows the property declaration order of the OPF schema at every depth (through `$ref`, `oneOf`, `anyOf`, `allOf` and `then`/`else`): `$schema`, `name`, `description`, ..., `design`, `variables`, `narrative`, `slides`, `assets`, `catalogs`, `extensions` at the root, `id`, `layout`, `title`, ... in a slide. Keys the schema does not declare (extensions, catalog records, custom colours, unknown fields) follow the declared ones in their original relative order, so formatting never reorders user data that has no canonical order. Array order and every value are unchanged.
- **Layout** is two-space indentation (`indent` 0 to 8), LF line endings (`eol: "crlf"` for Windows checkouts that use `core.autocrlf`), no BOM, one trailing newline. Formatting is idempotent.
- It does not validate: any JSON document can be formatted, and formatting never changes validity.

CLI: `opf format <file|-> [output|-]` or `opf format <file>... (-i | --check)`, with `[--indent <0-8>] [--eol lf|crlf|preserve]`. One file with no output prints the canonical text to stdout; an output must name the same form (`opf convert` changes forms). `--check` reports `checked`, `formatted` and `unformatted` and exits 1 if any file would change (use it in CI); `-i` rewrites only changed files atomically; several files need `--check` or `-i`. `--eol preserve` keeps each file's own line endings.

## What this does not do

- It is structural, not visual: a diff of two decks says nothing about whether either composes, overflows or exports well.
- Merge treats text as a value: two edits to different words of the same string are a conflict, not a text merge.
- Similarity matching is a heuristic with a documented threshold. When it matters, give slides stable ids (`assignIds`); ids are always trusted over content.
- `touches` and the hash do not transform or rebase a patch over another: that is a later item of the cloud-editor program. They give a host what it needs to detect that a rebase is required.
