# OPF Release Process

Use Node 24 (`24.x`) for all future source, candidate and registry verification.
The packages declare the open-ended `engines.node` `>=22` (RR-20, tested on Node 22, 24 and 26 by the `node-range`
CI legs, which run in the nightly workflow, before every release and on pull requests labelled `full-ci`); a closed range such as `24.x` makes npm on any other Node silently install an older release, and
`pnpm check:engines-range` fails on one, including in a lockfile that pins a release made after the fix.
The next releases must document the [Node 24 migration](migrations/node24.md)
and use new versions. Historical dual-runtime release records remain unchanged.

This document is the release runbook for the six published packages of this repository:
[`@openpresentation/opf`](https://www.npmjs.com/package/@openpresentation/opf) (core, `packages/javascript`),
`@openpresentation/cli`, `@openpresentation/opf-render`, `@openpresentation/opf-pptx`, `@openpresentation/opf-editor` and
`@openpresentation/gallery`. They are released together, at one version, with one tag.

## Release: one click (MR-40)

> Status: the workflows and `scripts/release.mjs` are in place and rehearsed with dry runs. The first real release through them
> is the canary `0.26.0-rc.0` (MR-41), then 0.26.0 (MR-44). The sections after "Retired per-repository process" below describe
> the process that released up to 0.25.x from the four old repositories; MR-34 and MR-50 delete them.

**One version, one tag, one workflow.** All six packages carry the same version (`pnpm check:versions`); a release is the tag
`vX.Y.Z` on a commit of `main`, published by `.github/workflows/npm-publish.yml` in dependency order: gallery, core, render,
PPTX, editor, CLI. In 0.x a breaking change is a minor release and everything else a patch. Prereleases (`0.26.0-rc.0`) go to
the dist-tag `next`, releases to `latest`; both are passed explicitly to `npm publish --tag` for every package.

### Run a release

Actions, **Release**, **Run workflow** on `main`:

| Input | Meaning |
| --- | --- |
| `version` | `X.Y.Z`, `X.Y.Z-rc.N`, or `patch` / `minor` of the shared line (the highest `latest` of core, CLI, render, PPTX and editor) |
| `dry-run` | Default **true**: rehearse everything up to `npm publish --dry-run`; nothing is committed, tagged or published. Set false for the real release |
| `skip-gate` | A dry run only: skip the slow gate |

Run it with `dry-run` true first when the change touches the release machinery; a real release of ordinary changes needs no
rehearsal. The jobs:

1. **plan**: a real release runs on `main`, and the check `verify` is green for its head (one API call, no waiting).
2. **gate** (parallel with prepare): `nightly.yml` called on that commit: Windows, macOS, Node 22 and 26, the packed-install and
   registry consumers. A red leg stops the release before anything is committed or tagged.
3. **prepare** (parallel with gate): `node scripts/release.mjs prepare <version>` in the runner: sets the six versions, core's
   peer ranges and `PEER_RANGES` (`packages/javascript/src/node/peers.ts`), assembles every `changes/` fragment into its package
   changelog (a package without a fragment gets "No package changes; released with the set."), applies the gallery stability gate
   and the version rules below, refreshes the lockfile, and uploads the result as a patch. A refused version fails here, in two
   minutes.
4. **commit and tag** (real release, after gate and prepare): with the GitHub App's token (a bypass actor on the `main` ruleset)
   applies the patch as one commit `release vX.Y.Z` on exactly the commit the gate tested, pushes it to `main`, then pushes the
   tag `vX.Y.Z`. If `main` moved during the run, or the tag exists, it stops. A tag pushed with the App's token starts
   `npm-publish.yml` (a tag pushed with `GITHUB_TOKEN` would not).
5. **npm-publish.yml** on the tag: `plan` (the tag is on `main`), `build` (one install and build, `pnpm pack` of the six,
   `scripts/stamp-githead.mjs` adds `gitHead` to each tarball because `pnpm pack` omits it, a smoke test installs the six
   tarballs together, renders the quickstart deck and runs the CLI), `publish` (the only job with `id-token: write`; the
   pre-publish gate, then `npm publish <tarball> --access public --provenance --tag <tag>` six times; a version already on npm is
   skipped), `verify` (below), `release` (the GitHub release, notes grouped by package) and `report` (a failure opens the issue
   "Release vX.Y.Z failed", labeled `release-failed`).
6. **follow the publish run** (the Release run waits for it, so it is green only when the whole release is).

Time target: about 20 minutes from the click to six verified packages (measured in MR-44).

### Version rules

- `prepare` refuses a version that is not above the shared line's previous release, and one already on npm for any package
  (a published version is never reused; fix forward).
- **The gallery stability rule** (`scripts/gallery-stability.mjs`, `pnpm check:stability`; see
  [default-catalog.md](default-catalog.md)): a declared drawing change (a `drawing` entry in a gallery fragment), a removed record
  id or a `CATALOG_SCHEMA` change needs a **minor** release; `prepare` refuses a patch. New records and unchanged drawings go in
  any release. The baseline is the gallery's `latest` dist-tag, never its highest version.
- **The publish gate** (`release.mjs check-publish`, run by `publish`): each package's version is above its own registry
  `latest`, except the gallery, which is compared with the shared line, because its `latest` was 5.0.0 before it joined the
  shared 0.x line (D16). A stable version needs `latest`, a prerelease must not take it. 5.0.0 and the older gallery versions
  stay published and are never deprecated; because they are above the shared line, every gallery publish names its tag explicitly.
- The shared line cannot use 1.0.0 to 5.0.0 (taken by the gallery): the first stable major for all six is 6.0.0.

### Trusted publishing

All six packages have the trusted publisher: GitHub Actions, organization `OpenPresentation`, repository `opf`, workflow filename
`npm-publish.yml`, no environment (owner steps O1 in `docs/programs/monorepo/owner-steps.md`). npm checks the entry against
the **top-level** workflow of the run, not against a reusable workflow that contains `npm publish`, so `npm-publish.yml` is the
workflow that starts on the tag and `release.yml` only pushes the tag. `publish` refuses to publish from any other top-level
workflow. A publish fails with `E404` or `E403 ... not a trusted publisher` when an entry is wrong: fix the entry and re-run
the workflow on the tag. There is no `NPM_TOKEN`, and no local publish: the provenance gate applies to every release.

### Retry and failure

A failed `npm-publish.yml` run is fixed and run again on the same tag: Actions, **Publish OPF npm packages**, **Run workflow**,
ref `vX.Y.Z`, `dry-run` false (or re-run the failed run). Versions already on npm are skipped, so it continues where it stopped.
A partial publish is safe: the `^X.Y.Z` floors point at packages that exist, because the order is dependency order. A real
defect in a published version is fixed forward with the next patch and a new tag; tags are never moved. If `prepare` or the gate
fails, nothing was committed: fix the cause and run the release again.

### Fallback: a release pull request

If no App token is available, or a person prefers review: on a branch run `pnpm release:prepare X.Y.Z`
(`node scripts/release.mjs prepare X.Y.Z`; it needs `pnpm build` first for the stability gate), open the pull request, merge it
on green, then on `main` run `git tag vX.Y.Z && git push origin vX.Y.Z`. The publish workflow is the same.

### Verify

The `verify` job runs `node scripts/release.mjs verify X.Y.Z --tag <dist-tag> --commit <release commit> --wait 10` and then the
smoke test against the registry (`release.mjs smoke X.Y.Z --registry`). For all six packages it checks the registry manifest,
`gitHead` and the provenance source commit equal to the release commit, the provenance workflow `npm-publish.yml` on
`refs/tags/vX.Y.Z`, the subject digest, the dist-tag, that no manifest carries a `workspace:` range and every sibling range is
`^X.Y.Z`, `npm audit signatures`, and that each package changelog has the version's section. By hand:

```sh
node scripts/release.mjs verify X.Y.Z --tag latest            # exit 0 when all six verify
npm view @openpresentation/opf@X.Y.Z gitHead dist.attestations.url
npm view @openpresentation/gallery dist-tags --json           # latest is X.Y.Z; 5.0.0 stays published
```

### `scripts/release.mjs`

| Command | Does |
| --- | --- |
| `prepare <version> [--dry-run] [--no-stability] [--previous V]` | the prepare step above (`--dry-run` writes nothing) |
| `pack <version> --commit <sha> --out <dir>` | `pnpm pack` of the six, `gitHead` stamped, `release-manifest.json` with digests |
| `smoke <version> (--dir <dir> \| --registry)` | install the six together, render, resolve, run the CLI |
| `check-publish <version> [--tag t]` | the pre-publish gate |
| `publish <version> --dir <dir> [--tag t] [--dry-run]` | the gate, then `npm publish` in dependency order |
| `verify <version> [--tag t] [--commit sha] [--wait minutes]` | the registry and provenance check |
| `notes <version> [--out file]` | the GitHub release body |
| `order` | the publish order |

### Who may release

The owner authorized agents to prepare and publish npm releases on 2026-09-29 (`AGENTS.md`). A release is made only through
`release.yml` (or the pull-request fallback) and `npm-publish.yml`, only when one is required and only with every gate green;
agents never publish from a laptop, never skip the gate and never pass a different `--tag` to make a check pass. Dry runs are
free at any time.

## Retired per-repository process (until MR-34 and MR-50)

Everything below describes how releases up to 0.25.x were made from the four old repositories, with per-package versions,
the release train script, the gallery lane and CI evidence. It stays until MR-34 deletes the machinery it describes and MR-50
rewrites the rest of this document for the monorepo.

## Agent authorization and coordinated release order

The owner authorized agents to prepare and publish npm releases on 2026-09-29
and for future releases whenever a release is required. This does not waive any
gate: a release still needs a merged release-prep PR, green required checks and
the verification below. Agents keep publishing on the trusted-publishing
workflows (GitHub Actions OIDC with `--provenance`). If a workflow cannot run,
stop and repair the trusted-publishing path; do not substitute a local publish
or an npm-token publish that omits the required provenance.

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

The CLI release gate includes the installed-package regression `packages/cli/test/installed-regression.mjs` (RR-59, [opf#476](https://github.com/OpenPresentation/opf/issues/476)). It drives the installed `opf` binary beside the published opf-render and opf-pptx, the render font packages and the Noto JP and SC script packages, with no network after the install (a preload refuses every connection and fetch, and a local server that the image URLs point at counts zero requests): `opf convert deck.opf.json deck.svg` embeds `Noto Sans JP` 400 and 700 for a `ja-JP` deck, nothing under `--text system` and no CJK face for a Latin-only deck; `opf convert deck.opf.json deck.pptx` of a deck with an `https:` content image (an image block and a quote photo) exits 0 with a `pptx/unresolved-asset` warning at the slide path and the placeholder, exits 1 and writes no file under `--fail-on warning`, and exports a native picture for an embedded or local PNG under `--fail-on warning`. It runs in `pnpm test:cli:packed:peers` (the candidate CLI and core tarballs; OPF CI, the Windows and engines-range CLI jobs, and `cli-publish.yml` before `npm publish`) and in `pnpm test:registry-ecosystem` (the published set of `release-plan.json`, from plan 0.16).

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
  every reported check apart from existing advisory bots and the identity-verified scheduled Editor flake measurement), the tag, whether the upstream versions of the train are on npm, and the dependency floors.
  It flags every sibling whose `@openpresentation/opf` floor stays below a new core in the train, with hints from core's
  fragments or changelog section: the tool cannot know whether a core release moves geometry, so the release owner
  decides whether the lockstep rule below applies (flag, never decided).
- `prep` refuses until every upstream version of the train is on npm. In a scratch clone of `main` it bumps the
  version, runs `node scripts/changelog-fragments.mjs assemble --version X.Y.Z --date <today>` (with `--package opf` or
  `--package cli` in core, `--summary` when given), raises the floors that name a package of the train (caret and
  tilde ranges keep their operator; exact devDependency pins move to the exact version; `workspace:*` is untouched;
  for CLI preparation, already-compatible patch peer ranges stay unchanged while development pins advance;
  core runtime files are never edited by CLI prep) and refreshes the lockfile
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
  minutes, and a red check still stops it at once; the checks are the release commit's CI evidence, see
  [CI evidence](#ci-evidence-and-the-merge-queue-fast-path-rr-100): green evidence means no second round of checks is
  waited for), polls that repository's publish workflow run for the tag
  (default every 120 s, up to 90 min), polls npm until the version is visible, and runs `verify`. A tag that already
  exists on the release commit is not created again; one on another commit stops the train. A failed publish run stops
  with its link: never move or re-push the tag; re-run a transient failure (`gh run rerun <id> --failed`), fix a real
  one on `main` with a new version.
- `verify` checks the registry manifest, that `gitHead` equals the tagged commit (and that the commit is on `main` and
  carries the version), `dist.attestations` with the SLSA v1 provenance predicate, the provenance statement itself
  (built by `.github/workflows/<publish workflow>` of the package's repository on `refs/tags/<tag>` from the tagged
  commit, subject digest equal to `dist.integrity`), `npm audit signatures --include-attestations` in a scratch
  project that installs exactly that version (no invalid or missing signatures; the package has a verified
  attestation), and the GitHub release for the tag (every lockstep package's publish workflow creates one from 0.18
  on, RR-20; a gallery release has none). A release that is not "Latest" passes: the CLI's is created with
  `--latest=false` because core owns "Latest" in `OpenPresentation/opf`. The dist-tag is reported for information.
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

## The gallery lane (RR-78)

`@openpresentation/gallery` (the pptx.gallery catalog records) is released from its own repository,
[OpenPresentation/gallery](https://github.com/OpenPresentation/gallery), on its own version line, outside the lockstep
train: `release-train.mjs` has it in `INDEPENDENT_PACKAGES` (repository `gallery`, tags `vX.Y.Z`, workflow
`gallery-publish.yml`), never in `PACKAGES`, so no train plans, preps or tags it, and `release-plan.json` lists it under
`independentPackages`. A gallery release needs no core release, and a core release does not release the gallery.

- **Versions.** New records are a minor release. Removing or renaming an id, changing how an existing record draws, or
  a change that needs a newer record schema (`opf.catalogSchema`) is a major release. The gallery repository's
  pixel-stability check (`npm run check:stability`, on every pull request there and before every publish) fails a
  minor or patch release that changes an existing record's drawing or removes an id.
- **Release and publish.** In the gallery repository: a pull request that sets the version and the `CHANGELOG.md`
  section, then a `vX.Y.Z` tag on main. Its `gallery-publish.yml` refuses a tag that is not `v` plus the version, a
  tag off main and a `repository` other than OpenPresentation/gallery, runs every check, and publishes with
  `npm publish --access public --provenance` (see its CONTRIBUTING.md).
- **Verify.** `node scripts/release-train.mjs verify gallery@X.Y.Z` here (tag `vX.Y.Z` and gitHead in
  OpenPresentation/gallery, provenance built by `gallery-publish.yml` on `refs/tags/vX.Y.Z`, signatures). The workflow
  creates no GitHub release.
- **Trusted publisher on npm** (`@openpresentation/gallery`, Settings, Trusted publishing): GitHub Actions,
  organization `OpenPresentation`, repository `gallery`, workflow filename `gallery-publish.yml`, no environment.
- **First release.** `1.0.0` is the first version published from OpenPresentation/gallery; `0.0.1` was a placeholder
  published by hand. Against 0.0.1 the stability check runs as a major release and reports no changed record.

From OPF 0.19, core and the CLI consume the independently published Gallery package: their Node defaults register
`gallery`, and core has no `/catalog` subpath. OPF 0.19 used Gallery 2; OPF 0.20 uses Gallery 3; this checkout depends on Gallery `^5.0.0` (FA-33: layouts as one list of regions, `CATALOG_SCHEMA` 4; Gallery 4 added theme `variants` and removed the `dark` theme, RR-96), while the published 0.24 set (and `release-plan.json`) still depends on Gallery `^4.0.0`.
The current ranges and exact verified set are in the package manifests and [release-plan.json](../release-plan.json).
A core or CLI release needs a Gallery version its range accepts on npm first. A reviewed registry-adoption PR
updates those ranges and the authentic lockfile after independent publication verification. Stable release
preparation follows that adoption; it does not perform the source configuration transition.

FA-33 (layouts as one list of regions) is such a major: core's catalog contract (`CATALOG_SCHEMA`) is 4 and Gallery 5.0.0 targets it, so
core's `^4.0.0` range could not ship it. While Gallery 5.0.0 was unpublished, `packages/javascript/package.json` declared
`opf.requiresUnreleasedGallery: "5.0.0"`, `.github/candidate-gallery.json` (configuration version 3) named the reviewed
gallery SHA, and the core pull request body carried `Candidate-Gallery: OpenPresentation/gallery@<sha>`. Gallery 5.0.0 is published and
verified (tag `v5.0.0`, gitHead `eff55fdd9ce712813ef798dd9f2b50a37abada53`), and the registry-adoption pull request (FA-33: adopt gallery 5.0.0)
moved the ranges in the root, core and CLI manifests to `^5.0.0` with the lockfile and deleted both the declaration and the configuration
file. `release-plan.json` now describes the published 0.25.0 set (core and the CLI on Gallery 5.0.0), and
`scripts/test-font-switch-ecosystem.mjs` reads only the region-list layout shape.

Before registry adoption, explicit authenticated candidate CI can stage reviewed gallery and engine tarballs
(`scripts/candidate-gallery-build.mjs`, `scripts/pack-cli-candidate.mjs`, `scripts/pack-ecosystem.mjs`). Its recorded
original/staged metadata and runtime checks qualify development consumers; they do not prove the declared source
ranges are registry-installable or authorize publication. Ordinary registry and publication gates stay unchanged.
Core's registry tests use the exact gallery version and integrity recorded in the workspace lockfile.

## Published control and the release plan as a floor (RR-101)

The "Published runtime and reviewed registry graph control" workflow (`published-gallery-control.yml`, run for candidate-gallery pull
requests) qualifies the published packages, not the plan file: `resolvePublishedControl` in `scripts/candidate-gallery.mjs` reads
`release-plan.json` as a floor. Each package accepts the registry `latest` when it has the plan's major and minor and a patch greater
than or equal to the plan's; the independent gallery accepts its major with a minor or patch greater than or equal to the plan's. For a newer
`latest` it looks up that exact version, requires the matching name and version and a 40 lowercase hex `gitHead`, uses that `gitHead` as the
source ref and prints `::notice::plan is behind registry: <package> <plan> -> <latest>`. When `latest` equals the plan, the registry
`gitHead` must still equal `verificationRefs`. The result is a resolved plan (the reviewed plan with versions and `verificationRefs`
raised); `candidate-gallery-control.mjs stage` writes it into the published checkout (and to `artifacts/published-control/resolved-plan.json`),
so the installed-code and registry checks install and verify the newer versions, and `verify` binds the staged bytes to the resolved plan, which must stay
inside the reviewed floor.

So refresh `release-plan.json` (the follow-up docs change after a release) only for a new minor or major of a package or the gallery,
or when a published-graph bridge (`PUBLISHED_*_TOOLING`) needs a new reviewed source. A patch release no longer blocks in-flight pull requests.
The notice is the reminder that the plan lags; the next planned refresh moves it forward. The bridge for the published 0.24.2 core still pins that exact
core source, so a core patch needs a reviewed bridge update.

## Geometry-moving core releases: lockstep floors

Core composition changes that move geometry (for example opf#169 cover centering) make the preview and the PPTX export drift when `@openpresentation/opf-render` and `@openpresentation/opf-pptx` resolve different core versions (measured: 186-300 pt title offsets on covers).

Rule: when a core release contains composition or geometry changes, the same release train must raise BOTH the renderer's and PPTX's core floor (`dependencies` and, where present, `peerDependencies`) to that core version, publish them together, and raise the editor's floor too. Do not release core alone and leave a sibling on the older floor.

The parity harness must always run with `--import <opf>/scripts/register-local-opf.mjs` (as `run.ps1` does) so every engine shares one core.

## Renderer font-count gate (RR-90)

The installed-consumer check (`scripts/test-packed-ecosystem.mjs`) and `test:gallery-lazy-fonts` compare the number of vendored faces a renderer lists as lazy fonts with `scripts/lazy-font-counts.mjs`. A renderer release whose fonts did not change needs no new entry. The gate hashes the renderer package's font set, which is 143 files: `dist/font-manifest.js` and every file under `fonts/` (faces, licenses, `PROVENANCE.json`, `NOTICE.md`). An unlisted stable version passes when that hash is in `REVIEWED_FONT_SETS` and its measured count equals the count recorded there.

It fails closed, with a message that says what changed, when:

- the font files differ from every reviewed set (the message prints the new hashes): review what changed, then add the set to `REVIEWED_FONT_SETS` and the version's count to `LAZY_FONT_COUNTS`;
- the font files are a reviewed set but the count differs: find out why the count moved, then add an entry;
- the version is a prerelease: it always needs its own `LAZY_FONT_COUNTS` entry.

To review a set, pack the release (`npm pack @openpresentation/opf-render@<version>`), run `hashFontSet` from `scripts/lazy-font-counts.mjs` over the unpacked `package/` folder, and record the result with the versions you checked. Every existing `LAZY_FONT_COUNTS` entry stays and keeps its own rule.

## CI evidence and the merge-queue fast path (RR-100)

A release used to test the same commit three or four times: the release-prep PR's CI, the merge queue's run, the push
checks the `tag` step waited for, and the full `pnpm test` of the publish workflow. From RR-100 the publish workflow and
the `tag` step trust one piece of evidence, the green CI of the exact release commit, and the queue does not repeat a run
that proves nothing new.

**CI evidence.** `scripts/ci-evidence.json` lists, per repository, the workflow runs that must have succeeded on exactly
the tagged commit (`GITHUB_SHA`), each with the jobs that must have concluded `success`:

| Repository | Evidence |
|---|---|
| `opf` (core and CLI) | the merge-queue runs (`merge_group`, branch `gh-readonly-queue/main/...`) of `opf-ci.yml` (`Verify OPF packages`) and `ecosystem-ci.yml` (`packages`, `Installed candidates (windows-latest)`, `Installed candidates (macos-latest)`): the required checks of the `main` ruleset. The queue fast-forwards `main` to the commit it tested, so these runs sit on main's commit. |
| `opf-render`, `opf-pptx`, `opf-editor` | the push-to-`main` run of `ci.yml` (these repositories have no merge queue): its `package` job(s) and the `Node 22` and `Node 26` engines-range legs. |

`node scripts/ci-evidence.mjs --sha "$(git rev-parse HEAD)"` reads the runs and jobs with the workflow's `GITHUB_TOKEN`
(`actions: read`) and fails closed: exit 0 only when every requirement has a completed run of that workflow, event and
branch on this exact commit with conclusion `success` and every named job `success` (a skipped required job fails). A
missing, running, failed or cancelled run, an absent job, an unreadable configuration or an API error is exit 1, and the
workflow does not publish. It waits for nothing: a tag pushed while CI still runs fails there; re-run the failed job
(`gh run rerun <id> --failed`) once CI is green. Each publish workflow runs it right after `Verify merged release source`
and keeps every step that builds or verifies the artifact itself: install, build, the pack dry-run, the packed-install
smoke (the CLI: `test:cli:packed` and `test:cli:packed:peers`), the published-core gate, provenance and the release job.

`release-train.mjs tag`, `plan` and `run` read the same file at the release commit (through the contents API) and decide
the checks of that commit with the same code: with evidence present, a repository without a ruleset (the siblings) is
decided by the evidence alone, so a non-blocking measurement still running no longer holds the tag; a repository with a
ruleset (opf) needs its ruleset checks and the evidence. A commit without the file keeps the old rule. `--checks-wait-minutes`
still polls while the evidence is genuinely pending (CI still running on the push), and red evidence stops at once.
Change a job name in a CI workflow and the matching `scripts/ci-evidence.json` entry in the same PR; the next release
fails closed otherwise.

**Fast path for release-prep merge groups (opf only).** A release-prep PR changes only versions, the changelogs, the
`@openpresentation/*` dependency ranges and the lockfile, and its own CI ran in full on the pull request. Its merge_group
run re-tests a tree that differs from the last green `main` commit by a version number, so for such a run
`scripts/release-prep.mjs scope` (the `gallery` job of `opf-ci.yml` and `ecosystem-ci.yml`) turns the full run into a
minimal one that still reports every required check name: `Verify OPF packages` requires a `release-prep` job
(`pnpm install --frozen-lockfile`, `node scripts/release-prep.mjs check`: the manifest carries the version, the changelog
has its `## X.Y.Z` section, no fragment of the package is left; `pnpm check:changes`; `pnpm check:engines-range`), and
`packages` and both `Installed candidates` legs report as skipped lanes (the legs on an Ubuntu runner, the same policy
skip a plain pull request takes). The rule is strict and fails closed to the full run. All of these must hold:

- the event is `merge_group` and the checkout is the group's head commit;
- the diff from the group's base commit to that head is non-empty and touches only: `packages/javascript/package.json` and
  `packages/cli/package.json` (only `version`, existing `@openpresentation/*` dependency ranges and the deletion of
  `opf.requiresUnreleasedCore`; any other key, including scripts, files, engines or a third-party dependency, is not
  release-prep), `CHANGELOG.md` and `packages/cli/CHANGELOG.md` (added lines only), `pnpm-lock.yaml`, and
  `changes/<slug>.md` fragments that are deleted or rewritten exactly as the assembler does; no file is added, renamed or
  deleted otherwise;
- the queue entry's pull request is from a branch of this repository named `codex/release-<core|cli>-X-Y-Z` into `main`,
  its body carries the marker `<!-- release-train-prep: <core|cli> X.Y.Z -->` that `release-train.mjs prep` writes, its
  title announces `release <name> X.Y.Z`, and the diff sets that package's manifest to `X.Y.Z`.

The diff is the guard: a code change cannot satisfy it, whatever the pull request says (`scripts/release-prep.test.mjs`
runs real git diffs, including a release-prep PR that smuggles a code, script, workflow, manifest or lockfile-deletion
change). The one thing it does not inspect is what the lockfile resolves; the pull request's own CI ran in full on it.
A group that stacks a release-prep entry on a code change has a code diff and runs in full. Every other change, and every
case the script cannot classify, runs the full queue unchanged. Pull requests, the nightly run and manual runs are never
fast-pathed.

## Troubleshooting

If the tag/version check fails, the tag does not point at the release commit or
the tag name does not match `packages/javascript/package.json`. Stop and inspect
the exact tag and merged release source. Never move or re-push a release tag.
Fix a real source or version error on `main` through a new release-prep PR and
use a new version/tag after its gates pass. A transient workflow failure may be
retried on the same unchanged tag; it does not authorize replacing the tag.

If npm publish fails with `ENEEDAUTH`, confirm:

- npm has a trusted publisher for `OpenPresentation/opf`
- the trusted publisher uses workflow filename `npm-publish.yml`
- `.github/workflows/npm-publish.yml` has `id-token: write`
- the publish job is running on a modern Node/npm toolchain

If npm publish fails after the version is already present on npm, do not retry
the same publish. Verify the package and treat the failure as a duplicate
publish attempt.

### CLI peer contracts before a new minor train

A CLI release prep advances development pins, but does not define a new runtime peer contract.
Before a train crosses an incompatible peer minor (for example 0.18 to 0.19), the reviewed feature changes
must align the CLI's peer metadata with core's peer manifest and `packages/javascript/src/node/peers.ts`.
Release core's new contract first. Then CLI prep keeps those aligned ranges and advances its core dependency
and development pins. If CLI metadata still names the old incompatible line, prep stops before cloning;
make the contract change in its own reviewed PR, rather than editing core runtime files in release prep.


### Scheduled Editor measurement policy (RR-68)

The Editor's `.github/workflows/flake-repeat.yml` declares that its scheduled repeat measures rather than gates.
The fallback-all mode in `pr-gate.mjs` and `release-train.mjs` therefore treats that measurement as advisory only
when authenticated workflow-run metadata verifies `OpenPresentation/opf-editor`, GitHub Actions app 15368,
workflow 373564717, that exact path, event `schedule`, branch `main`, the observed commit SHA and check-suite
association. Both the check runs and the running suite follow this policy; advisory activity and failures remain
visible. Explicitly required contexts always gate, including the same job name. Commit statuses, other workflows,
events, repositories or apps, and missing or inaccessible identity metadata continue to gate.

Identity lookups are cached per candidate run and commit for each observer's lifetime, including failed lookups;
they do not poll workflow state. The policy changes no checks, thresholds, retries or workflow executions, and does
not authorize using an unmerged tooling change for a release.
