# OPF Release Process

Use Node 24 (`24.x`) for all future source, candidate and registry verification.
The packages declare the open-ended `engines.node` `>=22` (RR-20, tested on Node 22, 24 and 26 by the `node-range`
CI jobs, which run in the merge queue and on pull requests labelled `full-ci`); a closed range such as `24.x` makes npm on any other Node silently install an older release, and
`pnpm check:engines-range` fails on one, including in a lockfile that pins a release made after the fix.
The next releases must document the [Node 24 migration](migrations/node24.md)
and use new versions. Historical dual-runtime release records remain unchanged.

This document is the release runbook for the public JavaScript package,
[`@openpresentation/opf`](https://www.npmjs.com/package/@openpresentation/opf).

The canonical release path is:

1. Merge the release commit to `main`.
2. Push a semver tag whose name matches the package version.
3. Let GitHub Actions publish to npm through npm trusted publishing.
4. Verify npm and the automatically generated GitHub release notes.

## Agent authorization and coordinated release order

The owner authorized agents to prepare and publish npm releases on 2026-09-29
and for future releases whenever a release is required. This does not waive any
gate: a release still needs a merged release-prep PR, green required checks and
the verification below. Agents keep publishing on the trusted-publishing
workflows (GitHub Actions OIDC with `--provenance`); a local `npm publish` is a
fallback only when a workflow cannot run, and it loses the provenance
attestation that every previous version carries.

The engine packages depend on each other, so publish in this order and wait for
each version to appear on the registry before starting the next:

1. `@openpresentation/opf` (this repository, `opf-vX.Y.Z` tag).
2. `@openpresentation/opf-render` (`opf-render-vX.Y.Z` tag) and
   `@openpresentation/opf-pptx` (`opf-pptx-vX.Y.Z` tag). Both depend on core; PPTX
   also devDepends on the renderer, so publish the renderer first.
3. `@openpresentation/opf-editor` (`opf-editor-vX.Y.Z` tag), which depends on core
   and peers/devDepends on the renderer and PPTX.

Each sibling's release-prep PR raises its dependency floors to the just-published
versions. Its lockfile can only be refreshed after the upstream version exists on
npm (`npm install --package-lock-only`), so merge sibling release PRs only after
the upstream publish. `@openpresentation/cli` depends on core (a regular dependency; its floor is raised by the release-prep PR like the others, the commands run that core's Node engine) and is released
separately by `cli-publish.yml` (`cli-vX.Y.Z`) when a CLI release is needed.

The CLI release gate includes the installed-package regression `packages/cli/test/installed-regression.mjs` (RR-59, [opf#476](https://github.com/OpenPresentation/opf/issues/476)). It drives the installed `opf` binary beside the published opf-render and opf-pptx, the render font packages and the Noto JP and SC script packages, with no network after the install (a preload refuses every connection and fetch, and a local server that the image URLs point at counts zero requests): `opf render --format svg` embeds `Noto Sans JP` 400 and 700 for a `ja-JP` deck, nothing under `--svg-fonts none` and no CJK face for a Latin-only deck; `opf export --format pptx` of a deck with an `https:` content image (an image block and a quote photo) exits 0 with a `pptx/unresolved-asset` warning at the slide path and the placeholder, exits 1 and writes no file under `--fail-on warning`, and exports a native picture for an embedded or local PNG under `--fail-on warning`. It runs in `pnpm test:cli:packed:peers` (the candidate CLI and core tarballs; OPF CI, the Windows and engines-range CLI jobs, and `cli-publish.yml` before `npm publish`) and in `pnpm test:registry-ecosystem` (the published set of `release-plan.json`, from plan 0.16).

A sibling pull request that needs a core that is not on npm yet (a breaking core release and its sibling PRs, `Depends-On: OpenPresentation/opf#N`) declares it in its `package.json` as `"opf": { "requiresUnreleasedCore": "X.Y.Z" }` (RR-55). Its CI then skips only the packed install against published dependencies (`npm run test:packed`, with a `::notice::`) while the installed published `@openpresentation/opf` is lower than `X.Y.Z`; every linked-ecosystem step still runs. The field is for pull requests only: `release-train.mjs prep` deletes it (and refuses a field above the core of the train), and `plan` flags a release commit whose `package.json` still carries it.

Release-prep PRs contain only version bumps, changelog entries, dependency ranges
and lockfile changes (plus current-instruction docs). The changelog entries are
not written by hand: every change adds a fragment `changes/<slug>.md` in its own
PR (RR-46, [changes/README.md](../changes/README.md)), and the release-prep PR
runs the assembler, which moves the fragments into the new release section of
`CHANGELOG.md` and deletes them. Each sibling repository has the same
`changes/` directory and script:

```sh
# core (packages are named in each fragment: opf = CHANGELOG.md, cli = packages/cli/CHANGELOG.md)
node scripts/changelog-fragments.mjs assemble --version X.Y.Z --package opf --date YYYY-MM-DD
node scripts/changelog-fragments.mjs assemble --version A.B.C --package cli   # only when the CLI is released
# opf-render, opf-pptx, opf-editor
node scripts/changelog-fragments.mjs assemble --version X.Y.Z --date YYYY-MM-DD [--summary "Patch release: ..."]
```

Use `--dry-run` to preview, and check that no `changes/*.md` other than
`README.md` remains for the released package before opening the PR. After the whole set is on
the registry, a follow-up docs change updates `release-plan.json`, the
compatibility matrix and the quickstart to the published set, and the gallery
consumer dependencies are bumped.

## Release train (scripted, RR-51)

`scripts/release-train.mjs` runs the coordinated release above in lockstep order. It is run by the supervisor with
their own `gh` login (or `GH_TOKEN`); every command is a dry run unless `--execute` is given. It only reads, opens
release-prep pull requests and creates tags: it never merges a pull request and never publishes. Each package is still
published by its own repository's trusted-publishing workflow (OIDC, `--provenance`) when its tag appears.

Name the versions of the train, any subset: `--core X.Y.Z --render X.Y.Z --pptx X.Y.Z --editor X.Y.Z --cli X.Y.Z`.
The order is always core, then opf-render, then opf-pptx, then opf-editor and the CLI.

```sh
# 1. What is missing (read only; exit 1 until every package is on npm)
node scripts/release-train.mjs plan --core 0.12.1 --render 0.12.1 --pptx 0.12.3 --editor 0.11.3 --cli 0.10.1

# 2. The release-prep PR of the next package, once its upstream is on npm (dry run first: a scratch clone and the diff)
node scripts/release-train.mjs prep render --core 0.12.1 --render 0.12.1 [--item RR-nn]
node scripts/release-train.mjs prep render --core 0.12.1 --render 0.12.1 --item RR-nn --execute

# 3. After a person merged it with green CI: tag the release commit, wait for the publish run and npm, verify
node scripts/release-train.mjs tag render --core 0.12.1 --render 0.12.1 --execute

# 4. Verify any published version (also run by `tag` and `run`)
node scripts/release-train.mjs verify @openpresentation/opf-render@0.12.1

# Or the whole sequence: it stops at the first step that needs a person and prints the command to resume
node scripts/release-train.mjs run --core 0.12.1 --render 0.12.1 --pptx 0.12.3 --editor 0.11.3 --cli 0.10.1 --execute
```

What each step checks:

- `plan` reads, per package: whether the version is already on npm (then it is only verified), the version in the
  manifest at `main`'s head, the release commit (the commit that set the version) and its merged release-prep PR, the
  required checks on the release commit (the `main` ruleset's required checks; for a repository without a ruleset,
  every reported check), the tag, whether the upstream versions of the train are on npm, and the dependency floors.
  It flags every sibling whose `@openpresentation/opf` floor stays below a new core in the train, with hints from core's
  fragments or changelog section: the tool cannot know whether a core release moves geometry, so the release owner
  decides whether the lockstep rule below applies (flag, never decided).
- `prep` refuses until every upstream version of the train is on npm. In a scratch clone of `main` it bumps the
  version, runs `node scripts/changelog-fragments.mjs assemble --version X.Y.Z --date <today>` (with `--package opf` or
  `--package cli` in core, `--summary` when given), raises the floors that name a package of the train (caret and
  tilde ranges keep their operator; exact devDependency pins move to the exact version; `workspace:*` is untouched;
  for the CLI, `PEER_RANGES` in `packages/cli/src/peers.ts` follows its peer ranges) and refreshes the lockfile
  (`npm install --package-lock-only` in the siblings, `pnpm install --lockfile-only` in core). It fails if a fragment
  for the package is left or if anything other than the manifest, changelog, fragments, lockfile and peers file
  changed. The PR body lists README lines that name the previous version for a person to review; prose is not
  rewritten. It also deletes `opf.requiresUnreleasedCore` from the manifest when the sibling declares it (see above; `plan` flags a release commit that keeps it). Branch `codex/release-<package>-<x-y-z>` unless `--branch` is given. An open release-prep PR (found by
  branch or by a "release <package> X.Y.Z" title) or a merged one is detected and nothing is written.
- `tag` re-verifies right before tagging: the version at the release commit, that the commit is on `main`, green
  required checks, every upstream of the train on npm and every runtime floor naming a version npm has. It then creates
  `refs/tags/<prefix>X.Y.Z` (`opf-v`, `opf-render-v`, `opf-pptx-v`, `opf-editor-v`, `cli-v`) with
  `POST /repos/{repo}/git/refs` on the release commit (checks that are still running, or not reported yet right after
  the merge, stop it unless `--checks-wait-minutes N` is given: it then polls them every `--poll-seconds` for up to N
  minutes, and a red check still stops it at once), polls that repository's publish workflow run for the tag
  (default every 120 s, up to 90 min), polls npm until the version is visible, and runs `verify`. A tag that already
  exists on the release commit is not created again; one on another commit stops the train. A failed publish run stops
  with its link: never move or re-push the tag; re-run a transient failure (`gh run rerun <id> --failed`), fix a real
  one on `main` with a new version.
- `verify` checks the registry manifest, that `gitHead` equals the tagged commit (and that the commit is on `main` and
  carries the version), `dist.attestations` with the SLSA v1 provenance predicate, the provenance statement itself
  (built by `.github/workflows/<publish workflow>` of the package's repository on `refs/tags/<tag>` from the tagged
  commit, subject digest equal to `dist.integrity`), `npm audit signatures --include-attestations` in a scratch
  project that installs exactly that version (no invalid or missing signatures; the package has a verified
  attestation), and the GitHub release where the repository's workflow creates one (core only; the sibling and CLI
  workflows create none). The dist-tag is reported for information.
  - Propagation: right after a publish, npm serves the packument (with `dist.attestations.url`) minutes before the
    attestation bundle (HTTP 404 `{"error":"Not found"}`) and before a fresh `npm install` can resolve the version
    (`notarget`, "No matching version found"); the first live use, core 0.12.1, failed `verify` on exactly these two
    for 2-4 minutes. Only those two checks wait: `tag` and `run` retry the bundle fetch and the scratch install every
    30 s (`--attest-poll-seconds`) for up to 15 min (`--attest-wait-minutes`; 0 turns the wait off) and say what they
    wait for in the log. Any answer that is not "not yet there" fails at once without waiting: a bundle that is
    present but has no SLSA provenance or names another repository, workflow, ref, commit or digest, an invalid or
    missing signature, any other install error. If the wait runs out, the check fails with "still not propagated
    after N min". Standalone `verify` keeps failing fast; `verify <package>@X.Y.Z --wait <minutes>` gives it the same
    retry (for example right after a publish run you started by hand).
- `run` repeats `plan` per package in order and does the next step: verify what is on npm, stop at an open release-prep
  PR, open a missing one (`prep`), wait for pending checks on a merged release commit, then `tag`. Re-running it after
  a stop skips every step already done; a version already on npm is never published again.

The follow-up docs PR (`release-plan.json`, the compatibility matrix and the quickstart) and the gallery consumer bumps
stay by hand after the train.

`.github/workflows/release-train.yml` is the same script as a `workflow_dispatch` (inputs: the versions and `mode`).
Until the GitHub App of [opf#298](https://github.com/OpenPresentation/opf/issues/298) exists it is plan-only: tags
pushed with a workflow's `GITHUB_TOKEN` start no other workflow (so the publish workflows would never run), and
`GITHUB_TOKEN` cannot push branches or open pull requests in the sibling repositories, so `mode: execute` fails at
once. With the App (`ECOSYSTEM_APP_ID` variable and `ECOSYSTEM_APP_PRIVATE_KEY` secret, the roller's App) `mode:
execute` runs `run --execute` with the App's token.

The steps by hand below remain the fallback when the script cannot run.

## Geometry-moving core releases: lockstep floors

Core composition changes that move geometry (for example opf#169 cover centering) make the preview and the PPTX export drift when `@openpresentation/opf-render` and `@openpresentation/opf-pptx` resolve different core versions (measured: 186-300 pt title offsets on covers).

Rule: when a core release contains composition or geometry changes, the same release train must raise BOTH the renderer's and PPTX's core floor (`dependencies` and, where present, `peerDependencies`) to that core version, publish them together, and raise the editor's floor too. Do not release core alone and leave a sibling on the older floor.

The parity harness must always run with `--import <opf>/scripts/register-local-opf.mjs` (as `run.ps1` does) so every engine shares one core.

## Release Preconditions

Before tagging, confirm that the release commit on `main` already contains:

- `packages/javascript/package.json` with the intended version.
- `CHANGELOG.md` with the matching release section (assembled from `changes/`, see above).
- Passing `OPF CI` on the release commit.

The publish workflow validates the tag name against
`packages/javascript/package.json`, so the tag must point at the release commit.

## Tag And Publish

Use the `opf-vX.Y.Z` tag form for the package release:

```sh
git checkout main
git pull origin main
grep '"version"' packages/javascript/package.json
git tag opf-vX.Y.Z
git push origin opf-vX.Y.Z
```

For example, version `0.3.0` used:

```sh
git tag opf-v0.3.0
git push origin opf-v0.3.0
```

Pushing the tag triggers `.github/workflows/npm-publish.yml`. The workflow:

- runs on tags matching `opf-v*` or `@openpresentation/opf@v*`
- installs dependencies with pnpm on Node 24
- verifies the tag matches `packages/javascript/package.json`
- runs typecheck and tests
- runs the npm package dry-run check
- publishes from `packages/javascript` with `npm publish --access public --provenance`

Do not rerun a successful publish for the same version. npm package versions are
immutable; a second publish for an already-published version should fail.

## Trusted Publishing

npm publishing is configured to use GitHub Actions OIDC trusted publishing, not
a long-lived npm token.

Expected npm package trusted-publisher settings:

| Setting | Value |
|---|---|
| Package | `@openpresentation/opf` |
| Publisher | GitHub Actions |
| Organization/repository | `OpenPresentation/opf` |
| Workflow filename | `npm-publish.yml` |
| Environment | empty, unless the workflow is later moved behind a GitHub Environment |
| Permission | `npm publish` |

Expected workflow settings:

```yaml
permissions:
  contents: read
  id-token: write
```

The publish step should not set `NODE_AUTH_TOKEN`:

```yaml
- name: Publish to npm
  working-directory: packages/javascript
  run: npm publish --access public
```

If a future release fails with npm authentication errors, check the npm
trusted-publisher settings first. Only use an `NPM_TOKEN` repository secret as a
temporary fallback, and remove or revoke it once OIDC publishing works again.

## Verify The Release

`node scripts/release-train.mjs verify <package>@X.Y.Z` runs every registry check of this section and the provenance
checks (see "Release train" above). By hand, after the workflow completes, verify npm:

```sh
npm view @openpresentation/opf version
```

The output should equal the package version that was tagged.

Spot-check the validator API from a clean project or temporary directory:

```sh
npm install @openpresentation/opf@X.Y.Z
node --input-type=module -e "import {validate} from '@openpresentation/opf'; console.log(validate({name:'t', narrative:'not-a-real-id', slides:[{title:'t'}]}, {only:['format','references']}).findings)"
```

The expected result is one `opf/unresolved-reference` warning for the narrative (no catalog is registered).

## GitHub Release Notes

The core tag workflow creates a GitHub Release from the matching changelog section after publishing. Verify that release after npm is verified. If release creation failed, create the missing release for the existing tag:

```sh
gh release create opf-vX.Y.Z \
  --repo OpenPresentation/opf \
  --title '@openpresentation/opf X.Y.Z' \
  --notes-file /path/to/release-notes.md
```

Use the matching `## X.Y.Z` section from `CHANGELOG.md` as the release notes.

## Troubleshooting

If the tag/version check fails, the tag does not point at the release commit or
the tag name does not match `packages/javascript/package.json`. Delete the bad
local and remote tag, fetch `main`, and tag the correct commit:

```sh
git push origin :refs/tags/opf-vX.Y.Z
git tag -d opf-vX.Y.Z
git checkout main
git pull origin main
git tag opf-vX.Y.Z
git push origin opf-vX.Y.Z
```

If tests fail, fix the code on `main`, create a new release commit, and move the
tag only if npm has not already published that version.

If npm publish fails with `ENEEDAUTH`, confirm:

- npm has a trusted publisher for `OpenPresentation/opf`
- the trusted publisher uses workflow filename `npm-publish.yml`
- `.github/workflows/npm-publish.yml` has `id-token: write`
- the publish job is running on a modern Node/npm toolchain

If npm publish fails after the version is already present on npm, do not retry
the same publish. Verify the package and treat the failure as a duplicate
publish attempt.
