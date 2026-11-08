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
