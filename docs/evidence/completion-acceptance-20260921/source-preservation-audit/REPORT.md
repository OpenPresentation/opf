# Author canvas and JSON download source-preservation audit

Read-only source audit, 21 September 2026. App source is `a5201c88a219262b21a6c7fd4ef49a01a5bbe0a3` in `/private/tmp/opf-completion-fix-20260921/pptx-dev`; the working tree was clean. `source-hashes.json` records the Git tree and SHA-256 identities of every relevant source, installed API and test file. No product/test edits, browser visits, production probes, builds or account writes were performed.

This investigates the broader raw-source boundary explicitly left open in core `docs/handoff-2026-09-21.md` and the durable issue88 checklist. It does not replace the failed 14/18 and 11/19 production runs or establish app47 acceptance. Geometry, native Office, fonts, renderer 0.1px and deferred ColorRef work are unchanged.

## Confirmed paths and triggers

| User action | Exact current path | Result |
| --- | --- | --- |
| Commit a changed Author canvas field, then Undo/Redo canvas | `components/author/workbench/opf-canvas-workbench.tsx:68–69` invokes public session undo/redo; `lib/opf-toolkit/use-editor-session.ts:25–37` invokes host callback for non-`source-buffer` patch/undo/redo events; `components/author/author-shell.tsx:780–786` calls `convert(toJsonText(document), 'json', format)` and `setOpfDraft` | Entire source is serialized. Undo restores semantic content, but cannot restore authored token spelling/whitespace. This covers text/properties/arrange/content operations emitting session events, and confirmed import replacement. |
| Copy or Export JSON while Author preview canvas is mounted, even without edits | `author-shell.tsx:787–794` `readCurrentDraft` commits pending draft and then always serializes `canvasSession.editor.document`; Copy at1783–1793 and text export at1836–1846 consume that text | Returned clipboard/download text is canonicalized even if commit does nothing. An unchanged read does **not** itself call `setOpfDraft`: external bytes change while the underlying code buffer can remain authored. |
| Export JSON from Author code tab, with canvas unmounted | `author-shell.tsx:788` returns `opfDraft`; text export passes it to `convert(..., 'json', 'json')`; `lib/playground/opf-codec.ts:66` returns same-format input unchanged | Already preserves raw JSON text. Do not replace this path with a serializer or describe all Author downloads as broken. |
| Download JSON in Inspector | `components/playground/playground-shell.tsx:486–503` parses the current, non-deferred `opfText` then creates `Blob([toJsonText(current.document)])` at494 | Always canonicalizes valid JSON, independently of the source-preserving Inspector canvas bridge and raw Copy OPF at505–508. |
| Author Import file → review → Open presentation | `opf-canvas-workbench.tsx:80–86` retains parsed `document`/SVG/notes, discarding the original JSON text; `:94–95` uses public `prepareOpfImport` and one root replacement event | Current import produces semantic replacement, then the same Author callback serializes it. Reusing the bridge restores the pre-import source on undo, but cannot recover the imported file's original raw spelling because those bytes were discarded. Keep exact imported-file bytes as a separately stated boundary. PPTX has no JSON source to preserve. |

`toJsonText` is explicitly `JSON.stringify(doc, null, 2) + "\n"` (`opf-codec.ts:32–34`). It replaces tabs and nonstandard spacing with two-space indentation, rewrites CRLF to LF, decodes `\u0020` and escaped slash spellings, normalizes exponent-number spelling, and sets one trailing newline. Object/array semantic values in the reproduction survive, including rich runs, notes and extension metadata; this audit does not claim those semantic values are lost. Source offsets necessarily change. An unchanged canvas commit alone does not emit a semantic update (`opf-editor/dist/canvas.js:611–657`), so merely switching tabs without editing need not rewrite the buffer.

The Blob constructors use the already-selected string with no native newline option. The anchor/object-URL helpers (`author-shell.tsx:7873–7883`, `playground-shell.tsx:1804+`) do not reserialize the document. The defect occurs before the file transport. Cross-format JSON↔YAML/Markdown conversion necessarily emits new text and should remain explicit; it is not a same-format preservation fix.

## Deterministic source-only reproduction

Command (exit0, Node24.21.0):

```sh
'/Users/michael/Library/Application Support/fnm/node-versions/v24.21.0/installation/bin/node' /private/tmp/opf-author-source-audit-20260921/reproduce.cjs > /private/tmp/opf-author-source-audit-20260921/reproduce.log 2>&1
```

`reproduce.cjs` loads the actual current codec and source bridge using an in-process TypeScript transpile hook, and uses the installed public `createEditorSession` API for validation, set, undo and redo. It mirrors the two short host serializer expressions above; it does not mount React or claim browser coverage. An initial harness attempt used CommonJS `require('@openpresentation/opf')`, which has import-only exports; that failed before running cases and is preserved in `reproduce-initial-harness-error.log`. The successful script obtains validation through the editor's public API.

| Input | Source bytes | Untouched canvas read / Inspector JSON export | Source retained by Author code-tab JSON export |
| --- | ---: | ---: | --- |
| LF |325|473; zero indentation tabs|exact325bytes|
| CRLF |332|473; all7CRLF and5tabs removed|exact332bytes|

For both inputs, Author's changed-title callback, canvas undo and redo fail exact-source expectations while semantic undo is correct. The existing Inspector bridge returns the exact minimal title change, exact original on undo and exact changed source on redo for both inputs. `results.json` retains all booleans, lengths and hashes; the `LF-*.json` and `CRLF-*.json` files retain every input/output byte. For example, LF original SHA-256 is `2e99a948a29cfb1d643f68d46e6afd913ec2f953d4d329e0faee8a7e3ca4a5ec`; CRLF original is `c40c5080ca23fb28e12398e7a35d3dac7859e7cc659b32a24133559119722608`; both serialize to `c2b6b67a09773f5139b13777793e6461ba1e6fbf27d9270b1eab8a2f62324961`.

## Smallest bounded implementation opportunity

1. Reuse the existing host `createCanvasSourceBridge` in Author with the **published** editor0.8.0 `EditorEvent` (`type`, `snapshot.undoDepth`), previous document and one surviving session. The helper is app code, not a published OPF byte serializer. Public semantic edit/transfer APIs do not retain input JSON text themselves. `updateJsonSource` preserves unchanged token slices/key order and checks semantic equivalence; the bridge additionally stores exact before/after raw history for undo/redo. Its existing ten tests include rich runs, metadata, moves, newer source, duplicates and format undo.
2. Bring Author's source writes and format writes through a synchronous ref, as Inspector already does (`playground-shell.tsx:129–145,208–232`). Every local/version/import/restore/source writer must update that ref, not only Monaco's `onChange`. Use the bridge's previous-document guard and `useOpfEditorSession` recovery callback; on conflict keep current source and reject the stale session edit. Author currently ignores the previous/event arguments and does not provide recovery. Do not bypass duplicate-key or malformed-source rejection.
3. After `canvas.commit()`, read the freshly updated authoritative source ref, verify it represents the current accepted editor document, and return those exact bytes. Do not rely on pre-commit React state captured by `readCurrentDraft`, or fall back to whole serialization after a source conflict. Pending draft commit and rejection still need to block unsafe export. Preserve the current raw-buffer fast path when canvas is absent.
4. Inspector's JSON download can retain its current parse/filename/error handling, use raw JSON for `format === 'json'`, and use conversion only when the source format is YAML/Markdown. Read the same authoritative current source when committing an active draft is part of that action. No Blob/newline normalization is needed.

This is a host integration correction without package/API/version changes. Preserve public edit APIs, explicit Format Document, rich arrays and source locations recalculated against the resulting text. A bridge alone does not certify exact raw JSON import, account/agent serialization, preset changes, format conversion or every Author writer. Adjacent source serializers exist (for example local metadata update at`author-shell.tsx:1448–1471`); record them as separate boundaries, not silently included in this small task.

## Minimum meaningful browser regression

Current `tests/e2e/author.spec.ts:17–25` parses JSON downloads in its `source()` helper. Inspector's `tests/e2e/inspector.spec.ts:102–108` likewise parses the file before comparing it. Those checks prove semantic content but cannot detect this defect. Existing Author categorical and Inspector canvas exact-clipboard checks do not cover Author preview/export or JSON-file bytes.

Add two focused anonymous route flows, each parameterized LF/CRLF, with one valid small fixture containing tabs, unusual colon spacing, escaped Unicode/slash, exponent extension values, rich runs, notes, stable slide IDs and an explicit font scheme:

- **Author:** seed the supported local-workspace raw source contract or paste normally; establish editor and canvas readiness by the actual fixture title. Download JSON in code view and compare file `Buffer` bytes with the fixture. Mount preview without editing; compare Copy's submitted buffer and actual JSON file to the same source. No-op/cancel a title draft and check unchanged bytes. Change only that title, then verify exact expected replacement, one-step Undo exact original, Redo exact replacement, and source-tab persistence. Export with a pending changed draft and prove it commits the latest title into the exact expected bytes; retain the existing rejection/semantic export behavior. Check rich values and metadata as well as raw bytes. Use normal user interactions for the main flow; any no-blur handler-boundary test is supplementary.
- **Inspector:** load the same authored JSON into the source buffer; check JSON download bytes before editing, after one ordinary canvas title edit and after undo. This catches its independent download serializer even if clipboard/source already pass. Retain YAML/Markdown→JSON semantic-conversion coverage separately.

After fonts/worker readiness is established, take these actions offline and assert no POSTs/page errors as the existing workflow tests do. Capture one reviewed screenshot per relevant viewport if UI changes. Compare bytes without trimming, JSON.parse, EOL conversion or platform clipboard normalization; actual file transport is the primary download oracle. Use existing pass-through clipboard observation for exact submitted source, with separate platform transport checks. Add focused host tests only for new commit/ref/conflict behavior not already exercised by bridge tests. Fresh local browser, Linux/Windows CI and exact-source canonical acceptance remain required; this audit grants none of those gates.
