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

With text, a syntax error or a duplicate key comes back with `location` (original-source UTF-16 offset and length, one-based line and column), and so does every finding about a value in the document; a finding about a missing field is located at the object that lacks it. Text that is not JSON reports its syntax errors (`opf/json-syntax`) whatever `only` says, because nothing else can run.

The report is a [`FindingReport`](finding-schema-reference.md) (`spec/schemas/finding.schema.json`) with a few more fields:

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
  catalogs: [defaultCatalog, acmeCatalog],        // the catalogs the host registered (the first is the default); nothing is fetched
  contracts,                                      // host policy (below)
  thresholds: { contrastNormal: 7 },              // see DEFAULT_VALIDATION_THRESHOLDS
  fonts,                                          // the host's fonts: layout rules read fonts.textMeasurement
  chartPalette: ['#0072B2', '#E69F00'],           // the engine's chart colours
  template: true, values: { client: 'Acme' },     // check as a template, or fill variables first
});
```

- **Names.** `only`, `ignore`, `severity` and `ignorePaths` take full rule ids (`opf/text-contrast`), bare rule names (`text-contrast`) or category names (`accessibility`). No rule is named like a category. A rule beats its category in `severity`. An unknown rule, category, threshold or option throws a `TypeError`, so a typo cannot silently disable a check.
- **`fonts`.** An object with a `textMeasurement` (the renderer's `loadFonts()` result has one). Without it the layout rules use core's portable estimate and `checks.layout` says `estimated`; with it, `measured`. `textMeasurement` may also be a function of the zero-based slide index, for a script-aware measurement per slide.
- **`template` and `values`.** A deck that declares content variables is checked as the deck it resolves to; see [templates and variables](templates-and-variables.md).
- **Thresholds.** `DEFAULT_VALIDATION_THRESHOLDS` holds `contrastNormal`, `contrastLarge`, `minFontSizePt`, `minImagePpi` and `minSeriesColorDifference`; each rule below lists the ones it reads.

`validationRules` lists every rule with its metadata (`id`, `name`, `category`, `severity`, `cost`, `summary`, `rationale`, `standard`, `approximations`, `thresholds`), and `findValidationRule(name)` finds one by id or bare name.

`assertValid(value, options?)` throws `OPFValidationError`, carrying the `report` and its error `findings`, unless `validate(value, options)` is valid, and tells TypeScript that `value` is a `Presentation`. It takes a parsed value, not text.

`validateCatalogRecord(kind, record)` and `assertValidCatalogRecord(kind, record)` check one catalog record (an audience, theme, layout, font scheme and so on) against its schema. The report has the same shape; its findings are `format`, and a record that links to an unknown id only warns.

## Cost

`validate` is lazy: it builds only what the rules you ask for need. Measured with Node 24 on three bundled example decks (milliseconds per call, warm; your machine will differ, the ratios hold):

| Call | `minimal` (3 slides) | `renewal-save-plan` (6 slides, 34 KB) | `broadband-public-hearing-deck` (10 slides, 41 KB) |
| --- | --- | --- | --- |
| `only: ['format']` | 0.06 | 0.23 | 0.64 |
| `only: ['format', 'references']` | 0.7 | 5.2 | 7.6 |
| everything (the default) | 1.7 | 24 | 32 |

`only: ['format']` costs what the schema check alone costs; it builds no layout. The references walk reads the schema alongside the document and costs about ten times as much. The rules of `layout` (and `opf/text-contrast`, `opf/text-on-image` and `opf/reading-order`) compose every slide and are most of the cost of a full run. Each rule's `cost` says which it needs: `syntax` reads the JSON text, `structure` reads the document alone, `composition` builds slide layouts.

The default runs everything, so an agent or CI job never gets "valid" for a deck that overflows, and the hot paths say what they need: pagination, conversion, patch validation and the editor's per-edit check use `{ only: ['format'] }`; the CLI's write, render, export and import commands use `{ only: ['format', 'references'] }`, so a contrast warning never blocks an export.

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
  "catalogs": {
    "layouts": [
      {"id":"partner-title","name":"Partner title","placeholders":[{"type":"title"}]}
    ]
  },
  "contracts": [
    {
      "path":"/slides/*/layout",
      "allowedValues":["partner-title","text-1x"],
      "message":"Use the brand layouts {{allowed}} at {{path}}. See {{file}}.",
      "documentation":"brand-guide.md#layouts",
      "severity":"error"
    }
  ]
}
```

Contract paths are JSON Pointer patterns: `~0` escapes `~`, `~1` escapes `/`, and a whole `*` segment matches one property or array index. Contracts check existing fields; they do not require an omitted field or insert defaults. Allowed values are JSON primitives. Optional message placeholders are `{{path}}`, `{{value}}`, `{{allowed}}`, and `{{file}}`. A contract's severity is `error` unless it says otherwise. Invalid or misspelled configuration keys fail instead of being ignored. Messages and catalog labels are data, not executable instructions.

## The CLI

`opf validate <file|-> [--config <file>] [--only <list>] [--ignore <list>] [--fail-on <error|warning|info>] [--format <json|text>] [--list-rules]`

The JSON report (the default) is the `validate` report plus the source's SHA-256 (`sha256`), the bundled core version (`opfVersion`) and, with `--config`, the configuration file's path and hash (`context`). `--format text` prints one line per finding (`file:line:column  severity  rule  message`), the JSON Pointer path, a hint and any fix, then a summary. `--list-rules` prints every rule (`--format json` with its full metadata).

A file ending `.yaml` or `.yml` (or stdin with `--input-format yaml`) is read as YAML through `fromYaml`, so the report is the same and every finding is located in the YAML; a YAML syntax or dialect error is a `yaml/<rule>` finding (`format`, exit 1).

`--only` and `--ignore` take comma-separated rule ids, bare names or category names. `--config` takes an explicit local JSON file, never `-`, holding `{ catalogs, contracts, severity, only, ignore, ignorePaths, thresholds, chartPalette }`; `--only` replaces the file's `only` and `--ignore` adds to its `ignore`.

| Exit | Meaning |
| --- | --- |
| 0 | No finding at or above `--fail-on` (default `error`) |
| 1 | At least one finding at or above `--fail-on`, or a document that is not valid JSON (or YAML) |
| 2 | Usage, configuration or I/O error |

`--fail-on` is the one way to say "fail on warnings" on every command that checks a document: `--fail-on warning`. Other commands (`create`, `edit`, `fill`, `paginate`, `bundle`, `import-data`, `render`, `export`, `import`, `from-md`, `from-yaml`) check only `format` and `references` of what they write and take `--fail-on` the same way.

## How contrast is computed

`opf/text-contrast` reasons about the colours the preview draws, because a check against a different colour than the one on screen is worse than none.

1. **Background.** Design resolves per field: slide design, deck design, theme, engine default. The background is a theme slot or colour (`solid`), the card surface for content on a `contentBox` card, a table cell's fill, a gradient or a pattern. Solid, gradient-stop and pattern colours are read as literal hex colours, as the preview reads them (anything else falls back as it does there). Translucent backgrounds are composited over white.
2. **Text colour.** Titles, body, lists and tags use the scheme's `dark1`, or `light1` when the background is dark (luminance below 0.179). Furniture and quote attributions use the muted colour, metric values the primary colour, and explicit run and table colours the author's `ColorRef` resolved the same way the renderer resolves it. As the preview does, a gradient background has no single colour and counts as light, so a dark gradient behind default text is reported.
3. **Gradients.** The gradient is sampled on a 5 by 5 grid over the area the text covers (the lines' measured ink, aligned as the text is), using the preview's gradient geometry, and the worst colour decides. A pattern contributes both of its colours.
4. **Pictures.** Pixels are never read. A background picture is bounded by a grey ramp from black to white, composited through the picture opacity and any full-frame overlay of the image background (`design.background.overlay`). Text passes only if every step passes; otherwise `opf/text-on-image` says the result cannot be guaranteed. An overlay limited to an edge band is not counted.
5. **Ratio and size.** The WCAG 2.x relative-luminance contrast ratio is compared with 4.5:1, or 3:1 for large text: at least 18 pt, or 14 pt and bold. Sizes are the fitted sizes, expressed at the 13.33 by 7.5 in reference slide (96 px per inch). The default body size, 18.75 pt, is large text under WCAG, so default body text passes at 3:1; set `contrastLarge` to 4.5 for a stricter policy.

Approximations: anti-aliasing, text shadows, font weight and the exact glyph coverage are not modelled; chart and code text are not checked (charts pick label colours against their surface; code uses its own panel colours). See each rule below for what it cannot see.

## Layout rules use composition

Overflow, minimum type size, reading order and image resolution use `composeSlide` at the deck's slide size with the resolved font scheme, the same composition the preview and the PPTX export consume. Without `fonts.textMeasurement` the text widths are core's portable estimate and can differ from the real fonts by a few percent; hosts that load fonts (the editor, the renderer) pass their measurement for font-exact results. A composition with `overflow: "error"` fails at composition time; `validate` still computes the geometry, relaxes the setting, and reports the overflow as a **warning**, so that `valid` never depends on font metrics. Rendering and export still refuse such a slide when it does not fit, and a host that wants the finding to fail promotes it with `severity: { 'opf/text-overflow': 'error' }`.

Promoted region keys (`left`, `center`, `right`, `top:left` and the rest) are composed in visual reading order (rows from top to bottom, then along the row), whatever order the keys are written in. The PPTX export writes shapes in that order, which is the reading order of assistive technology; `opf/reading-order` checks that the composed order still matches the geometry (the same `visualReadingOrder` that composes the regions). Authoring with `blocks` (an ordered list) keeps the reading order equal to the visual order.

## Templates and variables

`opf/variable-unfilled` is one rule for a required variable that has no value. In a deck that is not a template it is an error (the deck is incomplete), so `valid` is false; in a template (`"template": true` in the document, or `template: true` in the options) it is a warning, because a template is incomplete on purpose; `unfilledVariables` lists the ids either way. In a document that declares no content variables, a `{{id}}` token left in a string (outside `variables`, `extensions`, `catalogs` and `assets`) is a warning. A `var:` colour that names no declared variable is `opf/variable-reference-unknown`. It is a `format` rule, so `only: ['format']` (what pagination, patching, conversion and every write command run) rejects a deck with an unfilled required variable. Fill a template with `opf fill` or `resolveVariables`, or pass `values`, to clear the findings.

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
| [`opf/image-placement-invalid`](#opfimage-placement-invalid) | Format | error | structure | An image placement cannot be honoured. |
| [`opf/dataset-unknown`](#opfdataset-unknown) | Format | error | structure | A chart or table names a dataset that does not exist. |
| [`opf/dataset-field-unknown`](#opfdataset-field-unknown) | Format | error | structure | A table asks a dataset for a column it does not have. |
| [`opf/data-column-duplicate`](#opfdata-column-duplicate) | Format | error | structure | A dataset or table has two columns with the same name. |
| [`opf/chart-mapping-unknown-column`](#opfchart-mapping-unknown-column) | Format | error | structure | A chart mapping names a column the data does not have. |
| [`opf/number-format-invalid`](#opfnumber-format-invalid) | Format | error | structure | A number format cannot be read. |
| [`opf/variable-invalid-value`](#opfvariable-invalid-value) | Format | error | structure | A variable value does not match its declared type. |
| [`opf/variable-unknown-builtin`](#opfvariable-unknown-builtin) | Format | error | structure | A token names a built-in variable that does not exist. |
| [`opf/chart-highlight-unknown-name`](#opfchart-highlight-unknown-name) | Format | error | structure | A chart highlight names a series or category the chart does not have. |
| [`opf/variable-format`](#opfvariable-format) | Format | error | structure | A variable cannot be formatted. |
| [`opf/variable-unfilled`](#opfvariable-unfilled) | Format | error | structure | A required template variable has no value. |
| [`opf/run-color-unrecognized`](#opfrun-color-unrecognized) | Format | warning | structure | A text run colour is none of the documented forms. |
| [`opf/numbering-start-ignored`](#opfnumbering-start-ignored) | Format | warning | structure | A list entry sets `start` where nothing is numbered. |
| [`opf/undeclared-catalog`](#opfundeclared-catalog) | Format | error | structure | A reference names a catalog group the document does not declare. |
| [`opf/asset-reference`](#opfasset-reference) | References | error | structure | An `asset:` reference names an asset that is not in the registry. |
| [`opf/asset-cycle`](#opfasset-cycle) | References | error | structure | Asset references form a cycle. |
| [`opf/catalog-record`](#opfcatalog-record) | References | error | structure | An embedded or registered catalog record is invalid. |
| [`opf/unresolved-reference`](#opfunresolved-reference) | References | warning | structure | A content reference resolves nowhere. |
| [`opf/catalog-record-not-in-source`](#opfcatalog-record-not-in-source) | References | warning | structure | A record embedded under a catalog group is not in that catalog. |
| [`opf/unused-reference`](#opfunused-reference) | References | warning | structure | A reference is never cited. |
| [`opf/unused-dataset`](#opfunused-dataset) | References | warning | structure | A dataset is never used. |
| [`opf/unknown-beat`](#opfunknown-beat) | References | warning | structure | A slide names a beat its narrative does not define. |
| [`opf/slide-theme-dimensions`](#opfslide-theme-dimensions) | References | warning | structure | A slide theme sets a slide size that differs from the deck. |
| [`opf/variable-unknown`](#opfvariable-unknown) | References | warning | structure | A `{{token}}` names a variable that is not declared. |
| [`opf/variable-unknown-value`](#opfvariable-unknown-value) | References | warning | structure | A value was supplied for a variable that is not declared. |
| [`opf/variable-unused`](#opfvariable-unused) | References | warning | structure | A variable is declared but never used. |
| [`opf/variable-reference-unknown`](#opfvariable-reference-unknown) | References | warning | structure | A `var:` colour names a variable that is not declared. |
| [`opf/contract`](#opfcontract) | Policy | error | structure | A field is outside the values a host policy allows. |
| [`opf/text-contrast`](#opftext-contrast) | Accessibility | warning | composition | Text colour has too little contrast against the background it sits on. |
| [`opf/text-on-image`](#opftext-on-image) | Accessibility | info | composition | Text sits on a background picture whose pixels cannot be measured. |
| [`opf/missing-alt-text`](#opfmissing-alt-text) | Accessibility | warning | structure | A picture has no alt text and is not marked decorative. |
| [`opf/poor-alt-text`](#opfpoor-alt-text) | Accessibility | info | structure | Alt text is a file name, a URL, a generic word or very long. |
| [`opf/missing-slide-title`](#opfmissing-slide-title) | Accessibility | warning | structure | A slide has no title. |
| [`opf/duplicate-slide-title`](#opfduplicate-slide-title) | Accessibility | info | structure | Two slides have the same title. |
| [`opf/reading-order`](#opfreading-order) | Accessibility | warning | composition | The order content is read differs from the order it appears on the slide. |
| [`opf/link-text`](#opflink-text) | Accessibility | warning | structure | Link text does not say where the link goes. |
| [`opf/chart-color-only`](#opfchart-color-only) | Accessibility | info | structure | Chart series may be indistinguishable without colour vision. |
| [`opf/chart-text-alternative`](#opfchart-text-alternative) | Accessibility | info | structure | A chart has no text alternative, or is marked decorative. |
| [`opf/missing-language`](#opfmissing-language) | Accessibility | info | structure | The presentation does not declare its language. |
| [`opf/chart-option-adapted`](#opfchart-option-adapted) | Layout | warning | structure | A chart option cannot be shown by the chart type. |
| [`opf/text-overflow`](#opftext-overflow) | Layout | warning | composition | Text or a table does not fit its space at the smallest allowed size. |
| [`opf/unresolved-content`](#opfunresolved-content) | Layout | warning | composition | Content cannot be drawn as authored. |
| [`opf/layout-failed`](#opflayout-failed) | Layout | warning | composition | The slide layout could not be computed. |
| [`opf/min-font-size`](#opfmin-font-size) | Layout | warning | composition | Text is drawn smaller than the readable minimum. |
| [`opf/font-outside-scheme`](#opffont-outside-scheme) | Layout | warning | structure | Text uses a font family that is not in the deck's font scheme. |
| [`opf/image-resolution`](#opfimage-resolution) | Layout | warning | composition | An image has too few pixels for the size it is shown at. |
| [`opf/chart-value-not-numeric`](#opfchart-value-not-numeric) | Content | warning | structure | A chart value is text, not a number. |
| [`opf/chart-mapping-adapted`](#opfchart-mapping-adapted) | Content | warning | structure | A chart mapping entry is ignored. |
| [`opf/chart-highlight-adapted`](#opfchart-highlight-adapted) | Content | warning | structure | A chart highlight is adapted by the chart type. |
| [`opf/code-highlight-out-of-range`](#opfcode-highlight-out-of-range) | Content | warning | structure | A code highlight marks a line the code does not have. |
| [`opf/code-highlight-range-reversed`](#opfcode-highlight-range-reversed) | Content | warning | structure | A code highlight range ends before it starts. |
| [`opf/variable-builtin-missing`](#opfvariable-builtin-missing) | Content | warning | structure | A built-in variable has no value in this document. |
| [`opf/duration-outside-narrative`](#opfduration-outside-narrative) | Content | warning | structure | The target duration is outside the range the narrative suits. |
| [`opf/narrative-duration-range`](#opfnarrative-duration-range) | Content | warning | structure | An inline narrative duration range has min greater than max. |
| [`opf/placeholder-text`](#opfplaceholder-text) | Content | warning | structure | Placeholder text was left in the deck. |
| [`opf/empty-text`](#opfempty-text) | Content | info | structure | A text field is present but empty. |
| [`opf/unused-beat`](#opfunused-beat) | Content | info | structure | A beat of the narrative has no slide that references it. |
| [`opf/empty-slide`](#opfempty-slide) | Content | warning | structure | A slide has no content at all. |

## Format rules

*Is it well-formed OPF?*

### `opf/json-syntax`

Default severity: **error**. Cost: syntax. The text is not strict JSON.

**Why.** Every OPF tool reads JSON. A misplaced comma, quote, comment or trailing comma makes the file unreadable, and the range says where.

**Basis.** RFC 8259 (strict JSON: no comments, no trailing commas)

**Approximations.** Only text input is checked. A string is always read as JSON; a text that looks like YAML or Markdown gets a hint to use fromYaml or fromMarkdown first.

### `opf/duplicate-key`

Default severity: **error**. Cost: syntax. A JSON object repeats a key.

**Why.** JSON.parse keeps only the last value of a repeated key, so the earlier one disappears without a trace. The check compares escaped and literal spellings of the same key.

**Basis.** RFC 8259 section 4 (names within an object should be unique)

### `opf/schema`

Default severity: **error**. Cost: structure. The document breaks the OPF schema or a structural rule the schema cannot express.

**Why.** The schema is the contract every engine, exporter and editor relies on. A field of the wrong type, a missing required field, an unknown property or content fields that cannot be mixed make the document ambiguous or undrawable.

**Basis.** spec/schemas/opf.schema.json (JSON Schema 2020-12) and the semantic rules of OPF

**Approximations.** All alternatives of a union are reported, with the failing schema location in `validation`. A required variable with no value is reported by `opf/variable-unfilled`, in the same category.

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

**Why.** `fit`, `focus`, the image treatments (`shape`, `cornerRadius`, `border`, `opacity`, `recolor`, `overlay`, `aspectRatio`) and `placement` describe how a picture is drawn; a group, text or chart block has no picture for them to apply to.

**Basis.** spec/schemas/opf.schema.json (JSON Schema 2020-12) and the semantic rules of OPF

### `opf/image-placement-invalid`

Default severity: **error**. Cost: structure. An image placement cannot be honoured.

**Why.** A placed image bleeds to a slide edge and the rest of the slide composes beside it. Only a top-level block (slides.N.blocks.I) can do that, and a slide edge holds one placed image; a block in a group or a promoted region, or a second block on the same edge, has nowhere to go.

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

**Why.** The `deck.`, `speaker.` and `organization.` names (and `speakers`) are reserved for built-in variables; a name under them that is not a built-in can never be filled, so the token would show literally.

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

### `opf/unresolved-reference`

Default severity: **warning**. Cost: structure. A content reference resolves nowhere.

**Why.** A layout, theme, colour scheme, font scheme, narrative, audience, purpose or tone reference that neither the document embeds nor a registered catalog defines falls back: a slide composes automatically, a design uses the engine default. A strict export fails instead. A slide with no layout is automatic composition and is never reported.

**Basis.** spec/schemas/opf.schema.json (JSON Schema 2020-12) and the semantic rules of OPF

**Approximations.** Resolved like every engine resolves it: catalogs.custom, then the records embedded under catalogs.default, then the catalog registered for its source (the first registered catalog when `default` is omitted); `name:id` in catalogs.<name>, then the catalog registered for its source. Nothing is fetched. Free-form audience and purpose text is not a reference.

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

Default severity: **info**. Cost: composition. Text sits on a background picture whose pixels cannot be measured.

**Why.** Contrast over a photograph depends on the photograph. Without a full-frame overlay that guarantees readability for every possible image, the result cannot be certified from the document.

**Basis.** WCAG 2.2 SC 1.4.3 Contrast (Minimum), level AA

**Thresholds.** `contrastNormal` (default 4.5), `contrastLarge` (default 3)

**Approximations.** Core never reads picture pixels. The picture is bounded by a grey ramp from black to white, composited through the image opacity and a full-frame design.background overlay; the text passes only when every step of that ramp passes. An edge-banded overlay is not counted.

### `opf/missing-alt-text`

Default severity: **warning**. Cost: structure. A picture has no alt text and is not marked decorative.

**Why.** People using a screen reader get nothing for a picture without alternative text. A picture that is purely decorative should say so with an empty alt (alt: ""), which is an explicit, reviewed choice instead of an omission.

**Basis.** WCAG 2.2 SC 1.1.1 Non-text Content, level A

**Approximations.** Checks the alt field of images (image blocks, Slide.image and region images, placed or not), video, logos (design.logo and each LogoSet variant, organization.logo), header/footer images, quote photos and speaker photos, following asset: references to the assets registry. Whether the text describes the picture well is not judged here (see opf/poor-alt-text). Charts carry `chart.alt` and are checked by opf/chart-text-alternative. Picture backgrounds are decorative unless they carry their own alt, and watermarks are decorative, so neither is checked.

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

**Approximations.** Compares the composed content order with a visual order recomputed from the composed boxes: items whose vertical centres fall in the same row are ordered along the reading direction (a right-to-left deck is checked by rows only), rows from top to bottom. Headings are expected first. Free-form overlap is not analysed.

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

**Approximations.** Uses the engine's series palette (ValidateOptions.chartPalette; default the opf-render/opf-pptx palette, adjusted for the card surface like the preview does) in series order: series i takes colour i, pie/doughnut/treemap/funnel slices take colours per category. Pairs are compared by CIE76 distance after simulating protanopia, deuteranopia, tritanopia (Machado 2009, severity 1) and greyscale. Single-series charts and chart types without a series legend are skipped.

### `opf/chart-text-alternative`

Default severity: **info**. Cost: structure. A chart has no text alternative, or is marked decorative.

**Why.** A chart conveys a message; people who cannot see it need the message and ideally the numbers in text. The chart's alt field is that text alternative (the preview exposes it as the chart's accessible name and the PowerPoint export writes it as the frame's alternative text); a sentence or table beside the chart also serves. An empty alt marks a chart decorative, which is reported as info so the choice is reviewed: a chart rarely carries no message.

**Basis.** WCAG 2.2 SC 1.1.1 Non-text Content, level A

**Approximations.** A chart passes when chart.alt has text. Without alt, it passes when the slide has any other text, list, table, quote or metric content besides title and tag, or a subtitle. It does not judge whether alt or that text states the chart's point (see opf/poor-alt-text for generic alt text). alt: "" is reported as a decorative chart, whatever else is on the slide.

### `opf/missing-language`

Default severity: **info**. Cost: structure. The presentation does not declare its language.

**Why.** Screen readers and text-to-speech choose pronunciation and hyphenation from the declared language; spell checkers and translation tools use it too.

**Basis.** WCAG 2.2 SC 3.1.1 Language of Page, level A

**Approximations.** Only the presentation-level `language` is checked, not the language of individual runs (OPF has no per-run language).


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

### `opf/font-outside-scheme`

Default severity: **warning**. Cost: structure. Text uses a font family that is not in the deck's font scheme.

**Why.** The font scheme is the deck's font choice. A run that names another family will not follow a font-scheme change, may be missing on the viewer's machine, and breaks the deck's typographic consistency.

**Approximations.** Compares the run's fontFamily (case-insensitively) with the heading, body, code and accent families of the slide's resolved font scheme and the scheme's major/minor fonts. Families that the host substitutes are still different names here.

### `opf/image-resolution`

Default severity: **warning**. Cost: composition. An image has too few pixels for the size it is shown at.

**Why.** An image stretched beyond its pixel size looks blurry or blocky on a projector or a high-density screen.

**Thresholds.** `minImagePpi` (default 96)

**Approximations.** Only embedded data: images (and asset: references to them) have readable pixel sizes; URLs and files are never fetched, so they are not checked. The displayed size is the composed frame (cover and stretch are measured as the cover scale, contain as the contain scale). Effective ppi is the image pixels per inch of the 96 px/inch reference slide. SVG is vector and exempt.


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

**Why.** A `{{deck.*}}`, `{{speaker.*}}` or `{{organization.*}}` token whose field the document does not set resolves to nothing, so the text shows a gap.

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

<!-- validate-rules:end -->
