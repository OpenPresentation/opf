# Format requests: decisions

Read from the review page (rounds 1, 2 and 3) and the owner's saved answers of 2026-11-24 and 2026-11-25. Both are private and outside this repository
(the answers are in `C:\opf-work\t\review-answers.md` on the supervisor's Windows computer), so this page is the record. Program:
[README.md](README.md); items: [burndown.md](burndown.md).

Who decided:

- **Owner, 2026-11-24**: the owner picked this option (or, for a change, made this call) on the review page.
- **Owner, 2026-11-25**: the owner answered this question on the review page between 16:05 and 16:17 UTC, after the supervisor had taken
  the recommended option. Every one of these answers is the option already taken, except the release question R1, where he chose
  "nothing may be cut".
- **Supervisor, 2026-11-25, on the owner's delegation; he can overrule**: the owner had not answered, so the option the review marks as
  recommended is taken. On 2026-11-25 the owner said to start now and that the supervisor "can make good decisions for open items too".

An overruled decision changes its row here and the item that depends on it. Where a later round replaced a decision of an earlier round,
only the later one is kept, with a line saying what it replaced. The review page numbered its release as 0.36; it is 0.37.0 here (see the
README). Option labels are the review's, shortened.

## Calls on changes

| Change | Owner's call, 2026-11-24 | Item |
| --- | --- | --- |
| CR 7, document id | Keep | FR-01 |
| CR 6, item and row ids | Keep | FR-02 |
| opf#1297, links to a slide | Keep (kept as `slide:<id>`) | FR-03 |
| CR 1, data sources | Change, twice (round 3 is the result) | FR-04 |
| CR 3, trace a number to its source | Keep | FR-04 |
| CR 2, typed columns | Keep | FR-05 |
| CR 4, computed metric | Change (round 2 is the result) | FR-06 |
| CR 5, gauge, bullet, heatmap | Change (round 2 is the result) | FR-07 |
| CR 11, embed | Change (round 2 is the result) | FR-08 |
| CR 14, variable limits | Change (answered: it belongs to variables) | FR-09 |
| CR 15, translations | Keep | FR-10 |
| CR 8 (slide templates and brand kits), CR 10, CR 13, CR 17 | Change, each moved to a study | Not in 0.37.0 |
| CR 9, CR 12, CR 16 | Cut, each to an issue (opf#1433, opf#1434, opf#1435) | Not in 0.37.0 |

## FR-01: CR 7, the document id

Owner's call: Keep, with every recommended answer. No note.

| Question | Options | Answer | Who |
| --- | --- | --- | --- |
| `cr7-form`: What is the id, and who mints it? | Opaque string, hosts and `opf create` mint (recommended); a UUID; a URL | Opaque string; core never mints one | Owner, 2026-11-24 |
| `cr7-copy`: When does a copy get a new id? | Same deck keeps it, a new deck gets a new one (recommended); never changes | Keep on save, export, import and publish; new on duplicate, fork and fill | Owner, 2026-11-24 |
| `cr7-trust`: May a host trust the id of an imported file? | No, the docs call it a claim (recommended); say nothing | Claim, not a credential | Owner, 2026-11-24 |

## FR-02: CR 6, ids on items, bullets, events and rows

Owner's call: Keep, with every recommended answer. No note.

| Question | Options | Answer | Who |
| --- | --- | --- | --- |
| `cr6-row`: Where does a table row's id go? | A row object `{ id, cells }` beside the array form (recommended); a parallel `rowIds` array; a key column | Row object | Owner, 2026-11-24 |
| `cr6-scope`: Is an id unique in its list or the whole deck? | The whole deck, one namespace with slides and blocks (recommended); its own list | Whole deck | Owner, 2026-11-24 |
| `cr6-assign`: Does `assignIds` turn every string item into an object? | Only when asked, `{ items: true }` (recommended); always | Only when asked | Owner, 2026-11-24 |
| `cr6-mint`: How are ids minted? | Ordered by default, random where people co-edit (recommended); always random | Ordered by default; a host passes `generate` | Owner, 2026-11-24 |
| `cr6-extra`: Which arrays get ids beyond the three asked for? | Timeline events too, not dataset or chart rows (recommended); only what was asked; dataset and chart rows as well | Timeline events too | Owner, 2026-11-24 |

## FR-03: opf#1297, links to a slide

Owner's call: Keep (answered as `slide:<id>`). Owner's note, quoted exactly: "does our opf editor and viewer components support the links
too?" Answered in round 2: web, mail and phone links work in the preview, PDF, PowerPoint and the editor; `slide:` links need work on
every surface, listed in FR-03; the presenter has a bug where a click on a link also changes slides.

| Question | Options | Answer | Who |
| --- | --- | --- | --- |
| `links-in`: Is it in, and how is the target spelled? | In, `slide:<id>` (recommended); in, `#<id>`; not in 0.37.0 | In, spelled `slide:<id>` | Owner, 2026-11-24 |
| `links-comments`: Does exporting comments to PowerPoint come with it? | No, it waits for comment anchors (recommended); yes | No | Owner, 2026-11-24 |
| Round 2: When is the presenter's double action fixed? | Now, as its own small pull request (recommended); with `slide:` links | Done before the question was answered: the editor's presenter was fixed in 0.36.0 (opf#1449). The web player had the same defect and is fixed inside FR-03, in the click handling the slide links use. The owner then answered `links-presenter` with the same option | Owner, 2026-11-25 |
| Built: is a link to a hidden slide valid? | Yes; an error | Yes. PowerPoint and the editor's presenter follow it, the web player does not | Supervisor, 2026-11-25, on the owner's delegation; he can overrule |
| Built: may a slide that others link to be deleted? | The slide manager refuses; it deletes and leaves dead links | The editor's slide manager refuses and names the linking slides | Supervisor, 2026-11-25, on the owner's delegation; he can overrule |
| Owner's note of 2026-11-25, quoted exactly: "do the links work in our preview/viewer components in the opf repo? ideally yes" | Follow links in the viewers' read-only slide view; leave it to Present | They do in the preview, PDF, PowerPoint, the editor's presenter and the web player. The read-only slide view of the MCP viewer and of the editor gets it as a follow-up under FR-03 | Supervisor, 2026-11-25, on the owner's delegation; he can overrule |

## FR-04: CR 1 with CR 3, data sources and a flat dataset

Owner's call on CR 1: Change, twice. Owner's notes, quoted exactly. First (round 1 card):

> so I'd rather have an official datasources key with an object of datasource connector objects than an 'extensions' object. The datasets can have a key named 'source' that is a datasource object or one of the reusable sources defined in datasources. Something like that... try it again... or pitch me on extensions if that's better. Also retrieved should accept datetime or date. Also I don't know what rev is.

Second (round 2 card):

> I don't like source.src... like under datasets.revenue.source.src...
> can we try:
> datasets.revenue.columns
> datasets.revenue.datasource = {} || ""
> datasets.revenue.query = ""
> datasets.revenue.retrieved =
>
> whatever something like that think it through again

Owner's call on CR 3: Keep, with every recommended answer. No note. CR 3's five keys land on the dataset and the data source as round 3
says (`license` moves to the data source; `queryLanguage` is dropped because the connector already says it).

Round 2 decisions the owner answered (the card was then replaced by round 3, which keeps their outcomes):

| Question | Answer | Who |
| --- | --- | --- |
| `ds-official`: An official `datasources` key, not `extensions` | Official root `datasources` map; connector settings a host owns go in the data source's `extensions` | Owner, 2026-11-24 |
| `ds-name`: the key that names the place | `src` (stays a key on the data source, no longer under `source`) | Owner, 2026-11-24 |
| `ds-rev`: what `rev` is called | `version`, a free string the source system gives its snapshot; it sits on the dataset | Owner, 2026-11-24 |
| `ds-split`: how the keys divide | Split: where and the terms on the data source; what, when and by whom on the dataset | Owner, 2026-11-24 |

The option texts of the four round 2 decisions are not on the saved page (round 3 replaced the card); the answers above are read from
their keys and from the round 3 card, which says it follows them ("`rev` stays, as `version`, as you chose").

Replaced, not kept: round 1's "Add `Dataset.id` as asked?" (recommended: no, put `id` and `rev` on the source) and the `datasource:`
prefix of round 2 (the owner's second note wins: a string is a bare id, as `"dataset": "revenue"` is in a chart).

Round 3 decisions:

| Question | Options | Answer | Who |
| --- | --- | --- | --- |
| What does a string `datasource` mean? | Only an id in `datasources` (recommended); an id if one matches, else a path or URL | Only an id; a file or URL is an object, `{ "src": "./revenue.csv" }` | Owner, 2026-11-25 (`ds3-string`) |
| Do `sheet` and `range` stay as their own keys? | No, a workbook's `query` is the sheet and range (recommended); yes | No; `"query": "FY26!A1:C13"`, `opf fix` rewrites | Supervisor, 2026-11-25, on the owner's delegation; he can overrule |
| What happens to `source.fields`? | Drop it (recommended); move it to each column as `field` | Drop it | Supervisor, 2026-11-25, on the owner's delegation; he can overrule |
| Can a chart's inline data name a data source too? | Yes, with the same keys (recommended); no, it must be a dataset | Yes, same keys | Owner, 2026-11-25 (`ds3-inline`) |
| Owner's note of 2026-11-25, quoted exactly: "will we always have a query? what about if there's a CSV or data in the JSON" | `query` optional; `query` required | Optional. A CSV file, or rows typed into the deck, need none; `query` is only what was asked of a source that takes a question (SQL, a sheet and range, an API call) | Supervisor, 2026-11-25, on the owner's delegation; he can overrule |

CR 3 decisions:

| Question | Options | Answer | Who |
| --- | --- | --- | --- |
| `cr3-hash`: What does `sha256` cover? | The source file's bytes as retrieved (recommended); the rows in the deck | The source file's bytes | Owner, 2026-11-24 |
| `cr3-transform`: A separate hash of the transform? | No, `query` holds the text (recommended); yes | No | Owner, 2026-11-24 |
| `cr3-generator`: What shape is `generator`? | `{ type: "human" \| "model", name }` (recommended); the bare word | The object; the key is `type` (the owner, 2026-11-25, said in the analysis session; it was `kind`) | Owner, 2026-11-24 |
| `cr3-refresh-every`: What is the key for how often a data source is meant to be refreshed? | `refreshEvery` (recommended); keep `refresh` | `refreshEvery`, an ISO 8601 duration as before (the owner, 2026-11-25, said in the analysis session; the key-names study, finding A5) | Owner, 2026-11-25 |

## FR-05: CR 2, typed columns

Owner's call: Keep, with every recommended answer. No note.

| Question | Options | Answer | Who |
| --- | --- | --- | --- |
| `cr2-role`: Does `role` have the value `temporal`? | No, `dimension` and `measure` (recommended); yes, three values | No; time is `type: "date"` with `role: "dimension"` | Owner, 2026-11-24 |
| `cr2-unit`: What does `unit` do? | A label engines never print (recommended); engines print it | A label; `format` alone draws the number | Owner, 2026-11-24 |
| Built: which category is the cell rule in, and what may its fix do? | A format error; a content warning with a safe fix | `opf/data-cell-type` is a warning in `content`: at most five findings per column, then one for the column. Its fix stores a strict decimal string as a number and a number in a text column as text, never changes the declared type, and runs only with `opf fix --audits` | Supervisor, 2026-11-25, on the owner's delegation; he can overrule |
| Built: what counts as a number, and as a date? | Anything a chart can plot; a strict kind | A `number` cell is a finite number, so `"12"` warns. A `date` cell is an ISO 8601 date or date-time. A `date` category column is time ordered when its labels run forward; `text` and `boolean` never are | Supervisor, 2026-11-25, on the owner's delegation; he can overrule |
| Built: where do the three keys live in a PowerPoint file? | In the data records, as authored; in a side record an older importer skips | In the data records, as authored. An importer of an older release does not restore such a record and imports the values the charts and tables show (the owner on 2026-11-25: no compatibility work for older importers) | Supervisor, 2026-11-25, on the owner's delegation; he can overrule |
| Built: does `opf ingest --dataset` declare columns? | Yes, from the cells; no | Yes: it declares what it can tell from the cells and stores typed cells as that type; a column it cannot tell stays a plain string, and a column that already exists keeps its declaration | Supervisor, 2026-11-25, on the owner's delegation; he can overrule |

## FR-06: CR 4, a metric computed from data

Owner's call: Change. Owner's note, quoted exactly: "delta is intrinsically tied to the metric try to redo this metric schema with that
in mind. also delta is optional". Round 2 is the result: one data link computes the value and the change.

Round 1 answers that still stand, restated on the round 2 card:

| Question | Answer | Who |
| --- | --- | --- |
| `cr4-shape`: One binding shape for metric and variable, or two? | One shape for both (`{ dataset, field, aggregate, filter }`) | Owner, 2026-11-24 |
| `cr4-filter`: What is a filter? | A list of `{ field, op, value }`; no expression string | Owner, 2026-11-24 |
| `cr4-literal`: Does a bound metric keep its literal? | Yes, as the last computed value | Owner, 2026-11-24 |

Replaced: `cr4-delta` (owner: "a second binding on the metric"; recommended was a bound variable). The note moved the change inside the
metric's one data link, so the round 2 `delta` key inside `data` replaces both options.

Round 2 decisions:

| Question | Options | Answer | Who |
| --- | --- | --- | --- |
| What is the link called? | `data` (recommended); `bind` | `data` (a chart already names its rows `data`) | Owner, 2026-11-25 (`m-key`) |
| Which ways of computing the change? | All three: previous row, baseline filter, column (recommended); only previous; only a column | All three, and a fourth from his note, quoted exactly: "all three, but fixed value/constant too?" The change can also compare with a fixed number, `compare: { value }` | Owner, 2026-11-25 (`m-delta`); the key's name by the supervisor |
| When a refresh flips the sign, who decides good or bad? | `better: "up" \| "down"` (recommended); keep only `sentiment` | `better`; an explicit `sentiment` still wins | Owner, 2026-11-25 (`m-better`) |
| Does the arrow follow the computed change? | Yes, when `trend` is not typed (recommended); no | Yes | Owner, 2026-11-25 (`m-trend`) |

## FR-07: CR 5, table color scale, bands and bullet, gauge

Owner's call: Change. Owner's note, in short (it names the tool that sent the request, which is left out here): he has not built or
reviewed that tool yet, so go with what is best for OPF, ignore the tool's own shapes and borrow any good ideas it has. Round 2 is the
result.

Round 1 answers, and what became of them:

| Question | Answer | What round 2 did | Who |
| --- | --- | --- | --- |
| `cr5-export`: What does each type become in PowerPoint? | Native parts, editable | Kept and made exact: the color scale is a native table with cell fills, the bullet a native bar chart with a target marker series, the gauge native `blockArc` shapes plus text (not a doughnut) | Owner, 2026-11-24 |
| `cr5-which`: Which of the three are in 0.37.0? | All three, built in order and cut from the end | Kept: built heatmap (color scale), bullet, gauge. The cutting half no longer applies: on 2026-11-25 the owner chose "nothing may be cut" (R1) | Owner, 2026-11-24 and 2026-11-25 |
| `cr5-contract`: Whose data shape wins? | "Use the shapes shown here" (the requesting tool adapts) | Replaced by the note: take what is best for OPF; no question to the requesting tool first | Owner, 2026-11-24 |

Round 2 decisions:

| Question | Options | Answer | Who |
| --- | --- | --- | --- |
| Is a heatmap a chart type or a table option? | A table option, `colorScale` (recommended); a chart type that exports as a table | Table option | Owner, 2026-11-25 (`c-heatmap`) |
| Are bands a bullet feature or a feature of every value axis? | Every bar, column, line and area chart (recommended); bullet only | Every bar, column, line and area chart. The owner asked for the question to be explained ("I don't understand the question. Explain it and make a great recommendation"); it is asked again on the review page and this answer stands until he picks | Supervisor, 2026-11-25, on the owner's delegation; he can overrule |
| Is "bullet" its own type? | Yes, `type: "bullet"` (recommended); no, authors compose it | Yes | Owner, 2026-11-25 (`c-bullet`) |
| Is a gauge a chart type or a way to draw a metric? | A metric with a `scale`, drawn on an arc (recommended); a chart type | A metric with a scale | Owner, 2026-11-25 (`c-gauge`) |
| Built, color scale: which text color on a shaded cell? | The design's rule (the scheme's text color, or its inverse past a lightness limit); the engines' existing rule for text on a filled cell | The existing rule: the scheme's text color when it reaches 4.5:1 on the fill, else black or white. The design's rule fell below 4.5:1 on the strongest fill in four color schemes | Supervisor, 2026-11-25, on the owner's delegation; he can overrule |
| Built, color scale: what range does a diverging scale span when no end is pinned? | Each side its own span; one span, symmetric around the center | Symmetric: equal distances from the center get equal strength, so a lone -1% beside +12% is pale. A pinned `min` or `max` still fixes that end. The owner sees both as pictures before the part merges | Supervisor, 2026-11-25, on the owner's delegation; he can overrule |

## FR-08: CR 11, embed

Owner's call: Change. Owner's note, quoted exactly: "work on the schema a bit, I like embed and src and title and aspectRatio I don't get
poster". Round 2 is the result (`poster` becomes an optional `preview`).

| Question | Options | Answer | Who |
| --- | --- | --- | --- |
| `cr11-video`: How does it differ from an online video? | A separate kind (recommended); one kind for both | Separate: video plays media, embed shows a page | Owner, 2026-11-24 |
| Round 2: What about the picture for static outputs? | Optional, named `preview` (recommended); drop it; keep the name `poster` | Optional `preview`; without it a generated card | Owner, 2026-11-25 (`e-preview`) |
| Round 2: Build it in 0.37 without waiting for the request text? | Yes, with this schema (recommended); wait for the text | Yes, with this schema | Owner, 2026-11-25 (`e-release`) |

Replaced: round 1's `cr11-in` (owner: "only if the request text arrives before the schema work starts"). Round 2 asks the question again
because the owner has now reviewed the schema himself. The supervisor took its recommended answer, which took embed from "wait" to
"build"; the owner confirmed it on 2026-11-25, with the optional `preview`.

## FR-09: CR 14, limits on a variable's value

Owner's call: Change. Owner's note, quoted exactly: "is this part of slideTemplates? or layouts? or variables? I like the idea I'm just
confused". Answered in round 2: it is variables (`maxLength`, `maxLines` and `maxItems` sit on a variable's declaration); layouts only
matter because `maxLines` is measured where the variable is drawn.

| Question | Options | Answer | Who |
| --- | --- | --- | --- |
| `cr14-count`: What does `maxLength` count? | Characters as a reader sees them (recommended); code units | Characters as a reader sees them (grapheme clusters) | Owner, 2026-11-24 |
| `cr14-lines`: Where is `maxLines` checked? | By composition, at each place the variable is drawn (recommended); by validate | Composition | Owner, 2026-11-24 |
| Round 2: Does it ship in 0.37, ahead of slide templates? | Yes, it works with today's deck templates (recommended); no, move it with slide templates | Yes (the review's option key for this answer is `036`, the old release number) | Owner, 2026-11-25 (`c14-release`) |
| Built: which category is the rule in? | One rule in `layout`; two rules, one in `format` | One rule, `opf/variable-overflow`, in `layout`: `validate({ only: ['format'] })` does not report it | Supervisor, 2026-11-25, on the owner's delegation; he can overrule |
| Built: which value is measured? | The value given, else the declared value, else the example; the example never | The value given to the check, else the declared `value`, else the `example`; a type sample is never measured | Supervisor, 2026-11-25, on the owner's delegation; he can overrule |
| Built: where is `maxLines` measured? | Titles, subtitles, tags, text blocks and list entries; every text | A title, a subtitle, a tag, a text block or a list entry; inside longer text, the lines the variable's own characters occupy; not a table cell, a chart label or text in a shape | Supervisor, 2026-11-25, on the owner's delegation; he can overrule |
| Built: does `opf fill` refuse an overflowing value? | Warn and write; refuse | It warns per record (stderr and `fill.overflow`) and still writes, because the finding is a warning. The review's example said a template "refuses" a long headline | Supervisor, 2026-11-25, on the owner's delegation; he can overrule |
| Built: a limit on the wrong kind of variable | A schema error; a warning | A schema error, with one invalid conformance case | Supervisor, 2026-11-25, on the owner's delegation; he can overrule |
| Built: the lean MCP Worker passed its unminified size ceiling | Raise both byte ceilings to 3% above the measured size; cut code from the bundle | Raised: 7,791,000 unminified and 4,953,000 minified (measured 7,563,294 and 4,808,255; gzip 1,267,042 under its 1,300,000). Every 0.37.0 item adds validator code; an item that passes a ceiling reports its sizes first | Supervisor, 2026-11-25, on the owner's delegation; he can overrule |

## FR-10: CR 15, translations and localized date names

Owner's call: Keep, with every recommended answer. No note.

| Question | Options | Answer | Who |
| --- | --- | --- | --- |
| `cr15-locale`: Add a `locale` field as asked? | No, a subtag on `language` says it (recommended); yes | No | Owner, 2026-11-24 |
| `cr15-pick`: Which language selects a translation? | The language where the variable is drawn, slide else deck (recommended); always the deck's | Where it is drawn | Owner, 2026-11-24 |
| `cr15-names`: Where do month and weekday names come from? | A generated table, measured before it is committed (recommended); the runtime's own data | A generated table | Owner, 2026-11-24 |
| Built: which language does a deck's header or footer take? | The deck's on every slide; the slide's | The slide's: a slide in another language than the deck's draws the deck's header and footer resolved in its own language, so a translated call to action and a date read in the language of the slide they stand on | Supervisor, 2026-11-25, on the owner's delegation; he can overrule |
| Built: how far does a translation fall back? | Only by removing subtags (`zh-TW` uses `zh`); also to a related language | Only by removing subtags, ignoring case. A language read from the text selects nothing; only a declared language does | Supervisor, 2026-11-25, on the owner's delegation; he can overrule |
| Built: what does `opf fill` do with translations? | Keep them; remove them when a value is given | A value given without translations removes them and the report says so; a date's formats stay; a record may give `{ value, translations }` | Supervisor, 2026-11-25, on the owner's delegation; he can overrule |
| Built: a date with no format | Always `MMMM d, yyyy`; the language's own long pattern | The language's long pattern ("5. März 2026", "5 March 2026" in British English). United States English and a deck with no language keep `MMMM d, yyyy`; a footer date with no `dateFormat` keeps `M/d/yyyy` | Supervisor, 2026-11-25, on the owner's delegation; he can overrule |
| Built: a current date in PowerPoint | A field in the deck's language; a field in the language of its slide, else fixed text | A native field only where PowerPoint shows what OPF draws in the language of that slide; otherwise the date is fixed text with `furniture-date-fixed`. An English field is no longer used for a pattern with names in a deck whose names are not English | Supervisor, 2026-11-25, on the owner's delegation; he can overrule |
| Built: what does PowerPoint hold of a translation? | Nothing stored; a record of every translation | Nothing. Measured on 2026-11-25: content variables do not come back from PowerPoint; the export holds each slide's resolved text, and import returns that text. A translated deck exports the text of each slide's language | Supervisor, 2026-11-25, on the owner's delegation; he can overrule |

## Not in 0.37.0: the owner's notes, for the record

Quoted exactly; none of these is built here.

- CR 8, slide templates (study, 0.38): "we need to reconcile this with narrative/beats in addition to the layouts. I'm not saying no I'm
  just not sure yet. create a standalone artifact analyzing all of this with pros/cons then this review decision thing in that. "
- CR 8, brand kits (study, 0.38): "create a standalone artifact analyzing all of this with pros/cons then this review decision thing in
  that.  I'm not sure we need brand-kit in the opf since we have all the components. Maybe just I'm not deciding here."
- CR 10 (study, 0.38): "create a standalone artifact analyzing all of this with pros/cons then this review decision thing in that. combine it with
  slideTemplate artifact. i'm not sure I want this in 0.36 yet help me decide". Its round 1 answers were `cr10-count` range,
  `cr10-evidence` both, `cr10-where` fields.
- CR 13 (study, 0.38): "this is good but it needs it's own artifact that I can study before I consider it final." Its round 1 answers were
  `cr13-stale` pass and `cr13-tokens` unbound.
- CR 17 (study, folded into the brand study): "i mean this is a great idea but it's part of the brand-kit proposal not a standalone issue, add
  it in over there"
- CR 9 (cut, opf#1433): "cut from v0.36... move this into an open issue as an idea"
- CR 12 (cut, opf#1434): "put this into an issue to study further for if support in OPF is necessary. cut from 0.36 for now"
- CR 16 (cut, opf#1435): "put this into an issue for future consideration beyond 0.36"

## The release itself: eight decisions

Round 1 left these unanswered. The owner's decisions of 2026-11-24 settled two (R3 and R5), as the plan page says. On 2026-11-25 he
answered R1, R2, R6 and R7 on the review page and confirmed R3 and R5; R4 and R8 are still the supervisor's.

| # | Question | Options | Answer | Who |
| --- | --- | --- | --- | --- |
| R1 | How does one release stay shippable? | One release with a cut order agreed now (recommended); one release, nothing may be cut; back to three releases | One release, nothing may be cut: 0.37.0 ships when every item is done, and a change PowerPoint does not accept is fixed before the release. This replaces the supervisor's answer of the same day (one release with a cut order) | Owner, 2026-11-25 (`r-one`) |
| R2 | Where does the work land while it is built? | On `main`, each change whole, in order (recommended); on an integration branch | On `main`, each change whole, in the order of the README | Owner, 2026-11-25 (`r-land`) |
| R3 | Do the layout sweep's drawing changes ride with the format changes? | Yes, they ride along (recommended in the review); no, they take a minor of their own first | No: the sweep and the other post-0.35.1 fixes ship first as 0.36.0, and the format changes are 0.37.0 | Owner, 2026-11-24 |
| R4 | Do the breaking proposals that wait for a minor ride along? | No, apart from CR 1's flat dataset, 0.37.0 only adds (recommended); take the six-column grid; take both | No. Decide the fill vocabulary (opf#1275) and the six-column grid (opf#1281) later, build neither here. The one breaking change is CR 1 (FR-04), with an `opf fix` rewrite | Supervisor, 2026-11-25, on the owner's delegation; he can overrule |
| R5 | Do the schema identifiers move to openpresentation.com? | Move, with a safe fix; keep them on openpresentation.org (recommended); accept both | They stay on openpresentation.org. No `$schema` fix, no document changes | Owner, 2026-11-24 (his product split) |
| R6 | STORYD's launch also expects editor features. Are they part of 0.37.0? | A parallel track, comment anchors designed alongside CR 6 (recommended); all in 0.37.0; none | A parallel track in the cloud-editor program; only the anchor design rides with FR-02 | Owner, 2026-11-25 (`r-wave`) |
| R7 | Merge the governance and conformance branch before any of this? | Yes, first (recommended); later | Yes, first. Already merged as opf#1419 on 2026-11-24, with the sentence that Data Advantage holds the names and neither is a registered trademark. Every item adds its cases to that suite | Supervisor, on the owner's go-ahead of 2026-11-24 for good pull requests in the plan; done |
| R8 | What does a 0.36 reader say about a 0.37 document? | The validator names the release a field needs (recommended); a version field in documents; nothing | Changed while planning the build: a released validator cannot know the keys of a later release, so from 0.37.0 the unknown-key finding names the validator's own version and says a later release may define the key (FR-11). A table of the keys 0.37.0 adds, shipped in a 0.36.x patch, only if the owner asks for it. No version field | Supervisor, 2026-11-25, on the owner's delegation; he can overrule |

R8 is item FR-11 in the burndown.
