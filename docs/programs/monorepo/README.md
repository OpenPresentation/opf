# Program: monorepo (MR)

Status: **approved 2026-10-20 by the owner, with decisions D1 to D12 as recommended. Work starts after the 0.25.0 train is published and verified; nothing has been moved yet.** Planned start: after the 0.25.0 train is published and verified. Tracker: `burndown.md` (to be created in MR-02; this README carries the item IDs until then).

This is the single source of truth for moving `@openpresentation/opf` (core), `@openpresentation/cli`, `@openpresentation/opf-render`, `@openpresentation/opf-pptx` and `@openpresentation/opf-editor` into one repository, `OpenPresentation/opf`. Agents and people resuming work start here, not from chat history. Owner request, 2026-10-20: "write the phased monorepo plan for core, CLI, renderer, PPTX and editor, to start after the 0.25.0 train. Don't move anything until I approve the plan."

## What this plan found that changes the shape of the work

Everything below was read on 2026-10-20 from `origin/main` of each repo and from the GitHub API (read-only). The local sibling checkouts are stale (opf-render 10 to 23 commits behind and still at 0.20.4, opf-pptx 18 behind, opf-editor 10 behind), so no number here comes from them.

1. **The renderer's goldens are not the size problem.** `packages`-style golden baselines in opf-render are SHA-256 hash manifests (`test/golden/**/*.sha256.json`, 2,843 small JSON files, 8.5 MiB checked out, about 1.9 MiB in packed history). The PNGs are regenerated in the pinned Playwright image at test time. The history weight of opf-render (59.9 MiB on main) is `docs/evidence` (46.3 MiB, including 359 PNGs and two 2.3 MiB `.tgz` snapshots), vendored fonts (11.7 MiB) and fixtures (4.7 MiB). The largest blob in any of the four histories is 6.8 MiB (a core evidence PNG). **LFS is not needed**; GitHub's limit is 100 MiB per blob.
2. **There is a dependency cycle in the package graph.** Core (`packages/javascript`) declares optional `peerDependencies` on opf-render and opf-pptx and exact-pinned `devDependencies` on both (0.24.1, 0.24.0), while opf-render, opf-pptx and opf-editor depend on core. Today the registry breaks the cycle. With `workspace:` links it becomes a real cycle, which makes `pnpm --filter "...[origin/main]"` select everything for every change. The plan keeps core's pins on registry versions (see section 1) and cuts the cycle for good only as an optional last step.
3. **The three siblings use npm and `package-lock.json`; core uses pnpm 10.33.2.** The siblings also pin npm 11.16.0 in CI because npm 10 re-resolves optional peers. Moving them into the pnpm workspace is real work (phantom dependencies, about 45 `@expo-google-fonts/*` pins, lockfile fidelity), so it gets a spike in MR-03.
4. **`dist/` is committed in all three siblings** (59, 64 and 137 tracked files; render's `scripts/build.mjs` copies `src/` into `dist/`). In one repo this makes every source edit a two-place edit. The plan does not change it during migration; it is an owner decision.
5. **Only core has a ruleset and a merge queue** (ruleset 24382980: required `packages`, `Installed candidates (windows-latest)`, `Installed candidates (macos-latest)`, `Verify OPF packages`; merge queue method **SQUASH**, 4 entries). The siblings have no ruleset. A squash-method queue would flatten an imported history, so the import needs a temporary owner action (MR-22).
6. **RR-100 is not landed.** The `codex/rr-100-release-speed` branches of all four repos currently point at `origin/main` with no commits. The only work is uncommitted in core's worktree: `scripts/ci-evidence.mjs`, `scripts/ci-evidence.json`, `scripts/release-prep.mjs`, and edits to `scripts/release-train.mjs` and its test. It makes publish and tag trust the green CI of the exact commit (`ci-evidence.mjs`) and gives the merge queue a release-prep fast path (`release-prep.mjs`, diff-classified, fail closed). This plan reuses both unchanged in intent; see MR-01.
7. **Tags need no renaming.** All 221 tags (75 in core including 29 `cli-v*`, plus `js/v0.2.1` and `go/v0.1.0`; 51 `opf-render-v*`; 53 `opf-pptx-v*` including one legacy `@openpresentation/opf-pptx@v0.8.1`; 42 `opf-editor-v*`) are already prefixed and unique, and all are reachable from `main`.
8. **Squash-merge subjects end in `(#NNN)`.** 203 of opf-render's 257 first-parent subjects do. Imported as is, GitHub would link them to the wrong repo's PR number and closing keywords could touch core issues. The import rewrites every bare `#N` to `OpenPresentation/<old-repo>#N`.
9. **A monorepo checkout is about 507 MiB** (tracked, uncompressed: core 392 MiB of which `docs/` is 374 MiB, opf-render 88, opf-pptx 21, opf-editor 5.5) before `node_modules`. Agents use one worktree per task, so the plan ships a sparse worktree helper.
10. **`release-plan.json` on core `main` is stale** (0.20.x); a 0.24 refresh is in flight on `codex/rr-97-release-plan-024`. This plan starts after that and the 0.25.0 train.
11. `git filter-repo` is not installed on this machine. Whoever runs the import installs it (or runs it in a scratch container).

## Goal

> One repository, one CI, one release run for core, CLI, renderer, PPTX exporter and editor, with the same npm package names and the same public APIs, so that consumers see no change.

What it removes: the ecosystem lock and roller (13 lock-roll PRs this week), `Depends-On` resolution (4 to 5 linked PRs per feature, for example FA-33 today: opf#756, opf-render#278, opf-pptx#300, opf-editor#195), `opf.requiresUnreleasedCore` (RR-55), golden overrides, sibling registry gates, and the release ordering that caused 3 failed publishes this week and a 5 to 6 hour train.

Staying separate, by decision: `OpenPresentation/gallery` (`@openpresentation/gallery`, own version line) and the three sites (Data-Advantage/openpresentation-site, pptx-gallery, pptx-dev).

## Definition of done

1. `OpenPresentation/opf` contains `packages/javascript`, `packages/cli`, `packages/render`, `packages/pptx`, `packages/editor` as one pnpm workspace, with the full imported history of the three sibling repos (tree hashes at every tag identical to the originals, blame intact, tags preserved).
2. A change that touches several packages is **one pull request**, tested in one CI run, merged by one queue. No `Depends-On` line, lock-roll PR, golden override, `requiresUnreleasedCore` field or sibling registry gate exists any more.
3. One release workflow (`npm-publish.yml`, triggered by one train tag) versions, publishes and verifies all five packages in dependency order with npm trusted publishing and provenance. Two consecutive trains have published this way, and the measured train time meets the target in section 5.
4. CI targets in section 4 are met on at least 20 measured runs, with no loss of coverage: Node 22/24/26, Windows, macOS, the pinned Playwright image, the exact golden hashes.
5. Public contracts unchanged: package names, `exports`, versions continue the existing lines, install docs, `npm view` metadata other than `repository`, `bugs` and `homepage`.
6. The three old repos are archived read-only with a README pointer, issues transferred, open PRs ported or closed, and sites and docs link to the new locations.
7. The legacy shim (the frozen `ecosystem-refs` action and lock) and the GitHub App secrets are removed, and `docs/release-process.md`, `docs/ecosystem-development.md`, `AGENTS.md` and `CONTRIBUTING.md` describe the monorepo only.

## Invariants

- **Nothing moves before the owner approves this plan.** After approval, work proceeds only by the phases below; OWNER actions are the owner's.
- **Consumers see no change**: package names, entry points and version lines are untouched. Migration PRs change no package behavior. The only manifest edits allowed are `repository`/`bugs`/`homepage`, workspace-protocol dependencies and the pnpm conversion of scripts.
- **`main` of `OpenPresentation/opf` is releasable after every phase.** Every publish goes through npm trusted publishing (GitHub Actions OIDC) with `--provenance`. No `NPM_TOKEN`, no local publish, no publish from an unmerged branch. A publish step stays inside the top-level `npm-publish.yml` (npm matches the calling workflow's filename; do not move it into a `workflow_call` workflow).
- **The old repos stay able to publish until the release cutover (MR-43)** and stay public and un-renamed forever. They are never deleted or renamed. Tags are never moved or re-pushed.
- **History is merged, never squashed.** The import is done with `git filter-repo` path rewriting into scratch clones; the owner's checkouts under `/Users/michael/Source/` are never used for it.
- **Goldens stay exact.** No tolerance changes. Golden files move byte for byte (verified by hash); no baseline is regenerated in a migration PR; regeneration stays a workflow in the pinned Playwright image.
- **Coverage never drops**: the Node 22/24/26, Windows, macOS and pinned-image legs are kept or improved. Scoping fails closed: any path or case the scope script cannot classify runs everything.
- **No paid runners.** Standard GitHub-hosted runners only (free for public repositories), within the free-plan concurrency of 20 concurrent jobs and 5 macOS jobs.
- **Reuse RR-100** (`ci-evidence.mjs`, `release-prep.mjs`); do not redo it.
- **Gallery and sites stay separate.** No site code or secret enters the monorepo. Agents never deploy, log in or change DNS (cloudflare-hosting program invariant).
- Agents work in git worktrees from fresh `origin/main`, never force-push `main`, and keep source, packed and registry claims separate.
- Measured numbers in this file are dated; re-measure before relying on them.

## Owner decisions needed

Recommendations first. Each is also a row in section 9 where it carries risk.

| # | Decision | Recommendation |
| --- | --- | --- |
| D1 | Approve the plan and the start (after 0.25.0 is verified, `changes/` empty in all four repos). | Approve. |
| D2 | Keep `packages/javascript` or rename to `packages/core`. | Keep. The rename touches 132 files / 273 references outside historical docs (108 of them in `.github`, `scripts`, `package.json`); do it last, optionally (MR-61). |
| D3 | Move the three siblings from npm to pnpm. | Yes, subject to the MR-03 lockfile-fidelity spike. A mixed npm/pnpm workspace cannot share a graph. |
| D4 | Keep committing `dist/` in the siblings. | Keep through migration; consider untracking afterwards (MR-61). |
| D5 | Import full sibling history including `docs/evidence` binaries (about 80 MiB packed), or strip evidence PNG/`.tgz` from history (saves about 40 MiB). | Import everything. It is cheap, keeps blame and evidence links, and the old repos stay public anyway. |
| D6 | Release trigger. | A pushed train tag `train-v<label>`; `workflow_dispatch` only as a retry on that tag. |
| D7 | Publish workflow filename and a GitHub environment. | `npm-publish.yml` (core's trusted publisher stays valid; see section 5). Optional environment `npm-publish`, no required reviewers while agent publishing stays authorized (2026-09-29). |
| D8 | Merge-queue settings. | Keep SQUASH. Lower `max_entries_to_build` from 4 to 2 once the queue run has about 14 jobs (free-plan concurrency is 20). |
| D9 | When to archive the old repos. | After at least 2 stable monorepo trains and 14 days (MR-53). |
| D10 | Open issues. | Transfer them with `gh issue transfer`, then relabel (MR-51). |
| D11 | Positioning wording (section 9, risk 1). | Approve the wording in MR-50. |
| D12 | Floors: `workspace:^` for runtime `dependencies` between packages (published floor = version in the train); peer ranges stay hand-managed and explicit as today. | Yes. |

## 1. Target layout

```
opf/                                  (OpenPresentation/opf, history preserved, default branch main)
  packages/
    javascript/   @openpresentation/opf          (kept name; was packages/javascript)
    cli/          @openpresentation/cli
    render/       @openpresentation/opf-render   (src/ test/ fonts/ docs/ scripts/ dist/ changes -> root)
    pptx/         @openpresentation/opf-pptx     (src/ test/ vendor/pptxgenjs/ docs/ scripts/ dist/)
    editor/       @openpresentation/opf-editor   (src/ test/ examples/ docs/ scripts/ dist/)
    gallery/      generated from @openpresentation/gallery, gitignored (unchanged)
  spec/  skills/  examples/  docs/  legacy/       (core owns these, unchanged)
  changes/        one fragment dir for all packages (front matter names the package)
  scripts/        shared tooling (see below)
  .github/        workflows, actions, CODEOWNERS, issue templates, ONE dependabot.yml
  pnpm-workspace.yaml  pnpm-lock.yaml  package.json  biome.json  .nvmrc  .npmrc  .gitattributes  .mailmap
  docs/programs/monorepo/   this program (+ commit-map/ and import-verification.md)
```

- **Workspace.** `pnpm-workspace.yaml` today is `packages: ["packages/*"]`. MR-10 narrows it to an explicit list (`packages/javascript`, `packages/cli`) so imported directories are inert in MR-22; MR-23 widens it to the five. `packageManager` stays `pnpm@10.33.2`. `.npmrc`: `link-workspace-packages=false` (only explicit `workspace:` links), engine-strict off.
- **Shared versions through pnpm catalogs.** One `catalog:` entry each for the dev dependencies the siblings already pin identically: `playwright` (must equal the Playwright image tag), `@expo-google-fonts/*`, `sharp`, `@resvg/resvg-js`, `pdf-lib`, `pdfjs-dist`, `esbuild`, `axe-core`, `@openpresentation/gallery` (the siblings' manifests at an old checkout say `^3.0.0`, core says `^4.0.0`; reconcile to what each package's tests need and record it). Today a Playwright bump is three Dependabot PRs plus an image digest edit (render#270, pptx#294, editor#187 are open now); after this it is one catalog bump plus a root check, `check:playwright-pin`, that every `mcr.microsoft.com/playwright:vX.Y.Z-noble@sha256:...` in `.github/workflows` equals the catalog version.
- **Dependencies inside the workspace.** Runtime `dependencies` on core: `workspace:^` (published floor becomes the version in the train, which also enforces the existing "geometry-moving core releases raise every sibling floor" rule). `devDependencies` between packages: `workspace:*`. `peerDependencies` stay explicit hand-managed ranges (the compatibility contract; the RR-62 CLI peer-contract rules continue); a root check `check:peer-ranges` asserts each workspace peer range is satisfied by the workspace version, and `check:workspace-graph` asserts every workspace peer is also a workspace dev dependency (pnpm's filter graph ignores peers). **Core's exact devDependency pins on opf-render and opf-pptx stay registry pins** (not `workspace:`), so the workspace graph is acyclic: opf, then render, then pptx, then editor, with cli depending on all. Core's Node-API tests keep running against the published peers exactly as today; the in-repo coverage of core against the source engines is `test:packed-ecosystem` and the ecosystem checks. Core's pins are bumped once per train by the train follow-up PR (replaces the lock roller). MR-61 can move the 13 affected core tests into a private `packages/integration` and delete the pins.
- **Shared tooling.** Core's `scripts/` is the base. The siblings carry near-copies of `changelog-fragments.mjs`, `quarantine.mjs`, `run-tests.mjs`, `publish-source.mjs`, `flake-repeat.mjs` (all three), and `check-font-hotlinks.mjs` (render, editor). MR-12 diffs each copy, keeps core's as base, ports sibling-only behavior behind flags, merges the tests, and makes them take the package directory from `cwd` (the CLI already calls `node ../../scripts/run-tests.mjs`). Package-specific scripts stay in `packages/<x>/scripts/` (render: `build.mjs`, `update-font-manifest.mjs`, `golden-promote.mjs`, `soak.mjs`, `variable-font-gate.mjs`; pptx: `vendor-pptxgenjs.mjs`, `verify-vendor.mjs`, `keynote-qualification/`, `rr07-native-set.mjs`; editor: `build-playground.mjs`, `build-styles.mjs`).
- **Goldens.** One home: `packages/render/test/golden/` (baseline directories, one file per deck since RR-52, `golden-store.mjs` unchanged). The coordinated renderer baseline that core's `scripts/fixtures/opf-examples-png.*.sha256.json` carries today (17 files, selected by the lock's `golden` field or an opf-render `golden-override`) is reconciled in MR-31: the in-repo `examples/` corpus is the input, the baseline whose content equals the current locked golden becomes the default in `packages/render/test/golden/`, and `scripts/fixtures` keeps only fixtures that a retained test reads (`registry-golden.mjs`, `registry-fidelity-archive.mjs`). Moves are byte-identical (hash-checked); no baseline is regenerated.
- **Fixtures and examples.** `examples/` (126 decks, 8 MiB) stays at the root, owned by core and bundled into `@openpresentation/opf`. Package fixtures stay under `packages/<x>/test/fixtures`. Root tooling fixtures stay in `scripts/fixtures`. Sibling `docs/evidence` goes to `packages/<x>/docs/evidence` (no link rewriting); sparse worktrees exclude it (below).
- **Node and npm.** `.nvmrc` 24. Every package keeps the open-ended `engines.node` `>=22` (never a closed range); `check:engines-range` is extended to all five manifests. CI default Node 24; Node 22 and 26 in the `node-range` job (queue, nightly, `full-ci` label). Release job pins npm 11.16.0 as today.
- **Lint.** Biome (core only today) is scoped by `files.includes` to core, CLI and root scripts; the imported packages join per package later, each in its own PR whose commit goes into `.git-blame-ignore-revs`.
- **Agent worktrees.** `scripts/agent-worktree.mjs` (MR-16): treeless-friendly `git worktree add` plus a sparse-checkout profile that excludes `docs/evidence/**` and `packages/*/docs/evidence/**` by default (a worktree falls from about 507 MiB to about 110 MiB tracked), and a single shared pnpm `store-dir` so worktrees hard-link instead of copying. Confirm the store location in MR-16 (core currently ignores a `.pnpm-store` inside the checkout). `pnpm check:changed` and `scripts/agent-slot.mjs` extend from two packages to five; the Windows short-path advice in `AGENTS.md` stays (pnpm's nested `node_modules` is deeper).

## 2. What gets deleted, and what stays

File names below were read on core `main` e6ade17b and sibling `origin/main` on 2026-10-20. Each deletion PR must carry `git grep` evidence that nothing live reads the file. "Frozen shim" items are kept, unchanged, until the old repos are archived, because the old repos' own CI calls `OpenPresentation/opf/.github/actions/ecosystem-refs@main` and `published-gallery-control.yml@<sha>` and the emergency fallback (a hotfix release from an old repo) needs them.

### Cross-repo machinery (core)

| Mechanism | Deleted files and parts | When |
| --- | --- | --- |
| Ecosystem lock and roller | `ecosystem.lock.json`, `scripts/ecosystem-lock.schema.json`, `scripts/ecosystem-roll.mjs` (+ test), `.github/workflows/ecosystem-roll.yml` (dispatch-only), the `guard` mode and `ECOSYSTEM_LOCK_GUARD` variable, `scripts/ecosystem-lock.mjs` (+ test) | Roller, guard and workflow in MR-34. `ecosystem.lock.json`, `ecosystem-lock.mjs resolve` and the action are a frozen shim until MR-60. |
| `Depends-On` resolution | `.github/actions/ecosystem-refs/action.yml` (the only reader), the `Depends-On` rules in `docs/ecosystem-development.md`, the line in `.github/PULL_REQUEST_TEMPLATE.md` (check), the `pr-gate.mjs`/`pr-gate.test.mjs` mentions (check) | Doc and template in MR-50; action in MR-60. |
| `opf.requiresUnreleasedCore` (RR-55) | `scripts/unreleased-gate.mjs` (+ test), `scripts/registry-sibling-gate.mjs` (+ test), `scripts/published-core-gate.mjs` in each sibling (not imported), the "Gate the published-dependency check" steps and `--forbid` publish steps, `unreleasedCoreOf`/`removeUnreleasedCoreText`/`REMOVALS` in `release-train.mjs`, the `plan` flag. No manifest at `origin/main` sets the field today. The CLI's render/export tests that import `unreleased-gate.mjs` (`packages/cli/test/files.mjs`, `packed-files.mjs`) switch to workspace tarballs. | MR-34 (tests), MR-40 (`release-train.mjs`). |
| Golden overrides | the `golden` field and `golden-override` input of the action, `OPF_GOLDEN_BASELINE` selection from the lock, opf-render's `candidate-selection` job, `scripts/core-golden.mjs` (+ test), `.github/workflows/regenerate-core-golden.yml` (382 lines), opf-render `regenerate-goldens.yml`/`regenerate-candidate-goldens.yml` (folded into one `golden.yml`), the 17 `scripts/fixtures/opf-examples-png.*.sha256.json` that no retained test reads, the "Regenerating core's golden fixture" and "ecosystem lock" sections of `docs/ecosystem-development.md` | MR-31. |
| Sibling link/loader plumbing | `scripts/link-ecosystem.mjs` shrinks to a site linker (keeps the `pptx-gallery` branch); `scripts/register-local-opf.mjs`, `scripts/local-opf-loader.mjs` (the `--import` shim used by about a dozen `test:*` scripts; workspace resolution replaces it), `scripts/test-ecosystem-links.mjs` (run by `check:archive-tar`), `scripts/stub-peers.mjs`, `scripts/isolated-core.mjs` (confirm each by grep; `check-one-core.mjs` stays and runs against the pnpm graph) | MR-34. |
| Coordinated-CI plumbing | `.github/workflows/ecosystem-ci.yml` (876 lines), `scripts/ecosystem-scope.mjs` (+ test; its docs-only rule is kept inside `ci-scope.mjs`), `scripts/package-ecosystem-plan.mjs` (+ test), `scripts/test-package-ecosystem.mjs`, the `candidate-selection`/`published-control` jobs in the sibling workflows (not imported). `scripts/ci-test-shards.mjs` stays. | MR-33. |
| Cross-repo release | in `release-train.mjs` (1,319 lines; test 1,318): `pruneEcosystemLockEntries`, `floorChanges`, `raiseRange`, the floor part of `editManifestText`, `editPeersText`, `lockstepOrder`, `upstreamTargets`, `missingUpstream`, `unpublishedFloors`, `tagCommit`, `releaseCommit`, `openPrepPull`, per-repo `requiredChecks`, `publishRun`, the multi-repo `runTrain`, `callerToken`; `.github/workflows/release-train.yml` execute mode behind the GitHub App (`ECOSYSTEM_APP_ID` variable, `ECOSYSTEM_APP_PRIVATE_KEY` secret, opf#298); `cli-publish.yml` and the per-package `npm-publish.yml` (replaced by one workflow); the sibling `npm-publish.yml`/`release.yml`; `release-plan.json` `verificationRefs` (six SHAs become one) and per-repo `exampleRefs`; the "Release train (scripted, RR-51)", "coordinated release order" and `requiresUnreleasedCore` prose of `docs/release-process.md` | MR-40; App and secrets removed in MR-60 (OWNER). |
| Sibling-only files not imported (deleted in the import's cleanup commit) | `.github/**` of each sibling (render: `ci.yml`, `flake-repeat.yml`, `npm-publish.yml`, `platform-residual.yml`, `regenerate-candidate-goldens.yml`, `regenerate-goldens.yml`, `dependabot.yml`; pptx: `ci.yml`, `flake-repeat.yml`, `release.yml`, `dependabot.yml`; editor: `ci.yml`, `flake-repeat.yml`, `release.yml`, `dependabot.yml`), `package-lock.json` and `.nvmrc` (x3), the duplicated scripts listed in section 1, render `scripts/ecosystem-pins.mjs` and `scripts/golden-ci-notify.mjs` (read both before deleting: names suggest cross-repo pins and notifications), root `SECURITY.md`/`CONTRIBUTING.md` duplicates folded into the root files. Keep each package's `LICENSE` (npm `files` ships it). | MR-23. |

Size of the removal: about 1,850 lines of workflow YAML and about 1,600 lines of cross-repo scripts, plus their tests, plus the sibling pipelines (about 11 more workflow files).

### What stays, because gallery and sites remain separate

- `@openpresentation/gallery` as an npm dependency (`^4.0.0`), the postinstall `scripts/materialize-gallery-catalog.mjs`, `sync-gallery-catalog.mjs` (`sync:catalog --gallery ../pptx-gallery`), `check:catalog`, `check:catalog-free`.
- The candidate-gallery lanes (`scripts/candidate-gallery*.mjs`, `.github/actions/candidate-gallery`, `candidate-gallery-stage`, `candidate-gallery-qualification.yml`, `published-gallery-control.yml`): rewritten to build the five packages from the workspace instead of four checkouts, but kept, because a gallery major still has to be qualified against the engines before it is published.
- `INDEPENDENT_PACKAGES` (gallery: repo `gallery`, tag prefix `v`, `gallery-publish.yml`) in `release-train.mjs` and `independentPackages` in `release-plan.json`.
- The registry-facing checks, because the sites consume published npm versions: `release-plan.json` (shrunk), `test:registry-ecosystem`, `test:registry-fidelity`, `test:developer-quickstart`, `published-matrix.yml`, `installed-parity.yml`, `prepare:gallery:registry`, `build:showcase:registry`, `build-registry-gallery-editor.mjs`, `test-agent-site.mjs`, `gallery-*` font scripts, `docs/compatibility-matrix.md`.
- `scripts/link-ecosystem.mjs`'s `pptx-gallery` branch and the `OPF_LOCAL_WORKSPACE=1` flow (a site links the workspace packages for local development).
- `Depends-On` as a human convention in PR bodies for gallery or site PRs; no automation reads it.
- Dependabot, workflows, secrets and deploy of the three sites; the cloudflare-hosting program.

## 3. History import

**Method: `git filter-repo --to-subdirectory-filter packages/<x>` on fresh clones, then an unrelated-histories merge into `opf`.** Core is not rewritten: its SHAs, tags and PR references are untouched.

```sh
# Scratch directory only (never the owner's checkouts). pip install git-filter-repo first.
for pkg in render pptx editor; do
  git clone --no-local --single-branch --branch main \
      https://github.com/OpenPresentation/opf-$pkg.git work/opf-$pkg   # tags reachable from main come along (all of them)
  ( cd work/opf-$pkg
    git filter-repo --to-subdirectory-filter packages/$pkg \
        --message-callback "import re; return re.sub(rb'(?<![\w/])#(\d+)\b', rb'OpenPresentation/opf-$pkg#\1', message)"
    cp .git/filter-repo/commit-map ../commit-map.opf-$pkg.txt )
done
# In a scratch clone of opf on branch monorepo/import:
for pkg in render pptx editor; do
  git remote add import-$pkg ../work/opf-$pkg
  git fetch import-$pkg main --tags          # tag names are already prefixed and unique: no --tag-rename
  git merge --allow-unrelated-histories --no-ff import-$pkg/main \
      -m "MR-22: import opf-$pkg history under packages/$pkg"
done
```

- **Why filter-repo over subtree.** With paths rewritten, every historical commit carries `packages/<x>/...` paths, so `git log -- packages/render/src/svg.js` and `git blame` work without `--follow` or `-M -C`. `git subtree add` keeps the original SHAs (a real advantage: `repo@sha` links in docs keep resolving) but leaves history at the old paths. This plan takes path correctness and keeps the old repos public so old SHAs resolve there; `commit-map/<pkg>.txt` (old SHA to new SHA, about 200 to 300 lines each) is committed under `docs/programs/monorepo/commit-map/`. Fallback if filter-repo proves unusable: subtree-style `git merge -s ours` plus `git read-tree --prefix=packages/<x>/`.
- **Deterministic and re-syncable.** filter-repo output is deterministic for the same input, arguments and tool version, so re-running the import after the old repo gained a commit and merging again brings only the new commits. That is the delta procedure for the freeze window (section 6).
- **Commits and sizes.** 280 (render), 315 (pptx), 207 (editor) commits on main; core has 905. About 1,700 commits in total, interleaved by date in `git log`; `git log --first-parent` shows three import merges. Pack size of main-only history today: core 95.9 MiB, render 59.9, pptx 15.7, editor 4.5; expected monorepo about 175 to 185 MiB packed (GitHub reports 102.9 + 65.3 + 12.0 + 3.4 MB across all branches today). Checkout is about 507 MiB tracked.
- **LFS: no.** Largest blob in any history is 6.8 MiB; goldens are 2,843 small JSON hash files in opf-render (about 1.9 MiB of packed history for all of them). Adding LFS would add a dependency to every CI job, worktree and Windows checkout for no gain. Revisit only if a binary above about 50 MiB is ever proposed. Mitigations for clone cost instead: `fetch-depth: 1` in CI (only the release gate and `publish-source.mjs` fetch history), treeless clones (`--filter=blob:none`) for agents, sparse worktrees without `docs/evidence`.
- **Preserve blame.** Package contents are never edited in the import merges. Later mass edits (Biome adoption, pnpm script conversion in a separate commit) are recorded in `.git-blame-ignore-revs`. Three author identities for one person exist in every repo (`michaeljgrimm@gmail.com`, `michael@buildadataadvantage.com`, `michael@Michaels-Mac-mini.local`); add a root `.mailmap` instead of rewriting authors.
- **Tags.** Keep names and annotations: `opf-render-v*`, `opf-pptx-v*`, `opf-editor-v*` (and the legacy `@openpresentation/opf-pptx@v0.8.1`). They point at rewritten commits whose `packages/<x>` tree hash equals the original tag's tree hash. npm `gitHead` and provenance of already-published versions keep naming the old SHAs and repos, which stay public and valid. GitHub Releases do not follow tags across repos: the historical Releases (0.18 onward) remain in the archived repos; backfilling them in the monorepo is optional (MR-61).
- **Verification (`scripts/verify-import.mjs`, results in `docs/programs/monorepo/import-verification.md`).** (1) For `main` and for each of the 146 sibling tags: `git rev-parse <new>:packages/<x>` equals the old `<old>^{tree}` (tree-hash equality is exact). (2) Commit counts equal. (3) No bare `#N` remains in imported messages (so no closing keyword can touch core issues). (4) Blame sampled on 50 files per package: `git blame -w` line-to-author mapping equals the old repo's. (5) No imported path outside `packages/<x>/`. (6) Core's existing tags and `main` history are unchanged (`git merge-base --is-ancestor` of old core `main`). (7) A re-run of the import on the same inputs yields identical SHAs.
- **Merge method.** Core's merge queue squashes (`merge_method: SQUASH`), which would flatten the import. MR-22 is an OWNER action: temporarily set the queue's merge method to MERGE (or bypass the ruleset for the import merge), merge the import branch as a merge commit, and restore SQUASH immediately. Core's ruleset has no linear-history rule (only required checks and the queue).

## 4. CI

**Shape: one `ci.yml` (pull_request, merge_group, workflow_dispatch) and one `nightly.yml` (schedule, dispatch), plus single-purpose workflows** (`npm-publish.yml`, `release-train.yml`, `golden.yml`, `tracker-refresh.yml`, `published-matrix.yml`, `installed-parity.yml`, the two gallery lanes). That is about 10 workflow files in place of 27 today. One workflow means one set of required-check names and one aggregator job.

**Scope and affected detection.** A first job `scope` (ubuntu-24.04, about 30 seconds, no install) runs `scripts/ci-scope.mjs`:

1. Builds the package graph from the five manifests (`dependencies`, `devDependencies`, `optionalDependencies` with `workspace:` specifiers; the same set pnpm's `--filter "...[origin/main]"` uses; a unit test cross-checks the two).
2. Maps changed paths to packages: `packages/<x>/**` to that package; `spec/**`, `examples/**`, `skills/**`, and the `docs/**` files the core build embeds (confirm against the generators of `packages/javascript/scripts/generate*.mjs`) to core; `scripts/**`, `.github/**`, `pnpm-lock.yaml`, `pnpm-workspace.yaml`, `package.json`, `biome.json`, `.nvmrc`, `.gitattributes` to **all**; `docs/programs/**` and `docs/evidence/**` (except `*.opf.json`) to **none** (the existing `ecosystem-scope.mjs` rule, kept); anything unclassified to **all**.
3. `changed` = packages with changed files, `affected` = changed plus transitive dependents. **Tier**: changed packages run `full`; dependents-only run their `test:contract` suite on a pull request (RR-53's `test/suites.json` `contractExclude` mechanism carries over) and `full` on `merge_group`, `schedule` and `workflow_dispatch`. A pull request that changes `scripts/**`, the lockfile or a `full-ci`/`ecosystem-full` label runs `full`. The queue diff is taken against `merge_group.base_sha`; the composite action `paths-changed` (kept) answers path questions for legs that a `paths:` filter cannot scope on `merge_group`.
4. Emits a JSON matrix. A final job named `Verify OPF packages` (the existing required check) succeeds only if every job the scope selected succeeded; skipped-by-scope is success, skipped-otherwise is failure.

**Jobs and how each of today's suites maps**

| Today | In `ci.yml` | Runs on |
| --- | --- | --- |
| core `opf-ci.yml` "normal" job: audit, Biome, typecheck, build, `pnpm test`, examples, breaking check, pack dry run, packed smoke, CLI packed, CLI peers, quickstart (p50 9.2 min) | `root` (Biome, `check:*`, spec/schema/text checks, changelog warning, scope checks, workspace-graph and pin checks) plus `core`, `cli` and `integration` below | PR, queue, nightly |
| `ecosystem-ci.yml` `ecosystem-render` / `ecosystem-pptx` / `ecosystem-editor` shards (Playwright container, contract tier on PR) | `render` (3 shards, as today's `--test-shard i/3`), `pptx` (3 shards), `editor` (3 shards: playground suite, standalone browser suites, remainder). Each is `container: mcr.microsoft.com/playwright:v1.64.0-noble@sha256:06a9...` (the digest from the workflows today). Render's golden gate runs in the render job; golden hashes unchanged and exact. | affected packages |
| `ecosystem-core` shards `model`, `installed`, `registry` | `core` (model, geometry, fonts, TypeScript), `integration` (`pack:ecosystem`, `test:packed-ecosystem`, `test:packed-browser`, packed type-failure propagation, installed code guards, metric checks), `registry` (exact published packages, quickstart) | `registry` only when a manifest or `release-plan.json` changes, nightly and in the release gate; the rest per scope |
| `Installed candidates (windows-latest)` and `(macos-latest)` (required) | `portability` matrix, same job names, so the ruleset's required list stays valid. A pull request without `full-ci` runs each on ubuntu and skips by policy (the trick used today) so the required name reports without a Windows/macOS runner. | merge queue, nightly, `full-ci` |
| `cli-windows.yml`, `engines-range.yml` | folded into `portability` and `node-range` | queue, nightly, label |
| opf-pptx `package` job Windows leg (native harness without Office, `-PureRegression`, 23 to 25 min) | `pptx-windows` leg of `portability`, scoped to pptx/core changes through `paths-changed` | queue (when scoped), nightly, `full-ci` |
| opf-editor `macos-playground` (macos-15, 40 min timeout) | `editor-macos` leg, scoped to editor/render/core | queue (when scoped), nightly |
| opf-render `platform-residual` (non-blocking macOS) | `nightly.yml` and `full-ci`; stays non-blocking | nightly |
| `node-range` in each sibling and `engines-range.yml` (Node 22 and 26: install, typecheck, unit suite) | one `node-range` matrix (22, 26) over the affected packages | queue, nightly, `full-ci` |
| four `flake-repeat.yml` | one nightly measurement job; RR-68's identity rule (app 15368, workflow id, path, event, branch) is re-keyed to the new workflow id in `scripts/measurement-policy.mjs`, `scripts/fixtures/editor-scheduled-measurement.json` and `release-train.mjs`; measurement stays advisory | nightly |
| `published-matrix.yml`, `installed-parity.yml` | unchanged, path-scoped, weekly | weekly, queue when scoped |
| `tracker-refresh.yml` | unchanged | push to main |

**Merge queue.** One queue on `main` for all five packages, `merge_group` runs the full affected set (the RR-48/RR-57 policy that the queue is the last full gate, now with the siblings inside it). The required checks become `Verify OPF packages`, `Installed candidates (windows-latest)` and `Installed candidates (macos-latest)`. The job name `packages` stays emitted until the ruleset is trimmed in MR-33 so no required-check edit is needed before parity is proven. RR-100's release-prep fast path extends from core+CLI to all five manifests, so a release-prep PR (versions, changelogs, ranges and lockfile only) does not rerun the world in the queue.

**Concurrency and cost.** Public repositories use standard GitHub-hosted runners without metering, so there is no paid runner and no minute budget; the binding limits are the free-plan 20 concurrent jobs and 5 macOS jobs. A full queue entry is about 14 jobs (root 1, core/cli 2, render 3, pptx 3, editor 3, integration 1, plus Windows, macOS and node-range legs) and roughly 200 runner minutes. Four queue entries at once would exceed 20 concurrent jobs, hence D8. If the repository ever goes private, the macOS and Windows multipliers apply and the queue legs must be re-budgeted.

**Targets** (validated in MR-32 on at least 20 runs; wall-clock from workflow start to the aggregator). Baselines are the last 25 successful runs on 2026-10-20 (medians, with the maximum in brackets): core OPF CI 9.2 (15.4) min and Coordinated packages 8.1 (8.6) min in parallel; opf-render CI 25.6 (46.1); opf-pptx CI 25.3 (66.1) and 34.0 on push (Windows leg); opf-editor CI 24.8 (35.9) and 27.0 on push.

| Change | Today | Target p50 | Target p90 |
| --- | --- | --- | --- |
| docs/evidence/programs only | about 9 (core runs `pnpm test`) | 4 | 6 |
| leaf package only (editor, CLI) | about 25 (sibling) / 9 (CLI) | 12 | 18 |
| renderer or PPTX (dependents at contract tier) | about 25 plus a core coordinated run | 16 | 24 |
| core, spec or examples (dependents at contract tier) | about 9 | 16 | 24 |
| cross-cutting: 3 or more packages changed, each at full tier | 4 to 5 linked PRs in sequence, each about 25 min plus lock rolls, hours of elapsed time | 25, in ONE PR | 35 |
| merge queue entry, everything affected plus Windows and macOS | about 9 to 14 (core only) | 35 | 45 |

If a target is missed, the remedy is more shards and the `build once, upload dist` job (extending `OPF_REUSE_BUILD`), not weaker tests.

## 5. Release

**One workflow, `.github/workflows/npm-publish.yml`, triggered by one train tag.** An agent creates a train tag `train-v<label>` (label is free-form; convention: the core version of the train, or core minor plus a counter when core is not in it) on the release commit through `release-train.mjs tag`; `workflow_dispatch` on that tag is only for retrying a failed run. The packages published are those whose manifest version is not on npm, in `pnpm` topological order: core, render, pptx, editor, cli (core's pins on published peers do not affect this order).

```yaml
on:
  push: { tags: ['train-v*'] }
  workflow_dispatch: {}          # retry only; run it on the train tag ref
permissions: { contents: read }
concurrency: { group: publish, cancel-in-progress: false }
jobs:
  gate:    # read-only. publish-source.mjs (tag on main, commit merged); ci-evidence.mjs (RR-100); every package in
           # the train has its changelog section and no pending fragment; candidate-gallery publication guard;
           # check:breaking; computes the ordered list of unpublished packages as the job output. No test re-run.
  build:   # one install, one build, `pnpm pack` per package (rewrites workspace: ranges), tarball smoke install of the
           # whole set, upload-artifact train-tarballs.
  publish: # needs [gate, build]; matrix over the ordered list, max-parallel: 1, fail-fast: true;
           # permissions: id-token: write only here; Node 24, npm 11.16.0; npm publish <tarball> --provenance --access public;
           # skip a version already on npm; poll until npm serves it before the next package.
  verify:  # release-train.mjs verify for every published package: registry manifest, provenance statement (workflow
           # npm-publish.yml on refs/tags/train-v..., source commit, subject digest), signatures, dist-tags.
  release: # contents: write only here; creates the per-package tags (opf-vX, opf-render-vX, opf-pptx-vX, opf-editor-vX,
           # cli-vX) on the same commit and the GitHub Releases from each package's changelog section; core is "Latest",
           # the others --latest=false.
```

- **Reuse of RR-100.** The `gate` job runs RR-100's `ci-evidence.mjs` unchanged. `ci-evidence.json` collapses from two requirements (opf-ci.yml and ecosystem-ci.yml) plus per-sibling push-run requirements to one: workflow `.github/workflows/ci.yml`, event `merge_group`, branch prefix `gh-readonly-queue/main/`, jobs `Verify OPF packages`, `Installed candidates (windows-latest)`, `Installed candidates (macos-latest)`. A skipped required job still fails closed. `release-train.mjs tag` reads the same file, so a tag is created exactly when the gate would accept the commit.
- **Retry is idempotent.** If package three fails, rerunning the failed job on the same tag skips what is already on npm and continues. A real defect is fixed forward with a new version and a new train tag; tags are never moved (existing rule). Partial publishes are acceptable under semver (each package is compatible with the previous versions of the others); the geometry rule is enforced by `plan`: when core is in the train and its fragments mention geometry (`lockstepFlags`, simplified), render, pptx and editor must be in the train too unless `--allow-partial` records a reason.
- **Packing.** `workspace:^` becomes `^<version in the train>` at pack time. Open item, resolved in MR-03 and MR-41: confirm that `pnpm pack` output published with `npm publish <tarball> --provenance` stamps `gitHead` (registry `verify` checks it today) and carries a valid provenance attestation; if `gitHead` is absent, stamp it in the pack step and add `buildConfig.sourceCommit` of the provenance statement as the primary check in `verify`.
- **Changelog fragments per package.** Keep `changes/<slug>.md`; the existing multi-target assembler already supports `packages: [opf, cli]`. Extend `changes/config.json` `targets` to `opf` (root `CHANGELOG.md`, unchanged), `cli` (`packages/cli/CHANGELOG.md`), `render` (`packages/render/CHANGELOG.md`), `pptx`, `editor`, and `codePaths` to each package's `src/`. Example: `packages: [render, pptx]` puts the entry in both. `check:changes` rejects an unknown package name; the CI warning ("package code changed without a fragment") works per package. At freeze every repo's `changes/` is empty (the 0.25.0 train consumed it), so no sibling fragment needs migration; the sibling `changes/README.md` files fold into the root one.
- **How `release-train.mjs` shrinks.** From 1,319 lines (test 1,318) to an estimated 400 to 500 each. Kept: `verify` and its attestation/propagation waits, the npm client, version helpers (`isVersion`, `compareVersions`, `floorOf`), the gallery lane (`INDEPENDENT_PACKAGES`, `assertGalleryReleaseReady`), `commitChecks` via `ci-evidence`, `prepBody` and a simplified `lockstepFlags`. Rewritten: `plan` (manifests vs npm vs changelogs vs CI evidence for the five packages; exit 1 until all are on npm), `prep` (in place, one branch `codex/release-train-<label>` and one PR, no scratch clones: bumps the manifests in the train, assembles each package's fragments, refreshes `pnpm-lock.yaml` with `pnpm install --lockfile-only`, and embeds RR-100's `prepMarker`), `tag` (creates the one train tag). Deleted: the list in section 2. Commands afterwards: `plan`, `prep --label <l> [--core X] [--render X] ...`, `tag --label <l>`, `verify <pkg>@X.Y.Z`.
- **Train follow-up PR (one per train, by an agent).** Updates `release-plan.json` (versions and one `sha`), `docs/compatibility-matrix.md`, `docs/quickstart.md`, and the exact devDependency pins of core on the published renderer and PPTX. Replaces the manual follow-up docs PR and the lock-roll PRs. A workflow cannot open it today (repository setting "Allow GitHub Actions to create and approve pull requests" is off).
- **Failure classes removed.** The 3 failed publishes this week came from release ordering; in the monorepo the lockfile resolves in-repo packages through the workspace, so no sibling prep has to wait for an upstream version to appear on npm before it can refresh its lockfile.
- **Target train time.** Today: about 65 minutes of serial publish compute (core 5 to 12, render about 18, pptx 15 to 19, editor 16 to 24, CLI 8 to 13 minutes), four release-prep PRs each through CI and a merge, and 5 to 6 hours elapsed. Target: one prep PR plus queue about 25 to 30 minutes, then tag to everything verified about 30 minutes (gate 2, build and pack 5, five publishes with propagation waits about 13, verify about 8, releases 1): **60 minutes p50, 90 minutes p90 from opening the prep PR to all five verified, and at most 15 minutes of agent attention.** Measured in MR-44.

### npm trusted-publisher changes (OWNER, each package: npmjs.com, package Settings, Trusted Publisher, GitHub Actions)

Organization `OpenPresentation`, no environment unless D7's environment is adopted (then enter its name identically in npm and in the workflow).

| Package | Today (repository / workflow) | After (repository / workflow) | When |
| --- | --- | --- | --- |
| `@openpresentation/opf` | `OpenPresentation/opf` / `npm-publish.yml` | unchanged (`OpenPresentation/opf` / `npm-publish.yml`); no action, which is why the new workflow keeps this filename | MR-41 (core canary needs nothing) |
| `@openpresentation/cli` | `OpenPresentation/opf` / `cli-publish.yml` | `OpenPresentation/opf` / `npm-publish.yml` | MR-42 |
| `@openpresentation/opf-render` | `OpenPresentation/opf-render` / `npm-publish.yml` | `OpenPresentation/opf` / `npm-publish.yml` | MR-43 |
| `@openpresentation/opf-pptx` | `OpenPresentation/opf-pptx` / `release.yml` | `OpenPresentation/opf` / `npm-publish.yml` | MR-43 |
| `@openpresentation/opf-editor` | `OpenPresentation/opf-editor` / `release.yml` | `OpenPresentation/opf` / `npm-publish.yml` | MR-43 |
| `@openpresentation/gallery` | `OpenPresentation/gallery` / `gallery-publish.yml` | unchanged | none |

- To my knowledge npm allows **one** trusted publisher per package at a time, so each switch is atomic and rollback is the owner re-pointing it at the old repository and workflow (minutes). Verify this in the npm UI before MR-43; if several publishers are allowed, add the monorepo entry first and remove the old one after the first successful train, which makes rollback free.
- npm provenance requires `package.json` `repository` to match the publishing repository. The monorepo manifests carry `{ "type": "git", "url": "git+https://github.com/OpenPresentation/opf.git", "directory": "packages/<x>" }` from MR-23, so the first monorepo publish passes; `bugs.url` becomes `https://github.com/OpenPresentation/opf/issues`; `homepage` for the three siblings becomes `https://github.com/OpenPresentation/opf/tree/main/packages/<x>#readme` (core and CLI keep theirs). Already-published versions keep their old URLs (immutable); the old repos stay public so those links work.
- The first real exercise of OIDC from the new workflow cannot be rehearsed with `--dry-run`. MR-41 to MR-43 therefore publish prerelease canaries to the `next` dist-tag (core only, then CLI, then all five) before the first stable train.
- OWNER, optional: create the GitHub environment `npm-publish`; add a tag ruleset restricting creation, update and deletion of `train-v*`, `opf-*-v*` and `cli-v*` to maintainers.

## 6. The old repos (opf-render, opf-pptx, opf-editor)

1. **Final release from the old repos: yes, once, before the freeze.** The 0.25.0 train is published from the old repos as usual and verified. That is each old repo's last release; there is no separate "migration release". A README-only pointer commit to each old `main` is allowed during the freeze; it needs no npm release (published READMEs are immutable). This gives the monorepo a clean start: every package published, `changes/` empty.
2. **Freeze window (MR-20 to MR-43, target 5 working days).** From the start of MR-20 each old repo accepts no feature merges. Before it begins: land or park all open PRs (today: opf-render 2 including Dependabot #270 and FA-33 #278; opf-pptx 8 including Dependabot #294, FA-33 #300 and six RR-86 PRs #268 to #274; opf-editor 3 including Dependabot #187 and FA-33 #195; in core #756 FA-33 and #761 CLI release). Mechanics: a pinned issue and a README banner (PR, agents); the `schedule:` triggers and `dependabot.yml` removed by PR (agents) so no nightly or Dependabot work runs; an optional "restrict updates" ruleset on `main` (OWNER). Emergency path: a hotfix that cannot wait is merged to the old repo and released with its existing workflow (the trusted publisher still points there until MR-43), then re-synced into the monorepo with the deterministic delta import; the frozen `ecosystem-refs` shim keeps the old repos' CI working.
3. **Open PRs.** Sibling PRs that are not Dependabot are ported with `git format-patch origin/main..<branch>` plus `git am --directory=packages/<x>` onto a monorepo branch and reopened there; the old PR gets a closing comment with the new link. Dependabot PRs are closed (the single monorepo Dependabot config recreates them).
4. **Issues.** Before archiving (MR-51): create labels `pkg:render`, `pkg:pptx`, `pkg:editor` (and `pkg:core`, `pkg:cli`) in `opf`; `gh issue transfer <n> OpenPresentation/opf` for each open issue (about 13: opf-render 3, opf-pptx 7, opf-editor 3 by the API counts of 2026-10-20, which include PRs in their totals); relabel; add the package dropdown to the issue templates. A transfer keeps comments and leaves a redirect from the old number; labels, milestones and project membership must be re-applied. Issue and PR numbers share one space per repo: the new issue numbers continue opf's numbering and collide with old `render#N`, so the convention is always repository-qualified references (`OpenPresentation/opf-render#199`), already used throughout docs.
5. **Archive** (MR-60, OWNER) only after D9's soak: README banner PR merged first (text: "Moved to https://github.com/OpenPresentation/opf, directory packages/<x>. The npm package name `@openpresentation/<name>` is unchanged. This repository is archived and read-only; issues and history moved or are preserved at the new location."), then Settings, Archive. Archiving disables Actions, which is why it comes after the cutover is proven and why the old repos cannot be a hot fallback afterwards.
6. **Redirects.** GitHub redirects only renamed or transferred repositories, and renaming the old repos would break about 2,800 historical references and the `repository` URLs of every published version. So the old URLs stay live as archived repositories with the README pointer; the live places that link to them (sites, current docs) are updated (section 7). No DNS or web-server redirect is involved.
7. **npm metadata.** New versions carry the monorepo `repository`, `bugs` and `homepage` (section 5). No `npm deprecate` of any existing version, since consumers must see no change.
8. **Rollback after archive.** Unarchive (OWNER), re-point the trusted publishers, and, if the monorepo code moved on, `git filter-repo --subdirectory-filter packages/<x>` produces the package's history back for a new standalone repo state. This is a defined escape hatch, not a plan.

## 7. Sites, gallery, docs and skills

Goal: consumers see no change. Package names, `npm install` commands, exact version pins in the sites (`@openpresentation/opf-render` and friends in pptx-gallery, pptx-dev and openpresentation-site `package.json`) and skill installation (`skills/` stays in core) are untouched.

What changes (link updates only, each its own small PR; none needs a deploy by an agent):

- **openpresentation-site**: `app/changelog/page.tsx` (3 links to per-repo `CHANGELOG.md` become `.../opf/blob/main/packages/render/CHANGELOG.md` and the pptx and editor equivalents) and the source link in `app/docs/get-started/page.tsx` (8 references in the app). The Data-Advantage repos deploy their own sites; owner-gated deploys stay the owner's.
- **pptx-dev**: `README.md`, `app/docs/opf/page.tsx` (link to opf-pptx `docs/native-body-prototype.md`), `docs/browser-opf-workflow.md`, `docs/pptx-0.5.1-adoption.md`.
- **pptx-gallery**: `docs/published-ecosystem-2026-09-08.md` is a dated record; leave it. The local workflow `OPF_LOCAL_WORKSPACE=1` and `pnpm sync:catalog --gallery ../pptx-gallery` stay and are documented against the monorepo path.
- **Gallery repo**: unchanged. Its `candidate-gallery` checkouts of sibling repos are in core's workflows (rewritten in MR-30); the gallery repo itself references no sibling repo URL that this plan found. Re-grep in MR-52.
- **Core docs**: current-instruction docs only, not the dated handoffs: `docs/live-editor.md` (4 links), `docs/chart-table-data.md` (3), `docs/release-process.md`, `docs/compatibility-matrix.md`, `docs/quickstart.md`, `docs/font-fidelity.md`, `docs/dynamic-composition.md`, `docs/ecosystem-development.md` (rewritten), `docs/open-ecosystem.md` ("Public surfaces": core repo now owns all five package sources and the schemas), `README.md`, `CONTRIBUTING.md` (Project architecture), `AGENTS.md`, `packages/*/README.md` (render and pptx README link their repo roots). The roughly 2,800 references in `docs/evidence`, `docs/programs` and `docs/handoff*` are historical and stay; add one sentence to this program's README stating that references to `opf-render#N`, `opf-pptx#N`, `opf-editor#N` are to the archived repositories. Core embeds docs in its package (`generated/docs.ts`, the `./docs` and `./repo-readme` exports), so these link updates ship with the first monorepo core release.
- **Per-package agent guidance**: each sibling's `AGENTS.md` moves to `packages/<x>/AGENTS.md` with the toolchain and CI sections replaced by a pointer to the root (keep the package-specific rules: renderer font licensing and deterministic output, PPTX vendored PptxGenJS byte-exactness, editor browser suites). The root `AGENTS.md` gets a "Packages" index telling agents to read the package's file before editing it, and "Active programs" gets this program. PR and branch conventions are unchanged: `codex/mr-<nn>-<slug>`, titles `MR-<nn>: `; cross-package feature PRs are one PR titled with their own item ID, with a `changes/` fragment for each affected package.

## 8. Phases

Each phase is small and reversible, and `main` is releasable after each. "Agent-day" means one agent working one focused day; phases with several agents in parallel shorten the calendar, not the effort. Total about 21 to 29 agent-days (three to four calendar weeks with parallel agents), plus 12 OWNER actions. Item IDs `MR-nn` go into `burndown.md` in MR-02.

### MR-0x Phase 0: approval, baselines and spikes (no repository change; 2 agent-days)

| ID | Item | Who |
| --- | --- | --- |
| MR-00 | Owner approves and answers D1 to D12. The 0.25.0 train is published and verified from the old repos; `changes/` is empty in all four repos; open PRs are landed or parked. | OWNER |
| MR-01 | RR-100 merged: core's `ci-evidence.mjs`, `ci-evidence.json`, `release-prep.mjs` and `release-train.mjs` changes, and the sibling publish workflows trusting CI evidence. If RR-100 is not finished, MR-40 still uses `ci-evidence.mjs` (it is repository-agnostic), but the siblings' RR-100 branches are then dropped, not finished. | agent |
| MR-02 | Create `docs/programs/monorepo/README.md` (this file) and `burndown.md`; list the program in `AGENTS.md`. | agent |
| MR-03 | Spikes in scratch directories, results in `docs/programs/monorepo/spikes.md`: (S1) `pnpm import` of each sibling's `package-lock.json` in a scratch copy, then compare every resolved third-party version with the monorepo resolution and pin or override differences; (S2) filter-repo dry run on fresh clones: time, size, message rewrite, tree-hash equality; (S3) rehearse the merge in a scratch clone of core and run `pnpm lint` and `pnpm test` to list every root check that globs into `packages/*` (Biome, text integrity, font hotlinks, spec checks); (S4) `pnpm pack` then `npm publish --dry-run --provenance` shape, `gitHead`, and `workspace:` rewrite including peers; (S5) pnpm filter graph `"...[origin/main]"` with the target manifests, and whether Dependabot understands pnpm workspaces and `catalog:`; (S6) sibling test suites under pnpm's non-hoisted layout, with `node-linker=hoisted` as the fallback. | agent |

- Acceptance: owner decisions recorded in the burndown; spikes S1 to S6 each have a result, with a go or no-go for pnpm (D3).
- Rollback: delete the docs. Owner actions: MR-00.

### MR-1x Phase 1: core hosts the machinery (additive; 4 to 5 agent-days)

All inside `opf`, no sibling content. Behavior of core, CLI and the current release train is unchanged.

| ID | Item |
| --- | --- |
| MR-10 | `pnpm-workspace.yaml` explicit package list; `.npmrc`; catalogs with the siblings' current pins; `check:playwright-pin`. |
| MR-11 | Biome `files.includes`; root `check:*` scripts scoped away from `packages/{render,pptx,editor}` (from S3). |
| MR-12 | Unify the shared scripts (changelog-fragments, quarantine, run-tests, publish-source, flake-repeat, check-font-hotlinks) with package-directory parameters; port sibling-only behavior behind flags; merge tests. |
| MR-13 | `changes/config.json` targets and `codePaths` for render, pptx, editor; `check:changes` validates names. |
| MR-14 | `ci-scope.mjs` with the graph, path map, tiers and tests; `check:workspace-graph`, `check:peer-ranges`; run in shadow mode (printed, not gating) next to the current CI. |
| MR-15 | Split `release-train.mjs` into modules (verify, npm client, versions, prep, plan) without behavior change, so MR-40 deletes instead of rewrites. |
| MR-16 | `scripts/agent-worktree.mjs` (sparse profile, shared store) and `check:changed` for five packages. |

- Acceptance: `pnpm lint`, `pnpm test`, the packed and registry checks green; a core train still releases with the old scripts; `ci-scope.mjs` shadow output matches the real changed packages on the last 30 merged core PRs.
- Rollback: revert the individual PRs; nothing depends on them yet. Owner actions: none.

### MR-2x Phase 2: freeze and import (4 to 5 agent-days; old repos frozen from MR-20)

| ID | Item |
| --- | --- |
| MR-20 | Freeze (section 6): banner PRs, schedule and Dependabot removal PRs in the old repos; optional ruleset (OWNER). |
| MR-21 | Import rehearsal in a scratch clone from fresh clones; `verify-import.mjs`; root-check enumeration from S3 re-run. |
| MR-22 | Import merges (2a) onto `monorepo/import`, then to `main` with the merge-method toggle (OWNER); commit maps committed; workspace still lists only core and CLI, so the imported directories are inert. |
| MR-23 | Wire up (2b): widen the workspace; `repository`/`bugs`/`homepage` fields; `pnpm-lock.yaml`; scripts converted from `npm` to `pnpm`; duplicated sibling scripts and `.github/**`, lockfiles and `.nvmrc` removed (cleanup commit, listed in `.git-blame-ignore-revs`); nested `AGENTS.md`; the first manual run (`workflow_dispatch`) of every sibling suite in the Playwright container. |

- Acceptance: `verify-import.mjs` all green (tree hashes equal at `main` and 146 tags; blame sample equal; no bare `#N`); `pnpm install --frozen-lockfile` works; every sibling suite passes in a manual CI run with unchanged golden hashes; the S1 resolution diff is reviewed.
- Rollback: before MR-23, `git revert -m 1` the import merges (a later re-import needs "revert the revert"); after it, revert MR-23 and unfreeze. The old repos are untouched and still publish. Owner actions: MR-20 ruleset (optional), MR-22 merge-method toggle or bypass, then restore SQUASH.

### MR-3x Phase 3: CI cutover (5 to 6 agent-days)

| ID | Item |
| --- | --- |
| MR-30 | New `ci.yml` jobs for render, pptx, editor, integration, portability legs and node-range, with `scope`; run next to `opf-ci.yml` and `ecosystem-ci.yml` (shadow, not required). |
| MR-31 | Golden unification (section 1) and a single `golden.yml` replacing the three regenerate workflows; byte-identical baseline moves. |
| MR-32 | Parity window: 10 or more pull requests, 10 or more queue runs and 3 nightlies with the same verdicts as the old CI; measure section 4 targets. |
| MR-33 | Switch (OWNER, ruleset): required checks become `Verify OPF packages`, `Installed candidates (windows-latest)`, `Installed candidates (macos-latest)`; delete `opf-ci.yml`, `ecosystem-ci.yml`, `cli-windows.yml`, `engines-range.yml`, the four `flake-repeat.yml` (replaced by the nightly), and the `packages` alias. |
| MR-34 | Retire the roller, guard and workflow, `Depends-On` plumbing in tests, `registry-sibling-gate`, `unreleased-gate`, `package-ecosystem-plan`, link plumbing (section 2); the frozen shim stays. |

- Acceptance: section 4 targets met on 20 or more runs; the verdict of the new CI equals the old CI on every shadowed run; no required check is skipped by scope without the aggregator accepting it; Windows, macOS and Node 22/26 legs present in the queue.
- Rollback: restore the deleted workflow files from git and the previous ruleset (OWNER); the old repos' CI still works through the shim. Owner actions: MR-33 ruleset edit; D8 queue concurrency.

### MR-4x Phase 4: release cutover (3 to 4 agent-days plus the canaries)

| ID | Item |
| --- | --- |
| MR-40 | Unified `npm-publish.yml` (gate, build, publish matrix, verify, release) and the shrunk `release-train.mjs` and `release-train.yml` (no App token); extend RR-100's release-prep fast path to the five manifests. Dry runs only. |
| MR-41 | Core canary: a `next` prerelease of `@openpresentation/opf` through the unified workflow (no owner action needed). Checks provenance, `gitHead` and the pack path (S4). |
| MR-42 | OWNER switches the CLI trusted publisher; CLI canary to `next`. |
| MR-43 | OWNER switches render, pptx and editor trusted publishers; full canary train of five prereleases to `next`; fix forward until `verify` passes for all five. |
| MR-44 | First stable train from the monorepo; measure the train time; the train follow-up PR (release plan, matrix, quickstart, core pins). |

- Acceptance: provenance, signatures and gitHead or source-commit verified for all five; train time within the section 5 target; `latest` dist-tags correct; the old repos' last tags remain the 0.25.0 train.
- Rollback: before MR-44, the owner re-points the trusted publisher(s) and unfreezes the old repos; the monorepo workflow can stay (it publishes nothing). After MR-44 a failed train is fixed forward like any other. Owner actions: MR-42, MR-43 trusted-publisher edits; optional environment and tag ruleset.

### MR-5x Phase 5: people, data and soak (3 to 4 agent-days)

| ID | Item |
| --- | --- |
| MR-50 | One `dependabot.yml` (github-actions plus npm at the root, groups per package, security updates grouped as today, same weekly Monday schedule and no ignored advisories); CODEOWNERS paths; labels; issue templates with a package dropdown; positioning text; rewrite of `CONTRIBUTING.md`, `AGENTS.md`, `docs/release-process.md`, `docs/ecosystem-development.md`. |
| MR-51 | Issue transfer and PR porting (section 6). |
| MR-52 | Link updates in the three sites, the gallery repo (if any), core docs and package READMEs (section 7). |
| MR-53 | Soak: at least 2 stable trains and 14 days; compare the measured metrics with the Definition of done; decide D9. |

- Acceptance: no open issue or PR left in the old repos except the pinned pointer issue; all current-instruction docs point at the monorepo; section 4 and 5 targets held across the soak.
- Rollback: each item is independent and reversible by revert (transferred issues can be transferred back). Owner actions: tag ruleset, label permissions if needed, approval to transfer issues (D10).

### MR-6x Phase 6: archive and cleanup (1 to 2 agent-days)

| ID | Item |
| --- | --- |
| MR-60 | README pointer PRs merged in the old repos; OWNER archives them; delete the frozen shim (`ecosystem.lock.json`, `ecosystem-lock.mjs`, `.github/actions/ecosystem-refs`), the GitHub App `ECOSYSTEM_APP_ID` variable and `ECOSYSTEM_APP_PRIVATE_KEY` secret (opf#298), the `ECOSYSTEM_LOCK_GUARD` variable; slim `release-plan.json`. |
| MR-61 | Optional, each independent: rename `packages/javascript` to `packages/core` (D2); untrack sibling `dist/` (D4); move the 13 core tests that need the engines into a private `packages/integration` and delete core's registry pins on render and pptx; adopt Biome per package; backfill historical GitHub Releases; `.git-blame-ignore-revs` update. |

- Acceptance: nothing in `opf` references the deleted shim (`git grep`); `pnpm test` and a train still pass.
- Rollback: unarchive (OWNER); re-add the shim from git. Owner actions: archive, App and secret removal, repository variable removal.

### OWNER action list (consolidated)

1. MR-00: approve the plan; decide D1 to D12.
2. MR-20 (optional): ruleset "restrict updates" on the old repos' `main`.
3. MR-22: temporarily switch the queue merge method to MERGE (or bypass) for the import, then restore SQUASH.
4. MR-33: edit the `main` ruleset's required checks; set `max_entries_to_build` (D8).
5. MR-42: npm trusted publisher of `@openpresentation/cli` to `OpenPresentation/opf` / `npm-publish.yml`.
6. MR-43: npm trusted publishers of `@openpresentation/opf-render`, `opf-pptx`, `opf-editor` to `OpenPresentation/opf` / `npm-publish.yml`.
7. Before MR-43 (optional): GitHub environment `npm-publish`; tag ruleset for `train-v*`, `opf-*-v*`, `cli-v*`.
8. MR-51: approve issue transfer.
9. MR-60: archive the three old repos.
10. MR-60: delete the GitHub App secret and variables (`ECOSYSTEM_APP_PRIVATE_KEY`, `ECOSYSTEM_APP_ID`, `ECOSYSTEM_LOCK_GUARD`).
11. Any time the owner finds the free-plan concurrency limit binding: queue and runner settings.
12. Any rollback that re-points a trusted publisher.

## 9. Risks and open questions

| # | Risk or question | Mitigation and owner input |
| --- | --- | --- |
| 1 | **Positioning.** Separate repos signal that OPF is a format and engines are interchangeable implementations that can compete. One repo with the spec, the schemas and the reference engines can read as "the implementation is the format". | The spec already lives in core (`spec/`, `examples/`, schemas, the `schema_change` issue template) and none of that moves. State in the README, `docs/open-ecosystem.md` and each engine README that the engines are reference implementations, that the schemas, examples and golden hash corpus are consumable without any engine (they are exported through `@openpresentation/opf/spec-files` and `/examples`), and keep spec changes behind the existing proposal template and `spec/` CODEOWNERS path. Owner decides the wording (D11) and whether a conformance export is a follow-up. |
| 2 | **Clone and worktree size.** About 175 to 185 MiB packed history, about 507 MiB tracked tree, many agent worktrees. | Sparse worktree profile without `docs/evidence`, treeless clones, shallow CI clones, one shared pnpm store (MR-16). Option for later: move sibling `docs/evidence` binaries out of the default checkout permanently (D5 alternative). |
| 3 | **CI minutes and concurrency.** Free for public repos on standard runners, but 20 concurrent jobs (5 macOS) is a hard ceiling; a queue of 4 entries would saturate it. If a repo goes private, billing multipliers apply. | D8 (2 queue entries), shard counts tuned in MR-32, Windows and macOS only in queue, nightly and `full-ci` as today. |
| 4 | **Contributor permissions.** One repository means one permission set for all five packages and one set of rulesets; today the siblings have no ruleset at all. External contributors fork once instead of per repo. | CODEOWNERS by path (`@michaeljgrimm` today), the tag ruleset, and required checks now apply to the siblings too (a tightening, not a loosening). Confirm no outside collaborator has write access to the siblings today (GitHub settings, OWNER). |
| 5 | **Dependabot.** Three configs become one; npm to pnpm; `catalog:` support in Dependabot is unverified; a Playwright bump now also needs the image digest. | S5 spike before MR-23; group per package; `check:playwright-pin` fails a bump that skips the digest. The existing policy (no ignored advisories, security updates grouped) is carried over verbatim. |
| 6 | **npm to pnpm for three packages.** Phantom dependencies, optional peer resolution (the reason siblings pin npm 11.16.0), exact pins of 45 font packages, Windows path length with nested `node_modules`. | S1 and S6 spikes; `pnpm import` lockfile fidelity diff; `node-linker=hoisted` fallback; short worktree paths on Windows as in `AGENTS.md`. D3 is conditional on this. |
| 7 | **Cycle between core and the engines** (core peers and exact devDependency pins on render and pptx). | Keep registry pins in the workspace (section 1); `check:workspace-graph` fails any new `workspace:` edge from core to an engine; optional MR-61 removes the pins. |
| 8 | **Trusted-publishing details.** One publisher per package (to verify); provenance needs the right `repository` URL; the publish must stay in the top-level workflow; the first OIDC publish from the new workflow cannot be dry-run; `gitHead` stamping from a packed tarball is unverified. | Canary prereleases to `next` in three stages (MR-41 to MR-43), S4 spike, rollback by re-pointing the publisher; old repos remain unarchived until the soak. |
| 9 | **Squash queue versus import** flattening history; closing keywords in imported messages; PR-number overlap. | MR-22 owner toggle; message rewrite plus a bare-`#N` check; repository-qualified references convention. |
| 10 | **Stale references to old SHAs and PRs** (about 2,800 in historical docs, `release-plan.json`, lock records). | Old repos stay public; commit maps committed; historical docs not rewritten. |
| 11 | **Freeze-window drift.** Old repos gaining commits while the monorepo copy is in flight. | Window of at most about 5 working days; deterministic re-sync; emergency hotfix path from the old repos with the shim. |
| 12 | **A flaky package blocks the whole train.** One aggregator means a flaky editor suite can block a core release. | `ci-evidence.json` lists per-package aggregator jobs so a train can name only the packages it contains (extend if needed in MR-40); the RR-47 quarantine mechanism and the nightly `main-red` issue policy continue. |
| 13 | **Committed `dist/` in siblings** conflicts more in one repo. | D4; check that `dist` equals the build output in CI; untrack in MR-61 if the owner agrees. |
| 14 | **Lockstep floors via `workspace:^`** raises each package's published core floor to the train's core version. | D12; peers stay hand-managed. Keep the CLI peer-contract guidance (`docs/release-process.md`, "CLI peer contracts before a new minor train") in the rewritten runbook. |
| 15 | **Scheduled-measurement identity (RR-68)** is keyed to `OpenPresentation/opf-editor`, app 15368 and workflow id 373564717. | Re-key in `measurement-policy.mjs`, its fixture and `release-train.mjs` in MR-30; keep it advisory. |
| 16 | **Open question: gallery coupling.** A gallery major is now qualified once for five packages (better), but its candidate lanes are rewritten. | MR-30 rewrites the lanes; the gallery repo needs no change. |
| 17 | **Open question: cadence.** Do all five packages keep independent patch numbers inside a lockstep minor? | This plan assumes yes (as today: core 0.24.2, render 0.24.3, pptx 0.24.1, editor 0.24.0, CLI 0.24.0 or 0.24.1). A single shared version would be a separate decision. |
| 18 | **Open question: release-plan and follow-up docs PR** remain by hand after each train until the repository setting for workflow-created PRs is enabled by the owner. | Optional OWNER setting. |

## Appendix: measured baseline (2026-10-20)

- Owner-measured this week: 13 lock-roll PRs; 4 to 5 linked PRs per feature; 3 failed publishes from release ordering; 5 to 6 hour train.
- Successful-run wall-clock medians (maximum): core OPF CI on pull requests 9.2 min (15.4), in the merge queue 9.3 (15.9); core Coordinated public packages 8.1 (8.6) on pull requests, 8.2 (14.2) in the queue; opf-render CI 25.6 (46.1); opf-pptx CI 25.3 (66.1), push runs 34.0; opf-editor CI 24.8 (35.9), push runs 27.0. Samples of 11 to 17 runs per series.
- Publish runs (recent): core 5 to 12 min, CLI 8 to 13, opf-render about 18 (three recent runs failed at about 3 min), opf-pptx 15 to 19, opf-editor 16 to 24; roller runs 8 to 26 min (about 15 median).
- Sizes: main-only packed history core 95.9 MiB, render 59.9, pptx 15.7, editor 4.5; commits 905, 280, 315, 207; tags 75, 51, 53, 42; open issue/PR counts (including PRs) 26, 5, 15, 6, with open PRs 2, 2, 8, 3.
- Test files: render 193 `test/*.mjs`, pptx 232, editor 133, core package 155, CLI 31.
- Workflow files: core 15, opf-render 6, opf-pptx 3, opf-editor 3.

## Resume protocol

Any session resuming this program:

1. Read this file and `burndown.md` (its progress log is the latest state; its Now table says who works on what and what blocks it). If the program status line still says "proposed", **do nothing but read**: no owner approval, no work.
2. `git fetch` every repository in scope and work only from fresh `origin/main` worktrees. Never switch, clean or run the import in the owner's checkouts (`/Users/michael/Source/opf*`; some are stale). The import runs only in a scratch directory. After MR-20, old repos accept only the changes listed in section 6.
3. List open program PRs with the GitHub REST API (one batched query; respect the shared 5,000-per-hour quota in `AGENTS.md`) and reconcile drift into the burndown.
4. Pick the lowest-numbered `todo` item whose dependencies are `done` and that is not an OWNER item. Branch `codex/mr-<nn>-<slug>`; PR title `MR-<nn>: `. Watch PRs only with `node scripts/pr-gate.mjs`.
5. An item is `done` only when its acceptance criteria hold and its evidence is linked. Items that need an npm setting, a GitHub setting, a ruleset, an archive, a secret or a deploy are the owner's: prepare the exact steps in `docs/programs/monorepo/owner-steps.md` and stop. Agents never publish by hand, never change trusted publishers, and never push to an old repo beyond the freeze list.
6. Never merge anything that changes package behavior as part of a migration item. If a migration PR needs a behavior change, split it out as its own PR under its own item ID.
7. When an item changes state, update its row and append one dated line to the burndown progress log.

## Related

- [docs/release-process.md](../../release-process.md), [docs/ecosystem-development.md](../../ecosystem-development.md): rewritten in MR-50.
- [release-readiness CI study](../release-readiness/ci-cd.md): the origin of the contract tier (RR-53) and queue policy (RR-48, RR-57) reused here.
- RR-100 (`codex/rr-100-release-speed` in each repo): `scripts/ci-evidence.mjs`, `scripts/release-prep.mjs`; this program depends on and reuses it.
- [cloudflare-hosting](../cloudflare-hosting/README.md): the three sites, which stay separate.

---

Notes for the caller (not part of the README):

- No file was written or changed. Facts above come from `origin/main` of each repo, the `.github/workflows` of each, package manifests, AGENTS.md and CONTRIBUTING.md files, `docs/release-process.md`, `docs/ecosystem-development.md`, the RR-100 worktree in the scratchpad (`wt-rr100-opf`), read-only `gh api` queries (ruleset 24382980, repo sizes, run durations) and local git object measurements.
- Corrections to the brief that the plan relies on: renderer goldens are hash manifests, so history weight is `docs/evidence`, not goldens; core depends on the engines through peers and devDependency pins (a cycle once linked); the three siblings use npm and track `dist/`; the siblings have no ruleset or merge queue; RR-100 has uncommitted work in core only.
- Verify before MR-43: npm's one-trusted-publisher-per-package limit, `gitHead` stamping on `pnpm pack` tarballs, and Dependabot support for pnpm `catalog:`.

### Critical Files for Implementation
- /Users/michael/Source/opf/scripts/release-train.mjs
- /Users/michael/Source/opf/.github/workflows/ecosystem-ci.yml
- /Users/michael/Source/opf/pnpm-workspace.yaml
- /Users/michael/Source/opf/docs/release-process.md
- /Users/michael/Source/opf/scripts/ecosystem-lock.mjs