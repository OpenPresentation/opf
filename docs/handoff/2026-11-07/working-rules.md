# Working rules for the agent that continues this work

These rules apply on top of the repository's [AGENTS.md](../../../AGENTS.md), and AGENTS.md wins if the two disagree. They were refined over the 2026-11-07 session; most exist because something went wrong once.

## Setup
- Repository: OpenPresentation/opf, one pnpm workspace with seven npm packages at one version. Node 24, pnpm as pinned in `package.json`.
- Work in your own worktree from fresh `origin/main`: `node scripts/agent-worktree.mjs add <task>`. On Windows, keep worktrees under a short path such as `C:\opf-work\<task>`; long paths break esbuild and Biome.
- Never switch the branch of a checkout someone else uses.

## Each change
- One PR per item, or one small coherent group. Branch `codex/<program>-<nn>-<slug>`; the PR title starts with the item ID (`LH-175: ...`, `SH-12: ...`, `RR-105: ...`).
- Every package-code change gets a `changes/<slug>.md` fragment (see `changes/README.md`). Never edit a `CHANGELOG.md`.
- Update the item's burndown row and append a dated progress-log line in the same PR (`docs/programs/<program>/burndown.md`).
- Run `pnpm check:changed` before pushing. On Windows, `check:text`, `check:browser-safe` and `script-width-estimates` fail in blobless worktrees (they need `docs/evidence`); `keynote-registry-runtime` fails on symlink EPERM. Those are environment failures, not regressions.
- Never weaken an assertion to get green.
- To bring a branch up to date, merge `origin/main` into it and push normally. Don't rebase and force-push.

## CI and merging
- CI capacity is the bottleneck. The repository's concurrent-job limit is shared by everything, so batch.
- **Batching:** fold reviewed PRs into one wave integration PR, so CI, the nightly set (`full-ci` label) and golden regeneration run once per wave. Precedents: #1055, #1063, and the v0.33.0 integration PR listed in [README.md](README.md). Use `Closes #<n>` lines so the folded PRs close on merge. Never push to a folded PR's branch again.
- Push as few times as possible. Use the `full-ci` label only for OS- or Node-specific changes, or once per wave.
- Goldens (`packages/render/test/golden/`) are exact hashes. Regenerate them only by dispatching the workflow: `gh workflow run golden.yml --ref <branch>`. The `regenerate-goldens` label does not exist. A commit pushed by golden.yml starts no CI, so merge `origin/main` in (or push once) afterward to start `verify`.
- Watch and merge only with `node scripts/pr-gate.mjs OpenPresentation/opf#<n> --expect-head <FULL 40-char sha> [--merge] [--required all]`, as one background process. A short SHA reads as "head moved". Never write polling loops; the GitHub REST quota (5,000 an hour) is shared.
- Review before merging. Merging without review was blocked in this session: read the diff and, for output-changing work, the before/after sheet, then merge.

## Output-changing layout, chart or shape work
- Produce a before/after sheet (PNG) of every slide the change moves, with Claude Design's version alongside where the corpus has it. Put the sheet in the PR, as an attachment or by describing its rows.
- The owner's direction, which is binding: bodies fill the slide; type grows and is centered; never shrink text when another arrangement works; the owner reviews sheets. Reject a change that moves things around but leaves type small. Reject one-column lines past the reading measure (about 70 characters).
- Record every judgment call as a **vetoable decision** in the burndown progress log and the PR body.

## PowerPoint (COM) work
- PowerPoint COM is allowed (owner authorization); UI control is not. Mark anything that needs the UI (the Accessibility Checker, Edit Data, adjust handles) "not run".
- Only one process may drive PowerPoint at a time. Before every run, check that no `POWERPNT.EXE` is running. `New-Object -ComObject PowerPoint.Application` attaches to a running instance, and `Quit()` would then close the owner's PowerPoint.
- Never kill Office. Open files read-only. Close only the presentations your script opened, and quit only when none is open.
- On this PowerPoint build (16.0.20527), `Application.SmartArtLayouts` is unavailable to scripts. Seed graphics from an existing deck with `$shape.SmartArt.Layout` (see [com-job-sh-08.md](com-job-sh-08.md)), and read COM collections by index, not with `@(...)`.
- Keynote: open read-only and never save.

## Hard limits (owner rules)
- No deploys, DNS changes or logins. Releases only through the Release workflow (see [docs/release-process.md](../../release-process.md)); npm publishing is authorized only through that workflow.
- American English.
- No banned vendor names anywhere (RR-103; check with `git grep -i`).
- No public support, parity or progress badges on pptx.gallery.
- Fonts: OFL, Apache-2.0, MIT or UFL only, bundled and never hotlinked.
- Fewest dependencies, newest versions, no audit ignores, no code that covers for a package.
- No deprecations or aliases before 1.0: remove outright and update callers.
- OPF ships only what its own engines render at high fidelity. Other apps' formats are import sources only.
- PPTX export tiers: live SmartArt if OPF renders it identically, else editable shapes and text, else SVG.
