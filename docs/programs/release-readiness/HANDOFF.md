# Release readiness: handoff of 2026-10-02

Written by the supervisor session on 2026-10-02 before the working machine was shut down. A new supervisor resumes from
this file, [README.md](README.md) (goal, definition of done, invariants, resume protocol) and [burndown.md](burndown.md)
(items, the **Now** work queue, progress log). Nothing in this file overrides the README's invariants.

## State at handoff

- Tracker: `pnpm report:release` printed 32 of 44 items closed. Gallery tracker: 1101 records, 1101 addressed,
  381 done. Run `pnpm report:release -- --live` for the current state of every linked pull request.
- Published and verified (npm `latest`, `gitHead` = release merge commit, npm publish and SLSA provenance attestations):
  `@openpresentation/opf` 0.12.0, `opf-render` 0.12.0, `opf-pptx` **0.12.1**, `opf-editor` **0.11.1**,
  `@openpresentation/cli` 0.10.0. The three sites run this set (autosave, PDF/PNG/SVG downloads, `<opf-deck>` player).
- Unreleased on main: opf-pptx#154 (Viet/Uigh own-script theme supplement; native-verified). It ships in the next
  opf-pptx patch (0.12.2), followed by the release-plan and site bumps (as opf#306 and the site PRs did for 0.12.1).
- Native PowerPoint evidence committed today: `docs/evidence/ff-46-native-0.12-20261002/` (all 168 font families, name
  read-back), `docs/evidence/rr-42-native-20261002/` (880 of 881 gallery values, every gated check; theme colours on the
  33 design decks), `docs/evidence/rr-17-viet-supplement-native-20261002/` (the 881st), `docs/evidence/ff-05-native-20261002/`,
  `docs/evidence/rr-05-cjk-native-20261002/`, `docs/evidence/rr-05b-native-20261002/`.

## Work in flight at shutdown

Each agent was told to push its work as a **draft pull request whose body ends with a `## Resume` section**. Find them
with `gh pr list --state open` in each repository (core, opf-render, opf-pptx, opf-editor, pptx-gallery,
openpresentation-site, pptx-dev). Expected:

| Work | Item | Where | What is left |
| --- | --- | --- | --- |
| Open-font host baselines: 38 `baseline-needed` font-tracker families to `qualified` (per-host fixtures node/browser/editor/gallery editor plus acceptance records) | RR-17 | [opf#311](https://github.com/OpenPresentation/opf/pull/311) (draft, placeholder) | not started. Finding: the builder derives `qualified` only for `latinOnly` families, so the 35 script, emoji and math faces among the 38 need a builder rule extension plus fixtures; Liberation Mono/Sans/Serif only lack the gallery-editor fixture |
| Script faces (41 `script-gap`), Cambria Math and Segoe UI Emoji (`visual-gap`), Symbol/Wingdings/Webdings (`code-table`) to `documented-visual`: measured gaps against the real fonts (widths, line breaks, vertical metrics, outlines, coverage) | RR-17, FF-46 | [opf#308](https://github.com/OpenPresentation/opf/pull/308) (draft, placeholder) | not started; the measurements need the real fonts (Windows `C:\Windows\Fonts`) and the native PNGs, which lived only in the old machine's scratch folder: regenerate the FF-46 decks (see "Native runs") if they are not committed. Didot is Apple-only: Mac mini work |
| Parity: classify computed value-axis ticks (15 charts `parity-near`) | RR-44 | draft PR `RR-44: …` | finish, re-run parity |
| Re-audit on the published set (works count, full parity run, audits) and link it from RR-20 and [release-notes-0.12.0.md](release-notes-0.12.0.md) | RR-20 | draft PR `RR-20: re-audit …` | run, commit results, regenerate the gallery tracker |
| Installed FF-38 parity audit per OS (ubuntu, windows, macos) | RR-04 | draft PR `RR-04: …` | run, commit evidence, close RR-04 |
| Gallery pages for 38 narratives, 9 purposes and the real audiences; deprecate the 6 plural audience duplicates in core | opf#291 | [opf#309](https://github.com/OpenPresentation/opf/pull/309) (draft: deprecate executives, investors, customers, sales-team, marketing-team, regulators with `replacedBy`; move the 81 examples and engine-defaults to the singular ids first) and [pptx-gallery#88](https://github.com/Data-Advantage/pptx-gallery/pull/88) (draft: pages for 38 narratives, candidates and engineering-team, 9 purposes; remove the `/purposes` JSON redirect in lib/opf-catalog-routes.ts) | not started; core change first if catalog content changes, then release, then the gallery bump |
| Editor switches for slide size and purpose; a pptx.gallery slide-size page | opf#293 | [opf-editor#80](https://github.com/OpenPresentation/opf-editor/pull/80) (draft: first cut in src/switches.js, untested) | finish (SWITCH_DIMENSIONS, currentSwitchValue/listSwitchOptions, types, tests, design-controls selects), editor patch release, then the gallery |
| The 385 gallery-only layouts and 4 legacy pairings: measure the size cost, then bundle into core (rule: under about 1.5 MB packed growth and no meaningful renderer/editor bundle growth) or make "subset" an explicit decision | opf#292 | [opf#310](https://github.com/OpenPresentation/opf/pull/310) (draft, placeholder) | measure (no numbers yet), then finish the decision and the sync |
| CI/CD study ([ci-cd.md](ci-cd.md) once merged) and roadmap items renumbered RR-45 to RR-53 | RR-40 | opf#290 | finish the renumbering (the gallery tracker owns RR-41 to RR-44), merge main, regenerate trackers, merge |
| openpresentation-site `tests/e2e/code-editing.spec.ts:65` fails most runs (blocks site CI) | RR-47 | draft PR in openpresentation-site, if pushed | fix the wait (no looser assertions), prove 5 consecutive green runs |

Other open items (Now table): RR-02 (watch three green pptx-dev master runs, then close), RR-03 (close FF-08 now that
FF-05 shipped in opf-pptx 0.12.1; FF-27 review), RR-05 (the CJK/Thai FF-12 sample passed on 2026-10-02: close with
`docs/evidence/rr-05-cjk-native-20261002/`), RR-14 (merged behind default-off flags; live fixtures wait for the owner to
turn the feature on), RR-18 (refresh roadmap issues opf#87 and #88 for 0.12.1/0.11.1, then close), RR-19 (housekeeping,
below), RR-42 (merged: opf#305 and #307; close), RR-20 (re-audit, then the owner reviews the release note).
Several Now rows were stale at handoff (RR-03, RR-05, RR-14, RR-17, RR-18, RR-42): refresh them first.

## Owner actions outstanding

- **Urgent:** raise the Data-Advantage GitHub Actions budget before about 2026-10-08, or limit `llmreference` CI (it was
  53% of September's spend); otherwise site CI stops (RR-40 finding).
- Optional: merge queue (opf#297), a GitHub App for pins/PRs/tags (opf#298), Vercel protection bypass and a required
  preview check (opf#299), Cursor Bugbot quota.
- Mac mini: Didot qualification, PDFKit/Preview check of the vector PDF, PowerPoint for Mac, Keynote/Quick Look,
  Safari/WebKit.

## Decisions taken on the owner's behalf (vetoable; also in the README decision log and the release note)

Arabic default stays Arabic Typesetting with preview `sizeAdjust` 0.64 and `lineAscent` 0.70/0.78; RR-39 (CJK/Thai line
breaking) descoped (opf#278); single-series bar/column charts in one colour; editor crop baked into a new asset;
Windows Chromium whole-pixel ink tolerance in the timeline workflow test; the core `packages` job timeout 40 min;
core main requires the per-PR cross-platform checks (ruleset 24382980: `packages`, `Installed candidates` on windows
and macos, `Verify OPF packages`; owner-approved); FF-37 catalog drift check runs in pptx-gallery (no secret); pptx-dev
uses Claude Sonnet 5.5 (`anthropic/claude-sonnet-5-5`, owner decision) with budget guards (10 reconstructions/hour,
60 slides/20 MB, 16k output tokens) and a privacy notice; pptx-dev's Windows CI leg runs on master, weekly and on
Windows-sensitive paths or the `windows` label; FF-05: theme `ea` never empty, run-level `ea`/`cs` not written,
`endParaRPr` kept; RR-42 native evidence for every gallery value.

## Native PowerPoint runs (Windows plus desktop PowerPoint only)

Only the supervisor runs Office (README invariants). Pattern used today: decks built by an agent with the published
packages, a `RUN.md`, helpers `run-deck.ps1` (one deck per child `powershell.exe`, 90 s deadline, stops only its own child
by PID) and `native-read-deck.ps1` (attaches to a running PowerPoint with `GetActiveObject`, opens read-only with
`Presentations.Open(path, -1, 0, 0)`, never saves, quits or kills PowerPoint), then `compare.mjs` and committed evidence
(no decks, no PNGs, no absolute paths). Run them with `powershell.exe -NoProfile -NonInteractive -ExecutionPolicy Bypass
-File …`. Start PowerPoint first if it is not running. The decks and helpers of today's runs were in the old machine's
scratch folder and are **not** in the repository; the evidence READMEs describe how each set was built, so regenerate
from them.

## Housekeeping (RR-19)

The old machine's scratch worktrees were registered in its local clones; they disappear with the machine and need no
action elsewhere. Delete merged `codex/*` branches on GitHub once their PRs are closed (`gh api -X DELETE
repos/<r>/git/refs/heads/<branch>`), never a branch that is the base of an open PR.

## Supervisor tooling that lived outside the repository

A REST-only merge watcher (GraphQL hit secondary rate limits): for each `owner/repo:N`, poll every 5 minutes; skip
non-open PRs; report `dirty` as needs-rebase; take the **latest run per check name** (`group_by(.name) | max_by(.started_at)`),
ignore `Cursor Bugbot`; merge with `PUT /repos/{r}/pulls/{n}/merge` (`merge_method=squash`) when every check completed
without failure; then delete the head branch unless an open PR uses it as its base. Tags for releases are created with
`POST /repos/{r}/git/refs` (`refs/tags/<tag>`) on the verified merge commit after checking the version in `package.json`
at that commit, then npm is polled until the version is visible and `gitHead` and attestations are checked.
