# Layout templates

A layout is **one ordered list of regions, declared once, in reading order.** Each region says how much of the slide it
takes (`size`), which content it accepts and how several blocks share it. The list has a `direction`: `row` puts the
regions side by side, left to right; `column` stacks them top to bottom. For two dimensions, an entry of the list can be
a **split**: a nested list that runs the other way. That is the whole format. There is no grid of cell names to keep in
step with a table of sizes and a table of rules.

A layout record (`https://openpresentation.org/schema/opf-layout/v2`) is an ordinary JSON object. The built-in layouts
and a deck's own layouts are records of this one schema; a custom layout is embedded under `catalogs.custom.layouts` (or
a named catalog group) and referenced by id like any other. This page is the reference for what core implements.

> The 38 built-in templates come from the matching `@openpresentation/gallery` package. Core and Gallery 5 use the region
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

`hero` nests the other way, with sizes: a row of a text column (the title, the lead and the body) and a
picture two thirds as wide, bled to the slide's edges. A heading region may sit inside a split.

```json
{
  "name": "Hero",
  "direction": "row",
  "regions": [
    { "direction": "column", "size": 3, "regions": [
      { "name": "title" },
      { "name": "lead", "size": "auto", "accepts": ["text", "quote", "metric"], "max": 1 },
      { "name": "body", "accepts": ["text", "list", "metric", "group"], "role": "supporting", "flow": "grid" }
    ] },
    { "name": "media", "size": 2, "accepts": ["image", "video"], "role": "media", "max": 1, "bleed": true }
  ]
}
```

| Field | Meaning |
| --- | --- |
| `direction` | `row` (side by side, left to right in reading order) or `column` (stacked, top to bottom). Default `column`. |
| `regions` | 1 to 12 entries in reading order, each a region or a split. |
| `anchor` | Vertical position of the content of every body region under the record (or split) that does not set its own. Inherited by body regions only, never by `title` or `subtitle`. Exception: on a column record whose entries are all `auto`, it places the whole stack (see Choosing an anchor). |
| `overflowRegion` | Where content no region accepts goes. Omitted: the first `primary` region that is not a single-block region (`max: 1`). |
| `design` | The layout's design defaults (below). |
| `composition` | Only `gap`, `padding`, `minFontSizePx` and `overflow`, with their 0.18 meaning. |

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
headings. Region names are unique across the whole record and may not be `tag`, `auto` or a cell word of the slide grid (`start`,
`center`, `end`, `top`, `middle`, `bottom`).

**Standard region names (OPF 0.35).** The built-in layouts name their body regions with seven words, so a pin reads the same on
every layout: `body` (the main content), `lead` (an opening block above the body), `aside` (supporting content beside or
under the body), `media` (a picture or video beside or behind the text), and `first`, `second` and `third` (parallel
columns). The heading regions are `title` and `subtitle`. A name is a label: binding goes by kind, role and reading order,
and composition reads no region name except the headings and one rule, the closing note of a layout whose body is parallel
columns (the `aside` under `comparison`'s `first` and `second`, LH-170). A custom record may name its regions anything
the rules below allow; the standard words are a convention, not a requirement. [Migrating to 0.35](migrations/0.35.md)
lists the 0.34 names of the built-ins.

### Regions

| Field | Values | Default |
| --- | --- | --- |
| `name` | lowercase kebab-case, unique in the record; a block's `region` names it | required |
| `size` | a number above 0 and up to 100, or `auto` (columns only) | 1 |
| `accepts` | `text`, `list`, `image`, `video`, `chart`, `table`, `code`, `metric`, `quote`, `timeline`, `diagram`, `group` | every body kind and `group` |
| `role` | `primary`, `media`, `supporting` | `primary` |
| `flow` | `auto`, `grid`, `row`, `column` (the words of `composition.mode`) | `auto` |
| `max` | 1 to 12; `1` is a single-block region (below) | 6 |
| `bleed` | boolean: outer edges on the content box reach the slide edge; never a card | `false` |
| `metrics` | `stack` (value, unit, label and the rest as one block at the anchor) or `tile` (LH-68: each metric fills its cell, label first as an eyebrow, description, delta and trend at the cell's foot, start-aligned; SCO-1: the value asks for 0.4 of the cell's height between 76 and 228 px and stands in the middle of the room between the label and the row's tallest foot, so the values of a row share one line and no tile has an empty middle; the gallery `scorecard` uses it) | `stack` |
| `arrangement` | What the region draws its content as. A sequence: `steps` or `numbered` (LH-07: the region lists the steps of a sequence, drawn under numbered badges joined by a connector, see [Step sequences](#step-sequences-lh-07); the gallery `process` uses `steps`, `agenda` uses `numbered`). A diagram of the region's lone list of one level: `pyramid`, `inverted-pyramid`, `matrix`, `cycle`, `chevrons`, `process`, `vertical-process`, `org-chart`, `hierarchy` or `venn` (SH-09, SH-18: `pyramid`, `matrix` and `cycle` draw as PowerPoint's Basic Pyramid, Basic Matrix or Basic Cycle geometry, exported as live SmartArt where PowerPoint draws it as the preview does, or as OPF's own design of the arrangement where PowerPoint's does not hold the entries; a matrix of other than four entries draws cards; see [Pyramids, matrices and live SmartArt](smartart.md); the gallery `pyramid`, `matrix` and `cycle` use them; SH-24: `inverted-pyramid` is the pyramid upside down, the widest level first and the tip at the bottom, the entries in their authored top-to-bottom order, exported as editable native shapes until a live SmartArt domain is measured (the gallery `inverted-pyramid`); SH-17: `chevrons` draws the list as PowerPoint's Basic Chevron Process, `process` as its Basic Process (boxes with arrows) and `vertical-process` as its Vertical Process, or OPF's own rows or columns of them, used by the gallery `chevrons` and `vertical-process` layouts (and by `process` for a short list of its `steps` region); SH-21: `org-chart` and `hierarchy` preserve a single-root tree through list-entry `level` (an org chart also places an entry with `assistant: true` beside the line below its manager), and `venn` holds one to seven flat set labels (and a last entry with `overlap: true` that labels their common overlap); malformed trees or labels that do not fit keep the complete list with a finding). One value per region: a region is a sequence or a diagram, never both | none |
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
(no primary region holds a block and nothing sits below the grid) and that has a title but no tag draws a short
accent rule, 80 by 5 px at a 720 px short edge, half a gap above the title at its start edge (the right in a right-to-left
title). A tag is the group's eyebrow and takes the rule's place. Both engines fill it in the tag's color: the primary, or the
text color where the primary is under 4.5:1 on the slide (`SlideComposition.titleRule`; the PPTX export writes a native
rectangle tagged `OPF_TITLE_RULE_V1`, which import consumes as the layout's drawing). The gallery `cover` and `section` use
both, with `titleAlignment` and `contentAlignment` `start`, so a display title sits low at the start edge as Claude
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
the whole stack, headings included, in the content box's leftover height: `middle` centers it, `bottom` sits it at the foot,
`top` (the default) starts it at the top. Empty optional regions collapse and take no space, so a title-only slide centers
the title alone.

```json
{ "id": "closing", "direction": "column", "anchor": "middle",
  "regions": [ { "name": "title" }, { "name": "body", "size": "auto", "accepts": ["text", "list", "image"], "flow": "auto" } ] }
```

The rule applies only to the record's own `anchor` on a column record with all-`auto` entries (an `auto` split counts as an
`auto` entry). A record with any numeric entry, a row record, and a split's own `anchor` keep the behavior above, so no
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
  content inside it, while a card carries a picture, a metric or a heading line (a labeled list item). P1: under `middle`, a row
  whose cards carry heading lines (labeled lists, with body text and no picture, quote or metric) hugs its tallest card instead, the content of every card
  starting on one line and the row centered in the region. A row of body text
  only (paragraphs and plain lists) does not (LH-64): when the tallest text fills under 45% of a filled card, the cards hug
  it with one height and the row centers in the region, since short text at the foot of a tall card reads as an empty card;
  a text shorter than the tallest sits in the middle of its card (COL-3); rows that all hug stack one gap apart. When the
  texts are longer and their heights more than 1.5x apart, the cards still fill: under a `bottom` anchor every text starts at
  the card's top, so a short text does not sit alone at a foot beside long ones; under `middle` each text is centered in its card.
- `top`: cards of measured blocks (text, lists, quotes, metrics) hug the tallest of their row, from the top, with one height
  per row (LH-04); a row with a picture, chart, table or group keeps cells the size of the region's share.

Long texts are drawn as full-width rows (LH-86). Side by side, two or three paragraphs of at least 80 characters read as narrow
columns of long lines, or as a short one in a wide card beside a long one in a narrow card when an empty region collapsed into it.
On a slide that draws cards, when the filled regions of a layout lie in one row and hold only such paragraphs (two or three, in
several regions or in one region's grid), every paragraph moves to the first region of that row in reading order. The other
regions are left empty and collapse into it, and that region stacks them one card per row across the row. The layout must have no
`row` region, the slide no composition of its own, and must have nothing beyond a region's room or below the grid. A layout whose
whole body is that one row of regions (`two-column`, `three-column`) is its columns: long texts stay columns there, and become rows
only when the rows overflow less, or as little with a larger fitted size (both arrangements are composed; columns never cost a size). The rule applies to one region's grid
(`pillars`, `scorecard`, `team`) and to a row of regions beside others in a layout; automatic composition (no layout) never uses it.

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
| `opf/layout-region` | error | A name used twice; a reserved region name; a heading region with content rules; a `subtitle` without a `title`; a region that accepts no kind; an `overflowRegion` that is not a body region. |

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
row of two regions inside a column puts one gap between the two columns, as the cell grid does. The built-in layouts
compile to exactly the grids they had in Gallery 4, so nothing they draw moved.

## Binding content to regions

Slide content stays flat. `bindRegions(slide, record)` (pure, on `/composition`) binds the slide's root nodes to regions,
in source order; placed images (`placement`) take their band and never occupy a region, and a content group is one node of
kind `group`.

1. **Pins.** A block with `region: "<name>"` goes to that region when it exists, accepts the block's kind and has room.
   Otherwise the pin is ignored (`opf/region-unknown`, `opf/region-kind`, `opf/region-full`, warnings) and the block
   joins step 2.
2. **Everything else.** Of the regions that accept the block and have room, the lowest role rank wins (pictures:
   media, primary, supporting; every other kind: primary, supporting, media), then the first in
   reading order (the order of the `regions` list, depth first). Then source order is kept across regions where the
   layout allows it (LH-122): a block drawn on the wrong side of another bound block moves to the equally ranked region
   that accepts it, has room and leaves it out of order with the fewest blocks, being drawn before a block it follows
   counting more than being drawn after one it precedes. The `timeline` layout has a `lead` region (text, auto height)
   between the title and the timeline's `body` and an `aside` after it, so a text authored before the timeline is its lead
   and one after it (or between two timelines) a note.
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
   notes (the `body` and the `aside`); on `chart`, 3 charts and 2 notes the same.
3. **Extra blocks join a region (LH-46).** A block no region had room for, on a layout with no overflow region, joins
   the region that accepts it instead of the row below the grid: a single-block region (`max: 1`) takes up to 6 blocks (accepted,
   no finding: the region then flows by its `flow`, `auto` by default); a flowing region takes up to 12, drawn beyond its `max` with
   `opf/layout-unplaced` as an overflow region draws them (so `paginate` can still move them).
   - single-block regions of one role side by side (the `first` and `second` columns of `comparison` or `two-column`)
     become one region of N cells: the first takes their blocks and any block bound between them in source order (the
     `aside`), and the others collapse into it. Four texts on `comparison` are a 2 x 2 grid in reading order.
   - A lone fixed region arranges pictures as a **mosaic** and text, quotes and metrics as a **lead plus cards**. A
     mosaic is 2 or 3 pictures in a row, and 4 to 6 a lead picture at full height beside the others in two rows (the
     lead as wide as two of their columns); a region taller than wide stacks 2 and sets a lead picture across the top of
     3 to 6. Mosaic pictures are cropped to fill (`cover`) unless the block, slide, deck or theme sets `imageFit` (the
     layout's own `contain` gives way). A lead plus cards is the first block across the region (a short one at the lead
     size) over the others in the balanced grid below, each row at the height it needs, placed by the region's anchor.
   - The closing's `body` region already flows, so its blocks join nothing; it takes the same lead plus cards (the
     guarded rule `closing-lead`). A layout whose one body region is a flowing `supporting` region, holding 3 to 6 plain
     texts that its `auto` flow would stack (a text too long for a cell of the balanced grid) and that read as neither
     paragraph columns (LH-70) nor a lead plus stack (LH-67), and whose other texts fill whole rows of the balanced grid (2, 3 or 4 of them, never a short last row), sets the first text, its call to action, across the region
     over the others in the balanced grid, as Claude Design draws a closing's details under its call to action. It is
     kept only when no text reads smaller and nothing more is found (the size guard).
   - The join is kept unless it overflows more than leaving the extra blocks below the grid (counting `text-overflow` and
     `small-cell`): measured blocks such as tables or timelines that need more room than the joined cells give stay below
     the grid with `opf/layout-unplaced`, where they read whole (three tables in `table-beside`'s narrow region broke their
     words).

An empty region collapses into a neighbor that shares the full length of one of its edges (start side, end side, below,
above; a body region before a heading region). A column of the grid that holds nothing but empty regions (and heading or
below-the-grid areas that span other columns too) gives way first (LH-65) when at least two columns with content remain, or
when its empty region has no neighbor to collapse into (a `hero`'s media column beside its stack of rows): it takes no width
and no gap, and the columns left share the width by their own sizes, so two blocks in `three-column` draw 1:1 instead of one
column beside a neighbor that took the third column's width too. The empty region reports `collapsed` and a zero-wide cell where
its column was. The column, and a nested group's new default gap (LH-89), are kept only when no block reads smaller than with
the columns and gaps of before (unless that removes overflow). Headings are centered vertically in their region unless every
row it spans is `auto`, so a `cover` or a title-only slide centers its title. A block's cell word (`start`, `top:start`, ...; the
cells of a slide without a layout) names no region of a layout: `opf/region-unknown`, and the block binds by kind. Through 0.34
the cells composed such a slide and the layout's regions were not used, though its design, color variant and composition still
applied; `opf fix` removes the layout and keeps those on the slide when it then draws the same (docs/migrations/0.35.md).

In the Markdown dialect, `<!-- block: region=aside -->` pins a block; `region=top:start` names a cell on a slide without a layout.

## Flow

| `flow` | Blocks are arranged |
| --- | --- |
| `auto` | `grid` unless a block is long: more than 6 lines (code: 12, table: 6 rows) in its grid cell at the starting size (28 px for prose), counted with core's estimate, never a host font. In an `auto` region a paragraph that wraps takes a reading measure of about 70 average characters of its size (never at the cost of size; it follows the content alignment) and a lone block of up to two lines uses the 32 px lead size. |
| `grid` | By count: 1 fills; 2, 3 in a row; 4 as 2 x 2; 5 as 3 + 2; 6 as 3 x 2; 7 to 12 in balanced rows of at most four (7 as 4 + 3, 8 as 4 + 4, 9 as 3 x 3, 10 as 4 + 3 + 3; LH-47: no row is more than one cell short of another). Rows and columns swap in a portrait region (7 as 3 + 2 + 2). The cells of a short row stretch to the full width; in a grid of only pictures and videos they keep the full rows' size, one aspect, and are centered. |
| `row` | Side by side in one row, one cell each at equal widths in reading order: the counterpart of `column` (and of `composition.mode: "row"`). The row is kept as written: no paragraph columns, lead block, list grid or regrouping replaces it. The gallery `process` layout draws its steps in a `row` region. |
| `column` | Stacked at the heights the blocks need, one gap apart, and placed by the region's `anchor`. Charts, pictures, videos and diagrams take what the measured blocks (text, lists, quotes, metrics, code, timelines, tables) leave; a table (LH-44) needs its rows at the starting size, gives up height down to its rows at the floor and takes a share of any spare height. Blocks that do not fit share the region: each gives up the same fraction of what it can give up above its height at the minimum font size. A group's blocks in one column stack the same way. |

**A region of one block (`max: 1`).** A region that holds one block says `max: 1`. Its block fills it. On a layout with no overflow region, blocks no region had room for still join the single-block region that accepts them, up to 6, without a finding, and then flow by its `flow` (`auto` unless set); single-block regions of one role side by side (the columns of `comparison`) share their joined blocks as one region of N cells. A single-block region is never the default `overflowRegion`, nor the region a slide's own `composition` arranges, and its block does not take the lead size of an `auto` region.

Several timelines in one region are a stack of horizontal bands whatever the region's `flow`: one column, or two when one column does not fit at the readability floor (see [Dynamic composition](dynamic-composition.md#timeline-internals)).

A slide's own `composition.mode`, `columns` and `weights` arrange its first primary region that is not a single-block region,
with the 0.18 modes, above its `flow` (OPF 0.35 removed `design.contentDirection`: a region says `row` or `column` itself). A list in a region
without an `arrangement`, or with the `numbered` one (OPF 0.35: the lone list of the region, and, since the RR-81 review, any list of
the region that does not fit its own cell), or any list payload with `columns: "auto"`, tries 1, 2 then 3 columns at the starting
size (a column at least a quarter of the slide wide); `columns: 2` or `3` fixes the count, and `columns: 1` keeps one column. A
region's columns are kept only when they set the list at least as large as one column of the same cell would (a region whose first
accepted kind is `list` keeps LH-184's reading measure: columns up to a type-scale step under one column whose lines would run past
it), and columns that overflow give way to one column that fits (in a list region, one at least as large). `auto` never deals a
list of 6 or fewer entries across columns (LH-42): such a list shrinks in its one column instead. The columns keep the entries as even as
they can, the first columns the longer on a tie (7 entries as 4 + 3), and under a `middle` or `bottom` anchor they stand at the anchor as one
block, as tall as the tallest column (C09: the gallery `agenda` centers its columns as it centers a short agenda). A region with a diagram or the
`steps` arrangement keeps its list in one column.

**Several lists in a region (LH-42).** A region whose flow is not `row` that
receives 2 or more lists and nothing else lays them out one list per cell, a card when the slide draws cards, so sibling
lists never read as one table: 2 to 4 lists in that many columns, a multiple of 3 in 3 columns, any other count in 4
(7 as 4 + 3), in balanced rows, so no row is more than one list short of another (5 as 3 + 2, 10 as 4 + 3 + 3). A column stays at least 7.5 list ems (240 px) wide; a narrower region fills its rows evenly (4 lists in 2 x 2),
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

A block that shrinks takes a size of the type scale (LH-17): from `minFontSizePx` up by a ratio of (28/16)^¼, rounded to whole
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
uses the design's tools in order: text fits down to `minFontSizePx`, lists flow into columns where the region allows, blocks
beyond the room go to the overflow region and, through `paginate`, to a continuation slide; what remains is the
`opf/text-overflow` or `opf/layout-unplaced` diagnostic.

Pagination continues on a new slide with the same layout: blocks beyond a region's `max` move first, in source order, and
carry a `region` pin to the region they came from. The pages of one slide share its type sizes (LH-144): each page after the
first carries `composition.maxFontSizePx`, the largest size the first page draws for the kinds of block it holds (paragraphs,
lists, quotes, metrics, timelines), so a last page with one timeline or a short list does not read larger than the pages before
it. The cap only lowers sizes, never under `minFontSizePx`; headings, tables, code and charts keep theirs. A block that no region of the layout accepts, on a layout with no
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
`titlePosition`, `contentAlignment`, `contentBox`, `imageFit`, `listBullet`, `listStyle`), the layout's `design`, then the engine
default. `design.mirror: true` draws a template mirrored (each row's cells and the column sizes reversed); a right-to-left
deck mirrors on top.

`design.titlePosition` (OPF 0.35) is `top` (the default: the heading group above the body) or `start`: the heading group
beside the body, in a column of two fifths of the content width (`TITLE_BESIDE_SHARE`, 2 : 3) on the reading side, centered
down the column at its role size. On a template the rows that hold only headings give way and the title column runs down
beside the body regions (`titleBesideTemplate`), which keep their own grid; a `subtitle` region joins the title's group, a
record without a title region gets the column for the slide's title, and blocks no region takes still sit below, across
the slide. The column is a column of the template, so a right-to-left deck draws it at the right and `design.mirror` swaps
it. A record whose title already shares a row with a body region keeps its own placement. An automatic slide puts its
headings in the same column and composes its body beside it (`mirror` swaps that column too). A cover (no body), a slide
whose blocks are in cells and a portrait canvas keep the title on top, and so does a slide that LH-83 recomposes as the
automatic grid (the recomposition exists to set its text larger, so its body takes the column's width). The gallery's `cycle`, `matrix` and `vertical-process` are column records (title over
body) whose `design` sets `titlePosition: "start"`; an `agenda` slide with `titlePosition: "start"` draws a short agenda
beside its title. A slide without `layout` is composed automatically.

## Composition output

For a slide with a template layout, `composeSlide` adds (see the declarations on `/composition`):

| Field | Meaning |
| --- | --- |
| `regions` | Every region in reading order: `name`, `box` (after collapse, mirroring and bleed), `accepts`, `role`, `flow`, `max`, `anchor`, `arrangement` (`grid`, `row`, `column`, or `composition`), `content` (root block paths bound within `max`), `overflow` (paths drawn beyond it), `collapsed`, `bleed` and, on a bled region, `areaBox` (its cell before bleed). It replaces `slots` for templates. |
| `headingAreas` | The `title` (and `subtitle`) areas with their boxes, `collapsed` or `implicit`. On a template without a `subtitle` area the title area carries `parts: { title, subtitle }`: it is split where the stacked heading group puts the subtitle, so `title` runs from the area's top to the bottom of the title (the tag above it included) and `subtitle` from the subtitle's top (half a gap under the title when the slide has none) to the area's bottom. PowerPoint's `ctrTitle` and `subTitle` placeholders use these boxes. |
| `items[].region` | The region an item was drawn in, for tagging shapes. |
| `steps` | LH-07: what each `steps` or `numbered` region draws besides its text, in reading order: `form` (`row`, `column` or `tiles`), `badges` (`cx`, `cy`, `radius`, `label`, `fontSize`, `baseline`, and `list` when the badge draws a list entry's own number), `connector` (`x1`, `y1`, `x2`, `y2`), `chips` of tiles, and `lineWidth`. |
| `items[].listColumns` | A list in columns: one `{ box, start, end, text }` per column at one shared size; numbering continues. The item's `text` is the whole list (every entry at its column's position), so a consumer that ignores `listColumns` still draws every item. Entry paths are the payload's: `<list>.<n>` for a string item, `<list>.<n>.text` for an object. |

### Step sequences (LH-07)

A region whose `arrangement` is `steps` or `numbered` lists the steps of a sequence, and composition draws them as Claude Design does:

- **Steps side by side** (`steps`): two or more text or list blocks are the steps. Each draws under a numbered badge, an accent circle
  1.75 times the step text across with its numeral at the step text size, in the scheme color readable on the accent. The badge sits
  0.4 of its width above the text, at the block's start (its right edge in a right-to-left deck), or over its middle when the block is
  centered. The badges of a row share one line, and a connector in the border color runs through their centers. A one-entry numbered
  list gives its badge its number and draws as a heading over its description (LH-77), and as a heading without one when another step
  of the region has one (PR2), so the row reads alike; any other block is numbered by its position.
  Each block keeps the band for its badge in the height it asks for and in its cell.
- **A list's entries** (`steps` for a lone list of two or more entries, `numbered` for every list of two or more entries of one level,
  numbered or not, since an agenda runs in time): each entry draws beside its
  badge in the list's marker column (the side its paragraph starts), centered on its first line, with a connector down the column. The
  badges are at least 0.4 of their width apart. The list keeps its numbers (`marker.number`); a list without `numbering` is counted in
  arabic as drawing only: the document keeps no numbering and the PPTX import gives the list back unnumbered. In a `numbered`
  region the unnumbered lists count on from one list to the next, as one agenda, and keep their markers when one of the region's
  lists cannot take badges (a lone entry, nested entries), so a part of the agenda is never numbered alone.
- **A row of a list's steps** (`steps`, PR1): a lone list of 2 to 5 entries of one level (no icons) that is not Basic Process draws
  as the row its steps make when written as separate blocks: one column per entry across the region, a badge over each at its start,
  the connector through the badges, the entries under them and the row in the middle of the region, at the list's size or larger (up
  to 56 px, each grown entry on at most three lines of whole words). Columns narrower than six ems of that size keep the badges down the side, as above.
- **Basic Process** (`steps`, OPF 0.35): a lone list of 2 to 8 entries of one level, each of one or two words (24 characters at most),
  without numbering, descriptions or icons, draws as the `process` arrangement (PowerPoint's Basic Process: boxes joined by arrows, see
  [SmartArt](smartart.md)) in the region's whole cell, when the process holds every entry at the size its steps would have or larger;
  otherwise it draws as steps. The gallery's `process` layout draws a short list this way.
- **Numbered rows** (`numbered`, LH-134): an agenda whose every entry, in every list of the region, has a description draws as ruled
  rows instead of badges: each number a numeral at the list size, bold in the accent and in two digits under 10 ("01"), in a column at
  the row's start (the right in a right-to-left list), the label bold and the description in a second column beside it when the labels
  fit 40% of the width, a hairline between two rows and no connector. One entry without a description keeps every list of the agenda
  beside badges, so an agenda is drawn one way. The numbers stay drawing, as the badges' are.

Steps keep their text size: the badges are a guarded rule (`step-badges`, and `numerals` for numbered rows), so a slide whose blocks
would get smaller under them draws as before (LH-168: the comparison is also of the smallest size each block draws, a list's label and description
sizes, not of the list's base size, which is the label's in columns and the description's beside a badge; steps whose descriptions wrap
draw as a stepper in every language, and a row of steps is centered under the title as the columns are). A step's label never splits a word (LH-173): a label whose widest word does not fit its column at 1.25 times the list size steps down to the size the word fits at, never under the list size, and the labels of the row take that size too; LH-48's growth stops at the step before one that breaks a word of any label or description. A flow that does not fit one line at the list's size stays a list. A lone badge list
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
  a quote 56, code 32, a metric's value 152, a table 32, at a 720-pixel short edge). A plain list that reaches its display
  size and still fills under half of the body grows on, as a body of several short blocks does (LH-102), by the scale's steps
  while it fills at most 60% and every entry stays on one line: one to three entries up to 56 px, four or five up to 49 px, more none
  (`SPARSE_LIST_DISPLAY`); a list with descriptions, drawn as ruled rows, beside
  numerals, with badges or icons, or in a region with an arrangement keeps its size. The block then sits in the middle of
  the body, its card hugging it; a grown table's rows grow with its type (`items[].tableGrowth`, which both engines pass to
  `layoutTable`). A block that fills half the body or more keeps its sizes; a paragraph or list that fills at most 60% of it
  sits in its middle, any more keeps its place.
- **A body of paragraphs and lists.** Two or more text and list blocks (in a layout's regions, or on a slide without a layout)
  that fill under half of the body below the headings (the height their text covers, so the empty space inside cards that share
  the body, as LH-86's rows, does not count), with nothing overflowing and no text at the floor, are composed again one, two or three type-scale steps larger (each up to a
  list's display size, 37 px), and the largest step that adds no finding, sets every block larger and fills at most 60%
  is kept; siblings keep one size (LH-43) and no block reads smaller than before. A body that still fills under half after
  those steps grows on (LH-102), on a layout as on a slide without one, by the scale's steps up to 56 px while every block
  keeps its place, nothing overflows and it fills at most 60% (a body of texts of at most four words each up to 75 px, so two
  short lines of a `text` slide grow together toward the size one reaches); on a layout its paragraphs keep one size, and
  its lists one size, there too. A layout whose regions may draw their content (a sequence's badges, a diagram) keeps the
  three steps. On a layout the body then sits in the
  middle of the space under the headings: rows that hug
  their content move down, regions take the height their blocks need in the middle of their cells, and cards hug their
  text (LH-64's hug, whatever it fills of a card).
- **A table and the note under it** (a `table` layout's body and aside, TAB-1). The pair grows as a body of paragraphs does, the
  table by the scale's ratio up to its display size and its rows with it, while it covers under three quarters of the body and to
  at most three quarters (`TABLE_NOTE_GROWN_TARGET`, the target of LH-75's pair beside each other), so a third row or a longer note
  keeps the size the two-row table grew to instead of dropping to the role sizes. A pair that already covers half the body or more
  keeps its place unless it grows.
  A table beside its aside (`table-beside`, TAB-2) grows the same way: a note or a list grows with it, a metric or a quote (set
  larger than the table already) keeps its size, and the table and its aside start on one line.
  A table on a column's card grows the same way with the texts on the cards beside it (COL-2, every block on its card). A table that
  does not fit its column at its starting size (a four-column table in a third of the slide) first takes the width it needs, as an
  automatic slide's table does (LH-44: its natural width, at most 65% of the row, at least its minimum), while the columns beside it hold
  only texts and lists that read no worse in what is left.
- **Never grown by these two rules.** A stacked record (`statement`, `quote`, `closing`, which place their message as one stack, a closing at the foot (LH-155), and grow by
  LH-129's rule below), blocks below
  the grid (a section's notes), a body with a picture, chart, video or timeline beside its text, a captioned block, a
  list in columns, an overflowing composition, and `composeSlide(slide, { fill: false })`, for hosts and tests of the
  role sizes. Both engines read the result from core. A plain text or list beside a layout's one chart or picture is the
  exception (LH-193): beside a chart, or a picture in a `media` region, and alone in its region (or each of several texts
  alone in a one-block region, the columns of `three-column`, which keep their whole cards with the text in the middle) it
  grows as a lone block of its cell, so "Look here." beside a picture and two short texts beside a
  chart take display size as one text beside a chart already did; a text sharing a region with another text (a `hero`'s
  lead over its body) keeps its size.
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
  on at most 4 balanced lines, and (RR-105) only to a step whose lines keep the minimum measure of LH-66 (28 average characters once it runs to 4 lines), so on a narrow slide, portrait or square, it stops one step lower (49 px) instead of falling back to its plain size; its bold runs draw in the primary color where that reads 4.5:1. A lone one-entry list with a short
  label draws it as a display word over a short rule; a placed region's short text is a bold heading, drawn as a tile when it is no
  sentence (see [Placed tiles](dynamic-composition.md), `placed-tiles`). Guarded rules
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
- **A lone timeline (LH-129, TLN-1)** in a template's `body` region, or an automatic slide's only block, that draws as a band or
  alternating labels first grows in proportion (`sizeScale`): every role by one factor, its `what` labels up through the type scale
  to 56 px (the size a short row of headings takes), largest first, kept at the first that fits its box in the same arrangement with
  every word whole, no date or name on another line and a `what` label on at most two lines. Its markers, the gaps around them and
  its connector (`TimelineLayout.lineWidth`) grow with it, and it sits in the middle of its box. Otherwise it tries two or three
  steps of the type scale (to 28 and 32, or 24 and 28 px) with every label on its line, then LH-41's few pixels. A lead and a note
  keep their places above and below it.
- **A lone code panel (LH-101)** grows its code in type-scale steps up to the code display size (32 px) while it covers at most
  60% of the body, and its panel hugs it in the middle of the body. Only code that covers at least 60% of the body takes the whole
  body, its lines in the middle of the panel (`layoutCode`'s `fill`).
- **A body of other kinds (LH-102).** A body of text, lists, quotes, metrics, code, tables or timelines (a picture only in a bled
  region, such as hero's media) that covers under 60% of the body height after its regions take their need sits in the middle
  of the space under the headings, as a body of paragraphs does, when it moves as one (a region the layout holds at the foot keeps
  the body where it is) and no block reads smaller. Pictures, charts and videos in other regions keep the layout's cells.
  Without a layout, a short body of paragraphs and lists that still covers under half of the body after LH-48's three steps
  grows on past a list's display size, as LH-05's compact grid does: step by step up to 56 px, each step larger, nothing
  overflowing, at most 60% of the body covered, the body keeping its rows and columns (a body that may draw step badges or
  cards keeps the three steps, so those drawings are held to the same body). The stack then sits in the middle of the body under the headings, rather than
  at its top over an empty foot. Cells that
  each run the body's full height (`start`, `center+end`) and hold only paragraphs and lists set them as one band in the
  middle of the body, each block starting at the band's top. Both are composed with LH-48's centering and kept only when
  no block reads smaller and nothing overflows.
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

**Before the floor (LH-186).** A template's composition that sets a paragraph, list or table more than one step of the type scale
(16, 17, 18, 20, 21, 23, 24, 26, 28, 30, 32 px) under its role size (28 px prose, 32 px lists, 25 px table cells, each held to
`composition.maxFontSizePx`), but above the floor, is composed as the automatic grid too, under the guarded rule `layout-first`. That
result is kept (`recomposed`) only when it adds no finding, sets no block smaller, reads as well (no more split words, no prose
under the minimum measure) and sets the most shrunk block at least one step larger: an agenda's two lists that the agenda layout
with its title beside them (`titlePosition: "start"`) sets at 18 px read at 32 px across the slide. A text run with its own `fontSize`, a block pinned to a
region, `recompose: false` and `fill: false` keep the layout. So composition grows short content to fill, changes the arrangement
(columns, the automatic grid, another design) before it sets text smaller, and fits dense content that no arrangement holds down
the type scale to the readability floor, never below it, flagging what still does not fit.

- **Body roles.** Text, lists and table cells, and the main part of the other payloads: a quote's and a code panel's body, a
  metric's value and label, and a timeline event's `what`. The other parts (attribution, filename, language, unit, delta,
  description, trend, a timeline's name, dates and notes) ask for 14 to 20 px by design, so reaching the floor is no squeeze
  and never triggers it. Headings are not body. The floor is the composition's `minFontSizePx` (16 reference pixels at a
  720-pixel short edge, 12 pt).
- **What stays.** Every block is drawn, in source order. The header and footer bands, the footnote area, placed images and
  the background are the slide's own and do not change. The layout record's `design` (alignment, cards, list bullet, image
  fit, background variant) and `composition` (padding, gap, `minFontSizePx`) still apply. The slide keeps its `layout`, so
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
  `dashboard`) keeps its proportions: only the plot's height triggers it. chart-beside with its `aside` holding further charts
  (a few pixels of plot each) becomes the automatic grid of charts above their notes.
- **Never recomposed.** A slide the layout fits above the floor, a cover, a slide with a block
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
`two-column`. The release notes list the 38 built-ins.
