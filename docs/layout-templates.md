# Layout templates

OPF 0.19 layouts are grid templates. A layout record (`https://openpresentation.org/schema/opf-layout/v2`) names the cells
of a grid, sizes its tracks, and says for every body area which content it takes and how several blocks share it. The
built-in layouts and a deck's own layouts are records of this one schema; a custom layout is embedded under
`catalogs.custom.layouts` (or a named catalog group) and referenced by id like any other. The design is
[0.19-layouts.md](programs/release-readiness/0.19-layouts.md); this page is the reference for what core implements.

> **Transition.** Until the default catalog moves to `@openpresentation/gallery` 2.0.0, the 0.18 records
> (`opf-layout/v1`, `placeholders`) still validate and compose exactly as in 0.18. They are removed, with no alias, before
> OPF 0.19 is released. The 28 built-in templates are in `packages/javascript/test/fixtures/layout-templates-0.19.json`
> until the gallery package ships them.

## A record

```yaml
name: Roadmap split
summary: A roadmap on the left, with notes over metrics beside it.
areas: ["title title", "timeline notes", "timeline metrics"]
columns: [2, 1]
rows: [auto, 1, 1]
regions:
  timeline: { accepts: [timeline], role: primary, flow: none }
  notes: { accepts: [text, list], role: secondary, flow: column }
  metrics: { accepts: [metric, text], role: supporting, flow: grid }
```

| Field | Meaning |
| --- | --- |
| `areas` | 1 to 12 strings in the notation of CSS `grid-template-areas`: each string a row, each word a cell, a name repeated over adjacent cells spans them, `.` an empty cell. A name's cells form one filled rectangle. |
| `columns` | Relative column widths, one per cell of a row. Omitted: all 1. |
| `rows` | Relative row heights, or `auto` for the height the row's content needs (at most half the content box). Omitted: all 1. |
| `regions` | One entry per body area, keyed by its name. |
| `overflowRegion` | Where content no region accepts goes. Omitted: the first `primary` region whose flow is not `none`. |
| `design` | The layout's design defaults (below). |
| `composition` | Only `gap`, `padding`, `minFontSize` and `overflow`, with their 0.18 meaning. |

`title` and `subtitle` are heading areas: `title` holds the tag, title and subtitle stacked, and a `subtitle` area takes the
subtitle out of it. They have no `regions` entry. A layout without a `title` area gets an implicit `auto` row on top for a
slide that has headings. Region names may not be `title`, `subtitle`, `tag`, `auto` or a promoted-region word (`left`,
`center`, `right`, `top`, `middle`, `bottom`).

### Regions

| Field | Values | Default |
| --- | --- | --- |
| `accepts` | `text`, `list`, `image`, `video`, `chart`, `table`, `code`, `metric`, `quote`, `timeline`, `group` | required |
| `role` | `primary`, `secondary`, `media`, `supporting` | `primary` |
| `flow` | `none`, `grid`, `column`, `auto` | `auto` |
| `max` | 1 to 12 (`none` requires 1) | 1 for `none`, else 6 |
| `bleed` | boolean: outer edges on the content box reach the slide edge; never a card | `false` |
| `listColumns` | `"auto"` (a list that does not fit its cell flows into up to three columns before it shrinks) or `1` | `1` |
| `anchor` | `top`, `middle`, `bottom` | `top` |
| `empty` | `collapse`, `keep` | `collapse` |

### Validation

The schema checks types, enums and ranges; an embedded record that fails it is `opf/catalog-record`. `validate` adds:

| Rule | Severity | Raised for |
| --- | --- | --- |
| `opf/layout-template` | error | Ragged rows; a name whose cells are not one rectangle; `columns` or `rows` of the wrong length; a grid over 12 x 12; a word that is not a name or `.`. |
| `opf/layout-region` | error | A body area with no region; a region with no area; a reserved region name; a `subtitle` area without `title`; `flow: none` with `max` other than 1; an `overflowRegion` that is not a region. |

`composeSlide` refuses such a record (`OPFLayoutTemplateError`). `layoutTemplate(record)` parses and checks a record and
`layoutTemplateIssues(record)` lists the problems, both on `@openpresentation/opf/composition`.

## Binding content to regions

Slide content stays flat. `bindRegions(slide, record)` (pure, on `/composition`) binds the slide's root nodes to regions,
in source order; placed images (`placement`) take their band and never occupy a region, and a content group is one node of
kind `group`.

1. **Pins.** A block with `region: "<name>"` goes to that region when it exists, accepts the block's kind and has room.
   Otherwise the pin is ignored (`opf/region-unknown`, `opf/region-kind`, `opf/region-full`, warnings) and the block
   joins step 2.
2. **Everything else.** Of the regions that accept the block and have room, the lowest role rank wins (pictures:
   media, primary, secondary, supporting; every other kind: primary, secondary, supporting, media), then the first in
   reading order (by top-left cell, row by row).
3. **No candidate.** The block goes to the overflow region whatever its `accepts` while it has room, and beyond `max`
   it is drawn there anyway with `opf/layout-unplaced` (`paginate` moves it to a continuation slide). A layout with no
   overflow region draws it in an implicit row below the grid.

An empty region collapses into a neighbour that shares the full length of one of its edges (start side, end side, below,
above; a body area before a heading area). Headings are centred vertically in their area unless every row it spans is
`auto`, so a `cover` or a title-only slide centres its title. A slide with promoted regions (`left`, `top:left`, ...)
composes them as in 0.18.

In the Markdown dialect, `<!-- block: region=metrics -->` pins a block; a promoted-region key keeps its 0.18 meaning.

## Flow

| `flow` | Blocks are arranged |
| --- | --- |
| `none` | One block fills the region. |
| `grid` | By count: 1 fills; 2, 3 in a row; 4 as 2 x 2; 5 as 3 + 2; 6 as 3 x 2; 7 to 12 in four columns. Rows and columns swap in a portrait region. A short last row keeps the column width and is centred. |
| `column` | Stacked, equal heights. |
| `auto` | `grid` unless a block is long: more than 6 lines (code: 12, table: 6 rows) in its grid cell at the starting size, counted with core's estimate, never a host font. |

`design.contentDirection` makes every flowing region one row or one column. A slide's own `composition.mode`, `columns` and
`weights` arrange its first primary flowing region with the 0.18 modes, above `contentDirection`. A list in a region
with `listColumns: "auto"` (the lone list of the design, and, since the RR-81 review, any list of the region that does not
fit its own cell), or any list payload with `columns: "auto"`, tries 1, 2 then 3 columns at the starting size (a column at
least a quarter of the slide wide); `columns: 2` or `3` fixes the count.

### Tracks

Columns share the content width in proportion. Rows are allocated so that no row with content is squeezed to nothing:

1. A heading `auto` row takes what its headings need, at most half the content box.
2. The numeric rows keep at least what their content needs at the starting size, up to half of the space under the
   headings.
3. The other `auto` rows take what they need (at most half the content box each; the implicit row below the grid, which
   holds what no region took, has no such cap) from what is left, and shrink together in proportion when it is not enough.
   An empty region with `empty: "keep"` holds two lines of body text in an `auto` row.
4. The numeric rows share the rest in proportion to their sizes.

Composed content never crosses a heading or another region and never leaves its region's box. What still does not fit
uses the design's tools in order: text fits down to `minFontSize`, lists flow into columns where the region allows, blocks
beyond the room go to the overflow region and, through `paginate`, to a continuation slide; what remains is the
`opf/text-overflow` or `opf/layout-unplaced` diagnostic.

Pagination continues on a new slide with the same layout: blocks beyond a region's `max` move first, in source order, and
carry a `region` pin to the region they came from. A block that no region of the layout accepts, on a layout with no
overflow region, stays below the grid on every page and never drives a split.

## Design keys

Per key: the slide's `design`, the deck's `design`, the theme record's `design` (new in 0.19: `titleAlignment`,
`contentAlignment`, `contentBox`, `contentDirection`, `imageFit`, `listBullet`), the layout's `design`, then the engine
default. `design.mirror: true` draws a template mirrored (each row's cells and the column sizes reversed); a right-to-left
deck mirrors on top. `layout: "auto"` is automatic composition: reserved, never a catalog id, and `opf format` drops it.

## Composition output

For a slide with a template layout, `composeSlide` adds (see the declarations on `/composition`):

| Field | Meaning |
| --- | --- |
| `regions` | Every region in reading order: `name`, `box` (after collapse, mirroring and bleed), `accepts`, `role`, `flow`, `max`, `anchor`, `arrangement` (`grid`, `row`, `column`, or `composition`), `content` (root block paths bound within `max`), `overflow` (paths drawn beyond it), `collapsed`, `bleed` and, on a bled region, `areaBox` (its cell before bleed). It replaces `slots` for templates. |
| `headingAreas` | The `title` (and `subtitle`) areas with their boxes, `collapsed` or `implicit`. On a template without a `subtitle` area the title area carries `parts: { title, subtitle }`: it is split where the stacked heading group puts the subtitle, so `title` runs from the area's top to the bottom of the title (the tag above it included) and `subtitle` from the subtitle's top (half a gap under the title when the slide has none) to the area's bottom. PowerPoint's `ctrTitle` and `subTitle` placeholders use these boxes. |
| `items[].region` | The region an item was drawn in, for tagging shapes. |
| `items[].listColumns` | A list in columns: one `{ box, start, end, text }` per column at one shared size; numbering continues. The item's `text` is the whole list (every entry at its column's position), so a consumer that ignores `listColumns` still draws every item. Entry paths are the payload's: `<list>.<n>` for a string item, `<list>.<n>.text` for an object. |

`composeLayoutAreas(record, options)` gives the areas of the empty layout: where a PowerPoint slide layout puts a placeholder
per area. It is `composeSlide`'s own geometry for a slide with a one-line title and subtitle and every region kept, so it
takes `composeSlide`'s options (`width`, `height`, `presentation` for the deck's header and footer, `direction`, ...) plus
`mirror`, `placements` (placed-image bands to reserve, `{ edge, size, inset }`) and `bleed` (default `true`: a bled region
reaches the slide edge as on a slide; `false` gives its cell inside the content box). Its title area carries the same
`parts` as a slide's. `bindRegions`, `layoutTemplate`, `regionAccepts` and `gridFlowShape` expose the rest of the model.

## Migration from the 0.18 ids

`spec/reference/layout-migration.json` maps the 278 layout ids of the 0.18 default catalog to a built-in layout, the design
settings that reproduce the variant, and a content rewrite (content groups for 16 records, an image placement for 6, no
layout for `blank`). A slide whose layout is a removed id that resolves nowhere is `opf/layout-removed` (error) with a safe
fix that applies its row. `migrate(deck)` (and `opf convert <deck> -i --migrate`) applies every row, hoists a setting every
slide received to the deck, converts embedded 0.18 records into templates and drops embedded copies of removed default
records. Six ids (`agenda`, `comparison`, `dashboard`, `faq`, `timeline`, `two-column`) are also 0.19 built-ins and are
never reported as removed.
