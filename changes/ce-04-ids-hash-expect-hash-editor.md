---
type: added
packages: [editor]
---
CE-04: id-addressed patch events and the revision guard on the session. `createEditorSession(doc, { idPaths: true })` makes every change and `subscribe` event also carry `idPatches`, `idInversePatches` and `idRedoPatches`, the same patches addressed by id (`/slides/@intro/blocks/@kpi/text`) and written against the document each applies to, so a host can sync or comment by id; without the option the events are unchanged. A path may name an element by id (`slides.@intro.title`) in `get`, `set` and `applyPatch`. `session.documentHash()` returns core's `documentHash` of the open document, and `applyPatch(ops, meta, { expectHash })` applies only while the document is still that one, else throws an `OPFEditorError` with code `patch-hash-mismatch` (`details.expected`, `details.actual`) and changes and emits nothing. `session.assignIds(options, meta)` runs core's `assignIds` as one undoable edit (`null` when no id is missing).
