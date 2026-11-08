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

## Continuation: blocker fixes and extra review

- PR #1140 at788a04a45124ab837799855d7a6f361f3ad9ca5a is reviewed and folded. Shared numeric axes now give native box/whisker0..15/by5, scatterX0..500/by100,Y0..250/by100. Fresh axes-recheck probes and image confirm the preview scales; only horizontal scatter gridlines remain. The original axes finding above is retained as before evidence.
- All21 extra preview/native pairs are reviewed. The maintained COM runner forces1280×720, including A4 source decks (841.625×595.5pt). The first sheet cropped preview images while native images were stretched. The normalized sheet restores the authored aspect ratio before fitting both panels; it changes no slide content. Doughnut holes and surface ellipses align with native rings without a motif border. Bar thickness, clustered multi-series columns, and mixed-icon list spacing agree. LH93 stacked siblings remain the explicit0.34 remainder; clustered sibling measurements above pass.
- RR87 browser flow passes offline export/import/undo with zero network writes. A real native pass using helper commitdaf69e93e796b0d87db1eac66beeec9bfb5b2d4b edits an owned read-only copy, uses SaveCopyAs, closes only owned copies, reopens the saved copy and imports one table with the edited text. Fixture hash stays6af5f26fa5eb2f8097fac2a29ebcd03394e0a71fdd50d137d4aac0b84ef62782. Seven offline ownership/refusal/timeout controls pass. See rr87/native.json and logs. The helper now distinguishes SaveAs identity changes and prevents unsaved-edit close prompts.
- #1133 is pushed ate9302cb240ca1b500f54461f12af9cd9b857889d. Full CI42444605809 and the single batched pr-gate watcher are active. Local final renderer contract passes; final PPTX/editor checks continue. Exact-head full-corpus rerun is still owed before merge. No release approval is claimed.
