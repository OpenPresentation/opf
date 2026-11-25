# Format requests: decisions

Read from the review page (rounds 1, 2 and 3) and the owner's saved answers of 2026-11-24. Both are private and outside this repository
(the answers are in `C:\opf-work\t\review-answers.md` on the supervisor's Windows computer), so this page is the record. Program:
[README.md](README.md); items: [burndown.md](burndown.md).

Who decided:

- **Owner, 2026-11-24**: the owner picked this option (or, for a change, made this call) on the review page.
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
| Round 2: When is the presenter's double action fixed? | Now, as its own small pull request (recommended); with `slide:` links | Now, as its own small pull request, before `slide:` links build on it | Supervisor, 2026-11-25, on the owner's delegation; he can overrule |

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
| What does a string `datasource` mean? | Only an id in `datasources` (recommended); an id if one matches, else a path or URL | Only an id; a file or URL is an object, `{ "src": "./revenue.csv" }` | Supervisor, 2026-11-25, on the owner's delegation; he can overrule |
| Do `sheet` and `range` stay as their own keys? | No, a workbook's `query` is the sheet and range (recommended); yes | No; `"query": "FY26!A1:C13"`, `opf fix` rewrites | Supervisor, 2026-11-25, on the owner's delegation; he can overrule |
| What happens to `source.fields`? | Drop it (recommended); move it to each column as `field` | Drop it | Supervisor, 2026-11-25, on the owner's delegation; he can overrule |
| Can a chart's inline data name a data source too? | Yes, with the same keys (recommended); no, it must be a dataset | Yes, same keys | Supervisor, 2026-11-25, on the owner's delegation; he can overrule |

CR 3 decisions:

| Question | Options | Answer | Who |
| --- | --- | --- | --- |
| `cr3-hash`: What does `sha256` cover? | The source file's bytes as retrieved (recommended); the rows in the deck | The source file's bytes | Owner, 2026-11-24 |
| `cr3-transform`: A separate hash of the transform? | No, `query` holds the text (recommended); yes | No | Owner, 2026-11-24 |
| `cr3-generator`: What shape is `generator`? | `{ kind: "human" \| "model", name }` (recommended); the bare word | The object | Owner, 2026-11-24 |

## FR-05: CR 2, typed columns

Owner's call: Keep, with every recommended answer. No note.

| Question | Options | Answer | Who |
| --- | --- | --- | --- |
| `cr2-role`: Does `role` have the value `temporal`? | No, `dimension` and `measure` (recommended); yes, three values | No; time is `type: "date"` with `role: "dimension"` | Owner, 2026-11-24 |
| `cr2-unit`: What does `unit` do? | A label engines never print (recommended); engines print it | A label; `format` alone draws the number | Owner, 2026-11-24 |

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
| What is the link called? | `data` (recommended); `bind` | `data` (a chart already names its rows `data`) | Supervisor, 2026-11-25, on the owner's delegation; he can overrule |
| Which ways of computing the change? | All three: previous row, baseline filter, column (recommended); only previous; only a column | All three | Supervisor, 2026-11-25, on the owner's delegation; he can overrule |
| When a refresh flips the sign, who decides good or bad? | `better: "up" \| "down"` (recommended); keep only `sentiment` | `better`; an explicit `sentiment` still wins | Supervisor, 2026-11-25, on the owner's delegation; he can overrule |
| Does the arrow follow the computed change? | Yes, when `trend` is not typed (recommended); no | Yes | Supervisor, 2026-11-25, on the owner's delegation; he can overrule |

## FR-07: CR 5, table color scale, bands and bullet, gauge

Owner's call: Change. Owner's note, in short (it names the tool that sent the request, which is left out here): he has not built or
reviewed that tool yet, so go with what is best for OPF, ignore the tool's own shapes and borrow any good ideas it has. Round 2 is the
result.

Round 1 answers, and what became of them:

| Question | Answer | What round 2 did | Who |
| --- | --- | --- | --- |
| `cr5-export`: What does each type become in PowerPoint? | Native parts, editable | Kept and made exact: the color scale is a native table with cell fills, the bullet a native bar chart with a target marker series, the gauge native `blockArc` shapes plus text (not a doughnut) | Owner, 2026-11-24 |
| `cr5-which`: Which of the three are in 0.37.0? | All three, built in order and cut from the end | Kept: built heatmap (color scale), bullet, gauge; the gauge is cut first, then the bullet | Owner, 2026-11-24 |
| `cr5-contract`: Whose data shape wins? | "Use the shapes shown here" (the requesting tool adapts) | Replaced by the note: take what is best for OPF; no question to the requesting tool first | Owner, 2026-11-24 |

Round 2 decisions:

| Question | Options | Answer | Who |
| --- | --- | --- | --- |
| Is a heatmap a chart type or a table option? | A table option, `colorScale` (recommended); a chart type that exports as a table | Table option | Supervisor, 2026-11-25, on the owner's delegation; he can overrule |
| Are bands a bullet feature or a feature of every value axis? | Every bar, column, line and area chart (recommended); bullet only | Every bar, column, line and area chart | Supervisor, 2026-11-25, on the owner's delegation; he can overrule |
| Is "bullet" its own type? | Yes, `type: "bullet"` (recommended); no, authors compose it | Yes | Supervisor, 2026-11-25, on the owner's delegation; he can overrule |
| Is a gauge a chart type or a way to draw a metric? | A metric with a `scale`, drawn on an arc (recommended); a chart type | A metric with a scale | Supervisor, 2026-11-25, on the owner's delegation; he can overrule |

## FR-08: CR 11, embed

Owner's call: Change. Owner's note, quoted exactly: "work on the schema a bit, I like embed and src and title and aspectRatio I don't get
poster". Round 2 is the result (`poster` becomes an optional `preview`).

| Question | Options | Answer | Who |
| --- | --- | --- | --- |
| `cr11-video`: How does it differ from an online video? | A separate kind (recommended); one kind for both | Separate: video plays media, embed shows a page | Owner, 2026-11-24 |
| Round 2: What about the picture for static outputs? | Optional, named `preview` (recommended); drop it; keep the name `poster` | Optional `preview`; without it a generated card | Supervisor, 2026-11-25, on the owner's delegation; he can overrule |
| Round 2: Build it in 0.37 without waiting for the request text? | Yes, with this schema (recommended); wait for the text | Yes, with this schema | Supervisor, 2026-11-25, on the owner's delegation; he can overrule |

Replaced: round 1's `cr11-in` (owner: "only if the request text arrives before the schema work starts"). Round 2 asks the question again
because the owner has now reviewed the schema himself, and its recommended answer is taken. This takes embed from "wait" to "build", so
it is the decision most worth an owner's look. Embed stays third in the cut order, after the gauge and the bullet chart.

## FR-09: CR 14, limits on a variable's value

Owner's call: Change. Owner's note, quoted exactly: "is this part of slideTemplates? or layouts? or variables? I like the idea I'm just
confused". Answered in round 2: it is variables (`maxLength`, `maxLines` and `maxItems` sit on a variable's declaration); layouts only
matter because `maxLines` is measured where the variable is drawn.

| Question | Options | Answer | Who |
| --- | --- | --- | --- |
| `cr14-count`: What does `maxLength` count? | Characters as a reader sees them (recommended); code units | Characters as a reader sees them (grapheme clusters) | Owner, 2026-11-24 |
| `cr14-lines`: Where is `maxLines` checked? | By composition, at each place the variable is drawn (recommended); by validate | Composition | Owner, 2026-11-24 |
| Round 2: Does it ship in 0.37, ahead of slide templates? | Yes, it works with today's deck templates (recommended); no, move it with slide templates | Yes (the review's option key for this answer is `036`, the old release number) | Supervisor, 2026-11-25, on the owner's delegation; he can overrule |

## FR-10: CR 15, translations and localized date names

Owner's call: Keep, with every recommended answer. No note.

| Question | Options | Answer | Who |
| --- | --- | --- | --- |
| `cr15-locale`: Add a `locale` field as asked? | No, a subtag on `language` says it (recommended); yes | No | Owner, 2026-11-24 |
| `cr15-pick`: Which language selects a translation? | The language where the variable is drawn, slide else deck (recommended); always the deck's | Where it is drawn | Owner, 2026-11-24 |
| `cr15-names`: Where do month and weekday names come from? | A generated table, measured before it is committed (recommended); the runtime's own data | A generated table | Owner, 2026-11-24 |

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

Round 1 left these unanswered. The owner's decisions of 2026-11-24 settled two (R3 and R5), as the plan page says.

| # | Question | Options | Answer | Who |
| --- | --- | --- | --- | --- |
| R1 | How does one release stay shippable? | One release with a cut order agreed now (recommended); one release, nothing may be cut; back to three releases | One 0.37.0 with the cut order of the README (gauge, bullet, embed, localized date names, `dataset-stale`); a change not accepted in PowerPoint by the release date follows as an addition in a patch | Supervisor, 2026-11-25, on the owner's delegation; he can overrule |
| R2 | Where does the work land while it is built? | On `main`, each change whole, in order (recommended); on an integration branch | On `main`, each change whole, in the order of the README | Supervisor, 2026-11-25, on the owner's delegation; he can overrule |
| R3 | Do the layout sweep's drawing changes ride with the format changes? | Yes, they ride along (recommended in the review); no, they take a minor of their own first | No: the sweep and the other post-0.35.1 fixes ship first as 0.36.0, and the format changes are 0.37.0 | Owner, 2026-11-24 |
| R4 | Do the breaking proposals that wait for a minor ride along? | No, apart from CR 1's flat dataset, 0.37.0 only adds (recommended); take the six-column grid; take both | No. Decide the fill vocabulary (opf#1275) and the six-column grid (opf#1281) later, build neither here. The one breaking change is CR 1 (FR-04), with an `opf fix` rewrite | Supervisor, 2026-11-25, on the owner's delegation; he can overrule |
| R5 | Do the schema identifiers move to openpresentation.com? | Move, with a safe fix; keep them on openpresentation.org (recommended); accept both | They stay on openpresentation.org. No `$schema` fix, no document changes | Owner, 2026-11-24 (his product split) |
| R6 | STORYD's launch also expects editor features. Are they part of 0.37.0? | A parallel track, comment anchors designed alongside CR 6 (recommended); all in 0.37.0; none | A parallel track in the cloud-editor program; only the anchor design rides with FR-02 | Supervisor, 2026-11-25, on the owner's delegation; he can overrule |
| R7 | Merge the governance and conformance branch before any of this? | Yes, first (recommended); later | Yes, first. Already merged as opf#1419 on 2026-11-24, with the sentence that Data Advantage holds the names and neither is a registered trademark. Every item adds its cases to that suite | Supervisor, on the owner's go-ahead of 2026-11-24 for good pull requests in the plan; done |
| R8 | What does a 0.36 reader say about a 0.37 document? | The validator names the release a field needs (recommended); a version field in documents; nothing | The validator names the release a field needs, from a small table built with the schema, for example `opf/unknown-key /slides/2/locked: "locked" needs OPF 0.37 or later; this validator is 0.36.0`. No version field | Supervisor, 2026-11-25, on the owner's delegation; he can overrule |

R8 needs an item no change owns: the table of "field needs release" is built with the schema, so the first item that adds a schema key
(FR-01) adds the generator and each later item adds its rows.
