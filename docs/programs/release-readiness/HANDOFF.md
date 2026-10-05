# Release readiness: handoff of 2026-10-05

Written by the supervisor session, refreshed 2026-10-05 (b) (first written 2026-10-03). It replaces the handoff of 2026-10-02 (written before the old Windows
machine was shut down). A new supervisor resumes from this file, [README.md](README.md) (goal, definition of done,
invariants, decision log, resume protocol) and [burndown.md](burndown.md) (items, the **Now** work queue, progress log).
Nothing in this file overrides the README's invariants.

## State

- Tracker: `pnpm report:release` prints the item counts (43 of 53 closed at this handoff; the open items are RR-03, RR-05,
  RR-14, RR-17, RR-19, RR-20, RR-48, RR-49, RR-51, RR-53). Run `pnpm report:release -- --live` for the live state of every
  pull request a Now row links.
- Published and verified (npm `latest`, `gitHead` = release merge commit, SLSA provenance, `npm audit signatures`):
  `@openpresentation/opf` **0.12.1** (2026-10-03, the first train run by `scripts/release-train.mjs`), `opf-render` 0.12.0,
  `opf-pptx` **0.12.3** (2026-10-05, via `scripts/release-train.mjs`: gitHead `11889646` = the tag; it fixes the embedded
  workbook table range that made Keynote drop category charts, opf-pptx#162 and opf-pptx#163), `opf-editor` **0.11.2**,
  `@openpresentation/cli` 0.10.0. The three sites run this set (pptx-gallery#94 and #96, openpresentation-site#75 and #76,
  pptx-dev#92; the opf-editor lockfile stays as it is by precedent, its CI links siblings through `ecosystem.lock.json`).
  The patch releases up to 0.12.3 are described in the addendum of [release-notes-0.12.0.md](release-notes-0.12.0.md) (0.12.3 and the
  pending 0.13.0 migration are added in [opf#349](https://github.com/OpenPresentation/opf/pull/349), open). Core's release plan records 0.12.3 in
  [opf#346](https://github.com/OpenPresentation/opf/pull/346) (merged, `05ed089`).
- Hosting: all three sites serve production from Cloudflare Workers, cut over 2026-10-05 with zero downtime. openpresentation.org
  and pptx.gallery: rollback is `proxied=false` on the DNS records. pptx.dev (~18:08 UTC): Worker custom domains for www, apex,
  api. and mcp.; the `*.pptx.dev` wildcard is still on Vercel; HSTS two years and Always Use HTTPS; rollback is detaching the
  four domains and restoring the four A records from the backup. pptx.dev runs on the Clerk development instance and a dev
  Convex deployment for now (owner decision 2026-10-05, no production users yet). The deploy-on-main workflows (CF-04) are
  merged and skip until the owner adds the secrets. See [docs/programs/cloudflare-hosting/](../cloudflare-hosting/README.md).
- Upstream: PptxGenJS is dormant ([gitbrent/PptxGenJS#1537](https://github.com/gitbrent/PptxGenJS/pull/1537) submitted);
  the migration to the maintained fork `pptxgenjs-plus` (MIT) is in progress for opf-pptx 0.13.0
  ([opf-pptx#165](https://github.com/OpenPresentation/opf-pptx/pull/165), throwaway ecosystem run
  [opf#344](https://github.com/OpenPresentation/opf/pull/344)). Its Keynote m-set passes (20 WARN, 0 FAIL, every chart kept); the
  Windows PowerPoint a/b set ([opf#323](https://github.com/OpenPresentation/opf/issues/323)) is the remaining gate. Upstream
  [lofcz/pptxgenjs-plus#15](https://github.com/lofcz/pptxgenjs-plus/pull/15) (bubble ref) is merged to their `next`, unreleased.
- Open pull requests (all repositories): [opf#335](https://github.com/OpenPresentation/opf/pull/335) (RR-53 core contract
  tier, ready, parked), [opf#349](https://github.com/OpenPresentation/opf/pull/349) (RR-20 release note covers opf-pptx
  0.12.3) and [opf#308](https://github.com/OpenPresentation/opf/pull/308) (draft, an old RR-17 placeholder for script-face
  documented-visual measurements; Windows host). The opf-pptx migration PR (opf-pptx#165) is also open. opf#325, the lock
  roll (opf#345) and the opf-pptx 0.12.3 release plan (opf#346) are merged.
- Native PowerPoint evidence is under `docs/evidence/` (`ff-46-native-0.12-20261002`, `rr-42-native-20261002`,
  `rr-17-viet-supplement-native-20261002`, `ff-05-native-20261002`, `rr-05-cjk-native-20261002`, `rr-05b-native-20261002`);
  Keynote evidence (opf#341) is under `docs/evidence/mac-checks-20261002/keynote`.

## Open, and who it waits on

Owner actions:

- **Urgent:** raise the Data-Advantage GitHub Actions budget before about 2026-10-08, or limit `llmreference` CI (it was
  53% of September's spend); otherwise site CI stops (RR-40 finding).
- Merge queue, [opf#297](https://github.com/OpenPresentation/opf/issues/297) (RR-48, then RR-53: the supervisor merges
  [opf#335](https://github.com/OpenPresentation/opf/pull/335) and measures a queued run).
- GitHub App, [opf#298](https://github.com/OpenPresentation/opf/issues/298) (RR-50 follow-up, RR-51 criterion a): App id
  and key secrets, uncomment the ecosystem roller schedule, set `ECOSYSTEM_LOCK_GUARD=blocking` (the first roll,
  [opf#333](https://github.com/OpenPresentation/opf/pull/333), is merged, so this can be set now).
- Windows run, [opf#323](https://github.com/OpenPresentation/opf/issues/323) (deferred by the owner): the native pass on the
  published set (RR-20), FF-12/FF-13/FF-46 and the a/b set that also gates opf-pptx 0.13.0 (the pptxgenjs-plus migration).
- CF-04 secrets in two repositories (openpresentation-site and pptx-gallery): `CLOUDFLARE_API_TOKEN` (Workers Scripts: Edit and
  Account Settings: Read) and `CLOUDFLARE_ACCOUNT_ID`; until then the deploy-on-main workflows skip and the production checks
  do not run.
- CF-05 (signed-in e2e in pptx-dev with `@clerk/testing`): a Clerk test user (a `+clerk_test` address) on the development
  instance and the Actions secrets for it.
- RR-49 descope decision (README, Open decisions 5): whether to drop the Vercel parts (the preview `deployment_status`
  checks, the bypass secret [opf#299](https://github.com/OpenPresentation/opf/issues/299) and `PREVIEW_SMOKE_ENABLED`) now that
  production is on Cloudflare. No Vercel setting needs to be made while this is open.
- RR-14 launch: the flags are Worker / build variables now (`UNDERSTAND_DECK_ENABLED`, `UNDERSTAND_DECK_ALLOWLIST` as Worker
  variables, `NEXT_PUBLIC_UNDERSTAND_DECK` as a build variable); `AI_GATEWAY_API_KEY` is already a Worker secret (2026-10-05).
  Left: confirm the AI Gateway $50 per month limit and rotate the old key if the removed `.env.example` value was real.
- Production Clerk and Convex for pptx.dev when real users arrive (it runs on the Clerk development instance and a dev Convex
  deployment for now, owner decision 2026-10-05).
- Didot reroute decision (keep the Didone look-alike Playfair Display, or a metric-closer face; README open decisions).
- Review of [release-notes-0.12.0.md](release-notes-0.12.0.md) with its addenda for 0.12.1 / 0.12.2 / 0.11.2 and 0.12.3
  ([opf#349](https://github.com/OpenPresentation/opf/pull/349), open until merged).
- RR-19 leftovers: the 19 kept worktrees with uncommitted or unpushed work (the list is in the supervisor's scratchpad
  `wt-kept.txt`; e.g. opf-pptx ff-32 rich-metadata, rich-source and extension worktrees, pptx-gallery gallery41/42/44-45
  reviews, pptx-dev app58 with 266 modified files), and the `archive-*`, `shared-furniture-*` and `claude/*` branches.
  `~/.codex/worktrees` is untouched. Deletion candidates from the RR-46 follow-up in opf-pptx: `compare-published.mjs`
  (pinned to 0.5.0) and `native-furniture-fixtures.mjs`.
- Cursor Bugbot quota (optional).

Windows host: [opf#323](https://github.com/OpenPresentation/opf/issues/323) (deferred by the owner while the supervisor works
on the Mac mini): FF-12 re-run of `lang-ja-meiryo` and the missing sample decks (RR-05), FF-13, the FF-46 script
measurements ([opf#308](https://github.com/OpenPresentation/opf/pull/308)), FF-27 renumber observation (RR-03), and the
native pass on the published set (RR-20).

Mac mini: the Keynote checks are done (2026-10-05, opf#341): the 20-deck set on opf-pptx 0.12.2 lost 6 native category charts; the
fixed decks (built from the fix branch before the release) have 0 failures. The Keynote m-set of the pptxgenjs-plus migration (opf-pptx#165) has 20 WARN, 0 FAIL with every chart kept, and pptx-dev's own
generator fix (pptx-dev#93) went from 0 of 7 charts kept to 7 of 7. The PowerPoint re-check of the fix goes with the
Windows runs in opf#323. Keynote is opened read-only, never saved, only by the supervisor.

The openpresentation-site playground e2e flake (`tests/e2e/code-editing.spec.ts`) is fixed at the root in
openpresentation-site#78 (a no-op update in `JsonEditor` reset a DOM
selection; deterministic regression test, 5 consecutive green CI attempts).

Parked: [opf#335](https://github.com/OpenPresentation/opf/pull/335) (ready, not merged) until the merge queue is enabled.

## Supervisor tooling now in the repository

- `scripts/release-train.mjs` (`plan`, `prep`, `tag`, `verify`, `run`; `verify --wait`) and the plan-only
  `release-train.yml` (RR-51); the release procedure stays in [docs/release-process.md](../../release-process.md).
- `ecosystem.lock.json`, `scripts/ecosystem-lock.mjs` and `scripts/ecosystem-roll.mjs` (RR-50): the pins are bot-owned; roll
  by dispatching the roller and open the PR yourself until the App exists (the 2026-10-05 roll, run 37284305990, is opf#345); `Depends-On:` trailers for cross-repository PRs.
- `scripts/quarantine.mjs` and `test/QUARANTINE.md` (RR-47): flake quarantine with a supervisor approval note.
- Changelog fragments: `changes/<slug>.md`, assembled by `node scripts/changelog-fragments.mjs assemble --version X.Y.Z` in
  the release-prep PR (RR-46); test files are globbed by `scripts/run-tests.mjs`.
- `pnpm report:release` and `pnpm check:release-report` for the tracker; `pnpm build:gallery-tracker` and
  `pnpm build:font-tracker` regenerate the trackers (the burndown statuses are inputs; `tracker-refresh.yml` regenerates
  after merges).
- Merge watching stays REST-only (GraphQL hit secondary rate limits): per `owner/repo:N` poll every 5 minutes, take the
  latest run per check name, ignore `Cursor Bugbot`, merge with `PUT /repos/{r}/pulls/{n}/merge` (`squash`) when every check
  completed without failure, then delete the head branch unless an open PR uses it as base.

## Decisions taken on the owner's behalf

All are vetoable and dated in the README decision log. The latest (2026-10-03): RR-50 done without the App; RR-51 tag gates on
the release commit's checks; RR-53 no PR-tier reduction before the queue exists; core 0.12.1 without re-releasing the
siblings; the 307 redirect for plural audience URLs; RR-19 leftovers go to the owner.

## Native PowerPoint runs (Windows plus desktop PowerPoint only)

Only the supervisor runs Office (README invariants). Pattern: decks built by an agent with the published packages, a `RUN.md`,
helpers `run-deck.ps1` (one deck per child `powershell.exe`, 90 s deadline, stops only its own child by PID) and
`native-read-deck.ps1` (attaches to a running PowerPoint with `GetActiveObject`, opens read-only with
`Presentations.Open(path, -1, 0, 0)`, never saves, quits or kills PowerPoint), then `compare.mjs` and committed evidence (no
decks, no PNGs, no absolute paths). Run them with `powershell.exe -NoProfile -NonInteractive -ExecutionPolicy Bypass -File …`.
The decks and helpers of the 2026-10-02 runs are not in the repository; the evidence READMEs describe how each set was built.
