# Contributing

Thank you for helping with the OPF default catalog. This repository publishes one npm package,
`@openpresentation/gallery`.

## Layout of the repository

| Path | What it is |
| --- | --- |
| `catalog/<kind>/` | The records: `index.json` and one `<id>.json` per record, with `$schema` and `id`, no `x-*` members |
| `catalog/manifest.json` | The pptx.gallery commit the records come from, and a record count and content hash per kind |
| `previews/layouts/` | Static HTML layout previews (`@openpresentation/gallery/previews`) |
| `src/*.d.ts` | The declarations |
| `scripts/build.mjs` | Builds `dist/` from `catalog/` and `previews/` |
| `scripts/sync-gallery-catalog.mjs` | Takes the records from a pptx.gallery checkout |
| `scripts/stability.mjs` | The pixel-stability check |
| `scripts/check-license.mjs` | The license check |

Never edit `catalog/` by hand: in 1.x the records come from pptx.gallery (below, and the README, "Where the records come
from").

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

**2.0.0 (planned).** With the OPF 0.19 layout redesign, this repository becomes the place records are written:
`catalog/` is edited here by pull request, and pptx.gallery builds its pages from the published package. The sync
above is then retired.

## Checks

Use Node 24 (`engines.node` is `>=22`) and npm.

```sh
npm ci
npm run check:license     # MIT: LICENSE, package.json, published files
npm run verify            # every kind hashes to its index and the manifest
npm test                  # build; every record valid against the published @openpresentation/opf; package shape; previews
npm run typecheck         # the declarations against the published core's Catalog
npm run check:stability   # the version rule against the previous published release
npm run pack:dry-run      # the package contents
```

CI (`.github/workflows/ci.yml`) runs all of them on every pull request and on main. The records are validated against
the published `@openpresentation/opf` and drawn by the published `@openpresentation/opf-render` that `package.json`
pins exactly: raise those pins in their own pull request, after the OPF release is on npm.

## Versions

New records are a minor release. An id removed or renamed, a change to how an existing record draws, or a change that
needs a newer record schema is a major release. Text a drawing never shows (names, summaries, tags), the code and the
declarations are patch changes. `npm run check:stability` decides from the drawings: it fails a minor or patch release
that changes an existing record's drawing or removes an id.

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
