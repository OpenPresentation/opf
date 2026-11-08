# v0.34 integration preparation

This is an isolated preparation branch, `codex/integration-034`, not a release candidate or CI-approved PR. The unified checklist is [#1139](https://github.com/OpenPresentation/opf/issues/1139). v0.33 release and its site updates still come first.

Fresh main d19c4bb6172b703d132ebba3fd006e4ec5cdf845 was checked out with the maintained agent-worktree tool. Current033 source d26031b98ff9316d479f8db7a383511371cab4a6 was merged, then the frozen reviewed wave2 assembly04a7fc6636569bdb09c0435188f289ddffe4c4d7. All17 source PRs and their reviewed heads are in [wave2-review.md](wave2-review.md). Their branches are permanently folded and must never be pushed again. Neither evidence-only branch was merged.

The six conflict files retain both program logs/docs and both feature sets. In composition, keep033 layout-first, table-note growth and chart exports; add wave2 closing/placed tiles, JOINED_FIXED_MAX and localized chart-title exports. The table-note growth algorithm keeps033's monotone size search while calling wave2's measured tableCellLines(table,options,scale). This interaction requires the existing LH75/LH80 no-shrink tests and review before acceptance. No generated golden was edited.

Vetoable decision: prepare and validate the combined source while033CI/native blocker work runs, but open no034integrationPR or golden/full-CI wave until033 is published and fresh main is merged. The new033waterfall fix, release commit/version and genuine site updates remain prerequisites. Source preparation is pushed for resumability; it does not count as release approval.

Next: install using Node24/pnpm10.33.2 and the shared store; build/typecheck and run focused integration regressions. Merge reviewed state-arrow continuation3a681e56 and item PRs1141(eff64d48),1142(6f46dd22),1143(cabd3c8a),1144(b9642636) only after full diff/native review and preserve all033 fixes. SH20–23, LH16/LH34 and remaining chart/layout/font items remain separate agent lanes. Keep every final result on GitHub. Owner-only decisions/deploys/logins stay reserved.
