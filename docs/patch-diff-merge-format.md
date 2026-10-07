# Patch, diff, merge and format

Status: in core 0.12.0 (RR-31) as the `@openpresentation/opf/patch`, `/diff` and `/format` entrypoints; the CLI commands `opf diff`, `opf merge` and `opf format` are in CLI 0.10.0 and later, not in CLI 0.9.2 (which has `opf edit`, JSON Patch). Core 0.11.4 and earlier lack the entrypoints. Check `opf --help` and the installed package exports before relying on them.

Four deterministic, local pieces share one implementation: no network, no model call, no clock, no randomness. The same inputs always give the same output.

| Piece | Core entrypoint | CLI |
| --- | --- | --- |
| JSON Patch (RFC 6902) with inverse patches | `@openpresentation/opf/patch` | `opf edit` |
| Semantic diff of two documents | `@openpresentation/opf/diff` | `opf diff` |
| Three-way merge with conflict objects | `@openpresentation/opf/diff` | `opf merge` |
| Canonical key order and layout | `@openpresentation/opf/format` | `opf format` |

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
- Errors are `OPFPatchError` with a stable `code` (`patch-test-failed`, `patch-path-missing`, `patch-parent-missing`, `invalid-array-index`, `invalid-json-pointer`, `invalid-patch`, `invalid-patch-operation`, `unsupported-patch-operation`, `patch-invalid-move`, `patch-root-remove`, `patch-invalid-document`), the failing operation's `index` and `path`, and a message that starts with `Operation <n>:`.
- `test` fails on a missing path, and compares by JSON value: member order is irrelevant, `0` equals `-0`, arrays compare in order. `move` onto itself is a no-op; moving a value into its own descendant is an error; removing the document root is an error. A `__proto__` key is data and never reaches a prototype.
- Optional schema validation of the result: `applyPatch(presentation, patch, { validate: true })` (or a custom validator; add `strict: true` to reject warnings) throws `OPFPatchValidationError` with the full validation report when the final document is invalid. Intermediate states are not validated, so a patch may pass through an invalid state. `opf edit` validates the saved document itself, as before.
- Inverse patches: `applyPatchWithInverse` and `invertPatch` return operations that restore the input exactly, in reverse order, with concrete array indexes (the inverse of an `add` at `-` removes the real index). `test` has no inverse. The editor stores these in its undo stack.

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

CLI: `opf diff <a|-> <b|-> [--format text|json|patch] [--exit-code] [--threshold <0-1>]`. `--format json` prints `{equal, summary, slides, changes, patch}`; `--format patch` prints only the patch (feed it to `opf edit --patch`). Exit 0 unless `--exit-code` is given and the documents differ (then 1); usage and I/O errors exit 2. `-` reads one side from stdin.

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

CLI: `opf merge <base> <ours> <theirs> [--output <file|-> | --in-place] [--force] [--prefer ours|theirs] [--report <file>] [--dry-run] [--threshold <0-1>] [--fail-on <level>]`. With conflicts and no `--prefer`, nothing is written, the conflict report goes to stderr as JSON and the exit code is 1. With `--prefer`, the chosen side's value is written, the report lists every conflict, and the exit code is 0. `--report <file>` saves the `{clean, conflicts, applied}` summary. `--in-place` rewrites the *ours* file (like `git merge-file`) with the same hash guard as `opf edit`. The usual output rules apply: stdout without an output option, `--force` to replace a file.

## Format

```ts
import { format, sortPresentationKeys, isFormatted } from "@openpresentation/opf/format";

const text = format(sourceTextOrDocument);
```

- **Key order** follows the property declaration order of the OPF schema at every depth (through `$ref`, `oneOf`, `anyOf`, `allOf` and `then`/`else`): `$schema`, `name`, `description`, ..., `design`, `variables`, `narrative`, `slides`, `assets`, `catalogs`, `extensions` at the root, `id`, `layout`, `title`, ... in a slide. Keys the schema does not declare (extensions, catalog records, custom colours, unknown fields) follow the declared ones in their original relative order, so formatting never reorders user data that has no canonical order. Array order and every value are unchanged.
- **Layout** is two-space indentation (`indent` 0 to 8), LF line endings (`eol: "crlf"` for Windows checkouts that use `core.autocrlf`), no BOM, one trailing newline. Formatting is idempotent.
- It does not validate: any JSON document can be formatted, and formatting never changes validity.

CLI: `opf format <file|->... [--check | --in-place | --output <file|->] [--indent <0-8>] [--eol lf|crlf|preserve]`. One file with no mode prints the canonical text to stdout. `--check` prints `{checked, formatted, unformatted}` and exits 1 if any file would change (use it in CI); `--in-place` rewrites only changed files atomically; several files need `--check` or `--in-place`. `--eol preserve` keeps each file's own line endings.

## What this does not do

- It is structural, not visual: a diff of two decks says nothing about whether either composes, overflows or exports well.
- Merge treats text as a value: two edits to different words of the same string are a conflict, not a text merge.
- Similarity matching is a heuristic with a documented threshold. When it matters, give slides stable ids; ids are always trusted over content.
