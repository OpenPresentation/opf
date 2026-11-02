# LH wave 1: charts, cards, overflow, lists, tables, timelines, dark surfaces, titles

Wave 1 of the layout harvest merges eight reviewed branches into one: LH-59 (opf#951), LH-64 and LH-04 (opf#956), LH-40 and LH-45 (opf#962), LH-42, LH-77 and LH-85 (opf#959), LH-44 (opf#960), LH-41 (opf#961), LH-54, LH-55 and LH-79 (opf#958), LH-51 and LH-76 (opf#957). Each branch's own note or PR body explains its change; this note records the combined baseline. Gallery records are unchanged; they draw differently through core.

## Template baseline (`layout-templates-rr96-color-variants.json`)

`node test/layout-template-goldens.mjs --update`, reviewed sheet by sheet, then `--promote`d. Main's own build reproduced main's baseline byte-for-byte in the same environment (Windows, Node 26, bundled fonts, 545 slides), so the moved hashes come from the merged changes, not the platform.

- **441 of main's slides moved**, 25 paginated pages are gone and 1 is new (521 slides, was 545). The pages that are gone belong to slides that now need fewer pages: `agenda-split 6 short`, `timeline 3 long` and `hero 5 long` now fit on one slide, `two-column 6 long` and `comparison 6 long` no longer overflow their text (their extra blocks stay `layout-unplaced`, which pagination does not split), and some overfull agenda, list, process, timeline, faq, table, code and hero slides paginate into fewer pages. `paginated chart-beside 6 long` gains a page 3 (see below).
- A moved slide is attributed to a feature when that feature's branch moved it: its core composition golden (`template-goldens-0.19.json`) or, for the colour and chart changes, its promoted render baseline. Most slides carry more than one change, so the counts overlap:

| Feature | Slides | What moved |
| --- | --- | --- |
| LH-54, LH-55, LH-79 (dark surfaces) | 331 | Colour only: carded slides fill `#172C52` with a `#334567` stroke; metric values in cards lift to `#489CD3`; code panels `#01112E`; dark chart series 2 is `#93BEE7`. |
| LH-51, LH-76 (one-line titles) | 262 | Every "long" sample (its title is "<Name>: a longer title that may need a second line on the slide") splits at the colon: the topic on one line at 54 px and the qualifier at 28 px. Covers, sections, statement, quote, closing and agenda-split keep the wrapped title. |
| LH-64, LH-04 (card anchoring) | 117 | Body-text cards in middle/bottom regions hug a short text and centre; unequal texts start at the card top; top-anchored cards hug their content. |
| LH-42, LH-77, LH-85 (lists) | 96 | Several lists in one region draw one list (or card) per cell; short lists are never dealt across columns; level-1 markers are an en dash. |
| LH-41 (timelines) | 39 | Timelines are horizontal bands; several stack in one region, compact from four; the lone timeline is a band too (`process 1 short`, `timeline 1 short`). |
| LH-44 (tables) | 24 | Rows keep their floor; stacked tables get their measured height; `table-beside`'s lower row gets the table's measured height. |
| LH-59 (charts) | 23 | Short value axes end within 1.25 times the data (chart, chart-beside and dashboard column charts). |

LH-40 and LH-45 move no template slide: they only change slides that used to throw, and the template samples never did.

## Interactions found in review

- **Lists in a list grid with cards (LH-42 with LH-04/LH-64).** A list grid is a region grid, so LH-64's card-row rule applies to it: with a top anchor the cards hug their lists (`agenda 2 short`, `list 2 short`, `faq 2 short`) instead of LH-42's cards that share the leftover height. Bottom- and middle-anchored list cards follow LH-64 the same way. This is the merged rule: one card rule for every region grid.
- **Timeline bands in cards (LH-41 with LH-64).** Bands are placed by `bandBoxes`, never by the card-row rule (`!bands`), so a stack of bands keeps LH-41's geometry.
- **Charts (LH-59 with LH-55).** Bar, stacked-bar and 100pct-stacked-bar carry both the top-to-bottom order and the dark series palette; `chart-table-data.mjs` holds the combined digests.
- **`paginated chart-beside 6 long`.** Pagination now makes three pages: the second carries two charts squeezed to a strip (main squeezed them too, on its page 2), and the third carries only the last line of the sixth paragraph. Nothing is lost; the split is core `paginate`'s, under the split title. Recorded as a follow-up for pagination.

## Example corpus

The `golden` workflow must regenerate `test/golden.mjs` and `test/golden-gate.mjs`: each constituent PR lists its own moved example slides (LH-59 27, LH-54 63, LH-41 86, LH-51 1, LH-44 and LH-42 several), and the combined set is their union.
