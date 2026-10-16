# Contributing

Thank you for helping with the OPF default catalog. This repository publishes one npm package,
`@openpresentation/gallery`.

## Layout of the repository

| Path | What it is |
| --- | --- |
| `catalog/<kind>/` | The records: `index.json` and one `<id>.json` per record, with `$schema` and `id`, no `x-*` members |
| `catalog/manifest.json` | The pptx.gallery commit the 1.x records come from, and a record count and content hash per kind |
| `previews/layouts/` | One SVG preview per layout (`@openpresentation/gallery/previews`), written by `scripts/render-previews.mjs` |
| `src/*.d.ts` | The declarations |
| `scripts/build.mjs` | Builds `dist/` from `catalog/` and `previews/` |
| `scripts/sync-gallery-catalog.mjs` | Took the 1.x records from a pptx.gallery checkout; `--verify` and `--rehash` check and rewrite the hashes |
| `scripts/fixtures.mjs` | The fixture decks of the stability check and the previews |
| `scripts/render-previews.mjs` | Draws the layout previews with the pinned renderer |
| `scripts/stability.mjs` | The pixel-stability check |
| `scripts/check-license.mjs` | The license check |

From 2.0.0 the layouts (`catalog/layouts/`) are written here by pull request: edit a record and its index entry, then
`npm run rehash` (the index and manifest hashes) and `npm run previews` (the SVG previews). See the README, "Contributing
a layout". The other kinds are the 1.x records pptx.gallery published; do not edit them by hand.

## Records from pptx.gallery (1.x)

Records are written in [Data-Advantage/pptx-gallery](https://github.com/Data-Advantage/pptx-gallery) and reach this
repository through one pull request that automation keeps current:

1. A push to pptx.gallery's main that changes a published record (`data/`, `public/<kind>/` or the code that builds
   them) runs its `.github/workflows/sync-gallery-package.yml`. It can also be started by hand there.
2. The workflow checks out this repository's main and runs pptx.gallery's `scripts/sync-gallery-package.mjs`, which:
   - runs this repository's `scripts/sync-gallery-catalog.mjs` against the pptx.gallery commit (validation, hashes, the
     manifest pin), naming every id pptx.gallery stopped publishing with `--allow-removed`;
   - stops when nothing but the manifest's commit pin changed: no pull request;
   - otherwise builds and runs `scripts/stability.mjs` against the previous published release to choose the bump: only
     new ids is a minor release; a removed id or a record that draws differently is a **major** release; text a drawing
     never shows is a patch;
   - sets `version` in `package.json` and `package-lock.json` (from the last published version, never lower than the
     version already on main) and adds a `CHANGELOG.md` entry under `## Unreleased`.
3. It commits the result to the branch `sync/pptx-gallery` (recreated from main on every run) and opens or updates the
   pull request into main. The title names the bump and the version; a major release is flagged at the top of the
   body.

Review the pull request like any other: CI runs every check, and `check:stability` fails it when the version and the
drawings disagree. A major release breaks documents and hosts that rely on the old record, so read every listed id.
Merging publishes nothing: release it as below. The automation never merges, tags or publishes. It authenticates as a
GitHub App (Contents and Pull requests read and write on this repository) set up by the owner in pptx.gallery.

To preview a sync locally, with this repository at `../gallery` next to a pptx.gallery checkout:

```sh
node scripts/sync-gallery-package.mjs --gallery-dir ../gallery --dry-run   # in pptx.gallery
```

It writes into the checkout and prints the would-be pull request; `git checkout -- . && git clean -fd catalog` here
undoes it.

**2.0.0.** With the OPF 0.19 layout redesign the layouts are written here, and pptx.gallery builds its pages from the
published package. The sync above stops working on main at 2.0.0 (pptx.gallery publishes the 1.x layouts, so the sync
refuses to remove the 28 templates) and is retired when pptx.gallery moves to the package.

## Checks

Use Node 24 (`engines.node` is `>=22`) and npm.

```sh
npm ci
node scripts/bootstrap-engines.mjs  # Gallery 3.0.0: merged immutable engine sources; see below
npm run check:license     # MIT: LICENSE, package.json, published files
npm run verify            # every kind hashes to its index and the manifest
npm test                  # build; every record valid against the selected core; package shape; previews
npm run typecheck         # the declarations against the selected core's Catalog
npm run check:previews    # the layout previews are what the pinned opf-render draws (npm run previews rewrites them)
npm run check:stability   # the version rule against the previous published release
npm run pack:dry-run      # the package contents
node scripts/bootstrap-engines.mjs --verify  # unchanged manifests and exact selected engine graph
```

CI (`.github/workflows/ci.yml`) runs this sequence on every pull request and on main. Gallery 3.0.0 uses the
[merged-source bootstrap](#gallery-300-bootstrap); its ordinary development pins remain unchanged. Other versions
use the published `@openpresentation/opf` and `@openpresentation/opf-render` pins in `package.json`. Raise those pins
in their own pull request after the engine releases are on npm, and regenerate the previews (`npm run previews`)
there. 2.x needs `@openpresentation/opf` 0.19 or later, the first core that reads `opf-layout/v2`.

## Versions

New records are a minor release. An id removed or renamed, a change to how an existing record draws, or a change that
needs a newer record schema is a major release. Text a drawing never shows (names, summaries, tags), the code and the
declarations are patch changes. `npm run check:stability` decides from the drawings: it fails a minor or patch release
that changes an existing record's drawing, removes an id or raises `CATALOG_SCHEMA`. A pull request that needs a major
release sets the major version in `package.json` and `package-lock.json` itself, as the sync pull request does; the
release pull request then only moves the changelog section. A major release that raises `CATALOG_SCHEMA` is a new
baseline (2.0.0 over 1.x): the 2.x minor and patch releases are held to it.

Record each change under `## Unreleased` in `CHANGELOG.md`.

## Releasing

Releases use tags of the form **`vX.Y.Z`** (the only package in the repository).

1. A pull request that sets `version` in `package.json` and moves `## Unreleased` under `## X.Y.Z (date)` in
   `CHANGELOG.md`. Merge it with green CI. A merged sync pull request has already set the version: the release pull
   request then only moves the changelog section.
2. Tag the merge commit on main: `git tag vX.Y.Z && git push origin vX.Y.Z`.
3. `.github/workflows/gallery-publish.yml` refuses a tag that is not `v` plus the version in `package.json`, a tag not on
   main, and a `package.json` whose `repository` is not OpenPresentation/gallery. It runs every check above and
   publishes with `npm publish --access public --provenance` through npm trusted publishing (GitHub Actions,
   OpenPresentation / gallery / `gallery-publish.yml`, no environment; no npm token). A manual run of the workflow runs
   the checks and publishes nothing.
4. Check the release: `npm view @openpresentation/gallery@X.Y.Z` and its provenance, or `node scripts/release-train.mjs
   verify gallery@X.Y.Z` in OpenPresentation/opf.

Never move or re-push a published tag; fix a problem with a new version.

## License

By contributing you agree that your contribution is licensed under the [MIT License](LICENSE) of this repository.

## Gallery 3.0.0 bootstrap

Gallery 3.0.0 publishes catalog schema 3 before the next engine release. Its build and
validation need the merged schema-3 engines before those engines are on npm. For this release
only, `scripts/bootstrap-engines.mjs` reads `.github/bootstrap-engines.json`,
fetches each engine repository's actual default branch, and refuses pins that
are not full commit hashes reachable from that branch. Merge the candidate engine
PRs before running these gates; never weaken the ancestry check. The configured
core source retains its genuine registry dependency metadata until gallery 3 is
published; bootstrap staging does not make that metadata registry-installable.
The current configuration pins the actual merged core and renderer commits. Any
replacement pins must also be actual merged engine commits before merging or
publishing Gallery. A PR head alone cannot satisfy the default-branch ancestry gate.

After `npm ci`, the script builds this gallery's static records, then builds the
immutable core and renderer sources with frozen source lockfiles. It stages three
development tarballs—gallery, core and renderer—preserving their own versions and
runtime bytes while recording original and staged manifests and integrity. Core
builds against the exact local gallery. The pinned renderer build only copies
its source files to dist; it does not load Core. After all three tarballs exist,
they install together as one selected graph, so no partial engine install can
resolve unrelated optional peers. The drawing and validation gates use that
exact installed core and renderer. The tarballs install without changing the gallery's manifest,
lockfile or emitted catalog bytes. Every existing gallery gate still runs,
including preview equality and pixel stability. `--verify` binds the engine pins
and current gallery HEAD, checks exact installed manifests and file inventories,
and requires the engines and gallery to share one core and one gallery. Identity
evidence is retained under `node_modules/.gallery-bootstrap-evidence/` and uploaded
by the workflows. The published gallery remains dependency-free; staged local
dependency ranges never enter its published manifest. Trusted publishing and the
merged-ancestor, tag and release gates remain unchanged.

After the next engine releases, raise the ordinary registry development pins and
remove this configuration/script and workflow steps. Other gallery versions use
the normal npm-ci registry path automatically; candidate sources do not become
a dependency of later releases.
