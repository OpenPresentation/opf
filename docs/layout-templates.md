# Layout templates

A layout is **one ordered list of regions, declared once, in reading order.** Each region says how much of the slide it
takes (`size`), which content it accepts and how several blocks share it. The list has a `direction`: `row` puts the
regions side by side, left to right; `column` stacks them top to bottom. For two dimensions, an entry of the list can be
a **split**: a nested list that runs the other way. That is the whole format. There is no grid of cell names to keep in
step with a table of sizes and a table of rules.

A layout record (`https://openpresentation.org/schema/opf-layout/v2`) is an ordinary JSON object. The built-in layouts
and a deck's own layouts are records of this one schema; a custom layout is embedded under `catalogs.custom.layouts` (or
a named catalog group) and referenced by id like any other. This page is the reference for what core implements.

> The 36 built-in templates come from the matching `@openpresentation/gallery` package. Core and Gallery 5 use the region
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
- a **heading region**: `{ "name": "title" }` or `{ "name": "subtitle" }`, which take only a `size`, an `anchor` and (the
  `title`) a `rule` (see [Display headings](#display-headings-lh-130));
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
| `accepts` | `text`, `list`, `image`, `video`, `chart`, `table`, `code`, `metric`, `quote`, `timeline`, `diagram`, `group` | every body kind and `group` |
| `role` | `primary`, `secondary`, `media`, `supporting` | `primary` |
| `flow` | `none`, `grid`, `column`, `auto` | `auto` |
| `max` | 1 to 12 (`none` requires 1) | 1 for `none`, else 6 |
| `bleed` | boolean: outer edges on the content box reach the slide edge; never a card | `false` |
| `listColumns` | `"auto"` (a list of more than 6 entries that does not fit its cell flows into up to three columns before it shrinks) or `1` | `1` |
| `metrics` | `stack` (value, unit, label and the rest as one block at the anchor) or `tile` (LH-68: each metric fills its cell, label first as an eyebrow, the value asking for a quarter of the cell's height between 76 and 152 px, description, delta and trend at the cell's foot, start-aligned; the gallery `scorecard` uses it) | `stack` |
| `sequence` | `steps` or `numbered` (LH-07: the region lists the steps of a sequence, drawn under numbered badges joined by a connector, see [Step sequences](#step-sequences-lh-07); the gallery `process` uses `steps`, `agenda` and `agenda-split` use `numbered`) | none |
| `arrangement` | `pyramid`, `matrix`, `cycle`, `chevrons`, `flow` or `vertical-flow` (SH-09, SH-18: the region's lone list of one level draws as PowerPoint's Basic Pyramid, Basic Matrix or Basic Cycle geometry, exported as live SmartArt where PowerPoint draws it as the preview does, or as OPF's own design of the arrangement where PowerPoint's does not hold the entries; a matrix of other than four entries draws cards; see [Pyramids, matrices and live SmartArt](smartart.md); the gallery `pyramid`, `matrix` and `cycle` use them; SH-17: `chevrons` draws the list as PowerPoint's Basic Chevron Process, `flow` as its Basic Process (boxes with arrows) and `vertical-flow` as its Vertical Process, or OPF's own rows or columns of them, used by the gallery layouts of the same names) | none |
| `anchor` | `top`, `middle`, `bottom` | inherited from the nearest split or the record, else `top` |
| `empty` | `collapse`, `keep` | `collapse` |

### Choosing an anchor

A block's `region` selects a named region; that region's `anchor` controls vertical placement inside it. Region names such
as `main` and `aside` have no special positioning behavior. Declare the names in the layout's region list. Write `anchor`
once on the record (or on a split) when every region under it shares it: body regions inherit it, a region's own `anchor`
wins, and the heading regions never inherit it (they set their own, see [Display headings](#display-headings-lh-130)).

Use middle anchoring for a compact statement, quotation, headline metric or short explanation beside a visual. Keep
substantial text, lists, charts and tables top-aligned so readers can compare common starting positions. A region's
anchor never moves the title: it stays in its own heading region. Anchoring does not enlarge short text to fill unused space.

#### Display headings (LH-130)

A heading region takes its own `anchor`, which places the heading group (tag, title and subtitle) in a sized area: `middle`
(the default) centers it, `bottom` sets it at the foot of the area and `top` at its top. An `auto` area is as tall as the
group, so its anchor changes nothing. The `title` region also takes `rule: true`: a slide whose headings are its message
(no primary or secondary region holds a block and nothing sits below the grid) and that has a title but no tag draws a short
accent rule, 80 by 5 px at a 720 px short edge, half a gap above the title at its start edge (the right in a right-to-left
title). A tag is the group's eyebrow and takes the rule's place. Both engines fill it in the tag's color: the primary, or the
text color where the primary is under 4.5:1 on the slide (`SlideComposition.titleRule`; the PPTX export writes a native
rectangle tagged `OPF_TITLE_RULE_V1`, which import consumes as the layout's drawing). The gallery `cover` and `section` use
both, with `titleAlignment` and `contentAlignment` `left` (start), so a display title sits low at the start edge as Claude
Design sets it, with the section's tag ("Part 1") as its eyebrow.

Over a picture background the group goes where the measured picture is calm under its text (LH-158, see
[text on a picture](image-treatments.md#text-on-a-picture)); in a run that measured nothing, a `bottom` group is centered as
before LH-130, keeping its start alignment, rule and eyebrow. Plain and variant backgrounds keep the low anchor.

LH-155: the gallery `closing` takes the same treatment as a stacked record: its all-`auto` column has `anchor: "bottom"`, so the stack (the title
under the accent rule, then the contact lines) stands at the foot of the content box at the start edge, as Claude Design sets a closing. The
rule rides on the title (`rule: true`) and is a guarded rule (`title-rule`): where the stack has no room to spare, so that the rule
would set the contact lines smaller, the slide has no rule. Over a picture background the low stack is placed by the same scores as a
heading group (LH-158), as one group (title and contact lines) at the top, middle or foot of the content box, keeping its alignment and
with no panel; `textPlacement` picks its anchor. In a run that measured nothing the stack is centered, as it was before.

Such a title grows to display size by steps of the type scale (LH-129, up to 75 px). A title that fits one line at its role
size may take a second line on the way (LH-130) when the two lines read as one balanced block: the shorter at least half the
longer, and no line but the last ending in a one-letter word or an article. A title that already wraps keeps the breaks its
role size balanced (LH-148). Nothing is set smaller than without the growth.

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
  content inside it, while a card carries a picture, a metric or a heading line (a labeled list item). A row of body text
  only (paragraphs and plain lists) does not (LH-64): when the tallest text fills under 45% of a filled card, the cards hug
  it with one height and the row centers in the region, since short text at the foot of a tall card reads as an empty card;
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
block's own, or `auto` that resolves to contain: LH-104, the `image` layout's default) takes a frame of its own proportions, as wide as its cell allows and centered across, and sits at the region's
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
row of two regions inside a column puts one gap between the two columns, as the cell grid does. The 36 built-in layouts
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
   reading order (the order of the `regions` list, depth first). Then source order is kept across regions where the
   layout allows it (LH-122): a block drawn on the wrong side of another bound block moves to the equally ranked region
   that accepts it, has room and leaves it out of order with the fewest blocks, being drawn before a block it follows
   counting more than being drawn after one it precedes. The `timeline` layout has a `lead` region (text, auto height)
   between the title and the timeline and `notes` after it, so a text authored before the timeline is its lead and one
   after it (or between two timelines) a note.
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
   - The closing's `details` region already flows, so its blocks join nothing; it takes the same lead plus cards (the
     guarded rule `closing-lead`). A layout whose one body region is a flowing `supporting` region, holding 3 to 6 plain
     texts that its `auto` flow would stack (a text too long for a cell of the balanced grid) and that read as neither
     paragraph columns (LH-70) nor a lead plus stack (LH-67), and whose other texts fill whole rows of the balanced grid (2, 3 or 4 of them, never a short last row), sets the first text, its call to action, across the region
     over the others in the balanced grid, as Claude Design draws a closing's details under its call to action. It is
     kept only when no text reads smaller and nothing more is found (the size guard).
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
| `grid` | By count: 1 fills; 2, 3 in a row; 4 as 2 x 2; 5 as 3 + 2; 6 as 3 x 2; 7 to 12 in balanced rows of at most four (7 as 4 + 3, 8 as 4 + 4, 9 as 3 x 3, 10 as 4 + 3 + 3; LH-47: no row is more than one cell short of another). Rows and columns swap in a portrait region (7 as 3 + 2 + 2). The cells of a short row stretch to the full width; in a grid of only pictures and videos they keep the full rows' size, one aspect, and are centered. |
| `column` | Stacked at the heights the blocks need, one gap apart, and placed by the region's `anchor`. Charts, pictures, videos and diagrams take what the measured blocks (text, lists, quotes, metrics, code, timelines, tables) leave; a table (LH-44) needs its rows at the starting size, gives up height down to its rows at the floor and takes a share of any spare height. Blocks that do not fit share the region: each gives up the same fraction of what it can give up above its height at the minimum font size. A group's blocks in one column stack the same way. |
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
reference pixels, which is 16, 18, 21, 24, 28 and 32 px at the default floor, with the half step between each two (LH-149: the
ratio to a half power, 17, 20, 23, 26 and 30 px). A block that fits at its starting size keeps it, on the scale or not. The half
steps matter most to siblings sized jointly: one size for all of them, the largest at which every row fits, so a whole step under
the size they fit cost every sibling a step (six FAQ pairs that fit 24 px drew at 21, now 23). They are a guarded rule
(`half-steps`): a joint fit at a half step gives its rows other heights than the step under it, so the half steps are kept only
where no block reads smaller than without them (dense comparison options that would reach 20 px only by setting the verdict
under them from 28 to 21 px keep 18 and 28). Half steps never change which arrangement wins: every choice between arrangements
(the guard's rule sets, step badges, tracks, LH-83's recomposition at the floor) counts a block that shrank onto a half step at the
step under it, so a gain of half a step alone (16 to 17 px) keeps the slide's arrangement and an agenda keeps its step badges. The scale depends only on the floor and the canvas, so every slide composes
independently and the engines agree.

Composed content never crosses a heading or another region and never leaves its region's box. What still does not fit
uses the design's tools in order: text fits down to `minFontSize`, lists flow into columns where the region allows, blocks
beyond the room go to the overflow region and, through `paginate`, to a continuation slide; what remains is the
`opf/text-overflow` or `opf/layout-unplaced` diagnostic.

Pagination continues on a new slide with the same layout: blocks beyond a region's `max` move first, in source order, and
carry a `region` pin to the region they came from. The pages of one slide share its type sizes (LH-144): each page after the
first carries `composition.maxFontSize`, the largest size the first page draws for the kinds of block it holds (paragraphs,
lists, quotes, metrics, timelines), so a last page with one timeline or a short list does not read larger than the pages before
it. The cap only lowers sizes, never under `minFontSize`; headings, tables, code and charts keep theirs. A block that no region of the layout accepts, on a layout with no
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
`contentAlignment`, `contentBox`, `contentDirection`, `imageFit`, `listBullet`, `listStyle`), the layout's `design`, then the engine
default. `design.mirror: true` draws a template mirrored (each row's cells and the column sizes reversed); a right-to-left
deck mirrors on top. `layout: "auto"` is automatic composition: reserved, never a catalog id, and `opf format` drops it.

## Composition output

For a slide with a template layout, `composeSlide` adds (see the declarations on `/composition`):

| Field | Meaning |
| --- | --- |
| `regions` | Every region in reading order: `name`, `box` (after collapse, mirroring and bleed), `accepts`, `role`, `flow`, `max`, `anchor`, `arrangement` (`grid`, `row`, `column`, or `composition`), `content` (root block paths bound within `max`), `overflow` (paths drawn beyond it), `collapsed`, `bleed` and, on a bled region, `areaBox` (its cell before bleed). It replaces `slots` for templates. |
| `headingAreas` | The `title` (and `subtitle`) areas with their boxes, `collapsed` or `implicit`. On a template without a `subtitle` area the title area carries `parts: { title, subtitle }`: it is split where the stacked heading group puts the subtitle, so `title` runs from the area's top to the bottom of the title (the tag above it included) and `subtitle` from the subtitle's top (half a gap under the title when the slide has none) to the area's bottom. PowerPoint's `ctrTitle` and `subTitle` placeholders use these boxes. |
| `items[].region` | The region an item was drawn in, for tagging shapes. |
| `steps` | LH-07: what each `sequence` region draws besides its text, in reading order: `form` (`row`, `column` or `flow`), `badges` (`cx`, `cy`, `radius`, `label`, `fontSize`, `baseline`, and `list` when the badge draws a list entry's own number), `connector` (`x1`, `y1`, `x2`, `y2`), `chips` and `arrows` of a flow, and `lineWidth`. |
| `items[].listColumns` | A list in columns: one `{ box, start, end, text }` per column at one shared size; numbering continues. The item's `text` is the whole list (every entry at its column's position), so a consumer that ignores `listColumns` still draws every item. Entry paths are the payload's: `<list>.<n>` for a string item, `<list>.<n>.text` for an object. |

### Step sequences (LH-07)

A region with `sequence` lists the steps of a sequence, and composition draws them as Claude Design does:

- **Steps side by side** (`steps`): two or more text or list blocks are the steps. Each draws under a numbered badge, an accent circle
  1.75 times the step text across with its numeral at the step text size, in the scheme color readable on the accent. The badge sits
  0.4 of its width above the text, at the block's start (its right edge in a right-to-left deck), or over its middle when the block is
  centered. The badges of a row share one line, and a connector in the border color runs through their centers. A one-entry numbered
  list gives its badge its number and draws as a heading over its description (LH-77); any other block is numbered by its position.
  Each block keeps the band for its badge in the height it asks for and in its cell.
- **A list's entries** (`steps` for a lone list of two or more entries, `numbered` for every list of two or more entries of one level,
  numbered or not, since an agenda runs in time): each entry draws beside its
  badge in the list's marker column (the side its paragraph starts), centered on its first line, with a connector down the column. The
  badges are at least 0.4 of their width apart. The list keeps its numbers (`marker.number`); a list without `numbering` is counted in
  arabic as drawing only: the document keeps no numbering and the PPTX import gives the list back unnumbered. In a `numbered`
  region the unnumbered lists count on from one list to the next, as one agenda, and keep their markers when one of the region's
  lists cannot take badges (a lone entry, nested entries), so a part of the agenda is never numbered alone.
- **A flow** (`steps`): a lone list of 3 to 6 entries of one or two words (24 characters at most), without descriptions, is a row of
  chips (cards) joined by accent block arrows in reading order. The chips share the region's width when the widest entry fits each,
  else each hugs its entry; each entry is a list column centered in its chip.
- **Numbered rows** (`numbered`, LH-134): an agenda whose every entry, in every list of the region, has a description draws as ruled
  rows instead of badges: each number a numeral at the list size, bold in the accent and in two digits under 10 ("01"), in a column at
  the row's start (the right in a right-to-left list), the label bold and the description in a second column beside it when the labels
  fit 40% of the width, a hairline between two rows and no connector. One entry without a description keeps every list of the agenda
  beside badges, so an agenda is drawn one way. The numbers stay drawing, as the badges' are.

Steps keep their text size: the badges are a guarded rule (`step-badges`, and `numerals` for numbered rows), so a slide whose blocks
would get smaller under them draws as before (LH-168: the comparison is also of the smallest size each block draws, a list's label and description
sizes, not of the list's base size, which is the label's in columns and the description's beside a badge; steps whose descriptions wrap
draw as a stepper in every language, and a row of steps is centered under the title as the columns are), and a flow that does not fit one line at the list's size stays a list. A lone badge list
grows (LH-48) as the plain list would, as long as it fits with its badges (or numerals). The preview draws the badges, numerals,
connector, chips and arrows from `steps`, and the PPTX export writes them as native shapes (an ellipse holding its numeral, a text box
holding a numeral, a line, rounded rectangles and `rightArrow` or `leftArrow` presets), tagged so that import consumes them and gives a
list its numbering back. Which of numerals, badges and plain rows a list takes is one rule, written down in
[Dynamic composition](dynamic-composition.md#numerals-badges-or-rows-lh-134).

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
  that fill under half of the body below the headings (the height their text covers, so the empty space inside cards that share
  the body, as LH-86's rows, does not count), with nothing overflowing and no text at the floor, are composed again one, two or three type-scale steps larger (each up to a
  list's display size, 37 px), and the largest step that adds no finding, sets every block larger and fills at most 60%
  is kept; siblings keep one size (LH-43) and no block reads smaller than before. On a layout the body then sits in the
  middle of the space under the headings: rows that hug
  their content move down, regions take the height their blocks need in the middle of their cells, and cards hug their
  text (LH-64's hug, whatever it fills of a card).
- **Never grown by these two rules.** A stacked record (`statement`, `quote`, `closing`, which place their message as one stack, a closing at the foot (LH-155), and grow by
  LH-129's rule below), blocks below
  the grid (a section's notes), a body with a picture, chart, video or timeline beside its text, a captioned block, a
  list in columns, an overflowing composition, and `composeSlide(slide, { fill: false })`, for hosts and tests of the
  role sizes. Both engines read the result from core.
- **A message in the middle of the slide (LH-129).** A slide whose title stands free (centered in a sized title area, or in a
  stacked record) over no primary or secondary block, such as `cover`, `section` and `closing` or a slide with no body and no
  layout record, grows its title and subtitle by one, two or three steps of the type scale, each up to its display size
  (`HEADING_DISPLAY_SIZES`: title 75 px, subtitle 37; the tag is LH-32's eyebrow at its 22 px role size and keeps it); a
  title over a primary block (a quote's) keeps its size; a statement's title over its paragraph is LH-09's message below. A stacked record (`statement`, `quote`, `closing`) grows its body by the same steps: paragraphs and lists up to a list's
  display size, quotes by the scale's ratio on every role (`LONE_DISPLAY_SIZES`). The largest step is kept at which nothing
  overflows, every text is at least as large as at the step before, no heading takes another line or lands off the scale, every
  region keeps its arrangement and blocks, LH-06's band or pill stays, no block reads smaller under the guard, and the text covers
  at most 60% of the content box. The record's stack or centered title area places the larger text as it placed the smaller.
- **Statements and short messages (LH-09, LH-69).** The `statement` record is start-aligned with LH-130's rule over its title.
  A sentence title over a paragraph is the message: it grows to display size (75 px), the paragraph keeps its size. A metric, or a
  text under a title of at most 4 words, is the message: the stack gives way, the title is the running head and the block fills the
  body (LH-48, LH-101). A lone text of at most 25 words (`messageWords`, any script) grows on to 56 px (75 px at 4 words or fewer)
  on at most 4 balanced lines; its bold runs draw in the primary color where that reads 4.5:1. A lone one-entry list with a short
  label draws it as a display word over a short rule; a placed region's short text is a bold heading. Guarded rules
  `statement-message` and `display-message`.
  LH-163: where the primary does not read 4.5:1 on a dark or accent surface, a display message's bold words draw in a lighter tint of
  the primary that does (hue and saturation kept, lightness raised), never in a color the author did not mark. LH-164: a slide whose
  whole body is one such message takes the accent surface on a light deck, where the accent is calm enough to fill a slide (docs/design-resolution.md, "A message-only slide").
- **Pricing tiers (LH-135).** A slide whose body is 2 to 5 groups, each a metric with a `label` followed by a list or text (a
  tier's name, price and what it includes), draws each group as one card of its region's cell, in one row: the label is the
  metric's eyebrow (bold capitals with tracking, at the tag's 22 px, in the eyebrow's color; `MetricLayout.eyebrow`), the price
  under it at display size (80 to 96 px, 96 to 128 px for two tiers, stepped down to the one line the card holds, so "$49" and
  "$1,200/mo" never split), then the description and the details, from the top of the card. The cards share one top edge and one
  height (LH-22's full-height cards) and every item of a tier shares the tier's `frameBox`, so a card is drawn once. The prices that
  reach their 76 px role size read at one size; each tier's details keep the size they fit at. The guard holds every block to the
  size it had as two cards, so a price too wide for the narrower card (a four-tier row with "$1,200/mo") keeps them. A group with
  `emphasis: true` keeps LH-06's surface and the other tiers are cards. The group's `composition` is read as a column.
- **Rows of figures (LH-169).** A list of 2 to 4 first-level entries that each lead with a short figure (`figureText`: a number with
  its unit or comparison, after an optional sign and currency symbol, at most 4 words: "62 minutes a day", "1 in 6 reports", "$3.2M",
  "٦٢ دقيقة يوميًا"; not a step number, a clock time, a year or a day of a month) and carry a description (`figureList`) draws as a row
  of metrics, as Claude Design draws narrative n15: one column per entry across the list's box, in reading order (from the right in a
  right-to-left deck), each the figure bold in the accent at display size (at most the metric value size, 76 px) over an accent rule,
  its description as the label under it at the size the list draws its descriptions. The figures share one size, the smallest any of
  them fits on one line at, never under the list size; a figure that would split there, or a label that overflows its column, keeps the
  list. A list where only some entries lead with a figure, figures without descriptions, a numbered list, a list with icons, columns, a
  caption or the author's `listStyle` stay lists. The row is drawn at the size the list has after the guard and LH-48's growth, so its
  labels never read smaller than the list's descriptions; a region that holds only such a list has no card. It is a list in columns
  (`listColumns`, each entry `accent` and `heading`), which both engines draw natively. The guarded rule `figure-row`.
- **Pillars with one-word titles (LH-136).** A slide whose body is 2 to 5 lists of one entry each, a single word (at most 14
  characters) with its description, draws each as the word at display size (2.3 times the description's size, stepped down to one
  line and to the height the box leaves over the description) in bold over an accent rule of 0.14 em across the block (a native
  line in PowerPoint, `ListFit.rules` with `accent`), with no card. Sibling words read at one size. Any other set, a title of
  several words included, keeps its cards. fitList's `display` option (with `heading`) draws one list this way.
- **A lone timeline (LH-129)** in a template's timeline region, or an automatic slide's only block, first tries three and then two
  steps of the type scale on its labels (its 18 and 22 px roles to 28 and 32, or 24 and 28 px), and keeps the first at which it fits
  its box in the same arrangement and no label (the name, a date, an event) takes another line; otherwise it grows by LH-41's few
  pixels as before.
- **A lone code panel (LH-101)** grows its code in type-scale steps up to the code display size (32 px) while it covers at most
  60% of the body, and its panel hugs it in the middle of the body. Only code that covers at least 60% of the body takes the whole
  body, its lines in the middle of the panel (`layoutCode`'s `fill`).
- **A body of other kinds (LH-102).** A body of text, lists, quotes, metrics, code, tables or timelines (a picture only in a bled
  region, such as hero's media) that covers under 60% of the body height after its regions take their need sits in the middle
  of the space under the headings, as a body of paragraphs does, when it moves as one (a region the layout holds at the foot keeps
  the body where it is) and no block reads smaller. Pictures, charts and videos in other regions keep the layout's cells.
- **Mixed cards (LH-64).** A row of middle- or bottom-anchored cards with a table, code panel or timeline among other measured
  kinds starts at the card top (or hugs and centers in an under-filled body) instead of each kind at its own anchor.
- **Reading measure (LH-10).** A paragraph in a region wider than about 70 average characters of its size is set on that
  measure at the start edge, unless the body would then fill too much to grow: a readable size outranks the measure.

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
`two-column`. The release notes list the 36 built-ins.
