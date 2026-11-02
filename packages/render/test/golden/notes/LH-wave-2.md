# LH wave 2: grouping, sibling sizes, recomposition, chart layer and fallbacks, layout variants, breaks and crops, scheme contrast

Wave 2 of the layout harvest merges eight reviewed branches into one, on top of wave 1 (opf#967): LH-87 and LH-88 (opf#968), LH-11 and LH-84 (opf#971), LH-01 (opf#970), LH-60, LH-56, LH-33 and LH-35 (opf#975), LH-03 and LH-81 (opf#973), LH-58, LH-82, LH-73, LH-46 and LH-47 (opf#974), LH-43 and LH-17 (opf#969), LH-83 (opf#972). Each branch's PR body explains its change; this note records the combined baseline and the rules the integration added where two features meet.

## Template baseline (`layout-templates-rr96-color-variants.json`)

`node test/layout-template-goldens.mjs --update`, reviewed sheet by sheet (9 sheets), then `--promote`d.

- **205 of wave 1's 521 slides moved**, and 52 paginated pages are gone (469 slides). No page is new. The pages that are gone belong to slides that now fit on one slide: the extra blocks of statement, quote, image-beside, chart-beside and hero join a region (LH-46) instead of a strip that overflowed, and agenda-split, process, timeline, faq and table slides at the floor are recomposed as the automatic grid (LH-83) without overflow.
- A moved slide is attributed to a feature when that feature's branch moved its core composition golden (`template-goldens-0.19.json`), or, for the render-only changes, by template (LH-01 colours: section, statement, quote, closing; the chart layer and shared axes: chart, chart-beside, dashboard). Most slides carry more than one change, so the counts overlap:

| Feature | Slides | What moved |
| --- | --- | --- |
| LH-58, LH-82, LH-73, LH-46, LH-47 (grouping) | 117 | Repeated pairs share a cell; a metric or chart grid keeps one kind with the others in a row under it; extra blocks join a fixed region (cover and image mosaics, two-column and comparison as one region of N cells, statement as a lead over cards); grids have balanced rows and a stretched short last row. |
| LH-01 (layout variants) | 48 | Section on accent1; statement and quote on `surface`, closing on `brand`. The fixture deck is on dark2, so `surface` and `brand` are dark1 (black) here. |
| LH-43, LH-17 (sibling sizes, type scale) | 39 | Sibling text and lists share one size, chosen from the type scale with jointly sized rows. |
| LH-03, LH-81, LH-33 (chart layer, shared axes) | 36 | Header row (caption "Revenue by quarter"), value labels and no value axis or panel on the small column charts, one value axis across sibling charts. The dark deck leaves no room for the last-bar emphasis tint, so it does not show here. |
| LH-83 (recomposition at the floor) | 24 | Agenda-split 2 to 4 long, process and timeline 3 long, tables and hero 6: the automatic grid, headings above the body. |
| Combined only | 14 | agenda 2 long, text 4 long, list 2 long, process 5 and 6 long, timeline 4 and 5 long, faq 2 and 5 long, table 2 long and the four pages of `paginated agenda-split 5 long`: no single branch moved their core geometry. They move from the integration rules below (process and timeline 5 and 6 long now recompose), LH-11's no-break number and unit, and the shared sizes under the renderer's bundled fonts. |

LH-60, LH-56, LH-35 (chart fallbacks, mark-label contrast, lightness check), LH-11 and LH-84 (breaks and crops) and LH-87/LH-88 (gallery schemes and examples) move no template slide by themselves: the template samples use column charts, no portrait pictures, and the engine's default scheme.

## Rules the integration added

- **The chart layer follows the drawn construct (LH-03 with LH-60).** Composition decides the layer for the type and data `chartDrawPlan` draws, so a world map over categories that are not places, drawn as columns, takes a column chart's header row and small-chart labels in both engines. Rings, boxes and a scatter by position are not covered by the layer and draw as before.
- **Small charts share the axis scale (LH-03 with LH-33).** A small chart keeps a value axis in composition (hidden when drawn); sibling charts share it, so the bars of two small charts compare even without an axis.
- **A majority band is measured as a grid (LH-58 with LH-47).** The automatic composition's majority grid (`groupRoot`) is measured as the balanced grid it draws, each row as tall as its tallest block in its cell, not as a stack. Measured as a stack it asked for every block's height and squeezed the row of other blocks to its floor (three code panels over two texts: two `small-cell` and a `text-overflow`, now none).
- **Joint rows on balanced grids (LH-43 with LH-47).** A grid of text and lists sized jointly takes LH-47's balanced rows and a stretched short last row before its rows are sized; a joined layout (LH-46, LH-82) keeps its own cells; list grids keep LH-42's shape.
- **Recomposition when it fits more (LH-83 with LH-43).** Sibling sets now share one size, so an automatic grid that fits everything at the floor no longer shows a larger smallest size than an overfull layout. The recomposition is now also kept when its smallest body size is as large and it reports less overflow (still never more overflow nor more split words). This recomposes agenda-split 3 long, process and timeline 5 and 6 long, and b13 s29's code layout (three panels in a row, no finding).

## Reviewed and left as they are

- `paginated agenda-split 5 long`: page 1 is recomposed (headings above the body) and pages 2 to 4 keep the layout, because only page 1 reaches the floor. Each page is valid; a paginated slide that recomposes its first page could recompose all of them (follow-up).
- `quote 5 long`: the two rows of quotes keep two sizes (18 and 22 px): LH-43 shares text, lists and metrics, not quotes.
- `metrics 5 short`: the notes row sits at the foot of the slide, as LH-58 placed it.
- `table 6 long` and `table-beside 6 long` with cards: the table and text pairs still overflow, with their findings, as on wave 1.

## Example corpus

The `golden` workflow must regenerate `test/golden.mjs` and `test/golden-gate.mjs`. The constituent PRs list their own moves: LH-88 regenerated all 100 generated gallery decks and LH-87 recolours every deck that embeds a changed scheme; LH-60 moves 33 chart slides, LH-03 93 baselines, LH-43 27, LH-01 the layout sampler's slides 2, 5, 6 and 9; LH-11 and LH-84 decks with a portrait cover picture or a number and unit at a line end. The combined set is their union plus the slides the integration rules move.
