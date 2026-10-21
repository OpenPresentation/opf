# Monorepo Phase 1: acceptance results

Run 2026-10-21 on `origin/main` at `04362db3` (MR-10, the last Phase 1 merge), in scratch clones outside every checkout. The criteria are the "Phase acceptance" paragraph of Phase 1 in [burndown.md](burndown.md). Nothing was pushed; no workflow was edited. Machine: macOS 26, Node 26.7, pnpm 10.33.2, git 2.50.1, git-filter-repo 2.47.0; other agent sessions were running, so wall times are upper bounds.

**Verdict: Phase 1 acceptance holds.** Every criterion below passed. The one place where the widened workspace (variant B) fails is the two guards that MR-23 exists to satisfy.

## 1. `pnpm lint`, `pnpm test` and the packed and registry checks on current main

The steps of `opf-ci.yml` (the `Verify OPF packages` job), run in order in a fresh clone:

| Step | Result | Time |
| --- | --- | --- |
| `pnpm install --frozen-lockfile` | pass | 1 s |
| `pnpm audit` | no known vulnerabilities | 3 s |
| `pnpm lint` | pass (708 warnings and 389 infos, no errors; unchanged class of findings) | 2 s |
| `pnpm typecheck` | pass | 9 s |
| `pnpm build` | pass | 12 s |
| `pnpm test` (core suite, CLI suite, 68 root `check:*` scripts) | pass, 68 of 68 checks | 167 s |
| `pnpm run check:examples`, `check:breaking` | pass | 17 s, 2 s |
| `pnpm --filter @openpresentation/opf pack:dry-run` | pass | 7 s |
| `node packages/javascript/test/packed-install-smoke.mjs` | pass | 27 s |
| `pnpm test:cli:packed`, `pnpm test:cli:packed:peers` | pass | 41 s, 84 s |
| `pnpm test:developer-quickstart` (installs from the npm registry) | pass | 5 s |
| `check:registry-layout-v2`, `registry-toolchain`, `registry-golden`, `registry-fidelity-archive`, `release-train`, `release-plan-cli`, `publish-source`, `ci-scope` | pass (all 8) | 0 to 3 s each |
| `check:workspace-graph`, `check:pins`, `check:versions`, `check:playwright-pin` | pass | 0 to 1 s each |

Not run: `test:registry-ecosystem` (network and browser heavy; the sibling packages are not involved in Phase 1), the macOS and Windows legs.

## 2. A core release with the old scripts

- `node scripts/release-train.mjs plan --core 0.25.0 --render 0.25.0 --pptx 0.25.0 --editor 0.25.0 --cli 0.25.0`: exit 0, lockstep order intact, every package reported "on npm (verify only)", `main` carries 0.25.0, tags on the release commits (`ecb22d55` core, `652875ce` CLI).
- `node scripts/release-train.mjs prep core --core 0.25.1` (dry run, no `--execute`): exit 0. It prepared a scratch clone with the version bump, ran `changelog-fragments.mjs assemble --version 0.25.1 --package opf` (4 fragments moved into the release section, which exercises the MR-12 and MR-13 changes) and refreshed the lockfile; 6 files changed, nothing committed or pushed.
- `scripts/publish-source.mjs` (the publish-source dry run), run with main's copy inside a full clone checked out at each release tag: `opf-v0.25.0` (manifest `packages/javascript/package.json`, commit `ecb22d55`) and `cli-v0.25.0` (manifest `packages/cli/package.json`, commit `652875ce`) both print "publish-source OK".

## 3. `ci-scope.mjs` shadow output against the last 30 merged PRs

`scripts/ci-scope.mjs` (union graph, event `pull_request`) against the changed files of the last 30 squash commits on `main` (`git diff <sha>^1 <sha>`), spot-checked with a scratch script next to the full table in [opf#784](https://github.com/OpenPresentation/opf/pull/784):

- The packages the PR really changed (paths under `packages/javascript`, `packages/cli`, `packages/gallery`) equal the `changed` packages of the scope in all 30 cases; where core appears as changed without a `packages/javascript` path, the PR touched a core input (`spec/`, `examples/`, `docs/*.md`, release plan) and the scope says so by design.
- 19 of the 30 are forced to `tier=all` by tooling paths (`scripts/`, workflows, `release-plan.json`, `ecosystem.lock.json`): fail closed, as designed; 11 are scoped (docs, one package, core inputs).
- In no case did today's `ecosystem-scope.mjs` skip the ecosystem while `ci-scope` named a changed package (the one PR the old scope skipped, the docs-only [opf#778](https://github.com/OpenPresentation/opf/pull/778), is `tier=docs` in the new scope).

## 4. Import-state rehearsal on the final branch

Four old repositories (`opf-render`, `opf-pptx`, `opf-editor`, `gallery`, each at its `origin/main` on 2026-10-21) were cloned fresh, rewritten and merged into a fresh clone of core by `scripts/monorepo-import.mjs` (MR-21), then verified by `scripts/verify-import.mjs --blame all --determinism` (online): 88 checks, 0 failed.

| | Result |
| --- | --- |
| Commits imported | render 284, pptx 319, editor 220, gallery 10 = 833 (the plan's 818 + 10 was the count on 2026-10-21 morning; render +1, pptx +1, editor +3 since) |
| Tags imported | render 52, pptx 54, editor 46, gallery 5 (renamed `gallery-v1.0.0` to `gallery-v5.0.0`) = 157; core 78; merged 235 |
| Merged repository | 1,767 commits (930 core + 833 + 4 import merges), 21,367 tracked files, `size-pack` 169.15 MiB |
| Time | clone + rewrite of all four 33.7 s including the core clone and the four merges (filter-repo itself 0.2 to 0.9 s each); verification 2 min 28 s with blame on every text file (3,392 + 578 + 572 + 394) |
| Determinism | a second rewrite gives identical tips and byte-identical commit maps; a second full import from fresh clones (core taken from GitHub instead of a local clone) gave the same merged head `7d17c2bf` |
| Messages | bare `#N` rewritten: render 268, pptx 282, editor 206, gallery 9 (messages changed: 225, 241, 176, 9); no bare `#N` and no closing keyword left; every message equals the independent rewrite |

Finding fixed in MR-21: the S2 spike's message callback also rewrote the `#0` of the spreadsheet format `$#,##0.0` in one pptx commit (`$#,#OpenPresentation/opf-pptx#0.0`), and the spike's loose message check could not see it. The pattern now excludes numbers with a leading zero and a `#` preceded by `#`; the verifier compares every message exactly with an independent JavaScript rewrite.

The merged clone, then two workspace variants (each `pnpm install`, `pnpm lint`, `pnpm typecheck`, `pnpm test` with `CI=true`):

| Variant | install | lint | typecheck | `pnpm test` |
| --- | --- | --- | --- | --- |
| A. Import state: workspace unchanged (core and CLI listed), `--frozen-lockfile` | pass | pass | pass | **pass**: core, CLI, 68 of 68 `check:*` |
| B. Widened: render, pptx, editor and gallery added to the explicit list (MR-23 minimum), `--no-frozen-lockfile` | pass (207 packages added; the materializer reports `packages/gallery is the gallery package, not a generated fixture; nothing to materialize`) | pass (Biome still excludes the three engines) | pass | core and CLI suites pass; **66 of 68 checks pass; 2 fail by design**: `check:versions` ("must share one version, found 0.25.0, 5.0.0": gallery) and `check:workspace-graph` (24 registry specifiers where `workspace:` is required) |

Variant B is the state MR-23 starts from; those two checks are its acceptance criteria. Nothing else, including `check:text` on the binary evidence archives, `check:engines-range`, `check:font-hotlinks` and `check:changes`, broke when the packages joined the workspace.

## 5. Per-item spot checks

- MR-11: `check-changed.mjs --plan --files` for a path in each of render, pptx (an existing test), editor and gallery selects that package's tests plus `check:text`, `check:font-hotlinks` (gallery records also `check:catalog`, `check:spec`, `check:schema-examples`); an evidence path selects no package tests.
- MR-16: `scripts/agent-worktree.mjs add --clone --no-install` from GitHub: core only, 5.5 s (machine under load), 102 MB, 1,290 of 15,516 files checked out. On the merged rehearsal repository (blobless clone over `file://`, base `origin/monorepo/import`): 2.1 s, 191 MB (`.git` 37 MB), 6,255 of 21,367 files; the S3 numbers were 2.0 s and 190 MB.
- MR-10: `materialize-gallery-catalog.mjs` skip-guard exercised in variant B (above); the four new checks pass on the tree and their tests carry the E1 to E3, gallery and cycle fixtures.
- MR-14: see section 3. MR-13: `changes/config.json` lists the six targets; `prep core` assembled into the root `CHANGELOG.md` (section 2).

## Not verified here

- The sibling suites (render, pptx, editor, gallery) in the monorepo (MR-23, MR-31), the golden digest reconciliation, and the Playwright container runs.
- The Windows and macOS legs, Node 22 and 26, and GitHub Actions on the import branch (MR-22 runs them on the real import pull request).
- A GitHub-side full clone of the merged repository (clone time can only be measured after the push); the import pull request's behavior with 833 commits.
- The committed `import-verification.md` and `commit-map/`: they must be generated after the freeze (MR-20), because the old repositories still accept commits.
