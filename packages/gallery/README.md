# gallery

The default catalog for Open Presentation: layouts, themes, colour schemes and font schemes for OPF decks, published as
[`@openpresentation/gallery`](https://www.npmjs.com/package/@openpresentation/gallery) and previewed at
[pptx.gallery](https://www.pptx.gallery).

It holds every layout, theme, colour scheme, font scheme, narrative, audience, purpose and tone that
[OPF](https://openpresentation.org) decks name by id (`layout: "pillars"`, `design: { theme: "minimal" }`). Engines
never fetch records: a host registers the catalogs it trusts, and this package is the catalog every OPF host registers by
default.

**2.x is the catalog of OPF 0.19.** Its layouts are the 29 OPF 0.19 layouts named by intent, written as templates
(`opf-layout/v2`). 1.x holds the 278 OPF 0.18 layouts. 2.0.0 changed the layouts with no migration path: see
[Layouts](#layouts) and the [changelog](CHANGELOG.md).

Gallery 5.x advances the overall catalog compatibility contract to `4`: a layout record is `direction` and one ordered
list of `regions`, nested for two dimensions, and `areas`, `columns`, `rows` and the `regions` map are gone (FA-33, no
migration path). The engine packages follow their separate release process. The per-kind layout schema version remains
`2` and its URI remains `opf-layout/v2`; those identifiers are distinct from the overall catalog contract.

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
| `CATALOG_SCHEMA` | The overall catalog compatibility contract (also `opf.catalogSchema` in `package.json`): `4` requires layouts written as `direction` and an ordered `regions` list; layouts retain per-kind schema version `2` and `opf-layout/v2` |
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
| `agenda-split` | A concise agenda beside its title and introduction. |
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

### The record

A layout record lays its content out with `direction` and an ordered `regions` list. `direction` (`"row"` or `"column"`,
default `"column"`) says whether the list runs side by side or top to bottom. Each entry is a **region** (`name`, an
optional `size`, and the rules `accepts`, `role`, `flow`, `max`, `bleed`, `listColumns`, `anchor`, `empty`) or a **split**
(`direction`, `regions`, an optional `size`) that nests another list, up to three levels. `size` is a weight (default 1):
siblings share their parent's length in proportion; `"auto"` is the height the content needs and is allowed only in a
column. `title` and `subtitle` are the heading regions and take only `size`. An `anchor` on the record or on a split
applies to every region under it unless the region sets its own, and an omitted `accepts` means every content kind.

```json
{
  "$schema": "https://openpresentation.org/schema/opf-layout/v2",
  "id": "hero",
  "name": "Hero",
  "direction": "column",
  "regions": [
    { "name": "title" },
    {
      "direction": "row",
      "size": 2,
      "regions": [
        { "name": "lead", "accepts": ["text", "quote", "metric"], "role": "primary", "flow": "none" },
        { "name": "media", "accepts": ["image", "video"], "role": "media", "flow": "none" }
      ]
    },
    { "name": "support", "size": 1, "accepts": ["text", "list", "metric", "group"], "role": "supporting", "flow": "grid" }
  ]
}
```

Core compiles the list to the grid its engine uses, so the same layout draws the same way it did as a grid.

## Versions

The gallery is released with the other OPF packages under one shared version (core, the CLI, the renderer, the PPTX exporter,
the editor and this package; from 0.26.0). The gallery's earlier line (1.0.0 to 5.0.0) is not continued: those versions stay
on npm, and `latest` points at the shared line, so `^5` consumers keep 5.0.0 and get no further catalog fixes. While the
shared version is 0.x, a breaking change is a minor bump.

- **New records** are allowed in any release. Every existing record draws exactly as before.
- **A drawing change, a removed or renamed id, or a new record schema (`CATALOG_SCHEMA`)** is declared in the changelog
  fragment for the gallery (`drawing: ["layouts:hero"]`) and makes the release a minor version, never a patch.
- **Text a drawing never shows** (a name, a summary, a tag), the package code and the declarations change no drawing and
  may ship in a patch.

The stability check enforces the rule (`pnpm check:stability`, `scripts/gallery-stability.mjs` at the repository root). It runs
on every pull request that touches the records or the engines. The baseline is the `latest` published release. For every
layout, theme, color scheme and font scheme both releases have, it draws a fixture deck with the workspace
`@openpresentation/opf-render`, once per release: for a layout, a slide with sample content in every region (three blocks in a
flowing region, one in a `none` region) and a slide with every region empty, which exercises collapse; for a design record, a
sample deck. SVG bytes are compared first; a mismatch is rasterized to count the pixels that differ. A changed drawing or a
removed id that no fragment declares fails; a declared id that did not change warns. New ids pass.

## Where the records come from

All records are written here, in `catalog/`, and reviewed as code:

- **Layouts** (`catalog/layouts/`): one short `opf-layout/v2` record per layout (`direction` and an ordered `regions` list).
- **Themes** carry `variants` (below), written with the theme records.
- **The other kinds** (color and font schemes, narratives, audiences, purposes, tones and the display kinds) began as a
  snapshot of the catalog pptx.gallery published at `https://www.pptx.gallery/<kind>/index.json`; the pptx.gallery commit is
  recorded in `catalog/manifest.json` as history. The one-way sync from pptx.gallery was retired with 2.0.0 and its script is
  gone; pptx.gallery consumes the published package.

## Theme variants

A theme record has a `variants` list: `{ "id", "name", "variant" }`, where `variant` is the value of `design.variant` (from
OPF core 0.23.0): a background slot (`"light1"`, `"light2"`, `"dark1"`, `"dark2"`) or `{ "background", "accents" }` with a
permutation of `accent1` to `accent6` to reorder the accents. A variant is a map over the theme's one color scheme, as
PowerPoint's color map is, never a second scheme: dark is the same twelve slots with the text and background roles swapped.
Every theme offers `light`, `light-alt`, `dark` and `dark-alt`; the variant whose background is the theme's own `background`
is the theme's look (Minimal's own is `dark2`, so its `dark` is `dark2`). A host applies a variant by writing its `variant`
value to `design.variant`. There is no separate dark theme: the `dark` theme of 3.x is the `dark` variant of any theme.

## Contributing a layout

1. Write the record in `catalog/layouts/<id>.json` (`$schema` `https://openpresentation.org/schema/opf-layout/v2`,
   `id`, `name`, `summary`, `tags` with its group, `direction`, `regions` and any `design`; see [The record](#the-record)) and add its
   entry (`id`, `name`, `summary`, `group`, `file`) to `catalog/layouts/index.json` in picker order. A new layout gets a
   new id; an existing id never changes meaning.
2. `pnpm rehash` (the index and manifest hashes), then `pnpm previews` (its SVG preview).
3. Run `pnpm test` and `pnpm check:stability`. A new layout passes; if the check reports a changed record, restore it or
   declare it in the changelog fragment (a minor release).
4. Open a pull request with a `changes/<slug>.md` fragment (`packages: [gallery]`).

See [CONTRIBUTING.md](CONTRIBUTING.md) for the checks, the version rule and the license.

## License

[MIT](LICENSE). The records, the previews and the code are all under it; `pnpm check:license` checks it.

### Editorial layout defaults

Compact quote, headline-metric and image-side explanation regions opt into `anchor: "middle"`. Long text, lists and analytical views retain top alignment. A pin still selects a named region; its anchor governs content placement within that region. Centering needs a core engine that measures the content kind; older engines may keep unsupported kinds at the top. Explicit deck and slide design continues to override catalog defaults.

Picker examples in `scripts/editorial-previews.mjs` use fictional content and are separate from the unchanged filled/empty stability fixtures. Numeric examples supply units and explicit precision; FAQ previews pair questions with answers, and process previews show ordered actions.
