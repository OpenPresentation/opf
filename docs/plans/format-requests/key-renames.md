# Builder's note: the key renames of the key-names study (0.37.0)

A brief for one pull request that renames eight released keys and widens one list of values. Source: `key-names-study.md` in this folder
(findings B1 to B5 and N1 to N3). The renames of keys that 0.37 itself adds (`generator.type`, `refreshEvery`, `colorScale.colors`,
`metric.gauge`, `Metric.format`) are not here: they go into their own items.

Who decided: **Owner, 2026-11-25, said in the analysis session.** His words: "this is still pre-v1 so we can update any even niggling
things without penalizing users yet"; "i like all you ideas"; for the background key, "ok go with appearance"; and for the font scheme key, after asking whether it needs its "Family", "ok go with
scriptGroup". That these renames go
into 0.37.0 he confirmed the same day, in the analysis session ("yes put the released key renames in 0.37.0") and to the supervisor.
Everything marked *(analysis)* is a choice for the supervisor to confirm.

OPF adds no aliases before 1.0, so each rename is complete: the old key stops validating in 0.37.0, validation says what it became, and
`opf fix` rewrites it. No rename changes what a deck draws.

## The renames

| # | Where | 0.36 | 0.37 | Values |
| --- | --- | --- | --- | --- |
| B1 | `FontScheme` (document schema and `font-scheme.schema.json`) | `languageFamily`: `"latin"`, `"ea"`, `"cs"` (and the long names) | `scriptGroup`: `"latin"`, `"eastAsian"`, `"complexScript"` | A key rename and a value rename. `latin` covers every script outside the other two groups (Cyrillic and Greek too), as today; the description says so |
| B2 | `TableCellStyle` | `verticalAlign` | `anchor` | Same `top`, `middle`, `bottom` |
| B3 | `Speaker` | `organizationId` | `organization` | Same string id; still must name an organization in the deck |
| B4 | `Composition` (document and layout schemas) | `minFontSize`, `maxFontSize` | `minFontSizePx`, `maxFontSizePx` | Same numbers (reference pixels), same ranges and defaults |
| B5 | `Reference` | `url` (any string) | `link` | Now checked with the pattern a run's `link` has, without `slide:`: `^(https?://\|mailto:\|tel:)\S+$` *(analysis: a reference to a slide of the same deck has no use)* |
| N1 | `ImageBackground`, `GradientBackground` | `tone` | `appearance` | Same `dark`, `light`. The deck's root `tone` (its voice) is untouched |
| N3 | `Chart` | `line` | `lineSeries` | Same list of column names |
| N2 | `Line.dash` (a chart reference line's stroke) | `solid`, `dash`, `dot` | The eleven preset names `Stroke.dash` takes | An addition, not a rename; no custom dash arrays on a chart line *(analysis)* |

## Schema and types

- `spec/schemas/opf.schema.json`: the eight changes above, each description updated; `font-scheme.schema.json` (B1) and
  `layout.schema.json` (B4, wherever a layout's composition takes the two keys; the builder confirms from the schema).
- Generated types and the precompiled validators are regenerated. The site freezes each release's schemas by itself.
- Public API names that mirror a renamed key follow it (no alias): for example an option named `tone` that means the background's dark or
  light becomes `appearance`. The builder lists every exported name it changes in the pull request, for the three sites. *(analysis)*

## What a 0.36 deck gets from 0.37, and the fix

Follow the precedent of the keys 0.35 removed (`REMOVED_DESIGN_KEY_FIXES` in `schema-fixes.ts`, attached to the `opf/schema` finding):
one table of renamed keys in core, read by validation and by `fix`.

| Old | Finding (rule `opf/schema`, error) | Fix |
| --- | --- | --- |
| A renamed key (B1's `languageFamily`, B2, B3, B4, B5, N1, N3) | `"{old}" was renamed "{new}" in OPF 0.37.` at the key's path, in place of the generic unknown-key text | id `rename-key`, **safe**, `changesDrawing` not set: a JSON Patch `move` from the old key to the new one |
| `"ea"` or `"cs"` as the value of `languageFamily` or `scriptGroup` (B1) | `"{old}" is written "{new}" since OPF 0.37.` at the value's path | id `rename-value`, **safe**: `replace` with the long name. A 0.36 font scheme gets both fixes: the key in one round of `opf fix`, the value in the same or the next |
| A renamed key whose new key is already present in the same object | The same finding, saying both are present | No safe fix: the author removes one *(analysis)* |
| B5 after the rename, when the value does not match the link pattern (`"acme.com/report"`) | The ordinary pattern finding on `link` | Not safe: a fix titled `Add https://` (kind `patch`, `safe: false`), offered only when the value looks like a host and path. `opf fix` leaves it and reports it *(analysis: prefixing guesses the author's intent)* |

- The rename table also drives the unknown-key message of FR-11: a renamed key never gets "a later release may define the key".
- `opf fix` reaches every place the keys can sit: the deck, each slide, nested blocks and groups, table cells, and the records a deck
  embeds under `catalogs` (font schemes for B1, layouts for B4, themes for N1).
- Gallery layout records are recognized by content hash when a deck embeds a stale copy. The builder checks that no renamed key occurs in a
  gallery layout record (none was found for B4 on `main`); if one does, the hash table gains the old form, as 0.35 did.
- Core's own reading of the keys moves to the new names everywhere; nothing in core accepts an old name outside the fix.

## PowerPoint files

Owner, 2026-11-25, to the release supervisor: "We don't need to worry about backwards compatibility since we don't have existing users just yet all our stuff updated". The
supervisor's application of it replaces the earlier recommendation of this note (records keep the 0.36 spelling, with five conditions):

- **Records store the new spelling.** The exporter writes every record as the deck has it: `organization` in the document record's
  `speaker`, `appearance` on a background and `scriptGroup` with its long values in the document record's `design`, `anchor` in the table
  record, `minFontSizePx` and `maxFontSizePx` in a slide record's `composition`, `lineSeries` in the chart record (if it stores it) and
  `link` in the document record's `references`. There is no table in the PowerPoint package that maps new names back to 0.36 ones, and
  the record docs describe one spelling, the current one.
- **Nothing is proved with the released 0.36.0 importer.** A 0.36.0 importer drops a record that carries a key it does not know; that is
  accepted.
- **Older files still restore, through core's one rename table.** PowerPoint-saved evidence files and decks exported before 0.37 hold
  records in the old spelling. The importer passes each restored record through the rename table of core (the same `rename-key` and
  `rename-value` data `opf fix` uses, see above) before it validates the record. One table, in core; a test asserts that the importer
  applies every entry of it, so a later rename cannot forget the import path. This is reading old evidence, not an alias in the format: a
  deck with an old key still fails validation.
- **Exports are not byte identical, and that is expected.** Every file whose record parts hold one of the keys changes. The builder
  exports the native-acceptance fixtures and the example decks before and after, and lists in the pull request (1) every file whose
  record parts change, and (2) every locked archive and every golden that moves, each by name. The supervisor then asks the owner
  **once**, with that list, for his word on the locked archives; none is refreshed before it. A picture golden should not move (no
  rename changes what a deck draws); one that does is a defect to explain, not to refresh.
- `opf fix` and the validation messages above are unchanged by this.

N2 (more dash patterns on a chart reference line) is the one drawing addition: the preview and the export draw the new patterns
(`c:spPr/a:ln/a:prstDash` with the preset's own name), and import reads them back. A deck that uses none exports as before.

## What moves in the repository

Counts are files on `main` at d05326af that contain the old key; most hits are mechanical.

| Key | Schema | Core | Render | PPTX | Editor | Examples | Gallery | Docs, skills, scripts |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `languageFamily` (key and values) | 2 schemas | 2 src, 6 tests | 12 tests | 2 tests | 2 src, 2 tests | 117 decks (embedded font schemes: every one gets the new key, those with `ea` or `cs` the new value too) | **All 93** font scheme records get the new key; 64 of them also a new value (48 `cs`, 16 `ea`) | 7 native-acceptance files, 5 doc fixtures, 2 skills, programs docs |
| `verticalAlign` | 1 | 2 src, 2 tests | 2 src, 1 test | 2 src, 5 tests | 3 src, 1 test | none | none | 1 native-acceptance file, schema reference, 1 script |
| `organizationId` | 1 | 3 src, 4 tests | none | 1 src, 1 test | none found | 82 decks (97 uses) | none | 2 native-acceptance files, the example generator, 2 skills, 3 docs |
| `minFontSize`, `maxFontSize` | 2 | 20 src, 55 tests | 2 src, 15 tests | 7 src, 15 tests | 7 tests | 1 deck (28 uses of `maxFontSize`) | none in records | 2 skills, handoff and program docs, 3 scripts |
| `Reference.url` | 1 | builder greps `references` handling | references slide | document record | reference editor, if any | none | none | docs |
| background `tone` | 1 | color role resolution, finding texts | background drawing | background export and import | background panel | 1 deck (17 uses) | themes: builder checks | docs |
| `Chart.line` | 1 | combo chart resolution | combo drawing | combo export and import | chart panel | about 5 uses | none | docs, skills |

- **Gallery**: the 93 font scheme records are rewritten by their generator, the gallery tracker and manifest are regenerated in the same
  pull request (a stale tracker only warns on a pull request and then turns `main` red), and the gallery changelog names the change.
  pptx.gallery takes the records at its next sync.
- **Examples**: rewritten with `opf fix`, then regenerated where a generator owns them (`scripts/generate-example-suite.mjs` writes
  `organizationId` today). Picture goldens should not move; PowerPoint files that hold a renamed key in a record do, and the pull
  request lists them (see "PowerPoint files").
- **Editor**: the table cell inspector (B2), the font scheme editor (B1), and any panel for a speaker's organization, composition limits,
  a background's dark or light, a combo chart's line series and a chart line's dash follow the new names.
- **MCP server**: its schema and docs are regenerated; the bundled-documentation and bundle ceilings are measured and reported, not
  edited by the builder.
- **Conformance**: for each rename one valid deck with the new key and one invalid deck with the old one (eight pairs), and for B1 an
  invalid deck with `"scriptGroup": "cs"`.
- **Markdown and YAML**: the round-trip tests use the new names.

## Docs

- A migration note for 0.37 (where the 0.35 note lives): one table, old and new, with the sentence that `opf fix` makes every one of
  these changes and none changes a slide.
- The schema reference, the author, layout and inspect skills, `docs/llm-authoring.md`, the chart and table data page (N3, N2) and the
  templates page follow the new names. The docs state the naming rules the study confirmed, once: `type` for "which sort", `anchor` for
  vertical placement, a bare id for a reference, a unit in the name where a measure has two.

## The changelog fragment

Type `changed`, marked breaking, packages core, render, pptx, editor, gallery, cli, mcp:

- `speaker.organizationId` is `speaker.organization`.
- A styled table cell's `verticalAlign` is `anchor`.
- A composition's `minFontSize` and `maxFontSize` are `minFontSizePx` and `maxFontSizePx` (the same numbers).
- A reference's `url` is `link`, and it must be an http, https, mail or phone link.
- A picture or gradient background's `tone` is `appearance`.
- A combo chart's `line` is `lineSeries`.
- A font scheme's `languageFamily` is `scriptGroup`, and its values are `latin`, `eastAsian` or `complexScript`; `ea` and `cs` are no longer
  accepted.
- A chart reference line's `dash` accepts every preset pattern a shape's outline does.
- `opf fix` rewrites all of the above; no slide draws differently. PowerPoint files written by earlier releases still import: their
  records are renamed as they are read. A 0.37 file's records use the new names, so an importer older than 0.37 does not restore them.

## Order and collisions

Every 0.37 item touches the schema and the example counts, so this pull request takes a turn like the others: it merges `main` first and
lands when no other item is in its golden run. It adds no example deck. It should land before the bump of the three sites, each of which
runs `opf fix` over its own decks at the bump and lists the renamed API names it used.

## Two lessons from the earlier 0.37 builds (supervisor, 2026-11-25)

- **The editor's keyboard browser suites pin completion counts by key name.** A new or renamed key changes how many completions the
  source editor offers at the pinned positions, so those suites fail until their counts are updated. Run them before the pull request
  opens, not after the first red check.
- **The breaking-change gate needs every removed schema path named.** A `type: changed` fragment must name each schema path the change
  removes, in the gate's form (for example `opf.schema.json:$defs.DataSourceRef`); a renamed key is a removed path and an added one.
