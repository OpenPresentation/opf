# Cloud-ready engine and editor: burndown

Goal and boundary: [README.md](README.md). Status values: `todo`, `in-progress`, `done`, `descoped`. Whoever changes an item's state edits its row and appends a log line in the same PR.

| ID | Item | Package | Acceptance | Status |
| --- | --- | --- | --- | --- |
| CE-01 | Precompiled validators by default on edge runtimes, with a `workerd` CI lane | core, CI | `validate` runs under `workerd`/`worker` conditions with no runtime code generation; CI runs it in workerd on the example decks | todo |
| CE-02 | Fonts from bytes; a rasterizer interface with a resvg-wasm adapter | render, pptx | `toPng`, `toPdf` and `toPptx` (with raster fallbacks) run in workerd on five example decks in CI | todo |
| CE-03 | In-memory `convert` outside Node | core | `convert` works with bytes in workerd and browsers | todo |
| CE-04 | `assignIds`, id-addressed paths, `documentHash`, `expectHash` | core, editor | Missing ids filled deterministically; a patch with a stale `expectHash` is rejected; the editor emits id paths | todo |
| CE-05 | Patch scope `touches` | core | Returns the ids and paths a patch reads and writes | todo |
| CE-06 | `createOpfEditor` SDK and React bindings, with chrome theming tokens | editor | One call mounts the full editor; openpresentation.org's playground runs on it; `/react` exports components and hooks | in-progress |
| CE-07 | `session.transact()` | editor | Grouped edits form one undo step and one change event | todo |
| CE-08 | Proposals | core, editor | Accept or reject a proposal as a whole or hunk by hunk, in the canvas and the source pane; streamed patches supported | todo |
| CE-09 | `summarizeDiff` and a visual diff view | core, editor | A version-compare UI component | todo |
| CE-10 | `authorizePatch` and read-only mode | core, editor | A policy rejects disallowed paths; the editor gates its controls | todo |
| CE-11 | Comment anchors | core, editor | Anchors survive moves and edits, with marker hooks in the canvas | todo |
| CE-12 | `AssetStore` interface | editor, render, pptx | Hosts plug storage in for upload and resolve | todo |
| CE-13 | Brand-kit composition and drift | core, gallery | Inheritance and a drift report | todo |
| CE-14 | Large-deck performance budgets | editor, core | Budgets enforced in CI at 1,000 slides | todo |
| CE-15 | Async `merge` sync mode | editor | Concurrent edits merge through core three-way `merge`, with explicit conflicts | todo |
| CE-16 | Realtime spike: Yjs binding against patch transform | editor | A written decision with ten real conflict cases | todo |

## Progress log

- 2026-10-25: program opened; the first host is pptx.dev.
- 2026-10-26: CE-06 in review: `createOpfEditor` (`@openpresentation/opf-editor/workspace`), `<OpfEditor>` and the hooks (`/react`), the `--opf-ui-*` token contract and the `theme` option are in the opf PR, and `examples/playground.js` is a thin user of them. openpresentation.org's playground runs on the SDK in a draft PR (Data-Advantage/openpresentation-site) that waits for the editor release. Done when both are merged and released.
