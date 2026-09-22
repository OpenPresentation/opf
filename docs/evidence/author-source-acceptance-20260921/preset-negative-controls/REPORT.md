# Author preset Undo all: retained negative controls

2026-09-21. Diagnostic source/UI evidence; no product fix, release, native compatibility, or full acceptance claim.

## Confirmed result

Two one-attempt anonymous UI scenarios demonstrate destructive stale Undo all behavior. A preset's old whole-document snapshot remains actionable after New run and after importing another presentation. Clicking the visible Undo all restores the previous presentation and discards the replacement. The separate ordinary edit scenario stopped at its exact raw-buffer precondition; it did not click Undo all and is not a third demonstrated overwrite.

| Scenario | Actual stage/outcome | Later content preserved? |
| --- | --- | --- |
| New run | Classic preset → visible New run → old visible undo all | No: five-slide Northstar starter replaced by the original one-slide synthetic deck |
| JSON file import | Classic preset → preview → Import file → Open presentation → old visible undo all | No: imported title, author, name and replacement slide ID replaced by the original deck |
| Ordinary code edit | Classic preset → real source editor paste changes title → exact raw-buffer assertion fails | Undo not attempted; raw model EOL differs from expected string |

Every scenario used a fresh anonymous browser context, a valid synthetic deck in the supported local-workspace storage shape, a typed but **unsubmitted** prompt, and the ordinary visible “Apply Classic. reads as formal, quarterly-review friendly” suggestion. No model/account action, non-GET request, page error, or failed network request was observed. The script's exit0 means collection completed; it does not mean the product passed.

## Exact identity and command

Read-only candidate: `/private/tmp/opf-author-source-fix-20260921/pptx-dev`, commit `b33dc18e8c35803386feb80e7822f240a9671243`, build `k9YqAs5Gmj1tmWE4Y70tG`, URL `http://127.0.0.1:4328/author`. Runtime Node24.21.0; Chromium153.0.8010.12; viewport1600×1100. Full file identities are in `source-identity.json`; `source-after.json` confirms identical source hashes, HEAD and diagnostic script, and clean candidate status.

```sh
'/Users/michael/Library/Application Support/fnm/node-versions/v24.21.0/installation/bin/node' /private/tmp/opf-author-local-writers-20260921/negative-control.cjs > /private/tmp/opf-author-local-writers-20260921/browser.log 2>&1
```

Exactly one attempt per scenario, no retries or timeout increases. The root agent subsequently created the separate implementation checkout `/private/tmp/opf-author-local-writers-20260921/pptx-dev` from the same commit; this diagnostic did not create or edit that checkout. Its install.log is outside the diagnostic manifest.

## Retained proof

`results.json` and each scenario's `result.json` retain all outcomes. Each folder contains the original authored CRLF JSON, after-preset source, screenshot(s), accessibility snapshot, and full Playwright trace. New run and file-import additionally retain raw before/after Undo source and screenshots. A pass-through clipboard observer awaited the actual clipboard API and compared the submitted source with real clipboard content; source was not injected into the application.

| State | SHA256 of raw source |
| --- | --- |
| New run before undo | `3ef3b89f7fd02572f17d2446ddd7f6f69cc3b9d0712f05acc3b360ef633a9204` |
| Imported replacement before undo | `4606b935ec0a4a5cf1c1e446651c53f3aedc81fb7c22aa1dc04dcd5d235759f7` |
| Both destructive undo results | `7afbb24745570edf438539ed398dddde13466ace30fbe90e2e7013b85157a14e` |

Visual review of `new-run/{before,after}-undo-all.png` confirms five slides becoming one and the original deck returning. Review of `file-import/{before,after}-undo-all.png` confirms the replacement title/body and dark theme becoming the original title/rich text and minimal theme. The Undo all affordance was visibly reachable before both normal clicks.

The ordinary-edit exact assertion expected495 LF bytes but observed520 CRLF bytes. The semantic title changed successfully. `later-human-edit/trace-extraction.json` identifies trace member `trace.trace`, call `call@136`, endTime6621.952, where real clipboard and submitted buffers are identical. Their only difference from the expected edited buffer is CRLF versus LF; both byte-exact buffers are retained. The initial preset serializer emitted LF while the Monaco model retained its initial CRLF convention. This precondition failure is not normalized away, is not labeled an isolated new product defect, and was not retried. It leaves the ordinary-edit Undo UI outcome untested.

## Source cause and reachability

All line references below refer to the frozen candidate.

- `components/author/author-shell.tsx:2389`: preset apply reads the rendered parsed document, applies a deterministic preset, calls `commitDraftDocument`, and retains the first full parsed-document snapshot. `commitDraftDocument:2343` pretty-serializes the entire document; the normal preset changed only theme semantically but changed raw formatting.
- `author-shell.tsx:2428`: Undo all blindly sends that original snapshot to the same serializer. It has no expected-source, format, session identity or revision check. Only this handler clears the preset snapshot and toast state.
- `author-shell.tsx:1779`: New run changes the current and accepted document and clears other thread state but leaves preset undo state.
- `components/author/workbench/opf-canvas-workbench.tsx:91`: actual file import uses public `EditorSession.applyPatch` with `source: file-import`; the shell does not invalidate preset state. Even a semantically identical replacement is a distinct user import intent and needs an invalidation boundary.
- `author-shell.tsx:3697` and `components/author/auto-apply-card.tsx:89`: stale toast state continues to render a normal active Undo all button.
- `applyLocalRawOpf:1513` also preserves stale preset state by source inspection, but raw-JSON prompt import is not anonymously reachable through this guest composer: `AgentActionDock:5239,5354` routes ordinary guest submit to sign-in unless the supported local metadata intent is selected. The diagnostic did not force this handler or claim a UI reproduction for it.

The public editor session, semantic equality helper, source bridge and synchronous current-source wrappers already provide the relevant integration boundary. `PLAN.md` compares an atomic guarded transaction with repeated undo and specifies required tests and scoped follow-on writers. No private undo-stack access is proposed.

## Limits

This is local Chromium evidence for the frozen candidate, not canonical deployment acceptance. No native Office/font compatibility, remote account behavior, raw imported-file byte preservation or metadata/filename/gallery writer fix is claimed. Source-inferred ordinary edit risk still requires its own successful end-to-end regression. No further browser probe was run after the root agent stopped collection.
