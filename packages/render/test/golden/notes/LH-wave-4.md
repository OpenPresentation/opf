# LH wave 4: metrics, shared emphasis, pull-line quotes, tables and bidi, chart roles, fill and tracks

Wave 4 of the layout harvest merges seven reviewed branches into one, on top of wave 3 (opf#991): LH-113 and LH-115 (opf#993), LH-117, LH-118, LH-119, LH-120 and LH-111 (opf#994), LH-107 to LH-110 (opf#995), LH-114, the widened LH-06, LH-121 and LH-122 (opf#996), LH-112, LH-53, LH-61, LH-15, LH-57 and LH-101's lone metric (opf#997), LH-104, LH-98 and LH-100 (opf#998), LH-116, LH-101's code panel, LH-102 and the widened LH-80, LH-64, LH-47 and LH-10 (opf#999). Each branch's PR body explains its change; this note records the combined baseline and the rules the integration added where two features meet.

## Template baseline (`layout-templates-rr96-color-variants.json`)

`node test/layout-template-goldens.mjs --update`, the five review sheets read slide by slide, then `--promote`d.

- **104 of wave 3's 469 slides moved**; one page is gone (`paginated timeline 6 long page 4`: the timeline record's lead row lets the sample fit on three pages), none is new (468 slides).
- By template: agenda 1, list 1, comparison 1, process 1, timeline 8, faq 1, metrics 12, scorecard 12, chart 2, table 12, table-beside 12, dashboard 10, feature hero mirrored 1, and 30 paginated pages (timeline 4, table 7, table-beside 8, code 11).
- Attribution (a slide may carry more than one change):

| Feature | What moved |
| --- | --- |
| LH-122 (timeline lead row, opf#996) | timeline 3 to 6, short and long, and their paginated pages: the record gains a `lead` region, which the sample generator fills, so a text written before the timelines is the lead and the rest are notes. |
| LH-112, LH-15, LH-53, LH-101 (metrics, opf#997) | metrics 1 to 6 (a lone value up to 232 px; values beside notes at display size, bands where the cell is wide), every scorecard (the trend arrow on its host line, no word), dashboard 2 to 6 (KPI column beside the chart for 1 or 2 KPIs, display values and bands in KPI rows), feature hero mirrored (the display value start-aligned). |
| LH-117 (tables by appearance, opf#994) | every table and table-beside sample and their paginated pages: the Seats and Price columns (numbers written as text) end at the end edge, header too. |
| LH-102, LH-101, LH-10 (opf#999) | agenda 5, list 5, faq 5, process 5 short and table-beside 3, 5, 6 short: under-filled bodies sit in the middle under the title; comparison 3 long and chart 2 and 3 long: paragraphs in layout regions keep a reading measure; the paginated code pages whose code covers at least 60% of the body: the panel takes the body with its lines in the middle. After the golden review a short lone snippet grows and its panel hugs it in the middle again, so code 1 and 2 short and `paginated code 5 long page 5` draw as on wave 3. |

## Reviewed and left as they are

- `paginated timeline 4 long page 2` and `6 long page 2`: a card holding only "twenty." (the end of a paragraph `paginate` split over two pages). Wave 3 splits it the same way; pagination is not changed here.
- `table-beside 5 short`: three tables in 212 px columns wrap "Plan 1" onto two lines; the column widths are wave 3's, LH-102 only moves the body to the middle.
- `metrics 3 short` and `dashboard 3 short`: two display values as bands, their labels at the label role size beside 120 px values (LH-15 as opf#997 drew it).

- Golden review: the gray charts of `engineering-capacity-planning` and `data-storytelling-atlas` slide 7 ("Evidence Pack", a funnel and a column chart) draw in gray on wave 3 too. Both decks use the `black-and-white` scheme, whose chart accents are grays (accent1 #939393); neither chart has a focus, so no context gray applies. `test/lh-wave-4-funnel-colors.mjs` pins it: a funnel without a focus keeps its scheme color, gray only on a gray scheme.

## Rules the integration added

- **One guard.** Every wave 4 rule that rearranges or resizes blocks is a guarded rule of wave 3's `guardedCompose`: 19 in all, the placement rules (nested gaps, measure, long-text rows, measure column, region measure, mixed cards, short row, metric start) first, LH-112's display size last so it never displaces an arrangement that reads well without it.
- **Short plots count.** The guard measure also counts charts whose plot is under LH-49's minimum height (`readsAsWell`): no rule leaves more of them than the slide has without the rules. Neither opf#996 nor opf#997 changed b02 s29, b12 s19 and b15 s44 alone; together, LH-114 took the quote out of their 2 x 2 grid of a metric, a chart, a table and a quote (LH-112 kept the metric at its 76 px role size in a 195 px column) and left the chart a 147 px tall box. They keep wave 3's grid, and the corpus composes in 1.12 times wave 3's time instead of 1.34.
- **One emphasis per chart.** A waterfall in its LH-107 role colors takes no focus from the slide's texts (LH-113); a pie's value list (LH-108) bolds the focus a sibling text names.
- **A pull line is not centered.** LH-102 leaves a body with an LH-114 pull line at the top, one stack with its data, as LH-48 and LH-52 already did.
- **No trend word.** LH-53 replaces LH-118's English-only trend word (the arrow before the delta at the reading start, in every deck); LH-118's isolates and `en-US` number runs stay.

## Example corpus

The `golden` workflow must regenerate `test/golden.mjs` and `test/golden-gate.mjs`. The constituent PRs list their own moves: opf#993 `technical/layout-sampler` #24 and #39 (a highlighted row), opf#994 tables of numbers written as text, right-to-left decks with signed numbers, small line charts and bar charts with long labels, opf#995 22 slides (stacked and waterfall charts, wide pies, `technical/chart-colors#1`, `technical/chart-type-sampler#1`), opf#996 `technical/full-feature-tour` slide 5 (a pull line), opf#997 every metric with a trend, metrics beside other blocks, lone metrics, scorecards and dashboards, opf#998 none (the `image` layout pictures in the examples are contained either way), opf#999 every gallery example's code slide and the centered table-beside, comparison, metrics, chart and code layouts and the tracks under long titles. The combined set is their union plus whatever the integration rules move.
