# Program: format audit (FA)

Status: **active** (opened 2026-10-06). Tracker: [burndown.md](burndown.md).
Branches `codex/fa-<nn>-<slug>`, PR titles `FA-<nn>: `.

This is the single source of truth for the cross-repository program. Agents and
people resuming work start here, not from chat history.

## Goal

The owner asked for an audit of every OPF key and enumerated value
(2026-10-06, the [published audit](https://claude.ai/artifact/WDRoPsbCKNub8HEFxWgyX2))
and adopted every recommendation, with the decisions below. Restated:

> Every OPF key is good, useful and true. Each one does what its description
> says in core, the preview, the PPTX export and import, and the editor, or it is
> gone. There is one vocabulary for content kinds. Layout records share the deck's
> design vocabulary. The gaps presenters hit are filled.

Repositories: core [opf](https://github.com/OpenPresentation/opf),
[opf-render](https://github.com/OpenPresentation/opf-render),
[opf-pptx](https://github.com/OpenPresentation/opf-pptx),
[opf-editor](https://github.com/OpenPresentation/opf-editor) and
[pptx-gallery](https://github.com/Data-Advantage/pptx-gallery) (catalog publisher).

## Invariants

1. **Pre-v1: a clean spec, no deprecations** (owner, 2026-10-06: "no one uses
   this I want a clean spec with no deprecations. we are pre v1 here!"). A key or
   enum value is renamed or removed outright. There are no aliases, no
   `deprecated` markers and no migration shims, except two kinds of duplicate the
   owner chose to keep on purpose: `DimensionPreset` (`16:9`/`widescreen`,
   `4:3`/`standard`) and `FontScheme.languageFamily` (`ea`/`eastAsian`,
   `cs`/`complexScript`).
2. **Every description is true.** A schema description states only behavior that
   core, opf-render and opf-pptx implement, or explicitly says the field is
   metadata that no engine draws.
3. **Preview and export agree.** A field that changes the preview changes the
   PPTX export the same way, and import restores it, natively where PowerPoint
   has the concept.
4. **Content says what it is; the engine decides how it looks.** New fields are
   semantic (`sentiment`, `status`, `highlight`) and engines pick colors from
   the theme. Raw-color styling fields are not added.
5. **Catalog content changes start in core.** Since FF-37, core is the source of
   truth for catalog content and pptx.gallery adopts it. A record change lands in
   `spec/catalogs` together with its schema change. The gallery PR follows, so
   `pnpm check:core-catalog` passes on the next core release. See
   [default-catalog.md](../../default-catalog.md). The "snapshot never loses an
   id" rule is waived for this program's removals (invariant 1).
6. **Process.**
   - Merges: the release-readiness supervisor (Mac mini) merges and releases. FA
     agents open ready, CI-green PRs and never merge.
   - Packages: there is one coordinated minor train, core first, then opf-render
     and opf-pptx, then opf-editor.
   - Changelogs: add a `changes/<slug>.md` fragment per PR, and never edit
     `CHANGELOG.md`.
   - Working copies: work in worktrees under `C:\opf-work\fa-<nn>\`, never in the
     owner's checkouts.
   - Native PowerPoint checks are run only by a root session on Windows.

## Owner decisions of 2026-10-06

1. **Adopt every audit recommendation** unless a decision below says otherwise.
2. **Content kinds have one vocabulary.** The kinds are `title`, `text`, `list`,
   `image`, `video`, `chart`, `table`, `code`, `metric`, `quote` and `timeline`.
   - `picture`, `diagram` and `Image` become `image`.
   - `media` and `Video` become `video`.
   - `Number` and `Metric` become `metric`.
   - Narrative `shape` is removed.
   - TitleCase layout values go.
3. **Narrative is a planning catalog. The deck holds a pointer.** See FA-02.
4. **Layout records are reimagined** around the deck's own `design` vocabulary.
   See FA-01.
5. **`FontScheme.languageFamily`** accepts `latin | ea | cs | eastAsian | complexScript`.
6. **`FontScheme.app`** becomes `powerpoint | google-slides`. The owner proposed
   `googleSlides`. The supervisor chose kebab-case, because every other
   multi-word enum value in OPF is kebab-case (`c-suite`, `decision-maker`,
   `inside-end`, `roman-upper`, `paren-both`, `sans-serif`). The owner can veto
   this in one line.
7. **`DimensionPreset` keeps its duplicate aliases.**
8. **`TimelineEvent.status`** is `done | current | planned`. These three
   describe progress, which engines can draw without judging it: filled, "we are
   here", and outlined. Schedule health (at risk, blocked, slipped) is a
   different axis that would make engines invent alarm colors, the metric-trend
   mistake. It stays in text for now.

### Supervisor decisions (vetoable)

- **Deprecated catalog aliases are deleted** under invariant 1: 50 chart types
  and 6 audiences. The `deprecation` mechanism stays in the record schemas for
  after v1.
- **Chart-type ids lose the `-3x` suffix** with no alias. For example,
  `stacked-column-3x` becomes `stacked-column`.
- **`Font` objects become family strings.** `Font.weight`, `style` and
  `letterSpacing` are read by no engine, and PPTX has no numeric weight. So
  `FontScheme.heading/body/accent/code` and the font-scheme record's `code` take
  a family name string. Both naming models stay: `major/minor` mirrors OOXML,
  and `heading/body` reads naturally.
- **`ChartDataSource` is removed from the schema** (descoped, opf#240). A
  future data-resolver design re-adds it when it is built. `data.source`
  provenance stays.
- **Inline `Narrative` objects leave the deck.** A custom narrative goes in
  `catalogs.narratives.records`, which already exists, so there is one shape and
  not two.

## Built-in variables (answer to the owner's question, FA-04)

Today every variable is user-defined: `variables.<id>` with a kebab-case id and
a type (color, text, number, date, image, url, list). There are no built-ins.

FA-04 adds **built-in variables**: read-only values that come from the deck's
own metadata. Their names are dotted, so they can never collide with a
user-defined id. User-defined ids cannot contain a dot.

| Built-in | Type | Source |
| --- | --- | --- |
| `deck.name`, `deck.description` | text | root `name`, `description` |
| `deck.author` | text | root `author` (array joined with `, `) |
| `speaker.name`, `.title`, `.email`, `.phone`, `.bio` | text | the first speaker |
| `speaker.photo` | image | the first speaker |
| `speakers` | list | every speaker's name |
| `speaker.<id>.<field>` | as above | the speaker with that id |
| `organization.name`, `.legalName`, `.tagline`, `.domain`, `.email`, `.phone` | text | the primary organization |
| `organization.logo` | image | the primary organization |
| `organization.<id>.<field>` | as above | the organization with that id |

They use the existing syntax: `{{speaker.name}}` inside any string, and
`var:speaker.photo` or `var:organization.logo` as a whole field.

Examples:

- A cover: `"subtitle": "{{speaker.name}}, {{speaker.title}} · {{organization.name}}"`.
- A footer: `"text": "{{organization.tagline}}"`.

A missing source value behaves like an unfilled optional variable: an empty
string and a lint warning. `HeaderFooterItem` also gains `speaker: true`
(primary speaker name and title), the twin of `organization: true`.

Per-slide values (slide number, total, section, date) stay header/footer fields.
They need composition-time resolution and native PPTX fields, and built-ins are
resolved before composition.

## Narrative (FA-02 recommendation, adopted)

A narrative is a **plan**: arc, beats and what each beat must do. Planners such
as pptx.dev and STORYD use it before slides exist. A deck is the **product**.

**Pros of keeping a full narrative inside the deck JSON:**

- The plan and the slides travel together.
- An agent editing later can ask "rewrite the evidence beat".
- Lint can check coverage.
- PPTX round-trip already carries it.

**Cons:**

- Catalog data is duplicated inline.
- The plan goes stale as slides change.
- Renderers ignore it.
- The schema promised validator checks nobody built.
- There are two shapes, inline `Narrative` and catalog record.
- Beat→layout→placeholder needs three vocabulary translations ("an agent that
  maps a beat to a layout to a placeholder has to translate three times").

**Decision:** keep the plan in the catalog and a pointer in the deck.

- **Catalog record** (`opf-narrative/v1`, pptx.gallery) is the planning
  resource:
  - `durationRange {minMinutes, maxMinutes}` becomes `duration {min, max}`, in
    minutes. A reusable arc honestly fits a range. The deck's single target
    stays root `duration`.
  - Beat `slideType` becomes `type`, using the one content-kind vocabulary.
  - `layoutHint` becomes `layout`.
  - `slideCount` is removed: one beat is one slide, so split heavy beats.
  - `shape` is removed.
  - A beat now maps to a slide with no translation: `beat.type` is
    `slide.type`, `beat.layout` is `slide.layout`, and the layout's placeholder
    types use the same words.
- **Deck:**
  - `narrative` is a string only: a catalog id, URL or `pkg:` reference.
  - `slides[].beat` keeps the slide→beat link.
  - A custom narrative goes in `catalogs.narratives.records`.
- **The plan is a skeleton deck.** A planner emits an OPF deck whose slides
  carry `beat`, `type`, `layout`, `title` and `notes`. That is a valid deck from
  minute one, so there is no separate plan format.
- **Lint:**
  - an unknown `slides[].beat` id is a warning;
  - a root `duration` outside the narrative's `duration` range is a warning;
  - a beat with no slide is reported as audit info.

## Layout records (FA-01, reimagined)

**Before:** a layout record had 17 metadata fields with prefixes
(`contentTypeChartPrimary`, `contentTypeListBullet`, `contentTypeListHeading`,
`slideTitleAlignment`), TitleCase values with `None`, and booleans that repeat
the placeholders. **After:**

```json
{
  "id": "chart-left-text-right",
  "name": "Chart left, text right",
  "summary": "...",
  "placeholders": [{ "type": "title" }, { "type": "chart" }, { "type": "text" }],
  "design": { "chartPrimary": "left", "titleAlignment": "left", "contentBox": false },
  "composition": { "mode": "row", "weights": [3, 2] }
}
```

- **`placeholders` is the single truth for what a layout holds.**
  - `contentType`, `contentMultiple`, `slideTitle`, `slideSubtitle`, `slideTag`
    and the boolean `slideImage` are derived, not stored. Core exports
    `layoutContent(record)`, which returns `{ kind, count, heading: {title,
    subtitle, tag} }`.
  - The derived kind is the most frequent body placeholder kind, or `title` when
    there is none.
- **`design` holds the same keys as the deck's `design`,** with the same
  lowercase values. The keys are `titleAlignment`, `contentAlignment`,
  `contentBox`, `contentDirection`, `chartPrimary`, `imageFill`, `listBullet`
  and `slideImage.position`.
  - `contentTypeChartPrimary` becomes `design.chartPrimary`.
  - `contentTypeImageFill` becomes `design.imageFill`.
  - `contentTypeListBullet` becomes `design.listBullet`.
  - `slideLayoutDirection` becomes `design.contentDirection`.
  - `slideTitleAlignment` becomes `design.titleAlignment`.
  - `slideImageAlignment` becomes `design.slideImage.position`.
  - An absent key means no opinion, so `None` disappears.
  - `contentTypeListHeading` is removed. It was dead in every record, and
    `items` with `description` already gives each list entry a heading.
- **Precedence is one merge:** layout `design`, then deck `design`, then slide
  `design`, then the slide's own `composition`. This is the order core already
  applies, now spelled with one set of names.
- **Benefits:**
  - Presenters learn one set of words: a slide can override exactly what its
    layout sets, by the same name.
  - An LLM can copy `layout.design` into `slide.design` without translating.
  - Developers get one `$ref` to a shared `DesignHints` definition, one enum
    style, and no `None`.

## Wave C: the 0.15 spec (owner decisions of 2026-10-07)

Design: [0.15-design.md](0.15-design.md). The owner adopted it after a review
of the catalog shape and the background and image model, and added: "nobody
uses this yet we don't need migrations or anything just publish a clean spec".

1. **Zero built-in records.** Core's main entry imports no catalog data. The
   gallery snapshot ships only as the opt-in subpath `@openpresentation/opf/catalog`.
   Hosts register catalogs; engines never fetch.
2. **Catalogs group records by where they came from**: `catalogs.default`,
   named catalogs (`catalogs.acme`, referenced as `acme:hero`) and
   `catalogs.custom`. A group has a `source`; embedded records carry no
   `$schema`, `id`, origin or digest. Every content reference is `id` or
   `name:id`; URL and `pkg:` references are removed.
3. **Engine vocabularies are not catalog references**: `chart.type`, `language`
   tags and social platform keys are validated directly.
4. **Backgrounds and images**: a full-bleed photo is an image background; every
   content picture is an image block with fit, the image treatments and
   `placement`; one Overlay; one fit vocabulary. `design.slideImage`,
   `design.imageFill` and the `image-bleed` layout are removed.
5. **No migration path.** No `opf migrate`, no deprecation window. The
   repositories' own examples, narratives, records and sites are rewritten.
6. **Catalog ownership.** This supersedes invariant 5: pptx.gallery owns every
   catalog record and core keeps a pinned one-way snapshot (RR-58). For the 0.15
   switch, record rewrites land in core's snapshot and in the gallery in the
   same train.
7. **Phase 0 folds into 0.15.** There is no core 0.14.1. The 0.14.x
   consistency fixes (PPTX host catalogs, `paginate()` catalogs, editor catalog
   merge, doc mismatches) land as part of FA-23 and FA-20.

## Work items

[burndown.md](burndown.md) lists the items, their acceptance criteria and
status.

## Resume protocol

1. Read this file and burndown.md.
2. For an item, read its row and the linked PRs.
3. Work in `C:\opf-work\fa-<nn>\` sibling worktrees of the five repos, linked
   with `node scripts/link-ecosystem.mjs`. See
   [ecosystem-development.md](../../ecosystem-development.md).
4. When an item changes state, update its burndown row and the progress log.
