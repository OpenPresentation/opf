# Contributing to the gallery package

`@openpresentation/gallery` is developed in `packages/gallery` of [OpenPresentation/opf](https://github.com/OpenPresentation/opf),
beside core, the CLI and the engines. The repository's [CONTRIBUTING.md](../../CONTRIBUTING.md) and [AGENTS.md](../../AGENTS.md)
describe the workflow (branches, `changes/` fragments, `pnpm check:changed`); this file covers what is specific to the records.
The package version is the repository's one shared version (from 0.26.0).

## Layout of the package

| Path | What it is |
| --- | --- |
| `catalog/<kind>/` | The records: `index.json` and one `<id>.json` per record, with `$schema` and `id`, no `x-*` members |
| `catalog/manifest.json` | A record count and content hash per kind, and the pptx.gallery commit the 1.x records came from |
| `previews/layouts/` | One SVG preview per layout (`@openpresentation/gallery/previews`), written by `scripts/render-previews.mjs` |
| `src/*.d.ts` | The declarations |
| `scripts/build.mjs` | Builds `dist/` from `catalog/` and `previews/` |
| `scripts/sync-gallery-catalog.mjs` | `--verify` and `--rehash` check and rewrite the hashes (the 1.x sync from pptx.gallery is gone) |
| `scripts/render-previews.mjs` | Draws the layout previews with the workspace renderer |
| `scripts/check-license.mjs` | The license check |

The fixture decks of the stability check and the previews (`scripts/gallery-stability-fixtures.mjs`) and the stability check itself
(`scripts/gallery-stability.mjs`) live at the repository root, with the other release scripts.

The package has no workspace dependency. The checks that need the engines (the record validation, `check:previews`,
`check:stability`, `typecheck`) build core first (`pnpm --filter @openpresentation/opf build`, which the package scripts do) and
resolve `@openpresentation/opf` and `@openpresentation/opf-render` from the repository root's devDependencies, so records are
always checked against, and previews drawn by, the engines in the same checkout.

Records are written here by pull request: edit a record and its index entry, then `pnpm rehash` (the index and manifest
hashes) and `pnpm previews` (the SVG previews). See the README, "Contributing a layout". The kinds that were the pptx.gallery 1.x
snapshot are edited the same way now; the manifest keeps the old commit as history.

## Checks

From `packages/gallery` (or `pnpm --filter @openpresentation/gallery <script>` from the root):

```sh
pnpm check:license     # MIT: LICENSE, package.json, published files
pnpm verify            # every kind hashes to its index and the manifest
pnpm test              # build; every record valid against core's schemas; package shape; previews
pnpm typecheck         # the declarations against core's Catalog
pnpm check:previews    # the layout previews are what opf-render draws (pnpm previews rewrites them)
pnpm check:stability   # a drawing change or a removed id is declared (see Versions)
pnpm pack:dry-run      # the package contents
```

Pull requests run the same checks through `pnpm check:changed`; the repository's `verify` job runs them for any change in
core, the renderer or the gallery.

## Versions

All six packages share one version and are released together (`npm-publish.yml`); there is no per-package release. Record each
change in a fragment `changes/<slug>.md` with `packages: [gallery]` (see `changes/README.md`).

New records are always allowed. A change to how an existing record draws, a removed id or a new `CATALOG_SCHEMA` must be
declared in the fragment (`drawing: ["layouts:hero", "themes:minimal"]`) and makes the release a minor version, never a
patch; `pnpm check:stability` fails an undeclared change. Text a drawing never shows (names, summaries, tags), the code and
the declarations change no drawing.

## License

By contributing you agree that your contribution is licensed under the [MIT License](LICENSE) of this package.
