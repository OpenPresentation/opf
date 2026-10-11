# Release readiness: handoff of 2026-10-11

Written by the release supervisor session at about 00:40 UTC on 2026-10-11. It replaces the handoff of 2026-10-06. A new
supervisor or agent team resumes from this file, then [README.md](README.md) (goal, invariants, resume protocol),
[burndown.md](burndown.md), [the release process](../../release-process.md) and the root `AGENTS.md`. Nothing here
overrides those invariants. Everything in flight is in a pull request or a published release. No work lives only on a
local machine (the exceptions are listed under "Local-only state").

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

## Published (npm `latest`; each verified with gitHead, SLSA provenance, `npm audit signatures` and a GitHub Release)

| Package | Version | Notes |
| --- | --- | --- |
| `@openpresentation/opf` | **0.18.3** | Tag `opf-v0.18.3` at `d52fa6ce`, published 2026-10-11 00:26 UTC. **0.18.2 is burned** (tagged, publish failed, never on npm); fix in opf#588. |
| `@openpresentation/opf-render` | 0.18.0 | 0.18.1 is next (below). |
| `@openpresentation/opf-pptx` | 0.18.0 | 0.18.1 is next. |
| `@openpresentation/opf-editor` | 0.18.0 | 0.18.1 is next. |
| `@openpresentation/cli` | 0.18.0 | 0.18.1 is next. |
| `@openpresentation/gallery` | none | 1.0.0 is blocked on the owner's npm trusted publisher (below). |

## The 0.18.x patch train: exact next steps

The versions for every `release-train.mjs` call:
`--core 0.18.3 --render 0.18.1 --pptx 0.18.1 --editor 0.18.1 --cli 0.18.1 --item RR-20`.

1. **Lock roll** [opf#590](https://github.com/OpenPresentation/opf/pull/590) (head `0588403c`) was in the merge queue
   with its checks green. Confirm it merged: `node scripts/pr-gate.mjs OpenPresentation/opf#590 --merge`. The renderer
   prep needs it, because the lock's core must carry `LAZY_FONT_COUNTS['0.18.1']` (opf#579).
2. **opf-render 0.18.1.** Run `release-train.mjs prep render …`, then use pr-gate to merge the prep PR, then run
   `release-train.mjs tag render … --execute --checks-wait-minutes 30`. `tag` runs `verify`.
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
8. **Sites adopt 0.18.1** (openpresentation-site, pptx-gallery, pptx-dev, on `master`). Each bumps render, pptx and
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

## OPF 0.19: adaptive layouts (RR-79 to RR-84), all drafts

The design is [0.19-layouts.md](0.19-layouts.md) (merged opf#565). The owner removed every migration path.
- **RR-79 core** [opf#577](https://github.com/OpenPresentation/opf/pull/577) (draft, head `74eb3b94` or later, green).
  - Contents: the `opf-layout/v2` schema, the template composer, `layout: "auto"`, list columns and `design.mirror`.
  - 336 template goldens, 61 of them moved by review.
  - No migrate.
  - Decisions 1–14 are in §13 of the design doc; #2 and #5 are superseded.
  - An unknown or former layout id stays a warning (`opf/unresolved-reference`).
- **RR-81:**
  - render [opf-render#215](https://github.com/OpenPresentation/opf-render/pull/215) (draft, green);
  - pptx [opf-pptx#240](https://github.com/OpenPresentation/opf-pptx/pull/240) (draft, native re-check passed; rebase onto #242).
- **RR-80** gallery 2.0.0, [OpenPresentation/gallery#5](https://github.com/OpenPresentation/gallery/pull/5) (draft).
  - Contents: 28 intent templates, `CATALOG_SCHEMA` 2, SVG previews.
  - CI turns green only after core and render 0.19 publish.
  - It needs gallery 1.0.0 published first.
  - Open point: from 2.x the gallery repo is the source, so pptx-gallery#121 (the sync from pptx.gallery to the gallery)
    either becomes 1.x-only or closes.
- **Still to do:**
  - RR-82: the editor.
  - RR-83: convert the 103 examples, docs, skills and site content to v2 with a throwaway script, then remove v1. The
    278-row conversion table should be on a draft branch; check the walkthrough session's PR list.
  - RR-84: the sites.
  - Then the 0.19 lockstep train.

## Owner actions (agents cannot do these)

1. **npm trusted publisher for `@openpresentation/gallery`** at https://www.npmjs.com/package/@openpresentation/gallery/access
   (GitHub Actions, organization `OpenPresentation`, repository `gallery`, workflow `gallery-publish.yml`, no
   environment). Then an agent tags `v1.0.0` in the gallery repo and runs `release-train.mjs verify gallery@1.0.0`. After
   that, [opf#557](https://github.com/OpenPresentation/opf/pull/557) and the siblings move to `^1.0.0`.
2. **One GitHub App for cross-repo pull requests** (covers opf#298 and pptx-gallery#121).
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
