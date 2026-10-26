# Cloud-ready engine and editor (CE)

Opened 2026-10-25. Branches `codex/ce-<nn>-<slug>`, PR titles `CE-<nn>: `. Items and status: [burndown.md](burndown.md).

## Goal

Any host can build a Figma-class presentation product on the open packages without copying the engine. The OPF engine runs unchanged on edge runtimes (Cloudflare Workers, Vercel Edge, Deno) as well as Node and browsers. The editor can be embedded with one call, or from React. Documents have stable ids that edits can be addressed to. Edits can be grouped, proposed and reviewed, diffed, permission-checked, anchored for comments and merged. pptx.dev is the first host to adopt each piece, and openpresentation.org and pptx.gallery adopt them too.

## Open-core boundary

The open packages hold anything deterministic and offline that every host would otherwise rewrite:

- format and engine;
- ids and id-addressed paths;
- patch scope (`touches`) and `expectHash`;
- patch rebase;
- comment anchors;
- the proposal and hunk machinery;
- `authorizePatch`;
- the embeddable editor SDK and React bindings;
- the sync and asset-store interfaces;
- the edge render runtime;
- brand-kit composition.

Hosts hold:

- sync servers and presence channels;
- comment threads;
- asset and version storage;
- queues;
- identity and permission enforcement;
- AI orchestration;
- hosted MCP;
- metering and billing.

## Definition of done

1. **Edge runtime.** A `workerd` CI lane runs `validate`, `toSvg`, `toPng` (through a rasterizer interface with a resvg-wasm adapter), `toPdf`, `toPptx`, `fromPptx` and in-memory `convert` on five example decks. Validators are precompiled by default under `workerd` and `worker` conditions. Fonts load from bytes.
2. **Ids.** An `assignIds` helper fills missing slide and block ids, and the editor uses id-addressed paths. Core has `documentHash`, and a patch can carry an `expectHash` precondition.
3. **Editor SDK.** `createOpfEditor(el, options)` is promoted from the playground and covers source, canvas, navigator, presenter, Layout Studio and review. `@openpresentation/opf-editor/react` provides bindings, and the editor chrome can be themed with tokens. openpresentation.org's playground runs on it.
4. **Transactions and proposals.** `session.transact()` groups edits into one undo step. AI and remote edits arrive as proposals that can be accepted or rejected as a whole or hunk by hunk, in the canvas and the source pane.
5. **History and permissions.** `summarizeDiff` and a visual diff view, plus `authorizePatch(patch, policy)` with a read-only mode.
6. **Anchors, assets, brand.** Comment anchors survive edits. There is an `AssetStore` interface. Brand-kit records inherit and report drift.
7. **Collaboration.**
   - Async `merge` sync mode.
   - Large-deck performance budgets.
   - Realtime after a spike of Yjs against patch transform.

## Invariants

- No host-specific code in the packages; a host plugs in through options and interfaces.
- Every addition is documented, typed, and tested in the package that owns it, with a changelog fragment.
- Format changes follow the format-audit rules: pre-v1, no deprecation shims.
