# v0.33 final Windows qualification evidence (in progress)

Evidence-only branch. **Do not merge this branch.** Source fixes are on the release integration branch; this preserves their native evidence without changing raster goldens.

Corpus source: `2db20c01ef4d9b80db9797116dc83e41f65d1c68`. Node24.20.0, pnpm10.33.2. PowerPoint16.0.20527.20112 on Windows build26200.9711. The maintained runner was copied with its owned-copy Open call changed from writable to read-only; no other runner behavior changed. No existing PowerPoint process was running at the start of any pass. No UI control and no Office termination.

- 25 PPTX files / 270 slides opened without repair. All no-shrink checks pass; all25 saved copies import through OPF.
- 266 visible comparison pairs are indexed in review/index.json, with compact preview|PowerPoint sheets. Root reviewed06–11; the independent wave-2 reviewer reviewed00–05. These reviews detected the blockers below; a small difference score is not acceptance.
- 17 additional files /21 slides cover every chart/list case from com-checks.md (including mixed-icon entries and the LH93 sibling chart fixtures). Their source copies and exported file hashes are in extras/build.json. Extra PNG review is still in progress.
- LH93 clustered sibling plot InsideWidth220.818503937pt, InsideHeight288.305511811pt, InsideTop41.3782677165pt match exactly on slides1/2. Stacked sibling widths remain the explicitly tracked0.34 remainder.

## Findings and dispositions

1. **Supported blocker, fixed/rechecked:** layout-sampler slide31 Basic Pyramid draws black text on blue in native PowerPoint, white in the preview. Fix fa65126161f0247dd85ffb263eec522372d1f501 gives built-in revTx labels the on-shape color and preserves tx1 for OPF labels beside shapes. The regression failed before and passes after. pyramid-recheck contains fresh exact-fix-commit source/export hashes, probe and the reviewed white-label native PNG.
2. **Supported blocker, open:** native box/whisker and scatter axes choose PowerPoint automatic scales instead of the preview's scales. See native-chart-metrics.json; implementation is running in an independent branch. Do not release until requalified.
3. **Aggregate-bounds false positive:** the stacked OPF shape in shapes slide6 has three character bounds ending464.04pt, inside its496.80pt bottom; COM's whole-range bound counts a fourth phantom line. Raw results.json retains the failing aggregate finding; shape-text-probe.json records the separate character measurements. Both images agree and show no overhang. No tolerance or assertion was weakened.
4. **Known deferred defects:** opt-in native-body sampler slide47 wraps 'Share results with both teams.' onto another line; #1114 addresses it in0.34 (formerly slide41 before six new sampler slides). Academy small-run title baselines are also #1114; native wrapped-title differences are #1127. These retain the original handoff's explicit0.34 disposition.
5. UI-only Accessibility Checker, Edit Data and adjust handles are not run. MCP/editor browser behavior has separate package/site CI coverage, not a native-pass claim.

Initial check:changed's raw failures are preserved. Windows path/symlink privileges and omitted historical evidence remain literal environment failures; the two stale chart assertions found by the run were corrected to keep exact current behavior. Focused chartex and Few-chart regressions pass. Follow-up package checks are still running.

Unified tracking: https://github.com/OpenPresentation/opf/issues/1139. Nothing here claims release approval, registry publication, site merge or deployment.
