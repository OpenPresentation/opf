# Format requests for the 0.36 line: analysis and open questions

Status: **analysis only, nothing built** (2026-11-20). This page reads the approved change requests (CR 1 to 17, CR 18
deferred) against the tip of `main` at `c58cf0ba`, which holds the unreleased 0.35 work, and lists what has to be
decided before any of it is designed. Each question carries a recommendation. A recommendation that changes a requested
shape goes back to Michael before it is built (rule 8 of the request).

## Update of 2026-11-23

The rest of this page is the analysis as written on 2026-11-20. Five things have changed since, and where they disagree
with the text below, this section is current.

1. **0.35.0 is released** (2026-11-23), and pptx.dev, pptx.gallery and openpresentation.org are on it. X-02 is settled.
   0.35.1 (three slide fixes, no schema change) is open as
   [OpenPresentation/opf#1414](https://github.com/OpenPresentation/opf/pull/1414); 0.36 work branches after it.
2. **One release, not three** (owner, 2026-11-23). Everything below ships as 0.36.0, landed on `main` in the order A to F,
   with a cut order agreed in advance: gauge and bullet, embed, localized date names, `refresh`, per-value layers of the
   fill record. This replaces the recommendation in X-01.
3. **The project moves to openpresentation.com** (owner, 2026-11-23). The site, the hosted MCP server, the docs and the
   links move with 0.36.0. A document's `$schema` is a `const` in the schema, so moving the seventeen schema ids is
   the one breaking change in the release; the recommendation is to move them with a safe fix in `opf fix`, and to keep
   the old domain redirecting. The old name appears about 1,600 times in each of this repository, pptx.gallery and the
   site.
4. **Open issues and pull requests were read.** Added to 0.36.0: links to a slide of the same deck
   ([opf#1297](https://github.com/OpenPresentation/opf/issues/1297), spelled `slide:<id>` like `asset:` and `var:`),
   the slide `language` round trip ([opf#1404](https://github.com/OpenPresentation/opf/issues/1404)), a duplicate-id
   test over items and rows ([opf#1103](https://github.com/OpenPresentation/opf/issues/1103)), a type test between core
   and the renderer ([opf#1408](https://github.com/OpenPresentation/opf/issues/1408)), and room in the site's llms
   schema chunk before the bump
   ([openpresentation-site#247](https://github.com/Data-Advantage/openpresentation-site/issues/247): 3,544 bytes left).
   The fill record of F-02 is named `filledFrom`, because `fill` already paints a shape and
   [opf#1275](https://github.com/OpenPresentation/opf/issues/1275) would extend that word to backgrounds. A drawing
   change to a gallery layout needs a minor, so the layout sweep
   ([opf#1412](https://github.com/OpenPresentation/opf/issues/1412)) rides in 0.36.0.
5. **Other OPF sessions were read**, the STORYD program's among them. What changes below:
   - D-05: the 32 frameworks are already default gallery narratives (31 on `main`, two on the conformance branch). The
     work is to add the new fields; no beat id is renamed, because STORYD's briefs are pinned to today's ids.
   - A-06: hosts use typed prefixed ids (`dk_`, `dck_`), so the id is an opaque string with no recommended form.
   - E-01: STORYD's lock map has a third state, "swappable", which the four requested aspects do not cover. It waits for
     a definition.
   - X-06: STORYD's first wave also expects transactions, proposals, merge, comment anchors, an asset store, server
     rendering and reflowing PowerPoint body text by default. All but the ids are outside the format and still to do.
   - A-04: a list or table split across pages keeps each item's id; only the continued block takes the `--N` suffix.
   - CR 7 also fixes the MCP viewer, which keys a session on the deck's name because there is no document id.
   - Two requests are still pending approval: chart-type records with `intents`, `dataShape`, `useWhen`, `avoidWhen`,
     and a convention for `extensions` keys.

The original request texts are in the STORYD repository (`docs/opf-change-requests.md`,
`docs/templates-and-variables.md`), which this work could not read. CR 11 still has no text here.

Two pages hold the current proposal: the change-by-change review, with before and after for each change and a
recommendation on each of 65 decisions (`https://claude.ai/artifact/9MfLFtDMZmNFSEjgocinhB`), and the release plan
(`https://claude.ai/artifact/YSMnrQySEPmarTqGH3jevR`). Nothing is built until the review is approved.

What this analysis could and could not see:

- Read: `spec/schemas/`, the core, pptx and editor sources, the docs, the `changes/` fragments, the open pull
  requests, the branch `claude/amazing-faraday-28p6dh`, and the three consumer repositories (pptx.dev, pptx.gallery,
  openpresentation.org) at their default branches.
- Not available: the STORYD repository and the original change request texts. Only the summary table of the request
  was read. pptx.dev holds no copy of them and no list of the 32 story frameworks.

## Decide these first

These ten answers shape everything else. The details are in the numbered questions below.

| # | Decision | Recommendation |
| --- | --- | --- |
| 1 | What "0.36" names ([X-01](#x-01-what-036-names-and-how-many-releases)) | Three minor releases: 0.36.0 (A), 0.37.0 (B, C, D), 0.38.0 (E, F) |
| 2 | Release 0.35.0 before any of this starts ([X-02](#x-02-035-is-not-released)) | Yes: tag 0.35.0 first, branch the 0.36 work from the tag |
| 3 | Merge the governance and conformance branch first ([X-03](#x-03-the-governance-and-conformance-branch)) | Yes, now: it merges clean and passes on today's `main` |
| 4 | How a table row carries an id ([A-01](#a-01-a-table-row-has-nowhere-to-put-an-id)) | A row object form `{ id, cells }` beside today's array form |
| 5 | Whether `Dataset.id` is added at all ([B-01](#b-01-datasetid-already-exists-as-the-map-key)) | No: the `datasets` key is the id; add identity for the source instead |
| 6 | One data binding or two ([B-05](#b-05-cr-4-and-cr-13-ask-for-the-same-binding-twice)) | One `DataBinding` shape, defined in group B, reused by variables in group F |
| 7 | Whether a bound value keeps its literal ([B-06](#b-06-a-bound-value-keeps-its-last-computed-literal)) | Yes: the literal stays and the binding sits beside it |
| 8 | How gauge, bullet and heatmap reach PowerPoint ([B-08](#b-08-gauge-bullet-and-heatmap-have-no-native-powerpoint-chart)) | Decide per type before the schema; split CR 5 out if it lags |
| 9 | What a filled deck is ([F-01](#f-01-a-filled-deck-today-has-no-variables-left-to-refresh)) | A deck that keeps its variables and tokens, with values recorded |
| 10 | Whether engines read the old lock extension ([E-02](#e-02-extensionsauthoringlocked-has-no-reader-and-no-writer)) | No: one safe fix migrates it; no engine reads `extensions` |

## Already there, in whole or in part

Rule 1 of the request asks for this list before anything is added.

| CR | What exists on `main` today | What is still missing |
| --- | --- | --- |
| 1 | A dataset's id is its key in the root `datasets` map (`DatasetId`). | `Dataset.extensions`; an identity that survives outside the document |
| 3 | `DataSourceRef` has `src`, `sheet`, `range`, `fields`, `retrieved`, `description`. `retrieved` is the pull time CR 16 asks for. | `sha256`, the transform or query, the generator, the license |
| 6 | `id` on slides, content payloads and overlay shapes. `diff` and `merge` already match **any** array element by a shared string `id`, and the `@id` pointer token resolves in any array. | The schema does not allow `id` on a list item, a bullet, a timeline event or a table row |
| 7 | Nothing. The root has `name` and `filename`, no `id`. | All of it |
| 8, 9 | Named catalog groups with a `source` (`catalogs.acme`), `catalogs.custom`, and 0.35's detection of stale embedded copies of built-in layouts. Cloud-editor item CE-13 ("brand-kit composition and drift") is open and unbuilt. | The two kinds, `extends`, `rev` |
| 10 | Root `takeaway`; beats with `description`, `instructions`, `type`, `layout`, `thoughtCues`; `Slide.beat`. | Per-beat `required`, `slideCount`, `evidence`; `Slide.takeaway` |
| 11 | Nothing: no `embed` kind, issue or pull request. | All of it, and the request text ([X-05](#x-05-cr-11-has-no-request-text)) |
| 12 | Only a sentence in a schema description that suggests `extensions.authoring.locked`. No code reads it. Cloud-editor item CE-10 (`authorizePatch`, read-only mode) is open and unbuilt. | All of it |
| 15 | Numbers the engines generate follow the language's digits and separators, and a `-u-nu-` subtag picks the numbering system (`numerals.ts`, LH-106). | Month and weekday names are English only; `translations` |
| 16 | `opf fill` and `resolveVariables` with a value order of supplied value, then declared `value`, then `example`. | Any record of where a value came from |
| 17 | Dotted built-ins (`organization.name`, `speaker.name`, `deck.name`) that `values` cannot override. | The `brand.` namespace and the brand kit it reads |

CR 2, 4, 5, 13 and 14 have nothing in place.

## Cross-cutting questions

### X-01: What "0.36" names, and how many releases

**Found.** The repository's rule is that a minor release is for a breaking change and everything else is a patch.
Every request here is additive, and 0.34.2 (a patch) did add schema fields (`assistant` and `overlap` on a list item).
By that rule this whole list would ship as 0.35.1 and later patches, not as 0.36. Two things argue against patches:
the document schema is closed, so a 0.35 reader rejects any document that uses a new field; and the sites auto-merge a
patch bump, while group C needs hand changes in pptx.gallery (its kinds are listed by hand in about ten files).

**Question.** Is "0.36" the first release of this list or the whole list?

**Recommendation.** Three minor releases, each named in the adoption notes as the floor for its fields:

- **0.36.0**: group A (CR 6, CR 7). It goes alone because co-editing waits on it.
- **0.37.0**: groups B, C and D (CR 1 to 5, 8, 9, 10), and CR 11 once its text arrives.
- **0.38.0**: groups E and F (CR 12 to 17), which depend on C and B.

A minor bump keeps the site bumps off the auto-merge path, which is what group C needs.

### X-02: 0.35 is not released

**Found.** The newest tag is `v0.34.2` and `packages/javascript/package.json` still says 0.34.2. `main` holds 19
unreleased fragments, including breaking ones (one region key, one arrangement key, removed layouts). Two 0.35 pull
requests are open: [OpenPresentation/opf#1390](https://github.com/OpenPresentation/opf/pull/1390) (fixes write the new
form) and [OpenPresentation/opf#1393](https://github.com/OpenPresentation/opf/pull/1393) (examples rewritten for 0.35).
All three sites pin exactly 0.34.2.
[OpenPresentation/opf#1327](https://github.com/OpenPresentation/opf/issues/1327) (a site bump after a breaking minor
leaves no branch to continue on) is open and will be hit by the 0.35 bump.

**Question.** Does the 0.36 work start on `main` now, or after the 0.35.0 tag?

**Recommendation.** After the tag. If group A lands on `main` first it ships inside 0.35.0 with the breaking layout
changes, and co-editing then cannot be adopted without the 0.35 migration. The pptx.dev and storyd.ai rebuilds should
write 0.35 forms from their first commit (run `opf fix` on any stored deck), so 0.36 is only additions for them.

### X-03: The governance and conformance branch

**Found.** `claude/amazing-faraday-28p6dh` branched at the 0.34.2-era commit `fad9bac9`, before the 0.35 breaking
changes. A trial merge into today's `main` has no conflicts. The suite was run here against the 0.35 core built from
`main`: Core Reader 93 of 93, Core Writer 61 of 61. The branch also adds two narratives (`quarterly-review`,
`operational-review`) and brand documents. Its governance text says "today 0.31.0", which is stale, and does not yet
say who holds the name.

**Recommendation.** Merge it by pull request before group A, with two edits: the version sentence, and the approved
statement that Data Advantage holds the names "Open Presentation Format" and "OPF" and that neither is a registered
trademark today. The rest of the governance document stays marked Proposed. Every later group adds its cases to this
suite.

### X-04: Which process applies

**Found.** The governance draft describes a process (an issue from the schema-change template, seven days of comment
for an additive change) that is not in force. The repository's own convention for cross-repository work is a program
folder under `docs/programs/` with a burndown and item ids.

**Recommendation.** Open a program `docs/programs/format-requests/` with items `FR-01` to `FR-17` matching the CR
numbers, and one tracking issue per group written with the schema-change template, so the decision record the draft
asks for exists without waiting for its comment periods. The burndown's last table is the "request, version, status"
table the STORYD program wants.

### X-05: CR 11 has no request text

**Found.** The request says to ship `embed` if it has not shipped. It has not: the content kinds are text, list,
image, chart, table, video, code, metric, quote, timeline, diagram, shape and group. The request table has no row for
CR 11, so there is nothing to design from.

**Question.** What must `embed` make possible, and what do static outputs show?

**Recommendation.** Get the 2026-11-04 text. Absent other requirements, propose this to Michael: `embed` holds an
`https` URL, a `title`, an optional `poster` image and an aspect ratio; engines never fetch it; PNG, PDF and PPTX draw
the poster with a link, exactly as `video` does today; which origins may load is host policy, not format. Ship it in
0.37.0.

### X-06: Ids do not by themselves unblock co-editing

**Found.** pptx.dev's platform plan expects, besides ids, comment anchors (CE-11), `authorizePatch` (CE-10), proposals
(CE-08), transactions (CE-07), async merge (CE-15) and a realtime decision (CE-16). All six are `todo` in the
cloud-editor burndown. pptx.dev today stores a deck as one string, has no comment or presence tables, and never calls
`assignIds`.

**Question.** Does "co-editing at launch" need only addressable ids from OPF, or these editor items too?

**Recommendation.** Name the minimum now. If launch needs anchors that survive edits, CE-11 has to ship with or right
after 0.36.0; the format change alone gives a host stable addresses and id-matched merge, nothing more.

### X-07: Older readers reject newer documents

**Found.** The root, `Slide`, `ContentPayload`, `Dataset`, `DataColumn`, `DataSourceRef` and each variable kind are
closed objects. A document that uses one new field fails validation in every older reader, including the hosted MCP
server until its site is bumped. A document does not say which release it needs; `$schema` names the `v1` line only.

**Recommendation.** No new version field. The validator's unknown-key message for a field a later release added should
say so ("`locked` needs OPF 0.38 or later"), from a small table generated at build time. Publish the adoption floor per
CR in the report.

### X-08: Markdown and YAML forms

**Found.** Every `opf` command reads and writes `.opf.yaml` and `.opf.md`. YAML carries any field. Markdown has its own
syntax for a slide and its blocks.

**Question.** Does each new field need a Markdown spelling (an item id, a lock, a slide takeaway)?

**Recommendation.** No new Markdown syntax in these releases. Each field must survive a Markdown round trip through the
form Markdown already uses for fields it has no syntax for; add a round-trip test per CR. If Markdown has no such form
for item-level fields, that is a finding to bring back before group A ships.

### X-09: Which lint rules are errors

**Found.** The conformance suite defines conformance as format and reference errors only; accessibility, layout and
content findings are advice. So most of the requested lint rules can have no conformance case.

**Recommendation.** Fix the severities now, since rule 4 asks for conformance cases per change:

| Rule | Severity | In conformance |
| --- | --- | --- |
| A duplicate item or row id | error | yes |
| `variable-locked` (a supplied value for a locked constant) | error | yes |
| A binding that names an unknown dataset or field | error | yes |
| `variable-overflow` | warning | no |
| `variable-stale` | warning, only when the host passes the date | no |
| `literal-constant` | note, in the audits a user opts into | no |
| A required beat with no slide | warning | no |

## Group A: ids

### A-01: A table row has nowhere to put an id

**Found.** A list item and a bullet have an object form that can take an `id`. A table row is an array of cells
(`rows: [[cell, cell], ...]`), so it cannot.

**Question.** Which shape carries a row id?

| Option | Works with `@id` pointers and the diff matcher | Cost |
| --- | --- | --- |
| A row object `{ "id": "r1", "cells": [...] }` beside the array form | yes | every reader of `table.rows` handles two forms |
| A parallel `rowIds` array | no | a patch that removes a row must also remove its id, or they drift |
| A key column (`table.key`) | no | the id changes when the cell text is edited |

**Recommendation.** The row object, with one core helper that returns rows in a single form so the renderer, the
exporter, the editor and the converters do not each branch.

### A-02: A string item cannot carry an id

**Found.** `items: ["One", "Two"]` is the common form, and the form a model writes. Only the object form
`{ "text": "One" }` can take an `id`. Today `assignIds` fills slides and payloads only.

**Question.** Should `assignIds` rewrite every string item as an object so it can hold an id?

**Recommendation.** Not by default. Add `assignIds(doc, { items: true })`; a host that co-edits turns it on. A deck
nobody co-edits keeps its short form, and the Core Writer rule (write a document back unchanged) is not strained.

### A-03: One id namespace or one per list

**Found.** Slide and payload ids share one document-wide namespace today. The `@id` pointer token resolves inside one
array, so per-list uniqueness would be enough for patches.

**Recommendation.** One document-wide namespace for slides, payloads, items, bullets, events and rows, checked by the
existing duplicate-id rule. A comment anchor is then one string with no path, and it survives an item moving to
another list.

### A-04: How ids are generated, and what a writer does

**Found.** `assignIds` writes `slide-1`, `block-1` in document order, which is deterministic. Two people who each add
an item offline both mint `item-5`, and a slide pasted from another deck brings ids the target may already use.

**Recommendation.** State these rules in the spec, and test each in the editor:

- An id is an opaque non-empty string. Readers never parse it.
- `assignIds` keeps its ordered default for offline, repeatable use. A writer that co-edits passes `generate` and mints
  random ids (the docs give a short recipe).
- Edit, move, reorder: the id stays.
- Copy inside a document: the copy gets a new id.
- Split: the first part keeps the id; each other part gets a new one.
- Join: the result keeps the first id.
- Paste from another document: keep an id that is free, replace one that is taken.
- A document with no ids is valid. A reader addresses it by index and never adds ids unless asked.

### A-05: Scope beyond the three named things

**Question.** CR 6 names list items, bullets and table rows. Should timeline events and dataset rows get ids too?

**Recommendation.** Add timeline events now (the same closed-object pattern, the same co-editing need). Leave dataset
and chart data rows out: they are data, edited by re-import, and a comment on a dataset-backed table row can name the
row's key cell. Say this limit in the report.

### A-06: The root `id`

**Found.** Core is pure: no clock and no randomness. PPTX round trips already carry document fields in the
`OPF_DOCUMENT_V1` tag, so the id has a home there, but only when the export keeps provenance.

**Questions.** What form is the id, who mints it, and when does a copy get a new one?

**Recommendation.**

- An opaque string; the docs recommend a UUID. Core never mints one. `opf create` and hosts do.
- Kept on save, export, import and publish. A new id on duplicate, fork and fill from a template (the template's id
  goes into the fill record of CR 16).
- The docs say plainly that the id is a claim and not a credential: an imported file can carry any id, so a host must
  not let an id alone select a stored deck to overwrite.
- PPTX: written to `OPF_DOCUMENT_V1`; an export with provenance off drops it, and the report says so.

### A-07: PPTX round trip of item and row ids

**Found.** Block ids travel in the slide's `OPF_SLIDE_V1` content topology in `full` provenance. List entries have
per-list records there already.

**Recommendation.** Extend those list and table records with the ids. Import restores an id only while the entry it
belongs to is still recognizable; after an edit in PowerPoint that adds or removes entries, unmatched entries come back
without ids and one finding says how many. This needs a native PowerPoint save test, like the other provenance records.

## Group B: data

### B-01: `Dataset.id` already exists as the map key

**Found.** `datasets` is a map keyed by id, and charts and tables reference that key. An `id` field inside the dataset
would be a second copy that can disagree with its key.

**Question.** Does the requester mean the id inside the document (exists) or an identity outside it (a connector's
dataset)?

**Recommendation.** Do not add `Dataset.id`. Add `Dataset.extensions`. For identity outside the document, add `id` and
`rev` to the dataset's `source` (CR 3 touches that object anyway, and CR 16 needs the revision).

### B-02: Three column fields that overlap

**Found.** CR 2 asks for `type` (number, date, category, text), `role` (dimension, measure, temporal) and `unit`.
`role: "temporal"` repeats `type: "date"`. `unit` overlaps the column's number `format` (`"$#,##0"`) and
`Metric.unit`. Cells are strings, numbers, booleans or null, so a date is a string.

**Recommendation.**

- `type` as asked. A `date` column holds ISO 8601 strings; a cell that is not one is a warning.
- `role` with two values, `dimension` and `measure`. Time is a dimension whose `type` is `date`. This changes the
  requested shape, so it goes to Michael.
- `unit` as a plain label (`"USD"`, `"users"`) that engines never print on their own; `format` stays the only thing
  that changes how a number is drawn. State which wins so there is one answer.
- Core's time-order detection (`chart-time-order.ts`) reads `type` first and falls back to today's guess.

### B-03: Provenance fields need exact meanings

**Questions and recommendations.**

- `sha256`: of what? Recommend the source file's bytes as retrieved, lowercase hex, the form the catalog indexes use.
  A hash of the rows is what `documentHash` tooling can already give.
- `transform` or `query`: one of them. Recommend `query` as a string with an optional `queryLanguage`, and a doc
  warning that a query may hold private names and must never hold credentials.
- `generator`: recommend `{ "kind": "human" | "model", "name": "..." }`, not a bare word, so a model can be named.
- `license`: recommend an SPDX id or a URL, validated only as a string.

Engines still never read, fetch or refresh a source; that sentence stays.

### B-04: Tracing a number shown on a slide

**Found.** The format already has `references` and captions with citations. CR 3 puts provenance on the data.

**Recommendation.** No new construct. Document the path: block, then its dataset, then `source`. Add one example deck
where a chart's caption cites the same source its dataset records.

### B-05: CR 4 and CR 13 ask for the same binding twice

**Found.** CR 4 binds a metric to `{ dataset, field, aggregate }`. CR 13 binds a variable to
`{ dataset, field, aggregate, filter }`. A metric can already take its value from a variable (`"value": "var:arr"`).

**Recommendation.** One `DataBinding` definition, `{ dataset, field, aggregate, filter }`, added in 0.37.0 and used by
the metric; group F reuses it for variables unchanged. Aggregates: `sum`, `mean`, `min`, `max`, `count`, `first`,
`last`. The filter is a small structure of field, operator and value, not an expression string, so nothing is parsed
or evaluated.

### B-06: A bound value keeps its last computed literal

**Found.** `Metric.value` is required. The variables page states that variables are not computed. A reader older than
the binding, and every PPTX, needs a number to draw.

**Recommendation.** The binding sits beside the literal: `metric.bind` with `metric.value`, and later `variable.bind`
with `variable.value`. The literal is the last computed value. Core computes from the embedded dataset only, which is
still pure and offline. A literal that differs from what the binding computes is a warning with a safe fix. This is
what lets a refresh rewrite only bound values (CR 16), and it needs nothing new in PPTX.

### B-07: Delta and trend of a bound metric

**Question.** A KPI slide shows a change as well as a value. Does `delta` bind too?

**Recommendation.** Allow the same binding on `delta` in the same release. `trend` and `sentiment` stay typed. Do not
add period-over-period arithmetic to core; a host that wants it writes a column that holds it.

### B-08: Gauge, bullet and heatmap have no native PowerPoint chart

**Found.** `chart.type` is described as the types OPF draws natively in its preview **and** in PPTX. PowerPoint has no
gauge, bullet or heatmap chart. A gauge and a bullet also need a scale, bands and a target, which the
`columns` and `rows` model has no place for.

**Questions.** What does each type export as, and what is its data shape?

**Recommendation.** Decide both before the schema, and ask metricgen for its data contract for the three types:

| Type | Export | Data |
| --- | --- | --- |
| `heatmap` | A native table with cell fills from a sequential scale: editable and readable by a screen reader | A category column, then one column per series |
| `gauge` | A native doughnut built to show an arc, with the value as text | One value, with `scale` and `bands` as chart options |
| `bullet` | A native bar chart with the target drawn through `referenceLines` | Value and target columns by `mapping`, bands as chart options |

Each needs a renderer path, an export path, goldens, a gallery chart-type record with previews and a native PowerPoint
check. This is the largest engine item in the list. If it lags, release CR 1 to 4 without it rather than hold data
import. Also amend the `chart.type` description so it stays true.

## Group C: catalogs

### C-01: What a slide template record is

**Found.** A layout record holds regions and no content. A whole-deck template exists today (`template: true` with
root `variables`). Variables are deck-wide: inserting the same slide template twice gives two slides that share one
`headline` variable.

**Questions.** What does the record hold, and what happens to its variables on insertion?

**Recommendation.**

- The record: `{ kind: "slide" | "block", slide | block, variables }` plus the usual name, summary, tags and preview.
- Insertion is an explicit authoring operation in core. By default it fills the template's variables and writes plain
  content, and records where the slide came from (record reference and `rev`) on the slide itself. A host that wants
  the variables kept gets them prefixed so two insertions do not collide.
- Schema files `slide-template.schema.json` and `brand-kit.schema.json`, group keys `slideTemplates` and `brandKits`.
  openpresentation.org finds a kind's schema by dropping the final "s" of the kind's URL segment, and these names fit.

### C-02: What a template depends on

**Question.** A slide template can reference a layout, icons, images and a dataset. How do they travel?

**Recommendation.** A template record may reference only records of its own catalog group or the default catalog, and
images as data URIs or `https` URLs that engines never fetch. Embedding a template into a document embeds what it
references, as `embed()` does for a layout today. A template that needs a dataset declares its columns, not its rows.

### C-03: Brand kit against organization and theme

**Found.** `organization` already holds a name, a legal name, a tagline and logos in four shapes, and exposes them as
built-ins. A theme already pairs a color scheme and a font scheme. A brand kit as asked would be a third place for
logos and a second place for colors and fonts.

**Recommendation.** A brand kit references and does not copy: it names its theme, lists the color schemes and font
schemes it allows by reference, may hold one organization-shaped identity, and owns only what is new: `constants` and
the allow-lists. When a deck selects a brand kit, its `organization` built-ins come from the kit unless the deck sets
its own.

### C-04: How a deck selects its brand kit

**Found.** No field does this. CR 17 says constants are "read from the embedded brand kit", which is ambiguous once a
document embeds two.

**Recommendation.** One root reference, `design.brandKit`, resolved like `design.theme`. More than one embedded kit is
fine; only the selected one feeds `brand.`.

### C-05: Lint for allowed colors and fonts

**Found.** The request gives the kit allow-lists and names no rule that checks them.

**Recommendation.** Two policy warnings, `brand-color-not-allowed` and `brand-font-not-allowed`, reported only when a
kit is selected. Without them the allow-lists do nothing.

### C-06: The shape of a constant

**Question.** What do `locked`, `approved` and `supersedes` hold?

**Recommendation.** A constant is a typed value like a variable (text, number, date, image, url), plus `locked`
(boolean), `approved` (`{ by, on }`, both plain strings, never checked by an engine) and `supersedes` (the id of the
constant in the same kit that it replaces, so a deck using the old id gets a finding that names the new one).

### C-07: What `extends` means

**Questions.** Which kinds can extend which, how do values combine, and what does a document embed?

**Recommendation.**

- A record extends a record of the same kind only. "A brand kit layered on a base theme" is then a brand kit that
  names the theme (C-03), not a cross-kind `extends`. This changes the requested reading and goes to Michael.
- Objects merge key by key; arrays and scalars replace. At most eight levels; a cycle is an error.
- A document embeds the **resolved** record, so it still renders with no catalog, and keeps `extends` and `rev` beside
  it as its origin.

### C-08: What `rev` is, and how drift is found

**Found.** An embedded record today carries no id, origin or digest by rule. 0.35 detects a stale embedded built-in
layout by a content hash against a fixed table of past releases, which cannot work for an organization's own catalog.

**Recommendation.** `rev` is a positive integer that the publisher raises on each change; a content hash is derived,
not written. Embedded records gain an optional `rev` (and `extends`), which loosens the "no origin" rule on purpose.
Drift is a core function that takes the document and the catalog a host registered and reports each embedded record
whose `rev` is behind. It is CE-13; build it once, here.

### C-09: What "published to a user or organization catalog" means in the format

**Found.** The format has named catalog groups with a `source` string. Engines never fetch a catalog. pptx.dev already
turns a catalog URL into a named group. There is no publishing protocol in the spec.

**Recommendation.** Keep it that way: publishing is a host feature. The format's part is the two record schemas and
the existing index and manifest schemas, so any host can serve a catalog the way pptx.gallery serves the default one.
The default gallery ships one example brand kit and three or four slide templates so the kinds are tested.

## Group D: narratives

### D-01: A beat is one slide today

**Found.** The beat description says "One beat is one slide ... split a heavy beat into several beats", and the
planner copies a beat's `type` and `layout` straight onto one slide. `slideCount` with a minimum and maximum
contradicts that.

**Recommendation.** Change the rule: a beat covers one or more slides, and `slideCount` defaults to exactly one, so
all 48 gallery narratives keep their meaning. The planner emits `slideCount.min` slides per beat. A deck whose count
for a beat is outside the range gets a content warning.

### D-02: `required`

**Recommendation.** Absent means not required, so no existing deck gains a finding. A required beat with no slide is a
warning, and only in a deck that references the narrative.

### D-03: `evidence`

**Question.** Free text, or something a tool can check?

**Recommendation.** Both, small: `evidence: { kinds?: [content kinds], note?: string }`. `kinds` lets a checker see
that a beat that needs a chart or a quote has one; `note` holds the prose from the ported frameworks.

### D-04: `Slide.takeaway`

**Found.** The root has `takeaway` (a string or a list). A slide has `title`, `notes` and its beat.

**Recommendation.** A plain string, never drawn, carried through PPTX in the slide tag. One optional audit note when a
slide's title and takeaway share no words, off by default.

### D-05: Where the 32 frameworks live

**Found.** The gallery has 48 narratives (50 after the branch in X-03), among them `scqa`, `pyramid-principle`,
`heros-journey` and `star-method`. The 32 frameworks were not available to compare.

**Question.** Do the 32 become default gallery records, or stay in a STORYD catalog?

**Recommendation.** Compare the list with the 48 first. Frameworks that are public knowledge and not yet present go
into the default gallery as records; anything specific to STORYD stays in its own named catalog. OPF ships the fields
and updates four or five existing records to use them.

## Group E: brand-safe templates

### E-01: The shape and reach of `locked`

**Questions.** What values does it take, does it inherit, and what does it mean on a header or footer zone?

**Recommendation.**

- `locked: true` (everything) or a list from `content`, `design`, `remove`, `order`.
- A slide's lock covers its blocks; a block may add to it and never remove from it.
- On a header or footer zone only `content` and `design` mean anything; the other two are a schema error there.
- `design` on a slide includes its `layout`, which is what a locked layout needs.
- Ask whether a deck-level design lock (theme, colors, fonts) is wanted. The request does not name one, and
  "brand-safe" seems to need it; a selected brand kit with allow-lists (C-05) may be the better answer.

### E-02: `extensions.authoring.locked` has no reader and no writer

**Found.** It appears once in the repository, as an example in the description of `Slide.extensions`. No core,
renderer, exporter or editor code reads it. pptx.dev and pptx.gallery never write it. Rule 2 says to keep reading the
old form.

**Recommendation.** Do not make engines read it: the format's own rule, and a conformance case, say the content of
`extensions` is opaque. Instead `opf validate` reports the old form on a slide with a safe fix that writes
`locked: true`, and `opf fix` applies it. Ask STORYD whether it writes this extension, and with which values, before
this is settled. This departs from the letter of rule 2, so it goes to Michael.

### E-03: Who enforces a lock

**Found.** A lock in a file is a statement. Any tool can remove it. The request says the host enforces by role.
`authorizePatch` (CE-10) is the planned check and is not built.

**Recommendation.** Build CE-10 as part of CR 12: `authorizePatch(patch, policy)` where a policy can be derived from
the document's locks plus a role the host supplies. The editor shows a lock and gates its controls through the same
function. `opf edit` refuses a patch that breaks a lock unless told to override. `opf fix` and pagination skip a
locked node and report what they skipped. The docs say a lock is not a security boundary.

### E-04: `editable: "variables"`

**Question.** Where does it live and how does it relate to `template: true`?

**Recommendation.** A root key beside `template`, with values `all` (the default) and `variables`. It is a deck-wide
lock in other words: everything is locked for content, design, remove and order, and only variable values may change.
Define it as that, so there is one mechanism and `authorizePatch` needs no second rule.

### E-05: `maxLength` and `maxLines`

**Found.** A length is checkable from the document. A line count depends on where the value is drawn, and one
variable can be used in several places with different widths.

**Recommendation.** `maxLength` counts user-perceived characters (grapheme clusters) and is checked by `validate`.
`maxLines` is checked by composition at each place the variable is drawn, so it is reported with the layout findings
and names the slide. Both report `variable-overflow`. Add `maxItems` for a list variable in the same change.

### E-06: `translations`

**Questions.** What is translated, which language selects it, and what about text that is not a variable?

**Recommendation.** `translations` is a map from a BCP 47 tag to `{ value, label, description, example }`, any of them
optional. The language in effect where the variable is drawn selects it (the slide's, else the deck's), falling back
from `de-AT` to `de` to the untranslated fields. Say in the docs that only variables are translated: a localized
template keeps all its words in variables.

### E-07: `locale` and localized dates

**Found.** Numbers already follow the language tag. Dates print English month and weekday names. The description of
`NumberFormat` and decision 13 of the variables page still say "English only", which no longer matches LH-106 for
numbers. Core takes its number data from a generated table, never from the runtime, so every runtime prints the same
text.

**Recommendation.** No new `locale` field: a region or extension subtag on `language` already says it (`en-DE`,
`ar-SA-u-nu-latn`), and a second field would create two answers. Add month and weekday names by the same generated
table, for the languages the gallery lists, and measure what it adds to the edge bundle and the MCP viewer before
committing to the list. Correct the two stale sentences in the same change. Dropping `locale` changes the request, so
it goes to Michael.

### E-08: What "override" means for `brand.<id>`

**Found.** Built-ins are dotted and cannot be overridden at all. A user variable id cannot contain a dot, so a deck
cannot declare `brand.tagline`. The request says a locked constant cannot be overridden, which implies an unlocked one
can.

**Recommendation.** `brand.<id>` is read-only in the document like every built-in. The only override is a value
supplied at fill time under the same name (`"brand.tagline": "..."`): allowed for an unlocked constant, the error
`variable-locked` for a locked one. Confirm this is the override the requesters meant.

### E-09: `literal-constant`

**Found.** A rule that flags typed text equal to a constant fires on every plain mention of a short company name.

**Recommendation.** A note, in the opt-in audits, only for a whole field or a whole run that equals a constant of
eight characters or more, with a safe fix that writes the token.

## Group F: data-bound templates

### F-01: A filled deck today has no variables left to refresh

**Found.** `resolveVariables` consumes content declarations: the resolved deck has no tokens and no variables. PPTX
export stores the resolved deck (decision 11 of the variables page: no template provenance in PPTX). A refresh that
"rewrites only bound values" has nothing to find in such a deck.

**Recommendation.** Define two outputs and name them. A **filled deck** keeps its tokens and declarations with each
value written into `variables.<id>.value`; engines already resolve at draw time, so it renders the same. A **resolved
deck** is the flattened copy for a consumer that wants no variables. `opf fill` writes the filled form by default.
Refresh and CR 16 apply to the filled form only. PPTX in full provenance stores the filled form in its document tag so
a round trip keeps it. This is the central design decision of groups E and F.

### F-02: Where the fill record lives

**Found.** The requesters judged `extensions["opf.fill"]` weaker and asked for a choice.

**Recommendation.** A root key, `fill`. Reason: the content of `extensions` is opaque by the format's own rule and by
a conformance case, so a validator may not check it and a refresh may not depend on it. A root key can be validated,
diffed under its own category and documented. Keep it small: per value, the layer name and, when bound, the dataset
`rev` and pull time.

### F-03: One template per deck, or one per slide

**Found.** CR 16 records "the template's source, id and rev" on the root, singular. A deck assembled from several
slide templates (CR 8) has several origins, and drift (CR 9) is asked per template.

**Recommendation.** The root `fill` records the deck template when there is one. Each slide inserted from a slide
template records its own origin on the slide (C-01). Drift reads both.

### F-04: The hash of the values

**Question.** What is hashed, and does it expose recipient data?

**Recommendation.** SHA-256 over the canonical JSON of the supplied values, the same canonical form `documentHash`
uses. It is for detecting a changed run, not for secrecy; say in the docs that a short value can be guessed from its
hash, and let a host omit the hash.

### F-05: The order of the layers

**Found.** The stated order is built-ins, organization constants, template defaults, deck values, run or recipient
values, data-bound values, later wins. Two things do not fit: a locked constant is second in the list and yet beats
everything, and a bound value beats a value a person typed for one run.

**Question.** Should a run value override a bound value?

**Recommendation.** Confirm with the requesters. Proposed: keep the order as given, state the locked constant as the
one exception to "later wins", and let a recipient row change a bound value only through the binding's filter tokens,
which is what the request describes. A host that wants a manual override unbinds the variable.

### F-06: `refresh` and `variable-stale` need a date

**Found.** Core never reads a clock; a host passes the date to anything that needs one.

**Recommendation.** `refresh` is an ISO 8601 duration that no engine acts on. `variable-stale` is reported only when
the caller passes the current date to `validate`, and compares it with the pull time in the fill record. The CLI
passes today's date by default; core stays pure.

### F-07: Filter tokens

**Recommendation.** A filter value may hold `{{id}}` tokens of non-bound variables only, resolved before the
aggregate runs. A token that names a bound variable is an error, which rules out cycles without a dependency solver.

## What the rebuilds have to do

From the survey of the consumer repositories. storyd.ai was not visible, so its list is inferred from the request.

**pptx.dev**

- Move to 0.35 first: pins, the reference-layer pins file, `sync:opf-spec`, and `opf fix` over stored decks.
- Its hand-written model (`lib/schema/pptx-format.ts`) and two root-field allow-lists (`OPF_ROOT_UPDATE_FIELDS` in
  `lib/author/refine-opf.ts`, `lib/playground/schema-selection.ts`) list fields by hand and include neither
  `variables` nor `datasets` today. Every new root key (`id`, `fill`, `editable`) must be added or it is dropped on
  edit.
- Ids: call `assignIds` with a random generator when a deck is created or imported; store anchors by id. It has no
  comment or presence tables yet.
- Data: its import route saves nothing and writes no `datasets` or `source`; chart choice is a word match that
  defaults to a bar chart. CR 1 to 4 are only useful once import writes a dataset with typed columns and a source.
- Brand kits and templates: its catalog source table stores `kinds` and records loosely, so the new kinds fit, but
  nothing writes or locks them today.

**pptx.gallery**

- A new kind is added in about ten hand-written places (the kinds list, the routes, the registry, the links, the
  reference data, the parity script, a data file, a page, the navigation, the tests). Two kinds mean two passes.
- `rev` and `extends` pass through its sync unchanged; its index carries a format `version` that is unrelated.

**openpresentation.org**

- Freezing schemas picks new schema files up by itself. The hand-written schema links in the docs navigation and the
  schema contract tests need the two new names. The hosted MCP server validates with the site's pinned version, so a
  deck with new fields fails there until the site is bumped.

**storyd.ai (inferred)**

- It must not depend on any field before the release that carries it (X-01), and should confirm three shapes that
  this page proposes to change: `role` without `temporal` (B-02), no `locale` field (E-07), and no cross-kind
  `extends` (C-07).

## Proposed order of work

1. Release 0.35.0 (X-02) and merge the conformance and governance branch (X-03).
2. Michael answers the ten decisions at the top; the STORYD program answers the questions marked for the requesters
   (B-01, B-08, D-05, E-02, E-08, F-05) and supplies the CR 11 text.
3. 0.36.0: CR 6 and CR 7, with CE-11 if launch needs anchors (X-06).
4. 0.37.0: CR 1 to 4, CR 8 to 10, CR 11, and CR 5 if its three export paths are accepted in PowerPoint by then.
5. 0.38.0: CR 12 to 17, with CE-10 and CE-13 built inside them.
