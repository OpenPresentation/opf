# Release readiness: handoff of 2026-10-06

Written by the supervisor session, refreshed 2026-10-06 (first written 2026-10-03). It replaces the handoff of 2026-10-05. A new
supervisor resumes from this file, [README.md](README.md) (goal, definition of done, invariants, decision log, resume protocol)
and [burndown.md](burndown.md) (items, the **Now** work queue, progress log). Nothing in this file overrides the README's
invariants.

## State

- Tracker: `pnpm report:release` prints the item counts (46 of 54 closed at this handoff; the open items are RR-14, RR-17,
  RR-19, RR-20, RR-48, RR-51, RR-53 and RR-54, which is in review). RR-03 and RR-05 closed on 2026-10-06 on the Windows
  native evidence; RR-54 (chart and table data) is new. Run `pnpm report:release -- --live` for the live state of every pull
  request a Now row links.
- Published and verified (npm `latest`, `gitHead` = release merge commit, SLSA provenance, `npm audit signatures`):
  `@openpresentation/opf` **0.12.2** (2026-10-05, `b66ea0c`), `opf-render` **0.12.2** (`de6d247`; 0.12.1 was tagged but never
  published: its golden digest did not match core 0.12.2's examples, fixed by opf-render#128 and #130), `opf-pptx` **0.12.4**
  (`03967a2`), `opf-editor` **0.11.3** (`1107fdd`). The Node `engines` range is open (`>=22`), so npm on Node 26 and 22 no
  longer silently installs the old 0.7.0 / 0.9.0 releases. `@openpresentation/cli` 0.10.1: the release PR is merged
  ([opf#391](https://github.com/OpenPresentation/opf/pull/391), `2a0f9b4`), tag, publish and verification were in progress when
  this was written (npm `latest` was still 0.10.0). The patch releases up to opf-pptx 0.12.3 are described in the addendum of
  [release-notes-0.12.0.md](release-notes-0.12.0.md) ([opf#349](https://github.com/OpenPresentation/opf/pull/349), merged);
  the later patch set and the 0.13 train are not in the note yet.
- Next release: the 0.13 minor train in dependency order: core 0.13.0, CLI 0.11.0, opf-render 0.13.0, opf-pptx 0.13.0 and
  opf-editor 0.12.0. It carries the pptxgenjs-plus migration ([opf-pptx#165](https://github.com/OpenPresentation/opf-pptx/pull/165),
  merged 2026-10-06; the Windows a/b gate passed 20 of 20, [opf#351](https://github.com/OpenPresentation/opf/pull/351)), per-slide
  script fonts ([opf-pptx#170](https://github.com/OpenPresentation/opf-pptx/pull/170), merged 2026-10-06), zero chart values
  ([opf-pptx#173](https://github.com/OpenPresentation/opf-pptx/pull/173), merged), the Ethiopic / Armenian / Georgian theme
  supplement ([opf#377](https://github.com/OpenPresentation/opf/pull/377), merged) and RR-54, whose four pull requests
  ([opf#376](https://github.com/OpenPresentation/opf/pull/376), [opf-render#127](https://github.com/OpenPresentation/opf-render/pull/127),
  [opf-pptx#171](https://github.com/OpenPresentation/opf-pptx/pull/171), [opf-editor#92](https://github.com/OpenPresentation/opf-editor/pull/92))
  are open with `Depends-On` trailers and merge after the CLI 0.10.1 tag. RR-54 behaviour changes for the release note:
  non-strict chart text cells become gaps with a `chart-value-not-numeric` warning (they used to be stripped to a number), a
  two-column scatter plots column 2 against the row numbers, and an unknown dataset or mapping column fails validation. The
  contract is `docs/chart-table-data.md` (in opf#376). Native PowerPoint evidence for RR-54 is merged
  ([opf#385](https://github.com/OpenPresentation/opf/pull/385), [opf#387](https://github.com/OpenPresentation/opf/pull/387),
  [opf#388](https://github.com/OpenPresentation/opf/pull/388)): the first check had 3 FAIL (a save re-spelling the number-format
  code, zero values missing from the workbook, and `0.0 m/s` read as a fraction bar), all fixed; the open
  [opf#392](https://github.com/OpenPresentation/opf/pull/392) reads 25 PASS, 0 FAIL on the merged-main combination.
- Hosting: all three sites serve production from Cloudflare Workers (cut over 2026-10-05, zero downtime). openpresentation.org
  and pptx.gallery: rollback is `proxied=false` on the DNS records. pptx.dev: Worker custom domains for www, apex, api. and mcp.;
  the `*.pptx.dev` wildcard is still on Vercel; rollback is detaching the four domains and restoring the four A records from the
  backup. pptx.dev runs on the Clerk development instance and a dev Convex deployment for now (owner decision 2026-10-05).
  Since the last handoff: the deploy-on-main workflows now exist for all three sites (CF-04 and, for pptx.dev,
  [pptx-dev#100](https://github.com/Data-Advantage/pptx-dev/pull/100)) and stop at their gate until the Actions secrets exist; the
  apex static-asset redirect on openpresentation.org is merged and live (CF-07); the pptx.dev signed-in e2e suite
  ([pptx-dev#98](https://github.com/Data-Advantage/pptx-dev/pull/98)) is merged and not yet run; pptx-gallery no longer shows the
  STORYD CTAs or the private repo link, serves its chart preview images from R2 (bucket `pptx-gallery-web`, `/media`), and the
  three sites self-host their fonts (no build-time Google Fonts); pptx.dev hosted services SVC-01 to SVC-04 are merged (17 MCP
  tools). See [docs/programs/cloudflare-hosting/](../cloudflare-hosting/README.md).
- Open pull requests (core): [opf#376](https://github.com/OpenPresentation/opf/pull/376) (RR-54 core),
  [opf#392](https://github.com/OpenPresentation/opf/pull/392) (RR-54 native evidence, ready) and
  [opf#335](https://github.com/OpenPresentation/opf/pull/335) (RR-53 core contract tier, ready, parked). The siblings' RR-54 pull
  requests are listed above. opf#308 (the old RR-17 placeholder) is closed; its plan was carried out by opf#357 and opf#382.
- Native PowerPoint evidence is under `docs/evidence/`. Added on 2026-10-05 / 06 (Windows, PowerPoint 16.0 build 20430):
  `rr-17-pptxgenjs-plus-native-20261005`, `rr-05-ff-12-native-20261005`, `ff-27-fields-slide-sizes-native-20261005`,
  `ff-13-font-embed-native-20261005`, `opf-87-save-reopen-native-20261005`, `ff-46-documented-visual-native-20261005` and
  `-fonts`, `ff-46-theme-supplement-native-20261005`, `ff-05-per-slide-script-fonts-native-20261005`, and the RR-54 runs
  (`rr-54-chart-table-data-native-20261005`, `-recheck-20261005`, `rr-54-slash-native-20261005`). Earlier:
  `ff-46-native-0.12-20261002`, `rr-42-native-20261002`, `rr-17-viet-supplement-native-20261002`, `ff-05-native-20261002`,
  `rr-05-cjk-native-20261002`, `rr-05b-native-20261002`; Keynote evidence (opf#341) is under
  `docs/evidence/mac-checks-20261002/keynote`.
- CI speed (RR-45 follow-up, [opf#368](https://github.com/OpenPresentation/opf/issues/368), closed): six items merged
  (opf#369 to opf#374): `ecosystem-core` runs as three parallel shards (13.4 min before, 4.1 / 4.4 / 5.4 min after), `Verify OPF
  packages` 9.5 to 8.0 min, the Windows and macOS installed-candidate legs run only on main, nightly and PRs labelled
  `ecosystem-full`. `ecosystem-render` (11 to 12.6 min) is now the critical path.

## Open, and who it waits on

Owner actions:

- **Urgent:** raise the Data-Advantage GitHub Actions budget before about 2026-10-08, or limit `llmreference` CI (it was
  53% of September's spend); otherwise site CI stops (RR-40 finding). The 2026-10-05 Actions incident also left some hosted
  jobs unacquired.
- Merge queue, [opf#297](https://github.com/OpenPresentation/opf/issues/297) (RR-48, then RR-53: the supervisor merges
  [opf#335](https://github.com/OpenPresentation/opf/pull/335) and measures a queued run).
- GitHub App, [opf#298](https://github.com/OpenPresentation/opf/issues/298) (RR-50 follow-up, RR-51 criterion a): App id
  and key secrets, uncomment the ecosystem roller schedule, set `ECOSYSTEM_LOCK_GUARD=blocking`.
- RR-14 enable: needs the owner's Clerk user id for `UNDERSTAND_DECK_ALLOWLIST`. The flags are Worker / build variables
  (`UNDERSTAND_DECK_ENABLED`, `UNDERSTAND_DECK_ALLOWLIST` as Worker variables, `NEXT_PUBLIC_UNDERSTAND_DECK` as a build variable,
  which needs a rebuild); `AI_GATEWAY_API_KEY` is already a Worker secret. Left: confirm the AI Gateway $50 per month limit and
  rotate the old key if the removed `.env.example` value was real.
- RR-49 is closed as `descoped` (owner, 2026-10-06: "we don't need Vercel only checks"; README, Open decisions 5): the Vercel-only checks are
  removed in [openpresentation-site#83](https://github.com/Data-Advantage/openpresentation-site/pull/83), [pptx-gallery#103](https://github.com/Data-Advantage/pptx-gallery/pull/103) and [pptx-dev#107](https://github.com/Data-Advantage/pptx-dev/pull/107). Close-out: [opf#299](https://github.com/OpenPresentation/opf/issues/299) (the bypass secret) can be
  closed, and no Vercel secret or `PREVIEW_SMOKE_ENABLED` variable is needed (delete them if they were ever set). Vercel still builds as a
  warm rollback, so `vercel.json`, the Ignored Build Step and its test stay until the Vercel projects are removed (CF-08). The
  CF-04 deploy secrets (`CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`) are what makes the production checks run, and stay in the
  Cloudflare program.
- RR-19 leftovers: the 19 kept worktrees with uncommitted or unpushed work (the list is in the supervisor's scratchpad
  `wt-kept.txt`; e.g. opf-pptx ff-32 rich-metadata, rich-source and extension worktrees, pptx-gallery gallery41/42/44-45
  reviews, pptx-dev app58 with 266 modified files), and the `archive-*`, `shared-furniture-*` and `claude/*` branches.
  `~/.codex/worktrees` is untouched. Deletion candidates from the RR-46 follow-up in opf-pptx: `compare-published.mjs`
  (pinned to 0.5.0) and `native-furniture-fixtures.mjs`.
- Optional, CF-04 and CF-05 secrets: `CLOUDFLARE_API_TOKEN` (Workers Scripts: Edit and Account Settings: Read) and
  `CLOUDFLARE_ACCOUNT_ID` in openpresentation-site, pptx-gallery and pptx-dev (pptx-dev also `CONVEX_DEPLOY_KEY` and the
  `NEXT_PUBLIC_*` repository variables), until then the deploy-on-main workflows skip or stop at their gate and production
  checks do not run; a Clerk test user (a `+clerk_test` address) with `E2E_CLERK_USER_EMAIL`, `CLERK_SECRET_KEY` and
  `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` for the signed-in e2e.
- Review of the release note [release-notes-0.12.0.md](release-notes-0.12.0.md) (addenda up to opf-pptx 0.12.3) and of the RR-54
  behaviour changes before the 0.13 train (README, Open decisions 7).
- FF-46 follow-ups (README, Open decisions 6): commission the `sizeAdjust` rows for the 24 findings
  ([opf#361](https://github.com/OpenPresentation/opf/issues/361)) and the per-family host fixtures
  ([opf#362](https://github.com/OpenPresentation/opf/issues/362)), or record them as wide look-alikes; the registry
  measurement default ([opf#364](https://github.com/OpenPresentation/opf/issues/364)); the Didot reroute decision.
- opf#87: accept the lost raster fallback after a PowerPoint save of an SVG picture, or track it (README, Open decisions 2);
  opf#88's source-preservation box has no item.
- Production Clerk and Convex for pptx.dev when real users arrive (it runs on the Clerk development instance and a dev Convex
  deployment for now, owner decision 2026-10-05).
- Cursor Bugbot quota (optional).

Windows host: the deferred work of [opf#323](https://github.com/OpenPresentation/opf/issues/323) was run on 2026-10-05 (every
section; evidence merged, see State). What remains there is the re-run of the size-adjusted families once the `sizeAdjust` rows
land ([opf#361](https://github.com/OpenPresentation/opf/issues/361)). New native checks for RR-54 follow-ups (for example the
open opf#392 set) go through the supervisor as before.

Mac mini: the Keynote checks are done (2026-10-05, opf#341): the 20-deck set on opf-pptx 0.12.2 lost 6 native category charts; the
fixed decks (built from the fix branch before the release) have 0 failures. The Keynote m-set of the pptxgenjs-plus migration has
20 WARN, 0 FAIL with every chart kept, and pptx-dev's own generator fix (pptx-dev#93) went from 0 of 7 charts kept to 7 of 7.
The playground example decks were checked in Keynote on 2026-10-05 against the live site: full-feature-tour passes (11 of 11
slides, its chart kept) and developer-conference-talk hung the Keynote export twice; the launch-quality rewrite
([opf#367](https://github.com/OpenPresentation/opf/pull/367), merged) is the fix for what was found, and a Keynote re-check of the
rewritten decks is not recorded in this repository. Keynote is opened read-only, never saved, only by the supervisor.

Parked: [opf#335](https://github.com/OpenPresentation/opf/pull/335) (ready, not merged) until the merge queue is enabled.

## Supervisor tooling now in the repository

- `scripts/release-train.mjs` (`plan`, `prep`, `tag`, `verify`, `run`; `verify --wait`) and the plan-only
  `release-train.yml` (RR-51); the release procedure stays in [docs/release-process.md](../../release-process.md).
- `ecosystem.lock.json`, `scripts/ecosystem-lock.mjs` and `scripts/ecosystem-roll.mjs` (RR-50): the pins are bot-owned; roll
  by dispatching the roller and open the PR yourself until the App exists (the latest rolls are opf#379 and opf#389);
  `Depends-On:` trailers for cross-repository PRs.
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

All are vetoable and dated in the README decision log. The latest (2026-10-05 / 06): RR-49 descoped by the owner (Vercel-only checks removed; the Ignored Build Step stays while Vercel builds); RR-05 and FF-12 accepted as met on the
12-deck sample (the stricter script rule's one FAIL is kept as evidence); FF-13 done on the corrected audit; FF-27 and RR-03
closed on the native renumber observation (the missing `datetime*` gallery snippet is treated as a coverage observation);
slide-size presets keep OPF's values; FF-46 findings go through `sizeAdjust` rows and per-family host fixtures; RR-54 added with
status review. Earlier (2026-10-03): RR-50 done without the App; RR-51 tag gates on the release commit's checks; RR-53 no
PR-tier reduction before the queue exists; core 0.12.1 without re-releasing the siblings; the 307 redirect for plural audience
URLs; RR-19 leftovers go to the owner.

## Native PowerPoint runs (Windows plus desktop PowerPoint only)

Only the supervisor runs Office (README invariants). Pattern: decks built by an agent with the published packages, a `RUN.md`,
helpers `run-deck.ps1` (one deck per child `powershell.exe`, 90 s deadline, stops only its own child by PID) and
`native-read-deck.ps1` (attaches to a running PowerPoint with `GetActiveObject`, opens read-only with
`Presentations.Open(path, -1, 0, 0)`, never saves, quits or kills PowerPoint), then `compare.mjs` and committed evidence (no
decks, no PNGs, no absolute paths). Run them with `powershell.exe -NoProfile -NonInteractive -ExecutionPolicy Bypass -File …`.
Where the owner allowed saving (2026-10-05: FF-13, opf#87, RR-54 C4), the run makes one `SaveAs` / `SaveCopyAs` of a copy into a
fresh directory and never saves over a source. Never read `Series.Formula`: it crashes PowerPoint 16.0.20430. The decks and
helpers of the 2026-10-02 runs are not in the repository; the evidence READMEs describe how each set was built, and the probe
sets of 2026-10-05 live on the `codex/probe-sets-20261005` branch.
