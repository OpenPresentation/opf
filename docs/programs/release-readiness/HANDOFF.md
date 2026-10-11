# Release readiness: handoff of 2026-10-11

Updated by the release supervisor on 2026-10-11 after the initial 00:40 UTC handoff. Follow the live [0.19 execution checklist](0.19-execution.md), currently 9/40 verified checkpoints, for reviewed evidence and remaining acceptance. It replaces the handoff of 2026-10-06. A new
supervisor or agent team resumes from this file, then [README.md](README.md) (goal, invariants, resume protocol),
[burndown.md](burndown.md), [the release process](../../release-process.md) and the root `AGENTS.md`. Nothing here
overrides those invariants. Everything in flight is in a pull request or a published release. No work lives only on a
local machine (the exceptions are listed under "Local-only state").

## Latest supervisor checkpoint

Renderer 0.18.1 is published and independently verified. Release prep [#226](https://github.com/OpenPresentation/opf-render/pull/226) merged at `d4259333a1105ce54d136ced0635f086d0f750ee`; its exact-commit gate passed all six checks plus confirmation. Trusted publish run38112000992 and separate supervisor verification both passed npm integrity, tag/gitHead/main equality, SLSA provenance and npm signatures. [Durable evidence](../../evidence/rr20-render-0181-published/README.md). T08 is complete; publisher96032 and verification45877 exited0.

Core#595 merged at `d12ad7e26aa0edfb52e4280dfe527053fe76f98e`. Editor#154 now merged at `4c29be041bb3b4ea67b4b086e69c13395542377c` after all three checks and confirmation; editor main is synced, T09 closes. Old gate67346 exited1 due to the already-diagnosed PPTX244/editor157 failures. Editor157 now incorporates154 at `adf5ef23dd0ad69b05bafe6b3396022eb1ea96c1`; its independent packed replay81886 exited0: 123 byte-matched files, 23 model suites, offline browser workflow, 135 verified registry signatures and 24 attestations. PPTX244 declares `Depends-On: OpenPresentation/opf#595` to select the merged archive repair. Shared gate80227 exited0: core597 merged at b3a0561b993d577b3e792bd1d966e1f7a6148fc5, renderer231 at 5aca1864158a959d52ae2d8c3548d6f6ff0aedae, PPTX244 at ff9b41bc0702b9d043677e76494e48dac8daef71 and editor157 at b2c9bab8a58b17ec3aa10c6360c0870067943986. All four default checkouts synced cleanly. The prescribed ecosystem roller is dispatched as [38116428248](https://github.com/OpenPresentation/opf/actions/runs/38116428248); its generated lock must carry core595 before release-commit gates. No duplicate watcher.

Final PPTX#240 candidate `006e8a7d` passes all 130 package tests and browser build against explicit local v2 candidates; fresh native and published-dependency gates remain. Core script-width draft #593 is reviewed at `13e1c4dc`; schema/example audit #594 is frozen at `53925383` with independent regression checks passing. Gallery-site draft #126 at `88c7119f` implements package ownership and canonical previews/redirects, but published dependency adoption and editor artifact regeneration remain merge blockers. Editor v1 cleanup #156 is frozen at `cef0bd18` with local package/browser acceptance. Main-site #103 at `ab0b0da5` passes 73 browser cases; registry gallery2 installation blocks one case and two serial dependents. pptx.dev #128 at `c83c995f` passes 970 unit tests and all 11 browser cases. All sites still require actual published dependency/lock adoption. Two GPT-6.1 Sol agents are qualifying combined renderer/core changes and gallery/editor integration. The latest bounded inventory is 30 open PRs and 47 issues, pagination complete; all eight clean default checkouts match their remote heads. The live checklist retains these distinctions and is now 9/40 after T30 promotion verification.

The strict macOS font-subset fix renderer#230 remains held for the dependency-ordered patch release. Core#597 and renderer#231 workflow tooling are merged. Prescribed baseline promotions wrote core91a1c96d and rendererab23a258; all807example/498template records match reviewed candidates, renderer note8010a13 is pushed, and gate80911 confirmed both tooling commits at07:17:30UTC. T30 is complete for this exact graph; native and final integrated acceptance remain open. PPTX0.18.1 prep#245 merged95a2f22f with reviewed-tree equality, awaiting the Windows release-commit job before publication. Core#598 CLI prep fix and#600 gallery WASM generator are merged. Renderer#233 at65e743dc corrects an independently reproduced font-test fallback; strict391sample browser replay and full111suites pass, pending merge. Coverage audit found core#550 filename behavior absent from the current qualification: integrate and revalidate it before declaring the final graph complete. Active gate details are recorded in the current session; source/packed evidence remains distinct from registry proof.

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

1. **Completed prerequisites.** Core 0.18.3 and renderer 0.18.1 are published and independently verified. Renderer release commit is `d4259333a1105ce54d136ced0635f086d0f750ee`; its failed initial prep was superseded without tagging. Editor font-pin PR #154 merged at `4c29be041bb3b4ea67b4b086e69c13395542377c`. Do not redo these steps.
2. **Finish CI repairs and roll the lock before tagging.** Shared gate80227 completed successfully; PPTX#244, editor#157 and both golden-workflow tooling PRs merged. Core#598 (CLI prep peer floors) is ready for the next batch. Dispatched ecosystem roller38116428248 must include core#595's Windows archive repair and the current engine mains. Never hand-pin the lock. The old locked core caused PPTX's Windows failure even after the repair merged.
3. **PPTX 0.18.1: fresh prep → merge → release-commit gate → tag → independent verification.** The disposable rehearsal passed all128 test files and packed consumers against registry core0.18.3/render0.18.1; [evidence](../../evidence/rr20-patch-release-rehearsals/README.md). It predates CI repair244 and is not the final release prep. Run the prescribed packed gate at the actual source head, create a fresh prep with the train arguments above, review its metadata-only diff, merge through pr-gate and verify the exact release commit before tagging. Contents include PPTX#231,#233–#237,#239,#242 (PowerPoint-save table repair),#243 and the CI repair.
4. **Editor 0.18.1: packed gate → prep → merge → release-commit gate → tag → independent verification.** Contents include #152,#153,#154 and CI repair157. The157 source packed rehearsal passes123 file hashes,23 model suites and offline browser workflow, but final registry adoption must include published PPTX0.18.1. Do not substitute the rehearsal for final release gates.
5. **CLI 0.18.1.** Merge reviewed release-tool fix core#598 before prep. Preserve compatible runtime peer floors; advance the core dependency/development pins. Then use `release-train.mjs prep cli` with the train arguments above. Before tagging, run `pnpm test:cli:packed:peers` with `GITHUB_REF=refs/tags/cli-v0.18.1`, gate the merged release commit, publish through the trusted workflow and independently verify its artifact/provenance.
6. **Final lock and release records.** Dispatch `ecosystem-roll.yml` on `main`, open the resulting green roller PR if the owner App is still absent, and merge with pr-gate. Reconcile `release-plan.json`, compatibility matrix, burndown and this handoff against actual verified versions.
7. **Sites adopt the published0.18 set.** openpresentation-site and pptx-gallery use main; pptx-dev uses master. Update engine/editor dependencies and all six renderer font peers together: noto-sans-jp/kr/sc/tc0.4.4, noto-color-emoji0.4.7, noto-emoji0.4.8. pptx-gallery also updates editor exampleRefs, runs prepare:opf and regenerates wasm.json with the actual published artifacts (harfbuzzjs1.6.3). Run site gates; agents do not deploy.

## Held until render-v0.18.1 and editor-v0.18.1 are tagged (then they form render 0.18.2)

Source reviews and local evidence are recorded below. Refresh exact-head CI through the shared gate after the publication hold clears; historical green checks are not final integrated acceptance.

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
- Also include reviewed renderer#229 forced-colors focus and renderer#230 subset glyph coverage after the current train hold.
- [Dependency audit](../../evidence/rr20-held-patch-order/README.md): publish core0.18.4, then renderer0.18.2 with core^0.18.4. Editor#155 is tests-only; no additional CLI/PPTX/editor release is forced by this set. Existing broad ranges admit the corrections but do not guarantee them for old locked installations. Adopt actual corrected producer versions in sites/consumer locks; deliberate minimum-guarantee changes require separate reviewed metadata patches. This patch set needs neither v2 nor renderer#225.

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

## Version acknowledgment before v2 source merges

[Read-only ordering audit](../../evidence/rr78-gallery2-publication-order/prerelease-order.md) confirms the existing breaking/version/release-selector functions support a genuine metadata-only core0.19.0-next.0 preparation after remaining0.18.x/held patches. This future prep needs genuine changelog fragments and all normal CI; keep it untagged and never dispatch its publisher. It does not replace gallery candidate qualification. After qualified v2 source merges and verified gallery2 publication, a reviewed registry-adoption PR updates real^2 ranges/locks and removes staging declarations/configuration. Then the ordinary final stable0.19.0 prep selects a distinct stable-setting commit. No version, tag or publisher was changed by the audit. The gate is preserved, not suppressed.

## Pinned-CI candidate evidence run

Core golden dry-run [38115772021](https://github.com/OpenPresentation/opf/actions/runs/38115772021) started from merged tooling b3a0561b on2026-10-11. Exact verified remote core branch head37d96a28aeba2be28a9d4bde5f1aca73264c1a03, renderer8c651e66ca995e790e0fd42d9822b34c4578be29 and gallerye0a7eee2dfe996e680b34a907cabfe41905e6d99; fixture-name rr83-v2-reviewed, dry-run=true, dispatch-ci=false. Run was confirmed in_progress by one identity lookup. No fixture push or promotion authorized; review artifacts only after successful completion. PR gate80227 has finished. Monitor this main b3a0561b commit through the prescribed shared gate; never introduce a second watcher.

Renderer golden dry-run [38116271551](https://github.com/OpenPresentation/opf-render/actions/runs/38116271551) was dispatched from reviewed tooling a224c61c, with renderer8c651e66, core37d96a28 and gallerye0a7eee2 pinned, selection=both, baseline-name rr81-v2-reviewed, dry-run=true. No promotion. Fresh final PPTX0.18.1 dry preparation from merged ff9b41bc completed successfully; its 15-file diff contains only version/dependency/lock/changelog assembly changes. Strict install, full tests and packed validation of this fresh scratch remain in progress; old rehearsal is not substituted.

PPTX final validation completed: strict registry install, all128 package test files, packed consumers/provenance interoperability (54 signatures/15 attestations), browser127-example parity, code checks, syntax269files, validate and pack dry-run pass. Prescribed prep opened [PPTX#245](https://github.com/OpenPresentation/opf-pptx/pull/245), head a8b83f6e430c4bd36d9a6610c5786f9131521f5d. Supervisor verified its exact15-file diff equals the validated dry preparation (same Git abbreviation width). It is ready for the next shared merge batch after CI passes, not published.

Completed gate: session95688 exited0, records-tools-golden-gate.log; watched core598@6688f057, core599@9d080de5, core commitb3a0561b and renderer tooling commita224c61c, without merge, every180seconds. All targets passed confirmation, including core main21/21checks and renderer tooling7/7. The prescribed ecosystem roller generated reviewed lock commit729b705f540569d16995400f47e18da22b35ae31; its diff changes only the lock to the four merged prerequisite heads, with golden selection unchanged. Next shared merge batch includes the lock PR, core598, updated records599, WASM prerequisite600 and PPTX245. Never start parallel watchers.

Inventory reconciliation: PPTX#229 still has remote head be161d727bc8fbd01257de819920e6d1f6f88ffd. The reviewed local RR-78 preparation is6b88822 in /private/tmp/opf-gallery-adoption/opf-pptx (rebased feature plus real gallery1 range); it has not been pushed. Preserve that distinction: remote PR is not yet the reviewed local candidate, and requires post-patch-train rebase, validation and explicit reviewed update before any merge.

WASM site-adoption prerequisite [core#600](https://github.com/OpenPresentation/opf/pull/600) is ready at15bb86b413f3040fd915750c3624b6c9db0596a8. Root reviewed six-file scope, independently passed3regressions and actual registry replay through the existing gallery verifier (renderer0.18.1/HarfBuzz1.6.3,2modules/1108542bytes). Full35root checks/core2262/CLI169+95command suite pass. No site/exampleRefs/release-plan/binary changes. This enables genuine manifest regeneration; final site adoption still waits for published package set and reviewed exampleRefs.
