# v0.33.0 continuation checkpoint

Updated 2026-11-07 (America/Los_Angeles). This checkpoint supplements the original handoff; earlier observations remain historical.

- Golden workflow [42421884975](https://github.com/OpenPresentation/opf/actions/runs/42421884975) succeeded and pushed `a12841f376c9d3be2fa4d382f0c67e9297c6ce20` to integration PR #1133.
- Reviewed its artifact: 28 slides in 11 decks (six multi-series Pareto examples, twelve SH-10 shape/effects/overlay slides, and ten slides in the new icons-and-arrangements example). The changes match the folded work. No raster baselines were edited locally.
- Merged `origin/main` (`d19c4bb6172b703d132ebba3fd006e4ec5cdf845`) into that golden head, without rebasing or force-pushing. Local merge commit: `2db20c01e`.
- Qualification uses a new isolated worktree, `C:\opf-work\release-033-final`, Node `v24.20.0` and pinned pnpm `10.33.2`; all seven packages build successfully.
- `pnpm check:changed` and a fresh qualification corpus build are running. The browser-safe helper test has the documented Windows path-separator failure (`src/a.ts` versus the absolute Windows path); its assertion is unchanged.
- PowerPoint is installed; no POWERPNT process was running at setup. The final COM run and extra chart/list checks remain pending. Native evidence will identify the exact source revision and file hashes.
- No integration merge, release, site merge, deployment, DNS change or login has been performed in this continuation.

## Vetoable decisions

- Keep the existing v0.33 integration scope. The native-body and small-run-title fixes already assigned to v0.34 remain there unless final qualification demonstrates a new default-mode regression.
- Run the maintained COM qualification runner with the read-only flag on its owned working copies, keeping edits transient and saving only derivative copies. Never attach to an already-running PowerPoint instance.
- The hosted MCP branch will be brought forward by merging the bumped default branch into a new derived branch, preserving the original commits, as required by the no-force-push rule.

## Next action

Finish local validation, push the merged integration head once, dispatch Full CI for that exact head, and watch only with `scripts/pr-gate.mjs --required all --expect-head <full SHA>` while the native pass proceeds. Do not enable merge until the native results are reviewed. The two releases and all site updates remain outstanding.

## Parallel execution

Unified task list: https://github.com/OpenPresentation/opf/issues/1139. The coordinator owns v0.33, PowerPoint, release gates and final acceptance. Three isolated agent lanes own wave-2 review, remaining core implementation, and site delivery; their concrete results are reviewed before integration. All owner-only steps remain reserved.

## Final qualification findings before the integration push

The maintained PowerPoint run completed on `2db20c01ef4d9b80db9797116dc83e41f65d1c68`: 25 PPTX files, 270 slides, all open without repair, no shrink autofit, and all 25 PowerPoint-saved copies import. Hidden-slide count differences are expected and pass the hidden-aware grader. Review artifacts cover 266 visible slide pairs.

Supported release blockers found and being fixed:
- Basic Pyramid on a light slide uses black native labels where the preview uses white. A new regression failed on the original code; the native style-label color fix passes its light/dark and beside-shape controls. Native recheck pending.
- Box/whisker and scatter axes still use PowerPoint automatic scales instead of the preview's scales. The core agent is implementing a shared-axis fix in an isolated derived branch before v0.33.

The vertical stacked OPF text overflow is a COM aggregate-bounds false positive: each of its three character boxes fits; the range counts a phantom fourth line. Preserve the raw probe and the separate character-bound measurement. The known opt-in native-body sampler overflow remains #1114's v0.34 scope; no default body overflow was found.

Initial `pnpm check:changed` completed (806 s). Typecheck, stability, template goldens (624 slides) and most mapped checks pass. Literal failures: Windows browser-helper path separators; sparse historical evidence in tracker/native/text/core script-width tests; editor symlink privilege; and two stale integration assertions (an axis tick fixture now directly labeled, and histogram/Pareto tests still expecting automatic scaling). The two stale assertions are being corrected to retain exact behavioral checks. No assertion or golden tolerance is relaxed.

## Blocker fixes folded (latest operational state: issue #1139)

PR #1140 at `788a04a45124ab837799855d7a6f361f3ad9ca5a` was code-reviewed and folded into this preparation branch. Its branch is frozen. Shared box/scatter numeric axes preserve all SVG hashes in both portable and measured Office-font sweeps across12 affected example decks. Fresh native sampler inspection confirms box0..15/by5 and scatterX0..500/by100,Y0..250/by100, with only horizontal gridlines. The native pyramid recheck on `fa65126161f0247dd85ffb263eec522372d1f501` confirms every label is white as the reviewed preview draws it.

RR87's browser export passes offline edit/export/import/undo checks with zero network writes. Real PowerPoint acceptance on helper fix `daf69e93e796b0d87db1eac66beeec9bfb5b2d4b` (see the exact helper commit in Git history; the authoritative report is the evidence branch) edits an owned read-only copy, SaveCopyAs, closes only the two identified owned presentations, reopens and reimports the edited text with one native table. The fixture SHA remains unchanged. Seven Office-free ownership controls pass.

Native evidence is pushed on [`codex/rr105-final-evidence`](https://github.com/OpenPresentation/opf/tree/codex/rr105-final-evidence/docs/programs/release-readiness/rr-105-com/final-033-2026-11-07), an evidence-only branch that must never be merged. The unmodified aggregate probe failures and their manual dispositions remain visible.

The original broad check was rerun for the pyramid fix: 77 PPTX files of the suite pass before the documented Windows symlink-privilege stop in keynote-registry-runtime. Its chartex and Few-chart stale assertions are now exact current-behavior assertions and pass individually. The RR87 focused check reaches only the known missing-historical-evidence and editor symlink environment failures. A final combined check and corpus pass are next, then one push to#1133 and FullCI; PR#1133 remains the sole release integration.

Prepared site branches (all pushed, genuine published pins retained; final bump/preview acceptance still owed): `codex/sites-033-continuation` in all three repositories. Hosted MCP localhost protocol tests4/4 and deck-app browser tests8/8 pass; pptx.dev source-pane regression6/6 and playground10/10 pass. Full OpenNext Worker packaging needs Linux PR preview because Windows symlink creation is denied.

## CI corpus gate correction and final local check

The combined local check completed: build, Biome, typecheck, stability, all163 renderer test files and the first78 PPTX files pass. Literal environment failures remain the Windows path-separator helper, missing historical evidence in core/tracker/native/text, and symlink privilege in PPTX keynote-registry-runtime and editor codemirror-guard. The raw logs remain in the evidence branch.

CI on e9302cb240ca1b500f54461f12af9cd9b857889d exposed a corpus-test false positive: its raw XML regex counts both a SmartArt Choice and its picture Fallback as simultaneous objects, although the exporter intentionally preserves their shared identity. ECMA-376 Part3 selects one branch before application validation ([Microsoft explanation](https://learn.microsoft.com/en-us/office/open-xml/general/introduction-to-markup-compatibility)). The corpus now checks ID collisions between branches that can coexist. Thirteen controls retain rejection of collisions within a Choice/Fallback, against outside objects, across independent wrappers and across compatible nested branches; mutually exclusive branches may share an ID. The existing SH16 same-identity, fallback-import and rendering checks remain unchanged. This test-only correction is independently reviewed; production bytes and goldens are unchanged.

Vetoable decision: correct the structural gate's MCE interpretation instead of changing the native object's intended identity to satisfy its raw regex. The final exact-head qualification follows this commit after focused verification. No release is approved yet; issue#1139 and the evidence-only coordinator checkpoint carry the current operational state.
