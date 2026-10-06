# Content conversions

`@openpresentation/opf/convert` (RR-26) holds the pure, deterministic converters behind the editor's "Content type" control, the list level keys, grouping, image-to-design and the slide split and merge. They need no renderer, fonts, DOM, network or model: a function takes OPF JSON and returns new OPF JSON.

Every conversion follows one contract:

- **Never invents content.** Every word, number and date in the result came from the source. The only generated text is the fixed column headings of a timeline or metric table (`When`, `What`, `Description`, `Label`, `Value`, `Unit`, `Delta`, `Trend`), the `---` row of a Markdown table, and the `title=` of a code fence; a heading row can be left off (`headings: false`).
- **Reports what it cannot carry.** A result has `lossless` and `loss`, a list of names such as `text formatting` or `list nesting levels`. `lossless` is true exactly when `loss` is empty. Show `loss` before applying.
- **Refuses with a reason.** A pair with no mapping, or content that does not fit, throws `OPFConversionError` (`code: "not-convertible"`) with a message that says what to change. `contentConversionTargets()` returns the same refusal as `available: false` and `reason`.
- **Validates its output** as OPF. A result that would not validate throws `code: "invalid-output"`.
- **Is pure.** The input is never changed and the same input gives the same output. Slide-level functions take and return plain slide or presentation objects; the host turns the difference into a patch, so a conversion is one undoable step (the editor does this in `convertBlock`).

```js
import { contentConversionTargets, convertContent } from "@openpresentation/opf/convert";

const block = { items: ["Plan", { text: "Ship", description: "By June" }] };
contentConversionTargets(block);
// [{ kind: "text", lossless: false, loss: ["list item descriptions (kept as indented lines)"], ... },
//  { kind: "timeline", ... }, { kind: "table", lossless: true, loss: [] }]
const { payload, lossless, loss } = convertContent(block, "table");
// payload: { table: { rows: [["Plan", null], ["Ship", "By June"]] } }
```

A payload is a block, a slide or region that holds one content field, or a group of metric blocks. `id`, `extensions`, `type` (kept in step with the new kind) and any slide fields (`title`, `design`, `notes`, ...) stay on the result.

## Block conversions

| From | To | Lossless? | What is lost or reported |
| --- | --- | --- | --- |
| text | list | when every line is plain, not blank and not numbered | `blank lines`; `list numbering` when `1.` markers are stripped. Indentation (2 spaces or a tab) and `-`, `*`, `•`, `+`, `1.` markers become nesting levels; formatting is kept |
| text | quote | when the text is plain | `text formatting`. A trailing dash line (`— Name, Title`, `–`, `--`, `~`, `-`) is the attribution and a second one the source; a last line ``“Quote” — Name`` splits when the quote opens with a quote mark. Never guessed from a lone line, a dashed list or a line over 120 characters |
| text | metric | when plain | `blank lines`, `text formatting`. Refused when the first line is over 24 characters; first line is the value, the second the label, the rest the description |
| text | code | when plain | `text formatting`. One fenced block (` ``` ` or `~~~`) gives the source, the language (first word of the info string) and the file name (`title=`, `filename=`, `file=`); nothing is guessed |
| text | timeline | when plain | `blank lines`, `text formatting`. Lines like `2024 — Launch`, `Q1 2026: Pilot`, `Jan - Kickoff`, `2026-03` give `when`; an indented line is the previous event's description; `looseWhen: true` also splits `Label: text` |
| text | table | when plain | Markdown pipe tables (the separator row makes the headings), tab-separated lines, or `delimiter`/`header` options. Refused without that structure or with uneven rows |
| list | text | when plain, no descriptions, levels in order | `list nesting levels (renumbered...)` for gaps in levels; `list item descriptions (kept as indented lines)`. Levels are written as 2-space indentation |
| list | timeline | no when the list nests or is rich | `list nesting levels`, `text formatting`. `2024 — Launch` gives `when`; an item's description is the event's description |
| list | table | yes without nesting | `list nesting levels`. One column, or text and description when any item has one; no headings are invented |
| quote | text | yes | text, then `— attribution, role` (the role joins the attribution after a comma), then `— source` (the source line is plain when there is no attribution or role); loses the `quote photo` |
| metric | text | no with a trend | `metric trend` |
| code | text | yes with `fences: "auto"` (default) | A fenced block keeps the language and file name; with `fences: "never"` the loss is `code language`, `code filename` |
| timeline | text | yes | `timeline name`, `timeline description` for the metadata a text cannot hold; `when: what`, then the description indented |
| timeline | list | yes | `timeline name`, `timeline description`; `when: what` is the item text, the description its description |
| timeline | table | yes | `timeline name`, `timeline description`. Columns `When`, `What`, `Description` only for the fields used |
| chart | table | no | `chart type`. Only inline `columns` and `rows`; a `ChartDataSource` is refused |
| table | chart | yes | Refused unless every column has a plain label and every value after the first column is a number, a numeric string or empty; type `column` |
| table | list | no | `column headings`; `table columns beyond the second (joined into the description)`; `cell styles`. First column is the item, the other columns the description. Merged cells are refused |
| table | timeline | yes when the headings are recognised | Reads columns by heading (`When`/`Date`/`Quarter`..., `What`/`Event`/`Milestone`..., `Description`/`Notes`...) or by `columns: { when, what, description }`; `column "X"` for dropped columns, `column heading "X"` for a heading it did not recognise, `text formatting`. Refused without headings or an event column |
| table | text | yes for plain cells | `text formatting`, `cell styles`, `merged cells`, `line breaks inside cells`, `empty rows`. Markdown with headings, tab-separated without |
| table | metric blocks | yes when the headings are recognised | Needs a `Value` column; `Label`, `Unit`, `Delta`, `Trend`, `Description` are read too; `column "X"`, `trend values other than up, down or flat`, `text formatting` |
| group of metric blocks | table | yes | `block ids and extensions`, `group arrangement (composition)` (a group's composition cannot sit on a table; a slide keeps its own). Columns only for the fields used |

Images, videos and any other group have no content conversion.

## Other helpers

| Function | What it does | Lossless? |
| --- | --- | --- |
| `demoteListItems`, `promoteListItems`, `shiftListLevels` | Nest an item one level deeper (Tab) or one level up (Shift+Tab). A level is at most one more than the item above and never below 0; the first item cannot nest. Items under it move with it unless `withChildren: false`. Level 0 collapses back to the plain form | yes; `changed: false` and a `reason` when nothing can move |
| `convertListForm` | `items` to `bullets` and back | `list item descriptions` when going to bullets |
| `wrapBlocks` | Put the selected blocks of a slide or group into a new group, optionally with a composition | yes |
| `unwrapGroup` | Replace a group in a `blocks` list by its blocks | `group arrangement (composition)`, `group id`, `group extensions` |
| `blocksToRegions`, `regionsToBlocks`, `moveRegion` | Move blocks into named regions (one block each, no overlap), turn regions back into blocks in reading order, move or swap a region | `region placement` going to blocks |
| `promoteImage` | Move an image block into `design.slideImage` (`position`, default `right`), `design.background` or `design.watermark` (`opacity`, default 0.1); refuses an occupied slot unless `replace: true` | `image alt text` (background, watermark), `image title`/`description`/`mediaType`/`format`, `block id` |
| `demoteImage` | Move the slide image, background image or watermark back into the content as an image block | `image position and framing`, `background fit and opacity`, `watermark opacity` |
| `splitSlide` | Split a slide by blocks (`at: [indexes]` or `each: true`); design, layout and the other slide fields are copied, headings repeat (`repeatHeadings`), the first slide keeps the id and notes, the others get free ids ending `--2`, `--3`. Regions split region by region | `region placement` for regions |
| `splitSlideOnOverflow` | Split a slide that does not fit with the existing pagination (`paginatePresentation`, one slide as slide 1 of 1, host `options` for fonts and measurement) and return the `pages` mapping | yes |
| `mergeSlides` | Merge consecutive slides: the first slide's id, headings and design win, blocks follow each other, notes are joined with a blank line | `slide id "x"`, `title of slide N`, any other field that differs; regions are refused |
| `unpaginate` | The inverse of pagination for slides still as `paginatePresentation` returned them, given its `pages`: slices of text, items, rows, events and code are joined into the original leaves | yes (the pagination readability floor stays in `composition.minFontSize`); refused when the slices are not consecutive |

Slide-level functions return the replacement slides, the replaced `range` (`start`, `deleteCount`) and the new `presentation`; structure functions return the new `slide` and the `path` of what they touched.

## Decisions

- Column headings of timeline and metric tables are the schema's own field names. They are the only generated text and can be omitted; reading a table back needs headings (or explicit `columns`), because a role is never guessed from position.
- Text-to-timeline and text-to-quote parse only unambiguous patterns; the rest stays text. Parsing a pattern is not loss, and a wrong guess would be invented structure.
- Code to text writes a fenced block when the code has a language or file name, so the round trip is lossless. A fence and its `title=` are the visible cost; `fences: "never"` writes the bare source and reports the loss.
- Un-paginate needs the pagination mapping. Without it, `mergeSlides` concatenates blocks and never glues text together, because pagination's exact slice boundaries are not recoverable from the slides.
