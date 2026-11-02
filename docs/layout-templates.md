# Layout templates

A layout is **one ordered list of regions, declared once, in reading order.** Each region says how much of the slide it
takes (`size`), which content it accepts and how several blocks share it. The list has a `direction`: `row` puts the
regions side by side, left to right; `column` stacks them top to bottom. For two dimensions, an entry of the list can be
a **split**: a nested list that runs the other way. That is the whole format. There is no grid of cell names to keep in
step with a table of sizes and a table of rules.

A layout record (`https://openpresentation.org/schema/opf-layout/v2`) is an ordinary JSON object. The built-in layouts
and a deck's own layouts are records of this one schema; a custom layout is embedded under `catalogs.custom.layouts` (or
a named catalog group) and referenced by id like any other. This page is the reference for what core implements.

> The 30 built-in templates come from the matching `@openpresentation/gallery` package. Core and Gallery 5 use the region
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

`hero` nests the other way, with sizes: a row of a text column (the title, the lead and the supporting content) and a
picture two thirds as wide, bled to the slide's edges. A heading region may sit inside a split.

```json
{
  "name": "Hero",
  "direction": "row",
  "regions": [
    { "direction": "column", "size": 3, "regions": [
      { "name": "title" },
      { "name": "lead", "size": "auto", "accepts": ["text", "quote", "metric"], "flow": "none" },
      { "name": "support", "accepts": ["text", "list", "metric", "group"], "role": "supporting", "flow": "grid" }
    ] },
    { "name": "media", "size": 2, "accepts": ["image", "video"], "role": "media", "flow": "none", "bleed": true }
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
| `listColumns` | `"auto"` (a list of more than 6 entries that does not fit its cell flows into up to three columns before it shrinks) or `1` | `1` |
| `metrics` | `stack` (value, unit, label and the rest as one block at the anchor) or `tile` (LH-68: each metric fills its cell, label first as an eyebrow, the value asking for a quarter of the cell's height between 76 and 152 px, description, delta and trend at the cell's foot, start-aligned; the gallery `scorecard` uses it) | `stack` |
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

On a slide that draws content cards (`design.contentBox`), a row of cards is one row of a region's grid, or the lone blocks
of regions side by side (two-column, three-column). The anchor sets how the row stands:

- `middle` or `bottom`: a card fills its cell (starting half a gap down, clear of the heading) and the anchor places its
  content inside it, while a card carries a picture, a metric or a heading line (a labelled list item). A row of body text
  only (paragraphs and plain lists) does not (LH-64): when the tallest text fills under 45% of a filled card, the cards hug
  it with one height and the row centres in the region, since short text at the foot of a tall card reads as an empty card;
  rows that all hug stack one gap apart. When the texts are longer and their heights more than 1.5x apart, the cards still
  fill but every text starts at the card's top, so a short text does not sit alone at a foot beside long ones.
- `top`: cards of measured blocks (text, lists, quotes, metrics) hug the tallest of their row, from the top, with one height
  per row (LH-04); a row with a picture, chart, table or group keeps cells the size of the region's share.

Long texts are drawn as full-width rows (LH-86). Side by side, two or three paragraphs of at least 80 characters read as narrow
columns of long lines, or as a short one in a wide card beside a long one in a narrow card when an empty region collapsed into it.
On a slide that draws cards, when the filled regions of a layout lie in one row and hold only such paragraphs (two or three, in
several regions or in one region's grid), every paragraph moves to the first region of that row in reading order. The other
regions are left empty and collapse into it, and that region stacks them one card per row across the row. The slide must have no
`contentDirection` and no composition of its own, and must have nothing beyond a region's room or below the grid.

A stacked column of such cards (these rows, or more long paragraphs one region stacks) shares the region's height. The text is
set at the largest size of the type scale at which every row fits, each card as tall as its text plus the insets of a card that
tall. The gap between the cards closes to half a gap when that sets the text larger. The cards share the leftover height in
proportion to their needs, and each card's text sits in the middle of its card. When the texts would fill under 45% of that
height (a few short paragraphs), the cards hug their text instead and the stack sits in the middle of the region, as LH-64's rows do.
The rows are kept only when their smallest body size is at least the one the regions side by side give, or they overflow less;
otherwise the layout's regions stand.

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
row of two regions inside a column puts one gap between the two columns, as the cell grid does. The 30 built-in layouts
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

### Grouping before placement (layout harvest)

`composeSlide` then groups the bound blocks before it places a cell (`groupBinding`, on `/composition`). The rules read
block kinds, counts and text lengths, never a layout or slide id, and work for any count and in right-to-left decks. A
slide that pins any block with `region` keeps the binding above as written.

1. **Repeated pairs (LH-58).** A block sequence that repeats one pair of kinds is one cell per pair: a figure (`metric`,
   `chart`, `table`, `image`, `video`, `code`) and a paragraph, in either order, or a long and a short paragraph (one at
   least twice the other's length, the long one on the same side of every pair), two pairs or more. The pairs go to the
   region the figure binds to, which may hold up to 6 of them (or its `max`, when larger); the other regions are empty
   and collapse. Inside its cell a pair is one row (each half at least 0.8 of the cell's height wide) or one column
   (the figure above its text), half a gap apart; every pair of a grid has one cell size, so the pairs match. On a slide
   that draws cards each block keeps its own card.
2. **Group by kind (LH-82, LH-73).** A flowing region whose blocks are mostly (more than half, at least 2) of a kind it
   accepts keeps only those. The blocks it took only as the overflow region (within its room) go to another region that
   accepts them, beyond that region's `max`, or else to the implicit row below the grid; they are not
   `opf/layout-unplaced`. Up to 4 such blocks sit side by side in one row under the grid (or stacked, when that is
   shorter), and the row asks for at most 30% of the content box, down to its height at the minimum font size, so the
   grid keeps about 60 to 65% of the body. On `metrics`, 3 metrics and 2 notes are a row of metrics over a row of two
   notes; on `chart`, 3 charts and 2 notes the same.
3. **Extra blocks join a region (LH-46).** A block no region had room for, on a layout with no overflow region, joins
   the region that accepts it instead of the row below the grid: a `flow: none` region takes up to 6 blocks (accepted,
   no finding: the region then flows as `auto`); a flowing region takes up to 12, drawn beyond its `max` with
   `opf/layout-unplaced` as an overflow region draws them (so `paginate` can still move them).
   - `flow: none` regions of one role side by side (the `first` and `second` columns of `comparison` or `two-column`)
     become one region of N cells: the first takes their blocks and any block bound between them in source order (the
     `verdict`), and the others collapse into it. Four texts on `comparison` are a 2 x 2 grid in reading order.
   - A lone fixed region arranges pictures as a **mosaic** and text, quotes and metrics as a **lead plus cards**. A
     mosaic is 2 or 3 pictures in a row, and 4 to 6 a lead picture at full height beside the others in two rows (the
     lead as wide as two of their columns); a region taller than wide stacks 2 and sets a lead picture across the top of
     3 to 6. Mosaic pictures are cropped to fill (`cover`) unless the block, slide, deck or theme sets `imageFit` (the
     layout's own `contain` gives way). A lead plus cards is the first block across the region (a short one at the lead
     size) over the others in the balanced grid below, each row at the height it needs, placed by the region's anchor.
   - The join is kept unless it overflows more than leaving the extra blocks below the grid (counting `text-overflow` and
     `small-cell`): measured blocks such as tables or timelines that need more room than the joined cells give stay below
     the grid with `opf/layout-unplaced`, where they read whole (three tables in `table-beside`'s narrow region broke their
     words).

An empty region collapses into a neighbour that shares the full length of one of its edges (start side, end side, below,
above; a body region before a heading region). A column of the grid that holds nothing but empty regions (and heading or
below-the-grid areas that span other columns too) gives way first (LH-65) when at least two columns with content remain, or
when its empty region has no neighbor to collapse into (a `hero`'s media column beside its stack of rows): it takes no width
and no gap, and the columns left share the width by their own sizes, so two blocks in `three-column` draw 1:1 instead of one
column beside a neighbor that took the third column's width too. The empty region reports `collapsed` and a zero-wide cell where
its column was. The column, and a nested group's new default gap (LH-89), are kept only when no block reads smaller than with
the columns and gaps of before (unless that removes overflow). Headings are centered vertically in their region unless every
row it spans is `auto`, so a `cover` or a title-only slide centers its title. A slide with promoted regions (`left`, `top:left`, ...)
composes them as in 0.18.

In the Markdown dialect, `<!-- block: region=metrics -->` pins a block; a promoted-region key keeps its 0.18 meaning.

## Flow

| `flow` | Blocks are arranged |
| --- | --- |
| `none` | One block fills the region. |
| `grid` | By count: 1 fills; 2, 3 in a row; 4 as 2 x 2; 5 as 3 + 2; 6 as 3 x 2; 7 to 12 in balanced rows of at most four (7 as 4 + 3, 8 as 4 + 4, 9 as 3 x 3, 10 as 4 + 3 + 3; LH-47: no row is more than one cell short of another). Rows and columns swap in a portrait region (7 as 3 + 2 + 2). The cells of a short row stretch to the full width; in a grid of only pictures and videos they keep the full rows' size, one aspect, and are centred. |
| `column` | Stacked at the heights the blocks need, one gap apart, and placed by the region's `anchor`. Charts, pictures and videos take what the measured blocks (text, lists, quotes, metrics, code, timelines, tables) leave; a table (LH-44) needs its rows at the starting size, gives up height down to its rows at the floor and takes a share of any spare height. Blocks that do not fit share the region: each gives up the same fraction of what it can give up above its height at the minimum font size. A group's blocks in one column stack the same way. |
| `auto` | `grid` unless a block is long: more than 6 lines (code: 12, table: 6 rows) in its grid cell at the starting size (28 px for prose), counted with core's estimate, never a host font. In an `auto` region a paragraph that wraps takes a reading measure of about 70 average characters of its size (never at the cost of size; it follows the content alignment) and a lone block of up to two lines uses the 32 px lead size. |

Several timelines in one region are a stack of horizontal bands whatever the region's `flow` and `contentDirection`: one column, or two when one column does not fit at the readability floor (see [Dynamic composition](dynamic-composition.md#timeline-internals)).

`design.contentDirection` makes every flowing region one row or one column. A slide's own `composition.mode`, `columns` and
`weights` arrange its first primary flowing region with the 0.18 modes, above `contentDirection`. A list in a region
with `listColumns: "auto"` (the lone list of the design, and, since the RR-81 review, any list of the region that does not
fit its own cell), or any list payload with `columns: "auto"`, tries 1, 2 then 3 columns at the starting size (a column at
least a quarter of the slide wide); `columns: 2` or `3` fixes the count. `auto` never deals a list of 6 or fewer entries
across columns (LH-42): such a list shrinks in its one column instead.

**Several lists in a region (LH-42).** A region (on a slide without `design.contentDirection`) that
receives 2 or more lists and nothing else lays them out one list per cell, a card when the slide draws cards, so sibling
lists never read as one table: 2 to 4 lists in that many columns, a multiple of 3 in 3 columns, any other count in 4
(7 as 4 + 3). A column stays at least 7.5 list ems (240 px) wide; a narrower region fills its rows evenly (4 lists in 2 x 2),
and a region taller than wide stacks up to 3 lists and takes at most 2 columns. Each row is as tall as its tallest list needs,
descriptions and nested entries counted, at the largest one size at which every row fits, and the region's lists share that
size. Cards share the height left over, so they fill the region; lists without cards keep their rows and the region's
`anchor` places them. No list of the grid is dealt across columns.

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

Sibling blocks share one size per kind (LH-43): the blocks of one region whatever its arrangement (every row of a `grid`,
a `row`, a stacked column), regions of one role in the same rows (the columns of `two-column` or `comparison`), and blocks
drawn below the grid with the parallel primary regions they continue (a lone primary region, such as a statement's message,
keeps its own size). Their prose, and their lists, are refitted at the smallest size any of them fitted at; sibling metrics
share it role by role (value, unit, label, description, delta, trend). A sibling the shared size would make overflow keeps
its own fit, so the shared size never takes a block under the readability floor.

Sibling quotes in one row share one body size too (LH-78), and a region's similar paragraphs, a lead beside a stack and the start
alignment of long text in a centered layout follow the rules in [Reading measure, alignment and
leads](dynamic-composition.md#reading-measure-alignment-and-leads) (LH-70, LH-67, LH-72). A paragraph grid and a lead plus
stack replace a lone fixed region's lead plus cards when they are no smaller; a `flow: grid` region never takes a lead plus stack.

Where sibling text and lists span several rows, the rows are sized jointly with the shared size instead of being fixed first:
at each size of the type scale, from the largest start down, every row asks for its tallest cell's need at that size (a card's
insets included), and the largest size at which the rows fit is kept. This applies to a region's grid of paragraphs and lists
(as LH-42 did for a list grid), to a stacked column, to an automatic grid, and to the parallel primary regions with the blocks
drawn below them (their template rows are allocated at that size). Leftover height goes to the rows in proportion to their
needs (cards, a grid of paragraphs, an automatic grid) or stays at the region's anchor (lists without cards), so a row of short
texts is a short row and a row of long ones a tall one. The cells of one row keep its height and columns keep their widths.
Sets that mix in other blocks (a metric, a picture, a chart) keep their rows and share sizes as above.

A block that shrinks takes a size of the type scale (LH-17): from `minFontSize` up by a ratio of (28/16)^¼, rounded to whole
reference pixels, which is 16, 18, 21, 24, 28 and 32 px at the default floor. Prose has five sizes from its 28 px start to the
floor, and a list or lead six from 32 px; a block that fits at its starting size keeps it, on the scale or not. The scale
depends only on the floor and the canvas, so every slide composes independently and the engines agree.

Composed content never crosses a heading or another region and never leaves its region's box. What still does not fit
uses the design's tools in order: text fits down to `minFontSize`, lists flow into columns where the region allows, blocks
beyond the room go to the overflow region and, through `paginate`, to a continuation slide; what remains is the
`opf/text-overflow` or `opf/layout-unplaced` diagnostic.

Pagination continues on a new slide with the same layout: blocks beyond a region's `max` move first, in source order, and
carry a `region` pin to the region they came from. A block that no region of the layout accepts, on a layout with no
overflow region, stays below the grid on every page and never drives a split.

The export does one split on its own (LH-90). A slide whose body is two or more units of one kind (eight timelines, five
tables; a unit is a block of the first block's kind with the blocks that follow it, so a timeline keeps its note) and that
overflows at its readability floor continues on further slides of the same layout, split between whole units: the fewest
pages that fit, the units spread evenly, every page bound by the layout as the first is (no pins, so each page can
recompose). `opf convert` and `convert` draw that deck for the preview and the PPTX alike and report each such slide
(`slide-continued`, report field `continued`); a strict slide still fails, and `paginate: false` (`--keep-slides`) draws
the slide as written. See [dynamic composition](dynamic-composition.md#pagination).

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

### A body that fills too little (LH-48)

Short content steps up instead of sitting small at the top of an empty body, as Claude Design sets a short message.

- **A lone block.** When a slide's whole body is one paragraph, list, quote, code panel, metric or table (the only block of
  an automatic slide, or a template slide's only block, with nothing below the grid), its region's cell reaches the foot of
  the content box when every other region is empty, and the block takes the body. When it fills under half of that height
  at its role sizes it steps up: a paragraph or a list by the steps of the type scale above its size, a quote, code panel,
  metric or table by the scale's ratio on every role, to the largest step at which it fills at most 60% of the body and
  every part keeps the size it asks for. No role grows past its display size (`LONE_DISPLAY_SIZES`: text 43 px, a list 37,
  a quote 56, code 32, a metric's value 152, a table 32, at a 720-pixel short edge). The block then sits in the middle of
  the body, its card hugging it; a grown table's rows grow with its type (`items[].tableGrowth`, which both engines pass to
  `layoutTable`). A block that fills half the body or more keeps its sizes and its place.
- **A body of paragraphs and lists.** Two or more text and list blocks (in a layout's regions, or on a slide without a layout)
  that fill under half of the body below the headings, with nothing overflowing, are composed again one, two or three type-scale steps larger (each up to a
  list's display size, 37 px), and the largest step that adds no finding, sets every block larger and fills at most 60%
  is kept; siblings keep one size (LH-43) and no block reads smaller than before. On a layout the body then sits in the
  middle of the space under the headings: rows that hug
  their content move down, regions take the height their blocks need in the middle of their cells, and cards hug their
  text (LH-64's hug, whatever it fills of a card).
- **Never grown.** A stacked record (`statement`, `quote`, `closing`, which already center their message), blocks below
  the grid (a section's notes), a body with a picture, chart, video or timeline beside its text, a captioned block, a
  list in columns, an overflowing composition, and `composeSlide(slide, { fill: false })`, for hosts and tests of the
  role sizes. Both engines read the result from core.

### Recomposition at the readability floor (LH-83)

A layout whose regions leave its content too little room sets that content at the readability floor. When a template's
composition sets a body role at the floor, `composeSlide` composes the same blocks again as the automatic grid
([dynamic composition](dynamic-composition.md)) and keeps that result when its smallest body size is larger (or as large and it reports less overflow), it reports no
more overflow (`text-overflow`, `small-cell`) and no more of its fits break a line inside a word; otherwise the layout's
result stands. Both compositions are pure, so the choice is deterministic, and both engines read it from core.

- **Body roles.** Text, lists and table cells, and the main part of the other payloads: a quote's and a code panel's body, a
  metric's value and label, and a timeline event's `what`. The other parts (attribution, filename, language, unit, delta,
  description, trend, a timeline's name, dates and notes) ask for 14 to 20 px by design, so reaching the floor is no squeeze
  and never triggers it. Headings are not body. The floor is the composition's `minFontSize` (16 reference pixels at a
  720-pixel short edge, 12 pt).
- **What stays.** Every block is drawn, in source order. The header and footer bands, the footnote area, placed images and
  the background are the slide's own and do not change. The layout record's `design` (alignment, cards, list bullet, image
  fit, background variant) and `composition` (padding, gap, `minFontSize`) still apply. The slide keeps its `layout`, so
  the PPTX export still uses that layout's native slide layout, and an edit that gives the content room (fewer blocks,
  `paginate`) returns the slide to its regions.
- **What changes.** The tag, title and subtitle are a content slide's heading group above the body, as on an automatic slide
  (the one-line title steps of LH-51 and LH-76), not the layout's title area. Region semantics do not apply: the result
  has no `regions` or `headingAreas`, no item names a `region`, and no `opf/layout-unplaced` is reported, since every block
  is in the grid.
- **Reported as** `recomposed: { layoutSize, size }` on the composition: the smallest body size the layout fitted and the
  smallest of the result, in reference pixels. Validate reports the findings of the result it composes.
- **A chart too short (LH-49).** A layout that leaves a chart's plot shorter than its minimum (the larger of 120 reference
  pixels and 22% of the body's height, `chartPlotBox`) is recomposed the same way, at any body size, when the automatic grid
  draws the shortest plot taller and reads as well: no more overflow or split words, no more paragraphs under the reading
  measure, and no block's body size smaller (only a layout that overflows may trade size, to overflow less, never at the floor). `recomposed.chart` then holds the shortest
  plot of the layout and of the result, `{ layoutPlot, plot }`. A wide chart region the layout draws on purpose (`chart`,
  `dashboard`) keeps its proportions: only the plot's height triggers it. chart-beside with its notes holding further charts
  (a few pixels of plot each) becomes the automatic grid of charts above their notes.
- **Never recomposed.** A slide the layout fits above the floor, a cover, a slide with promoted regions, a slide with a block
  pinned to a region (`region`: the author chose the region), and `composeSlide(slide, { recompose: false })`, for hosts
  that need the regions and for tests of a layout's own geometry. A strict composition (`overflow: "error"`) that the layout
  cannot fit still fails, and an automatic grid that fails strictly is not kept.

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
`two-column`. The release notes list the 30 built-ins.
