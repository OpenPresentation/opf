# CI/CD: current state and target pipeline (RR-40)

Study of the CI/CD pipeline across the seven OpenPresentation repositories, a
target design, and a prioritised roadmap. Measured on 2026-10-02 (UTC).

Scope: core ([opf](https://github.com/OpenPresentation/opf)),
[opf-render](https://github.com/OpenPresentation/opf-render),
[opf-pptx](https://github.com/OpenPresentation/opf-pptx),
[opf-editor](https://github.com/OpenPresentation/opf-editor) (public, org
OpenPresentation), and pptx-gallery, openpresentation-site and pptx-dev
(private, org Data-Advantage, all three deployed on Vercel).

This is an internal working note. It is kept under `docs/programs/` on purpose.
Top-level `docs/*.md` files are inlined into the published core package
(`packages/javascript/scripts/generate-content.mjs`), and openpresentation.org
hosts them under `/docs/reference` and in `llms.txt`. A note with CI failure
rates and private billing data does not belong in either place (README
invariant: tracking stays in this repository).

## Method

- **Data.** GitHub REST only (`gh api`, no GraphQL).
  - For each repository, the last 200 workflow runs and every job of every
    attempt (`/actions/runs`, `/actions/runs/{id}/jobs?filter=all`): 1,346 runs
    and 2,213 jobs.
  - For the week 2026-09-25 to 2026-10-02, every run (2,697) and the changed
    files of every pull request in the four public repositories (319 PRs).
  - The logs and annotations of 209 failed jobs.
  - The Actions usage report of both organizations
    (`/organizations/{org}/settings/billing/usage`).
- **Sample windows.** The 200-run sample covers only one day for core and
  opf-render, two to three days for opf-pptx and opf-editor, and three weeks
  for the sites. Per-job durations come from that sample; weekly volumes come
  from the full-week run list and the usage report.
- **Definitions.**
  - Duration is `completed_at - started_at` of jobs that ended `success` or
    `failure`.
  - Queue time is `started_at - created_at`.
  - Failure rate is failure / (success + failure); cancelled runs are excluded.
  - Flake means that, on the same SHA, a failed job passed on a later attempt
    or run.
- **Not measured.** Vercel build minutes and Vercel preview timings (no
  Vercel API access in this study). The Windows Chromium whole-pixel ink flake
  reported this week did not occur in the sampled window, so it has no number
  here.

## Summary

1. **Private CI is being switched off by the Actions budget.** Data-Advantage
   is on the Free plan.
   - In September its Actions usage was worth $34.11. The included allowance
     covered $14.11 and exactly $20.00 was paid, which is consistent with a
     $20 budget.
   - 187 jobs in the three site repositories never started ("recent account
     payments have failed or your spending limit needs to be increased"):
     pptx-gallery 107, pptx-dev 53, openpresentation-site 27, on 2026-09-09,
     09-21, 09-23 and 09-28 to 09-30. Pull requests merged in that window were
     never verified.
   - On 2026-10-01 and 02 the account already used $8.38, at $4.19 a day. At
     that rate the included allowance runs out around 2026-10-03 and a $20
     budget around 2026-10-08, after which no site CI runs until November.
   - pptx-dev Windows is 47% of the October spend.
   - llmreference, which is outside this program, was 53% of the September
     spend (3,008 Linux minutes).
2. **Core's required `packages` check is the critical path of every core PR.**
   - It takes 25.4 min p50 and 31.8 min p90 (max 32.7, 71 jobs). Its run wall
     clock, including the queue, is 25.7 min p50 and 36.7 min p90.
   - 59% of the job (15.7 of 26.8 min in a reference log) re-runs the
     siblings' own unit suites at pinned SHAs:
     - the renderer's typecheck and test, 10.2 min, of which 5.5 min is the
       805-slide raster golden and 2.2 min is a second run of
       `test:pdf-vector`;
     - opf-pptx, 5.3 min;
     - opf-editor, 0.2 min.
   - The brief's "gallery parity and editor demos" cost little here:
     `demo:editor` takes 3 s and `test:registry-fidelity` 1.4 min.
3. **Runners are saturated.**
   - The four public repositories use about 31,700 runner-minutes a week:
     18,900 Linux, 9,200 Windows and 3,600 macOS. Public repositories are free,
     but at list price that is about $430 a week.
   - On 2026-10-02 the queue reached p90 11.9 min and p99 19.4 min, and 28% of
     784 jobs waited more than 5 minutes for a runner. The observed peak was 27
     running jobs, 6 of them on macOS.
   - 11 to 17% of all runner-minutes went to runs cancelled by a newer push
     (core 17%, opf-render 16%, opf-pptx 11%).
4. **Cross-repository coupling is the largest avoidable cost.**
   - One four-repository feature is four PRs and 29 to 63 pushes. RR-34 took
     7 + 14 + 18 + 24 = 63 pushes and about 12 h from open to merged.
   - Every sibling PR of RR-33, RR-34 and RR-35 edited the CI pins. This week
     77 of 181 sibling PRs touched `.github/workflows`, and at least five PRs
     did nothing but repin (opf#208, opf-pptx#147, #148 and #150, and
     opf-editor#75).
   - 40 of 209 analysed failures (19%) were coupling, not defects:
     - the published core lacking a new export (`./convert`, `./patch`,
       `chartPaletteForFill`);
     - lockfiles that cannot resolve until the upstream version is published;
     - the font-policy snapshot against the pinned core;
     - minimum-release-age rejections of a just-published package.
   - Core's `OPF_RENDER_REF` pointed at a merge commit on a throwaway branch,
     diverged from opf-render main by 49 commits, until
     [opf#283](https://github.com/OpenPresentation/opf/pull/283) repinned it
     today.
5. **Conflict hotspots force rebases.**
   - `CHANGELOG.md` is touched by 89% of opf-render PRs, 74% of opf-pptx PRs
     and 78% of opf-editor PRs, and `package.json` by 75%, 70% and 80%.
   - The render `typecheck` and `test` scripts are single `&&` chains of 132 and
     67 entries.
   - 56 of 138 core PRs touched the RR or FF burndown.
     [opf#271](https://github.com/OpenPresentation/opf/pull/271) existed only
     to remove conflict markers from it.
   - Two render PRs that move goldens cannot merge textually: 316 slides moved
     for RR-16 and 147 for RR-17.
   - Pushes per merged PR: p50 1 to 2, p90 6 to 10, max 24.
6. **Flakes are not visible in the data, because nobody re-runs.**
   - Only 3 jobs in the core sample were re-run, and none flipped, so the
     re-run flake rate is about 0. Agents push a new commit instead, which
     costs a full run.
   - By log pattern, 18 of 209 failures (9%) were timing or environment:
     Playwright timeouts, a `NetworkError`, strict-mode locator races, missing
     Clerk keys and a Playwright install hash mismatch. Most of them were in
     pptx-dev e2e (14).
   - opf-editor `test:playground` takes 6.3 min p50 but 15.6 min p90. That
     spread is the variance to watch.
   - One flake was measured directly during this study. On pptx-dev Windows,
     `tests/e2e/inspector-autosave.spec.ts:48` ("an Inspector edit is kept in
     this browser, offered after a reload and restored") passed on attempt 1
     of run 37050499352 and failed on attempt 2 of the same SHA:
     `toBeVisible` timed out after 30 s.
7. **The release train takes hours, but little of that is publishing.** For
   the 0.12.0 train:
   - 12:55, the core release-prep PR
     ([opf#280](https://github.com/OpenPresentation/opf/pull/280)) opened;
   - 14:04, core was on npm;
   - 15:37, opf-render was on npm;
   - 16:16, opf-pptx was on npm;
   - 17:10, the CLI was on npm;
   - 17:15, opf-editor was on npm;
   - 18:37, the release plan
     ([opf#283](https://github.com/OpenPresentation/opf/pull/283)) merged.

   That is 5 h 42 min end to end, of which the five publish workflows took
   about 50 min. The rest is release-prep PR CI, which runs one after another
   because each lockfile needs the upstream on npm, plus the hand-offs between
   steps.

## Current state

### Workflows and timings

Durations are job p50 / p90 in minutes, from the 200-run sample. "Runs/week"
counts every run from 2026-09-25 to 2026-10-02.

| Repository | Workflow: job (OS) | p50 / p90 | Fail % | Runs/week | Notes |
|---|---|---|---|---|---|
| opf | Coordinated public packages: `packages` (ubuntu, Playwright container) | 25.4 / 31.8 | 10 | 484 (350 PR, 134 push) | required; 99 PR and 53 push runs cancelled |
| opf | Coordinated public packages: Installed candidates (windows / macos) | 5.3 / 6.0, 3.8 / 4.5 | 2, 0 | 484 | required |
| opf | OPF CI: Verify OPF packages (ubuntu) | 8.7 / 9.4 | 0 | 485 | required |
| opf | CLI portability: cli (windows / macos) | 11.8 / 12.8, 7.7 / 9.9 | 0 | 290 | path-filtered |
| opf | Published packages matrix (3 OS) | 8 to 11 | release-day failures | 16 | path-filtered, weekly |
| opf-render | CI: package (ubuntu container) | 16.3 / 19.1 | 12 | 322 | |
| opf-render | Platform residual (linux, macos) | 1.7, 1.8 | 7 | 322 | non-blocking; 6 failures parsing the pinned core SHA out of ci.yml |
| opf-pptx | CI: package (windows / ubuntu) | 21.6 / 23.6, 11.1 / 12.3 | 10, 7 | 288 | Windows: native font controls 6.7 min |
| opf-editor | CI: package (ubuntu container) | 11.2 / 21.2 | 16 | 217 | `test:playground` 6.3 / 15.6 |
| pptx-gallery | Validate gallery registry (ubuntu) | about 5 when it runs | 66 (mostly billing) | 116 | runs production checks (Lighthouse, live smoke) on PRs |
| openpresentation-site | Website verification (ubuntu) | 1.8 / 3.8 | 29 (27 billing) | 41 | |
| pptx-dev | Application compatibility (ubuntu / windows) | 5.0 / 10.8, 6.6 / 13.9 | 29, 33 | 44 | no dependency cache |

Run wall clock, which adds the queue and job fan-out:

| Workflow | p50 | p90 |
|---|---|---|
| core ecosystem, PR | 25.7 min | 36.7 min |
| OPF CI, PR | 9.5 min | 20.9 min |
| opf-pptx CI, PR | 22.2 min | 34.5 min |
| opf-render CI, PR | 19.8 min | 35.1 min |
| opf-editor CI, PR | 12.6 min | 25.3 min |

Step profile of core `packages` (job 110962648427, 26.8 min):

| Phase | Minutes |
|---|---|
| Container, checkouts, install, build and link | 1.6 |
| Sibling suites at pinned SHAs (render 10.2, pptx 5.3, editor 0.2) | 15.7 |
| Core ecosystem tests (`test:skills` to `test:slide-images`) | 1.5 |
| Editor demo, packing, packed ecosystem, packed CLI | 1.6 |
| Installed-tarball browser interactions | 1.2 |
| Metric outline browser check | 2.5 |
| Registry installs and registry fidelity | 2.4 |
| Code and metric geometry | 0.3 |

### Cost and capacity

Minutes from the usage report, 2026-09-26 to 2026-10-02 (7 days):

| Repository | Linux | Windows | macOS | Billed? |
|---|---|---|---|---|
| opf | 9,965 | 4,276 | 2,969 | no (public) |
| opf-render | 4,123 | 0 | 608 | no (public) |
| opf-pptx | 2,607 | 4,909 | 0 | no (public) |
| opf-editor | 2,242 | 0 | 0 | no (public) |
| pptx-dev | 427 | 393 | 0 | yes, Windows 2x |
| pptx-gallery | 178 | 0 | 0 | yes |
| openpresentation-site | 81 | 0 | 0 | yes |

The private numbers are low because CI was blocked for four of these days.
September totals were:

- pptx-dev: 838 Linux and 749 Windows minutes;
- openpresentation-site: 295 Linux minutes;
- pptx-gallery: 288 Linux minutes;
- llmreference: 3,008 Linux minutes.

Merge queues are available to public organization repositories, so the four
OpenPresentation repositories can use one. Private repositories on the Free
plan cannot. Runner concurrency is shared across each organization, so every
core PR (seven jobs across three operating systems) competes with sibling CI
for the same runners.

### Reliability

209 failed jobs analysed (the sample plus a week of core failures):

| Category | Count | Examples |
|---|---|---|
| The change under test failed (CI did its job) | 138 | golden diffs, assertions on feature branches |
| Cross-repository or version coupling | 40 | `Verify ... with published dependencies`, `ERR_PACKAGE_PATH_NOT_EXPORTED`, release-prep `npm ci`, font-policy snapshot vs pinned core, `minimumReleaseAge`, "Core history must contain exactly the published versions" |
| Timing or environment (flake candidates) | 18 | Playwright timeouts, `NetworkError`, strict-mode locator races, missing Clerk keys, apt hash mismatch |
| Windows CRLF packing ("Installed runtime differs from the staged package") | 7 | fixed by RR-37 (opf#273, opf-render#108) |
| Golden baseline churn in core's run of the pinned renderer | 6 | "140 / 147 / 246 raster baselines changed" |

The 187 private jobs blocked by billing are not in this table.

### Redundancy

- **The coordinated candidate-tarball block runs in five places.** It is
  `pack:ecosystem`, `test:packed-ecosystem`, `test:packed-browser` and six
  workflow scripts, and it runs in core `packages`, opf-render CI, opf-pptx CI
  (ubuntu and Windows) and opf-editor CI, at 2.0 to 3.2 min each. Core's
  Installed candidates jobs run `test-packed-ecosystem.mjs` again on Windows
  and macOS.
- **Each sibling's own suite runs twice.** It runs in the sibling's CI and
  again in every core `packages` run. Against a pinned sibling SHA that result
  changes only when core changes.
- **`test:pdf-vector` runs twice in every renderer run**, once from
  `typecheck` and once from `test` (2.2 min; fixed by quick win 2).
- **`test:cli:packed` runs four times per core PR**: OPF CI, `packages`, and
  CLI portability on Windows and macOS. Each run covers a different OS or
  install mode, so this is acceptable, but it belongs in one tier.
- **Main pushes repeat the PR run.**
  - Core ran 134 full ecosystem runs on `main` this week. 53 of them (40%)
    were cancelled by the next merge, so 40% of main commits were never
    verified by the ecosystem.
  - The sites run their full suite on the PR and again on the push to main.
- **Docs-only PRs paid for the ecosystem.** 22 of 138 core PRs changed only
  `docs/programs` or `docs/evidence`. They triggered 37 ecosystem runs that
  could not change the result (quick win 1).
- **pptx-gallery runs production checks on every PR.** Lighthouse against
  www.pptx.gallery, the production registry smoke and the remote validate test
  production, not the PR.

### Critical paths

- **A typical cross-repository change (RR-33, numbered lists).** The core PR
  opened at 20:30 and merged at 03:59 (6 pushes). The render and pptx PRs
  opened three minutes after core and merged 41 min after it (10 and 8
  pushes, both repinning CI). The editor PR merged at 10:15 (17 pushes). The
  change reached npm in the 0.12.0 train at 17:15, about 21 h after the core
  PR opened. CI is not the whole of that, but each push costs one sibling CI
  wall clock (12 to 22 min p50, 25 to 35 min p90 with queueing), and the
  coordinated PRs pushed 41 times.
- **The release train** is serial by construction:
  1. core: release PR CI, then publish;
  2. opf-render: release PR CI, then publish;
  3. opf-pptx (it devDepends on the renderer): release PR CI, then publish;
  4. opf-editor: release PR CI, then publish;
  5. the release plan PR.

  Measured 12:55 to 18:37 for 0.12.0. The opf-render release PR alone took
  73 min from open to merge.

## Target design

The principles:

- Each repository's PR CI answers "does this repository work against the
  others' `main`".
- One integration point, the core merge queue plus a scheduled run, answers
  "does the whole set work together".
- Pins are written by a bot, never by hand.
- Nothing a PR does is appended to a shared line.

### 1. Path-aware tiers with required checks that always report

| Tier | Trigger | Runs | Required checks report |
|---|---|---|---|
| T0 notes | every path under `docs/programs/**` or `docs/evidence/**` (no `*.opf.json`) | OPF CI (`pnpm test` reads these) | `packages` and Installed candidates report success from their first step |
| T1 package | anything else in one repository | that repository's full CI against the other repositories' `main` | as today |
| T2 integration | merge queue, push to main, nightly | the full coordinated ecosystem (all four sources, all OS) | `merge_group` |

- **Required checks.** Required checks must never depend on a workflow-level
  `paths` filter: a filtered-out workflow leaves its checks pending forever.
  - The pattern is a gate inside the job (quick win 1), or an aggregator job
    that `needs:` the shards and is itself the required name.
  - A matrix job skipped by a job-level `if:` reports under its unexpanded
    name (`Installed candidates (${{ matrix.os }})`), so matrix legs must be
    gated per step.
  - Gate in the first step rather than in a separate `changes` job. With a
    p90 queue of 11.9 min, a separate job makes every code PR queue twice.
- **Siblings.** opf-render, opf-pptx and opf-editor get the same T0 rule for
  `docs/**`, `README.md` and `CHANGELOG.md`-only changes. That is 2 to 3 PRs
  a week each, so it is low priority.
- **Saving.** About 1,100 runner-minutes a week. T0 PRs get their required
  checks in about 9 min instead of 21 min p50.

### 2. Split the ecosystem job behind an aggregator

`packages` becomes an aggregator that `needs:` three shards and fails if any
of them failed. The check name and the ruleset stay as they are.

| Shard | Content | Estimated minutes |
|---|---|---|
| `ecosystem-render` | renderer typecheck, validate, test (golden) and code checks against linked core | about 10, or 8 after quick win 2 |
| `ecosystem-pptx-editor` | opf-pptx and opf-editor suites | about 7.6 |
| `ecosystem-core` | everything else in today's job | about 11 |

`scripts/test-package-ecosystem.mjs` gains `--siblings <names>` and
`--skip-siblings` flags, and each shard uploads its own evidence.

- **Saving.** Wall clock for `packages` drops from 25.4 to about 12 min p50
  (-53%). Runner-minutes rise by about 3.2 min per run (two more container
  start-ups and installs, about 1,500 min a week), which the merge-queue
  change below more than pays back.
- **Risk.** Low to medium. The commands are identical. The risk is a
  side-effect ordering between the sibling suites and the packing steps; the
  sibling `test` scripts rebuild their own `dist`, which `pack:ecosystem`
  packs. Verify by comparing the packed tarball manifests of the sharded and
  unsharded jobs on one SHA before switching.
- **Migration.**
  1. Add the flags.
  2. Add the shard jobs alongside the current job for one day and compare.
  3. Rename the current job to `ecosystem-core` and add the `packages`
     aggregator in the same PR, so the required name never disappears.
- **Further.** Split the 805-slide golden (5.5 min) across two shards by deck
  index. That is another -2.5 min on the critical path.

### 3. Cross-repository model: bot-owned lock, Depends-On, test against main

Today the integration point is hand-edited SHA pins in four workflow files
plus `OPF_GOLDEN_BASELINE` selections. Replace them with three parts:

- **`ecosystem.lock.json` in core**, written only by a bot. It holds the last
  set of four `main` SHAs that passed T2 together, plus the golden manifest
  each renderer SHA expects.
  - A scheduled roller (hourly, or on `repository_dispatch` from a sibling
    merge) tries `main` of every repository. On green it opens and auto-merges
    a lock-bump PR.
  - A guard step fails any lock entry that is not an ancestor of its
    repository's `main` (`git merge-base --is-ancestor`), so a pin can never
    again point at an unmerged head.
  - Core T1 PRs test against the lock: reproducible, never stale by more than
    one roll.
- **`Depends-On:` trailers for coordinated changes.** A PR body line such as
  `Depends-On: OpenPresentation/opf#264` makes that repository's CI check out
  the named PR head (its merge ref) instead of `main` or the lock.
  - This replaces the throwaway pin branches (`codex/rr-16-combined-rr-32-b`,
    `codex/rr-29-combined-ci-pin`) and the repin PRs (opf-pptx#150,
    opf-editor#75).
  - When the dependency merges, the merge queue (or a re-run) tests the
    dependent PR against `main`, with no edit.
- **Siblings test against core `main` (sources) and the published core
  (`test:packed`).** The published check stays, but it reads the
  `release-plan.json` floor, so it stops failing on exports that are merged
  but not yet released. The coupling failures become a clear "needs release"
  notice instead.

Consumer-driven contracts are the longer step. Each sibling publishes the
subset of its tests that exercise core APIs (golden render, export
determinism, editor patch round trip) as a named contract suite. Core's T1
runs those contracts, and the full sibling suites move to T2 and the nightly
run. That takes the 15.7 sibling minutes off every core PR.

- **Saving.**
  - About 77 sibling PRs a week stop editing pins, and the repin-only PRs (five
    this week) disappear.
  - About 19% of failures (the coupling class) go away.
  - At the RR-34 rate, cutting pushes per coordinated PR from 6 to 24 down to
    2 to 3 saves about 40 pushes per four-repository feature, which is about
    600 runner-minutes and several hours of wall clock.
- **Risk.** Medium. Testing against `main` lets a broken sibling `main` turn
  core PRs red. The lock (T1 uses last-green, not `main`) and the guard
  contain that.
- **Migration.**
  1. Add the guard as a warning.
  2. Generate `ecosystem.lock.json` from today's pins and make the workflows
     read it.
  3. Add the roller.
  4. Add `Depends-On:` parsing in a shared composite action.
  5. Drop the hand pins.

### 4. Merge queue for the four public repositories

- **Change.**
  - Enable the merge queue in the `main` rulesets.
  - Add `merge_group:` triggers to the required workflows.
  - Make the T2 run the queue's check, with batches of up to four.
  - Turn the push-to-main ecosystem run into a cheap post-merge smoke, or
    drop it, since the queue has already tested the exact merge result.
  - Keep `cancel-in-progress` for PRs, but never cancel queue runs.
- **Saving.**
  - Rebase churn ends: the queue rebases and re-tests, and agents stop
    pushing "rebase" commits.
  - Core's 134 main-push ecosystem runs a week (27 min each, 40% cancelled)
    become about 45 batched queue runs, about 2,400 runner-minutes a week.
  - Every `main` commit is verified, against 60% today.
- **Risk.** Low to medium. Queue latency is added per batch, and a flaky
  check ejects a whole batch, so do quarantine (section 7) first.
- **Migration.** This is an owner action: the ruleset change. Agents can
  prepare the `merge_group` triggers in advance; they are harmless without
  the queue.

### 5. Caching and artefact reuse (measured: small, sometimes negative)

Install and setup are not where the time goes.

| Step | p50 |
|---|---|
| Install locked dependencies (core container) | 0.27 min |
| Playwright Chromium install (Windows) | 0.30 min |
| Playwright Chromium install (core Installed candidates) | 0.28 min |
| `pnpm install` (pptx-dev ubuntu, no cache) | 0.55 min |
| `pnpm install` (pptx-dev Windows, no cache) | 1.25 min |

The Linux browser jobs already use the pinned Playwright image.

A cache has to restore faster than the download it replaces, and here it
often does not. pptx-dev had no dependency cache, so a pnpm store cache was
tried as quick win 3
(pptx-dev#75, closed).
Timings are pnpm setup plus setup-node plus install:

| | Before (p50) | With a warm cache |
|---|---|---|
| ubuntu | 39 s | 48 s (the restore alone took 25 s) |
| Windows | 97 s | 109 s (the restore alone took 37 s) |

A cold run also spent 48 to 66 s saving the cache. Native builds still run
either way.

- **Do.**
  - Measure any cache on one warm run before keeping it. Caching the
    Playwright browser on the Windows and macOS legs (the browser install is
    about 0.3 min) is likely to break even at best.
  - Do not reuse Linux-packed tarballs in the Installed candidates legs
    (measured and declined, QW6). It saves at most 36 s per leg, on legs that
    are not on the critical path, and packing on Windows and macOS is part of
    what those legs test: they caught the RR-37 CRLF defect.
  - Fonts come from npm packages and are already covered by the npm and pnpm
    caches.
- **Saving.** Nothing measurable from caching or artefact reuse in this
  pipeline. The time is in the test suites (sections 2 and 3).

### 6. Golden manifests

- **Change.**
  - Store the renderer golden as one file per deck
    (`test/golden/<deck>.sha256.json`, 126 files) instead of one 805-entry
    manifest per baseline. Git merges two PRs that move different decks
    without a conflict.
  - Add a `regenerate-goldens` workflow (label- or comment-triggered) that
    runs in the pinned Playwright container, regenerates only the decks that
    differ, writes `artifacts/golden/diff.json` and the review sheets as
    evidence, and pushes one commit to the PR branch.
  - Review stays human: the diff and sheets are attached.
  - Core's lock (section 3) records which golden set each renderer SHA
    expects, replacing the hand-maintained `OPF_GOLDEN_BASELINE` comments.
- **Saving.** It removes the golden merge conflicts and the "N raster
  baselines changed" re-run loop (6 failures this week, 20 to 30 min each).
- **Risk.** Low. Regeneration must run only in the pinned image; the workflow
  refuses other runners.
- **Result (RR-52, 2026-10-02).** Implemented in
  [opf-render#115](https://github.com/OpenPresentation/opf-render/pull/115)
  (`df50c98`): 13 baselines migrated byte-for-byte to one file per deck (1636
  files), every `OPF_GOLDEN_BASELINE` selection still works, and the
  regenerate-goldens workflow ran on GitHub
  ([run 37082388962](https://github.com/OpenPresentation/opf-render/actions/runs/37082388962)).
  Finding: the old single manifest already merged disjoint decks cleanly (0 of
  400 trials, `scripts/golden-merge-demo.mjs`); the real conflict sources were
  the README prepend and same-deck moves. Different-deck moves plus review notes
  now merge cleanly; same-deck moves still conflict, but in one small file that
  regeneration resolves. The lock seam for RR-50 is opf-render
  `scripts/ecosystem-pins.mjs`.

### 7. Flake quarantine and measurement

- **Measure.** A nightly `repeat` job runs each browser suite five times on
  `main` (opf-editor `test:playground`, the opf-render browser suites, the
  core installed-browser checks, pptx-dev e2e) and records pass rates. This
  is how flake rates get a number, since nobody re-runs today.
- **Quarantine.** A `test/quarantine.json` per repository lists test IDs,
  each with an issue link, an owner and an expiry no more than 14 days out.
  - Quarantined tests run in a separate non-blocking step and are reported.
  - An expired entry fails CI.
  - Adding an entry needs the supervisor's approval in the PR, because it is
    a gate change for that test (README invariant: never relax a gate).
  - Playwright suites use `retries: 1` only to classify a test as flaky in
    the report. A test that needed a retry still fails the job until it is
    quarantined.
- **Saving.** 18 failures this week, each costing a push and a full run (12
  to 25 min).

### 8. Conflict-free changelogs, script lists and trackers

- **Changelogs.** Use per-PR fragment files (`changes/<pr-or-slug>.md` with
  front matter `type: added|fixed|changed`, `packages: [...]`). A release
  script assembles them into `CHANGELOG.md` in the release-prep PR. For the
  core monorepo, Changesets (`.changeset/*.md`) also computes the version
  bumps; for the three single-package repositories a 50-line assembler is
  enough.
- **Script lists.**
  - Replace the `&&` chains with two runners per repository:
    - `scripts/check-syntax.mjs` globs `src`, `test` and `scripts` for
      `node --check`, replacing the 132-entry `typecheck`;
    - `scripts/run-tests.mjs` runs `test/*.mjs`, minus `*-browser*` and the
      files in `test/suites.json`'s `exclude`, in a stable order.
  - Build file lists in `scripts/build.mjs` glob in the same way.
  - Adding a test then touches only the new file.
- **Trackers.** Write program burndown rows and progress-log lines as
  fragments (`docs/programs/<program>/log/<date>-<item>.md`) and generate the
  table and the log, or keep the burndown a supervisor-only batch edit, which
  is the current practice for reconciliations.
- **Saving.** Most of the p90 of 6 to 10 pushes per sibling PR is rebase and
  re-run.
- **Risk.** Low. The release-prep PR has to run the assembler; release
  automation (section 9) does that.

### 9. Release orchestration

One `release-train.yml` (`workflow_dispatch` in core, input: the target
versions) or `scripts/release-train.mjs` run by the supervisor. It does only
what agents do by hand today:

1. Check that the release-prep PRs are merged and that `main` is green with
   that SHA.
2. Push the tags in order: core, then opf-render, then opf-pptx, then
   opf-editor and the CLI.
3. Wait for each repository's own publish workflow.
4. Verify each artefact: `npm view <pkg>@<v> version dist.integrity`, the
   provenance attestation (`npm audit signatures` in a scratch project, or
   the `dist.attestations` field), and the GitHub release.
5. After an upstream is on npm, open the next sibling's release-prep PR
   (floors, `npm install --package-lock-only`, fragments assembled) with
   auto-merge on green.
6. Open the follow-up PR for `release-plan.json`, the compatibility matrix
   and the quickstart.

The trusted-publishing settings do not change: each package is still
published by its own repository's workflow through OIDC with `--provenance`.
The orchestrator only creates tags and PRs.

- **Owner action.** Tags pushed with the default `GITHUB_TOKEN` do not
  trigger other workflows, and tags and PRs in sibling repositories need a
  token scoped to them. That needs a GitHub App (contents and pull-requests
  write on the four repositories) whose key is stored as a core secret.
- **Saving.** The 0.12.0 train (core release PR open to editor on npm) took
  4 h 20 min. The same steps automated are about 1 h 45 min: four release-PR
  CI runs and four publish runs, one after another, with no hand-offs. The
  "Install locked coordinated dependencies" failures on release-prep
  branches (4 this week) also go away.

### 10. Sites and Vercel preview gating

- **pptx-gallery: verify PRs against the PR, not production.**
  - Keep unit, registry, build and browser checks in PR CI.
  - Move the Lighthouse production sample, the production gallery smoke and
    the remote validate to a `deployment_status` workflow on the Production
    environment, and to the existing `workflow_dispatch` / schedule.
  - Add a `deployment_status` workflow for Preview deployments that runs the
    browser smoke against `target_url`, using the Vercel protection-bypass
    secret. Make it a required check, so a gallery or site build change
    merges only after its Linux preview built and passed (the supervisor's
    current manual rule).
- **Vercel Ignored Build Step** (`git diff --quiet HEAD^ HEAD -- . ':!docs'
  ':!*.md'` or a script): skip preview builds for CI-only and docs-only
  changes.
- **pptx-dev Windows leg.**
  - Run it on `master` pushes, nightly, and on PRs that touch
    Windows-sensitive paths (`sdk/cli/**`, `scripts/**`, `playwright.config.ts`,
    `tests/e2e/**`) or carry a `windows` label.
  - This cuts about 70% of the account's largest cost. It reduces PR
    coverage, so it is an owner decision.
- **Budget.** This is an owner decision: raise the Data-Advantage Actions
  budget, or move llmreference's CI elsewhere. Without one of these, the site
  repositories lose CI again around 2026-10-08.
- **Merge queues** are unavailable on private Free repositories. The
  `deployment_status` required check gives the same "verified before merge"
  property for site builds.

## Roadmap

Ordered by value over effort. The savings use this week's volume. The medium
and larger items are burndown items RR-45 to RR-53, and their owner actions
are filed as issues.

### Quick wins, first set

| ID | Change | PR | Saving, measured | Risk |
|---|---|---|---|---|
| QW1 | Ecosystem checks skip on `docs/programs` / `docs/evidence` PRs; required checks still report | [opf#286](https://github.com/OpenPresentation/opf/pull/286), merged | about 1,100 runner-min/week; those PRs green in about 9 instead of 21 min. On the PR, the decision step took under 1 s on ubuntu, Windows and macOS, and a code change still ran everything | low: conservative path list, pushes to main always full |
| QW2 | Renderer runs `test:pdf-vector` once (not also in `typecheck`) | [opf-render#111](https://github.com/OpenPresentation/opf-render/pull/111), merged | `typecheck` 3 s (was 2.38 min p50); renderer job 11.2 min (was 16.3 min p50); about 1,700 runner-min/week once core repins | very low: every `typecheck` caller also runs `npm test` |
| QW3 | pnpm store cache in pptx-dev Application compatibility | pptx-dev#75, **closed** | negative: the warm run was 9 s (ubuntu) and 12 s (Windows) slower, and a cold run adds 48 to 66 s to save the cache (section 5) | none (not merged) |

### Quick wins, second set (supervisor decisions of 2026-10-02)

| ID | Change | PR | Saving, measured | Risk |
|---|---|---|---|---|
| QW4 | Pin the non-container Linux jobs to `ubuntu-24.04` before `ubuntu-latest` moves to Ubuntu 26 on 2026-10-19: OPF CI, published matrix, renderer residual compare, the three sites | [opf#295](https://github.com/OpenPresentation/opf/pull/295), merged, [opf-render#112](https://github.com/OpenPresentation/opf-render/pull/112), merged, pptx-gallery#86, merged, openpresentation-site#63, merged, pptx-dev#76, merged | no time change (same image today); avoids a font or ICU drift incident. The publish workflows are left alone | very low |
| QW5 | Warn when an ecosystem pin is not on the sibling's `main` | [opf#296](https://github.com/OpenPresentation/opf/pull/296), merged | under 1 s. Replayed against the pre-opf#283 pin `1ea2292`, it warns "49 commits not in main" | none (warning) |
| QW6 | Reuse the packed tarballs in the Installed candidates legs | **declined after measuring** | at most 36 s per leg (`pnpm build` 30 s and packing 6 s; the sibling installs are still needed for Playwright and the test scripts), on legs that finish about 20 min before `packages`, so no wall-clock gain. Packing on Windows and macOS is itself under test: those legs caught the RR-37 CRLF defect ("Installed runtime differs from the staged package"), so reusing Linux tarballs would remove coverage | not done |
| QW7 | pptx-gallery runs the production-only checks (production smoke, Lighthouse on www.pptx.gallery, remote validate) after merge, not on PRs | pptx-gallery#85, merged | 51 s of a 223 s p50 PR job (23%), on billed minutes; no production-coupled PR failures | low: they still run on every push to main and on demand |
| QW8 | pptx-dev Windows leg policy: ubuntu on every PR; Windows on master, manual runs, a weekly schedule, and Windows-sensitive or `windows`-labelled PRs | pptx-dev#78, merged | 50 of the last 60 PRs touch a Windows-sensitive path (the lockfile and `package.json` 30, `tests/e2e` 24), so about 17% of PR runs skip Windows: about 170 billed-minute equivalents a month with a weekly drift run. A nightly run would cost about 420 a month, a net loss of about 190, so the PR runs it weekly (vetoable) | low: master pushes always run Windows |

Flakes recorded while measuring, the first quarantine candidates for RR-47:

- pptx-dev Windows, `tests/e2e/inspector-autosave.spec.ts:48`: it failed and
  passed on the same SHA, and failed in 2 of the last 4 Windows runs that
  reached it
  (pptx-dev#77).
- openpresentation-site, `tests/e2e/code-editing.spec.ts:65` ("/playground
  Enter continues bullets"): it failed on attempt 1 of the same commit
  (`f85e318`, the slide still showed "Minimal OPF Deck") and passed on
  attempt 2. It also failed on a `main` push in the sample
  (openpresentation-site#65).

### Medium (one to three days each)

| Item | Change | Saving | Depends on |
|---|---|---|---|
| RR-45 (M1) | Shard `packages` behind the `packages` aggregator (section 2) | core critical path from 25.4 to about 12 min p50 | none |
| RR-46 (M2) | Changelog fragments and globbed script runners in all four repositories (section 8) | ends the CHANGELOG and `package.json` conflict class; fewer rebase pushes | none |
| RR-47 (M3) | Flake measurement (scheduled repeat) and quarantine file (section 7) | numbers for flakes; 18 failures a week stop costing full runs | supervisor sign-off on the quarantine rule |
| RR-48 (M4) | Merge queue on the four public repositories (section 4) | about 2,400 runner-min/week; every `main` commit verified; no rebase churn | owner: [opf#297](https://github.com/OpenPresentation/opf/issues/297); RR-47 first |
| RR-49 (M5) | Vercel preview `deployment_status` checks, production checks on the Production deployment, Ignored Build Step (section 10) | site builds verified before merge without the manual rule | owner: [opf#299](https://github.com/OpenPresentation/opf/issues/299) |

### Larger (a week or more)

| Item | Change | Saving | Depends on |
|---|---|---|---|
| RR-50 (L1) | Bot-owned `ecosystem.lock.json`, roller and `Depends-On:` (section 3) | no hand pins; 19% of failures gone; about 600 runner-min and hours per coordinated feature | RR-45; owner: [opf#298](https://github.com/OpenPresentation/opf/issues/298) (GitHub App) |
| RR-51 (L2) | Release orchestrator (section 9) | 0.12.0-sized train from 4 h 20 min to about 1 h 45 min | RR-46, RR-50; owner: [opf#298](https://github.com/OpenPresentation/opf/issues/298) |
| RR-52 (L3) | Per-deck golden files and the regeneration workflow (section 6) | no golden conflicts; no golden re-run loops | RR-50 (the lock records golden sets) |
| RR-53 (L4) | Consumer-driven contract suites; full sibling suites only in T2 and on schedule | 15.7 runner-min from every core PR run (about 7,600 runner-min/week); with RR-45 the critical path is about 11 min | RR-48, RR-50 |

## Risks

- **Skipping on paths can hide a dependency nobody listed.** QW1 keeps the
  list to paths that a transitive scan showed no ecosystem script reads, runs
  everything on any doubt, and leaves pushes to main at full depth. Re-run
  the scan (it is described in the opf#286 description) when a new script
  starts reading `docs/`.
- **Testing against `main` can turn core red because of a sibling.** The
  lock (RR-50) gives T1 a last-green set; only T2 and the roller see raw `main`.
- **A merge queue amplifies flakes.** One flaky test ejects a batch.
  Measurement and quarantine (RR-47) come before the merge queue (RR-48).
- **The quarantine relaxes a gate for named tests.** It is bounded by expiry,
  issue and supervisor approval, recorded in the PR. Tolerances (0.02 pt
  native, 0.1 / 0.15 reference px) are never quarantined.
- **Release automation needs a credential with cross-repository write.** A
  GitHub App with the minimum permissions on four repositories, no npm token
  and no change to trusted publishing.
- **Private budget.** Until the owner acts, every private-repository merge
  after about 2026-10-08 is unverified by CI.
- **Runner image drift.** `ubuntu-latest` moves to Ubuntu 26 from 2026-10-19.
  Container jobs are pinned; the non-container Linux jobs are pinned by QW4.

## What the owner needs to decide or provide

1. **Data-Advantage Actions budget.** Raise it, or move or limit llmreference
   CI. Otherwise site CI stops again around 2026-10-08.
2. **pptx-dev Windows leg policy.** Decided by the supervisor on 2026-10-02
   (vetoable) and implemented in
   pptx-dev#78, with a
   weekly drift run instead of a nightly one, for the measured reason in QW8.
3. **Merge queue** on the OpenPresentation `main` rulesets (RR-48,
   [opf#297](https://github.com/OpenPresentation/opf/issues/297)), after RR-47.
4. **A GitHub App** for cross-repository tags and PRs (RR-50, RR-51,
   [opf#298](https://github.com/OpenPresentation/opf/issues/298)), installed on
   the four OpenPresentation repositories with contents and pull-requests
   write.
5. **Cursor Bugbot** is out of quota and reports "skipping" on every PR.
   Restore the quota or uninstall it, so the check list shows only real
   checks.
6. **Vercel protection-bypass secret** and the preview check as a required
   status on the site repositories (RR-49,
   [opf#299](https://github.com/OpenPresentation/opf/issues/299)).
