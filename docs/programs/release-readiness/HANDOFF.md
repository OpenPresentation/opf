# Release readiness: handoff of 2026-10-11

Updated by the release supervisor on 2026-10-11 after the initial 00:40 UTC handoff. Follow the live [0.19 execution checklist](0.19-execution.md), currently 15/40 verified checkpoints, for reviewed evidence and remaining acceptance. It replaces the handoff of 2026-10-06. A new
supervisor or agent team resumes from this file, then [README.md](README.md) (goal, invariants, resume protocol),
[burndown.md](burndown.md), [the release process](../../release-process.md) and the root `AGENTS.md`. Nothing here
overrides those invariants. Reviewed local integration candidates also exist; preserve their exact identities and do not treat them as merged or published artifacts.

## Latest supervisor checkpoint — operative 2026-10-11

Progress is **15/40 verified checkpoints**. Core 0.18.4, renderer 0.18.2 and PPTX 0.18.2 are trusted-published and independently verified; [exact patch receipts](../../evidence/rr20-patch-train-publications/README.md). Initial PPTX, editor and CLI 0.18.1 publications are also independently verified. Core 0.18.2 was burned and never published.

PPTX dependency-floor #249 merged at `e19e1533401f49aa73f437d630a72b0362e1da9a`. Fresh mandatory pre-prep packed and full dry-release qualification passed; executed preparation is byte-identical. Release-prep #250 at `d07b63491be294bc9a14c7aba04683036c1eb954` merged at `1954c9ce3d2c54a69666b54acdc9fcc87dcb9ca2` after gate 12145 exited 0 at 18:19:49 UTC. Exact-release-commit gate 24822 passed all four checks at 18:53:20 UTC. Supervisor publisher 88826 and independent verifier 28020 completed exit 0 for tag `opf-pptx-v0.18.2` at `1954c9ce`; [exact receipts](../../evidence/rr20-patch-train-publications/pptx-0182/README.md) bind workflow 38165718768, registry integrity, SLSA, 13 signatures and GitHub Release. [Preparation receipts](../../evidence/rr20-patch-train-publications/pptx-0182-preparation/README.md). Editor 0.18.2 and final release-plan/site adoption remain pending.

Latest root-verified bounded inventory at 18:21 UTC is 27 open PRs and 45 issues, complete pagination, with all eight clean defaults matching remote heads and no changed existing open PR heads. PPTX #250 is merged; no known-creation adjustment is needed for this snapshot. Scratch live-handoff JSON contains historical fields and is not evidence that supersedes completed receipts or the operative status here. The supervisor owns live gates and release mutations; never start another watcher.

Accepted local v0.19 core refresh is `b597dbe099166d62067ea1cc67696c45cc268177`, with strict count #622 and prescribed generated lock #623 incorporated. Final mapped checks pass 24/25; only the genuine minor-version acknowledgment remains unmet. [Source-only review](../../evidence/rr20-patch-train-publications/v019-source-refresh-622623/rr20-v019-core-622623-refresh-review.md). Historical staged graph and packet 06 identities remain immutable. Source tests, staged installed consumers, registry artifacts, native PowerPoint acceptance and site adoption are separate gates; none substitutes for the others.

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
- Follow current `AGENTS.md` and `CONTRIBUTING.md`: do not regenerate gallery/font trackers in unrelated documentation PRs. Regenerate only when the PR changes their generator, overrides or tests; otherwise the post-merge tracker workflow owns refresh.

## Published (verified gitHead, SLSA provenance and npm signatures; GitHub Releases where the package lane creates them)

| Package | Version | Notes |
| --- | --- | --- |
| `@openpresentation/opf` | **0.18.4** | Tag `opf-v0.18.4` at `e09461624a64`, independently verified; prior 0.18.3 also published. **0.18.2 is burned** (tagged, publish failed, never on npm); fix in opf#588. |
| `@openpresentation/opf-render` | **0.18.2** | Tag `opf-render-v0.18.2`, commit `de0a5034f49d`; independently verified. |
| `@openpresentation/opf-pptx` | **0.18.2** | Tag `opf-pptx-v0.18.2`, commit `1954c9ce3d2c`; trusted-published and independently verified. |
| `@openpresentation/opf-editor` | **0.18.1** | Independently verified; 0.18.2 is fully locally prepared/qualified; PR #161 merged at `36d61ea`; exact release-commit gate 19522 is live, publication/verification pending; source #160 is merged. |
| `@openpresentation/cli` | **0.18.1** | Independently verified; unchanged optional-peer policy. |
| `@openpresentation/gallery` | **1.0.0** | Tag `v1.0.0`, commit `3458f50ca8fe`; independently verified. No GitHub Release is required by this lane. |

## The 0.18.x patch train: operative next steps

1. Completed: PPTX trusted publication and independent verification at `1954c9ce`; preserve exact receipts, do not repeat publication. Use actual core 0.18.4 and renderer 0.18.2; do not substitute historical 0.18.1 rehearsals.
2. PPTX 0.18.2 is verified; editor mandatory pre-prep passed and a reviewed dry preparation exists at `/private/tmp/release-train-editor-xeB1Wl`. Prepared qualification 22527 failed the broader browser data-grid F2 edit after all 20 playground cases passed; remaining gates are unrun. Diagnostics confirmed a native keyboard test-harness shortcut mismatch; [source PR #160](https://github.com/OpenPresentation/opf-editor/pull/160) preserves strict assertions and adds focus/selection guards. Reviewed source test fix PR #160 at `44def286` passes all eleven browser/type 205/full 70 locally, preserving failures; exact-head gate 91343 completed exit 0, merging `f35326ac`; fresh prerequisite 25008 passed with exact tree equality. New dry prep 78575 completed with byte-equal reviewed metadata; fresh prepared full replay 39778 completed and execution 86527 opened PR #161 at `bffbe1f2`. PR #161 merged at `36d61ea`; finish live exact merged-commit gate 19522 and trusted publication/verification for editor 0.18.2 with core `^0.18.4`, optional renderer `^0.18.2`, renderer/PPTX development ranges `^0.18.2` with exact 0.18.2 registry lock entries. Normal prep/merge/exact-commit/publish/verify gates remain required. CLI stays 0.18.1 with its existing optional-peer policy.
3. Reconcile release-plan, immutable verification/example refs and consumer locks only against verified published packages; run the prescribed ecosystem roller rather than hand-pin its lock. Sites must adopt all four geometry patch minima and selected renderer font pins, regenerate actual editor/WASM artifacts, and run full site gates. Agents never deploy.

Core #585, combined renderer #219 (including #217/#222/#229/#230) and editor #155 are merged. Policy-data changes move measured geometry, so **PPTX and editor 0.18.2 metadata releases are required**, despite API compatibility and editor #155 being tests-only. The earlier minimal two-package recommendation is superseded by the supervisor's geometry lockstep correction. Gallery host fixtures and remaining site/native acceptance stay open; no scope is removed.

## Operative v0.19 preparation and integration order

Complete the required verified patch train and registry/release-plan adoption first. From clean actual main, use normal release-train preparation for genuine **untagged** core `0.19.0-next.0` metadata with an honest fragment; full history and normal breaking/CI gates are required. Never tag or publish this preliminary version. Integrate that metadata into reviewed v2 sources without losing schema 2, adaptive composition, filename #550, fixtures or strict baselines.

The exact-SHA candidate-gallery tooling is merged (#604), with exact installed global/npm-exec/peer guards and no-build validation fixes. Source PRs requiring gallery 2 need separately reviewed explicit authorization/configuration and full source/staged packed plus pristine published-control checks. Staged manifests are honest local artifacts, not registry-installability claims. Merge qualified sources in dependency order, refresh gallery bootstrap to those exact merged core/renderer commits, qualify and publish gallery 2 through its trusted lane, then independently verify it.

Before stable preparation, a reviewed registry-adoption PR must adopt real gallery `^2` ranges/locks and remove candidate configuration/declarations. Keep that source cleanup outside release-prep's metadata allowlist. Then prepare distinct stable core `0.19.0`, gate its exact commit and publish in dependency order. CLI 0.19's actual core runtime-peer contract requires a separate reviewed source change before CLI prep. Each future renderer version also needs its reviewed exact font-count record; #622 records only 0.18.2, not blanket acceptance. Native T31, sites, final graph and visual/golden acceptance remain independent requirements. No migration aliases or shims.

## Historical checkpoints — superseded where operative summary differs

The following dated material records earlier source/rehearsal states. It is retained for evidence continuity, not current next-step instructions.

### Earlier reviewed candidate checkpoints and 0.19 work

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

## Local-only state and preservation

Current reviewed local core `b597dbe0`, renderer `d4ab7a5861719fb366e50299ee0604b05eec444e` in `/private/tmp/opf-v019-render-published-refresh`, editor `d6481068`, staged graph and packet 06 must be preserved without in-place mutation. [Renderer refresh receipts](../../evidence/rr20-patch-train-publications/v019-render-published-refresh/README.md) record passed build/type/validate and 997-item, 152-page, 84-alignment source checks against explicit core `b597dbe099166d62067ea1cc67696c45cc268177`/e0 gallery. Previous renderer `12766980` remains immutable historical graph identity. Their proof does not establish publication or native acceptance.

The previous supervisor's helper scripts (`rel018-*.sh` and `pubrepro.sh`) lived in a session scratch directory. They
only wrap the documented commands above and are not needed. The tracker artifact at
https://claude.ai/artifact/SKE8TDCXAUE7dthS6EtuEM mirrors this file for the owner.

## Historical gallery 2 source qualification prerequisite

[Registry-backed audit](../../evidence/rr78-gallery2-publication-order/README.md): published0.18 engines fail v2 preview validation and10/73 gallery tests. The existing merged-source bootstrap is required; required core/linked CI currently materializes gallery1 and needs an opt-in exact-SHA gallery2 candidate lane before v2 source merges. Historical checkpoint: GPT-6.1 Sol conversion_review_61 implemented the approved explicit staging lane (now merged as #604); this paragraph preserves its earlier requirements. The earlier implementation work was in `/private/tmp/opf-candidate-gallery-ci` with independent review by editor_review_61. Its resolver/helper and workflow wiring reviews are complete; later graph acceptance remains separate. Candidate checks must exercise gallery-inclusive tarballs with transparent staged manifest differences plus a pristine published control; no generic skips. Release/tag/publish must reject unresolved candidate-gallery metadata and require real registry ^2 locks. Preserve default registry behavior, all gates and frozen feature heads. After qualified v2 engines merge, refresh gallery bootstrap pins to those exact merged commits, pass all gallery gates, publish/verify gallery2, then adopt true registry^2 locks for core0.19. Golden generation tooling alone does not solve required source CI.

## Version acknowledgment before v2 source merges

[Read-only ordering audit](../../evidence/rr78-gallery2-publication-order/prerelease-order.md) confirms the existing breaking/version/release-selector functions support a genuine metadata-only core0.19.0-next.0 preparation after remaining0.18.x/held patches. This future prep needs genuine changelog fragments and all normal CI; keep it untagged and never dispatch its publisher. It does not replace gallery candidate qualification. After qualified v2 source merges and verified gallery2 publication, a reviewed registry-adoption PR updates real^2 ranges/locks and removes staging declarations/configuration. Then the ordinary final stable0.19.0 prep selects a distinct stable-setting commit. No version, tag or publisher was changed by the audit. The gate is preserved, not suppressed.

## Historical pinned-CI candidate evidence run

Core golden dry-run [38115772021](https://github.com/OpenPresentation/opf/actions/runs/38115772021) started from merged tooling b3a0561b on2026-10-11. Exact verified remote core branch head37d96a28aeba2be28a9d4bde5f1aca73264c1a03, renderer8c651e66ca995e790e0fd42d9822b34c4578be29 and gallerye0a7eee2dfe996e680b34a907cabfe41905e6d99; fixture-name rr83-v2-reviewed, dry-run=true, dispatch-ci=false. Run was confirmed in_progress by one identity lookup. No fixture push or promotion authorized; review artifacts only after successful completion. PR gate80227 has finished. Monitor this main b3a0561b commit through the prescribed shared gate; never introduce a second watcher.

Renderer golden dry-run [38116271551](https://github.com/OpenPresentation/opf-render/actions/runs/38116271551) was dispatched from reviewed tooling a224c61c, with renderer8c651e66, core37d96a28 and gallerye0a7eee2 pinned, selection=both, baseline-name rr81-v2-reviewed, dry-run=true. No promotion. Fresh final PPTX0.18.1 dry preparation from merged ff9b41bc completed successfully; its 15-file diff contains only version/dependency/lock/changelog assembly changes. Strict install, full tests and packed validation of this fresh scratch remain in progress; old rehearsal is not substituted.

PPTX final validation completed: strict registry install, all128 package test files, packed consumers/provenance interoperability (54 signatures/15 attestations), browser127-example parity, code checks, syntax269files, validate and pack dry-run pass. Prescribed prep opened [PPTX#245](https://github.com/OpenPresentation/opf-pptx/pull/245), head a8b83f6e430c4bd36d9a6610c5786f9131521f5d. Supervisor verified its exact15-file diff equals the validated dry preparation (same Git abbreviation width). It is ready for the next shared merge batch after CI passes, not published.

Completed gate: session95688 exited0, records-tools-golden-gate.log; watched core598@6688f057, core599@9d080de5, core commitb3a0561b and renderer tooling commita224c61c, without merge, every180seconds. All targets passed confirmation, including core main21/21checks and renderer tooling7/7. The prescribed ecosystem roller generated reviewed lock commit729b705f540569d16995400f47e18da22b35ae31; its diff changes only the lock to the four merged prerequisite heads, with golden selection unchanged. Next shared merge batch includes the lock PR, core598, updated records599, WASM prerequisite600 and PPTX245. Never start parallel watchers.

Inventory reconciliation: PPTX#229 still has remote head be161d727bc8fbd01257de819920e6d1f6f88ffd. The reviewed local RR-78 preparation is6b88822 in /private/tmp/opf-gallery-adoption/opf-pptx (rebased feature plus real gallery1 range); it has not been pushed. Preserve that distinction: remote PR is not yet the reviewed local candidate, and requires post-patch-train rebase, validation and explicit reviewed update before any merge.

WASM site-adoption prerequisite [core#600](https://github.com/OpenPresentation/opf/pull/600) is ready at15bb86b413f3040fd915750c3624b6c9db0596a8. Root reviewed six-file scope, independently passed3regressions and actual registry replay through the existing gallery verifier (renderer0.18.1/HarfBuzz1.6.3,2modules/1108542bytes). Full35root checks/core2262/CLI169+95command suite pass. No site/exampleRefs/release-plan/binary changes. This enables genuine manifest regeneration; final site adoption still waits for published package set and reviewed exampleRefs.

## Supervisor follow-up: editor fixture and native packet

Core#606 merged at `0f6ab6297681a91f3daa2bd9e9c297057f5e092e`. Editor [#158](https://github.com/OpenPresentation/opf-editor/pull/158), `5082d413`, repairs the macOS select-all test gesture and asserts the intended empty numeric edit. All 18 workflows pass against released dependencies and separately against the complete v0.19 source graph. The four-check gate passed and the fix merged at `9a1484bc2e78c67c2c9ef74cc7d8668a53039645`. Fresh editor0.18.1 metadata preparation is now in progress. No editor tag has been created.

The held core585 integration `8d1bcad1` and renderer219/217/222/229/230 integration `84f4bea4` are reviewed local candidates, unpushed. Their full source suites and renderer strict browser checks pass; merged renderer233 is retained. They do not replace actual core0.18.4/renderer0.18.2 registry, OS, packed or release gates, and remain held until initial0.18.1 completion.

The T31 packet remains preparation only. All nine fallback archives are unchanged, while Windows native execution and UI observations remain pending. Correct the duplicate manifest entry and complete portable read-only verification before accepting the packet. Existing multi-series Pareto data loss is tracked in [PPTX#246](https://github.com/OpenPresentation/opf-pptx/issues/246); do not present supported single-series parity as multi-series preservation. The issue does not authorize descope. Source/packed evidence in [core#608](https://github.com/OpenPresentation/opf/pull/608) has passed independent review but remains separate from registry/native acceptance.

## T03 source-review checkpoint

[Exact review coverage](../../evidence/rr20-pr-source-review/coverage.md) closes T03 only: 11/40. Core #609/#610 and editor #159 are merged, not open snapshot claims; editor #159 merge `7831a15` preserves validated dry metadata, with release-commit/publication pending. The original 130 catalog-transition paths and truthful PPTX gallery fragment are durable in reviewed [PPTX #248](https://github.com/OpenPresentation/opf-pptx/pull/248) at `b8c5e5a`. CLI registry/candidate 77 drawing/16 installed font-pin checks pass but source fix remains unmerged. Reviewed Pareto PR #247 plus docs PR #248 need a fresh integrated/native packet; old packet 05 remains immutable. Gallery 2 registry locks, source integration, OS and native gates remain open.

- 2026-10-11: Candidate-gallery tooling PR #604 merged at `080da598013328857f6c9478eabe84b5977c140d`; source qualification remains distinct from actual gallery 2 registry adoption and publication. CLI font-pin follow-up remains unmerged. Progress remains 11/40.

## Editor 0.18.1 published

[Publication and independent verification](../../evidence/rr20-editor-0181-published/README.md) close only T11: 12/40. Exact release identity is `7831a15b10b9b3e1120ed90789fc9429b1c4f846`; trusted run 38129138355, integrity/provenance and two signatures passed. CLI fresh dry preparation completed seven allowed files with independent metadata review passed; full, standalone and strict packed-peer gates passed (77 drawing and 16 installed checks); the breaking-gate baseline is being corrected for the shallow clone after merged PR612 `6eee0d598c3ea0a1e97871a4f966270daf687a42`; no CLI publication claimed. PR608 `e984` checks are pending; PR611 merged at `e71ed7eaa7f51beb5df598196f352a4c909c8b32` and PR613 merged at `f419506f6b287fd1fa467ae84c6ce6b9c7682e6c`. Native and final 0.19/site acceptance remain open.

## CLI 0.18.1 published

[Trusted publication and independent verification](../../evidence/rr20-cli-0181-published/README.md) close only T12: 13/40. Exact commit/tag/gitHead `ceb8a5a42269d9f1574c203adfd76b807e61a603`, run 38133658881; integrity, SLSA and two valid signatures passed with zero invalid/missing signatures. Fresh prep, full/standalone/strict packed peers and the actual `opf-v0.18.3` breaking baseline passed; the earlier shallow-clone diagnosis is resolved. Initial 0.18.1 publications are verified. Held geometry patches, final 0.19 integration, real gallery 2 registry/site adoption and native acceptance remain open.

## Held policy/raster source merged

[Source qualification and merge identities](../../evidence/rr20-held-patch-source-merged/README.md) close only T15/T17: 15/40 including CLI T12. Core #585 is `4387b0273aa64d4705910222c91298c1139c594e`; combined renderer #219 is `dd6b520404d423fd4ddd59e81a9b47971e906be3`, prescribed gate 55383 terminal 0/eight checks. T16 remains pending. The old ecosystem renderer pin fails its Arabic-only multiplier assertion against the merged policy; supervisor roller session 20697 is qualifying the generated lock remedy. No lock completion or patch publication claimed; #616 geometry records remain separate until merged. CLI publication logs remain unchanged.

- 2026-10-11: Generated ecosystem lock PR #619 merged at `d018f752119371fa2bbd2acb46ea91f473aeeab3`, prescribed gate 17418 terminal 0. The stale renderer-contract source lock is repaired; final published release-plan/site adoption (T13) remains open. Editor host #155 merged at `39e62a61`; gallery/core host integration and T16 remain open. Progress remains 15/40.
## Held patch train: required geometry floors

The supervisor applies the geometry-moving lockstep rule to changed `sizeAdjust` and `lineAscent` policy data. Required order: core 0.18.4 → renderer 0.18.2 → PPTX 0.18.2 → editor 0.18.2. The [audit correction](../../evidence/rr20-held-patch-order/README.md#required-geometry-floors-supervisor-correction-2026-10-11) preserves the prior API-compatible finding while replacing its minimal two-package release recommendation. PPTX/editor receive reviewed metadata releases and real upstream floors/locks; no unrelated runtime feature is implied. CLI stays 0.18.1 initially, without optional-peer policy rewrites. Final release-plan, registry controls and sites must use all four required patch minima after actual publication. No checkpoint closes from this decision.

- 2026-10-11: Geometry-floor records PR #616 merged at `c5d26c5ccf9a86ba3bdb82e4cc16cd08f81d92b1`. The required four-package patch order above is now recorded on main; source/publication progress remains 15/40. Core 0.18.4 publication and the remaining patch artifacts are not claimed.

## Historical initial supervisor checkpoint

Superseded by the operative summary above; retained verbatim for provenance.

### Initial checkpoint

Renderer 0.18.1 is published and independently verified. Release prep [#226](https://github.com/OpenPresentation/opf-render/pull/226) merged at `d4259333a1105ce54d136ced0635f086d0f750ee`; its exact-commit gate passed all six checks plus confirmation. Trusted publish run38112000992 and separate supervisor verification both passed npm integrity, tag/gitHead/main equality, SLSA provenance and npm signatures. [Durable evidence](../../evidence/rr20-render-0181-published/README.md). T08 is complete; publisher96032 and verification45877 exited0.

Core#595 merged at `d12ad7e26aa0edfb52e4280dfe527053fe76f98e`. Editor#154 now merged at `4c29be041bb3b4ea67b4b086e69c13395542377c` after all three checks and confirmation; editor main is synced, T09 closes. Old gate67346 exited1 due to the already-diagnosed PPTX244/editor157 failures. Editor157 now incorporates154 at `adf5ef23dd0ad69b05bafe6b3396022eb1ea96c1`; its independent packed replay81886 exited0: 123 byte-matched files, 23 model suites, offline browser workflow, 135 verified registry signatures and 24 attestations. PPTX244 declares `Depends-On: OpenPresentation/opf#595` to select the merged archive repair. Shared gate80227 exited0: core597 merged at b3a0561b993d577b3e792bd1d966e1f7a6148fc5, renderer231 at 5aca1864158a959d52ae2d8c3548d6f6ff0aedae, PPTX244 at ff9b41bc0702b9d043677e76494e48dac8daef71 and editor157 at b2c9bab8a58b17ec3aa10c6360c0870067943986. All four default checkouts synced cleanly. The prescribed ecosystem roller is dispatched as [38116428248](https://github.com/OpenPresentation/opf/actions/runs/38116428248); its generated lock must carry core595 before release-commit gates. No duplicate watcher.

Final PPTX#240 candidate `006e8a7d` passes all 130 package tests and browser build against explicit local v2 candidates; fresh native and published-dependency gates remain. Core script-width draft #593 is reviewed at `13e1c4dc`; schema/example audit #594 is frozen at `53925383` with independent regression checks passing. Gallery-site draft #126 at `88c7119f` implements package ownership and canonical previews/redirects, but published dependency adoption and editor artifact regeneration remain merge blockers. Editor v1 cleanup #156 is frozen at `cef0bd18` with local package/browser acceptance. Main-site #103 at `ab0b0da5` passes 73 browser cases; registry gallery2 installation blocks one case and two serial dependents. pptx.dev #128 at `c83c995f` passes 970 unit tests and all 11 browser cases. All sites still require actual published dependency/lock adoption. Two GPT-6.1 Sol agents are qualifying combined renderer/core changes and gallery/editor integration. The latest bounded inventory is 34 open PRs and 47 issues, pagination complete; all eight clean default checkouts match their remote heads. The live checklist retains these distinctions and is now 10/40 after T30 promotion and T10 publication verification.

The strict macOS font-subset fix renderer#230 remains held for the dependency-ordered patch release. Core#597 and renderer#231 workflow tooling are merged. Prescribed baseline promotions wrote core91a1c96d and rendererab23a258; all807example/498template records match reviewed candidates, renderer note8010a13 is pushed, and gate80911 confirmed both tooling commits at07:17:30UTC. T30 is complete for this exact graph; native and final integrated acceptance remain open. PPTX0.18.1 prep#245 merged95a2f22f with reviewed-tree equality, all four release-commit checks and confirmation passed. Trusted publication run38121535830 and independent registry/provenance verification passed. [PPTX evidence](../../evidence/rr20-pptx-0181-published/README.md); T10 is complete. Editor0.18.1 dry prep is in local release checks. Core#598 CLI prep fix and#600 gallery WASM generator are merged. Renderer#233 at65e743dc corrects an independently reproduced font-test fallback; strict391sample browser replay and full111suites pass; merged at d10ebd36 and primary synced. Coverage audit omissions are incorporated in the new complete source candidates. See [exact source evidence](../../evidence/rr20-complete-source-qualification/README.md); packed/native/registry acceptance remains open. Active gate details are recorded in the current session; source/packed evidence remains distinct from registry proof.


## Local v0.19 peer contract freeze — 2026-10-11

Isolated candidate `1921a28c6d4eea090dc368c13c75ca1b359bdc39` aligns core/CLI optional engine manifests and shared hints. [Durable reviews and logs](../../evidence/rr20-patch-train-publications/v019-engine-peer-contract/README.md) show focused 20/20 and consistency 7/7 passes; mapped 9/11 retains strict absent 0.19 peers and genuine minor-version failure. No full acceptance, merge or publication is claimed. Original b597/staged/packet identities remain immutable. T34/T38 remain open; PPTX gate 24822 completed exit 0 and PPTX 0.18.2 is independently verified; [publication receipts](../../evidence/rr20-patch-train-publications/pptx-0182/README.md).

## Local PPTX v0.19 current-main candidate — 2026-10-11

Clean isolated `f62dd05a8ef0712ca2a35a11857f9085de6fd7a1` in `/private/tmp/opf-v019-pptx-current-refresh` adopts merged `1954c9ce` metadata only. [Receipts](../../evidence/rr20-patch-train-publications/v019-pptx-current-refresh/README.md) preserve original `1fae5a9d` and source checks against actual core `1921a28c`, renderer `d4ab7a58`, gallery `e0a7eee2`. Full-graph/registry 0.19/native acceptance remains separate; PPTX gate 24822 completed exit 0 and PPTX 0.18.2 is independently verified; [publication receipts](../../evidence/rr20-patch-train-publications/pptx-0182/README.md).

## Current editor 0.18.2 qualification

Source #160 merged at `f35326ac`, exact tree equal to reviewed `44def286`; gate 91343 passed. [Merged source prerequisite and dry metadata receipts](../../evidence/rr20-patch-train-publications/editor-0182-preparation/source160-merged-prerequisite/README.md) bind prerequisite 25008 and dry prep 78575, both passed. Fresh prepared qualification 39778 completed exit 0, including all twenty playground and eleven browser suites plus actual packed/provenance gates. Executed preparation 86527 is byte-equal; Editor PR #161 merged at `36d61ea27dd4677724dfec22006759139b7136ff`; gate 33993 completed. Exact release-commit gate 19522 is live; trusted publication and independent verification are still pending.

Earlier prepared qualification 22527 failed the native keyboard harness after twenty playground cases passed; [original failures and source preservation](../../evidence/rr20-patch-train-publications/editor-0182-preparation/failed-qualification/status.md) remain historical. Confirmed diagnostics led to [reviewed repair with final local eleven-browser/type/full passes](../../evidence/rr20-patch-train-publications/editor-0182-preparation/source-test-repair/independent-review.md). These local source passes do not replace the running prepared replay. T18 stays open, progress 15/40.

Editor PR #161 merged at `36d61ea27dd4677724dfec22006759139b7136ff`; gate 33993 completed. Exact release-commit gate 19522 is live; trusted publication and independent verification are still pending. [Exact final preparation and new local source candidate evidence](../../evidence/rr20-patch-registry-adoption/README.md) is retained. Publication/independent registry verification and adoption remain incomplete; progress stays 15/40.
