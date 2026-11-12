# F2/F3 current release-doc currency

Source-only follow-up from fresh main9545016583ccfa151077cda4d51043ac6505a140 normally merged to integration787bccd52defaef82fb5c91320ed0e0cfb58bc20. Worktree C:/opf-work/rr-release-docs, branch codex/rr-20-release-doc-currency; derived PR targets codex/integration-034. Inherited integration source/evidence stays intact.

Correct current publisher/upload/registry counts and renderer roster (MCP included), remove future MR-40 and manual editor release-prep instructions, and require the existing one-click Release workflow rehearsal first. The authoritative PUBLISHED/NAMES roster contains seven; six authoring skills, the six non-Gallery previous-version inputs and genuine historical WebP counts are not publication counts and remain unchanged. No package code, chart, workflow behavior, release or deployment changes.

Regression: existing scripts/release-workflows.test.mjs checks only the five current release sections against NAMES/PUBLISHED, parses numeric roster claims and enumerates actual npm names rather than copying whole prose lines. Its check mapping now includes the affected docs. Actual before run has five failing doc controls; after run25/25 pass with explicit Node24. Required mapped-check results and immutable raw/source receipt follow below.

Vetoable decisions: (1) scope the count guard to current release sections instead of globally replacing six/five; (2) use the shared workflow and trusted publisher, not manual release-prep PRs; (3) dry-run true precedes the real same-version dispatch; no command is dispatched by this source task. No new observer; parent owns review/folding/gating.

## Actual verification and handback

Explicit Node24.20.0 controls pass25/25. The first required mapped run ran89.1seconds:12 passes,2 failures and one typecheck skip; both failures were missing historical inputs excluded by the default sparse profile. Restore-only hydration brought1842 existing tracked HEAD inputs back; no inherited bytes or generated tracker records were changed. The second full mapped run passes all13 selected steps in81.2seconds, with correct typecheck skip. Source spec/examples/workflows/package-code/default-record/lock trees are unchanged. The receipt binds source and lossless raw logs, including all actual first failures.

Vetoable validation scope: the parent requested the mapped scope for this bounded docs/test change; all selected checks completed. The full package/OS/release gate remains with the parent and CI; this task invokes no publisher, golden generator, release, deploy or new observer. Parent owns exact-head review/folding.
