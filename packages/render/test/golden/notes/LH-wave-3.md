# LH wave 3: fill, splits, media tracks, measure, emphasis, continuation, chart follow-ups

Wave 3 of the layout harvest merges eight reviewed branches into one, on top of wave 2 (opf#976): LH-92, LH-93 and LH-95 (opf#978), LH-90 and LH-91 (opf#979), LH-70, LH-72, LH-67 and LH-78 (opf#980), LH-06 and LH-68 (opf#981), LH-52, LH-71 and LH-86 (opf#985), LH-80, LH-49 and LH-66 (opf#986), LH-48, LH-65 and LH-89 (opf#987), LH-105 (opf#990). Each branch's PR body explains its change; this note records the combined baseline and the rules the integration added where two features meet.

## Template baseline (`layout-templates-rr96-color-variants.json`)

`node test/layout-template-goldens.mjs --update`, reviewed sheet by sheet (7 sheets, and 2 more after opf#990 merged), then `--promote`d.

- **162 of wave 2's 469 slides moved**; no page is new or gone (469 slides).
- By template: section 6, agenda 4, agenda-split 1, statement 6, closing 6, text 9, list 4, two-column 11, three-column 11, pillars 9, comparison 10, timeline 3, faq 4, metrics 8, scorecard 12, image-beside 3, chart 12, chart-beside 12, table 6, table-beside 4, code 3, hero 6, dashboard 12 (8 of them paginated pages).
- Attribution (most slides carry more than one change):

| Feature | What moved |
| --- | --- |
| LH-48, LH-65, LH-89 (fill, empty columns, nested gaps) | The short samples of agenda, text, list, two-column, three-column, pillars, comparison, faq, metrics, scorecard, image-beside, table, table-beside, code and hero: a lone block or an under-filled body grows in type-scale steps and centers, cards hug it; an empty column gives way (two blocks in three-column draw 1:1, hero's empty media column); lone paginated pages (table, timeline, code) grow and center. |
| LH-70, LH-72 (paragraph columns, centered layouts) | Section, statement and closing with long text: start-aligned in a measure-capped column; statement 5 and 6 long as two equal columns. |
| LH-86 (long texts as rows) | Two-column, three-column and pillars with 2, 3, 5 and 6 long texts: one card per row across the region, sharing its height. |
| LH-06, LH-68 (emphasis, tiles) | Every scorecard sample: metrics as tiles (value under its label from the top of the card). A short last text after longer blocks as a foot band (metrics, timeline, chart, chart-beside, table, table-beside and code with 2 short blocks). |
| LH-95, LH-93, LH-105 (emphasis by shade, plot height, Few defaults) | Chart, chart-beside and dashboard (36 slides): the last bar of a small column chart over quarters (categories in time) is a lighter shade on the navy default; the series are softened, no chart draws a panel, and the value axis has at most six intervals. |
| LH-49 (chart track and recomposition) | chart-beside 3 and 6 long recompose as the automatic grid for their charts (plots of 111 and 38 px become 227 and 117 px), charts above their notes. |

## Rules the integration added

- **One size guard.** Every wave 3 rule that rearranges or resizes blocks (LH-89, LH-65, LH-72's measure column, LH-78, LH-06's automatic band or pill, LH-68, LH-86, LH-66, LH-67, LH-70) is held to one guard in `composeSlide`: the slide is composed once with all of them, and only when one changed something is it composed without them, so that no block's fitted body size goes below what it is without the rules unless that leaves fewer findings, never below the floor. The branches each had their own re-composition; together they composed a slide up to about 2.5 times wave 2's time, the one guard (with line breaks reused across a slide's compositions) about 1.4 times.
- **Settling under the guard.** LH-48's body growth, LH-49 and LH-83's recompositions and LH-80 and LH-49's tracks are each composed with the rules that read well in that arrangement, and kept only when they read as well as the guarded composition.
- **Where features meet.** Paragraph columns and a lead plus stack keep their own cells (LH-52 centers only the scored grid or LH-71's row; LH-48 does not grow them); a quote beside another block in a centered split takes its own card in the middle of its cell (LH-78 with LH-52); long texts LH-86 moved into one region keep their rows; LH-06's band or pill takes precedence over LH-48's growth of the same blocks; a chart LH-71 stacks above a short takeaway with a plot wider than 3:1 takes LH-49's filling track.

## Reviewed and left as they are

- `hero 2 short`: the lead text sits at the top and the support text in the middle of its row, both at 37 px, as opf#987 composed it (the hero's empty media column gave way).
- `scorecard 1 short`: a lone tile hugs its value at the top of the body rather than in the middle (LH-68's tile with LH-48's lone block).
- `three-column 5 and 6 long`, `two-column 5 and 6 long`, `text 6 long`: five and six long paragraphs read as full-width rows at the size wave 2 gave them; their lines run past 65 characters (a prose measure cap is LH-10).
- `chart 4 to 6 long` and `dashboard 5 and 6 long`: the plots stay short in their regions; LH-49 recomposes a template only for a plot under its minimum height, and these are wide chart regions drawn on purpose.

## Example corpus

The `golden` workflow must regenerate `test/golden.mjs` and `test/golden-gate.mjs`. The constituent PRs list their own moves: opf#990 157 baselines, opf#978 20 slides in 14 decks, opf#980 3 slides in 2 decks, opf#981 every example slide with a scorecard or an automatic band or pill, opf#985 the automatic splits under 55% fill, tables beside text and long paragraphs in two-column, three-column and pillars cards, opf#986 `technical/layout-sampler` slide 38, opf#987 273 raster baselines. The combined set is their union plus the slides the integration rules move.
