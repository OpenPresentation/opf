# Source-preservation checkpoint — September 21, 2026

**App53 is live at accepted `e40c287b64fcbcfb85fb4a8a50641aea8e3e54a8`, with the identical reviewed tree. Fresh canonical production acceptance passes 29/29, zero retries. Postmerge application CI remains failed: Linux 28/29, Windows 29/29. Both pass 627 unit tests; separate artifact CI passes both.** Premerge CI passed both platforms. Core100 remains accepted with green pre/post-merge CI. Issue88 and the overall goal stay open for the failed gate, destructive preset history, remaining source writers and compatibility work. This checkpoint publishes no package or deployment and changes no example, schema, catalog or visual baseline.

## Accepted core checkpoint

[Core100](https://github.com/OpenPresentation/opf/pull/100) merged as
`c3e35b92e53d12764f9b1b7487ccfb7325d5c1aa`. Reviewed head
`4d8dffa0326545b34de63143a4b1666bb68fa96e` and merge share tree
`ee8c08988383ab19669555fe2d9962beeb56a691`; the primary checkout is clean.
Post-merge [OPF CI35624778901](https://github.com/OpenPresentation/opf/actions/runs/35624778901)
and [coordinated packages35624778863](https://github.com/OpenPresentation/opf/actions/runs/35624778863)
passed. The [release receipt](core100/release-receipt.json), exact job receipts
and [copy provenance](copy-provenance.json) retain those facts. The
[later exact issue88 body](issue88-updated-before-keyboard-commit.json) says
OPEN and records App47 production plus the earlier held App53 failures. That
body predates the keyboard commit and is retained as a historical checkpoint.
The [premerge issue receipt](issue88-keyboard-updated.json) matches the
[submitted body](issue88-keyboard-update.md) byte-for-byte and still says OPEN,
recording the b33dc18 draft and its local 29/29 result before the merge. The
[initial commit receipt](app53/keyboard-commit-receipt.json) binds its clean source/tree
and evidence-manifest hash. The [augmented receipt](app53/keyboard-commit-verified.json)
also confirms 207 committed evidence files match Git blobs exactly. Both snapshots
are retained.

## Accepted App53 source and bounded canonical acceptance

[App53](https://github.com/Data-Advantage/pptx-dev/pull/53) merged as
`e40c287b64fcbcfb85fb4a8a50641aea8e3e54a8`. The [merged PR receipt](app53/keyboard-merged-pr.json)
and [tree comparison](app53/merge-tree-receipt.json) bind the accepted source to
reviewed head `b33dc18e8c35803386feb80e7822f240a9671243`, both tree
`64a0dbd702f43c87206c8a9fe16d06fe3ac68800`, and the clean synchronized primary.
The [reviewed source record](app53/keyboard-current-head.json),
[final file hashes](app53/keyboard-final-source.json) and earlier
[draft PR receipt](app53/keyboard-pr.json) remain intact.
The retained [preview receipt](app53/keyboard-preview.json) is READY at deployment
`dpl_2ej95E2WDNmbGskPyBeabQ2u5gGa`, target null, for b33dc18. No preview-browser
acceptance is claimed for that preview. The [canonical before/after receipts](canonical/REPORT.md) bind READY production `dpl_hAEEDrxu746MBtDCHUh7z4bYaaLk` to accepted e40c287.
Its [committed application evidence](https://github.com/Data-Advantage/pptx-dev/tree/b33dc18e8c35803386feb80e7822f240a9671243/docs/evidence/completion-keyboard-20260921)
contains the diagnostics, source reviews, complete browser results, exact saved
downloads and reviewed screenshots; bulk artifacts are linked rather than copied.
The earlier source-preservation evidence remains committed in the same tree.

Author reuses the source bridge for canvas edits/history and guarded post-commit
source reads. Same-format preview Copy/JSON export and Inspector JSON download
retain the current raw buffer. The session hook ignores object-key order when
comparing JSON values while preserving array position, scalar values and property
presence, preventing a redundant import-history entry. Explicit format conversion
and original imported-file spelling remain separate boundaries.

The keyboard diagnosis reproduced actual Ctrl+Space delivery to a focused editor
with a supported Suggest action while Quick Input context remained active. No
OPF provider call followed. Installed Monaco assigns the eligible Quick Input
binding higher priority and clears its context asynchronously after blur. The
chosen internal command is inferred from these observed conditions and source,
not a private command probe. The merged change invokes the public Suggest action for
exact Ctrl+Space only when the originating editor has text focus and the action
is supported. It synchronously consumes that event before the competing binding.
Actual Quick Input focus, visible suggestion details, other modifiers,
composition and unsupported actions retain their normal routes. No timeout,
synthetic retry or private context mutation was added.

The [fresh full local macOS suite](https://github.com/Data-Advantage/pptx-dev/blob/b33dc18e8c35803386feb80e7822f240a9671243/docs/evidence/completion-keyboard-20260921/full-browser/README.md)
passes **29/29 in 88.78 seconds**, zero retries. All original categorical,
security, source/download and reimport tests pass, alongside two new keyboard
boundary cases. The [build receipt](app53/keyboard-build-receipt.json) records
Node24 build/typecheck and **627 unit tests**. The Windows-only timing helper was
inactive in that macOS run. Its final file-retention change followed the run;
product files and active macOS assertions did not change. Final type/lint and
Node file/error controls pass. Fresh application CI
[35631886222](https://github.com/Data-Advantage/pptx-dev/actions/runs/35631886222)
passed Linux and Windows on attempt 1, each with 627 unit tests and 29 browser
cases on Node24.20.0. Separate
[artifact compatibility35631886213](https://github.com/Data-Advantage/pptx-dev/actions/runs/35631886213)
passed both platforms on attempt 1. The [final audit](app53/premerge-ci/release-audit.json),
[case receipts](app53/premerge-ci/browser-results.json) and
[final jobs](app53/premerge-ci/application-jobs-final.json) keep those gates separate.
The earlier [pending-check receipt](app53/keyboard-check-contexts.json) is retained.
Postmerge [application CI35633321018](https://github.com/Data-Advantage/pptx-dev/actions/runs/35633321018) **failed Linux 28/29**; Windows passed 29/29. Both passed 627 unit tests. Separate artifact CI passed both platforms. The [postmerge receipt](app53/postmerge-ci/README.md) retains the first-attempt failed gate: after the shared-load toast, the security test found five default-deck canvases and stopped before security assertions. No rerun replaced this result.

The fresh [canonical run](canonical/REPORT.md) passed **29/29 in 113.50 seconds**, zero retries, at the same exact READY deployment before and after execution. All 18 test/configuration/lock inputs were captured before execution and match accepted Git blobs. The bounded source/download cases retain 30 actual JSON downloads (28 literal-byte oracles, one semantic import check and one captured-byte redo check) plus one actual PPTX. Five screenshots were reviewed; the existing details clipping remains visible. Node24.21.0 and Playwright1.63.0 were recorded, but this run has no new actual browser-version observation. The [production issue88 receipt](issue88-app53-production-updated.json) matches its [submitted body](issue88-app53-production-update.md). The [later current receipt](issue88-app53-diagnosis-updated.json) matches the [diagnosis update](issue88-app53-diagnosis-update.md), adds the wrong-hash finding below and remains OPEN.

The [phase4 summary](app53/keyboard-phase4-summary.json) records ten healthy
instrumented scenarios, 30 physical keys and 30 provider calls. **Zero stale
context overlaps were captured, so post-fix causal stress is inconclusive.**
Reviewed screenshots show normal Go to Line focus and suggestion details opening;
the existing details panel is clipped at the editor's right edge. Visibility does
not establish legibility. This CSS limitation remains open and is not repaired
by the keyboard guard. Complete visual acceptance is not claimed; bounded production acceptance is recorded separately above.

## Retained failures and Windows diagnostic

The [initial local run](local/initial-full-failure.json) was **24/27**: all new
source cases passed, but three unchanged PPTX reimport one-Undo cases regressed.
Serialized object-key order caused an extra root patch. The semantic equality
fix restores one-step history in the [public-session result](reimport-history/result.json)
and [array/value/property controls](reimport-history/controls.json). The earlier
rebuilt [26/27 local run](local/final-26-of-27.json) still failed the LF popup;
that original result remains unchanged despite the later 29/29 pass.

At earlier draft head `8c0dae19`, [CI35627445953](https://github.com/Data-Advantage/pptx-dev/actions/runs/35627445953)
[passed Linux and failed Windows 26/27](app53/ci-completed-failure.json). The
[failed step](app53/windows-failed-step.log) stopped at the five-second shared-load
toast check, before security assertions. The [trace/source review](windows-readiness/REPORT.md)
found the imported document and success toast after the failed assertion; no
concrete hash-import race or responsible CPU/dependency cause was established.
The exact old-head [READY draft preview](app53/preview.json) is historical; it
is not deployment evidence for the new head or a production release. The older
[draft receipts](app53/draft-pr-preview-ready.json) and
[117 verified source-preservation artifacts](app53/committed-evidence.json) remain intact.

Passive Windows-only hooks now capture bounded public resource/longtask/navigation/
paint timings around the unchanged security test. The sanitized fixed JSON file
uses only origin/path URLs and is configured for both-outcome, seven-day artifact
retention. The fresh successful Windows job uploaded [artifact10654847066](app53/premerge-ci/artifacts-final.json).
Its [timing summary](app53/premerge-ci/windows-timing-summary.json) confirms only
Author after-test timings were retained: the Inspector pagehide snapshot is missing.
This proves successful-path retention, not complete cross-navigation capture or a
readiness correction. Observer/hook overhead, missing records and possible
hook-timeout impact remain explicit. The later canonical pass does not replace the failed postmerge Linux gate or resolve incomplete timing capture.


A subsequent [retained-trace/source diagnosis](inspector-share-diagnosis/REPORT.md) separates two findings. The strict visibility assertion ran before the expected fixture canvas count/title was established. More seriously, decoded trace URLs prove that automatic hash sync published the five-slide starter while the source held the imported one-slide document. The wrong URL was observed for at least 511.236 ms; indefinite persistence was not measured. Refreshing that recorded address would decode the starter, but no refresh reproduction was run. The likely deferred-encode scheduling path is inferred from source, not a measured React scheduler trace. A source-bound publication guard and fixture-identity readiness checks are being prepared separately; no fix is accepted or released. Compact decoded payloads, extraction code and original hashes are retained; original reviewed JPEG frames remain at the report's private evidence path.

## Remaining preservation and compatibility work

The [remaining-writers source audit](remaining-writers/REPORT.md),
[source hashes](remaining-writers/source-identity.json) and
[original manifest](remaining-writers/SHA256SUMS.json) remain unchanged at the
earlier App53 head; its Author source is unchanged by the keyboard guard.
Separate [local negative controls](preset-negative-controls/REPORT.md),
[results](preset-negative-controls/results.json) and
[before](preset-negative-controls/source-identity.json)/[after source identities](preset-negative-controls/source-after.json)
confirm two destructive stale Undo all cases at b33dc18: New run and a file-import
replacement both revert to the previous presentation. Each was attempted once.
The ordinary-edit scenario stopped at the exact LF/CRLF raw-buffer precondition
and did not click Undo all; its destructive outcome is not claimed. The
[original control](preset-negative-controls/negative-control.cjs) and
[original artifact manifest](preset-negative-controls/SHA256SUMS) retain the
local proof identity; full screenshots/traces remain in the report's local evidence
directory. This is unresolved local evidence, not production verification or a
fix. Preset Undo all is the next preservation priority. Local
author/filename/gallery/preset writers still serialize the full document, and
the schema writer is dormant. These boundaries remain outside App53's correction. No broad imported-file,
account/agent/metadata or cross-format byte guarantee is claimed.

App45 **14/18**, app46 **11/19** and app47 **23/24** canonical runs remain failed
historical evidence in the [earlier ledger](../issue88-final-20260921/README.md)
and [completion checkpoint](../completion-acceptance-20260921/README.md).
The later local context diagnosis does not retrospectively establish the cause
of every original readiness failure. Native issue87 still needs the owner's
recovery reply before any Windows COM retry. Physical-font/native Office gates
are separate from portable CI. The five geometry drafts remain coordinated and
unmerged; native `p:hf` remains roadmap-only, renderer issue24 remains **0.1px**,
and deferred ColorRef work remains deferred. Required repair, preservation,
compatibility and release work keep the overall goal open.
