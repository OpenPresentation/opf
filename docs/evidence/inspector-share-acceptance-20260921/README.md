# Inspector publication checkpoint — September 21, 2026

Core102 is accepted with green pre/post-merge CI. App54 has reviewed local
acceptance and a READY preview, but its first-attempt Windows CI gate failed.
App54 is held and unmerged; production acceptance remains pending. The [machine-readable state](checkpoint.json) keeps these
boundaries explicit. Published package versions, runtime defaults, examples,
goldens and native/font acceptance criteria are unchanged. Issue88 and the overall goal remain
open.

## Accepted core102

[PR102](https://github.com/OpenPresentation/opf/pull/102) merged as
`578bcc6e0894129b00059258bd4ad1994a414baa`. Reviewed head
`e746dee147ec4d3d0eef69e22e7e1d3f48b6346a` has the same tree
`2de778c56a9d4afcc686830a39b881d147a1f4ee`. The [merge receipt](core102/merge-receipt.json)
and [merged PR](core102/merged-pr102.json) retain these identities. The merge
receipt's historical pending postmerge field is superseded by the later
[postmerge audit](core102/postmerge/release-audit.json), not rewritten.

| Gate | OPF CI | Coordinated public packages | Result |
| --- | --- | --- | --- |
| Premerge | [35635885648](https://github.com/OpenPresentation/opf/actions/runs/35635885648) | [35635885561](https://github.com/OpenPresentation/opf/actions/runs/35635885561) | Both success, attempt 1 |
| Postmerge | [35636929112](https://github.com/OpenPresentation/opf/actions/runs/35636929112) | [35636929090](https://github.com/OpenPresentation/opf/actions/runs/35636929090) | Both success, attempt 1 |

Exact [premerge audit](core102/premerge/release-audit.json),
[OPF run](core102/premerge/opf-final.json), [OPF jobs](core102/premerge/opf-jobs-final.json),
[coordinated run](core102/premerge/coordinated-final.json) and
[coordinated jobs](core102/premerge/coordinated-jobs-final.json) are retained.
The corresponding [postmerge OPF run](core102/postmerge/opf-final.json),
[OPF jobs](core102/postmerge/opf-jobs-final.json),
[coordinated run](core102/postmerge/coordinated-final.json) and
[coordinated jobs](core102/postmerge/coordinated-jobs-final.json) bind the accepted
main commit. Both workflow logs recorded Node24.20.0. The audits record all 158
reviewed documentation/evidence blobs unchanged, a clean primary checkout and
accepted/reviewed tree equality. Original logs and complete inventories remain
at their provenance paths; this compact checkpoint does not duplicate them.

These portable package, CLI, browser and serialized-output checks establish
this core documentation checkpoint. They do not clear App53's original failed
Linux job or the separate native Office/physical-font gates. Bugbot's neutral
failure was not a completed review.

## Parallel native checkpoint and ownership

Accepted [core103](../windows-native-picture-20260921/README.md) and PPTX46 add
the recovered-host minimal picture lifecycle evidence and bounded harness.
Two picture controls passed 30/35 comparator checks; they do not certify all
native edits, furniture or fonts. The [merged PR receipts](native/accepted-prs.json),
[core103 postmerge runs](native/core103-postmerge-runs.json),
[PPTX46 postmerge run](native/pptx46-postmerge-runs.json) and
[seven-repository sync](native/repo-sync.json) record the newer accepted baselines.

The user's [subsequent Windows supervisor report](native/supervisor-update.md)
describes three picture edit cases and ten furniture lifecycles, nine passing
furniture semantic cases, production notes-order success with controlled
reordered-copy failures, and a native tab residual of approximately 0.02265625pt
against the unchanged 0.02pt gate. These are supervisor-reported findings while
further evidence publication and permitted-font tests continue. The captured
[PPTX47 status](native/pptx47-status.json) identifies the active candidate; it is
not an accepted merge or a complete native compatibility claim. Picture geometry
changes and clipping of longer edited text remain reported limitations.

The Windows supervisor retains sole desktop Office control. This public-app
task will coordinate before touching active native branches or testing Office;
it has performed no such action. Public-app issue88, shared runtime fixes,
geometry drafts and p:hf roadmap work remain separate.

## App54 candidate

[App54](https://github.com/Data-Advantage/pptx-dev/pull/54) has exact head
`60c91f6b97c75636f533202f4112e09dc01144e4`, tree
`b317179a899e97740003b4195b7172f7d3d6d8b2`, based on accepted App53
`e40c287b64fcbcfb85fb4a8a50641aea8e3e54a8`.
The [commit receipt](app54/commit-receipt.json) confirms a clean worktree and
83 committed blobs matching the reviewed bytes. The
[immutable application evidence](https://github.com/Data-Advantage/pptx-dev/tree/60c91f6b97c75636f533202f4112e09dc01144e4/docs/evidence/inspector-share-publication-20260921)
retains full reports, controls, source snapshots, publication payloads and
screenshots. The earlier [local validation receipt](app54/validation-summary.json)
correctly labels its then-uncommitted candidate; the subsequent commit receipt
binds that validated source to the PR.

Local Node24.21.0 validation passed **659 unit tests across 67 files**, a build,
focused **3/3** browser tests and full **31/31** in **97.035744 seconds**. Browser
retries, skips and flaky outcomes are zero. All 22 recorded source/config/test
inputs match across validation. [Lint comparison](app54/lint-comparison-reviewed.json)
retains the shell's existing 3 errors / 1 warning after diagnostic line-number
normalization; changed helper/test files are clean. No new suppression is claimed.

The [independent review](https://github.com/Data-Advantage/pptx-dev/blob/60c91f6b97c75636f533202f4112e09dc01144e4/docs/evidence/inspector-share-publication-20260921/browser-review/REVIEW.md)
verified all 34 focused/full test results, 34 observed publications across 20
stage files, real reloads and legacy-query removal. Both full-run share/refresh
screenshots and selected security frames were visually reviewed. Screenshots
show the expected source and visible one-slide preview; they do not certify
whole-slide appearance or native/font behavior. Original raw traces remain
private with hashes and ZIP-integrity receipts in the immutable app evidence.

Automatic publication validates authoritative source text/format before and
after asynchronous encoding, with current URL, load-revision, loading and
cancellation guards. It removes an effective obsolete `import=hash:` query so
refresh reimports the newly published fragment. The URL contract is semantic
content, **not exact original whitespace, number spelling or escape spelling**.
Browser transition checks allow the preceding accepted document until the first
new publication, then reject rollback. They do not establish that every History
write during a pending edit uses the newly entered source. Deterministic
held-promise controls test the stricter source/format/navigation race guard.
Refresh of an already canonical URL proves reimport, without claiming a new
distinguishable automatic encoding.

The security test now waits for exact fixture count/title before strict
visibility. Its hostile-content assertions and timeout budgets are unchanged.
The original [App53 diagnosis](../author-source-acceptance-20260921/inspector-share-diagnosis/REPORT.md)
remains immutable: Linux postmerge was **28/29**, and its trace separately proved
wrong-document automatic publication. App53's separate canonical **29/29** pass
and Windows **29/29** do not replace that failed run.

## Pending acceptance and remaining scope

The later [held PR status](app54/status/pr54-held-description.json) and
[issue88 status](app54/status/issue88-app54-held-updated.json) confirm both remain
OPEN, with App54 still at `60c91f6`. The parent's exact updated
[PR body](app54/status/pr54-held-description.md) and
[issue body](app54/status/issue88-app54-held-update.md) are preserved as external
status receipts. The captured PR body includes an automated summary; its text
does not supersede the neutral failed-to-run review check recorded below.
No status mutation was made by this documentation task.

The original [PR receipt](app54/pr54.json) is an unchanged running snapshot.
The later [CI audit](app54/ci/release-audit.json), [final PR receipt](app54/ci/pr-final.json),
[run](app54/ci/application-final.json) and [jobs](app54/ci/application-jobs-final.json)
record application [CI35638158483](https://github.com/Data-Advantage/pptx-dev/actions/runs/35638158483)
**failed on attempt 1** at the exact App54 head. No rerun was performed.

| Platform | Unit tests | Browser tests | Result |
| --- | --- | --- | --- |
| Linux | 659 passed | 31/31 passed | Success |
| Windows | 659 passed | 30/31 passed | Failure |

Both used Node24.20.0. Both new share-publication cases passed on each platform;
all [62 browser outcomes](app54/ci/browser-results.json) remain separate from the
local macOS 31/31 pass. The [excerpt](app54/ci/ci-excerpt.log) retains the exact
failure and completed install/type/build steps. [Committed-source audit](app54/ci/committed-source-audit.json)
and [remote identity](app54/ci/remote-head.json) bind the reviewed source.

The full ten-file [Windows diagnosis](app54/windows-timeout/REPORT.md) is copied
unchanged, including its own [manifest](app54/windows-timeout/SHA256SUMS.json),
original timing JSON, error context and extraction script. It records the
unchanged **45,000 ms** test deadline expiring while the normal Author Preview
click was pending. Inspector fixture identity and all Inspector security checks
completed before navigation. Author `goto` took **31.400 seconds**; one local
script with **1,490 decoded bytes** took **30.026 seconds**. Trace network records
contain 180 completed HTTP200 responses and one incomplete worker record, with
no HTTP400+ response. These bounded facts do not identify the scheduling or
transport cause; no external-network, antivirus or Next.js cause is asserted.

The afterEach diagnostic started after the timeout result existed. It did not
originate this deadline failure, although setup/observer overhead and its
counterfactual effect cannot be excluded. The original body continued through
Author assertions during teardown; those late checks are not an in-budget pass.
Only Author timing survived again, with the Inspector/pagehide snapshot absent.
[Failure facts](app54/ci/windows-failure-facts.json) and [timing summary](app54/ci/windows-timing-summary.json)
retain those limits. The [artifact inventory](app54/ci/artifacts-final.json) and
[download checks](app54/ci/artifact-download-checks.json) verify original ZIP
size, digest and CRC; raw private ZIPs/traces are not copied here.

Artifact compatibility was **not triggered / not applicable**, not a fresh pass.
The unchanged [Python artifact workflow](app54/ci/artifact-workflow.yml.txt) path
filters match no changed file; the [run inventory](app54/ci/runs-final.json)
contains only application CI. Core102's separate green package/browser checks
do not replace the failed application gate. [Bugbot](app54/ci/automated-review.json)
was neutral because it failed to run, not a completed review.

The [preview receipt](app54/preview.json) binds READY deployment
`dpl_Atu9SsSsLY8hPAZJ6RPNx91pKA31` to the exact App54 head, with target null and
no browser acceptance. It supersedes the older pending Vercel field in the PR
snapshot. This is not a production deployment receipt.

- Application CI and merge gate: failed; App54 held and unmerged.
- Accepted merge/tree binding: pending.
- Exact production READY deployment and before/after binding: pending.
- One fresh canonical browser run and visual review: pending.
- Postmerge application CI: pending.

App53 remains the recorded production baseline. Explicit toolbar Share, export
and Author handoff still use deferred preview state; their source freshness is
outside this automatic-publication correction. Preset Undo all and broader
source writers, imported-file spelling, clipped suggestion details and the
missing Inspector timing snapshot remain unresolved. The preset proposal is
unapplied while its separately requested approval is pending. Required native
Office/physical-font and deterministic repair work remains open. The coordinated
geometry drafts remain deferred and unmerged; issue24 stays at 0.1px and native
Header/Footer stays roadmap-only.

The [current handoff](../../handoff-2026-09-21.md) and
[compatibility matrix](../../compatibility-matrix.md) retain those gates and the
original App45/App46/App47/App53 failures. No product edit, build, browser run,
CI retry, commit, push, merge, deployment or package publication was performed
while assembling this checkpoint.

## Evidence integrity

[Copy provenance](copy-provenance.json) records source paths, byte counts and
SHA-256 values for 52 exact copies, plus hashes and immutable links for reports
retained elsewhere. Later state is recorded separately from earlier snapshots.
The new outer [manifest](SHA256SUMS.json) covers every new evidence file except
itself, including the original nested Windows diagnosis manifest. Scoped Git
attributes preserve literal evidence bytes across checkouts. Only the copied
external PR-body Markdown permits its original generated blockquote trailing
spaces; authored prose retains ordinary whitespace checks. [Verification](verification.json) records copy/hash/link checks and the
unchanged prior evidence. This is a prepared documentation draft with failed application acceptance;
parent review must retain that failure and the unresolved cause.
