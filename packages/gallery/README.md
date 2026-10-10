# @openpresentation/gallery

The [pptx.gallery](https://www.pptx.gallery) catalog for the [Open Presentation Format](https://openpresentation.org):
every layout, theme, colour scheme, font scheme, narrative, audience, purpose and tone the gallery publishes, shaped
for an OPF host to register.

```sh
npm install @openpresentation/gallery
```

```js
import { validate } from "@openpresentation/opf";
import { gallery } from "@openpresentation/gallery";

validate(deck, { catalogs: [gallery] });
```

Pass `catalogs: [gallery]` to every entry point that resolves references (core's `validate`, `paginate`, `embed`,
`resolveSlideContext`, and opf-render, opf-pptx and opf-editor, which pass the option through to core). The first
registered catalog is the default for bare ids such as `layout: "two-column"`. Documents embed the records they use
(`embed`), so a saved deck draws the same whichever gallery version a host registers later.

## Exports

| Export | What it is |
| --- | --- |
| `gallery` | The content records by kind and then by id, without `$schema`, `id` or `x-*` members, with `source: "https://www.pptx.gallery"` |
| `GALLERY_SOURCE` | `https://www.pptx.gallery`, the `source` of a document's `catalogs.default` |
| `CATALOG_SCHEMA` | The version of core's catalog record schemas these records target (also `opf.catalogSchema` in `package.json`) |
| `catalogDisplay` | Display metadata for pickers: `chartTypes`, `languages` and `socialPlatforms` by id |
| `catalogIndexes` | Each kind's `index.json`: the record summaries and their content hash |
| `catalogManifest` | The pptx.gallery commit the records were synced from, and a content hash per kind |

`@openpresentation/gallery/previews` exports the static HTML layout previews: `layoutPreviews`, `layoutPreviewIndex`,
`layoutPreviewSlugs`, `getLayoutPreview` and `hasLayoutPreview`.

The package has no dependency, not even for its types: its `GalleryCatalog` type has the shape of core's `Catalog`, so `gallery` is assignable to it.

## Versions

The gallery is released on its own version line, independently of the OPF engine packages:

- **minor**: new records. Every existing record draws exactly as before; CI renders each one against the previous
  release with the same core and renderer and fails on any difference.
- **major**: an id removed or renamed, a change to how an existing record draws, or a change that needs a newer record
  schema (`CATALOG_SCHEMA`).

Records are written and previewed on pptx.gallery and reach this package through the OPF repository's
`scripts/sync-gallery-catalog.mjs`. See
[docs/default-catalog.md](https://github.com/OpenPresentation/opf/blob/main/docs/default-catalog.md).

## License

MIT, as the records were when `@openpresentation/opf` shipped them.
