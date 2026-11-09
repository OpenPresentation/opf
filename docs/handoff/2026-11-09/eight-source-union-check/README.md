# Eight-source union checks

At exact source be65fa941edbd191a72db2f8d74742309ba9dd68, strict font tracker, gallery tracker, catalog preview regeneration checks and all release-report tests pass. Logs and actual receipt are retained unchanged.

The aggregate receipt remains RED: root also mistakenly ran both original leaf-specific verifiers from the combined worktree. RR20 correctly rejects the companion Gallery tree change; RR111 correctly rejects the companion PPTX fixture change. These leaf verifiers passed at their original source worktrees. Their guards and original logs are unchanged. The separate eight-source assembly verifier checks the combined result against each exact source blob. Independent peer review accepts all23bindings/13protections and all5shipping metadata blobs.

This is metadata/source union evidence only; managed golden, full CI, native and release acceptance remain open.
