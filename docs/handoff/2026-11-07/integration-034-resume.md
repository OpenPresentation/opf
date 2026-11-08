# v0.34 integration preparation

This is an isolated preparation branch, `codex/integration-034`, not a release candidate or CI-approved PR. The unified checklist is [#1139](https://github.com/OpenPresentation/opf/issues/1139). v0.33 release and its site updates still come first.

Fresh main d19c4bb6172b703d132ebba3fd006e4ec5cdf845 was checked out with the maintained agent-worktree tool. Current033 source d26031b98ff9316d479f8db7a383511371cab4a6 was merged, then the frozen reviewed wave2 assembly04a7fc6636569bdb09c0435188f289ddffe4c4d7. All17 source PRs and their reviewed heads are in [wave2-review.md](wave2-review.md). Their branches are permanently folded and must never be pushed again. Neither evidence-only branch was merged.

The six conflict files retain both program logs/docs and both feature sets. In composition, keep033 layout-first, table-note growth and chart exports; add wave2 closing/placed tiles, JOINED_FIXED_MAX and localized chart-title exports. The table-note growth algorithm keeps033's monotone size search while calling wave2's measured tableCellLines(table,options,scale). This interaction requires the existing LH75/LH80 no-shrink tests and review before acceptance. No generated golden was edited.

Vetoable decision: prepare and validate the combined source while033CI/native blocker work runs, but open no034integrationPR or golden/full-CI wave until033 is published and fresh main is merged. The new033waterfall fix, release commit/version and genuine site updates remain prerequisites. Source preparation is pushed for resumability; it does not count as release approval.

Next: install using Node24/pnpm10.33.2 and the shared store; build/typecheck and run focused integration regressions. Merge reviewed state-arrow continuation3a681e56 and item PRs1141(eff64d48),1142(6f46dd22),1143(cabd3c8a),1144(b9642636) only after full diff/native review and preserve all033 fixes. SH20–23, LH16/LH34 and remaining chart/layout/font items remain separate agent lanes. Keep every final result on GitHub. Owner-only decisions/deploys/logins stay reserved.

## Reviewed follow-up assembly

Merged final033candidate0e02db5a0aa6a68b7459fe62e3ed5b60f38784ea, then frozen#1141 language source dde3809913e9d2e38d9c199f67ece8741426067e, #1143 release assets cabd3c8a03d02255329edd2352eb1e39df7fb40c and state-arrow continuation3a681e56a581004348270f6c4febf79e21f0ab3c. Never push these folded branches. All unique progress lines are retained; RR105/RR106 metadata stays intact and RR107 follows them. LH178's implementation status and the already completed LH179 Windows-test status both survive.

Language qualification is real Office edit-free save/reopen/import evidence in#1147 e1f8a0921640f2b4100d6807fc3590dbe26abeed: both measured and explicitly diagnosed native-request fallback routes retain deck/slide/run language and altLang; source bytes match, saved derivative hash884a408dd7fa4e50044e556d24a9962d4c4a0605677ff02783f8e655f6cfc3dc. The mixed RTL body remains a measured fallback, not newly qualified native paragraphs.

SH23#1148 frozen3e20cd6e is independently reviewed with all five actual ninth-node save/reopen receipts accepted, but isolated changed-branch verification is still running before fold. LH177#1142 and LH121#1144 still await fresh native receipts; native wrapped title#1149 has50 witnesses queued. No034golden/fullCI/PR or release is started;033candidateCI/native acceptance and release/site updates remain first. Vetoable decision: keep this source preparation separate from release approval while parallel items finish.

## Font, localized-status and added-node reviews folded

Folded frozen #1142 (6f46dd2255b27abb4af7ecbfaf2e07ec5fba34a6), #1144 (b9642636e297a1d2dfbf65cb77bea133841beee1) and #1148 (3e20cd6e8f47629e4f5d55ee4534f863d7903f6b). Their branches must never be pushed again. The coordinator reviewed fresh PowerPoint output for all six font/status slides, with no new clipping or shrink; the separate evidence-only #1151 dc3d2b682c8cac10d28752f61861b94932a4d1b3 preserves the three pinned inputs, raw probes, saved copies and normalized comparison. It makes no new saved-import or exact-font-parity claim. LH183 retains the explicit tracked Yu Gothic stroke-weight gap.

SH23 source and all five actual ninth-node edit/save/reopen receipts are accepted. The required local changed-scope check passes build, Biome, typecheck and mapped source checks; four literal Windows/sparse-evidence limits are preserved in the independent receipt on codex/sh23-check-evidence at4079158a572568723730b61b43140f2d0ed1e9b8. Focused historical text/width checks pass after exact Git-blob hydration. Neither evidence-only branch is merged. Full assembled CI remains owed.

Conflict resolutions preserve every completed LH row and all unique progress lines, including language guidance and localized timeline status guidance. SH08 import documentation and SH23 added-node qualification both remain. SH20–23 IDs are reserved for the SmartArt sweep/tree work; SH24 is inverted pyramid #1128 and SH25 is chart-point overlays #1113.

## Reviewed title, language portability and inverted pyramid continuation

Folded frozen #1153 at8bd560e4c3e854aec08f440d080df0f6faba6c77, #1149 ata34d49b8ab19abf07fe90014a723774e38a333e2, and #1157 atb4c0ae47fdb7daac570e54ca53705e71ca9f41bb. Do not push those source branches. SH24 has three native slides /12editable shapes accepted, widest-first order and PowerPoint-saved ordered import. Native-title qualification covers50actual accepted inputs:38native and12explicit measured fallbacks, with39byte-identical reused witnesses and11corrected fresh witnesses. Final physical-face measurement correction preserves all50input hashes and has independent source review; font sizes and authored native faces remain. The language-reference walker now embeds deck and slide selections; both public examples validate standalone and all five SVGs match catalog-backed originals exactly, including the Arabic54px title.

The coordinator saved then restored its own provisional example embed before the reviewed portability merge; no local-only provisional change remains. RR20 contiguous-table maintenance is folded and all eight report tests pass. Initial native batch for LH16, LH34 and optioned doughnut opens13files/25slides and imports every saved copy with no shrink. This is not visual acceptance: duration labels wrap differently in native and an RTL range reverses; Arabic image-side labels also wrap differently. These are assigned to the owning lane before fold. Doughnut visual review is in progress after correcting only the nested preview artifact packaging. RR108 pinned template golden coverage and RR109 read-only furniture worker are separate maintenance items under review.

v0.33 exact head5b320eda3a8ba2deb085839fdaeb063cc7a8de79 has all normal/full CI green and native acceptance sealed; maintained required-all merge confirmation is active. No release or site deploy is complete yet. Fresh release/main must still be merged before the one v0.34 golden/CI batch.

## Main alignment after v0.33 squash merge

Normally merged main7c0c3f13e9de77e038b6ec26183043eb7fe90822 into this preparation branch. Vetoable decision: align ancestry now so new isolated worktrees can merge the preparation cleanly; merge the actual release commit again after publication. Conflicts retain the newer v0.34 runtime rules (measured table-note/picture tracks, placed tiles, closing lead, optioned doughnut holes), all unique program progress entries, current source/native status rows and the merged v0.33 suite-aware gate/completion correction. The two newly noticed stale LH182/LH183 duplicate rows are consolidated into their newer implementation rows. No feature or evidence-only branch is dropped or merged by this alignment.

## Recovery ancestry alignment

Normally merged reviewed033 candidate5282536c after actual main revert502eb42d. All package/schema/example/skill/script/workflow/runtime trees are identical to preparation64725585; only the exact tracker refresh and new recovery handoff are added. Fresh worktrees from temporary main502 can now merge this preparation without losing unchanged033 source. The actual published release/main must still be merged again before final034 integration. Tracker metadata is105 from the033 correction while this preparation already has later RR rows; strict final034 generated refresh remains mandatory. No new source/golden/native acceptance or publication is claimed.
