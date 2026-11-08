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
