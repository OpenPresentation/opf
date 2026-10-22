# Monorepo CI: design notes for MR-30

Status: drafted 2026-10-22 on `codex/mr-30-ci` (draft pull request, base `monorepo/import`). The workflows cannot run on Actions until MR-23 has wired the workspace, so every duration below is an **estimate** from the old per-repository CI logs (2026-10-20) and from local measurements; MR-32 replaces them with 20 measured runs. Plan: [README.md](README.md) section 4. Tracker: [burndown.md](burndown.md), MR-30 to MR-34.

## Files

| File | What it is |
| --- | --- |
| `.github/workflows/ci.yml` | `pull_request`, `push` to `main`, `workflow_dispatch`. The one required check is the job `verify`. No `merge_group`, no `labeled` type. |
| `.github/workflows/nightly.yml` | `schedule` (02:17 UTC), `workflow_dispatch` and `workflow_call`. Windows, macOS, Node 22 and 26, packed-install, registry consumers, `pnpm audit`, platform residual, flake measurement (Sundays). Opens or updates the issue `nightly-red`. Called by `ci.yml` for the label `full-ci` and, from MR-40, by `npm-publish.yml` as the pre-release gate (`report: false`). |
| `.github/workflows/slow-checks.yml` | Tuesday 05:23 UTC, dispatch, or the label `slow-checks`. Full golden corpus with every slide kept, published matrix with the determinism grid, installed parity (the last two are ports of `published-matrix.yml` and `installed-parity.yml`). Issue `slow-checks-red` on a red schedule. |
| `.github/actions/setup-workspace/action.yml` | pnpm, Node 24, the pnpm store cache (`setup-node` `cache: pnpm`), `pnpm install --frozen-lockfile` of the whole workspace, optional build of one package's dependencies. In the Playwright container pnpm comes from the npm registry (the old per-repository logs show `pnpm/action-setup` taking 2.5 to 5 minutes there). |
| `scripts/ci-scope.mjs` | MR-14, extended: `legs` (the matrix of each package job per tier, `LEG_PLAN`). |
| `scripts/ci-verify.mjs` | The `verify` verdict: scope-selected jobs must succeed, skipped by scope is success, skipped otherwise is failure, an unreadable scope output fails. |
| `scripts/ci-report-issue.mjs` | Opens, updates or closes one issue per label with the workflow token (`gh api`); `--dry-run`. |
| `scripts/ci-test-shards.mjs` | `--package render\|pptx\|editor --script test\|test:contract --shard i/n`: runs shard i of the package's `test` chain in `packages/<id>` (weights in `ci-test-weights.json`, shard 1 carries 100 s of extra steps). The old `--sibling` mode stays until MR-34. |
| `scripts/quarantine.mjs`, `scripts/run-checks.mjs` | `--shard i/n` added (browser suites, root checks). |
| `scripts/ci-workflows.test.mjs` (`pnpm check:ci-workflows`) | Shape test of the three workflows and the action against the plan and against `ci-scope`. |

## Job graph of `ci.yml`

`scope` (no install, about 30 s) runs `ci-scope.mjs` and publishes `jobs` (tier per job) and `legs` (matrix per job). Every other job `needs: scope` and is gated on its own key of `jobs`; `verify` needs all of them and runs `always()`.

| Job | Runs when | Legs (full tier) | Contract tier (dependent of a changed package) | Where |
| --- | --- | --- | --- | --- |
| `lint` | always | `static` (Biome, typecheck, examples, breaking gate, changelog warning), `checks 1/2`, `checks 2/2` (the 73 root `check:*`) | same | ubuntu-24.04 |
| `gallery` | gallery changed | 1 (license, verify, build, test, typecheck, pack dry run) | 1 | ubuntu-24.04 |
| `core` | core or gallery changed | 1 (`pnpm --filter opf test`) | 1 | ubuntu-24.04 |
| `cli` | any package it depends on, or itself | 1 | 1 | ubuntu-24.04 |
| `render` | render or core or gallery | `tests 1..4/4`, `browser` | `tests 1..3/3` (`test:contract`) | Playwright image |
| `pptx` | pptx or an upstream package | `tests 1..4/4`, `browser` | `tests 1..4/4` | Playwright image |
| `editor` | editor or an upstream package | `tests 1..2/2`, `playground 1..4/4`, `browser` | `tests 1..2/2` | Playwright image |
| `integration` | any package | 1 (`packages/integration`) | 1 | ubuntu-24.04 |
| `goldens` | a golden input changed | 1 (`test:golden`, changed slides as artifact) | n/a | Playwright image |
| `gallery-gates` | gallery, core or render changed | 1 (`check:previews`; `check:stability` reports only until MR-35) | n/a | ubuntu-24.04 |
| `pack-shape` | any package changed | 1 (build all, `npm pack --dry-run` of the six) | n/a | ubuntu-24.04 |
| `slow` | label `full-ci` | the nightly set via `workflow_call` (`report: false`) | n/a | see nightly |
| `verify` | always | `scripts/ci-verify.mjs` | | ubuntu-24.04 |
| `report-main` | push to `main` | opens/closes the issue `main-red` | | ubuntu-24.04 |

What each class of change runs (from `ci-scope.mjs`, graph = the plan's target graph):

| Change | Jobs | Legs |
| --- | --- | --- |
| docs, evidence, programs only | `lint` | 3 |
| editor only | `lint`, `editor`, `integration`*, `pack-shape` | 3 + 7 + 1 + 1 |
| CLI only | `lint`, `cli`, `integration`*, `pack-shape` | 3 + 1 + 1 + 1 |
| render | `lint`, `render`, `pptx`*, `editor`*, `cli`*, `integration`*, `goldens`, `gallery-gates`, `pack-shape` | 3 + 5 + 4 + 2 + 1 + 1 + 1 + 1 + 1 |
| pptx | `lint`, `pptx`, `editor`*, `cli`*, `integration`*, `pack-shape` | 3 + 5 + 2 + 1 + 1 + 1 |
| core, `spec/`, `examples/` | `lint`, `core`, `render`*, `pptx`*, `editor`*, `cli`*, `integration`*, `goldens`, `gallery-gates`, `pack-shape` | 3 + 1 + 3 + 4 + 2 + 1 + 1 + 1 + 1 + 1 |
| gallery records | the core row plus `gallery` | +1 |
| `scripts/`, workflows, lockfile, `full-ci`, push to main, dispatch | everything at full | 3 + 1 + 1 + 1 + 5 + 5 + 7 + 1 + 1 + 1 + 1 (27 legs, 29 jobs with `scope` and `verify`) |

(`*` = contract tier.)

## Timing budget (estimate; MR-32 measures)

Fixed cost per job, from the old logs: container initialization 25 to 38 s; checkout of the 508 MiB tree about 30 s (blobless clone, full history, estimate); pnpm 5 to 10 s; `setup-node` with the store cache about 25 s; frozen install about 25 s (linking from the restored store; locally 1 s on a warm store); build of the dependencies about 30 s (core builds in 12 s locally). That is about 2.1 minutes on a host runner and 2.7 in the Playwright container. Work per leg on top of that:

| Leg | Work | Source | Total |
| --- | --- | --- | --- |
| lint `static` | build 0.5 + Biome 2 s + typecheck 8 s (local) + examples and breaking about 1 | local | 3.9 |
| lint `checks i/2` | build 0.5 + half of 58 s locally, about 1 min on 4 vCPU | local | 3.6 |
| gallery | build the renderer 0.7 + gates 1.5 (standalone gallery CI 30 to 40 s, S7) | S7 | 4.3 |
| core / cli | core test 31 s locally, CLI test 88 s locally, about 2x on CI | local | 3.5 / 4.6 |
| render tests | 250 s per shard of 4 (weights), 210 s per shard of 3 at contract tier | `ci-test-weights.json` | 6.9 / 6.2 |
| render browser | browser 118 + fonts 66 + gate and rich about 50 s | old CI log | 6.6 |
| pptx tests | 262 s per shard of 4 (full), 242 s (contract, 868 s total: its contract suite leaves out only 80 s) | weights | 7.1 / 6.7 |
| editor tests | 129 s per shard of 2 | weights | 4.9 |
| editor playground | 839 s in one job (old CI), 4 shards of about 210 s plus 30 s playground build | old CI log | 6.7 |
| integration | build all 1.0 + tests (core's 13 engine tests, **not measured**, assumed 3 to 5 min) | none | 6 to 8 |
| goldens / pack-shape / gallery-gates | `golden.mjs` takes 10 s; build all 1.5 + pack 0.5; previews and stability 1.5 | weights, S7 | 3.2 / 4.1 / 4.3 |

Wall-clock of `verify` is `scope` 0.5 + the longest leg + `verify` 0.4, plus queueing when a run needs more than 20 concurrent jobs (a forced run has 29, a render PR 21):

| Class | Longest leg | Estimate | Plan target p50 / p90 |
| --- | --- | --- | --- |
| docs only | lint 3.9 | about 4.8 | 2 / 4 (**missed**) |
| leaf (editor, CLI) | `integration` 6 to 8, editor playground 6.7 | 7.5 to 9 | 5 / 8 (**p50 missed**) |
| render or pptx | pptx tests 7.1, render tests 6.9, `integration` | 7.5 to 8.5 | 7 / 11 |
| core, gallery, `spec/`, `examples/` | pptx contract 6.7, render contract 6.2, `integration` | 7.5 to 8.5 | 8 / 12 |
| tooling, lockfile, `full-ci` | 29 jobs, queueing | 9 to 11 | 11 / 15 |

Read as: code pull requests land at the upper end of the plan's 5 to 8 minutes, a docs-only one at about 5. How the draft gets there: scoped jobs (a docs change runs one job family, an editor change no renderer shard), tiers (dependents run `test:contract`), sharding balanced by the RR-57 weights so the longest shard and not the sum sets the time (render 901 s, pptx 948 s and the editor playground suite are cut to about 4 minutes of work per shard), one cache of the pnpm store per OS keyed by the lockfile, `cancel-in-progress` per pull request, no Windows, macOS, Node 22 and 26 and no packed-install or registry consumers on the pull request, and one Playwright image string pinned by digest (`check:playwright-pin`) so a golden cannot drift between jobs. The remedies in the order the plan gives them, if MR-32 measures a miss: (1) build core and gallery once and upload `dist` (saves about 0.5 minute per job); (2) a sparse checkout without `docs/evidence` for the jobs that do not read it (core, `lint` and the CLI do; saves about 12 s); (3) narrow `integration` (it imports core, render, pptx and the gallery, not the editor or CLI) or shard it; (4) a docs-only fast path in `lint` that runs `check:changed`'s mapped checks. Measured locally on 2026-10-22 (laptop, warm store): install 1 s, `pnpm lint` 2 s, `pnpm build` 12 s, `pnpm typecheck` 8 s, core tests 31 s, CLI tests 88 s, root checks 58 s with four at a time.

## What the workflows assume from MR-23

The draft calls only names that exist in the imported tree or that the plan fixes; each one below must hold in the wired workspace, or the workflow changes with it.

1. `pnpm-workspace.yaml` lists `packages/gallery`, `javascript`, `cli`, `render`, `pptx`, `editor` and `integration`; the edges are the plan's (`workspace:^` runtime, `workspace:*` dev), so `pnpm --filter "<name>^..." run --if-present build` builds the dependencies (with no workspace dependency it matches nothing and succeeds). The whole workspace is installed in every job, so the lockfile must be complete.
2. `pnpm --filter @openpresentation/integration run test` exists and runs core's 13 engine tests (`test:ecosystem`, `test:pagination`, `test:layout`, `test:lists`, `test:rich-text`, `test:data`, `test:fonts`, `test:image-treatments`, `test:placeholder-groups`, `test:skills`, `demo:editor`, `build-rich-table-browser`).
3. Root scripts the nightly calls still exist and pack the six packages from the workspace: `pack:ecosystem`, `test:packed-ecosystem`, `test:packed-browser`, `test:cli:packed`, `test:cli:packed:peers`, `test:registry-ecosystem`, `test:registry-fidelity`, `test:layout-contracts:registry`, `test:developer-quickstart`, `demo:editor`, `check:examples`, `check:breaking`.
4. Package scripts the legs call: render `typecheck validate test test:contract test:code test:font-preparation test:font-variants test:golden test:variable-font-gate test:browser report:pdf-vector`; pptx `typecheck validate test test:contract test:code test:font-variants test:native-*-controls test:published-import`; editor `typecheck validate test test:contract`; gallery `check:license verify test typecheck pack:dry-run check:previews check:stability`. The scripts may call `npm run` or `pnpm run`; `ci-test-shards.mjs` shards either.
5. The sibling `scripts/` copies are gone or identical: the legs use the root `scripts/quarantine.mjs` (with `--shard`) and run it in the package directory (`node ../../scripts/quarantine.mjs ...`), and each package keeps `test/quarantine.json` and `test/browser-suites.json`.
6. The variable-font gate reads `../archive/...` relative to `packages/render`; the draft checks the archived renderer checkpoint out of the old (public, permanent) repository into `packages/archive`. MR-23 can vendor those fixtures and drop the step.
7. `test/golden.mjs` is part of the renderer's `test` (10 s) and so also of `test:contract`; the `goldens` job repeats it to name the failure and keep the changed slides. MR-31 may exclude it from the shards.
8. `release-plan.json` stays until MR-34 for `slow-checks.yml` (the published-matrix scripts read it).

## MR-34, MR-23 and MR-40: what is deleted

The files of the four imported packages' `.github/` (14 workflows and `packages/gallery/.github/bootstrap-engines.json`) are **inert**: GitHub reads only the repository root `.github/workflows`, so they cannot double-run. The plan deletes them in the MR-23 cleanup commit (README section 2, last row); MR-34 takes over whatever MR-23 leaves. No workflow is deleted in this pull request.

| Workflow | Replaced by | Deleted in | Runs next to the new ones until then |
| --- | --- | --- | --- |
| `opf-ci.yml` | `ci.yml` | MR-33 | yes (the required checks of the merge queue) |
| `ecosystem-ci.yml` | `ci.yml` (contract tiers), `nightly.yml` | MR-33 | yes |
| `cli-windows.yml` | `nightly.yml` `cli-portability` | MR-33 | yes |
| `engines-range.yml` | `nightly.yml` `node-range` | MR-33 | yes |
| `flake-repeat.yml` | `nightly.yml` `flake` | MR-33 | yes, nightly 03:23 UTC next to the Sunday flake job |
| `published-matrix.yml` | `slow-checks.yml` `published-matrix` | MR-34 | yes, Monday 05:23 (new one Tuesday) |
| `installed-parity.yml` | `slow-checks.yml` `installed-parity` | MR-34 | yes, Monday 05:41 |
| `ecosystem-roll.yml` | none (lock and roller removed) | MR-34 | yes |
| `candidate-gallery-qualification.yml` | none | MR-34 | only when called |
| `published-gallery-control.yml` | none | MR-34 | only when called |
| `regenerate-core-golden.yml` | `golden.yml` | MR-31 | on label |
| `release-train.yml`, `cli-publish.yml`, `npm-publish.yml` (old) | one `npm-publish.yml` (same file name) | MR-40 | yes |
| `tracker-refresh.yml` | stays | | |

Actions: `.github/actions/candidate-gallery` and `candidate-gallery-stage` (MR-34), `paths-changed` (MR-33, its only users are `cli-windows.yml`, `published-matrix.yml`, `installed-parity.yml`), `ecosystem-refs` (frozen shim, MR-60). Imported, inert, removed by MR-23 (or MR-34): `packages/render/.github/workflows/{ci,flake-repeat,npm-publish,platform-residual,regenerate-candidate-goldens,regenerate-goldens}.yml`, `packages/pptx/.github/workflows/{ci,flake-repeat,release}.yml`, `packages/editor/.github/workflows/{ci,flake-repeat,release}.yml`, `packages/gallery/.github/workflows/{ci,gallery-publish}.yml`, `packages/gallery/.github/bootstrap-engines.json`. The tests that read them (`candidate-gallery-ci`, `publish-source`, `publish-workflow-trust`, render's `candidate-goldens` and `golden-pinned-image`) go with them (README finding 6). `scripts/ci-diet.test.mjs` and the `checks.json` rules that name the old workflows are deleted or re-keyed in MR-33.

## Ordering with the ruleset (MR-33, OWNER)

`ci.yml` has no `merge_group` trigger. While the merge queue exists its required checks are the old ones, so `verify` must not become required before the queue is removed; the ruleset edit that removes the queue and makes `verify` the only required check is one change. The first nightly and slow-checks runs need the labels `nightly-red`, `slow-checks-red`, `main-red` (created by the first issue, or by hand) and `slow-checks`, `full-ci` for pull requests.
