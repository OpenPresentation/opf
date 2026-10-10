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

Never edit `catalog/` by hand: records currently come from pptx.gallery's catalog snapshot (see the README, "Where the
records come from"; the authoring flow is being redesigned).

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
   `CHANGELOG.md`. Merge it with green CI.
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
