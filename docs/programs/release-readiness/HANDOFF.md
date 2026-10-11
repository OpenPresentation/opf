# Release readiness: handoff of 2026-10-11

Updated by the release supervisor on 2026-10-11 after the initial 00:40 UTC handoff. Follow the live [0.19 execution checklist](0.19-execution.md), currently 8/40 verified checkpoints, for reviewed evidence and remaining acceptance. It replaces the handoff of 2026-10-06. A new
supervisor or agent team resumes from this file, then [README.md](README.md) (goal, invariants, resume protocol),
[burndown.md](burndown.md), [the release process](../../release-process.md) and the root `AGENTS.md`. Nothing here
overrides those invariants. Everything in flight is in a pull request or a published release. No work lives only on a
local machine (the exceptions are listed under "Local-only state").

## Latest supervisor checkpoint

Renderer 0.18.1 is published and independently verified. Release prep [#226](https://github.com/OpenPresentation/opf-render/pull/226) merged at `d4259333a1105ce54d136ced0635f086d0f750ee`; its exact-commit gate passed all six checks plus confirmation. Trusted publish run38112000992 and separate supervisor verification both passed npm integrity, tag/gitHead/main equality, SLSA provenance and npm signatures. [Durable evidence](../../evidence/rr20-render-0181-published/README.md). T08 is complete; publisher96032 and verification45877 exited0.

Core#595 merged at `d12ad7e26aa0edfb52e4280dfe527053fe76f98e`. Editor#154 now merged at `4c29be041bb3b4ea67b4b086e69c13395542377c` after all three checks and confirmation; editor main is synced, T09 closes. Old gate67346 exited1 due to the already-diagnosed PPTX244/editor157 failures. Editor157 now incorporates154 at `adf5ef23dd0ad69b05bafe6b3396022eb1ea96c1`; its independent packed replay81886 exited0: 123 byte-matched files, 23 model suites, offline browser workflow, 135 verified registry signatures and 24 attestations. PPTX244 declares `Depends-On: OpenPresentation/opf#595` to select the merged archive repair. The ONE active gate is session80227, `patch-prerequisites-next-gate.log`, for PPTX244 (9b747bcc), editor157 (adf5ef23), core597 (78c28dd0), renderer231 (a224c61c), with all required checks, expected heads, one retry and merge. Wait for its exit; no duplicate watcher. A roller-generated ecosystem lock update must carry core595 before release-commit gates.

Final PPTX#240 candidate `006e8a7d` passes all 130 package tests and browser build against explicit local v2 candidates; fresh native and published-dependency gates remain. Core script-width draft #593 is reviewed at `13e1c4dc`; schema/example audit #594 is frozen at `53925383` with independent regression checks passing. Gallery-site draft #126 at `88c7119f` implements package ownership and canonical previews/redirects, but published dependency adoption and editor artifact regeneration remain merge blockers. Editor v1 cleanup #156 is frozen at `cef0bd18` with local package/browser acceptance. Main-site #103 at `ab0b0da5` passes 73 browser cases; registry gallery2 installation blocks one case and two serial dependents. pptx.dev #128 at `c83c995f` passes 970 unit tests and all 11 browser cases. All sites still require actual published dependency/lock adoption. Two GPT-6.1 Sol agents are qualifying combined renderer/core changes and gallery/editor integration. The latest bounded inventory is 34 open PRs and 46 issues, pagination complete; all eight clean default checkouts match their remote heads. The live checklist retains these distinctions and remains 8/40.

The strict macOS font-subset gap has a reviewed fix in renderer#230 at012e448b (ready, full-ci; held for dependency-ordered patch release). Supervisor independently passes the eight actual-font regression and147-slide/384-face browser corpus plus40 strict size/style cases; corrected807 example and498 template candidates are unchanged. Core#597 gallery-aware golden workflow78c28dd0 is reviewed/ready after21independent tests and materialization verification. Renderer candidate workflow #231 at a224c61c passes supervisor and independent review and is ready under the shared gate; no baseline promotion authorized. The PPTX0.18.1 dry prep passes strict install and packed consumers against registry core0.18.3/render0.18.1,54 signatures/15 attestations; all 128 package test files and browser/runners/fragments checks also pass. It is scratch-only, not a release PR or publication. CLI prep correction core#598 at6688f057 is reviewed/ready for the next gate batch: full tests and supervisor35/35 regressions pass; no core runtime edits in CLI prep. Before0.19, align core/CLI peer metadata in a reviewed feature PR and publish core’s contract first. Qualification refs core37d96a28 and renderer8c651e66 are pushed and validated; original frozen source heads remain intact.

## Rules that matter most

- Merge and watch pull requests **only** with `node scripts/pr-gate.mjs <owner/repo#N>… --merge [--expect-head <sha>]…`.
  Run it as **one** background task per batch. Never write a polling loop, and never loop REST calls; every agent on the
  account shares a 5000/h GitHub quota.
- Release **only** through `scripts/release-train.mjs` (`plan`, `prep`, `tag`, `verify`). It runs trusted publishing,
  in dependency order: core, then render, then pptx, then editor, then CLI. Never move or re-push a tag. A publish that
  fails on a real bug burns the version: fix it on `main` and release the next patch.
- Agents never deploy, log in, change DNS, create secrets or create GitHub Apps. Those are owner actions (list below).
- Pre-v1: breaking changes ship without migration tools, aliases or shims (the owner's decision of 2026-10-10). Convert
  our own examples and docs instead.
- Before tagging core, replay `npm-publish.yml` locally from clean `dist` folders, with `GITHUB_REF` set to the tag and
  `NPM_CONFIG_USERCONFIG` pointing at an `.npmrc` that contains `//registry.npmjs.org/:_authToken=${NODE_AUTH_TOKEN}`
  (the token unset). Run `lint`, `typecheck`, `test`, `check:breaking`, `pack:dry-run`, `check:examples`, `test:skills`
  and `packages/javascript/test/packed-install-smoke.mjs`. Also run `node scripts/build-gallery-tracker.mjs --check` and
  `pnpm check:font-tracker` at the release commit. Before each sibling prep, run its `npm run test:packed` locally
  against the published upstream.
- A pull request that edits `burndown.md` also regenerates the gallery tracker (`node scripts/build-gallery-tracker.mjs`).

## Published (verified gitHead, SLSA provenance and npm signatures; GitHub Releases where the package lane creates them)

| Package | Version | Notes |
| --- | --- | --- |
| `@openpresentation/opf` | **0.18.3** | Tag `opf-v0.18.3` at `d52fa6ce`, published 2026-10-11 00:26 UTC. **0.18.2 is burned** (tagged, publish failed, never on npm); fix in opf#588. |
| `@openpresentation/opf-render` | **0.18.1** | Tag `opf-render-v0.18.1`, commit `d4259333a110`; independently verified. |
| `@openpresentation/opf-pptx` | 0.18.0 | 0.18.1 is next. |
| `@openpresentation/opf-editor` | 0.18.0 | 0.18.1 is next. |
| `@openpresentation/cli` | 0.18.0 | 0.18.1 is next. |
| `@openpresentation/gallery` | **1.0.0** | Tag `v1.0.0`, commit `3458f50ca8fe`; independently verified. No GitHub Release is required by this lane. |

## The 0.18.x patch train: exact next steps

The versions for every `release-train.mjs` call:
`--core 0.18.3 --render 0.18.1 --pptx 0.18.1 --editor 0.18.1 --cli 0.18.1 --item RR-20`.

1. **Initial lock roll is complete.** Core main `09658e9c` includes the required lock and font counts.
2. **opf-render 0.18.1.** Release prep [render#223](https://github.com/OpenPresentation/opf-render/pull/223)
   merged as `6615ad54`, but its release-commit Node 22 gate failed before tagging: npm 10 rejects the coordinated
   PPTX lock's emoji peers before source linking. Exact Node 22 experiments prove npm 11.16.0 installs the same lock
   unchanged, matching trusted publishing. Reviewed repair [render#224](https://github.com/OpenPresentation/opf-render/pull/224)
   at `021205bc` pins that npm version and mechanically cancels the untagged prep; its `full-ci` pr-gate is running.
   After it merges and passes, rerun packed acceptance and create a fresh prep with
   `--branch codex/release-render-0-18-1-retry`. Preserve the previous branch. `release-train` selects the commit that
   first set the version, so merely adding a workflow fix after the failed prep cannot authorize tagging `6615ad54`.
   Gate the new merged release commit with `pr-gate --commit`, then use `release-train tag render ... --execute`.
   - `npm run test:packed` already passed locally at render main `443dbb98` against core 0.18.3: 204 byte-matched files,
     signatures verified.
   - Before prep, check that `golden-override: ''` is in both `ecosystem-refs` steps of render's `ci.yml`, and that
     render's default baseline (`test/golden/opf-examples-png.cover-centering/_baseline.json` `source.sha256`) equals
     core 0.18.3's examples digest `20da988227cb90ad9a1f04185981f83d24c0afee7c9070d7b84e55fe7895e71b`. Core's examples
     did not change since 0.18.1.
   - **Release notes:** the `render-191-deps.md` fragment (render#218) tells users to upgrade `@expo-google-fonts/
     noto-sans-jp`, `-kr`, `-sc`, `-tc` to 0.4.4, `noto-color-emoji` to 0.4.7 and `noto-emoji` to 0.4.8 together with
     the renderer. They are exact-pinned optional peers.
   - Contents: render #203–#210, #212, #214, #216 (forced colours), #218 and #221 (Wingdings in list bodies).
3. **Merge [opf-editor#154](https://github.com/OpenPresentation/opf-editor/pull/154)** (head `c8828f46`, the font pins
   matching render 0.18.1) **only after render 0.18.1 is on npm**. Re-run its CI first; it is red against render 0.18.0
   by design. The opf-pptx side (#243) is merged.
4. **opf-pptx 0.18.1** (prep → merge → tag). Contents: pptx #231, #233–#237, #239, #242 (tables survive a PowerPoint
   save), #243. Run `npm run test:packed` locally first.
5. **opf-editor 0.18.1** (prep → merge → tag). Contents: editor #152, #153, #154. Run `npm run test:packed` locally first.
6. **CLI 0.18.1**: `release-train.mjs prep cli …`, then tag. Before tagging, run `pnpm test:cli:packed:peers` with
   `GITHUB_REF=refs/tags/cli-v0.18.1`.
7. **Lock roll again** (dispatch `ecosystem-roll.yml` on `main`, open the PR from `ecosystem-roll/main`, merge it with
   pr-gate). Then update `release-plan.json`, the compatibility matrix and the burndown rows in one records PR.
8. **Sites adopt 0.18.1** (openpresentation-site and pptx-gallery on `main`; pptx-dev on `master`). Each bumps render, pptx and
   editor and **all six font packages above** together. pptx-gallery also regenerates `public/opf-editor/wasm.json`
   (harfbuzzjs 1.6.3), and bumps `exampleRefs['opf-editor']` and runs `prepare:opf` (gallery#118 part 2).

## Held until render-v0.18.1 and editor-v0.18.1 are tagged (then they form render 0.18.2)

All are green or nearly green. Each PR body has its status. Merge order in brackets.

- opf#361, the size-adjust policy: [opf#585](https://github.com/OpenPresentation/opf/pull/585) first, then
  [opf-render#219](https://github.com/OpenPresentation/opf-render/pull/219). opf#585's `packages` aggregate was red only
  from the font-pin drift, which opf#587 and the lock roll fix. Re-run its CI.
- opf#362, documented-visual host fixtures:
  - [opf-render#217](https://github.com/OpenPresentation/opf-render/pull/217);
  - [opf-editor#155](https://github.com/OpenPresentation/opf-editor/pull/155);
  - [pptx-gallery#125](https://github.com/Data-Advantage/pptx-gallery/pull/125);
  - [opf#584](https://github.com/OpenPresentation/opf/pull/584).
- [opf-render#222](https://github.com/OpenPresentation/opf-render/pull/222) (head `eac8366a`): HarfBuzz pens for raster
  complex-script clusters. Default toPng output changes for Thai, Tamil, Telugu and Myanmar.
- Then cut render 0.18.2, and an editor patch if #155 changed the editor.

## Reviewed candidate checkpoints and 0.19 work

The supervisor coordinates GPT-6.1 Sol implementation/review agents. Check current PR heads before merging:

- RR-78 core#557 `b60c4786`, render#198 `bc81895e`, editor#148 `5ba0e4ff` are updated for published gallery 1;
  PPTX#229's local rebased checkpoint `6b888222` waits for renderer 0.18.1 strict install. All remain held for patch tags.
- Core#577 `fe9fe3fa` fixes zero-height maximum-gap grids; supervisor reproduced 12 non-overlapping rows.
- Core#592 `e21c472d` integrates #557/#577 and removes v1 schema/composer/API support. Automatic chartPrimary
  remains through direct content groups; its v1 record-builder API is removed. Local gallery 2 testing does not prove
  registry installation: final `^2` range/lock, breaking release version and reviewed registry goldens remain gates.
- Gallery#5 `e0a7eee2` restores metadata, converts 344 narrative layout references without other content changes,
  and preserves image contain fitting. Its bootstrap requires immutable engine commits reachable from main;
  full clean-source bootstrap awaits merged candidate pins. No committed local dependency ranges.
- Editor#156 `54af6e31` implements the picker, region targets and grid editor with independently fixed keyboard/focus
  behavior. Remaining v1 placeholder UI imports must be removed against final core before acceptance.
- PPTX#240 is under review: native title bindings, automatic layouts, foreign mapping, prompt defaults and maximum-grid
  placeholder collisions are being corrected. Whole-archive baseline changes require explicit evidence review; native
  Windows PowerPoint acceptance is still outstanding.
- Renderer#213 HarfBuzz measurement implementation is in progress; independent 140-sample review passes. Final
  corrected candidate preserves all 807 example SVGs according to the agent report. Core#566 script-width estimates
  also explicitly belong to 0.19 and remain required.

### Final integration and dependency sequence

The accepted design is [0.19-layouts.md](0.19-layouts.md), including section 13. There is no public migration path.
Keep RR-78 and all 0.19 work out of the 0.18.1 patch artifacts. After patch publication, merge reviewed gallery split
PRs, the v2-capable interim core and renderer candidates, and validate gallery 2 with those exact merged source pins.
Publish and verify gallery 2 before final core 0.19, then switch final core to its actual registry range/lock. Remove v1
completely from the final core, finish sibling integrations and site APIs, review visual/native evidence, and publish
in dependency order. Do not publish final 0.19 with transitional v1 support to break the bootstrap cycle.

Core #592 frozen acceptance: 2,259 core tests and six standalone suites, 169 CLI tests plus 95 command checks and the
file/drawing suite, skills acceptance, and all 336 unchanged template goldens pass. `check:changed` is 21/23: the
intentional breaking-change version gate awaits release prep; the registry golden awaits the supervisor's documented
workflow and visual review. Those are real remaining gates, not waived failures. Cross-engine and published-consumer
acceptance must be rerun on the final dependency set.

## Owner actions (agents cannot do these)

1. **Completed: npm trusted publisher for `@openpresentation/gallery`** at https://www.npmjs.com/package/@openpresentation/gallery/access
   (GitHub Actions, organization `OpenPresentation`, repository `gallery`, workflow `gallery-publish.yml`, no
   environment). Gallery 1.0.0 is now tagged, published and independently verified. Accordingly, [opf#557](https://github.com/OpenPresentation/opf/pull/557) and the siblings move to `^1.0.0`.
2. **One GitHub App for cross-repo pull requests** (opf#298 only; pptx-gallery#121 is closed by owner decision).
   - Permissions: Contents read/write, Pull requests read/write, Metadata read.
   - Install it on the five OpenPresentation repos.
   - Set the variable `ECOSYSTEM_APP_ID` and the secret `ECOSYSTEM_APP_PRIVATE_KEY` in OpenPresentation and in
     Data-Advantage/pptx-gallery.
3. **Cloudflare Actions secrets** `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` in openpresentation-site,
   pptx-gallery and pptx-dev. Until they exist, production stays on the October 7 builds.
4. Delete the 48 pre-0.18 GitHub Releases, keeping the tags (the agent's attempt was refused).
5. Optional:
   - two PowerPoint UI checks (Accessibility Checker on the pptx#236 deck, Edit Data on the pptx#233 charts);
   - `npm deprecate @openpresentation/gallery@"<1.0.0"`;
   - keep or rename the pptx-dev `/v1/data/import` and `import_data` names (recommendation: keep);
   - CF-08 Vercel retirement;
   - a veto window on the opf#577 decisions.

## Follow-up issues (open, not started)

- opf-pptx#238 (description classification by size).
- opf#581 (per-script sizeAdjust, Traditional Arabic).
- opf#582 (Nirmala UI Indic fallback overhang; a real fidelity bug).
- opf-render#213 (HarfBuzz layout measurement, 0.19).
- openpresentation-site#102 (fillJson for the other specs).
- OpenPresentation/gallery#4 (from opf#317).
- FF-46 findings on #323 (Microsoft YaHei ink 1.0118; a Segoe UI Emoji wrapped line; Ebrima/Nyala).

## Lessons from this train (also in the agent memory)

- A renderer font-pin bump deadlocks the train. The siblings' own tests need the published renderer's pins, and the
  linked shards need main's pins. opf#587 makes `link-ecosystem` install the linked renderer's pins. Merge sibling pin
  bumps after the renderer publishes.
- `npm-publish.yml`'s `.npmrc` makes pnpm print a WARN line. Tests must not parse whole tool output (opf#588).

## Local-only state

The previous supervisor's helper scripts (`rel018-*.sh` and `pubrepro.sh`) lived in a session scratch directory. They
only wrap the documented commands above and are not needed. The tracker artifact at
https://claude.ai/artifact/SKE8TDCXAUE7dthS6EtuEM mirrors this file for the owner.

## Gallery2 source qualification prerequisite

[Registry-backed audit](../../evidence/rr78-gallery2-publication-order/README.md): published0.18 engines fail v2 preview validation and10/73 gallery tests. The existing merged-source bootstrap is required; required core/linked CI currently materializes gallery1 and needs an opt-in exact-SHA gallery2 candidate lane before v2 source merges. GPT-6.1 Sol conversion_review_61 is implementing an approved explicit staging lane in /private/tmp/opf-candidate-gallery-ci; editor_review_61 independently reviews. First resolver/helper commit must be reviewed before workflow/packed wiring. Candidate checks must exercise gallery-inclusive tarballs with transparent staged manifest differences plus a pristine published control; no generic skips. Release/tag/publish must reject unresolved candidate-gallery metadata and require real registry ^2 locks. Preserve default registry behavior, all gates and frozen feature heads. After qualified v2 engines merge, refresh gallery bootstrap pins to those exact merged commits, pass all gallery gates, publish/verify gallery2, then adopt true registry^2 locks for core0.19. Golden generation tooling alone does not solve required source CI.
