# gallery

The default catalog for Open Presentation: layouts, themes, colour schemes and font schemes for OPF decks, published as
[`@openpresentation/gallery`](https://www.npmjs.com/package/@openpresentation/gallery) and previewed at
[pptx.gallery](https://www.pptx.gallery).

It holds every layout, theme, colour scheme, font scheme, narrative, audience, purpose and tone that
[OPF](https://openpresentation.org) decks name by id (`layout: "two-column"`, `design: { theme: "minimal" }`). Engines
never fetch records: a host registers the catalogs it trusts, and this package is the catalog every OPF host registers by
default.

## Use

```sh
npm install @openpresentation/gallery
```

```js
import { validate } from "@openpresentation/opf";
import { gallery } from "@openpresentation/gallery";

validate(deck, { catalogs: [gallery] });
```

Pass `catalogs: [gallery]` to every entry point that resolves references: core's `validate`, `paginate`, `embed` and
`resolveSlideContext`, and opf-render, opf-pptx and opf-editor, which pass the option through to core. The first
registered catalog is the default for bare ids. From OPF 0.19, `@openpresentation/opf` depends on this package and its
Node functions (and the `opf` command) register `gallery` when a call names no catalogs; a browser host registers it
itself. Save decks with their records embedded (`embed`), so they draw the same whichever gallery version a host
registers later.

| Export | What it is |
| --- | --- |
| `gallery` | The content records by kind and then by id, without `$schema`, `id` or `x-*` members, with `source: "https://www.pptx.gallery"` |
| `GALLERY_SOURCE` | `https://www.pptx.gallery`, the `source` of a document's `catalogs.default` |
| `CATALOG_SCHEMA` | The version of core's catalog record schemas these records target (also `opf.catalogSchema` in `package.json`) |
| `catalogDisplay` | Display metadata for pickers: `chartTypes`, `languages` and `socialPlatforms` by id |
| `catalogIndexes` | Each kind's `index.json`: the record summaries and their content hash |
| `catalogManifest` | The pptx.gallery commit the records were taken from, and a content hash per kind |

`@openpresentation/gallery/previews` exports static HTML layout previews (`layoutPreviews`, `layoutPreviewIndex`,
`layoutPreviewSlugs`, `getLayoutPreview`, `hasLayoutPreview`). The package has no dependency, not even for its types:
`GalleryCatalog` has the shape of core's `Catalog`, so `gallery` is assignable to it.

## Versions

The gallery has its own version line, independent of the OPF engine packages. Releases are tagged `vX.Y.Z`.

- **Minor:** new records. Every existing record draws exactly as in the previous release.
- **Major:** an id removed or renamed, a change to how an existing record draws, or a change that needs a newer record
  schema (`CATALOG_SCHEMA`).
- **Patch:** fixes that change no record's drawing (text a drawing never shows, such as a name or a summary; the package
  code; the declarations).

The pixel-stability check enforces the rule (`npm run check:stability`, `scripts/stability.mjs`). It runs on every pull
request and before every publish. It takes the highest published version at or below the candidate's, and for every
layout, theme, colour scheme and font scheme both releases have, it draws a fixture deck with the pinned published
`@openpresentation/opf` and `@openpresentation/opf-render`, once per release: a slide with sample content in every
region of a layout, a six-slide sample deck for a design record. SVG bytes are compared first; a mismatch is rasterized
to count the pixels that differ. A changed drawing or a removed id fails unless the major version goes up. New ids pass.

## Where the records come from

The records are currently a pinned snapshot of the catalog pptx.gallery publishes at
`https://www.pptx.gallery/<kind>/index.json`; `catalog/manifest.json` names the pptx.gallery commit. **The authoring flow
(where records are written and how they reach this repository) is being redesigned.** Until then:

- records change in [Data-Advantage/pptx-gallery](https://github.com/Data-Advantage/pptx-gallery): its `data/`, then
  `pnpm build:opf-catalog`, which publishes `public/<kind>/`;
- this repository takes them with `node scripts/sync-gallery-catalog.mjs --gallery <pptx-gallery checkout>` (`npm run
  sync` with the checkout at `../pptx-gallery`). The sync validates every published index and record against the
  published `@openpresentation/opf`, checks the published content hashes, drops `x-*` members, refuses a publisher that
  stopped serving an id the snapshot holds (unless `--allow-removed <kind>:<id>` names it), and pins the gallery commit.

## Contributing a layout

1. Add the layout on pptx.gallery: its page data in `data/layouts.json` (placeholders, composition, design and display
   fields) and its preview, then `pnpm build:opf-catalog` there. pptx.gallery's CI validates the record against OPF's
   companion schema. A new layout gets a new id; an existing id never changes meaning.
2. Sync it here (`npm run sync`), then run `npm test` and `npm run check:stability`. A new layout is a minor release;
   if the check reports a changed record, restore it or make the release a major one.
3. Open a pull request here with the synced files and a `CHANGELOG.md` entry under `## Unreleased`.

See [CONTRIBUTING.md](CONTRIBUTING.md) for the checks, releases and the license.

## License

[MIT](LICENSE). The records, the previews and the code are all under it; `npm run check:license` checks it.
