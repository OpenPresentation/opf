# Layout templates

A layout is **one ordered list of regions, declared once, in reading order.** Each region says how much of the slide it
takes (`size`), which content it accepts and how several blocks share it. The list has a `direction`: `row` puts the
regions side by side, left to right; `column` stacks them top to bottom. For two dimensions, an entry of the list can be
a **split**: a nested list that runs the other way. That is the whole format. There is no grid of cell names to keep in
step with a table of sizes and a table of rules.

A layout record (`https://openpresentation.org/schema/opf-layout/v2`) is an ordinary JSON object. The built-in layouts
and a deck's own layouts are records of this one schema; a custom layout is embedded under `catalogs.custom.layouts` (or
a named catalog group) and referenced by id like any other. This page is the reference for what core implements.

> The 29 built-in templates come from the matching `@openpresentation/gallery` package. Core and Gallery 5 use the region
> lists documented below; Gallery 4 and earlier used a grid of area names (`areas`). Use coordinated core and Gallery
> versions. V1 layout records, including `placeholders` and placeholder groups, remain unsupported; there are no aliases or
> migration API.

## A record

A story on the left and the evidence beside it, a third of the width:

```json
{
  "$schema": "https://openpresentation.org/schema/opf-layout/v2",
  "id": "story-and-evidence",
  "name": "Story and evidence",
  "direction": "row",
  "anchor": "middle",
  "regions": [
    { "name": "main",  "size": 2, "accepts": ["text"] },
    { "name": "aside", "size": 1, "accepts": ["metric"] }
  ]
}
```

Read it left to right, because the record's `direction` is `row`: `main` first, then `aside`, and `main` is twice as wide.
`anchor: "middle"` is written once and applies to both regions. A block targets a region by name (`"region": "aside"`),
and a slide's blocks otherwise bind to regions by kind, role and the order of the list.

A layout with a title and a row of two regions, the most common shape of the built-ins, nests one split:

```json
{
  "name": "Two column",
  "regions": [
    { "name": "title" },
    { "direction": "row", "regions": [
      { "name": "first",  "accepts": ["text", "list"] },
      { "name": "second", "accepts": ["text", "list"] }
    ] }
  ]
}
```

The record's `direction` is omitted, so it is `column`: the title on top, then one entry, a split whose own `direction` is
`row`. A split has no name; it is a place to put regions the other way. Splits nest up to three levels, so a record can
describe any layout made of full-width and full-height cuts (a guillotine partition), which is every built-in layout.

`hero` nests the same way, with sizes: a title, a row of a lead and a picture twice as tall as the supporting row, then
the supporting content.

```json
{
  "name": "Hero",
  "regions": [
    { "name": "title" },
    { "direction": "row", "size": 2, "regions": [
      { "name": "lead",  "accepts": ["text", "quote", "metric"], "flow": "none" },
      { "name": "media", "accepts": ["image", "video"], "role": "media", "flow": "none" }
    ] },
    { "name": "support", "size": 1, "accepts": ["text", "list", "metric", "group"], "role": "supporting", "flow": "grid" }
  ]
}
```

| Field | Meaning |
| --- | --- |
| `direction` | `row` (side by side, left to right in reading order) or `column` (stacked, top to bottom). Default `column`. |
| `regions` | 1 to 12 entries in reading order, each a region or a split. |
| `anchor` | Vertical position of the content of every body region under the record (or split) that does not set its own. Inherited by body regions only, never by `title` or `subtitle`. Exception: on a column record whose entries are all `auto`, it places the whole stack (see Choosing an anchor). |
| `overflowRegion` | Where content no region accepts goes. Omitted: the first `primary` region whose flow is not `none`. |
| `design` | The layout's design defaults (below). |
| `composition` | Only `gap`, `padding`, `minFontSize` and `overflow`, with their 0.18 meaning. |

An entry of `regions` is one of three things:

- a **region**: `{ "name": "...", "size"?, ...rules }`, the rules below;
- a **heading region**: `{ "name": "title" }` or `{ "name": "subtitle" }`, which take only a `size`;
- a **split**: `{ "direction": "row" | "column", "regions": [...], "size"?, "anchor"? }`, a nested list.

`size` is a number above 0 and up to 100 (default 1). Siblings share their parent's length in proportion, separated by the
gap, so `2` and `1` are two thirds and one third. `"auto"` is the height the content needs, up to the space the headings and
the numeric rows' content leave (see Tracks), and an `auto` region with no content takes no space; it is allowed only on an entry of a `column` (a `row` has no height
to ask for), and elsewhere it is the validate finding `opf/layout-template`.

`title` and `subtitle` are reserved heading regions: `title` holds the tag, title and subtitle stacked, and a `subtitle`
region takes the subtitle out of it (a `subtitle` needs a `title`). Their `size` defaults to `auto` inside a `column` and to
1 inside a `row`, so a cover that puts the title beside a picture is `{ "direction": "row", "regions": [{ "name": "title" },
{ "name": "media", ... }] }`. A layout with no `title` region gets an implicit `auto` row on top for a slide that has
headings. Region names are unique across the whole record and may not be `tag`, `auto` or a promoted-region word (`left`,
`center`, `right`, `top`, `middle`, `bottom`).

### Regions

| Field | Values | Default |
| --- | --- | --- |
| `name` | lowercase kebab-case, unique in the record; a block's `region` names it | required |
| `size` | a number above 0 and up to 100, or `auto` (columns only) | 1 |
| `accepts` | `text`, `list`, `image`, `video`, `chart`, `table`, `code`, `metric`, `quote`, `timeline`, `group` | every body kind and `group` |
| `role` | `primary`, `secondary`, `media`, `supporting` | `primary` |
| `flow` | `none`, `grid`, `column`, `auto` | `auto` |
| `max` | 1 to 12 (`none` requires 1) | 1 for `none`, else 6 |
| `bleed` | boolean: outer edges on the content box reach the slide edge; never a card | `false` |
| `listColumns` | `"auto"` (a list that does not fit its cell flows into up to three columns before it shrinks) or `1` | `1` |
| `anchor` | `top`, `middle`, `bottom` | inherited from the nearest split or the record, else `top` |
| `empty` | `collapse`, `keep` | `collapse` |

### Choosing an anchor

A block's `region` selects a named region; that region's `anchor` controls vertical placement inside it. Region names such
as `main` and `aside` have no special positioning behavior. Declare the names in the layout's region list. Write `anchor`
once on the record (or on a split) when every region under it shares it: body regions inherit it, a region's own `anchor`
wins, and the heading regions never inherit it.

Use middle anchoring for a compact statement, quotation, headline metric or short explanation beside a visual. Keep
substantial text, lists, charts and tables top-aligned so readers can compare common starting positions. A region's
anchor never moves the title: it stays in its own heading region. Anchoring does not enlarge short text to fill unused space.

#### Placing the whole group

A single-message slide (a statement, a closing, a quotation) reads best when the title and what belongs to it sit together
in the middle of the slide. A column has no numeric row to hold the leftover height when **every entry of the record's
`regions` list is sized `auto`** (`title`, `subtitle` and the body regions alike), so the record's `anchor` then places
the whole stack, headings included, in the content box's leftover height: `middle` centres it, `bottom` sits it at the foot,
`top` (the default) starts it at the top. Empty optional regions collapse and take no space, so a title-only slide centres
the title alone.

```json
{ "id": "closing", "direction": "column", "anchor": "middle",
  "regions": [ { "name": "title" }, { "name": "details", "size": "auto", "accepts": ["text", "list", "image"], "flow": "auto" } ] }
```

The rule applies only to the record's own `anchor` on a column record with all-`auto` entries (an `auto` split counts as an
`auto` entry). A record with any numeric entry, a row record, and a split's own `anchor` keep the behaviour above, so no
existing record changes until it opts in. `LayoutTemplate.stack` reports the resolved anchor.

The measured-content implementation supports text/list leaves and uncaptioned quote/metric leaves. A quote keeps
its body, attribution and photo together. A metric keeps its value and metadata together without reducing the
nominal font size merely because its placement box becomes shorter. Grid and horizontal rows share an origin
based on their tallest measured content, so differing description lengths do not stagger headline numbers.
Content that does not fit retains its allocation and overflow diagnostics. Nested groups, captioned quotes/metrics,
charts, tables and explicit slide composition overrides keep their existing allocation behavior; an anchor is not
a promise to measure arbitrary content.

Pictures shown whole and videos follow the anchor too (WI-3). A picture with `fit: "contain"` (a layout's `imageFit`, or the
block's own) takes a frame of its own proportions, as wide as its cell allows and centered across, and sits at the region's
anchor down the cell, so a landscape picture beside text starts on the text's first line instead of floating in the middle of
a tall cell. A video draws in a 16:9 frame, the largest that fits its cell, placed the same way. A frame the block shapes with
`aspectRatio` or a circle stays centered, and `cover` and `stretch` fill the cell. `image-beside` and `logos` write
`anchor: "middle"` on their media regions to keep their centered look.

### Validation

The schema checks types, enums and ranges; an embedded record that fails it is `opf/catalog-record`. `validate` adds:

| Rule | Severity | Raised for |
| --- | --- | --- |
| `opf/layout-template` | error | A `regions` list that is not 1 to 12 entries; an entry that is neither a region nor a split; a bad `direction` or `size`; `auto` outside a column; splits nested more than three levels (the record's own list is level 1); regions that compile to a grid over 12 x 12. |
| `opf/layout-region` | error | A name used twice; a reserved region name; a heading region with content rules; a `subtitle` without a `title`; a region that accepts no kind; `flow: none` with `max` other than 1; an `overflowRegion` that is not a body region. |

`composeSlide` refuses such a record (`OPFLayoutTemplateError`). `layoutTemplate(record)` parses, checks and compiles a record
and `layoutTemplateIssues(record)` lists the problems, both on `@openpresentation/opf/composition`.

### How a record becomes a grid

Every region list is a guillotine partition: each split cuts its cell across, all the way. So the engine compiles the tree
into the grid it has always composed with, and composition, the renderer, the PPTX export and the editor read that grid:

1. Each split divides its cell among its entries in proportion to their `size`; `auto` entries take the height their
   content needs.
2. The cuts of all splits along one axis are collected into the grid's tracks (rows and columns), and a region fills the
   rectangle of tracks it covers.
3. `layoutTemplate(record)` returns that grid (`rows` as numbers or `auto`, `columns`, a cell grid of names, the areas with
   their spans) and the regions in reading order with every default and inherited `anchor` applied.

Nested sizes are relative to the entry's own parent, so a split of `{ "size": 2 }` beside a region of `{ "size": 1 }` is
twice as large, whatever its children's sizes. Because the grid is shared, the gaps between regions are the grid's gaps: a
row of two regions inside a column puts one gap between the two columns, as the cell grid does. The 29 built-in layouts
compile to exactly the grids they had in Gallery 4, so nothing they draw moved.

## Binding content to regions

Slide content stays flat. `bindRegions(slide, record)` (pure, on `/composition`) binds the slide's root nodes to regions,
in source order; placed images (`placement`) take their band and never occupy a region, and a content group is one node of
kind `group`.

1. **Pins.** A block with `region: "<name>"` goes to that region when it exists, accepts the block's kind and has room.
   Otherwise the pin is ignored (`opf/region-unknown`, `opf/region-kind`, `opf/region-full`, warnings) and the block
   joins step 2.
2. **Everything else.** Of the regions that accept the block and have room, the lowest role rank wins (pictures:
   media, primary, secondary, supporting; every other kind: primary, secondary, supporting, media), then the first in
   reading order (the order of the `regions` list, depth first).
3. **No candidate.** The block goes to the overflow region whatever its `accepts` while it has room, and beyond `max`
   it is drawn there anyway with `opf/layout-unplaced` (`paginate` moves it to a continuation slide). A layout with no
   overflow region draws it in an implicit row below the grid.

An empty region collapses into a neighbour that shares the full length of one of its edges (start side, end side, below,
above; a body region before a heading region). Headings are centred vertically in their region unless every row it spans is
`auto`, so a `cover` or a title-only slide centres its title. A slide with promoted regions (`left`, `top:left`, ...)
composes them as in 0.18.

In the Markdown dialect, `<!-- block: region=metrics -->` pins a block; a promoted-region key keeps its 0.18 meaning.

## Flow

| `flow` | Blocks are arranged |
| --- | --- |
| `none` | One block fills the region. |
| `grid` | By count: 1 fills; 2, 3 in a row; 4 as 2 x 2; 5 as 3 + 2; 6 as 3 x 2; 7 to 12 in four columns. Rows and columns swap in a portrait region. A short last row keeps the column width and is centred. |
| `column` | Stacked at the heights the blocks need, one gap apart, and placed by the region's `anchor`. Charts, pictures, tables, timelines and videos take what the measured blocks (text, lists, quotes, metrics, code) leave. Blocks that do not fit share the region: each gives up the same fraction of what it can give up above its height at the minimum font size. A group's blocks in one column stack the same way. |
| `auto` | `grid` unless a block is long: more than 6 lines (code: 12, table: 6 rows) in its grid cell at the starting size (28 px for prose), counted with core's estimate, never a host font. In an `auto` region a paragraph that wraps takes a reading measure of about 70 average characters of its size (never at the cost of size; it follows the content alignment) and a lone block of up to two lines uses the 32 px lead size. |

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
3. The other `auto` rows take what they need from what is left (the implicit row below the grid holds what no region
   took). When that is not enough they shrink together: each gives up the same fraction of what it can give up above its
   content's height at the minimum font size, so a one-line note keeps nearly its need beside a dense row, and no row
   overflows while those heights fit.
   An empty region with `empty: "keep"` holds two lines of body text in an `auto` row (plus the card insets on a slide
   that draws cards, as a filled region does).
4. The numeric rows share the rest in proportion to their sizes.

Paragraphs and lists of one stacked column that do not fit at their role sizes shrink together to the largest one size that fits, and read at that one size.

Blocks drawn side by side as peers (regions of one role in the same rows, such as the columns of `two-column` or
`comparison`, and the blocks of one row of a `grid` or `row` flow) share one size per kind: their prose, and their lists,
are refitted at the smallest size any of them fitted at.

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

## No migration from the 0.18 ids

0.19 breaks layouts: there is no migration path. A layout id of the 0.18 default catalog that 0.19 does not have is an
unknown layout like any other (`opf/unresolved-reference`: the slide composes automatically and a strict export fails).
Six 0.18 ids are also 0.19 built-ins and resolve to them: `agenda`, `comparison`, `dashboard`, `faq`, `timeline` and
`two-column`. The release notes list the 29 built-ins.
