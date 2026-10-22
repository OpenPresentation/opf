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

## Release: one click

> Status: the workflows and `scripts/release.mjs` are in place and rehearsed with dry runs. The first real release through them
> is the canary `0.26.0-rc.0` (MR-41), then 0.26.0 (MR-44). Releases up to 0.25.x were made from the four old repositories with
> a per-package train; that process is retired and not described here.

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
   and the version rules below, refreshes the lockfile, and uploads the result as a patch. A **prerelease** (`X.Y.Z-rc.N`) only sets the versions: it leaves every changelog and `changes/` alone, and its GitHub release notes are assembled from the fragments (`release.mjs notes`), so the stable release that follows carries every note. A refused version fails here, in two
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
| `verify <version> [--tag t] [--commit sha] [--wait minutes]` | the registry and provenance check (a prerelease has no changelog section to check) |
| `notes <version> [--out file]` | the GitHub release body |
| `order` | the publish order |

### After a release: the sites

After a **stable** release, `release.yml` calls `.github/workflows/bump-sites.yml` (a prerelease never does). For each of the
three sites (`Data-Advantage/openpresentation-site` and `Data-Advantage/pptx-gallery` on `main`, `Data-Advantage/pptx-dev` on
`master`) it opens one pull request, "bump to vX.Y.Z", from the branch `bot/opf-vX.Y.Z`, that sets every `@openpresentation/*`
pin the site declares to the released version and refreshes the site's lockfile (`scripts/bump-site.mjs`). A patch bump is labeled
`auto-merge`; a minor or major bump (a breaking change in 0.x) is labeled `needs-review` and stays open. The workflow only opens
and labels the pull request and never merges it: the site's own CI merges an `auto-merge` pull request after its
`build-and-smoke` job passes, using the GitHub App's token so that the merge starts the site's deploy workflows (D19; the sites
are private repositories in a Free-plan organization and have no rulesets or required checks). A bump that cannot be made opens
an issue in this repository (`bump-sites-failed`) and never fails the release. To run it again, or for a release made by the pull-request
fallback or from a tag, use Actions, **Bump sites**, **Run workflow** with the version. The App, its secrets and the site-side
workflows are owner steps O4 and O8 (`docs/programs/monorepo/owner-steps.md`); the workflow files for the sites are in
`docs/programs/monorepo/site-workflows/`.

### Who may release

The owner authorized agents to prepare and publish npm releases on 2026-09-29 (`AGENTS.md`). A release is made only through
`release.yml` (or the pull-request fallback) and `npm-publish.yml`, only when one is required and only with every gate green;
agents never publish from a laptop, never skip the gate and never pass a different `--tag` to make a check pass. Dry runs are
free at any time.

## Geometry-moving core releases

Core composition changes that move geometry make the preview and the PPTX export drift when the renderer and the exporter resolve
different core versions. This cannot happen between the packages of this repository: all six are released at one version, and
their runtime dependencies and peers on each other are `workspace:^`, published as `^X.Y.Z`, so the floor of every sibling is the
release itself. Do not hand-edit those ranges, and do not release one package alone.

## Renderer font-count gate (RR-90)

The installed-consumer check (`scripts/test-packed-ecosystem.mjs`) and `test:gallery-lazy-fonts` compare the number of vendored faces a renderer lists as lazy fonts with `scripts/lazy-font-counts.mjs`. A renderer release whose fonts did not change needs no new entry. The gate hashes the renderer package's font set, which is 143 files: `dist/font-manifest.js` and every file under `fonts/` (faces, licenses, `PROVENANCE.json`, `NOTICE.md`). An unlisted stable version passes when that hash is in `REVIEWED_FONT_SETS` and its measured count equals the count recorded there.

It fails closed, with a message that says what changed, when:

- the font files differ from every reviewed set (the message prints the new hashes): review what changed, then add the set to `REVIEWED_FONT_SETS` and the version's count to `LAZY_FONT_COUNTS`;
- the font files are a reviewed set but the count differs: find out why the count moved, then add an entry;
- the version is a prerelease: it always needs its own `LAZY_FONT_COUNTS` entry.

To review a set, pack the release (`npm pack @openpresentation/opf-render@<version>`), run `hashFontSet` from `scripts/lazy-font-counts.mjs` over the unpacked `package/` folder, and record the result with the versions you checked. Every existing `LAZY_FONT_COUNTS` entry stays and keeps its own rule.

## Troubleshooting

- **The tag or version check fails** (`npm-publish.yml`, job `plan`): the tag does not point at a commit of `main`, or the version
  is not well formed. Inspect the exact tag. Never move or re-push a release tag; fix a real error on `main` and release the
  next version. A transient failure is retried on the same unchanged tag.
- **`E404`, `E403` or `ENEEDAUTH` from `npm publish`**: the trusted publisher of that package is missing or wrong. It must be
  organization `OpenPresentation`, repository `opf`, workflow filename `npm-publish.yml`, no environment, and the `publish` job
  needs `id-token: write`. Fix the entry in npm (owner step O1) and re-run the workflow on the tag.
- **A version is already on npm**: `publish` skips it; do not try to publish it again. Verify the package and continue.
- **The gate is red**: the failing leg of `nightly.yml` is in the Release run. Fix it on `main` and release again; nothing was
  committed. A flaky leg is quarantined (`pnpm check:quarantine`), never skipped for a release.
- **`release.yml` stopped with "main moved"**: a commit landed on `main` after the run started, and the gate had tested the
  earlier one. Run the release again.
- **A nightly failure**: the `nightly-red` issue lists the failing legs and the run; it never blocks a pull request, and the
  release gate refuses to publish on the same failure.
