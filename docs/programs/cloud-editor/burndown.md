# Cloud-ready engine and editor: burndown

Goal and boundary: [README.md](README.md). Status values: `todo`, `in-progress`, `done`, `descoped`. Whoever changes an item's state edits its row and appends a log line in the same PR.

| ID | Item | Package | Acceptance | Status |
| --- | --- | --- | --- | --- |
| CE-01 | Precompiled validators by default on edge runtimes, with a `workerd` CI lane | core, CI | `validate` runs under `workerd`/`worker` conditions with no runtime code generation; CI runs it in workerd on the example decks | done | [opf#863](https://github.com/OpenPresentation/opf/pull/863). The `workerd`, `worker` and `edge-light` conditions load validators compiled at build time (`#schema-engine` in package.json `imports`); `import "@openpresentation/opf/precompiled"` installs them elsewhere. The lane is `packages/javascript/test/workerd.test.mjs` in the `core` job. The browser keeps Ajv: the precompiled build adds about 78 KB gzipped. pptx.dev drops its `ajv/dist/2020.js` alias after the next release |
| CE-02 | Fonts from bytes; a rasterizer interface with a resvg-wasm adapter | render, pptx | `toPng`, `toPdf` and `toPptx` (with raster fallbacks) run in workerd on five example decks in CI | todo |
| CE-03 | In-memory `convert` outside Node | core | `convert` works with bytes in workerd and browsers | todo |
| CE-04 | `assignIds`, id-addressed paths, `documentHash`, `expectHash` | core, editor | Missing ids filled deterministically; a patch with a stale `expectHash` is rejected; the editor emits id paths | done | [opf#862](https://github.com/OpenPresentation/opf/pull/862) |
| CE-05 | Patch scope `touches` | core | Returns the ids and paths a patch reads and writes | done | [opf#862](https://github.com/OpenPresentation/opf/pull/862) |
| CE-06 | `createOpfEditor` SDK and React bindings, with chrome theming tokens | editor | One call mounts the full editor; openpresentation.org's playground runs on it; `/react` exports components and hooks | done | opf#865 and openpresentation-site#162 (merged on 0.27.0) |
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
| CE-17 | Source-pane host hooks: `cursor` event, reveal without focus, host decorations | editor | A `cursor` event `{ pointer, idPath, from, to }` in JSON, YAML and Markdown (SDK and React); `revealPath` scrolls without taking focus; a host sets and clears its own marks and line classes by path or range, apart from the editor's; pptx.dev can drop Monaco | in-progress |

## Progress log

- 2026-10-25: program opened; the first host is pptx.dev.
- 2026-10-26: CE-06 in review: `createOpfEditor` (`@openpresentation/opf-editor/workspace`), `<OpfEditor>` and the hooks (`/react`), the `--opf-ui-*` token contract and the `theme` option are in the opf PR, and `examples/playground.js` is a thin user of them. openpresentation.org's playground runs on the SDK in a draft PR (Data-Advantage/openpresentation-site) that waits for the editor release. Done when both are merged and released.
- 2026-10-25: CE-01 done in opf#863: precompiled validators by default under the `workerd`, `worker` and `edge-light` conditions, an explicit `@openpresentation/opf/precompiled` import for other hosts, and a `workerd` lane in the core job. Probes for CE-02: `toSvg` and `toPptx` run in workerd for a one-slide deck (`toPptx` with `nodejs_compat`); their bundles are 4.8 MB and 8.8 MB unminified.
- 2026-10-26: CE-04 and CE-05 landed in opf#862 (`assignIds`, id-addressed paths, `documentHash`, `expectHash`, `touches`, and the editor's id paths); rows updated. CE-06 is done: openpresentation-site#162 merged on 0.27.0, so openpresentation.org's playground runs on the SDK.
- 2026-10-26: CE-17 in review: the source pane tells the host where the caret is (`cursor` event and `getCursor()`, with the pointer, the id path and the selection, in JSON, YAML and Markdown; `onCursor` on the SDK and React, `useOpfCursor`), `revealPath` scrolls a pointer or range into view without taking focus, and `setDecorations` draws the host's own marks and line classes by path or range in named groups, apart from the editor's own. Added from the oss-first study (pptx.dev drops Monaco once this lands, PD-20). Done when merged.
