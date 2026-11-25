# Format requests: burndown

Goal and boundary: [README.md](README.md). Decisions: [decisions.md](decisions.md). Status values: `todo`, `in-progress`, `done`,
`partial`, `descoped`. Whoever changes an item's state edits its row and appends a line to its progress log in the same pull request.
Every item also meets the definition of done in the README; the acceptance column lists what is particular to the item.

| ID | Item | Acceptance | Status |
| --- | --- | --- | --- |
| FR-01 | CR 7: an `id` on the document | [Below](#fr-01-the-document-id-cr-7) | done |
| FR-02 | CR 6: ids on list items, bullets, timeline events and table rows | [Below](#fr-02-ids-inside-a-deck-cr-6) | done |
| FR-03 | opf#1297: links to a slide of the same deck, `slide:<id>` | [Below](#fr-03-links-to-a-slide-opf1297) | done |
| FR-04 | CR 1 with CR 3: data sources and a flat dataset | [Below](#fr-04-data-sources-and-a-flat-dataset-cr-1-with-cr-3) | done |
| FR-05 | CR 2: typed dataset columns | [Below](#fr-05-typed-columns-cr-2) | todo |
| FR-06 | CR 4: a metric computed from data, with its change | [Below](#fr-06-a-metric-computed-from-data-cr-4) | todo |
| FR-07 | CR 5: table color scale, bands with the bullet chart, and the gauge | [Below](#fr-07-table-color-scale-bands-with-the-bullet-chart-and-the-gauge-cr-5) | in-progress |
| FR-08 | CR 11: embed | [Below](#fr-08-embed-cr-11) | in-progress |
| FR-09 | CR 14: limits on a variable's value | [Below](#fr-09-limits-on-a-variables-value-cr-14) | done |
| FR-10 | CR 15: translations and localized date names | [Below](#fr-10-translations-and-localized-date-names-cr-15) | in-progress |
| FR-11 | What a validator says about a key it does not know | [Below](#fr-11-what-a-validator-says-about-a-key-it-does-not-know) | done |

Order of landing: FR-01 to FR-03 (ids), FR-04 to FR-07 (data), FR-08 (embed), FR-09 and FR-10 (variables). The tracks do not depend on
each other, so an item lands when it is ready and each later branch merges `main` first; FR-09 was the first to land. Nothing is cut
(owner, 2026-11-25): 0.37.0 ships when every item here is done. Each item adds an example deck and validation rules that the same count
lines track, so the pull requests merge one at a time.

## FR-01: the document id (CR 7)

A deck has a name and a filename, and neither says "this is the same deck". The root takes an optional `id`, kept when the deck is saved,
exported, imported and published, so a re-imported deck updates the stored one and a host can tell a new version from a copy. The MCP
viewer keys its editing session on it, which ends the collision of two decks both named "Untitled".

Acceptance:

- The root `id` is an optional opaque string. The schema enforces no form (no UUID, no URL); core never mints one.
- An id is kept on save, export, import and publish, and is new on duplicate, fork and fill from a template (the host, or `opf create` and
  `opf fill`, mints it).
- The docs call the id a claim, not a credential: a host checks ownership before an id selects a stored deck.
- The PowerPoint document tag carries the id and it survives a save in PowerPoint; an export with provenance turned off drops it, and
  the export report says so. A deck with no id exports the same bytes as before.
- The MCP viewer keys its session on the id and falls back to the name only when there is none.
- Conformance: a valid deck with an id and a valid deck with an id in the form a host uses (`dk_...`); a Markdown and YAML round trip
  keeps it. The editor and `opf edit` keep it through every patch.

Progress log:

- 2026-11-25: done, opf#1465. The PowerPoint document record carries the id as a top-level key, not inside its validated metadata: a
  released 0.36.0 importer ignores an unknown top-level key but drops a whole record that has one inside a validated section. Checked
  in PowerPoint: the id comes back from the export and from PowerPoint's own save, with full provenance and with references only; with
  provenance off there is none. The MCP's bundled documentation limit went up to 1,482,000 bytes.

## FR-02: ids inside a deck (CR 6)

A comment or a live edit can name a slide or a block, but inside a list or a table it can only say "the second item", which points at
the wrong thing as soon as an item is inserted above. Items, bullets, timeline events and table rows may carry an id. Diff, merge and
the `@id` path token already match any array element by id; only the schema forbids it.

Acceptance:

- A list item, a bullet and a timeline event may be a string (unchanged) or an object with an `id` and its text; a table row may be an
  array (unchanged) or an object `{ id, cells }`. One core helper hands engines a single form of a row. Dataset and chart data rows get
  no ids.
- An id is unique in the whole deck, one namespace with slide and block ids. A duplicate item or row id is an error, with a conformance
  case.
- Ids stay optional: a deck with none is valid and is addressed by position. A deck with no item or row ids exports the same PowerPoint
  bytes as 0.36.0.
- `assignIds` adds item ids only when asked (`{ items: true }`); it numbers in order by default (`block-1`, `it-5`), and a host passes
  `generate` for random ids where people co-edit. The spec says what a co-editing writer must do and gives a recipe.
- Edit, move and reorder keep the id. A copy inside a deck gets a new id; a split keeps the id on the first part; a join keeps the first
  id; a paste from another deck keeps an id that is free and replaces one that is taken. The editor does all of this.
- A list or table split across pages keeps each item's id; only the continued block takes the existing `--2` suffix.
- The PowerPoint tags carry the ids and they survive a save in PowerPoint (one native save test); import reads them back.
- The `@id` path token reaches an item and a row (`/slides/@kpis/blocks/@wins/items/@it-7f3k/text`).
- Comment anchors, which consume these ids, are designed alongside this item as a note in the cloud-editor program; no anchor code ships
  here.
- Conformance: valid decks with item and row ids, an invalid deck with a duplicate id (the same id on two items, and an item id that
  equals a slide id). A Markdown and YAML round trip keeps the ids and does not turn a string item into an object (the known loss of
  comments on rewrite, opf#1274, is not made worse).

Progress log:

- 2026-11-25: done, opf#1462 and opf#1464. Checked in PowerPoint with eight edit cases: retyping an item, typing into a cell and adding
  a row or a paragraph keep the ids; a moved, added or removed shape drops that slide's entry ids with one `entry-ids-not-restored`
  finding, because the slide's native structure no longer matches the stored one (the limit block ids already have). opf#1464 stores
  the authored table with array rows, so a released 0.36.0 importer still restores a table whose rows carry ids.

## FR-03: links to a slide (opf#1297)

A link can go to a web page, a mail address or a phone number, but not to another slide, so an agenda cannot jump to its sections. The
`link` of a text run and of a shape accepts `slide:<id>`, the same `kind:id` spelling as `asset:<id>` and `var:<id>`.

Acceptance:

- The schema accepts `slide:<id>` on a text run's `link` and on a shape's `link`. An unknown slide id is an error in the validator.
- The preview, the presenter, the player and the MCP viewer jump to the slide instead of opening a tab. The PDF writes a go-to-page link
  that counts hidden slides and slides split across pages. PowerPoint exports a native jump to the slide and imports it back as
  `slide:<id>`.
- The editor has a slide picker beside the URL field.
- The presenter's double action (a click on a link opens the page and also changes slides, found by reading the code) is fixed first, in
  its own small pull request with a test, before `slide:` links build on the presenter's click handling.
- Comments are not exported to PowerPoint; that waits for comment anchors.
- Conformance: a valid deck with a `slide:` link and an invalid deck whose link names no slide. The export check is a native PowerPoint
  run of the jump.

Progress log:

- 2026-11-25: done, opf#1463. In PowerPoint every `slide:` link is a slide jump to the right slide, on text, a shape and a table cell,
  and comes back from PowerPoint's own save. A link to a hidden slide is valid: PowerPoint and the editor's presenter follow it, the
  web player does not. The slide manager refuses to delete a slide that other slides link to. Open, from the owner's note of 2026-11-25
  ("do the links work in our preview/viewer components in the opf repo? ideally yes"): the read-only slide view of the MCP viewer and
  of the editor follows slide links and opens web links through its host; a follow-up pull request under this item.

## FR-04: data sources and a flat dataset (CR 1 with CR 3)

Round 3 of the review. A dataset says where it came from in its own keys. A new root map `datasources` describes each place data lives
once (a warehouse, a workbook, an API); a dataset names it and records what was taken, when and by whom. The nested `source` object goes
away entirely: OPF adds no aliases before 1.0, and `opf fix` rewrites an older `source`. This is the one breaking change of the release.

Acceptance:

- The root `datasources` is a map of data sources. A data source takes `title`, `description`, `connector`, `src`, `license`, `refreshEvery`
  (an ISO 8601 duration that no engine acts on) and `extensions`. A data source never holds credentials.
- A dataset takes, beside `columns` and `rows`: `datasource` (a string that is always the id of an entry in `datasources`, or an inline
  data source object of the same shape), `query` (the selection in the data source's own language, which replaces `sheet` and `range`),
  `retrieved` (a date or a date-time), `version` (a free string the source gives its snapshot), `sha256` (the hash of the source file's
  bytes as retrieved) and `generator` (`{ type: "human" | "model", name }`). `source.fields` is dropped and so are `queryLanguage` and any
  transform hash.
- Inline chart data (`chart.data` with columns and rows) takes the same keys, and a chart that references a dataset reports the
  dataset's.
- Errors: `datasource-unknown` (an unknown data source id). Warnings: `datasource-credentials` (a `src` with a user and password, or a
  query parameter named like a key or token) and `dataset-stale` (with a date passed, `retrieved` older than the data source's `refreshEvery`).
- A 0.35 or 0.36 document with `source` fails validation until `opf fix` rewrites it: `src` becomes `datasource: { src }`, `retrieved` and
  the rest move up, `sheet` and `range` fold into `query` (`"FY26!A1:C13"`), `fields` is dropped. The release notes say it. The gallery
  examples use no `source`, so only four docs pages and the skills change.
- Engines never read, fetch or refresh a data source. The keys travel through editing and the PowerPoint document tag unchanged.
- Docs, with one worked example where a caption cites the same source, and an example deck.
- Conformance: valid decks with a data source by id and inline, and invalid decks with an unknown data source and a leftover `source`.

Progress log:

- 2026-11-25: done, in the pull request that adds this line. Checked in PowerPoint twice, the second time after merging `main`: the
  root `datasources` and every data source key of a dataset and of inline chart data come back the same from the export and from
  PowerPoint's own save. A released 0.36.0 importer reads the file as a valid deck but restores no shared dataset; charts and tables
  import the values they show (accepted for the one breaking change). `query` is optional, as the owner asked: a CSV file or rows typed
  into the deck need none.
- 2026-11-25: key names (FR-04b, from the key-names study, the owner's picks): `generator.kind` is now `generator.type` and a data
  source's `refresh` is now `refreshEvery`. Nothing was released with the old names, so there is no alias and no `opf fix` rewrite.

## FR-05: typed columns (CR 2)

A column is a name and an optional number format, so a tool has to guess whether "Month" is time and whether "Revenue" can be summed. A
column may say what it holds.

Acceptance:

- A dataset column takes `type` (`text`, `number`, `date` or `boolean`, the kinds of value a cell holds), `role`
  (`dimension` or `measure`; time is `type: "date"` with `role: "dimension"`, so there is no third value and no invalid combination) and
  `unit` (a label such as `"USD"`).
- `unit` is a label engines never print; `format` alone decides how a number is drawn.
- A cell that does not match its column's type is a warning. Core's time-order guess reads the declared type first, and data ingest
  fills the three keys in.
- The data link of FR-06 can refuse to sum a text column.
- Conformance: valid decks with typed columns; the warning has no conformance case. A Markdown and YAML round trip keeps the keys.

Progress log:

## FR-06: a metric computed from data (CR 4)

A KPI on a slide is a typed number, so it disagrees with the table beside it when the data changes. A metric gets a `data` link that
computes its value and, optionally, its change from rows embedded in the deck. The change is part of the metric, and it is optional.

Acceptance:

- `metric.data` takes `dataset`, `field`, `aggregate` (`sum`, `mean`, `min`, `max`, `count`, `first`, `last`), an optional `filter` (a
  list of `{ field, op, value }` with `=`, `!=`, `<`, `<=`, `>`, `>=` and `in`; nothing is parsed or evaluated) and an optional `delta`.
- `delta` computes the change by `compare: "previous"` (the same aggregate over the rows before the last one, in dataset order), by
  `compare: { filter }` (the same aggregate under another filter) or by `field` (a column that already holds the change), with `as`
  (`difference` or `percent`) and a `format` with sign sections.
- A new `metric.better` (`up` or `down`) says which direction is good, so the color follows the data after a refresh. An explicit
  `sentiment` still wins. With a computed change and no typed `trend`, the arrow follows the sign (positive up, negative down, zero flat).
- The literals `value` and `delta` stay as the last computed numbers, so an older reader and PowerPoint still draw a number. A typed value
  or delta that differs from the computed one is a warning with a safe fix.
- Core computes from the rows in the deck and never fetches. A data link to an unknown dataset or field is an error. A link to a text
  column refuses `sum` (see FR-05).
- The link is one shared definition (`{ dataset, field, aggregate, filter }`), so a variable can use it if CR 13 returns.
- Conformance: valid decks with a computed metric (value only, with `previous`, with a baseline filter, with a delta column); invalid
  decks with an unknown dataset and an unknown field.

Progress log:

## FR-07: table color scale, bands with the bullet chart, and the gauge (CR 5)

Redone on OPF's own terms, not on the requesting tool's shapes. `chart.type` lists only what the preview and PowerPoint draw as native charts, so a heatmap
is a table option, the bullet is a chart type with value-axis bands, and the gauge is a way to draw a metric. Built in this order:
the table color scale, then bands with the bullet chart, then the gauge. Each part is its own pull request with its own PowerPoint check.

Acceptance:

- **Table color scale.** `table.colorScale` (`columns`, `from`, `to`, an optional `mid` for a diverging scale) shades the named columns'
  number cells between scheme colors; the text color follows each cell for contrast. It exports as a native table with cell fills.
- **Bands and the bullet chart.** `chart.bands` shades value ranges (`{ to, label }`, from scheme neutrals) on the value axis of bar,
  column, line and area charts, filling the slot `referenceLines` reserves; in PowerPoint they are series drawn behind the data. A new
  chart type `bullet` is a bar chart with a target marker per category (`mapping.target`) and bands, thin bars by default; it exports as
  a native bar chart with the target as a marker series. A gallery chart-type record and previews are added for it.
- **Gauge.** A metric with a `scale` (`min`, `max`, `bands`) draws its value on an arc with its bands, and exports as native `blockArc`
  preset shapes with the value as text, so it stays editable. It binds to data like any metric (FR-06). Built last.
- Colors come from the color scheme, never as raw colors. The sentence that every chart type is native in PowerPoint stays true.
- Each part: the preview path, the PowerPoint export and import, goldens by the `golden.yml` workflow, and a native acceptance run
  (Windows and Mac where the part is drawn). A part that fails its run is fixed before the release; nothing is cut.
- Conformance: valid decks for each part; an invalid deck for a band or color scale that names no column or has no data.

Progress log:

## FR-08: embed (CR 11)

A content kind for something live shown in a web presenter, such as a dashboard or a prototype: a picture everywhere else. Today the only
ways to point at one are a link in a text run or a video placeholder used for something that is not a video.

Acceptance:

- A new content kind `embed` with `src` (an https URL; engines never load it), `title` (the accessible name; without it the site name),
  `aspectRatio` (default 16:9) and `preview` (an optional picture, `asset:<id>`). The shorthand string `{ "embed": "https://..." }` means
  `{ src }`, as for an image.
- A web presenter may show it in a sandboxed frame when its host allows; the host decides which sites. PDF, PNG, PowerPoint and print
  draw `preview`, or without it a card with the title, the site name and a link icon, linked to `src`. PowerPoint export is a linked
  picture.
- It is a separate kind from `video` (video plays media, embed shows a page).
- The editor, the composition and the gallery layouts that accept a content kind handle it; none of the gallery narratives gains a finding.
- Conformance: valid decks with the full form and the shorthand; invalid decks with an `http:` URL and with no `src`.

Progress log:

## FR-09: limits on a variable's value (CR 14)

A template has a headline slot sized for a short line, and a longer value is found only at render time. A variable's declaration may say
how much room it has, in any deck that has variables; deck templates (`template: true`, filled by `opf fill`) already use them, so this
does not wait for slide templates.

Acceptance:

- A variable takes `maxLength` (counted in characters as a reader sees them: grapheme clusters), `maxLines` (for a text variable) and
  `maxItems` (for a list variable).
- `variable-overflow` is a warning. `maxLength` and `maxItems` are checked on the value by the validator; `maxLines` is checked by
  composition at each place the variable is drawn, reported with the layout findings and naming the slide, because the line count depends
  on the width of the box.
- A fill form and a model filling a template can read the limits before writing.
- Conformance: none (a warning). A Markdown and YAML round trip keeps the keys. Docs, the author skill and an example deck template.

Progress log:

- 2026-11-25: done, opf#1460. The rule is `opf/variable-overflow` (category `layout`); `opf fill` reports an overflow per record and
  still writes; a limit on the wrong kind of variable is a schema error, with one invalid conformance case. Nothing is written to a
  PowerPoint file, so there was no native check. The lean MCP Worker's unminified and minified size ceilings came back to 3% above the
  measured size in this change.

## FR-10: translations and localized date names (CR 15)

A template for a German team needs German text in its blanks and German dates. Numbers already follow the deck's language; dates do not.

Acceptance:

- A variable takes `translations`, a map from a language tag to `{ value }`. The language that selects it is the language where the
  variable is drawn (the slide's, else the deck's), falling back from `de-AT` to `de` to the plain value. There is no `locale` field; a
  subtag on `language` already says it.
- Month and weekday names in a date's `format` follow that language, from a generated table for the languages the gallery lists, measured
  before it is committed against the edge bundle, the MCP viewer and the site's size limits. A German deck prints "5. März 2026".
- Both parts ship in 0.37.0 (owner, 2026-11-25). They are committed separately, translations first, and the translations pass their
  tests without the date names.
- Conformance: valid decks with translations; a Markdown and YAML round trip keeps them. Docs and an example deck in two languages.

Progress log:

## FR-11: what a validator says about a key it does not know

Objects have been closed since 0.34, so a reader of one release rejects a key a later release adds, and says only that the key is
unknown. The review's answer (decision R8) was a table of "this key needs release N". A released validator cannot know the keys of a
later release, so the table only helps if it ships in a patch of the older line.

Acceptance:

- The `opf/schema` finding for an unknown key names the validator's own version and says that a later OPF release may define the key:
  its help ends with `This validator is OPF 0.37.0; a later OPF release may define "locked".`, and its parameters carry the version as
  `validatorVersion`. A key the validator can suggest a correction for keeps its suggestion and gets no such sentence.
- The docs say what to do: update the package, or check the key against the schema of the release that wrote the document.
- No version field in documents. A table of the keys 0.37.0 adds, shipped in a 0.36.x patch so that 0.36 readers can name the release,
  is built only if the owner asks for it (he planned no 0.36.1).

Progress log:

- 2026-11-25: done, in the pull request that adds this line. The owner confirmed the approach the same day (decision R8). The
  version comes from core's own package version at build time, so a release needs no edit. One sealed editor fixture
  (`source-read-text.golden.json`) was regenerated with its generator on the owner's word; it stores the version as `{{version}}`,
  so a version bump does not move it.
