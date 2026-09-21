# Completion and readiness checkpoint — September 21, 2026

**App47 is merged and its exact production deployment is READY, with reviewed
local acceptance and green Linux/Windows pre/post-merge CI. Fresh canonical acceptance
is 23/24. Issue88 and the overall goal remain
open.** This checkpoint supplements the [earlier ledger](../issue88-final-20260921/README.md)
without replacing its failed production results.

## App47 source and local acceptance

[App47](https://github.com/Data-Advantage/pptx-dev/pull/47) reviewed head is
`a5201c88a219262b21a6c7fd4ef49a01a5bbe0a3`, tree
`203bdab509d05911f04f234d996f9c91f2b5e4f2`. Twenty-seven committed evidence
blobs and eight source/lock files were verified. This is independent local
review: the neutral Bugbot result reported a usage/spend limit and did not review
the change. No completed GitHub review is claimed.

The [app's committed evidence bundle](https://github.com/Data-Advantage/pptx-dev/tree/a5201c88a219262b21a6c7fd4ef49a01a5bbe0a3/docs/evidence/completion-ranges-20260921)
contains the full unit/build/browser reports, negative controls, source identity,
installed-Monaco harness, original/expected/actual source and reviewed screenshots.
It is linked rather than duplicated here. The [compact browser receipt](browser-review/README.md)
and [artifact hashes](browser-review/control-evidence.json) retain this reviewer's
exact commands, runtime, tested-file identity and original artifact locations.

Final local acceptance on Node24.21.0/pnpm11.1.3 passes **627 unit tests and 24
Chromium browser workflows**, zero retries, 59.0 seconds. Typecheck, build, scoped
lint and diff checks pass. Unmodified installed Monaco0.56 constructor/filter
checks pass **1,829 actionable alternatives across 59 cursor positions**. This
replaces the rejected 1,888-case empty-no-op design, whose actual browser
selection consumed an undo entry even though source bytes stayed unchanged.

The final OPF provider offers changed alternatives only; ordinary Monaco JSON
schema suggestions are distinct. Single-line scalar ranges plus disjoint
structural edits preserve unchanged source tokens and one undo/redo transaction.
Browser tests cover compact LF/CRLF, rich text, notes, metadata, escaped current
values and prior history, source/inline-catalog invalidation, malformed recovery,
format switch and New run. Loaded-catalog model isolation has provider-level
tests; the new browser cases do not claim an asynchronous loaded-catalog prop
race. The old build still fails at the missing Title Subtitle categorical choice.
Three final popup screenshots were reviewed; no new clipping/overlap was seen.

[CI run 35620611535](https://github.com/Data-Advantage/pptx-dev/actions/runs/35620611535)
passed on Linux and Windows; [pre-merge receipts](app47-premerge-ci.json) retain
the actual job results. App47 [merged](app47-accepted-pr.json) at 15:51:01 UTC as
`0f35352a1445f56ad4bb7c9f4c5609e01f2dd9ae`, with exactly the reviewed tree.
[Tree equality](app47-tree-equality.json) confirms the accepted and reviewed
trees match. [Post-merge CI 35621722214](https://github.com/Data-Advantage/pptx-dev/actions/runs/35621722214)
also passed on Linux and Windows; [its receipt](app47-postmerge-ci.json) pins
the accepted commit. [Production deployment](app47-deployment.json)
`dpl_5zdunyqiun7MgJNRJZ33CMHTrmmN` for that accepted commit is READY with canonical
aliases. One fresh [canonical run](canonical/REPORT.md) passes **23/24**, including
all five new completion cases. The existing LF Author categorical third-popup assertion
fails at the unchanged five-second deadline; its CRLF counterpart passes.
The [post-run deployment](app47-deployment-post-run.json) and
[binding check](canonical-deployment-binding.json) retain the same accepted SHA
and READY deployment. Full canonical acceptance is still failed. Prior worker,
page-delivery and font-readiness failures remain historical evidence with
unresolved causes even where those workflows pass this run.
The failed LF case had already passed Dark and document-local AAA choice
apply/undo/redo. Its third request targeted `document-layout` toward the loaded
AAB choice; Go to Line 11:18 and the app cursor assertion passed. Control+Space
occurred at 5928.861ms; the popup was absent from 5933.224 through 10934.577ms.
All 115 recorded network requests finished by 4225.487ms, with no HTTP status
400 or greater, failed requests or recorded page error. Monaco appeared focused
in the saved action snapshot, but keybinding delivery and provider invocation
were not recorded. This particular failure has no pending-network explanation;
no network or focus cause is established. It must stay distinct from app46's
demonstrated delivery delays. The worker preparation candidate does not claim to fix it.
The primary app checkout is clean and fast-forwarded to the accepted commit.
The [preview receipt](app47-preview.json)
identifies a READY preview
for the exact reviewed head. It is protected and has **not** been browser
accepted. A READY preview is not a production deployment or canonical acceptance
receipt. The prior deployed app46 source is `c558dcc`; its 11/19
canonical run and the earlier app45 14/18 run remain failed evidence. App47's
local or new-completion result does not explain the intermittent third-popup failure.

The [compact canonical results](canonical/acceptance-summary.compact.json),
[trace facts](canonical/review/lf-trace-facts.json),
[network timings](canonical/review/lf-network.json) and
[screenshot review](canonical/screenshot-review.json) retain the exact run and
bounded visual review. All 46 non-JPEG files in the selected bundle are copied
unchanged. Two original JPEG failure/action frames remain at their exact local
paths and hashes in [copy provenance](copy-provenance.json), because this core
repository's text-integrity checker has no JPEG exception. They were not
converted or reencoded. The immutable canonical report describes those original
frames; the [original selected-file manifest](canonical/SHA256SUMS.json) preserves
their hashes. Raw traces, response chunks, cookies and inline PPTX bodies are
excluded from the retained selection.

## Production readiness investigation and future worker candidate

The [readiness report](readiness/REPORT.md) records one authorized diagnostic,
four public asset probes, actual worker RPC/asset timings and original failure
trace extracts. In that visit worker initialization completed and computation
was fast; it did not reproduce the earlier delays or rerun acceptance. The
original evidence separates serial worker bootstrap delivery, initial Inspector
page transfer, and preview/font loading. None is silently reclassified as a
passed preservation/export assertion.

Retained files include the pass-through diagnostic script/log/JSON, dependency
graph, source identity, asset timings, response headers and final screenshot.
The [original hash manifest](readiness/SHA256SUMS.original) still identifies the
larger raw trace and downloaded JavaScript bodies; those remain at their private
artifact paths and are deliberately not copied into this repository. The
[copy provenance](copy-provenance.json) identifies retained bytes and omissions.

The [static worker audit](worker-candidate/WORKER-AUDIT.md),
[inventory](worker-candidate/worker-inventory.json) and
[reproduction script](worker-candidate/worker-audit.mjs) are **candidate-only,
unimplemented** work. Copying the installed bundled worker entry assets could
remove the serial startup graph; no such product preparation or routing change
was made. The conditional external-diff import, notices, cache/deployment
packaging, real diagnostics/format/undo, model changes and offline-after-load
behavior require explicit acceptance if this plan proceeds. It is not a proven
fix for page transfer, font readiness, the prior popup or all eight failures.
No timeout, font loading, native compatibility or renderer tolerance was changed.

## Remaining source preservation boundary — source-only audit

The [separate audit](source-preservation-audit/REPORT.md),
[source identities](source-preservation-audit/source-hashes.json) and
[serializer results](source-preservation-audit/results.json) are pinned to the
clean app47 reviewed head. The script imports the actual codec/source bridge and
published editor0.8 API, then exercises the short host serialization expressions.
It mounts no React UI and performs no browser, deployment or release acceptance.
Original LF/CRLF input/output fixtures and the exact script/log/hashes are retained.

Confirmed gaps are Author canvas commits/undo/redo and preview Copy/JSON export,
plus Inspector's JSON download. An unchanged Author preview read and Inspector
download serialize the 325-byte LF and 332-byte CRLF sources to the same 473-byte
output; semantic values survive, but authored whitespace, escapes and source
offsets change. Author's code-tab same-format JSON export already preserves raw
source. An unchanged preview read can change exported bytes without itself
rewriting the stored code buffer. These distinctions prevent a blanket claim
that every Author action is broken or that semantic undo proves raw-source undo.

The existing Inspector source bridge preserves exact edit/undo/redo for both
fixtures. Reusing it in Author, making draft reads synchronous and authoritative,
and preserving raw Inspector JSON download bytes are bounded future work. A
bridge alone does not recover an imported JSON file's original bytes after the
current parser discards them, nor certify every account/agent/preset writer.
The proposed implementation and exact-file browser regressions remain unimplemented.

## Administrative and core gates

App46's negated closing-keyword prose accidentally closed issue88 at
**2026-09-21 14:50:21 UTC**. The [original timeline receipt](issue88/issue88-auto-close-before.json)
identifies that PR as the closer. Issue88 was [reopened](issue88/issue88-reopened.json)
at **15:18:18 UTC** and the [PR body corrected](issue88/app46-corrected-body.md).
This was an administrative correction, not a change in acceptance scope.

Core99 is accepted as `ef0444bff688b3d9c9d7b040603a5f0a98741a2f`, with pre- and
post-merge CI green. Post-merge runs are
[35617647321](https://github.com/OpenPresentation/opf/actions/runs/35617647321) and
[35617647362](https://github.com/OpenPresentation/opf/actions/runs/35617647362).
The npm train remains core0.11.0, CLI/render0.9.0, PPTX0.9.1, editor0.8.0;
this docs checkpoint publishes nothing and changes no visual baseline.

Native issue87 still lacks the owner's host-recovery reply. No Windows COM
retry or process killing occurred. Physical font identity/embedding, native
open/edit/save/reopen and real `p:hf` acceptance remain separate. Renderer24's
**0.1px** tolerance is unchanged. The five geometry drafts remain untouched and
coordinated; native HF stays roadmap. Broader repair/editor/font/IME/bidi and
Author canvas/JSON-download byte preservation remain open. Do not mark the
overall goal complete.

`manifest.json` and `SHA256SUMS` cover this retained bundle; `.gitattributes`
disables text normalization here so original logs and any authored CRLF bytes
remain exact. Earlier copied reports retain their capture-time language and
private paths; current acceptance status is stated above.

Captured logs, HTTP headers and CRLF fixtures intentionally retain their original
trailing whitespace and line endings. Git's whitespace check is scoped to edited
prose; immutable captures are verified by their exact file and staged-blob hashes.
