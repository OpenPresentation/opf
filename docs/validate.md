# OPF validate: one checker for format, references, accessibility, layout and content

`validate` in `@openpresentation/opf` and `opf validate` in the CLI check an OPF presentation for everything a tool can tell without an opinion: whether it is well-formed OPF, whether everything it points at resolves, whether a host's house rules hold, and the problems a schema cannot see, such as text that is hard to read, text that does not fit, pictures without alt text, content read out of order, fonts outside the deck's scheme, placeholder text and slides left empty. It is the only checker. Releases before 0.14 had several (a schema validator, a lint and an audit, in the library and the CLI); 0.14 replaces them all with `validate`.

`validate` is read-only, local and deterministic. It fetches nothing (no images, fonts or catalogs), consults no clock and calls no model. The same document, options and fonts give byte-identical findings.

```sh
opf validate deck.opf.json                                     # everything, JSON report
opf validate deck.opf.json --format text                       # one line per finding
opf validate deck.opf.json --only format,references --fail-on warning
opf validate deck.opf.json --ignore layout --config house-rules.json
opf validate --list-rules
```

```js
import { validate } from '@openpresentation/opf';

const report = validate(presentation);           // a parsed presentation
const fromText = validate(fileText);             // strict JSON text: also syntax, duplicate keys and line/column
validate(presentation, { only: ['format'] });    // the cheap check: schema and semantic rules only
validate(presentation, { ignore: ['layout'] });  // everything except the checks that build slide layouts
validate(presentation, { contracts, severity: { 'opf/text-contrast': 'error' } }); // house rules
```

## Categories

Every finding has one of six categories. They say what kind of question the finding answers, and they select what runs.

| Category | Asks | Errors by default | Examples |
| --- | --- | --- | --- |
| `format` | Is it well-formed OPF? | yes | JSON syntax, duplicate keys, schema, a citation of an unknown reference, an unknown dataset, a required variable with no value (a warning in a template), a `name:id` prefix that names no catalog group |
| `references` | Does everything it points at resolve? | missing or circular asset, invalid catalog record; a reference that resolves nowhere and an unused dataset are warnings | `asset:` references, catalog references, citations and datasets nobody uses |
| `policy` | Does it follow the host's house rules? | the host sets it (default `error`) | "only these layouts", brand fonts: the `contracts` option |
| `accessibility` | Can everyone read it? | no: warning and info | contrast, alt text, slide titles, reading order, link text, language |
| `layout` | Will it present as authored? | no: warning | overflow, minimum type size, image resolution, fonts outside the scheme |
| `content` | Is anything left unfinished? | no: warning and info | placeholder text, an empty slide, a chart value that is text |

`valid` keeps meaning "correct OPF": it is true when no finding has severity `error`, and by default only `format`, `references` and `policy` can produce one. A low-contrast deck is still a valid deck. A team promotes the rules it cares about with `severity`.

Every rule is listed, with its category, default severity, cost and the basis it rests on, in [Rules](#rules) below. A rule stays in core only when it has a measurable basis (a standard such as WCAG 2.2, a print-preflight check, or a number computed from the layout); judgments that need an audience and a purpose, such as how many fonts or words a deck should have, are not rules here.

## Input and report

`validate(input, options?)` takes a parsed presentation (an object) or **strict JSON text**. A string is read as JSON and nothing else: it is never sniffed for YAML or Markdown. When the text begins like YAML (`key: value`, `---`) or Markdown (`#`), the `help` of the syntax finding says to read it with `fromYaml` or `fromMarkdown` first, which return a presentation and call `validate` for you.

With text, a syntax error or a duplicate key comes back with `location` (original-source UTF-16 offset and length, one-based line and column), and so does every finding about a value in the document; a finding about a missing field is located at the object that lacks it. Text that is not JSON reports its syntax errors (`opf/json-syntax`) whatever `only` says, because nothing else can run. A syntax finding names the root cause in plain words and not the token where a parser gave up: for `"design":` followed by the next key, one finding `` `design` needs a value. `` located at `"design":` (its `help` says what could come next), not four findings from the token after it. There is one finding per cause, in position order, at most five; the cascade of one mistake is not reported again. `analyzeJsonSyntax` (`@openpresentation/opf/source`, browser-safe) returns the same causes with the fixes that repair each one (`Insert comma`, `Add { }`, `Remove "design"`, ...) for editors; `locate` and `pathAt` in the same module turn a JSON Pointer into a range of the text and a caret into a path, in JSON, YAML and Markdown, and `scanMarkdown` lists the regions of a Markdown deck. A finding for an unknown property (`opf/schema`, keyword `additionalProperties`) carries up to three `suggestions` of the nearest property names of the same object (edit distance 2, or 1 for names of three characters or fewer; case-insensitive), so `slids` suggests `slides`.

### Reading a deck in any form

`parse(text, { format, filename, catalogs })` (the root and `@openpresentation/opf/deck`, RR-60, RR-62) reads a deck from JSON, YAML or Markdown text and returns the presentation; a syntax, schema or reference error throws `OPFValidationError`, whose `report` is the report `validate` gives the text. The format is the `format` option (`"json"`, `"yaml"` or `"markdown"`), else the `filename` (`.opf.md` is Markdown, `.yaml` and `.yml` are YAML, anything else is JSON), and never the content: a plain `.md` name is not a deck. Findings are located in the text that was read: `opf/json-syntax` (line and column) for JSON, `yaml/<rule>` for YAML and `markdown/<rule>` for Markdown, and every `opf/` finding at the field it names. `parse` checks format and references; warnings do not throw, so call `validate` for the full report (`validate(text)` for JSON text; `fromYaml` and `fromMarkdown` return it for the other forms). It throws a `TypeError` for a text that is not a string, an unknown format or a bad option. `stringify(presentation, { format | filename })` is the other direction: JSON as two-space JSON, YAML and Markdown in canonical form. Both are browser-safe; `open` and `save` of `@openpresentation/opf` do the same for files in Node. See [OPF as YAML](yaml.md) and [Markdown and outlines](markdown.md).

[Validation results](finding-schema-reference.md) use the `FindingReport` contract (`spec/schemas/finding.schema.json`). Core's `ValidationReport` adds a few more fields:

| Field | Meaning |
| --- | --- |
| `valid` | No finding has severity `error` |
| `findings` | Every finding, ordered by slide (document-level findings first), then category, then rule |
| `counts` | `{ error, warning, info }` |
| `schemaValid` | The document passes the schema and the semantic format checks; `null` for text that is not JSON. A required variable with no value does not make a document schema-invalid |
| `checks` | What ran and what was not measured (below) |
| `template`, `unfilledVariables` | Documents that declare content variables or are templates: whether they were checked as a template, and which required variables have no value |

A finding has a stable `ruleId` (`opf/text-contrast`), a `severity` (`error`, `warning`, `info`), a `category`, a JSON Pointer `path`, a `message`, a `help` sentence and a `definition` link to the rule below or to the schema constraint. It may carry `slide` and `slideId` (zero-based index and id of the slide it belongs to), `location` (from text), `measured` (the numbers behind it: ratios, sizes, counts), `suggestions` (catalog records that exist, never silently applied), `lookup` (arguments for `opf schema` or `opf catalog`, not a shell string), `validation` (the raw schema issue, with every union alternative) and `fixes`.

`checks` says what each part did: `syntax` (`checked` for text), `schema`, `references`, `policy`, `accessibility` and `content` are `checked` or `not-run`; `layout` is `not-run`, `estimated` (text widths are core's portable estimate) or `measured` (the host passed `fonts.textMeasurement`); background picture pixels are never read (`backgroundPixels`), image resolution reads only embedded `data:` images (`imageBytes`), and native PowerPoint rendering is not checked (`nativeExport`).

A document the schema rejects is not audited: its accessibility, layout and content rules do not run, and its format errors are reported even when `only` did not ask for them, so the report says why nothing else ran (switch them off with `ignore: ['format']`).

## Options

```js
validate(presentation, {
  only: ['format', 'opf/missing-alt-text'],       // run just these rules or categories
  ignore: ['layout'],                             // do not run these
  severity: { 'opf/text-contrast': 'error', content: 'off' }, // per rule or category: error, warning, info or off
  ignorePaths: [{ rule: 'opf/text-contrast', path: '/slides/3' }], // an accepted exception, by JSON Pointer prefix
  catalogs: [gallery, acmeCatalog],               // the catalogs the host registered (the first is the default); nothing is fetched
  contracts,                                      // host policy (below)
  thresholds: { contrastNormal: 7 },              // see DEFAULT_VALIDATION_THRESHOLDS
  fonts,                                          // the host's fonts: layout rules read fonts.textMeasurement
  chartPalette: ['#0072B2', '#E69F00'],           // the engine's chart colours
  template: true, values: { client: 'Acme' },     // check as a template, or fill variables first
});
```

- **Names.** `only`, `ignore`, `severity` and `ignorePaths` take full rule ids (`opf/text-contrast`), bare rule names (`text-contrast`) or category names (`accessibility`). No rule is named like a category. A rule beats its category in `severity`. An unknown rule, category, threshold or option throws a `TypeError`, so a typo cannot silently disable a check.
- **`fonts`.** An object with a `textMeasurement` (the renderer's `loadFonts()` result has one). Without it the layout rules use core's portable estimate and `checks.layout` says `estimated`; with it, `measured`. `textMeasurement` may also be a function of the zero-based slide index, for a script-aware measurement per slide. When the measurement has a `forScripts(profile)` method (a script planner), the layout rules ask it for each slide's script-aware measurement, built from the slide's `resolveScriptFonts` profile and a run language's own profile, the way the renderer and the exporter measure, so Arabic or Japanese text is measured in its script face rather than the Latin face its style names.
- **`template` and `values`.** A deck that declares content variables is checked as the deck it resolves to; see [templates and variables](templates-and-variables.md).
- **Thresholds.** `DEFAULT_VALIDATION_THRESHOLDS` holds `contrastNormal`, `contrastLarge`, `minFontSizePt`, `minImagePpi` and `minSeriesColorDifference`; each rule below lists the ones it reads.

`validationRules` lists every rule with its metadata (`id`, `name`, `category`, `severity`, `cost`, `summary`, `rationale`, `standard`, `approximations`, `thresholds`), and `findValidationRule(name)` finds one by id or bare name.

`assertValid(value, options?)` throws `OPFValidationError`, carrying the `report` and its error `findings`, unless `validate(value, options)` is valid, and tells TypeScript that `value` is a `Presentation`. It takes a parsed value, not text.

`validateCatalogRecord(kind, record)` and `assertValidCatalogRecord(kind, record)` check one catalog record (an audience, theme, layout, font scheme and so on) against its schema. The report has the same shape and checks the record format only (`checks.references` is `not-run`): without an enclosing catalog it does not resolve linked ids. Validate a presentation with its registered catalogs to check those references.

## Pass `fonts`, otherwise the estimate

The layout rules (`opf/text-overflow`, `opf/min-font-size`, reading order, image resolution) depend on how wide the text is. `validate` measures it with `options.fonts`, the handle that opf-render's `loadFonts()` returns:

```js
const fonts = await loadFonts({ pack: 'office' });
const report = validate(deck, { fonts });   // report.checks.layout === 'measured'
```

Pass the same `fonts` handle to preview (`toSvg`), pagination (`paginate`) and export (`toPng`, `toPdf`, `toPptx`), so that validation measures with the faces the preview draws and a finding means what the slide shows. The same handle gives identical geometry across engines; opf-pptx's `layout-parity` test checks that the exported PowerPoint paragraphs agree with the SVG preview and with core's composed items, with and without `fonts`. See [Pass `fonts`, otherwise the estimate](font-fidelity.md#pass-fonts-otherwise-the-estimate) for the full list.

Without `fonts` the rules use core's built-in estimate and `checks.layout` says `estimated`: base widths are 0.54 em per character, 0.62 em for capitals and digits, 0.32 em for a space and 1 em for CJK characters. Spacing combining marks outside Latin/CJK contribute; nonspacing/enclosing marks do not. Robust script factors calibrated against the FF-44 corpus reduce underestimation for other scripts; see [script width evidence](evidence/script-width-estimates/README.md). It needs no font files and is stable from run to run, but an estimate can be wider or narrower than a particular face, so an estimated overflow finding (or its absence) is a first pass. `opf validate` on the command line loads no fonts, so its layout checks are estimated too. Node `convert` and the CLI's `opf convert` and `opf paginate` prepare an office-pack handle for you; a library call to `validate` never loads fonts itself.

## Cost

`validate` is lazy: it builds only what the rules you ask for need. Measured with Node 24 on three bundled example decks (milliseconds per call, warm; your machine will differ, the ratios hold):

| Call | `minimal` (3 slides) | `renewal-save-plan` (6 slides, 34 KB) | `broadband-public-hearing-deck` (10 slides, 41 KB) |
| --- | --- | --- | --- |
| `only: ['format']` | 0.06 | 0.23 | 0.64 |
| `only: ['format', 'references']` | 0.7 | 5.2 | 7.6 |
| everything (the default) | 1.7 | 24 | 32 |

`only: ['format']` costs what the schema check alone costs; it builds no layout. The references walk reads the schema alongside the document and costs about ten times as much. The rules of `layout` (and `opf/text-contrast`, `opf/text-on-image` and `opf/reading-order`) compose every slide and are most of the cost of a full run. Each rule's `cost` says which it needs: `syntax` reads the JSON text, `structure` reads the document alone, `composition` builds slide layouts.

The default runs every category, including overflow findings; `valid` means no error findings, so an overflow warning alone does not make it false. Hot paths select what they need: pagination, conversion, patch validation and the editor's per-edit check use `{ only: ['format'] }`; CLI document-writing commands check `format` and `references`, so a contrast warning does not block an export unless its severity or failure policy is explicitly raised.

## Quick fixes

A fix is a suggestion that core never applies. A host such as the editor's Review panel shows it and applies it through its own undoable edit path.

- A `patch` fix (`kind: "patch"`, the default) carries RFC 6902 JSON Patch operations in `patch` (`add`, `remove`, `replace`, `move`, `copy`, `test`, with JSON Pointer paths). `safe: true` means the change cannot alter what the content says: for example switching a failing text colour to the colour the theme chose for that background.
- A `focus` fix (`kind: "focus"`) names the field the author must fill in (`focus.path`, `focus.field`: `alt`, `title`, `text`, `link`, `language`, `fontSize`).
- `safe: false` patches change meaning or appearance and need a deliberate click, for example marking a picture decorative with an empty `alt`.

`title` says what applying the fix does.

## Catalog context and contracts

Content references resolve the way every engine resolves them ([catalogs](default-catalog.md)): `catalogs.custom`, then the records embedded under `catalogs.default`, then the catalog the host registered (the `catalogs` option) for its source; `name:id` in `catalogs.<name>`, then the catalog registered for its source. A reference that resolves nowhere is a warning (`opf/unresolved-reference`), never an error; a prefix that names no group is a format error (`opf/undeclared-catalog`): it can never resolve, so engines reject the document at their format check (`validate(document, { only: ["format"] })`) instead of drawing a fallback. A `catalogs` option that is not an array of registered catalogs throws `OPFCatalogsOptionError` (`code: "invalid-catalogs"`) at every entry point. Nothing is fetched, and without the `catalogs` option only the records the document embeds resolve. Free-form audience and purpose descriptions (any string that is not a bare id or `name:id`) and arbitrary `extensions` data are never references; the `language` tag, `chart.type` and the `socials` keys are engine vocabularies the schema checks. Embedded records, and registered records the document uses, are validated against their companion schema (`opf/catalog-record`). A record under `catalogs.default` or a named group that the catalog registered for the group's source does not publish is `opf/catalog-record-not-in-source` (move it to `catalogs.custom`); with no catalog registered for that source the check is silent. Suggestions name records actually present in the checked context (`origin` `document` or `registered`).

An `asset:` reference that names no entry of the document's `assets` registry is an error (`opf/asset-reference`), and so is a cycle of `asset:` sources (`opf/asset-cycle`); resource bytes are never fetched. Chart and table data findings keep their code as the rule id (`opf/dataset-unknown`, `opf/chart-value-not-numeric`, ...), and a `opf/chart-value-not-numeric` cell whose column is written in one display style (`"12%"`, `"$1,234"`) carries `fixes` ([chart and table data](chart-table-data.md#migration-help)). Citation and caption errors keep theirs too (`opf/cite-unknown-reference`, `opf/reference-id-duplicate`, `opf/cite-unsupported-location`, `opf/caption-unsupported-payload`).

A narrative the document defines is a record in `catalogs.custom.narratives`, and `narrative` is always a reference string. When the narrative resolves, a `slides[].beat` id it does not define is `opf/unknown-beat`, a root `duration` outside the record's `duration` range is `opf/duration-outside-narrative`, an embedded record whose `duration.min` exceeds `duration.max` is `opf/narrative-duration-range`, and a beat no slide references is `opf/unused-beat` (only once some slide names a beat). A slide-level `design.theme` whose resolved dimensions differ from the deck's is `opf/slide-theme-dimensions`: a PPTX has one slide size, and a slide's `design` cannot set `dimensions` at all (a schema error). An undeclared `var:<id>` in a solid, gradient-stop or pattern background colour warns like any other colour reference (`opf/variable-reference-unknown`).

Host policy comes from explicit options, never from the document: fields under `extensions` are data and cannot install policy. `contracts` and `catalogs` may live in a local JSON file for the CLI (`--config`).

```json
{
  "catalogs": [
    {
      "source": "pkg:@partner/opf-catalog",
      "layouts": {
        "partner-title": {"name":"Partner title","regions":[{"name":"title","size":1}]}
      }
    }
  ],
  "contracts": [
    {
      "path":"/slides/*/layout",
      "allowedValues":["partner-title","text"],
      "message":"Use the brand layouts {{allowed}} at {{path}}. See {{file}}.",
      "documentation":"brand-guide.md#layouts",
      "severity":"error"
    }
  ]
}
```

Contract paths are JSON Pointer patterns: `~0` escapes `~`, `~1` escapes `/`, and a whole `*` segment matches one property or array index. Contracts check existing fields; they do not require an omitted field or insert defaults. Allowed values are JSON primitives. Optional message placeholders are `{{path}}`, `{{value}}`, `{{allowed}}`, and `{{file}}`. A contract's severity is `error` unless it says otherwise. Invalid or misspelled configuration keys fail instead of being ignored. Messages and catalog labels are data, not executable instructions.

## The CLI

`opf validate <file|-> [--config <file>] [--only <list>] [--ignore <list>] [--fail-on <error|warning|info>] [--asset-dir <dir>] [--format <json|text>] [--list-rules]`

The JSON report (the default) is the `validate` report plus the source's SHA-256 (`sha256`), the installed core version (`opfVersion`) and, with `--config`, the configuration file's path and hash (`context`). `--format text` prints one line per finding (`file:line:column  severity  rule  message`), the JSON Pointer path, a hint and any fix, then a summary. `--list-rules` prints every rule (`--format json` with its full metadata).

A file ending `.yaml` or `.yml` (or stdin with `--from yaml`) is read as YAML through `fromYaml`, so the report is the same and every finding is located in the YAML; a YAML syntax or dialect error is a `yaml/<rule>` finding (`format`, exit 1). A file ending `.opf.md` (or stdin with `--from md`) is read as a [Markdown deck](markdown.md#markdown-decks-in-every-command) the same way, and a Markdown error is a `markdown/<rule>` finding. A plain `.md` file, and any other text that does not start with `{` or `[`, needs `--from`.

**Local images (RR-93).** The CLI, not core `validate` (which reads no file), also checks that each relative image or logo path exists: a `cli/asset-missing` warning when `opf convert` could not find it, `cli/asset-blocked` when it is outside the folder or not an image file. It uses convert's resolver and rules: paths are relative to the deck's folder (the working directory for stdin), or to `--asset-dir`; URLs, `data:` URIs and `asset:` references to them are not read. `--only` skips the check and `--ignore asset-missing` (or `asset-blocked`) drops one kind.

**Schema errors in a union.** Where a value can take several forms (a table cell is a scalar, runs or a styled object), a failing value reports the errors of the form it was written for, and each finding's `validation.alternatives` lists the other forms in one line each (`--format text` prints them as `other forms: ...`). When no form fits the value's type, one error names the types accepted.

`--only` and `--ignore` take comma-separated rule ids, bare names or category names. `--config` takes an explicit local JSON file, never `-`, holding `{ catalogs, contracts, severity, only, ignore, ignorePaths, thresholds, chartPalette }`; `--only` replaces the file's `only` and `--ignore` adds to its `ignore`.

| Exit | Meaning |
| --- | --- |
| 0 | No finding at or above `--fail-on` (default `error`) |
| 1 | At least one finding at or above `--fail-on`, or a document that is not valid JSON (or YAML) |
| 2 | Usage, configuration or I/O error |

`--fail-on` is the one way to say "fail on warnings" on every command that checks a document: `--fail-on warning`. Other commands (`create`, `edit`, `fill`, `paginate`, `embed`, `ingest`, `convert`) check only `format` and `references` of what they write and take `--fail-on` the same way.

**Done means `--fail-on warning` passes.** A layout, theme or other catalog id that resolves nowhere is the warning `opf/unresolved-reference`, not an error, because catalogs are open and a host may register the id; so a deck with a made-up `layout` still reports `ok: true` and exits 0 by default. Agents and CI should treat a deck as finished only when `opf validate deck.opf.json --fail-on warning` exits 0. The finding's hint names the nearest records that exist ("Did you mean 'two-column'?").

## How contrast is computed

`opf/text-contrast` reasons about the colours the preview draws, because a check against a different colour than the one on screen is worse than none.

1. **Background.** Design resolves per field: slide design, deck design, theme, engine default. The background is a theme slot or colour (`solid`), the card surface for content on a `contentBox` card, a table cell's fill, a gradient or a pattern. Solid, gradient-stop and pattern colours are read as literal hex colours, as the preview reads them (anything else falls back as it does there). Translucent backgrounds are composited over white.
2. **Text color.** Titles, body, lists and tags use the scheme's `dark1`, or `light1` when the background is dark (luminance below 0.179). Furniture and quote attributions use the muted color, metric values (and a unit on the value's line) the color the engines draw them in, `metricValueColor` of the primary on the card or slide under them (on a dark surface a primary under 4.5:1 becomes the light text color, LH-57, LH-151), and explicit run and table colors the author's `ColorRef` resolved the same way the renderer resolves it. As the preview does, a gradient background has no single color and counts as light, so a dark gradient behind default text is reported.
3. **Gradients.** The gradient is sampled on a 5 by 5 grid over the area the text covers (the lines' measured ink, aligned as the text is), using the preview's gradient geometry, and the worst colour decides. A pattern contributes both of its colours.
4. **Pictures.** Pixels are never read. A background picture is bounded by a gray ramp from black to white, composited through the picture opacity and any full-frame overlay of the image background (`design.background.overlay`), or, over the text it covers, core's [automatic scrim](image-treatments.md#automatic-scrim) (bounded by the grays a host measured, when it did). Text passes only if every step passes; otherwise `opf/text-on-image` says the result cannot be guaranteed. With the scrim, `opf/text-on-image` is a note that names it. An overlay limited to an edge band is not counted.
5. **Ratio and size.** The WCAG 2.x relative-luminance contrast ratio is compared with 4.5:1, or 3:1 for large text: at least 18 pt, or 14 pt and bold. Sizes are the fitted sizes, expressed at the 13.33 by 7.5 in reference slide (96 px per inch). The default body size, 18.75 pt, is large text under WCAG, so default body text passes at 3:1; set `contrastLarge` to 4.5 for a stricter policy.

Approximations: anti-aliasing, text shadows, font weight and the exact glyph coverage are not modelled; chart and code text are not checked (charts pick label colours against their surface; code uses its own panel colours). See each rule below for what it cannot see.

## Layout rules use composition

Overflow, minimum type size, reading order and image resolution use `composeSlide` at the deck's slide size with the resolved font scheme, the same composition the preview and the PPTX export consume. Without `fonts.textMeasurement` the text widths are core's portable estimate and can differ from the real fonts by a few percent; hosts that load fonts (the editor, the renderer) pass their measurement for font-exact results. A composition with `overflow: "error"` fails at composition time; `validate` still computes the geometry, relaxes the setting, and reports the overflow as a **warning**, so that `valid` never depends on font metrics. Rendering and export still refuse such a slide when it does not fit, and a host that wants the finding to fail promotes it with `severity: { 'opf/text-overflow': 'error' }`.

Promoted region keys (`left`, `center`, `right`, `top:left` and the rest) are composed in visual reading order (rows from top to bottom, then along the row), whatever order the keys are written in. The PPTX export writes shapes in that order, which is the reading order of assistive technology; `opf/reading-order` checks that the composed order still matches the geometry (the same `visualReadingOrder` that composes the regions). Authoring with `blocks` (an ordered list) keeps the reading order equal to the visual order.

## Templates and variables

`opf/variable-unfilled` is one rule for a required variable that has no value. In a deck that is not a template it is an error (the deck is incomplete), so `valid` is false; in a template (`"template": true` in the document, or `template: true` in the options) it is a warning, because a template is incomplete on purpose; `unfilledVariables` lists the ids either way. In a document that declares no content variables, a `{{id}}` token left in a string (outside `variables`, `extensions`, `catalogs` and `assets`) is a warning. A `var:` colour that names no declared variable is `opf/variable-reference-unknown`. It is a `format` rule, so `only: ['format']` (what pagination, patching, conversion and every write command run) rejects a deck with an unfilled required variable. Fill a template with `opf fill` or `resolveVariables`, or pass `values`, to clear the findings.

## Plain-words text and `explain`

A finding is written for tools: `message` is the rule's own sentence or an Ajv phrase, `help` is advice for an agent. To show a finding to a person, `describeFinding(finding, { document })` (from `@openpresentation/opf/source`) returns `{ message, next }`: `message` says what is wrong, with fields in backticks and no JSON Pointers ("`titleAlignment` must be left, center or right, but is `middle`."), and `next` is the continuation of "Next:" ("did you mean `center`?"). Every `opf/*` rule has its text, written from the structured data the finding carries (`path`, `validation.params`, `measured`, `suggestions`, `fixes`, the slide) and from the document, for example the datasets, assets or columns that do exist; a finding from another producer keeps its own sentence and the first sentence of its `help`. The call is pure, never throws and does not change the finding.

`explain(ruleId)` (from the package root and `@openpresentation/opf/source`) returns what a rule checks and how to fix it: `{ id, name, category, severity, summary, rationale, fix, example, docs }`, where `example` is a small `{ problem, fixed, language }` pair of OPF fragments and `docs` is the rule's anchor in this guide. It accepts `opf/text-contrast` and `text-contrast`, and returns `undefined` for an id it does not know.

## Rules

The reference below is generated from the rule registry (`validationRules`); `node scripts/build-validate-docs.mjs --check` (and a core test) fails when it drifts.

<!-- validate-rules:start (generated by scripts/build-validate-docs.mjs; do not edit by hand) -->

| Rule | Category | Default | Cost | What it reports |
| --- | --- | --- | --- | --- |
| [`opf/json-syntax`](#opfjson-syntax) | Format | error | syntax | The text is not strict JSON. |
| [`opf/duplicate-key`](#opfduplicate-key) | Format | error | syntax | A JSON object repeats a key. |
| [`opf/schema`](#opfschema) | Format | error | structure | The document breaks the OPF schema or a structural rule the schema cannot express. |
| [`opf/reference-id-duplicate`](#opfreference-id-duplicate) | Format | error | structure | Two references share an id. |
| [`opf/cite-unknown-reference`](#opfcite-unknown-reference) | Format | error | structure | A citation names a reference that does not exist. |
| [`opf/cite-unsupported-location`](#opfcite-unsupported-location) | Format | error | structure | A citation or footnote sits where no engine draws it. |
| [`opf/caption-unsupported-payload`](#opfcaption-unsupported-payload) | Format | error | structure | A caption is on a payload that cannot carry one. |
| [`opf/image-option-unsupported-payload`](#opfimage-option-unsupported-payload) | Format | error | structure | An image option is on a payload that is not an image. |
| [`opf/shape-option-unsupported-payload`](#opfshape-option-unsupported-payload) | Format | error | structure | A shape option is on a payload that is not a shape block. |
| [`opf/shape-adjust-unknown`](#opfshape-adjust-unknown) | Format | warning | structure | An adjust value names a guide the preset does not have. |
| [`opf/shape-adjust-range`](#opfshape-adjust-range) | Format | warning | structure | An adjust value is outside the range of the preset's handle. |
| [`opf/shape-link-hidden`](#opfshape-link-hidden) | Format | warning | structure | A hidden shape carries a link. |
| [`opf/shape-anchor-missing`](#opfshape-anchor-missing) | Format | error | structure | An overlay shape is attached to a block that is not on the slide. |
| [`opf/connector-end-missing`](#opfconnector-end-missing) | Format | error | structure | A connector end names no block or overlay shape on the slide. |
| [`opf/image-placement-invalid`](#opfimage-placement-invalid) | Format | error | structure | An image placement cannot be honoured. |
| [`opf/layout-placeholder-group`](#opflayout-placeholder-group) | Format | error | structure | A layout record's placeholder group breaks a nesting rule. |
| [`opf/dataset-unknown`](#opfdataset-unknown) | Format | error | structure | A chart or table names a dataset that does not exist. |
| [`opf/dataset-field-unknown`](#opfdataset-field-unknown) | Format | error | structure | A table asks a dataset for a column it does not have. |
| [`opf/data-column-duplicate`](#opfdata-column-duplicate) | Format | error | structure | A dataset or table has two columns with the same name. |
| [`opf/chart-mapping-unknown-column`](#opfchart-mapping-unknown-column) | Format | error | structure | A chart mapping names a column the data does not have. |
| [`opf/number-format-invalid`](#opfnumber-format-invalid) | Format | error | structure | A number format cannot be read. |
| [`opf/variable-invalid-value`](#opfvariable-invalid-value) | Format | error | structure | A variable value does not match its declared type. |
| [`opf/variable-unknown-builtin`](#opfvariable-unknown-builtin) | Format | error | structure | A token names a built-in variable that does not exist. |
| [`opf/table-highlight-unknown-name`](#opftable-highlight-unknown-name) | Format | error | structure | A table highlight names a row the table does not have. |
| [`opf/chart-highlight-unknown-name`](#opfchart-highlight-unknown-name) | Format | error | structure | A chart highlight names a series or category the chart does not have. |
| [`opf/variable-format`](#opfvariable-format) | Format | error | structure | A variable cannot be formatted. |
| [`opf/variable-unfilled`](#opfvariable-unfilled) | Format | error | structure | A required template variable has no value. |
| [`opf/run-color-unrecognized`](#opfrun-color-unrecognized) | Format | warning | structure | A text run colour is none of the documented forms. |
| [`opf/numbering-start-ignored`](#opfnumbering-start-ignored) | Format | warning | structure | A list entry sets `start` where nothing is numbered. |
| [`opf/slide-size-out-of-range`](#opfslide-size-out-of-range) | Format | warning | structure | The slide size is outside PowerPoint's 1 to 56 inch range. |
| [`opf/undeclared-catalog`](#opfundeclared-catalog) | Format | error | structure | A reference names a catalog group the document does not declare. |
| [`opf/asset-reference`](#opfasset-reference) | References | error | structure | An `asset:` reference names an asset that is not in the registry. |
| [`opf/asset-cycle`](#opfasset-cycle) | References | error | structure | Asset references form a cycle. |
| [`opf/catalog-record`](#opfcatalog-record) | References | error | structure | An embedded or registered catalog record is invalid. |
| [`opf/layout-template`](#opflayout-template) | References | error | structure | A layout template's region list is malformed. |
| [`opf/layout-region`](#opflayout-region) | References | error | structure | A layout template's regions are not valid. |
| [`opf/unresolved-reference`](#opfunresolved-reference) | References | warning | structure | A content reference resolves nowhere. |
| [`opf/catalog-record-not-in-source`](#opfcatalog-record-not-in-source) | References | warning | structure | A record embedded under a catalog group is not in that catalog. |
| [`opf/unused-reference`](#opfunused-reference) | References | warning | structure | A reference is never cited. |
| [`opf/unused-dataset`](#opfunused-dataset) | References | warning | structure | A dataset is never used. |
| [`opf/icon-unknown`](#opficon-unknown) | References | warning | structure | An icon names a set or an icon that does not exist. |
| [`opf/icon-invalid`](#opficon-invalid) | References | warning | structure | The SVG of an icon cannot be drawn as an icon. |
| [`opf/unknown-beat`](#opfunknown-beat) | References | warning | structure | A slide names a beat its narrative does not define. |
| [`opf/slide-theme-dimensions`](#opfslide-theme-dimensions) | References | warning | structure | A slide theme sets a slide size that differs from the deck. |
| [`opf/variable-unknown`](#opfvariable-unknown) | References | warning | structure | A `{{token}}` names a variable that is not declared. |
| [`opf/variable-unknown-value`](#opfvariable-unknown-value) | References | warning | structure | A value was supplied for a variable that is not declared. |
| [`opf/variable-unused`](#opfvariable-unused) | References | warning | structure | A variable is declared but never used. |
| [`opf/variable-reference-unknown`](#opfvariable-reference-unknown) | References | warning | structure | A `var:` colour names a variable that is not declared. |
| [`opf/contract`](#opfcontract) | Policy | error | structure | A field is outside the values a host policy allows. |
| [`opf/text-contrast`](#opftext-contrast) | Accessibility | warning | composition | Text colour has too little contrast against the background it sits on. |
| [`opf/text-on-image`](#opftext-on-image) | Accessibility | info | composition | Text sits on a background picture: a note when core draws its automatic scrim behind it, otherwise its contrast cannot be guaranteed. |
| [`opf/missing-alt-text`](#opfmissing-alt-text) | Accessibility | warning | structure | A picture has no alt text and is not marked decorative. |
| [`opf/poor-alt-text`](#opfpoor-alt-text) | Accessibility | info | structure | Alt text is a file name, a URL, a generic word or very long. |
| [`opf/missing-slide-title`](#opfmissing-slide-title) | Accessibility | warning | structure | A slide has no title. |
| [`opf/duplicate-slide-title`](#opfduplicate-slide-title) | Accessibility | info | structure | Two slides have the same title. |
| [`opf/reading-order`](#opfreading-order) | Accessibility | warning | composition | The order content is read differs from the order it appears on the slide. |
| [`opf/link-text`](#opflink-text) | Accessibility | warning | structure | Link text does not say where the link goes. |
| [`opf/chart-color-only`](#opfchart-color-only) | Accessibility | info | structure | Chart series may be indistinguishable without colour vision. |
| [`opf/chart-colors-adjusted`](#opfchart-colors-adjusted) | Accessibility | warning | structure | A chart colour cannot be used as authored. |
| [`opf/chart-text-alternative`](#opfchart-text-alternative) | Accessibility | info | structure | A chart has no text alternative, or is marked decorative. |
| [`opf/missing-language`](#opfmissing-language) | Accessibility | info | structure | The presentation does not declare its language. |
| [`opf/chart-option-adapted`](#opfchart-option-adapted) | Layout | warning | structure | A chart option cannot be shown by the chart type. |
| [`opf/text-overflow`](#opftext-overflow) | Layout | warning | composition | Text or a table does not fit its space at the smallest allowed size. |
| [`opf/unresolved-content`](#opfunresolved-content) | Layout | warning | composition | Content cannot be drawn as authored. |
| [`opf/layout-failed`](#opflayout-failed) | Layout | warning | composition | The slide layout could not be computed. |
| [`opf/min-font-size`](#opfmin-font-size) | Layout | warning | composition | Text is drawn smaller than the readable minimum. |
| [`opf/region-unknown`](#opfregion-unknown) | Layout | warning | composition | A block is pinned to a region the layout does not have. |
| [`opf/region-kind`](#opfregion-kind) | Layout | warning | composition | A block is pinned to a region that does not accept its kind. |
| [`opf/region-full`](#opfregion-full) | Layout | warning | composition | A block is pinned to a region that is already full. |
| [`opf/layout-unplaced`](#opflayout-unplaced) | Layout | warning | composition | No region of the layout has room for a block. |
| [`opf/icon-dropped`](#opficon-dropped) | Layout | warning | composition | An icon is not drawn. |
| [`opf/arrangement-adapted`](#opfarrangement-adapted) | Layout | info | composition | A pyramid, matrix, cycle, row of chevrons or flow is drawn another way. |
| [`opf/furniture-wraps`](#opffurniture-wraps) | Layout | warning | composition | A header or footer zone wraps onto more than 2 lines. |
| [`opf/font-outside-scheme`](#opffont-outside-scheme) | Layout | warning | structure | Text uses a font family that is not in the deck's font scheme. |
| [`opf/image-resolution`](#opfimage-resolution) | Layout | warning | composition | An image has too few pixels for the size it is shown at. |
| [`opf/text-shrunk`](#opftext-shrunk) | Layout | info | composition | Text is fitted far below its role's starting size (under 70%). |
| [`opf/centered-body`](#opfcentered-body) | Layout | info | composition | A paragraph or list of more than 2 lines or 120 characters is centered. |
| [`opf/tight-spacing`](#opftight-spacing) | Layout | info | composition | Blocks are closer than 0.25 in to each other or 0.5 in to the slide edge. |
| [`opf/layout-monotony`](#opflayout-monotony) | Layout | info | structure | 4 or more content slides in a row use the same layout record. |
| [`opf/chart-value-not-numeric`](#opfchart-value-not-numeric) | Content | warning | structure | A chart value is text, not a number. |
| [`opf/chart-mapping-adapted`](#opfchart-mapping-adapted) | Content | warning | structure | A chart mapping entry is ignored. |
| [`opf/chart-highlight-adapted`](#opfchart-highlight-adapted) | Content | warning | structure | A chart highlight is adapted by the chart type. |
| [`opf/chart-series-dropped`](#opfchart-series-dropped) | Content | warning | structure | A chart series is not drawn by the chart type. |
| [`opf/code-highlight-out-of-range`](#opfcode-highlight-out-of-range) | Content | warning | structure | A code highlight marks a line the code does not have. |
| [`opf/code-highlight-range-reversed`](#opfcode-highlight-range-reversed) | Content | warning | structure | A code highlight range ends before it starts. |
| [`opf/variable-builtin-missing`](#opfvariable-builtin-missing) | Content | warning | structure | A built-in variable has no value in this document. |
| [`opf/duration-outside-narrative`](#opfduration-outside-narrative) | Content | warning | structure | The target duration is outside the range the narrative suits. |
| [`opf/narrative-duration-range`](#opfnarrative-duration-range) | Content | warning | structure | An inline narrative duration range has min greater than max. |
| [`opf/placeholder-text`](#opfplaceholder-text) | Content | warning | structure | Placeholder text was left in the deck. |
| [`opf/empty-text`](#opfempty-text) | Content | info | structure | A text field is present but empty. |
| [`opf/unused-beat`](#opfunused-beat) | Content | info | structure | A beat of the narrative has no slide that references it. |
| [`opf/empty-slide`](#opfempty-slide) | Content | warning | structure | A slide has no content at all. |
| [`opf/language-tag`](#opflanguage-tag) | Content | warning | structure | A language tag is malformed, uses an unassigned region or is not in canonical case. |
| [`opf/straight-quotes`](#opfstraight-quotes) | Content | info | structure | Text uses straight quotation marks (" or ') where the language has typographic ones. |
| [`opf/chart-dual-axis`](#opfchart-dual-axis) | Content | info | structure | A combo chart plots a series on a secondary value axis. |
| [`opf/chart-pie-many-slices`](#opfchart-pie-many-slices) | Content | info | structure | A pie or doughnut chart has more than 5 slices. |

## Format rules

*Is it well-formed OPF?*

### `opf/json-syntax`

Default severity: **error**. Cost: syntax. The text is not strict JSON.

**Why.** Every OPF tool reads JSON. A misplaced comma, quote, comment or trailing comma makes the file unreadable, and the range says where.

**Basis.** RFC 8259 (strict JSON: no comments, no trailing commas)

**Approximations.** Only text input is checked. A string is always read as JSON. One finding per root cause, in position order and at most five (a key with no value, a missing comma, a bracket never closed; not the damage each one causes further on): `message` says what is wrong, `help` what to do next and `location` is the range to underline. A text that looks like YAML or Markdown gets one finding with a hint to use fromYaml or fromMarkdown first. Source editors get the same causes with their quick fixes from analyzeJsonSyntax (@openpresentation/opf/source).

### `opf/duplicate-key`

Default severity: **error**. Cost: syntax. A JSON object repeats a key.

**Why.** JSON.parse keeps only the last value of a repeated key, so the earlier one disappears without a trace. The check compares escaped and literal spellings of the same key.

**Basis.** RFC 8259 section 4 (names within an object should be unique)

### `opf/schema`

Default severity: **error**. Cost: structure. The document breaks the OPF schema or a structural rule the schema cannot express.

**Why.** The schema is the contract every engine, exporter and editor relies on. A field of the wrong type, a missing required field, an unknown property or content fields that cannot be mixed make the document ambiguous or undrawable.

**Basis.** spec/schemas/opf.schema.json (JSON Schema 2020-12) and the semantic rules of OPF

**Approximations.** All alternatives of a union are reported, with the failing schema location in `validation`. A required variable with no value is reported by `opf/variable-unfilled`, in the same category. A chart written in the Chart.js or ECharts shape (`categories` and `series`, or `labels` and `datasets`, and no `data`) is one finding on the chart whose hint shows its own values as `data: { columns, rows }`, with a patch fix; the additional-property findings that repeat it are dropped.

### `opf/reference-id-duplicate`

Default severity: **error**. Cost: structure. Two references share an id.

**Why.** A citation names a reference by id; a repeated id makes it ambiguous which entry is cited.

**Basis.** spec/schemas/opf.schema.json (JSON Schema 2020-12) and the semantic rules of OPF

### `opf/cite-unknown-reference`

Default severity: **error**. Cost: structure. A citation names a reference that does not exist.

**Why.** A cited id with no entry in `references` has nothing to show in the footnote area.

**Basis.** spec/schemas/opf.schema.json (JSON Schema 2020-12) and the semantic rules of OPF

### `opf/cite-unsupported-location`

Default severity: **error**. Cost: structure. A citation or footnote sits where no engine draws it.

**Why.** `cite` and `footnote` apply to runs in text, bullets and list items; table cells, captions, and reference and footnote texts have no marker.

**Basis.** spec/schemas/opf.schema.json (JSON Schema 2020-12) and the semantic rules of OPF

### `opf/caption-unsupported-payload`

Default severity: **error**. Cost: structure. A caption is on a payload that cannot carry one.

**Why.** A caption belongs to exactly one image, chart, table or video; a group, text or code block has no place to draw it.

**Basis.** spec/schemas/opf.schema.json (JSON Schema 2020-12) and the semantic rules of OPF

### `opf/image-option-unsupported-payload`

Default severity: **error**. Cost: structure. An image option is on a payload that is not an image.

**Why.** `fit`, `focus`, the image treatments (`shape`, `adjust`, `stroke`, `opacity`, `recolor`, `overlay`, `aspectRatio`), `placement` and `portrait` describe how a picture is drawn; a group, text or chart block has no picture for them to apply to. A shape block takes `shape`, `adjust`, `stroke`, `opacity` and `aspectRatio` too.

**Basis.** spec/schemas/opf.schema.json (JSON Schema 2020-12) and the semantic rules of OPF

### `opf/shape-option-unsupported-payload`

Default severity: **error**. Cost: structure. A shape option is on a payload that is not a shape block.

**Why.** `fill`, `style`, `rotate`, `flip`, `anchor`, `padding`, `textDirection`, `alt`, `decorative`, `hidden`, `link` and the effects (`shadow`, `innerShadow`, `glow`, `softEdge`, `reflection`, `blur`) describe how a shape block is drawn; a text, chart or image block, or a group, has no shape for them to apply to.

**Basis.** spec/schemas/opf.schema.json (JSON Schema 2020-12) and the semantic rules of OPF

### `opf/shape-adjust-unknown`

Default severity: **warning**. Cost: structure. An adjust value names a guide the preset does not have.

**Why.** Each preset has its own adjust handles (DrawingML's avLst guides: `adj`, `adj1`, `adj2`, ...); a name the preset does not have changes nothing, and a custom `path` has none. The preset's default is drawn.

**Basis.** ECMA-376 Part 1, 20.1.10.56 (ST_ShapeType) and presetShapeDefinitions.xml

### `opf/shape-adjust-range`

Default severity: **warning**. Cost: structure. An adjust value is outside the range of the preset's handle.

**Why.** An adjust value outside the range its handle allows is pinned by the preset's own formulas, so the shape is not drawn as the value says; core draws the preset's default instead and both engines agree.

**Basis.** ECMA-376 Part 1, 20.1.10.56 (ST_ShapeType) and presetShapeDefinitions.xml

**Approximations.** Ranges are checked at a square shape of the default size; a handle whose range depends on the shape's proportions is checked at those proportions when the shape is drawn.

### `opf/shape-link-hidden`

Default severity: **warning**. Cost: structure. A hidden shape carries a link.

**Why.** A hidden shape (`hidden: true`) is not drawn, so its `link` can never be clicked in a slide show.

**Basis.** spec/schemas/opf.schema.json (JSON Schema 2020-12) and the semantic rules of OPF

### `opf/shape-anchor-missing`

Default severity: **error**. Cost: structure. An overlay shape is attached to a block that is not on the slide.

**Why.** An overlay shape placed with `at` sits against a composed block of its slide, named by the block's `id`. With no block of that id on the slide there is nowhere to put it, so it is not drawn.

**Basis.** spec/schemas/opf.schema.json (JSON Schema 2020-12) and the semantic rules of OPF

### `opf/connector-end-missing`

Default severity: **error**. Cost: structure. A connector end names no block or overlay shape on the slide.

**Why.** A connector joins two shapes of its slide, each named by the `id` of a block or an overlay shape. With an end that names nothing (or names a connector) there is nothing to glue it to, so it is not drawn.

**Basis.** spec/schemas/opf.schema.json (JSON Schema 2020-12) and the semantic rules of OPF

### `opf/image-placement-invalid`

Default severity: **error**. Cost: structure. An image placement cannot be honoured.

**Why.** A placed image bleeds to a slide edge and the rest of the slide composes beside it. Only a top-level block (slides.N.blocks.I) can do that, and a slide edge holds one placed image; a block in a group or a promoted region, or a second block on the same edge, has nowhere to go.

**Basis.** spec/schemas/opf.schema.json (JSON Schema 2020-12) and the semantic rules of OPF

### `opf/layout-placeholder-group`

Default severity: **error**. Cost: structure. A layout record's placeholder group breaks a nesting rule.

**Why.** A placeholder group arranges body regions inside one cell of its layout record. Groups nest at most three levels inside a record, and a group holds body regions and groups only: the headings (title, subtitle, tag) stay at the record's top level, where the engine places them. Composition cannot use a record that breaks either rule.

**Basis.** spec/schemas/opf.schema.json (JSON Schema 2020-12) and the semantic rules of OPF

### `opf/dataset-unknown`

Default severity: **error**. Cost: structure. A chart or table names a dataset that does not exist.

**Why.** The data cannot be drawn without the dataset it refers to.

**Basis.** spec/schemas/opf.schema.json (JSON Schema 2020-12) and the semantic rules of OPF

### `opf/dataset-field-unknown`

Default severity: **error**. Cost: structure. A table asks a dataset for a column it does not have.

**Why.** The column cannot be shown when the dataset has no column of that name.

**Basis.** spec/schemas/opf.schema.json (JSON Schema 2020-12) and the semantic rules of OPF

### `opf/data-column-duplicate`

Default severity: **error**. Cost: structure. A dataset or table has two columns with the same name.

**Why.** Series, mappings and fields address columns by name, so a repeated name makes them ambiguous.

**Basis.** spec/schemas/opf.schema.json (JSON Schema 2020-12) and the semantic rules of OPF

### `opf/chart-mapping-unknown-column`

Default severity: **error**. Cost: structure. A chart mapping names a column the data does not have.

**Why.** The series cannot be built from a column that is not there.

**Basis.** spec/schemas/opf.schema.json (JSON Schema 2020-12) and the semantic rules of OPF

### `opf/number-format-invalid`

Default severity: **error**. Cost: structure. A number format cannot be read.

**Why.** A format code that no engine can parse is drawn as the plain number or fails to export.

**Basis.** Excel number format codes, as far as OPF supports them

### `opf/variable-invalid-value`

Default severity: **error**. Cost: structure. A variable value does not match its declared type.

**Why.** A number variable given text, or a date given a non-date, cannot be filled into the deck.

**Basis.** spec/schemas/opf.schema.json (JSON Schema 2020-12) and the semantic rules of OPF

### `opf/variable-unknown-builtin`

Default severity: **error**. Cost: structure. A token names a built-in variable that does not exist.

**Why.** The `deck.`, `speaker.`, `organization.` and `slide.` names (and `speakers`) are reserved for built-in variables; a name under them that is not a built-in can never be filled, so the token would show literally. The slide-scoped `slide.number`, `slide.section` and `deck.slideCount` are inline tokens only, so `var:slide.*` and `var:deck.slideCount` are reported too; organization logos are whole-field references only (`var:organization.logo.icon`), so a `{{organization.logo}}` token, an unknown logo shape or an unknown organization id is reported.

**Basis.** spec/schemas/opf.schema.json (JSON Schema 2020-12) and the semantic rules of OPF

### `opf/table-highlight-unknown-name`

Default severity: **error**. Cost: structure. A table highlight names a row the table does not have.

**Why.** `table.highlight` emphasizes body rows by their first-column text; a name that matches no row highlights nothing, so the table is not drawn as authored.

**Basis.** spec/schemas/opf.schema.json (JSON Schema 2020-12) and the semantic rules of OPF

### `opf/chart-highlight-unknown-name`

Default severity: **error**. Cost: structure. A chart highlight names a series or category the chart does not have.

**Why.** `chart.highlight` emphasises marks by name; a name that matches no series or category in the chart data highlights nothing, so the chart is not drawn as authored.

**Basis.** spec/schemas/opf.schema.json (JSON Schema 2020-12) and the semantic rules of OPF

### `opf/variable-format`

Default severity: **error**. Cost: structure. A variable cannot be formatted.

**Why.** A number or date format that does not apply to the value leaves the token unreadable.

**Basis.** spec/schemas/opf.schema.json (JSON Schema 2020-12) and the semantic rules of OPF

### `opf/variable-unfilled`

Default severity: **error**. Cost: structure. A required template variable has no value.

**Why.** A variable a deck declares as required, with no value, is template scaffolding: `{{name}}` tokens show up literally and colour variables fall back to a default. A normal deck must be filled, so this is an error and the deck is not valid; a template (`template: true`) is incomplete on purpose, so it is a warning.

**Approximations.** Required variables are those the variable machinery reports as unfilled for the document (declared, no value, not `required: false`, not given by the `values` option). For a document that declares no content variables, `{{id}}` / `{{id|format}}` tokens (`{{` escapes) left in any string outside `variables`, `extensions`, `catalogs` and `assets` are reported as warnings. `var:` colour references with no declaration are reported as `opf/variable-reference-unknown`. Fill a template with `opf fill` or `resolveVariables` to clear the findings.

### `opf/run-color-unrecognized`

Default severity: **warning**. Cost: structure. A text run colour is none of the documented forms.

**Why.** Run colours are open strings so imported decks stay valid, but a value that is not a hex colour, a colour-scheme name or a `var:` reference falls back to the theme colour.

**Basis.** spec/schemas/opf.schema.json (JSON Schema 2020-12) and the semantic rules of OPF

### `opf/numbering-start-ignored`

Default severity: **warning**. Cost: structure. A list entry sets `start` where nothing is numbered.

**Why.** A start value only restarts an auto-number; without `numbering` on the payload it has no effect.

**Basis.** spec/schemas/opf.schema.json (JSON Schema 2020-12) and the semantic rules of OPF

### `opf/slide-size-out-of-range`

Default severity: **warning**. Cost: structure. The slide size is outside PowerPoint's 1 to 56 inch range.

**Why.** The schema accepts any positive custom `widthInches` and `heightInches`, but a PPTX stores the size as `p:sldSz` with each side between 914400 and 51206400 EMU, which is 1 to 56 inches. A custom size outside that range exports a file that does not conform to the standard, which PowerPoint may reject or clamp. It is a warning because the document is still correct OPF and the preview draws it.

**Basis.** ECMA-376 / ISO/IEC 29500-1 section 19.2.1.39 (p:sldSz) and section 19.7.17 (ST_SlideSizeCoordinate): 914400 to 51206400 EMU

**Approximations.** Checks the deck's resolved size: `design.dimensions`, else the resolved theme's `dimensions`. Inches are converted to EMU as the PPTX exporter does (`Math.round(inches * 914400)`), so a side of exactly 1 in or 56 in passes. A slide-level theme with another size is `opf/slide-theme-dimensions`. Presets are always in range. PowerPoint's own behaviour at the limits was not measured.

### `opf/undeclared-catalog`

Default severity: **error**. Cost: structure. A reference names a catalog group the document does not declare.

**Why.** The prefix of a `name:id` reference names the group of `catalogs` it resolves in. A prefix with no group can never resolve, whatever the host registers, so it is a format error: engines reject the document at their format check instead of drawing a fallback.

**Basis.** spec/schemas/opf.schema.json (JSON Schema 2020-12) and the semantic rules of OPF


## References rules

*Does everything it points at resolve?*

### `opf/asset-reference`

Default severity: **error**. Cost: structure. An `asset:` reference names an asset that is not in the registry.

**Why.** An image, logo or video that points at a missing asset cannot be drawn or exported. The check reads the document's own registry only; no file or URL is fetched.

**Basis.** spec/schemas/opf.schema.json (JSON Schema 2020-12) and the semantic rules of OPF

### `opf/asset-cycle`

Default severity: **error**. Cost: structure. Asset references form a cycle.

**Why.** An asset whose source points back at itself never resolves to a file.

**Basis.** spec/schemas/opf.schema.json (JSON Schema 2020-12) and the semantic rules of OPF

### `opf/catalog-record`

Default severity: **error**. Cost: structure. An embedded or registered catalog record is invalid.

**Why.** A record that fails its companion schema cannot be resolved. Invalid records are left out of the lookup, so the references to them are reported too.

**Basis.** spec/schemas/<kind>.schema.json

### `opf/layout-template`

Default severity: **error**. Cost: structure. A layout template's region list is malformed.

**Why.** A layout is one ordered list of regions, nested through splits for two dimensions. Engines cannot compose a list that is not 1 to 12 entries, an entry that is neither a region nor a split, a direction or size that is not valid, an "auto" size anywhere but in a column, splits nested more than three levels deep (the record's own list is level 1), or regions that compile to a grid larger than 12 x 12. composeSlide refuses such a record, so a slide that names it composes automatically.

**Basis.** spec/schemas/layout.schema.json and the region list rules (docs/layout-templates.md)

**Approximations.** Checked on every layout record the document embeds and every registered record it uses, once the record passes its schema.

### `opf/layout-region`

Default severity: **error**. Cost: structure. A layout template's regions are not valid.

**Why.** Region names are unique across the whole record and may not be tag, auto or a promoted-region word (left, center, right, top, middle, bottom), so a Markdown block's region= stays unambiguous; title and subtitle name the heading regions, which take only a size, an anchor and (the title) a rule; a subtitle region needs a title region; a region accepts at least one content kind; a region with flow 'none' holds one block; overflowRegion must name a body region. composeSlide refuses such a record.

**Basis.** spec/schemas/layout.schema.json and the region rules (docs/layout-templates.md)

### `opf/unresolved-reference`

Default severity: **warning**. Cost: structure. A content reference resolves nowhere.

**Why.** A layout, theme, colour scheme, font scheme, narrative, audience, purpose or tone reference that neither the document embeds nor a registered catalog defines falls back: a slide composes automatically, a design uses the engine default. A strict export fails instead. A slide with no layout is automatic composition and is never reported.

**Basis.** spec/schemas/opf.schema.json (JSON Schema 2020-12) and the semantic rules of OPF

**Approximations.** Resolved like every engine resolves it: catalogs.custom, then the records embedded under catalogs.default, then the catalog registered for its source (the first registered catalog when `default` is omitted); `name:id` in catalogs.<name>, then the catalog registered for its source. Nothing is fetched. Free-form audience and purpose text is not a reference. It is a warning, not an error, because catalogs are open and a host may register the id; `--fail-on warning` is the check that a deck is done. With a catalog registered, the hint names the nearest records that exist ("Did you mean `two-column`?").

### `opf/catalog-record-not-in-source`

Default severity: **warning**. Cost: structure. A record embedded under a catalog group is not in that catalog.

**Why.** A record under catalogs.default or a named group says it came from the catalog its source names. When the catalog the host registered for that source has no record of that kind and id, the record is the document's own and belongs in catalogs.custom, where an update from the catalog never looks for it. Rendering is unchanged: the embedded record still wins.

**Basis.** spec/schemas/opf.schema.json (JSON Schema 2020-12) and the semantic rules of OPF

**Approximations.** Checked only against a catalog the host registered for the group's source (the first registered catalog for an omitted default.source); with none registered for it the check is silent. A record the catalog has with different content is an update difference (updateFromCatalog), not this finding. catalogs.custom is never checked.

### `opf/unused-reference`

Default severity: **warning**. Cost: structure. A reference is never cited.

**Why.** A listed reference that no run cites is not drawn anywhere.

**Basis.** spec/schemas/opf.schema.json (JSON Schema 2020-12) and the semantic rules of OPF

### `opf/unused-dataset`

Default severity: **warning**. Cost: structure. A dataset is never used.

**Why.** A dataset no chart or table references is not drawn anywhere.

**Basis.** spec/schemas/opf.schema.json (JSON Schema 2020-12) and the semantic rules of OPF

### `opf/icon-unknown`

Default severity: **warning**. Cost: structure. An icon names a set or an icon that does not exist.

**Why.** An `icon` is "<set>:<name>" (a set the document embeds or a registered catalog defines, such as lucide and tabler of the gallery), a name of the `icons` of the deck, or an SVG source. One that resolves nowhere is not drawn: the entry, metric or group keeps its text and has no chip.

**Basis.** spec/schemas/opf.schema.json (JSON Schema 2020-12) and the semantic rules of OPF

**Approximations.** A set a host registers as a loader is checked once it is loaded (ensureIcons): the CLI, the MCP and the Node file API load the sets a deck names before they validate it; the synchronous validate alone checks only the set ids and the sets the document embeds. Suggestions are the nearest names of the set (or of the icons of the deck).

### `opf/icon-invalid`

Default severity: **warning**. Cost: structure. The SVG of an icon cannot be drawn as an icon.

**Why.** The SVG of an icon is read, never run: a script, an event handler, an external reference (an href or url() that is not a fragment) or a raster image makes it unusable, as does SVG text that is not well formed or has no size. It is not drawn.

**Basis.** spec/schemas/opf.schema.json (JSON Schema 2020-12) and the semantic rules of OPF

### `opf/unknown-beat`

Default severity: **warning**. Cost: structure. A slide names a beat its narrative does not define.

**Why.** `slides[].beat` links a slide to a step of the narrative plan. A beat id the narrative does not have links to nothing; nothing is drawn from a beat.

**Basis.** spec/schemas/opf.schema.json (JSON Schema 2020-12) and the semantic rules of OPF

**Approximations.** The narrative resolves like every content reference: the document's catalogs groups, then the registered catalogs. A narrative that resolves nowhere is not checked.

### `opf/slide-theme-dimensions`

Default severity: **warning**. Cost: structure. A slide theme sets a slide size that differs from the deck.

**Why.** A PPTX has one slide size. The size a slide-level theme carries is never used: design.dimensions of the deck (or of its theme) wins in every engine, and without them the exporter stops with mixed slide sizes.

**Basis.** spec/schemas/opf.schema.json (JSON Schema 2020-12) and the semantic rules of OPF

### `opf/variable-unknown`

Default severity: **warning**. Cost: structure. A `{{token}}` names a variable that is not declared.

**Why.** An undeclared token is shown literally.

**Basis.** spec/schemas/opf.schema.json (JSON Schema 2020-12) and the semantic rules of OPF

### `opf/variable-unknown-value`

Default severity: **warning**. Cost: structure. A value was supplied for a variable that is not declared.

**Why.** The value is never used.

**Basis.** spec/schemas/opf.schema.json (JSON Schema 2020-12) and the semantic rules of OPF

### `opf/variable-unused`

Default severity: **warning**. Cost: structure. A variable is declared but never used.

**Why.** A declaration nothing refers to has no effect.

**Basis.** spec/schemas/opf.schema.json (JSON Schema 2020-12) and the semantic rules of OPF

### `opf/variable-reference-unknown`

Default severity: **warning**. Cost: structure. A `var:` colour names a variable that is not declared.

**Why.** An undeclared colour variable falls back to a default colour.

**Basis.** spec/schemas/opf.schema.json (JSON Schema 2020-12) and the semantic rules of OPF


## Policy rules

*Does it follow the host's house rules?*

### `opf/contract`

Default severity: **error**. Cost: structure. A field is outside the values a host policy allows.

**Why.** A host that needs brand layouts, fonts or other fixed choices states them as contracts. The default severity is error; a contract can set its own. Document metadata never installs policy.

**Approximations.** Only the `contracts` option supplies policy, and it checks existing fields: a contract does not require an omitted field or insert a default.


## Accessibility rules

*Can everyone read it?*

### `opf/text-contrast`

Default severity: **warning**. Cost: composition. Text colour has too little contrast against the background it sits on.

**Why.** Low-contrast text is hard or impossible to read for people with low vision, colour-vision differences, glare on a projector or a poor display. WCAG sets 4.5:1 for normal text and 3:1 for large text.

**Basis.** WCAG 2.2 SC 1.4.3 Contrast (Minimum), level AA

**Thresholds.** `contrastNormal` (default 4.5), `contrastLarge` (default 3)

**Approximations.** Computed on sRGB colours with the WCAG relative-luminance formula, against the background the preview draws: a solid or theme colour, the card surface, a table cell fill, every colour a gradient takes under the text box (sampled on a 5x5 grid, angle respected), or both colours of a pattern. Anti-aliasing, text shadows and font weight are not modelled. Text colour is the preview's (the scheme's text role or dark1 on a light background and light1 on a dark one, chosen from the background luminance, where a gradient or picture background uses the scheme's default background colour), so a default can fail on a dark gradient. A link with no colour of its own is measured in the scheme's hyperlink colour.

### `opf/text-on-image`

Default severity: **info**. Cost: composition. Text sits on a background picture: a note when core draws its automatic scrim behind it, otherwise its contrast cannot be guaranteed.

**Why.** Contrast over a photograph depends on the photograph. Core draws an automatic scrim behind text on a picture background that has no overlay, at the lowest opacity that keeps it at 4.5:1 over any picture, and this note names it. With an edge-band overlay, or the scrim turned off (overlay: false), only a full-frame overlay that guarantees readability for every possible image certifies the result from the document.

**Basis.** WCAG 2.2 SC 1.4.3 Contrast (Minimum), level AA

**Thresholds.** `contrastNormal` (default 4.5), `contrastLarge` (default 3)

**Approximations.** Core reads picture pixels only through a host that measures them (ComposeSlideOptions.pictureLuminance). Otherwise the picture is bounded by a gray ramp from black to white, composited through the image opacity and a full-frame design.background overlay or the automatic scrim over the text it covers; the text passes only when every step of that ramp passes. An edge-banded overlay is not counted.

### `opf/missing-alt-text`

Default severity: **warning**. Cost: structure. A picture has no alt text and is not marked decorative.

**Why.** People using a screen reader get nothing for a picture without alternative text. A picture that is purely decorative should say so with an empty alt (alt: ""), which is an explicit, reviewed choice instead of an omission.

**Basis.** WCAG 2.2 SC 1.1.1 Non-text Content, level A

**Approximations.** Checks the alt field of images (image blocks, Slide.image and region images, placed or not), video, organization logos (each shape and background), header/footer images (a logo reference such as var:organization.logo.icon is checked on the organization), quote photos and speaker photos, following asset: references to the assets registry. Whether the text describes the picture well is not judged here (see opf/poor-alt-text). Charts carry `chart.alt` and are checked by opf/chart-text-alternative. Picture backgrounds are decorative unless they carry their own alt, and watermarks are decorative, so neither is checked.

### `opf/poor-alt-text`

Default severity: **info**. Cost: structure. Alt text is a file name, a URL, a generic word or very long.

**Why.** Alt text such as "image", "IMG_2041.png" or a 400-character paragraph does not do the job of describing a picture: it is read out and adds noise without information.

**Basis.** WCAG 2.2 SC 1.1.1 Non-text Content, level A

**Approximations.** Pattern checks only: file extensions and camera-style names, a bare generic word, a URL, a leading "image of", and more than 250 characters. Chart alt text (chart.alt) is checked too: a bare chart word, a URL, a leading "chart of" or more than 250 characters. It cannot tell whether a plausible sentence is accurate.

### `opf/missing-slide-title`

Default severity: **warning**. Cost: structure. A slide has no title.

**Why.** Slide titles are how people using a screen reader, an outline view or keyboard navigation find and tell slides apart; PowerPoint's own accessibility checker reports a missing title too.

**Basis.** WCAG 2.2 SC 2.4.2 Page Titled and SC 2.4.6 Headings and Labels, level AA (PowerPoint: "Missing slide title")

**Approximations.** Only the slide-level title field counts. Text that merely looks like a heading inside a block does not.

### `opf/duplicate-slide-title`

Default severity: **info**. Cost: structure. Two slides have the same title.

**Why.** Identical titles make slides indistinguishable in an outline or a screen reader's slide list.

**Approximations.** Titles are compared case-insensitively with whitespace collapsed. Slides that continue one another are not exempt; give a continuation a distinct title such as "(continued)".

### `opf/reading-order`

Default severity: **warning**. Cost: composition. The order content is read differs from the order it appears on the slide.

**Why.** Screen readers, keyboard focus and PowerPoint's selection pane follow the composed order. When it differs from the visual order (top to bottom, then start to end of the reading direction), the slide is read out of sequence.

**Basis.** WCAG 2.2 SC 1.3.2 Meaningful Sequence, level A (PowerPoint: "Check reading order")

**Approximations.** Compares the composed content order with a visual order recomputed from the composed boxes: items whose vertical centres fall in the same row are ordered along the reading direction (a right-to-left deck is checked by rows only), rows from top to bottom. Headings are expected first. Content drawn entirely above the title, over the columns of the title, is reported; content in a column beside the title is read after it. Free-form overlap is not analysed. On a slide with a template layout (OPF 0.19) the expected order is the binding order instead (the regions in reading order, then the blocks of each region), and items outside a region (placed images, the row below the grid) are not compared.

### `opf/link-text`

Default severity: **warning**. Cost: structure. Link text does not say where the link goes.

**Why.** People who scan links out of context (a screen reader's links list, a link tab order) hear only the text. "click here", "read more" or a long raw URL tells them nothing about the destination.

**Basis.** WCAG 2.2 SC 2.4.4 Link Purpose (In Context), level A; PowerPoint: "Hyperlink text is not meaningful"

**Approximations.** Matches a short list of generic phrases in English (after lower-casing and removing punctuation), blank link text, and raw URLs longer than 40 characters. Adjacent runs sharing one link are read as one link.

### `opf/chart-color-only`

Default severity: **info**. Cost: structure. Chart series may be indistinguishable without colour vision.

**Why.** OPF charts have no data labels or patterns, so series are told apart by colour alone (and legend order). Colours that look alike to someone with colour-vision deficiency, or when printed in greyscale, make series impossible to tell apart.

**Basis.** WCAG 2.2 SC 1.4.1 Use of Color, level A

**Thresholds.** `minSeriesColorDifference` (default 10)

**Approximations.** Uses the engine's series palette (ValidateOptions.chartPalette; default chartSeriesPalette of each slide color scheme (accent1 to accent6, then their tints), adjusted for the slide background and softened like the engines draw them, LH-105) in series order: series i takes color i, pie/doughnut/treemap/funnel slices take colours per category. Pairs are compared by CIE76 distance after simulating protanopia, deuteranopia, tritanopia (Machado 2009, severity 1) and greyscale. Neighbouring series (and neighbouring slices, on a pie or doughnut the last beside the first, which the engines move off the first by at most 20 L* or, where that is not enough, separate with a surface-colored slice border that this rule accepts, LH-161) must also differ by at least 11 in CIE L* (the lightness step the engines keep when they adjust a palette), since lightness is the cue left without hue (LH-35); a pair under it is reported as a lightness pair. Single-series charts and chart types without a series legend are skipped.

### `opf/chart-colors-adjusted`

Default severity: **warning**. Cost: structure. A chart colour cannot be used as authored.

**Why.** `chart.colors` sets the colour of series 1, 2, 3 and so on. A colour that cannot be resolved (a `var:` colour variable the deck does not define, or a name that is not a colour) is ignored and the deck palette colour of that position is used. A colour with under 3:1 contrast against the slide background the chart stands on is kept for its hue but drawn lighter or darker, so the chart does not show the colour that was written.

**Basis.** WCAG 2.2 SC 1.4.11 Non-text Contrast, level AA

**Approximations.** Resolves each entry like any colour reference (hex, colour-scheme slot or role, `var:` variable) against the slide's scheme and compares it with the slide background (no chart has a panel, LH-105; a chart in a card stands on the card, which is not measured) by WCAG contrast; 3:1 is the threshold the engines enforce. Translucent colours and unresolved backgrounds are not measured. Colours that look alike to colour-vision deficiency are reported by opf/chart-color-only, which judges the authored colours.

### `opf/chart-text-alternative`

Default severity: **info**. Cost: structure. A chart has no text alternative, or is marked decorative.

**Why.** A chart conveys a message; people who cannot see it need the message and ideally the numbers in text. The chart's alt field is that text alternative (the preview exposes it as the chart's accessible name and the PowerPoint export writes it as the frame's alternative text); a sentence or table beside the chart also serves. An empty alt marks a chart decorative, which is reported as info so the choice is reviewed: a chart rarely carries no message.

**Basis.** WCAG 2.2 SC 1.1.1 Non-text Content, level A

**Approximations.** A chart passes when chart.alt has text. Without alt, it passes when the slide has any other text, list, table, quote or metric content besides title and tag, or a subtitle. It does not judge whether alt or that text states the chart's point (see opf/poor-alt-text for generic alt text). alt: "" is reported as a decorative chart, whatever else is on the slide.

### `opf/missing-language`

Default severity: **info**. Cost: structure. The presentation does not declare its language.

**Why.** Screen readers and text-to-speech choose pronunciation and hyphenation from the declared language; spell checkers and translation tools use it too.

**Basis.** WCAG 2.2 SC 3.1.1 Language of Page, level A

**Approximations.** Only the presentation-level `language` is checked, not the language of individual runs (`TextRun.lang`; opf/language-tag checks how those tags are written).


## Layout rules

*Will it present as authored?*

### `opf/chart-option-adapted`

Default severity: **warning**. Cost: structure. A chart option cannot be shown by the chart type.

**Why.** An axis title, legend or data label option the chart type does not support is adapted by every engine, so the chart is not drawn exactly as authored.

**Basis.** spec/schemas/opf.schema.json (JSON Schema 2020-12) and the semantic rules of OPF

### `opf/text-overflow`

Default severity: **warning**. Cost: composition. Text or a table does not fit its space at the smallest allowed size.

**Why.** Core composition shrinks text to the readable minimum and then reports what still does not fit. Overflowing text is clipped or runs over other content in the preview and in PowerPoint.

**Approximations.** Uses composeSlide at the deck's slide size with the fonts of the resolved font scheme. Without a host-supplied text measurement (ValidateOptions.fonts.textMeasurement) widths are core's portable estimate, which can differ from the real font by a few percent; pass the renderer's measurement for font-exact results. A composition that sets overflow: "error" is reported as a warning here, so that `valid` never depends on font metrics; rendering and export still refuse such a slide when it does not fit.

### `opf/unresolved-content`

Default severity: **warning**. Cost: composition. Content cannot be drawn as authored.

**Why.** composeSlide reports content it cannot place or an effect it does not support (for example a picture bullet without a logo, a date field without a date, or an unsupported image treatment). The preview and the export fall back.

### `opf/layout-failed`

Default severity: **warning**. Cost: composition. The slide layout could not be computed.

**Why.** Composition threw for a slide that passed schema validation, so geometry-based rules (contrast, overflow, reading order, resolution) were skipped for it.

### `opf/min-font-size`

Default severity: **warning**. Cost: composition. Text is drawn smaller than the readable minimum.

**Why.** Small type is unreadable from the back of a room and on a phone. The engine's own default floor is 12 pt (16 px); anything much below that was lowered on purpose or by a composition that could not fit the text.

**Basis.** Common presentation guidance (12 pt minimum for body text; 18 pt or more is easier to read from a distance).

**Thresholds.** `minFontSizePt` (default 11)

**Approximations.** Sizes are those composeSlide fitted, expressed on the 13.33 x 7.5 in reference slide (96 px per inch, so 1 px is 0.75 pt; a smaller canvas scales type down with it) and explicit run fontSize values in points. Per payload, the smallest part (a metric label or a quote attribution) is reported. Table cell text (default 11.25 pt), code and header/footer furniture are not checked.

### `opf/region-unknown`

Default severity: **warning**. Cost: composition. A block is pinned to a region the layout does not have.

**Why.** A region pin (`region` on a root block) names a region of the slide's layout. A name the layout does not have is ignored: the block is placed by its kind, which may not be where the author meant.

### `opf/region-kind`

Default severity: **warning**. Cost: composition. A block is pinned to a region that does not accept its kind.

**Why.** A region says which content kinds it takes. A pin to a region that does not take the block's kind is ignored and the block is placed by its kind.

### `opf/region-full`

Default severity: **warning**. Cost: composition. A block is pinned to a region that is already full.

**Why.** A region holds at most `max` blocks on one slide. A pin to a full region is ignored and the block is placed by its kind.

### `opf/layout-unplaced`

Default severity: **warning**. Cost: composition. No region of the layout has room for a block.

**Why.** Content is never dropped: a block no region has room for is drawn in the layout's overflow region beyond its max (or below the grid), where it crowds the others. Paginate moves it to a continuation slide with the same layout.

### `opf/icon-dropped`

Default severity: **warning**. Cost: composition. An icon is not drawn.

**Why.** An icon is decoration: it never costs text its size. When the chips would set any block smaller than the slide sets it without them, the slide is drawn without its icons, and an icon on something icons do not mark (a nested or numbered list entry) is not drawn either. The text is always drawn.

### `opf/arrangement-adapted`

Default severity: **info**. Cost: composition. A pyramid, matrix, cycle, row of chevrons or flow is drawn another way.

**Why.** A `pyramid`, `matrix`, `cycle`, `chevrons`, `flow` or `vertical-flow` region draws a list of one level of short entries as that diagram (docs/smartart.md). A matrix needs exactly four entries for its quadrants; with another count its entries are drawn as a grid of cards. A list the arrangement does not draw (nested entries, descriptions, icons, numbering, too many entries), or whose entries fit neither PowerPoint's design nor OPF's at the list's size, is drawn as a list.

### `opf/furniture-wraps`

Default severity: **warning**. Cost: composition. A header or footer zone wraps onto more than 2 lines.

**Why.** Header and footer text repeats on every slide in a band at the slide edge. A zone that wraps onto three or more lines grows into the body, and long source lines read poorly at footer size. Footers carry short repeated text (a title, a date, a page number); sources belong in a caption or the speaker notes.

**Approximations.** Uses the lines core composed for the zone at the deck's slide size; without a host-supplied text measurement (ValidateOptions.fonts.textMeasurement) widths are core's portable estimates. A deck-level header or footer is reported once.

### `opf/font-outside-scheme`

Default severity: **warning**. Cost: structure. Text uses a font family that is not in the deck's font scheme.

**Why.** The font scheme is the deck's font choice. A run that names another family will not follow a font-scheme change, may be missing on the viewer's machine, and breaks the deck's typographic consistency.

**Approximations.** Compares the run's fontFamily (case-insensitively) with the heading, body, code and accent families of the slide's resolved font scheme and the scheme's major/minor fonts. Families that the host substitutes are still different names here.

### `opf/image-resolution`

Default severity: **warning**. Cost: composition. An image has too few pixels for the size it is shown at.

**Why.** An image stretched beyond its pixel size looks blurry or blocky on a projector or a high-density screen.

**Thresholds.** `minImagePpi` (default 96)

**Approximations.** Only embedded data: images (and asset: references to them) have readable pixel sizes; URLs and files are never fetched, so they are not checked. The displayed size is the composed frame (cover and stretch are measured as the cover scale, contain as the contain scale). Effective ppi is the image pixels per inch of the 96 px/inch reference slide. SVG is vector and exempt.

### `opf/text-shrunk`

Default severity: **info**. Cost: composition. Text is fitted far below its role's starting size (under 70%).

**Why.** Composition starts each type role at a size meant to be read across a room (prose 28 px, a list 32 px, a table 25 px, a quote 40 px, code 22 px on the 720 px reference slide) and shrinks text that does not fit. Text that ends far below that size still fits, but the slide carries more than it can show at a comfortable size; it is usually two slides.

**Basis.** The type roles of composition (docs/dynamic-composition.md); the fitted size composeSlide computed, compared with 0.7 of the role size.

**Approximations.** Reads the fitted size of text and list blocks, the quote body, the code body and the smallest body cell of a table, on the 720 px reference slide. Headings, metrics and timelines have their own scales and are not checked. A block whose runs set `fontSize` is the author's choice and is skipped; text that overflows is opf/text-overflow. One finding per slide, at the block shrunk the most; `measured.blocks` counts the shrunk blocks.

### `opf/centered-body`

Default severity: **info**. Cost: composition. A paragraph or list of more than 2 lines or 120 characters is centered.

**Why.** Each line of centered text starts at a different place, so the eye has to search for the next line. Centering suits a title, a metric or a statement of a line or two; a paragraph or a list reads faster from a straight start edge.

**Basis.** Typographic convention for running text: a straight start edge. The alignment and the line count are those composeSlide computed; more than 2 lines or 120 characters.

**Approximations.** Checks text and list blocks whose composed alignment is center. Titles, subtitles, tags, metrics, quotes and timelines are not checked, nor a short note of at most 80 characters, whatever it wraps to in a narrow cell. A text block alone on the slide or alone in its layout region (a statement, or the note of the metrics layout) is reported only past 3 lines, and on a cover, section or closing layout not at all. One finding per slide, at the longest block; `measured.blocks` counts the long centered blocks.

### `opf/tight-spacing`

Default severity: **info**. Cost: composition. Blocks are closer than 0.25 in to each other or 0.5 in to the slide edge.

**Why.** Space between blocks tells the audience which things belong together, and a margin keeps content clear of the edge that projectors, screen-sharing and printing crop. Blocks closer together than the engine's own default gap read as one crowded block.

**Basis.** Measured on the composed boxes (the card frame, the picture frame, else the cell) of sibling blocks and groups, on the 13.33 x 7.5 in reference slide: a gap under 0.25 in (the default gap is 1/30 of the short side, 0.25 in) or a margin under 0.5 in (the default padding is 0.6 in).

**Approximations.** Only a gap the author set is checked: `composition.gap` on the slide, its layout record or a group. Without one the default gap of the engine applies (1/30 of the shorter side of the container: 0.25 in on the slide, less in a short nested group) and is not reported. Only blocks of one parent are compared, and only when they face each other across one axis. Headings, header and footer furniture, pictures placed on a slide edge and blocks in a bleed region are exempt. A cell is measured, not the ink inside it, so text that does not fill its cell looks further apart than reported. At most one gap and one margin finding per slide, the tightest of each.

### `opf/layout-monotony`

Default severity: **info**. Cost: structure. 4 or more content slides in a row use the same layout record.

**Why.** A run of slides with one arrangement looks the same from slide to slide, so the audience stops noticing that the content changed. The structure of the content (a comparison, a sequence, a number, a picture) usually asks for different layouts.

**Basis.** Counted on the slide sequence: 4 or more consecutive visible slides with body content and the same `layout`.

**Approximations.** Compares the layout reference of each slide (a catalog prefix is ignored). Cover, section and closing slides, slides with no body content and slides without a layout record (automatic composition) break a run and are not counted; hidden slides are skipped. One finding per run, at its first slide.


## Content rules

*Is anything left unfinished?*

### `opf/chart-value-not-numeric`

Default severity: **warning**. Cost: structure. A chart value is text, not a number.

**Why.** A chart plots numbers. A text cell such as "12%" is plotted as a gap. When every text value of a column is written in one display style the finding carries the fix that stores the numbers and gives the column the matching format.

**Basis.** spec/schemas/opf.schema.json (JSON Schema 2020-12) and the semantic rules of OPF

### `opf/chart-mapping-adapted`

Default severity: **warning**. Cost: structure. A chart mapping entry is ignored.

**Why.** A mapping that names a column the chart type cannot use is left out of the chart.

**Basis.** spec/schemas/opf.schema.json (JSON Schema 2020-12) and the semantic rules of OPF

### `opf/chart-highlight-adapted`

Default severity: **warning**. Cost: structure. A chart highlight is adapted by the chart type.

**Why.** A highlight the chart type cannot show as authored (a category highlight on a chart without categories, for example) is adapted by every engine, so the emphasis is not exactly what was written.

**Basis.** spec/schemas/opf.schema.json (JSON Schema 2020-12) and the semantic rules of OPF

### `opf/chart-series-dropped`

Default severity: **warning**. Cost: structure. A chart series is not drawn by the chart type.

**Why.** A treemap, histogram, Pareto, waterfall, funnel, map or single-series pie plots one value series, and a scatter plots no X column without numbers. Every engine leaves the same columns out (LH-60), so the warning names them instead of losing them silently.

**Basis.** spec/schemas/opf.schema.json (JSON Schema 2020-12) and the semantic rules of OPF

**Approximations.** Read from the drawn chart (chartDrawPlan): a world chart over categories that are mostly not places is drawn as columns, a box-and-whisker chart with one value per category as one box per series and a pie or doughnut of several series as nested rings, and none of those drops a series.

### `opf/code-highlight-out-of-range`

Default severity: **warning**. Cost: structure. A code highlight marks a line the code does not have.

**Why.** Marked lines count from 1 by line break in code.source; an entry past the last line marks nothing.

**Basis.** spec/schemas/opf.schema.json (JSON Schema 2020-12) and the semantic rules of OPF

### `opf/code-highlight-range-reversed`

Default severity: **warning**. Cost: structure. A code highlight range ends before it starts.

**Why.** A range written end before start marks nothing; write the smaller line number first.

**Basis.** spec/schemas/opf.schema.json (JSON Schema 2020-12) and the semantic rules of OPF

### `opf/variable-builtin-missing`

Default severity: **warning**. Cost: structure. A built-in variable has no value in this document.

**Why.** A `{{deck.*}}`, `{{speaker.*}}` or `{{organization.*}}` token whose field the document does not set resolves to nothing, so the text shows a gap; a `var:organization.logo` reference to an organization without a logo draws no image. `{{slide.section}}` is checked per slide: a slide without a `section` that uses it, in its own text or in the header or footer it inherits, is reported at that slide.

**Basis.** spec/schemas/opf.schema.json (JSON Schema 2020-12) and the semantic rules of OPF

### `opf/duration-outside-narrative`

Default severity: **warning**. Cost: structure. The target duration is outside the range the narrative suits.

**Why.** A narrative records the talk lengths it suits. A deck whose duration is outside that range probably needs a different narrative or a different length; nothing is drawn or exported differently.

**Basis.** spec/schemas/opf.schema.json (JSON Schema 2020-12) and the semantic rules of OPF

### `opf/narrative-duration-range`

Default severity: **warning**. Cost: structure. An inline narrative duration range has min greater than max.

**Why.** A range with its bounds swapped matches no duration, so the duration check cannot help.

**Basis.** spec/schemas/narrative.schema.json

### `opf/placeholder-text`

Default severity: **warning**. Cost: structure. Placeholder text was left in the deck.

**Why.** "Lorem ipsum", "Click to add title", "TBD" and bracketed prompts are scaffolding. Shipping them reads as unfinished work.

**Approximations.** Case-insensitive patterns for lorem ipsum, template prompts ("Click to add...", "Your title here", "[Insert ...]", a bare "Title" or "Text"), and the markers TBD, TBC, TODO, FIXME and XXX in capitals. A deliberate use of the words is flagged too; disable the rule for that slide with ignorePaths.

### `opf/empty-text`

Default severity: **info**. Cost: structure. A text field is present but empty.

**Why.** An empty title, text block or list item draws nothing, and leaves a hole in the outline and for assistive technology.

### `opf/unused-beat`

Default severity: **info**. Cost: structure. A beat of the narrative has no slide that references it.

**Why.** The narrative is the plan and the slides are the product. When some slides name a beat (slides[].beat) and a beat of the plan has none, the deck skips a step of the story or the plan is out of date.

**Approximations.** Resolved like every content reference: the document's catalogs groups, then the registered catalogs. A narrative that resolves nowhere is not checked. A deck in which no slide references any beat is not checked either, because it has not linked its slides to the plan. A slide that lists several beats covers each of them.

### `opf/empty-slide`

Default severity: **warning**. Cost: structure. A slide has no content at all.

**Why.** A slide with no title, no content and no picture is almost always an accident of editing. (A deliberately blank slide can use the blank layout.)

### `opf/language-tag`

Default severity: **warning**. Cost: structure. A language tag is malformed, uses an unassigned region or is not in canonical case.

**Why.** Engines read the deck language and each run's `lang` as BCP 47 tags to choose script fonts, text direction, proofing language and the PowerPoint `lang` attribute. A tag such as `en-a`, or a region that does not exist (`en-UK`; the United Kingdom is `GB`), is guessed at or dropped, and a wrong-case tag (`EN-us`) is not what a locale lookup expects.

**Basis.** BCP 47 (RFC 5646, section 2.1) and the platform locale data (Intl.getCanonicalLocales, Intl.DisplayNames)

**Approximations.** Checks the root `language` (a tag string, or the `bcp47` of an inline Language object) and `lang` on the TextRun objects of titles, subtitles, tags, text, lists, tables, quotes, metrics and timelines. A region is assigned when the runtime's CLDR data names it (ISO 3166-1 codes and UN M.49 areas such as 419); private-use regions (`AA`, `QM`-`QZ`, `XA`-`XZ`) and `ZZ` are accepted, as are private-use (`x-...`) tags. Only the spelling of a tag is checked, not whether the language subtag is assigned or whether the language suits the text. The schema rejects tags with characters other than letters, digits and hyphens (`en_US` is a schema error, with no suggestion), and `en-UK` as the deck language is already an error of the schema rule, so those are not reported twice.

### `opf/straight-quotes`

Default severity: **info**. Cost: structure. Text uses straight quotation marks (" or ') where the language has typographic ones.

**Why.** Straight marks are a typewriter substitute. Typeset text uses the quotation marks of its language (“…” in English, «…» in French, „…“ in German), and a deck that mixes them with the marks the engine draws around quotes looks unfinished.

**Basis.** The quotation marks of the deck language, as the engines draw them around a quote (QUOTE_MARKS in core).

**Approximations.** Checks titles, subtitles, tags, body text, list items and descriptions, and quotes; not table cells, metrics, timelines, code or runs with `code: true`. A `"` after a digit is an inch mark and a `'` between letters or after a digit is an apostrophe or a foot mark; single quotes count only as a pair around words. A language with no typographic marks of its own (one OPF draws ASCII quotes for) is not checked. When only double quotes are found, the finding carries a patch to the language's marks.

### `opf/chart-dual-axis`

Default severity: **info**. Cost: structure. A combo chart plots a series on a secondary value axis.

**Why.** Two value scales in one plot invite the reader to compare heights that are not comparable: where the lines cross, and which is higher, depends only on how each axis was scaled. Two charts side by side, each with its own axis, read more truly than one chart with two scales (Few, Show Me the Numbers).

**Basis.** Stephen Few, Show Me the Numbers (2012), on dual-scaled graphs.

**Approximations.** Reports a `combo` chart whose `secondaryAxis` names at least one plotted line series (the axis core resolves). A combo chart on one axis is not reported.

### `opf/chart-pie-many-slices`

Default severity: **info**. Cost: structure. A pie or doughnut chart has more than 5 slices.

**Why.** People compare angles and areas poorly, and past a few slices the small ones cannot be told apart or labelled. Bars along one axis show the same parts of a whole and let them be compared and ranked (Few, Show Me the Numbers).

**Basis.** Stephen Few, Show Me the Numbers (2012), on pie charts; more than 5 categories.

**Approximations.** Counts the rows (categories) of a `pie` or `doughnut` chart as its data resolves; a doughnut of several series (nested rings) counts the categories of a ring. Treemaps and funnels are not checked.

<!-- validate-rules:end -->
