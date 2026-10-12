# gallery

The default catalog for Open Presentation: layouts, themes, colour schemes and font schemes for OPF decks, published as
[`@openpresentation/gallery`](https://www.npmjs.com/package/@openpresentation/gallery) and previewed at
[pptx.gallery](https://www.pptx.gallery).

It holds every layout, theme, colour scheme, font scheme, narrative, audience, purpose and tone that
[OPF](https://openpresentation.org) decks name by id (`layout: "pillars"`, `design: { theme: "minimal" }`). Engines
never fetch records: a host registers the catalogs it trusts, and this package is the catalog every OPF host registers by
default.

**2.x is the catalog of OPF 0.19 and later.** Its layouts are the 28 OPF 0.19 layouts named by intent, written as grid
templates (`opf-layout/v2`); they need `@openpresentation/opf` 0.19 or later. 1.x holds the 278 OPF 0.18 layouts. 2.0.0
changed the layouts with no migration path: see [Layouts](#layouts) and the [changelog](CHANGELOG.md).

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
| `CATALOG_SCHEMA` | The version of core's catalog record schemas these records target (also `opf.catalogSchema` in `package.json`): `2`, the layouts are `opf-layout/v2` grid templates |
| `catalogDisplay` | Display metadata for pickers: `chartTypes`, `languages` and `socialPlatforms` by id |
| `catalogIndexes` | Each kind's `index.json`: the record summaries and their content hash (a layout's entry also has its `summary` and `group`) |
| `catalogManifest` | The pptx.gallery commit the 1.x records were taken from, and a content hash per kind |

`@openpresentation/gallery/previews` exports one SVG preview per layout, keyed by the layout id (`layoutPreviews`,
`layoutPreviewIndex`, `layoutPreviewSlugs`, `getLayoutPreview`, `hasLayoutPreview`): the layout drawn with sample
content in every region by the pinned `@openpresentation/opf-render`, a self-contained `<svg>` with a 16:9 viewBox. The
package has no dependency, not even for its types: `GalleryCatalog` has the shape of core's `Catalog`, so `gallery` is
assignable to it.

## Layouts

A slide names a layout by intent; its content flows into the layout's regions, so no layout fixes a block count.
Variants are design settings on the slide or the deck, not layout ids: cards (`design.contentBox`), one row or one
column (`contentDirection`), title and content alignment (`titleAlignment`, `contentAlignment`), picture fit
(`imageFit`) and image bullets (`listBullet`), which a theme can also set, and a mirrored side (`mirror`). A slide with no layout composes
automatically. A deck's own layouts are records of the same schema under `catalogs.custom.layouts`.

| Layout | When to use it |
| --- | --- |
| **Openers and closers** | |
| `cover` | The opening slide: title, subtitle and an optional picture. |
| `section` | A divider between parts: the section title and an optional subtitle. |
| `agenda` | What the talk covers: the parts, as one list that flows into columns when long. |
| `statement` | One message, large and alone. |
| `closing` | The last slide: thanks, the call to action and contact details. |
| **Text** | |
| `text` | Prose. Several blocks sit side by side when short and stack when long. |
| `list` | Bulleted or numbered points; one long list flows into columns. |
| `quote` | One or more quotations with attribution and photo. |
| `two-column` | Two independent columns of any content. |
| **Groups of items** | |
| `pillars` | Two to six ideas of equal weight, as cards. |
| `comparison` | Two options side by side (before and after, pros and cons, us and them), with an optional verdict. |
| `process` | Steps in order, in one row. |
| `timeline` | Dated events or a roadmap along one axis, with optional notes. |
| `faq` | Questions with their answers. |
| **Numbers** | |
| `metrics` | One to six headline numbers, with an optional note. |
| `scorecard` | Metrics with commentary or status, as cards. |
| **Visuals** | |
| `image` | One picture edge to edge under an optional title. |
| `image-beside` | A picture or video beside text. |
| `gallery` | One to six framed pictures: a screenshot, a diagram, a photo set. |
| `chart` | One to six charts, with an optional note. |
| `chart-beside` | A chart with the takeaway beside it. |
| `table` | A table across the slide, with an optional note. |
| `table-beside` | A table with commentary beside it. |
| `code` | Source code with the explanation beside it. |
| **Mixed** | |
| `hero` | A lead message with a picture and supporting points. |
| `dashboard` | Headline numbers over charts. |
| `team` | People: photo, name and role cards. |
| `logos` | Customer, partner or sponsor logos in a grid of up to 12. |

The 1.x ids `agenda`, `comparison`, `dashboard`, `faq`, `timeline` and `two-column` are 2.x layouts of the same id. Every
other 1.x layout id is gone, with no alias: a deck that names one finds no layout (`opf/unresolved-reference`) and its
slides compose automatically, unless the deck embeds the old record.

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
`@openpresentation/opf` and `@openpresentation/opf-render`, once per release: for a layout, a slide with sample content
in every region (three blocks in a flowing region, one in a `none` region) and a slide with every region empty, which
exercises collapse; for a design record, a six-slide sample deck. SVG bytes are compared first; a mismatch is rasterized
to count the pixels that differ. A changed drawing, a removed id or a new `CATALOG_SCHEMA` fails unless the major version
goes up. New ids pass. 2.0.0 is a new baseline: it is compared with 1.x for the record only, and every 2.x minor and
patch is held to the 2.x release below it.

## Where the records come from

- **Layouts** are written here, in `catalog/layouts/`: one short `opf-layout/v2` record per layout, reviewed as code.
- **The other kinds** (themes, colour and font schemes, narratives, audiences, purposes, tones and the display kinds) are
  unchanged from 1.x: the pinned snapshot of the catalog pptx.gallery published at
  `https://www.pptx.gallery/<kind>/index.json`, with the pptx.gallery commit in `catalog/manifest.json`.
- `scripts/sync-gallery-catalog.mjs` took the 1.x records from a pptx.gallery checkout (`npm run sync`). pptx.gallery
  publishes the 1.x layouts, so a sync now refuses to run: it would remove the 28 layouts. pptx.gallery reads its records
  from this package from 2.0.0, and the sync is retired with that change.

## Contributing a layout

1. Write the record in `catalog/layouts/<id>.json` (`$schema` `https://openpresentation.org/schema/opf-layout/v2`,
   `id`, `name`, `summary`, `tags` with its group, `areas`, `columns`, `rows`, `regions` and any `design`) and add its
   entry (`id`, `name`, `summary`, `group`, `file`) to `catalog/layouts/index.json` in picker order. A new layout gets a
   new id; an existing id never changes meaning.
2. `npm run rehash` (the index and manifest hashes), then `npm run previews` (its SVG preview).
3. Run `npm test` and `npm run check:stability`. A new layout is a minor release; if the check reports a changed record,
   restore it or make the release a major one.
4. Open a pull request here with a `CHANGELOG.md` entry under `## Unreleased`.

See [CONTRIBUTING.md](CONTRIBUTING.md) for the checks, releases and the license.

## License

[MIT](LICENSE). The records, the previews and the code are all under it; `npm run check:license` checks it.
