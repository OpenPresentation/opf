# Rules for supervisor-dispatched OPF agents (2026-11-07)

You were started by the OPF supervisor session ("OPF Supervisor for agent coordination"). The owner is away. Work autonomously to finished, merged, tested PRs. Make reasonable calls yourself; record each call that changes behavior as a vetoable decision in the burndown progress log and in the PR body.

## Setup
- Repository: `C:\Users\micha\Source\opf` (OpenPresentation/opf). Read `AGENTS.md` first, then the program README/burndown for your items (`docs/programs/<program>/`).
- Never work in or switch the user's checkout. Make your own worktree: `node scripts/agent-worktree.mjs add <task>` (it lands in `C:\opf-work\<task>`; in Git Bash use `/c/opf-work/...`). Remove it when your last PR merges: `node scripts/agent-worktree.mjs remove <task>`.
- In PowerShell, set `$env:npm_config_store_dir = 'C:\opf-work\.pnpm-store'`.

## Each change
- One PR per item, or per small coherent group. Branch `codex/<program>-<nn>-<slug>` (for example `codex/lh-175-pareto`). PR title starts with the item ID (`LH-175: ...`, `SH-12: ...`, `RR-1nn: ...`).
- Every package-code change gets a `changes/<slug>.md` fragment (see `changes/README.md`). Never edit a CHANGELOG.
- Update the burndown row and append a dated progress-log line in the same PR.
- Run `pnpm check:changed` before pushing. Leave the full `pnpm test` to CI.
- Tests: one new `test/*.mjs` per package test. Never weaken an assertion to get green.
- Goldens: regenerate only by dispatching the `golden.yml` workflow on your branch (`gh workflow run golden.yml --ref <branch>`; the `regenerate-goldens` label does not exist in this repository). Never by hand, never with a changed tolerance. Trackers: do not regenerate them unless your PR changes a tracker generator.
- **Merging is the supervisor's job.** Agents' `--merge` is blocked ("merge without review"). Open the PR and watch it with `node scripts/pr-gate.mjs OpenPresentation/opf#<n> --expect-head <sha>` (no `--merge`) as ONE background task. `--expect-head` takes the FULL 40-character SHA (a short one reads as "head moved"). When it is green, say "ready to merge: #<n> at <full sha>" in your summary or by SendMessage to the supervisor. The supervisor reviews and merges. Use the gate Never write a polling loop; never use `gh pr checks` or `gh run view` in a loop. The GitHub REST quota is shared. A flaky unrelated job: `gh run rerun <run id> --failed` once, then re-run the gate. Merge (squash) when `verify` is green. Add the `full-ci` label if you touch OS- or Node-specific code.
- Bring your branch up to date by merging `origin/main` into it (`git merge origin/main`, then a normal push). Do not rebase and force-push: force-push is blocked here, and PRs are squash-merged anyway. Other agents are changing core composition at the same time.

## Batching (from 2026-11-07, the owner's request)
- The supervisor folds reviewed PRs into wave integration PRs (one CI run, one `full-ci` run, one golden run per wave). Your PR is a review unit, not a merge unit. Push once, skip `full-ci`, and don't dispatch golden.yml unless the supervisor asks.
- Once a PR is folded, never push to its branch again.

## CI capacity (shared, saturated)
- GitHub runs only a limited number of jobs at once for this repository, and every agent shares them. The v0.33.0 PRs go first.
- Push as few times as possible: finish and test locally, then push once. Do not push "fix typo" follow-ups one by one.
- Use the `full-ci` label only if your change is OS- or Node-specific. Dispatch `golden.yml` only after the supervisor has approved your sheet. Never re-run a job more than once.
- Never cancel another agent's runs.

## Output-changing layout or chart work
- Produce a before/after sheet (PNG) of every slide your change moves, using the existing review-sheet scripts. Put it in `C:\opf-work\_supervisor\sheets\<item>.png` and link it in the PR body.
- The owner's direction: bodies fill the slide; type grows and is centered; never shrink text to fit; review sheets before approving. If a change makes a slide worse by that rule, do not ship it.
- Report the sheet path to the supervisor in your final summary. The supervisor reviews sheets before merge for output-changing items: open the PR, put the sheet in the PR, and enable the gate with `--merge` only after the supervisor says "approved", unless your item changes no slide.

## Hard limits
- Do NOT start PowerPoint, Keynote or any Office app. Only the qualification session drives PowerPoint on this PC. If you need COM evidence, say exactly what deck and what measurement in your final summary, and the supervisor will schedule it.
- No deploys, no DNS, no logins, no npm publish, no releases. The supervisor releases.
- Owner rules: American English. No vendor API or third-party product names that the owner banned (see RR-103). No public support/parity badges. Fonts only OFL/Apache/MIT/UFL, bundled, never hotlinked. Fewest dependencies, newest versions, no audit ignores, no custom code that covers for a package. No deprecations or aliases pre-1.0: remove outright and update callers.
- Do not touch files another agent owns unless your item needs it. If you hit a conflict, rebase and keep both changes.

## Final summary (your last message)
For each item: the PR link, merged yes or no, what changed, the sheet path if any, decisions made, anything left, and the COM evidence needed. Keep it short.
