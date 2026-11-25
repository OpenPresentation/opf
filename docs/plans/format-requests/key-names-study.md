# OPF key names and datatypes: study of 2026-11-25

A copy, for builders, of the owner's study page (a private artifact). **Every finding is a proposal until the owner picks**; the release
supervisor records each pick in `docs/programs/format-requests/decisions.md` and applies a rename only then. Read: all 17 schemas on `main`
at 457a6321 (978 properties, 393 distinct key names) and the design notes in this folder.

## The thirteen findings at a glance.

Ordered by how soon each needs an answer. "Free" means the key is not released, so a rename has no cost for anyone outside the build.

| # | Finding | Proposed fix | Cost | Answer by |
| --- | --- | --- | --- | --- |
| A1 | `generator.kind` is the only `kind` in the document schema | `generator.type` | Free | Data sources land within the hour; a follow-up rename is still free until 0.37.0 ships |
| A2 | The color scale names its colors `from`, `mid`, `to` and its numbers `min`, `center`, `max` | One `colors` list of two or three | Free | The color scale lands today |
| A3 | `metric.scale` turns a metric into a gauge, and "scale" already means color scale | `metric.gauge` | Free | Before the gauge is built (last item) |
| A4 | A metric number has no `format`, unlike variables, columns and cells | Add `metric.format` | Free, additive | Before the computed metric is built |
| A5 | `refresh: "P1M"` reads like a switch | `refreshEvery` | Free | With A1 |
| B1 | `languageFamily` accepts two spellings of the same value (`ea` and `eastAsian`) | One spelling | 64 gallery records | For 0.37.0 |
| B2 | A table cell says `verticalAlign` where everything else says `anchor` | `anchor` | No example uses it | For 0.37.0 |
| B3 | `speaker.organizationId` is the only reference key that ends in `Id` | `organization` | 97 uses in examples | For 0.37.0 |
| B4 | `fontSize` is in points, `minFontSize` and `maxFontSize` in reference pixels | Say the unit in the name | 28 uses in one example | For 0.37.0 |
| B5 | A reference's `url` is an unchecked string; every other link is `link`, checked | `link`, checked | No example uses it | For 0.37.0 |
| N1 | A background's `tone` (dark or light) shares its name with the deck's `tone` (voice) | `brightness` | 17 uses in one example | For 0.37.0 |
| N2 | A chart reference line's `dash` takes 3 values, a shape's takes 11 | The same list | Free, additive | Any time |
| N3 | A combo chart's `line` holds a list of series | `lineSeries` | 5 uses | For 0.37.0 |

## Free to change now: keys that 0.37 adds.

None of these is released. The release supervisor has the list and applies a rename only on your pick. A key that already merged can still be renamed in a follow-up pull request before 0.37.0 ships.

### A1: `generator.kind` would be the only `kind` in a document.

**The problem.** Wherever a document says which sort of thing something is, the key is `type`: the seven kinds of variable, the five kinds of background, the content kinds, a gradient, an arrowhead, a font scheme. `kind` appears nowhere in the document schema. Data sources would add the one exception. Your answer on this item chose an object over a bare word; the key inside it was my wording, never the question.

**The fix.**
- `"generator": { "type": "model", "name": "…" }`, like every other discriminator.
- One word to learn for "which sort".

As planned or released (Data sources, as built.):

```json
"generator": { "kind": "model", "name": "forecast-v2" }
```

Proposed (The same shape, the format's own word.):

```json
"generator": { "type": "model", "name": "forecast-v2" }
```

**Cost.** Nothing outside the build: the key is not released. One rename in the data sources item, before or just after it merges.

**Decision `k-generator`:** Rename `generator.kind` to `generator.type`?

- **Recommended.** Yes, `type` (One discriminator word across the document.) [`type`]
- No, keep `kind` (It reads slightly more naturally for "human or model".) [`kind`]

Why: A reader who has seen `"type": "date"` on a variable and `"type": "solid"` on a background will type `type` here too, and a closed schema then rejects the deck.

Example: A model writing a deck from the schema card guesses `type` first.

### A2: The table color scale has two triples of keys with unrelated names.

**The problem.** A color scale has numbers (`min`, `center`, `max`) and the colors drawn at those numbers (`from`, `mid`, `to`). An author has to learn that `from` is the color of `min` and `to` the color of `max`. The words `from` and `to` also already mean other things: the two ends of a connector are shape ids, and a band's `to` is a number.

**The fix.**
- One ordered list: two colors is a plain scale, three makes it two-sided around `center`.
- The same shape as a chart's `colors`, which is already a list of scheme colors.
- Three keys become one, and `mid` cannot be set without the others.

As planned or released (As the color scale is being built.):

```json
"colorScale": {
  "columns": ["YoY %"],
  "from": "accent2", "mid": "surface", "to": "accent1",
  "center": 0 }
```

Proposed (Low to high, like the numbers beside it.):

```json
"colorScale": {
  "columns": ["YoY %"],
  "colors": ["accent2", "surface", "accent1"],
  "center": 0 }
```

Rules:
- `min`, `center` and `max` keep their names.
- `center` stays optional and is only valid with three colors. Without it, the middle color sits at 0 when the values span both signs, else at the midpoint of the range.
- Two colors is a plain scale from `min` to `max`.

**Cost.** Nothing outside the build. The color scale lands today: an answer within about two hours goes into its pull request, a later one into a follow-up before the release. The pictures you are shown do not change either way.

**Decision `k-colors`:** Replace `from`, `mid` and `to` with one `colors` list?

- **Recommended.** Yes: `colors`, two or three scheme colors, low to high (Default `["surface", "primary"]`.) [`colors`]
- No, keep `from`, `mid`, `to` (Reads well for the plain case: "from surface to primary".) [`fromto`]
- Rename them `low`, `mid`, `high` (Keeps three keys; pairs better with min and max.) [`lowhigh`]

Why: The order of the list carries the meaning, as it does for gradient stops and chart colors, so there are no names to match up.

Example: `"colors": ["surface", "primary"]` shades low values light and high values strong.

### A3: `metric.scale` draws a gauge, and nothing in its name says so.

**The problem.** Adding `scale` to a metric changes how it is drawn: the number gets an arc. Someone looking for "how do I make a gauge" will not find the word, and someone reading `scale` may expect a multiplier or a size. On a table, "scale" already means the color scale. You decided a gauge is a metric, not a chart type; the key's name was mine.

**The fix.**
- The key says what you get.
- The contents are unchanged: `min`, `max`, `bands`, `target`.

As planned or released (The gauge, as designed.):

```json
"metric": { "label": "Utilization", "value": 0.72,
  "scale": { "max": 1, "bands": [ { "to": 0.6 }, { "to": 0.85 }, { "to": 1 } ] } }
```

Proposed (Same contents.):

```json
"metric": { "label": "Utilization", "value": 0.72,
  "gauge": { "max": 1, "bands": [ { "to": 0.6 }, { "to": 0.85 }, { "to": 1 } ] } }
```

**Cost.** Nothing: the gauge is the last item and has not started.

**Decision `k-gauge`:** Rename `metric.scale` to `metric.gauge`?

- **Recommended.** Yes, `gauge` (Named for what is drawn.) [`gauge`]
- No, keep `scale` (Leaves room for another drawing of the same scale later, such as a linear bar.) [`scale`]

Why: If a second drawing ever comes, it can be a key inside (`"gauge": { "shape": "bar" }`) or its own key. Naming for a future that may not come costs findability today.

Example: An author searching the schema card for "gauge" finds it.

### A4: A metric is the one place a number cannot say how it is written.

**The problem.** A number variable, a dataset column and a table cell each take a `format` such as `0.0%`. A metric does not: to show 4.4% you type the string `"4.4%"`, or the number 4.4 with `"unit": "%"`. The computed metric makes this matter, because its value is a real number from the data. As designed it borrows the column's format, and then prints the metric's `unit` after it, so an author who sets both gets "$4.4M $M".

**The fix.**
- `"format"` on a metric, the same pattern language as everywhere else.
- One rule when a metric is linked to data: the metric's format, else the column's.
- A warning when `unit` repeats what the format already prints.

As planned or released (Today: a string, or a number with a suffix.):

```json
"metric": { "label": "Churn", "value": "4.4%" }
"metric": { "label": "Churn", "value": 4.4, "unit": "%" }
```

Proposed (A number that knows its format; `unit` stays for plain suffixes.):

```json
"metric": { "label": "Churn", "value": 0.044, "format": "0.0%" }
```

**Cost.** One optional key, added with the computed metric. It breaks nothing: decks without it draw as today.

**Decision `k-metric-format`:** Add `format` to a metric?

- **Recommended.** Yes, with the computed metric (Applies to a number `value`; a string is drawn as written.) [`add`]
- No: a linked metric uses its column's format, an unlinked one stays as today (Nothing new to learn, and the double-unit trap stays.) [`no`]

Why: The gauge needs it too: its end labels print with "the metric's format", which today does not exist for an unlinked metric.

Example: `{ "value": 0.72, "format": "0%" }` draws "72%", and its gauge ends read "0%" and "100%".

### A5: `refresh: "P1M"` reads like a switch or a command.

**The problem.** On a data source, `refresh` holds how often the data is expected to be refreshed, as an ISO 8601 duration. The bare word looks like `true` or `false` would fit, and the value is the only ISO duration in the format: the deck's `duration` is whole minutes. Easy to get wrong, too: `P1M` is a month and `PT1M` is a minute.

**The fix.**
- `refreshEvery` says it is an interval. The name alone is the fix.
- The value stays an ISO 8601 duration, which the stale-data check needs and which can say "every 15 minutes"; the docs show the common values `P1D`, `P1W`, `P1M`, `P3M`.

As planned or released (Data sources, as built.):

```json
"finance": { "connector": "postgres", "refresh": "P1M" }
```

Proposed (The same value.):

```json
"finance": { "connector": "postgres", "refreshEvery": "P1M" }
```

**Cost.** Nothing outside the build. Worth doing only together with A1, in the same follow-up.

**Decision `k-refresh`:** Rename `refresh` to `refreshEvery`?

- **Recommended.** Yes, `refreshEvery` (An interval, not a switch.) [`every`]
- No, keep `refresh` (Shorter, and you already read it this way in the review.) [`keep`]
- Keep `refresh` but take words: `"daily"`, `"weekly"`, `"monthly"`, `"quarterly"` (Friendlier than ISO; cannot say "every 15 minutes".) [`words`]

Why: The stale-data warning compares this interval with `retrieved`, so it has to be a length of time. The name should say that.

Example: `"refreshEvery": "P1W"`: a dataset retrieved nine days ago is reported as stale.

## Released keys: each is a rename that `opf fix` can make.

These are in 0.36.0 today. OPF adds no aliases before 1.0, so each fix is a plain rename: an old deck fails validation with a message naming the new key, and `opf fix` rewrites it without changing what it draws. 0.37.0 is already a minor release with one such change (the flat dataset), so these can ride with it. Earlier today you chose that the larger breaking proposals (the fill vocabulary, the six-column grid) do not ride along; after this study started you said that before 1.0 even niggling things can be fixed without penalizing users. So each decision below asks two things at once: whether the rename is right, and whether it goes into 0.37.0 despite that earlier answer. The release supervisor applies only what you pick.

### B1: A font scheme's `languageFamily` accepts two spellings of the same value.

**The problem.** The schema lists `latin`, `ea`, `cs`, `eastAsian` and `complexScript`, and says `ea` and `eastAsian` are "the same value". That is an alias, which your rule forbids before 1.0, and it is the only one I found. Every tool that reads the value has to know both spellings.

**The fix.**
- One spelling per value.
- The long names match the keys beside them in the same record, `eastAsian` and `complexScript`.

As planned or released (Both are valid today; the gallery writes the short ones.):

```json
"languageFamily": "cs"
"languageFamily": "complexScript"
```

Proposed (One spelling.):

```json
"languageFamily": "complexScript"
```

**Cost.** The 64 gallery font schemes that say `cs` or `ea` are rewritten (a generator run), and pptx.gallery picks them up at its next sync. Keeping the short names instead costs nothing but leaves the cryptic ones.

**Decision `k-family`:** Which spelling stays?

- **Recommended.** `eastAsian` and `complexScript`, in 0.37.0 (Readable, and the same words as the slot keys.) [`long`]
- `ea` and `cs`, in 0.37.0 (PowerPoint's own element names; no gallery record changes.) [`short`]
- The long names, in a later release (Keeps 0.37.0 to one breaking change.) [`later`]
- Leave both (Keeps the alias.) [`both`]

Why: Most people editing a font scheme do not know PowerPoint's two-letter element names. The long names are already in the same record.

Example: A font scheme for Arabic says `"languageFamily": "complexScript"` beside its `"complexScript": { "major": …, "minor": … }`.

### B2: Vertical placement is `anchor` in six places and `verticalAlign` in one.

**The problem.** Layouts, splits, regions, heading regions and shapes all place content vertically with `anchor: "top" | "middle" | "bottom"`. A styled table cell uses `verticalAlign` for the same three values. I first expected the shape to be the odd one out; counting showed it is the table cell.

**The fix.**
- One word for vertical placement everywhere.
- The values do not change.

As planned or released (A table cell today.):

```json
{ "value": "Total", "style": { "align": "end", "verticalAlign": "bottom" } }
```

Proposed (The word the rest of the format uses.):

```json
{ "value": "Total", "style": { "align": "end", "anchor": "bottom" } }
```

**Cost.** No example deck or gallery record uses `verticalAlign`, so only decks in the wild that style cells are touched, and `opf fix` rewrites them.

**Decision `k-anchor`:** Rename a cell's `verticalAlign` to `anchor`?

- **Recommended.** Yes, `anchor`, in 0.37.0 (Matches layouts, regions and shapes.) [`anchor`]
- Yes, in a later release (Keeps 0.37.0 to one breaking change.) [`later`]
- No, keep `verticalAlign` (Familiar from CSS, and it sits beside `align`.) [`keep`]

Why: Either word works alone. Two words for one idea make authors and models guess, and a closed schema punishes a wrong guess with an error.

Example: A model that has just written `"anchor": "middle"` on a shape writes the same on a cell.

### B3: `speaker.organizationId` is the only reference that ends in `Id`.

**The problem.** Everywhere else a key that names another thing by its id is the bare word: a chart's `dataset`, a slide's `layout`, the deck's `narrative` and `theme`, and now a dataset's `datasource`. A speaker points at its organization with `organizationId`.

**The fix.**
- `"organization": "acme"` on a speaker, like every other reference.
- It also matches where the brand study is heading: a deck that references an organization by id.

As planned or released (A speaker today.):

```json
"speaker": { "name": "Priya Raman", "organizationId": "acme" }
```

Proposed (The bare word.):

```json
"speaker": { "name": "Priya Raman", "organization": "acme" }
```

**Cost.** 97 uses in the example decks, rewritten by `opf fix`. The three sites take the rename at their bump.

**Decision `k-org`:** Rename `speaker.organizationId` to `speaker.organization`?

- **Recommended.** Yes, `organization`, in 0.37.0 (One pattern for references.) [`bare`]
- Yes, in a later release (Keeps 0.37.0 to one breaking change.) [`later`]
- No, keep `organizationId` (It cannot be mistaken for an inline organization object.) [`keep`]

Why: The risk of confusion with the deck's own `organization` key is small: on a speaker the value is always a string id, and the schema says so.

Example: `"datasource": "finance"`, `"dataset": "revenue"`, `"organization": "acme"`.

### B4: Font size has two units, and the key names do not say which.

**The problem.** A run's `fontSize` is in points, the unit people know from PowerPoint. A composition's `minFontSize` and `maxFontSize` are in reference pixels. The same word, different units: 12 in one is 16 in the other. Where the format has two units for one measure it already says so in the name (`width` and `widthPx` on an anchored shape); font size is the place it does not.

**The fix.**
- `minFontSizePx` and `maxFontSizePx`: no value changes, the name tells the truth.
- Or move them to points, so every font size is in one unit.

As planned or released (Composition limits today, in reference pixels.):

```json
"composition": { "minFontSize": 16, "maxFontSize": 40 }
{ "text": "Note", "fontSize": 12 }
```

Proposed (The unit in the name.):

```json
"composition": { "minFontSizePx": 16, "maxFontSizePx": 40 }
{ "text": "Note", "fontSize": 12 }
```

**Cost.** 28 uses of `maxFontSize` in one example deck and none of `minFontSize`. A rename is safe because the old key stops validating; changing the unit under the same name would not be, since a deck could not tell which unit it was written in.

**Decision `k-fontsize`:** What happens to `minFontSize` and `maxFontSize`?

- **Recommended.** Rename to `minFontSizePx` and `maxFontSizePx`, in 0.37.0 (Same numbers, honest names.) [`px`]
- Rename and convert to points: `minFontSizePt`, `maxFontSizePt` (One unit for all font sizes; `opf fix` multiplies by 0.75.) [`points`]
- Leave them (The descriptions state the unit.) [`keep`]

Why: Layout math in OPF is in reference pixels, so the limits are natural there. The name only has to stop implying points.

Example: An author who sets `"maxFontSize": 24` expecting 24 points gets text a quarter smaller than intended.

### B5: A reference's `url` is the one link that is not called `link` and is not checked.

**The problem.** A text run and a shape take `link`, which must be an http or https address, a mail or phone link, or a slide link. A cited reference takes `url`, and it is any string at all. A references slide then links its entry to whatever was typed.

**The fix.**
- `link` on a reference, with the same check as every other link.
- A typo in a citation link is caught by validation.

As planned or released (Any string is accepted.):

```json
"references": [ { "id": "report", "text": "Annual report 2026",
    "url": "acme.com/reports/2026" } ]
```

Proposed (Checked like a run's link.):

```json
"references": [ { "id": "report", "text": "Annual report 2026",
    "link": "https://acme.com/reports/2026" } ]
```

**Cost.** No example deck uses a reference's `url`. `opf fix` renames the key; an address without `https://` then needs the author to complete it.

**Decision `k-reflink`:** Rename a reference's `url` to `link` and check it?

- **Recommended.** Yes: `link`, checked, in 0.37.0 (One word for "follow this", one rule for what it accepts.) [`link`]
- Keep `url`, but check it (No rename; still two words.) [`check`]
- Leave it (A reference's URL is conventional wording.) [`keep`]

Why: `src` is where a file comes from, `link` is where a click goes. A reference's address is the second.

Example: The references slide of an exported PDF has working links, or validation said why not.

## Three niggles, since even small things can go before 1.0.

I had these on the leave-alone list. None is wrong today; each is a small oddity that is cheap to remove now and impossible to remove without aliases after 1.0.

**Decision `n-tone`:** N1. A picture or gradient background says `"tone": "dark"` so text reads on it; the deck's `tone` is its voice. Rename the background one?

- **Recommended.** Yes: `brightness`, in 0.37.0 (`"brightness": "dark"` or `"light"`. 17 uses in one example deck.) [`brightness`]
- Yes, in a later release (Keeps 0.37.0 smaller.) [`later`]
- No, keep `tone` (They never appear in the same object.) [`keep`]

Why: One word should not mean a writing voice in one place and dark or light in another. "Brightness" says what is being described.

Example: `"background": { "type": "image", "src": "asset:hero", "brightness": "dark" }`

**Decision `n-dash`:** N2. A chart reference line's `dash` accepts `solid`, `dash` and `dot`; a shape's outline accepts eleven patterns under the same key. Widen the reference line's list?

- **Recommended.** Yes, the same eleven (An addition: nothing breaks, and it can ship in any release.) [`widen`]
- No, three is enough for a chart (Fewer patterns to draw and export in charts.) [`keep`]

Why: Same key, same meaning, so the same values. PowerPoint's chart lines accept every one of them.

Example: `"referenceLines": [ { "value": 100, "stroke": { "dash": "longDash" } } ]`

**Decision `n-line`:** N3. On a combo chart, `"line": ["Margin"]` lists the series drawn as lines. Rename it so it reads as a list of series?

- **Recommended.** Yes: `lineSeries`, in 0.37.0 (It sits beside `mapping.series` and `highlight.series`. 5 uses in the examples.) [`lineSeries`]
- Yes, in a later release (Keeps 0.37.0 smaller.) [`later`]
- No, keep `line` (Short, and it reads fine with one series.) [`keep`]

Why: A singular key that always holds a list, and whose word is also the name of a chart type and of the stroke definition, makes a reader stop.

Example: `{ "type": "combo", "lineSeries": ["Margin"], "secondaryAxis": ["Margin"] }`

## Looked at, and I recommend leaving alone.

Each of these looked like an inconsistency and turned out to have a reason, or costs more to change than it returns. Tell me if you want any of them reopened.

| What | Why it looks odd | Why I would leave it |
| --- | --- | --- |
| `metric.data.delta` beside `metric.delta` | The same key name, once a number and once an object. | The inner one says how the outer one is computed, as `data.field` does for `value`. That pairing is the design you asked for. |
| `unit` on a column and on a metric | A column's `unit` is never printed; a metric's is. | Different objects, and you decided the column's meaning knowingly. Finding A4 removes the trap where they meet. |
| `datasource`, `datasources` | One lowercase word in a camelCase format (`colorScheme`, `referenceLines`). | It pairs with `dataset` and `datasets`, and it is how you spelled it. |
| `what` and `when` on a timeline event | Every other content uses `text`, `label` or `title`. | An event is exactly a when and a what, the pair is easy to remember, and it has 348 uses in the examples. |
| `tag` on a slide (a drawn badge) and `tags` on the deck (keywords) | Singular and plural of one word for different things. | 117 uses, and no clearly better word for the badge. |
| A quote's `attribution` and `role`, a speaker's `name` and `title` | Two pairs of words for a person and their position. | "Attribution" is the word for a quote, and it may be an organization, not a person. |
| `source` on a quote (a citation), on code and a diagram (the text itself) | One word for where something came from and for the thing itself. | The data meaning goes away with the flat dataset, which removes the worst overlap. |
| `title`, `name` and `label` | Three words for what something is called. | There is a rule: `name` is how others refer to it (a deck, a column, a person), `title` is a display name of a data thing (a dataset, an asset, a data source, an embed), `label` is short drawn text (a metric, a band, a form field). The docs should state it. |
| `language` on code (a programming language) and on text (a human language) | One key, two vocabularies. | The convention of every code block; they sit on different objects. |
| `fit` on a background (`tile`, no `auto`) and on a picture (`auto`, no `tile`) | Two lists of values for one key. | Each list holds what makes sense there: only a background tiles. |
| Three patterns for ids | Variables and catalog ids are lowercase with hyphens; assets and datasets also allow capitals, dots and underscores; organizations and speakers allow no dots. | Each has a reason (an organization id sits inside a dotted variable path). Worth one table in the docs, and a decision before 1.0, not a change now. |

## Checked, and consistent.

What the study confirmed, so the rules can be written down once.

| Rule | What I found |
| --- | --- |
| Key names are one lowercase word, or camelCase | All 393: 303 single words and 89 camelCase. No snake_case, no hyphens. |
| Switching something off | `false` switches off a setting whose value is an object (`footer`, `watermark`, `logo`, a background's `overlay`). `"none"` is a value in a list of choices (`legend`, `listBullet`). No setting does both. |
| One or many | A singular key may hold one value or a list (`speaker`, `organization`, `author`, `audience`, `beat`, `takeaway`, `cite`). A plural key is always a list or a map. |
| Values with several words | OPF's own values use hyphens (`inside-end`, `line-with-markers`, `top-start`). Values that name a PowerPoint preset keep PowerPoint's spelling (`longDash`, `thickThin`), as shape names do. Every value 0.37 adds is a single word. |
| Units | Sizes are fractions of the slide or the frame; line widths, blurs and distances are reference pixels; run font sizes are points; custom slide sizes are inches. Each description says which. Finding B4 is the one place two units share a word. |
| References | A reference to something in the deck is the bare id; inside a string that could be something else it is `kind:id` (`asset:`, `var:`, `slide:`). Finding B3 is the one exception. |
| Discriminators | `type` everywhere in a document. Finding A1 is the one exception, not yet released. |

## Bigger than a rename: for a later study.

Two annoyances that are real but structural. Changing either touches most decks, so they belong with the 0.38 studies, not here.

| What | The annoyance | What a fix would look like |
| --- | --- | --- |
| Options that only apply to one kind of block | A block holds more than fifty keys side by side, and many say "image payloads only" or "shape blocks only" (`fit`, `focus`, `aspectRatio`, `anchor`, `link`, `alt`). A picture's settings are split between the `image` object and the block. Alternative text lives in four places. | Move each kind's options inside its own object, as charts, tables and now embeds do. A large, mechanical migration. |
| Two list fields | `items` and `bullets` draw the same markers, nesting and numbering; `items` also takes descriptions and icons. Authors and models have to pick. | One list field. It needs a look at how layouts tell the two apart today. |

