# Font-readiness checkpoint — 21 September 2026

Accepted core/native sources and merged App54 are separate acceptance gates. This compact
checkpoint changes no package pins, runtime, fonts, visual baseline or native evidence.
The initial accepted core baseline was `5bc0d3f89414b382b2ce48452c7e56e5d66aaf74`;
accepted native108/109 main `b2711549eba48a52f036afd02ee52b761fa0a5f9` is now
retained by an additive merge, followed by accepted core110
`4f7a4bd494f1a873319eff897423d301d1cfc9d6`, then accepted core111
`3c5048522714365a41d9b5b9ba81620affae718b`. All local draft checkpoints remain preserved.

## Core107 acceptance

The [postmerge audit](core107/postmerge/release-audit.json) binds reviewed head
`92c1009761a83b95601b93eb8455e9351980b8a7` and accepted main to the same tree
`ffdc678beadf0808bc717d67e7fc0a9ec4790127`, with all 87 reviewed delta blobs equal.
Both original automatic push workflows passed on attempt 1 under Node24.20.0:
[OPF35652360502](https://github.com/OpenPresentation/opf/actions/runs/35652360502)
and [coordinated35652360551](https://github.com/OpenPresentation/opf/actions/runs/35652360551).
There was one postmerge pair, without a canceled duplicate or requested rerun.
Installed-package/browser checks do not certify native Office or canonical app behavior.

The [premerge audit](core107/premerge/release-audit.json) preserves the earlier
automatic canceled pair **35650767479/35650767380** separately from later automatic
successes **35650769661/35650769719**. Each run was attempt 1. GitHub's explicit
annotations establish higher-priority concurrency supersession, without a named
cancellation actor. The later successes do not relabel the canceled predecessors.
The original audit manifests identify complete source inventories; this compact
copy omits their ZIPs and redundant full logs. Exact artifact hashes, CRC results
and final job steps remain in the copied receipts. No new image or Office review
was performed during this documentation task.

## Native108/109 coordination

[Core108 receipt](native108109/core108-received.json) binds merged
`9b277e140863389ae06c681a529fac32df8c912c`; [core109 receipt](native108109/core109-received.json)
binds merged `b2711549eba48a52f036afd02ee52b761fa0a5f9`. Both captured PR heads
have successful OPF/coordinated checks. This is not a claim about unrecorded
postmerge runs. The [primary sync](native108109/primary-sync.json) records clean
main fast-forward. The [local preservation audit](native108109/local-merge-preservation.json)
binds the authorized checkpoint and additive merge, all native105/106/108/109
blobs and roadmap, and retention of native109's exact matrix addition.

The accepted [offline tab analysis](../windows-native-tab-analysis-20260921/REPORT.md)
replays nine retained pairs. Saved coordinates retain finer precision than observed
tabbed-character starts, which match a 0.05pt-compatible pattern for these inputs.
The data do not distinguish relative from absolute placement or reveal an internal
PowerPoint cause. No compensation is proposed; the unchanged 0.02pt gate still fails.

The [read-only table observation](../windows-native-mixed-table-20260921/README.md)
preserves 245 characters, one literal tab and five rich runs, outer geometry within
0.02pt, and confirmed owned close/font cleanup. Native soft-line boundaries 92/194
differ from estimated preview 78/172; default native tab spacing is72pt. This finite
content/style observation does not establish edit/save/reopen, browser/native raster
agreement, embedding or physical glyph identity.

The Windows supervisor retains sole Office ownership. The rich-tab core half
[core110 is merged](core110/merged.json) as
`4f7a4bd494f1a873319eff897423d301d1cfc9d6`, from reviewed head
`fc3c36e929492d22b5f5af944a6ca3a12a9784d9`. All four required PR-head checks passed:
OPF, coordinated packages, and CLI macOS/Windows. The three-file accepted source
splits authored U+0009 controls from strict measurement while preserving UTF-16
run offsets/styles and the existing four-space advance convention. This is merged
core source, not a newly published package or renderer/native acceptance.
[Local merge preservation](core110/local-merge-preservation.json) binds exact bytes.

The original coordination permitted only the CI core checkout advance from released
`b8a1faf` to accepted `4f7a4bd`, while requiring separate renderer source/visual,
paired/mixed-version, packed/browser and CI evidence. Renderer30 has since merged;
its accepted source and bounded checks are recorded in the week-wrap section below.
Package versions, lockfiles, production release/site pins, schema, goldens and
native/browser tolerances remain unchanged. Coordination was [delivered on PR110](https://github.com/OpenPresentation/opf/pull/110#issuecomment-5767980133),
with its [exact body](core110/delivered-coordination.md.txt). Direct task routing
remains unavailable; the earlier delivery-failure note is preserved as historical.
This documentation task does not touch the renderer branch or Windows Office.

The supervisor separately [reports](core110/reported-fonts-status.json) a read-only
Presentation.Fonts control listing Carlito+Aptos despite no Aptos XML: allowlist
**FAIL**, no embedding, owned close and four removals confirmed. The original
PowerShell5 JSON-nesting cleanup-classification error was retained and corrected
offline. That historical notice preceded accepted core111. The [merged receipt](week-wrap/core111-merged.json)
and [accepted Windows wrap-up](../../handoff-windows-native-2026-09-21-wrap-up.md) now
bind its published evidence, still not a native compatibility or physical-glyph pass.

Root's independent offline replay passes the [mixed-table verifier](native108109/mixed-table-verify.log)
on Python3.9.6. The [first tab-verifier invocation](native108109/initial-python39-verifier-failure.json)
fails on that interpreter because `Path.write_text` lacks its `newline` argument;
accepted source and measurements are unchanged. Explicit [Python3.12.14 replay](native108109/bundled-python-verifier.json)
passes all nine pairs/eight checks byte-identically, with no Office/font calls.
This Python portability limit is separate from the unchanged native tab failure.

## App54 font-preparation revision

[App54](https://github.com/Data-Advantage/pptx-dev/pull/54) head
`a4eb88ab7aa585c9efb91de4c190c1f1c0c7d0eb`, tree
`031d893855a540fd2a4d2ec2162605817b8dde16`, is the preserved failed predecessor
to reviewed 79ba and accepted 8f below.
[The commit receipt](app54/commit-receipt.json) and
[committed-source audit](app54/committed-source-audit.json) bind this checkpoint.
The full [immutable app evidence](https://github.com/Data-Advantage/pptx-dev/tree/a4eb88ab7aa585c9efb91de4c190c1f1c0c7d0eb/docs/evidence/font-preparation-concurrency-20260921)
retains original failure logs/trace, rejected harness assumptions, source reviews,
local outputs and selected original passing traces. Its manifest and compact
receipts here are exact Git blobs; the full manifest does not imply every entry
is duplicated in this core bundle.

Full font acquisition now overlaps converter warmup. Canvas/shared lease readiness
still requires **both**, preserving the converter-ready barrier used by cold/offline
PPTX export. Failure handling disposes an independently successful font preparation
without replacing the original error. The full **33 faces / 9,317,044 bytes**, manifest,
visual substitution policy, `document.fonts.ready`, measurement and shared ownership
gates are unchanged. No smaller font set, fallback or timeout increase was introduced.

Fresh local macOS checks passed **704 unit tests, 13 standalone controls and 39/39
browser workflows**, zero retries, in **111.898960 seconds**, on Node24.21.0.
Build `eDrCpu0YEZtjYRCFXNVvI` contains 974 runtime files and 29 normalized links.
The [outcomes](app54/local/browser-outcomes.json),
[tested-source binding](app54/local/tested-source-binding.json) and
[visual review](app54/local/visual-review.json) retain the scoped pass, including
unchanged offline Author/Inspector export/reimport. All 702 regular source inputs
and 33 symlink targets match after the run. This is local acceptance, not fresh
Windows, preview-browser, production or native-font acceptance.

## Preserved failed Windows gate

Original head `4338e57b951c469d5c5f239b78a303fbad3c745e` application run
[35649707689](https://github.com/Data-Advantage/pptx-dev/actions/runs/35649707689)
passed Linux **39/39** and failed Windows **38/39** on its first attempt; both
passed 692 unit tests and 13 standalone controls. The sole Windows failure was
initial retained-slide canvas-title visibility at the unchanged five-second
assertion, before any edit or recovery operation. Correct incoming source was
visible with **Loading slide fonts…**. Manifest acquisition began about 3.175s
into that assertion; all 33 font requests began about 3.250s into it. Twenty-two
TTFs recorded HTTP200 and eleven had no completed response by teardown. No HTTP
error was recorded. Missing responses do not establish permanent failure or the
dominant cause. The new concurrency change is not proof that converter loading
alone caused this failed run.

The exact [CI report](app54/original4338/ci-REPORT.md.txt),
[trace diagnosis](app54/original4338/diagnosis-REPORT.md.txt) and
[history/side-effect review](app54/original4338/history-REPORT.md.txt) are archived
unchanged. The early diagnosis's proposed preload removal was superseded by the
history review: converter preparation is retained as an offline readiness barrier.
Do not implement that archived suggestion as a current instruction. Earlier 60c
readiness, 57e evidence-packaging, 6df startup and App53 failures remain in the
[previous checkpoint](../inspector-current-actions-20260921/README.md).

## Held release checks

Fresh application run **35654753237** finishes with Linux **39/39** and Windows
**38/39**; both platforms pass 704 units, 13 standalone controls, typecheck and build.
Windows fails the existing five-second `toHaveURL(/\/author#opf=/)` assertion at
`inspector-actions.spec.ts:176` in the Open in Author case beginning at line168.
The reported received URL is empty; later source assertions are not reached.
The original 4338 initial font-readiness case passes in this run. This is a new
failed gate, not a data-loss finding or an established navigation cause. The frozen
[final audit](app54/final-a4eb-ci/release-audit.json) binds Linux job106515454509 and
Windows job106515455003 on Node24.20.0, attempt 1; that gate failed. All39
per-platform outcomes, final job steps and exact source bindings are preserved.
The [final source verification](app54/final-a4eb-ci/source-final-verification.json)
checks262 changed Git blobs,259 evidence manifest entries,702 regular tested inputs
and 33 symlink targets. Bugbot's neutral usage-limit result performed no review.
The separate [Python artifact workflow](app54/artifact-workflow-scope.json) was not
triggered because no full-PR changed path matches its filters: not applicable,
not a fresh pass.
[Final preview metadata](app54/final-a4eb-ci/preview-final.json) confirms READY
`dpl_7h6bihzceM8cLbvgK6mehffaqhw5` at exact a4eb88a with target null. The
[unauthenticated HTTP check](app54/preview-http-boundary.json) redirects to Vercel
sign-in; no login, bypass or preview browser acceptance occurred. Production at that a4eb capture
remained App53 `e40c287`, with canonical **29/29** and a separate failed Linux
postmerge gate. Current App54 release outcomes are recorded separately below.

Native105/106 evidence is unchanged: finite B/C and bounded four-face Carlito
controls do not complete tab tolerance, physical glyph identity, fallback/synthesis,
mixed-size table fidelity or embedding. The Windows supervisor retains sole Office
control. The preset correction remains approval-held and unapplied; the separate
suggestion-details UI candidate supplies no acceptance here. Geometry remains a
deferred coordinated set; render issue24 stays at 0.1px. Repair, source-preservation,
SVG/PDF/Mermaid follow-ups and issue88 remain open with their existing scope.

## Current failed-run artifacts

The exact [failure excerpt](app54/final-a4eb-ci/windows-exact-failure.log),
[error context](app54/final-a4eb-ci/failure/error-context.md.txt),
[test source](app54/final-a4eb-ci/failure/inspector-actions.spec.ts.txt) and
[captured pending-action image](app54/final-a4eb-ci/failure/inspector-pending-action.png)
are retained without edits. The image is a recorded test stage, not independent
visual acceptance of the failed handoff.

The original failed trace is6,944,325 bytes, SHA256
`c7589c634e5177b393d3697a4d9c9bb48b4809d958644973267a453c1812883a`.
It is retained [durably and privately](app54/final-a4eb-ci/failure/private-retention.json),
with95 ZIP members, passing CRC and permissions0700/0600. The raw archive and its
reversible base64 representation are excluded from publication. [Historical storage
verification](app54/final-a4eb-ci/failure/trace-storage.json) is unchanged metadata;
its former encoded path is not a current public artifact. The [publication boundary](app54/final-a4eb-ci/failure/publication-boundary.json)
records this mapping correction without changing the original failure or archive.
Base64 is not sanitization. Local private checkpoint history is not publishable;
the final sanitized tree must be published from accepted core111 with no private
checkpoint ancestors.

[Original artifact integrity](app54/final-a4eb-ci/artifact-integrity.json) retains
GitHub digests, sizes, CRCs and every member hash for the11,054,020-byte failure
artifact and6,832-byte readiness artifact. The outer ZIPs and unrelated successful
outputs are omitted as [explicitly inventoried](app54/final-a4eb-ci/omissions.json).
The [timing summary](app54/final-a4eb-ci/windows-timing-summary.json) belongs to the
separate passing SVG-security case, with only Author retained and Inspector/pagehide
missing. It provides no timing record for the failed Author handoff. The separate
root diagnosis below remains distinct from prospective acceptance policy; no
product correction, accepted replacement head or release is chosen here.

## Author-navigation diagnosis and prospective policy

The exact [root diagnosis](app54/author-navigation-diagnosis/REPORT.md.txt),
[resource facts](app54/author-navigation-diagnosis/resource-table.json),
[response metadata](app54/author-navigation-diagnosis/document-and-delayed-chunk.json)
and [visual-review receipt](app54/author-navigation-diagnosis/root-visual-review.json)
are retained unchanged with their eight-entry original manifest. The final
[recorded frame](app54/author-navigation-diagnosis/final-viewport.jpeg) shows
**Loading Author…**. A separate later DOM snapshot contains the intended draft
and authored metadata/rich text, but does not accept the unreached equality,
clipboard, no-POST or page-error assertions.

The Author document returned HTTP200 in262.687ms. One script response returned
HTTP200 with HAR total8061.943ms, including8039.856ms waiting. Its ETag token
`5d2` implies 1490 bytes; the recorded compressed body size is766bytes. The actual
script body is not captured and its identity is not established from the local
macOS build. Some resource monotonic timestamps disagree with HAR wall ordering;
these records cannot form one proven wire timeline. Pending-navigation prechecks
also mean the assertion's empty received string does not prove an empty actual
page URL. These observations show delayed readiness without a server, runner or
network root cause or an acceptable-latency finding. The failed result stands.

The [reviewed policy](app54/navigation-policy-candidate/diff-review.json) registers
`page.waitForURL(..., { waitUntil: "load" })` before the unchanged real action,
matching ordinary `page.goto` navigation handling. It retains the45-second whole-test
budget, default 5-second content assertions and every original URL, decoded-source,
clipboard, no-POST and page-error oracle. It **deliberately removes the incidental
five-second navigation deadline**; it is not identical timing acceptance or a
product/routing fix. Original failed a4eb and all captured bytes remain unchanged.

## Current App54 navigation-policy head

App54 merged as `8f54228a9e38a1dcc0bf8188bcdd519795b3799a` from reviewed
head `79ba0157984fce8405eeb786b8ede1a4e59ba138`, parent a4eb, retaining identical
tree `3639d3c14daec94d13711fa2b10f2b927df45eca`. No npm train changed. The [commit receipt](app54/current79ba/commit-receipt.json)
and [immutable 202-file app bundle](https://github.com/Data-Advantage/pptx-dev/tree/79ba0157984fce8405eeb786b8ede1a4e59ba138/docs/evidence/author-navigation-policy-20260921)
retain the exact test-only change, local evidence and original failed trace. Its
[final manifest](app54/current79ba/published-evidence-manifest.json) and publication
receipt preserve the earlier201-file staging bundle and22 narrow captured-whitespace
attributes; no captured bytes were rewritten. Large traces are linked there, not
duplicated again in this core checkpoint.

Fresh [local acceptance](app54/current79ba/local/REPORT.md.txt) passes **39/39** once,
zero retries, in **112.780048 seconds** on macOS/Node24.21.0. The Open in Author
case passes all original oracles. Frozen install, changed-test lint, build
`tL8W1j83XSdKiuTACo8zx` and prepared-tree typecheck pass. Initial pre-build typecheck
failed because generated schema was absent; the existing build prepared its26
inputs, without a source repair. Full units/standalone controls were not repeated
locally for this test-only change; a4eb's passing 704/13 platform checks are historical,
and the fresh platform results below run them again. Root verifies 702 regular inputs and 33
symlink targets plus [reviewed handoff images](app54/current79ba/local/root-handoff-visual-review.json).
This semantic handoff acceptance does not guarantee incoming raw JSON spelling or
cross-route undo history.

[Premerge application 35659187971](app54/current79ba/premerge-ci/REPORT.md.txt)
passes on attempt 1: **704 units, 13 standalone controls and 39/39 browsers on each
of Linux and Windows**, with typecheck/build passing. The [source audit](app54/current79ba/premerge-ci/source-audit.json)
binds 203 delta blobs and 702 regular inputs/33 symlink targets. Full successful
job logs and the timing ZIP are omitted; the original audit/artifact inventories
retain their hashes and integrity results. Timing is from the separate passing
security test, with Author-only entries and missing Inspector; it does not measure
handoff timing. Artifact CI was not applicable under its path filters, not a fresh pass.
No current-head automated review is claimed. Exact 79ba preview was READY/protected
by 302 sign-in; the copied safe boundary excludes redirect query/header secrets.

The [accepted merge](app54/merged8f/pr54-merged.json) and [tree binding](app54/merged8f/merged-tree-binding.json)
confirm 8f equals the reviewed tree and all 203 delta blobs, with clean primary sync.
Exact production deployment `dpl_H1FtXx1QSuGxn3MwzJwWJpGtRg8b` is READY at 8f.
The [single canonical run](app54/canonical8f/safe-outcomes.json) **fails overall (34/39 passed)**,
zero retries in 148.112604 seconds, at five no-POST assertions observing Clerk
environment POSTs. The [safe audit](app54/canonical8f/write-audit/REPORT.md.txt)
records ten POSTs to Clerk `/v1/environment`: nine HTTP200 requests have recorded
zero-length bodies; one record is incomplete. No authored fixture needle matched
captured fields, URL-decoded fields or decodable JWT payloads. This does not prove
the contents of uncaptured/opaque data. No application API write appears among
those requests. The three action cases reached source/payload/clipboard oracles
but not their final page-error assertions; the two share/refresh cases passed
their page-error assertions and did not reach final screenshots.

The scoped source comparison preserves 28/29 auth/provider/layout/config/lock
files byte-identically from App53; only package build/start/test scripts differ.
It does not establish prior production requests, identical runtime configuration
or causality. The [coordinator disposition](app54/canonical8f/disposition.json) keeps the current
deployment: there is no observed
introduced authored-content upload/source regression in these bounded records.
Full canonical acceptance remains failed; no rollback, test change, policy
relaxation or rerun follows from this audit. Raw canonical logs, results and traces contain authentication
material and are private-only. [Safe command/source/deployment receipts](app54/canonical8f/command-receipt.json)
and before/after bindings are retained with the [private artifact inventory](app54/canonical8f/private-artifact-inventory.json).
The [private retention receipt](app54/canonical8f/private-retention.json) binds all 154
original files/334,264,389 bytes, permissions 0700 directories / 0600 files, and
manifest 88dc0210… outside Git. No raw result/log/trace/error context is copied.
All seven derived audit files are preserved exactly with an inert `.py.txt`
source snapshot and rename map; no captured query/header/token values are included.
[Postmerge 35660464578](https://github.com/Data-Advantage/pptx-dev/actions/runs/35660464578)
[final audit](app54/merged8f/postmerge-ci/REPORT.md.txt) is frozen: attempt 1 fails,
with Linux 39/39 passed and Windows 38/39 passed/one failed. Both platforms pass 704
units, 13 standalone controls, typecheck and build. The Windows case fails the
initial gallery-rail title assertion at `inspector.spec.ts:125` after unchanged 5,000ms.
The source name/schema/one slide are correct, but Loading slide fonts remains;
later preview/download/undo/redo/shared-reimport assertions are not reached. Revised
Open in Author passes, including 9.2s Windows whole-case time, not a navigation-latency
measurement. No cause or data-loss finding, investigation or rerun follows.

Compact exact outcome/source/step/excerpt receipts retain the [artifact integrity](app54/merged8f/postmerge-ci/artifact-integrity.json)
and full 134-entry original audit manifest. Raw ZIPs/traces/error contexts remain
private and were not screened for authentication content. Their [durable private retention](week-wrap/postmerge-private-retention.json)
verifies all 134 original files with permissions 0700/0600 before temporary-directory cleanup. The separately passing
security timing artifact retained Author 99 entries and no Inspector snapshot; it
is not timing evidence for this failed case. Merged/live does not mean complete
canonical or postmerge acceptance.
The [next-week queue](../../handoff-2026-09-21.md#next-week-queue) keeps App54 release,
the separate UI draft, approval-held presets and Windows-owned native work distinct.

## Week-wrap parking

The user has paused work for the week. These records preserve the queue without
starting implementation, investigation or acceptance retries before resumption.

The [seven-repository open-PR snapshot](week-wrap/open-prs.json) keeps dependency-bot
updates outside this wrap-up, including Node26 types and TypeScript major proposals.
No pins are changed. Five geometry/two native-HF drafts remain deferred and stale
changelog drafts remain closed. The [Windows wrap-up coordination](week-wrap/windows-coordination.md.txt)
was [delivered through PR110](https://github.com/OpenPresentation/opf/pull/110#issuecomment-5768032573);
direct task routing remains unavailable. No new native experiment is requested.

[Core111](week-wrap/core111-merged.json) and [renderer30](week-wrap/renderer30-merged.json)
are merged at exact `3c504852` and `c8d7d5c`, respectively, with their recorded
PR-head checks passing. Core111's native font evidence and accepted Windows
handoff are [preserved additively](week-wrap/native111-additive-preservation.json).
Its exact nine-line matrix addition remains untouched. The [supervisor notice](week-wrap/native-supervisor-final-notice.json)
attributes renderer postmerge success and core111 postmerge started status without
new polling; it also attributes completion of all 12 native-batch PRs and no owned
Office/helper/font registrations remaining. The accepted Windows handoff records
the dated finite results and next-session ownership limits. No package version,
release/site pin, schema, golden or tolerance changed. Older open-status snapshots
remain historical. All seven primaries are [clean and synced](week-wrap/primary-week-wrap-sync.json).

The [preset proposal archive](preset-proposal/README.md) preserves all original
proposal files and three prepared companions as data, with rename maps and unchanged
AuthorShell proof. It remains approval-held, requires rebase/review against current
accepted app source, and has no integrated runtime acceptance. The separate UI
[PR55](https://github.com/Data-Advantage/pptx-dev/pull/55) is draft at 9b441aa on accepted 8f;
its 43 local cases pass. [Current metadata](week-wrap/ui55-wrap-current.json) records
Linux/Windows 35660801988 and Vercel SUCCESS; no detailed CI audit is claimed.
The original [draft receipt](week-wrap/ui55-draft.json) remains unchanged.
It supplies no App54 or production acceptance here.

## Evidence preservation

`provenance.json` maps every copied byte to its original path or immutable Git
blob. Raw failed traces remain private with exact hash/storage receipts; the
historical encoded payload is excluded. All other copied bytes are unchanged. Three raw CI/error-context files have narrow
[whitespace attributes](app54/final-a4eb-ci/whitespace-preservation.json) to retain
their original CRLF/trailing spaces. Archived source/report snapshots end in `.txt`;
no executable source is introduced. `SHA256SUMS.json` covers this compact bundle except itself. Accepted
native105/106/108/109/111 bundles, the Windows wrap-up and roadmap are byte-identical to accepted main;
all earlier evidence is untouched. The documentation
check performs no Office call, package publication, CI trigger, external merge or
deployment. The authorized local checkpoint and additive merge are recorded above.
