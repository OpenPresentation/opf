# Templates and variables

> A template is just an incomplete OPF file. (Owner intent, 2026-10-01.)

This is the design and the reference for OPF variables and templates (release readiness item RR-32). A variable is a typed, named value a deck declares once and uses in many places. A template is an ordinary OPF document that declares variables, references them from its content, and leaves some of them unfilled. Filling a template (a function call, `opf fill`, or the editor's Fill template panel) returns a normal deck. A template plus its values previews and exports exactly like the hand-written deck it stands for, because every engine resolves variables with one core function before it composes anything.

Decisions in this document are vetoable. They are collected in [Decisions](#decisions); each says what was chosen and what the alternative would cost.

## At a glance

```json
{
  "template": true,
  "name": "Quarterly review for {{client}}",
  "variables": {
    "client":  { "type": "text",   "label": "Client", "example": "Acme Corp" },
    "revenue": { "type": "number", "format": "$#,##0", "example": 1250000 },
    "kickoff": { "type": "date",   "example": "2026-10-01" },
    "wins":    { "type": "list",   "example": ["Faster onboarding", "Lower churn"] },
    "logo":    { "type": "image",  "required": false },
    "risk":    "#B42318"
  },
  "slides": [
    { "id": "cover", "title": "Quarterly review: {{client}}", "subtitle": "Kickoff {{kickoff}}", "image": "var:logo" },
    { "id": "wins", "title": "Wins", "bullets": ["Revenue {{revenue}}", "var:wins"] },
    { "id": "chart", "title": "Revenue", "chart": { "type": "column", "data": { "columns": ["Quarter", "Revenue"], "rows": [["This quarter", "var:revenue"]] } } }
  ]
}
```

```sh
opf fill quarterly.opf.json --data clients.csv --out-dir decks     # one deck per CSV row
opf fill quarterly.opf.json --data one.json --output globex.opf.json
```

```js
import { resolveVariables, validate } from '@openpresentation/opf';

validate(template);                      // valid: { template: true, unfilledVariables: [...] }
const { presentation, diagnostics } = resolveVariables(template, { client: 'Globex', revenue: 1250000, kickoff: '2026-10-01', wins: ['Shipped v2'] });
// presentation is a concrete deck: validate(presentation).valid === true
```

A fuller template (rich text, an optional image, a link, a percentage) with matching values is in [fixtures/template-quarterly-review.opf.json](fixtures/template-quarterly-review.opf.json) and [fixtures/template-quarterly-review.values.json](fixtures/template-quarterly-review.values.json); a test fills it, validates the result and previews it from its examples.

## Variable kinds

A variable is declared in the root `variables` map, keyed by a kebab-case id (`^[a-z][a-z0-9-]*$`). The value is a hex string (shorthand for a color variable, unchanged from before) or an object whose `type` selects the kind.

| Kind | `value` / `example` | Inline `{{id}}` | Whole field `var:id` |
| --- | --- | --- | --- |
| `color` | hex color | the hex text | the existing color path (see below) |
| `text` | string, or `TextRun[]` for rich text | the text (rich text is flattened) | the string or the runs |
| `number` | finite number | formatted with `format` | the number itself |
| `date` | ISO `YYYY-MM-DD` | formatted with `format` (default `MMMM d, yyyy`) | the ISO string |
| `image` | any [Asset](schema-reference.md#asset): `asset:<id>`, HTTPS URL, data URI, path, or `{src, alt, ...}` | the source string | the string or the Asset object |
| `url` | `http`, `https`, `mailto` or `tel` link | the link | the link |
| `list` | array of strings | entries joined with `, ` (or `{{id\|sep}}`) | the array; as an array element it splices |

Every object variable may also carry `label` (short form label), `description`, `required` (default `true`), and `example`.

- `value` is the current value. A variable with a `value` is filled; supplying a value to `resolveVariables` or `opf fill` overrides it.
- `example` only illustrates the slot. Fill forms show it as a placeholder, and previews of a template use it (see [Previews](#previews-and-export)). It never reaches a filled deck.
- `required: false` makes a variable optional. An unfilled optional variable resolves to empty text inline, and a field that references it as `var:id` is omitted.
- `format` (number and date only) is the display pattern used by `{{id}}`.

Color variables are unchanged: `"risk": "#B42318"` or `{ "type": "color", "value": "#B42318" }`, referenced as `var:risk` in color fields, resolved at render time by `resolveColorRef`. The only addition is that a color variable can now be filled or overridden like the others.

### Number formats

A pattern is an optional literal prefix, a numeric part of `#`, `0`, `,` and `.`, and an optional literal suffix. `0` pads digits, `#` is optional, a comma groups thousands, the digits after the point fix the decimals (`0` required, `#` optional), and a `%` in the prefix or suffix scales by 100. Rounding is half away from zero in decimal (`1.005` with `0.00` is `1.01`). Separators are English. With no pattern a number prints in its shortest decimal form.

| Pattern | Value | Result |
| --- | --- | --- |
| `#,##0` | `1234567` | `1,234,567` |
| `$#,##0.00` | `-1234.5` | `-$1,234.50` |
| `0.#%` | `0.256` | `25.6%` |
| `#,##0.0M` | `12.34` | `12.3M` |

### Date formats

Dates are calendar dates, never instants: no clock, no time zone. The pattern uses the same LDML-style tokens as header and footer `dateFormat` (`yyyy`, `yy`, `MMMM`, `MMM`, `MM`, `M`, `dd`, `d`, `EEEE`, `EEE`, quoted literals) with fixed English names. `2026-10-01` with `dd MMM yyyy` is `01 Oct 2026`.

## Using a variable

Two forms, one rule each.

**Inline token `{{id}}`.** Inside any string of the document. The string keeps its other characters, so `"Revenue {{revenue}} for {{client}}"` is one string with two substitutions. A token may name a one-off format after a pipe: `{{kickoff|dd MMM yyyy}}`, `{{revenue|0.0}}`, `{{wins|; }}` (the list separator). Whitespace inside the braces is ignored (`{{ client }}`). The result is always text.

**Whole-field reference `var:id`.** A string that is exactly `var:<id>` is replaced by the variable's typed value: a number in a chart cell, an Asset object in `image`, the runs of a rich text variable in a `text` field, the entries of a list variable in `bullets`. Inside an array, a list variable splices its entries in place (`["first", "var:wins", "last"]`). Color variables keep their existing meaning in color fields.

Which fields can use variables is decided by the schema of the *resolved* deck, not by a field list: any string value of the document, wherever it sits (titles, notes, run text and links, table cells, chart data, metric values, image sources, asset registry entries, even code), can carry a token or a reference. If the substituted value does not fit the field (a list in a title), validation of the resolved deck reports it with the field's path.

**Escaping.** Write `\{{` for a literal `{{` (in JSON, `"\\{{"`). Only that sequence is special. A token whose id is not declared is left as written, and the validator warns when the deck uses variables (`'{{ghost}}' names no declared variable`).

**Rich text.** A `text` variable whose value is `TextRun[]` keeps its runs through a whole-field reference in any field that accepts string or `TextRun[]`: `"text": "var:greeting"`, and the slide `"title"`, `"subtitle"`, `"tag"` and a quote's `"text"` (FA-10). A `{{id}}` token inside a heading run resolves like one in a body run. Inside a larger string it is flattened to plain text with an informational `variable-rich-flattened` diagnostic. To style an inline value, put the token in a run: `{ "text": "{{client}}", "bold": true }`.

**Untouched content.** `extensions`, inline `catalogs`, `$schema`, and the declarations themselves are never searched.

**Compatibility.** A deck that declares no content variable, uses no built-in variable (the slide-scoped ones included) and is not a template is resolved by identity: nothing is searched, `{{` and `\{{` in its text keep their meaning (a Handlebars snippet in a code block is safe), and its color variables behave as before. Escapes are only processed in a deck that uses content or built-in variables.

## Built-in variables

Built-ins are read-only variables that come from the deck's own metadata, so a cover can say `{{speaker.name}}, {{speaker.title}} · {{organization.name}}` without declaring anything. Their names are dotted. A user-defined id matches `^[a-z][a-z0-9-]*` and never contains a dot, so a built-in can never collide with a user variable. (The one built-in without a dot, `speakers`, is a reserved id: declaring a variable named `speakers` is a validation error.)

| Built-in | Kind | Source |
| --- | --- | --- |
| `deck.name`, `deck.description` | text | root `name`, `description` |
| `deck.author` | text | root `author` (an array is joined with `, `) |
| `speaker.name`, `.title`, `.email`, `.phone`, `.bio` | text | the first speaker |
| `speaker.photo` | image | the first speaker |
| `speakers` | list | every speaker's name, in order |
| `speaker.<id>.<field>` | as above | the speaker with that id |
| `organization.name`, `.legalName`, `.tagline`, `.domain`, `.email`, `.phone` | text | the primary organization |
| `organization.<id>.<field>` | as above | the organization with that id |
| `organization.logo`, `organization.logo.<shape>` | image, slide-scoped | the primary organization's logo, `full` or the named shape (`stacked`, `icon`, `wordmark`), for the slide's background ([below](#organization-logos)) |
| `organization.<id>.logo`, `organization.<id>.logo.<shape>` | image, slide-scoped | the logo of the organization with that id |
| `slide.number` | text, slide-scoped | the displayed number of this slide in the rendered or exported deck, after pagination (a slide split in two shows two numbers) |
| `slide.section` | text, slide-scoped | this slide's `section`; a slide without one resolves to empty text |
| `deck.slideCount` | text, slide-scoped | the number of slides in the rendered or exported deck, after pagination |

The primary organization is the one with `role: 'primary'`, else the first (the rule the cover logo and the `socials` furniture field use). The speaker and organization fields may be an object or an array. A two-segment name (`speaker.name`) always means the first speaker or the primary organization; a three-segment name (`speaker.ada.name`) addresses an entry by its `id`.

They use the two forms above and work wherever the same kind of user variable works: `{{speaker.name}}` inside any string (`{{speakers|; }}` takes a separator, like any list), and `var:speaker.photo` as a whole field. `var:speakers` splices every name into an array.

```json
{
  "speaker": { "id": "ada", "name": "Ada Lovelace", "title": "CTO", "photo": "asset:ada" },
  "assets": { "ada": { "src": "./photos/ada.jpg", "mediaType": "image/jpeg" } },
  "organization": { "id": "acme", "name": "Acme Corp", "tagline": "Build the future", "logo": { "full": "./assets/acme-logo.svg", "icon": "./assets/acme-mark.svg" } },
  "design": { "footer": { "left": { "image": "var:organization.logo.icon", "text": "{{organization.tagline}}" } } },
  "slides": [{ "id": "cover", "title": "Quarterly review", "subtitle": "{{speaker.name}}, {{speaker.title}} · {{organization.name}}", "image": "var:speaker.photo" }]
}
```

- **Unknown path.** `{{speaker.nickname}}`, `var:organization.nobody.name`, `{{deck.owner}}` or `{{slide.title}}` is a validation error (`variable-unknown-builtin`) and stays as written in a resolved deck. A `speaker.<id>` or `organization.<id>` path whose id does not exist is the same error.
- **Known path, no source value.** The built-in resolves to an empty string (a whole-field reference is omitted) and validation warns (`variable-builtin-missing`), as for an unfilled optional variable.
- **Templates.** A template preview (`examples: true`) uses the document's real metadata for built-ins. When the document has none, the token or reference stays visible, the way an unfilled variable with no example does. Filling the template for real resolves a missing built-in to nothing.
- **Nested tokens.** A built-in text that itself carries a token (`"name": "Review for {{client}}"`) is resolved once; a built-in that refers back to itself stays as written.
- **Not overridable.** `values` cannot set a built-in; change the document field instead.
- **Resolved before composition,** like user variables, so every engine draws the same text (the slide-scoped three are the exception, below). `listBuiltinVariables(presentation)` returns each built-in with its kind, label, `scope` (`deck` or `slide`), current value, whether the document has a source value, and where it is used (pickers and agents; the editor's Fill template panel lists them read-only, the slide-scoped ones as "varies per slide").
- The speaker and organization fields that are *not* built-ins are never drawn automatically: a speaker appears only through these variables, and `Organization.tagline`, `legalName`, `domain`, `email` and `phone` appear only through their built-ins.

### Slide-scoped built-ins

`{{slide.number}}`, `{{slide.section}}` and `{{deck.slideCount}}` (FA-31) depend on the slide being drawn and on the deck after pagination, so they resolve per output slide, at composition time, instead of in the deck-wide pass:

- They work in any string of a slide (title, body text, runs, table cells, chart data, notes) and in header and footer `text`. (The organization logos, [below](#organization-logos), are slide-scoped too, as whole image fields.) They are inline tokens only: `var:slide.number`, any `var:slide.*` and `var:deck.slideCount` are `variable-unknown-builtin`, because every field that would take them is a string. `slide.` is a reserved prefix, so `{{slide.anything-else}}` is `variable-unknown-builtin`.
- `resolveVariables` leaves them as written, also on a complete pass, and never reports them (`variable-unfilled` and `variable-unknown` do not apply). An escaped `\{{slide.number}}` keeps its escape through that pass and draws as the literal text `{{slide.number}}`.
- `resolveSlideVariables(slide, { slideNumber, slideCount })` returns a copy of one slide with the three substituted in every string, with the same walk and exclusions as `resolveVariables` (`extensions` is never searched; code follows the same rule as user tokens). `slide.section` reads the slide's own `section`. The slide's own `design.header` and `design.footer` are left to `layoutFurniture`.
- Engines (renderer, PPTX exporter, editor preview) compose and draw `context.slide` from `resolveSlideContext(deck, index, { slideNumber, slideCount })`, which is that substituted slide for the same numbers `context.options` carries; an engine that builds its own options calls `resolveSlideVariables` per output slide with the `slideNumber` and `slideCount` it gives `composeSlide`. Text is therefore measured with the real value.
- `layoutFurniture` substitutes them in each zone's `text` for the slide it lays out, and every `{{slide.number}}` adds a `slideNumber` entry to `FurnitureTextPart.fields`, so the PPTX exporter writes it as a native slide-number field. `{{deck.slideCount}}` and `{{slide.section}}` are fixed text (PowerPoint has no slide-count field). In body text every slide token is fixed text.
- `paginate` measures with the substituted values but returns slides with the tokens kept, so its output stays a source document, and runs its slide-count fixed point whenever `{{deck.slideCount}}` appears in the deck.
- Validation warns `variable-builtin-missing` at each slide that has no `section` but uses `{{slide.section}}`, in its own strings or in the header or footer it inherits from `design`.

### Organization logos

Logos live on the organization (RR-71, OPF 0.18). `Organization.logo` is one path or Asset for every shape, or up to four shapes, each a path or Asset or `{ "onLight", "onDark" }`:

```json
"organization": [
  { "id": "acme", "name": "Acme", "role": "primary",
    "logo": { "full": { "onLight": "./assets/acme-logo.svg", "onDark": "./assets/acme-logo-white.svg" }, "icon": "./assets/acme-mark.svg" } },
  { "id": "beta", "name": "Beta", "role": "partner", "logo": "./assets/beta.svg" }
]
```

`onLight` is the artwork for light backgrounds (usually dark ink) and `onDark` the one for dark backgrounds. Plain file paths are the simplest source; an HTTPS URL, a data URI or an `asset:<id>` registry entry works too.

- **Placing a logo.** A whole-field reference in any image field: `var:organization.logo` (the full logo), `var:organization.logo.full|stacked|icon|wordmark`, `var:organization.<id>.logo` and `var:organization.<id>.logo.<shape>` for another organization. A header or footer zone writes `"image": "var:organization.logo.icon"`; an image block or a slide `image` works the same way.
- **Fallbacks.** A missing shape falls back to `full`, and `full` to the first defined of `wordmark`, `stacked` and `icon`. Within a shape a missing `onLight` or `onDark` uses the other.
- **Slide-scoped.** The `onLight` or `onDark` asset follows each slide's background, so these references resolve per output slide, like `{{slide.number}}`: `resolveVariables` leaves them as written wherever a slide reaches them (slides, the deck's header and footer, `design.logo`), `resolveSlideVariables(slide, { slideNumber, slideCount, presentation, darkBackground })` and `resolveSlideContext` resolve them in a slide's fields, and `layoutFurniture` in zone images. Anywhere else (a deck watermark, say) no slide background applies and they resolve deck-wide, as on a light background. A reference to an organization without a logo omits the field, as an unfilled optional variable does.
- **Whole fields only.** An inline `{{organization.logo}}` is `variable-unknown-builtin`, as are an unknown shape (`var:organization.logo.banner`) and an unknown organization id. A known organization without a logo is `variable-builtin-missing`.
- **Covers and `design.logo`.** Cover and section slides draw the primary organization's full logo, and picture bullets its icon, with no reference at all. `design.logo` (deck or slide) is only an override: a reference such as `"var:organization.beta.logo"` or `"var:organization.logo.wordmark"` (a named shape wins everywhere the override applies), or `false` for no logo. See [design resolution](design-resolution.md#brand-assets-and-layout-hints).
- `listBuiltinVariables` lists every logo and shape with kind `image` and scope `slide` (no `value`; `available` when the organization has a logo).

Header and footer zones carry generated values only as variables in `text`, in the order the author writes them, with `\n` between lines: `"{{organization.name}}"`, `"{{speaker.name}}, {{speaker.title}}"`, `"{{slide.section}}"`, `"{{slide.number}} / {{deck.slideCount}}"`. See [dynamic composition](dynamic-composition.md).

## Templates

A template is an OPF document that is allowed to be incomplete.

- The root `template: true` marks it. Without the marker a deck is a normal deck.
- Validation of a template reports instead of fails. `validate(doc)` returns `valid: true` with `template: true` and `unfilledVariables: ['client', ...]`, and one `opf/variable-unfilled` warning per unfilled variable. A normal deck with an unfilled required variable gets the same finding as an error (category `format`, so `validate(doc, { only: ['format'] })`, `assertValid` and every write command reject it).
- Validation of a normal deck with an unfilled required variable is an error (`required variable 'client' has no value`) at the declaration's path, so a half-filled deck can never be exported by accident.
- Both are checked as the deck they would become: every variable is replaced by its value, its `example`, or a type sample (`Sample text`, `0`, `2000-01-01`, a placeholder image URL, one list entry), and the declarations stay. Errors therefore carry the source's own paths and a template is held to the whole schema: a `number` variable in a text field, a `date` value that is not a date, or a chart cell that resolves to a list are all reported.
- `validate(doc, { template: true | false })` overrides the marker, and `validate(doc, { values })` fills before checking.
- Unused variables warn (`declared but never used`), as do tokens naming undeclared ids.
- A variable with a `value` is a default: filling overrides it, leaving it blank in a data row keeps it.

A template is a normal OPF file for everything else: the editor opens it, `opf validate` and `opf edit` accept it, pagination and bundling work on it, and renderers preview it.

### Placeholder content

"Empty slots the author must fill" are required variables. There is no separate placeholder construct. A slide, block or field that should not exist unless supplied uses an optional variable (`required: false`): its `var:id` field is omitted when the variable is unfilled.

## Resolution

```ts
resolveVariables(presentation, values?, options?) => {
  presentation,   // the concrete deck
  diagnostics,    // { code, severity, path, id, message }[]
  unfilled,       // required variable ids with no value
  examplesUsed,   // ids filled from their `example`
  complete,       // unfilled.length === 0
}
```

Pure and deterministic: no clock, locale, time zone, network, file access or randomness, and no model call. The function never invents content. A variable's value comes from `values`, then from the declaration's `value`, and only with `options.examples` from its `example`. The input is never mutated; unchanged parts of it are shared with the result, so treat the result as immutable.

| Option | Effect |
| --- | --- |
| `examples` | Use each unfilled variable's `example` (template previews). |
| `partial` | Allow unfilled required variables (informational). Their tokens and references stay as written and their declarations stay in the output, so a second pass can finish the deck. |
| `template` | Override the root marker: a template treats unfilled variables as informational. |
| `strict` | Throw `OPFVariableError` when any diagnostic has severity `error`. |

The result of a complete pass:

- Content variables are substituted and their declarations removed, so resolving the result again changes nothing (no double expansion, no re-interpreted `\{{`).
- Color variables keep their declarations and their `var:` references (the renderers and the exporter resolve them as before), with values from `values` or `example` written in.
- The root `template` marker is removed.
- The result validates as an ordinary deck.

Values are coerced per kind, so data files work as they are: number accepts a finite number or a strict decimal string (`"1250000"`, not `"1,250,000"`); date accepts `YYYY-MM-DD` or an ISO date-time (the date part is kept, no zone conversion); list accepts an array, or a string split on newlines; text accepts a string, a number, a boolean or runs; image accepts a string or `{src}`; url accepts http, https, mailto and tel; color accepts hex. `null`, `undefined` and, for every kind but text, a blank string mean "not provided". A rejected value is an `error` diagnostic (`variable-invalid-value`) and falls back to the declaration. A value for an undeclared variable is a `variable-unknown-value` warning.

Diagnostic codes: `variable-unfilled` (error in a deck, info in a template or partial fill), `variable-invalid-value`, `variable-format` (an unusable number or date pattern), `variable-unknown` (undeclared token), `variable-unknown-builtin`, `variable-builtin-missing`, `variable-unknown-value`, `variable-unused`, `variable-example-used`, `variable-rich-flattened`.

`listVariables(presentation, values?)` returns each declaration with `filled` and every place it is used (`uses: [{ path, form: 'token' | 'reference' }]`). Fill forms, agents and the editor read it.

## Previews and export

The renderer, the PPTX exporter and the editor call `resolveVariables` at their entry points, so preview and export agree on text, numbers, dates, images and lists:

- `toSvg`, `resolvePresentation` and `toPptx` accept `variables` (the values) and resolve the deck first when it uses content variables or is a template. A deck without them is untouched, byte for byte.
- A template is previewed and exported with each unfilled variable's `example`, and reports `variable-example-used` through `onDiagnostic` (PPTX) so the sample content is never silent. A variable with no example keeps its `{{id}}` text visible; nothing is made up.
- A normal deck with an unfilled required variable is refused: `OPFRenderError` or `OPFPptxError` with code `unfilled-variables`.
- `variables: false` draws the document as authored, tokens and `var:` references visible (the editor canvas's view of a template).
- A core older than this feature (no `resolveVariables`) leaves variable-free decks working and rejects a deck that uses content variables at validation, as any unknown schema construct is rejected.

The PPTX file contains the resolved text. The template form is not stored in the package, so importing the PPTX returns the filled deck, not the template (see [Follow-ups](#follow-ups)).

## Decks from data: `opf fill`

```
opf fill <template|-> [--data <values.json|data.csv|data.tsv|->] [--format csv|tsv|json]
         [--delimiter <c>] [--no-header]
         [--output <file|-> | --out-dir <dir> [--name <pattern>] | --combine --output <file|->]
         [--partial] [--examples] [--force] [--fail-on <level>]
```

- **Records.** A JSON object is one record. A JSON array of objects, a CSV or TSV file, `{columns, rows}` and a row matrix give one record per row; CSV and TSV columns are matched to variable ids by header name. JSON keeps rich values (text runs, lists, Asset objects); CSV and TSV cells are strings that coerce per kind. A blank cell keeps the declared value.
- **Outputs.** One record gives one deck (`--output`, default stdout). Several records need `--out-dir` (one `<name>.opf.json` per record; `--name` is a pattern with `{n}`, the zero-padded index, and `{column}`, a slug of that column's value; default `deck-{n}`) or `--combine` (one deck whose slides are the filled slides of every record in order, with repeated slide ids suffixed by the record index; deck-level fields come from the first record).
- **Failure.** An unfilled required variable, a value of the wrong kind or an unusable format fails with exit code 1 and the offending record and variable, before any file is written. `--partial` allows unfilled variables and keeps their declarations; `--examples` fills them from their example.
- **Overlap with `ingest`.** `ingest` turns tabular data into a table or chart *content* payload and shares the same CSV/TSV/JSON parser. `fill` maps rows onto *variables* of a deck the author designed. They compose: a chart whose rows come from a data file stays `ingest`; a chart cell that varies per client is a `var:` reference.
- Relative image paths in data are written as given, so they resolve against the OPF file's final location. Prefer HTTPS URLs, data URIs, `asset:` ids or absolute paths in data files, or write decks next to their images.

## Editor

The editor package exposes the fill model (`@openpresentation/opf-editor/templates`) and a **Fill template** panel (`/template-panel`, mounted by the playground): variables listed with typed inputs (text, multi-line text, number, date, color, URL, list, and an image source with file upload or `asset:` pick), required and filled state, where each is used, a live preview that re-resolves on every change, and a count of unfilled variables. Inserting a variable token into a text field (declaring a new variable in the same edit when asked) is an edit through the session, so it validates and undoes like any other. Filling replaces the document with the concrete deck as one undoable edit. The canvas draws a template as authored (renderer option `variables: false`), so tokens stay visible and an inline edit never overwrites one; the panel's preview draws the resolved deck. See the editor README.

## Decisions

Each is vetoable; the alternative says what changing it would cost.

1. **Token syntax `{{id}}` with ids matching the existing variable id pattern.** Familiar from Mustache, Handlebars and Jinja, readable in JSON, and not a valid identifier in prose. Alternatives: `${id}` (collides with template literals in code), `[[id]]`, dotted paths such as `{{client.name}}` for user variables (no nesting exists in the variable model; nested records are a follow-up). Dotted names are reserved for the [built-in variables](#built-in-variables), which is why a user id can never contain a dot.
2. **Escape `\{{`.** One rule with one sequence. `{{{{` doubling was rejected because it is ambiguous next to a real token.
3. **Whole-field `var:id` carries typed values; inline `{{id}}` always makes text.** One reason each: a chart cell needs a number, a title needs a string. `var:` already existed for colors.
4. **No `{ "var": "id" }` TextRun form.** Tokens inside a run's `text` give the same styling (`{ "text": "{{client}}", "bold": true }`) without a schema change to `TextRun`, and rich values travel through `var:id`. A second form would double the surface every consumer must handle.
5. **Kinds: color, text, number, date, image, url, list.** `boolean` and nested record or table kinds are not included: no field consumes a boolean, and per-row structure belongs to `ingest` and the follow-up `repeat` construct.
6. **A root `template: true` marker plus a `validate` option**, not an implied notion ("has unfilled variables"). An explicit marker keeps the strictness for normal decks (an unfilled variable cannot slip through) and survives in the file for editors and the gallery.
7. **`value` is both the default and the current value; `example` is only illustration.** A third `default` field was rejected as redundant. `required` defaults to `true`.
8. **Undeclared tokens stay literal.** Existing decks with `{{` in text, or code samples, are never altered.
9. **Content declarations are consumed by resolution; color declarations stay.** Idempotence and backward compatibility respectively.
10. **Renderers and the exporter call `resolveVariables`** (rather than require resolved input), so the editor can pass its in-progress values straight to the preview. Templates preview with examples; decks with unfilled required variables are refused at export.
11. **No template provenance in PPTX in this release.** The package stores the resolved deck. Re-import returns the filled deck. Storing the template form needs a provenance part and a re-import path; recorded as a follow-up.
12. **`opf fill`: a deck per record, plus `--combine`; no `repeat` construct yet.** A slide marked `repeat` (one instance per row inside one deck, with shared slides emitted once) is the natural next step but needs a schema addition and a per-record scope; `--combine` covers "one slide group per record" without it.
13. **English number and date formats only.** Separators and names are fixed so output never depends on host locale; a `locale` field is a follow-up.
14. **Optional unfilled variables vanish; required ones never do.** The resolver does not guess a replacement for a missing value.

15. **Built-ins are dotted and read from the document, not declared, and per-slide values are slide-scoped built-ins (FA-31, owner decision 2026-10-09).** A dot can never appear in a user id, so there is no collision rule to learn. The cost is one non-dotted name, `speakers`, which is reserved. `{{slide.number}}`, `{{slide.section}}` and `{{deck.slideCount}}` resolve per output slide at composition time (`resolveSlideVariables`, `layoutFurniture`), and a furniture `{{slide.number}}` keeps the native PPTX field, so headers and footers need no flags and no second template syntax (the 0.16 `organization`, `speaker`, `section`, `slideNumber` and `slideNumberFormat` keys and `{current}`/`{total}` are removed). Alternative: keep per-field booleans, which fix the order of values in a zone and duplicate the built-ins.
16. **A missing built-in source resolves to nothing with a warning (previews of a template keep the token).** An unknown path is an error because it is a typo, not missing data.

## Limits

- A variable's own `value` is taken literally: a token inside a value (`{{other}}`) is not expanded, so variables do not refer to each other.
- Variables are not computed: no arithmetic, conditionals or loops. A deck that needs them generates its data upstream.
- A variable cannot change structure beyond splicing a list into an array and omitting an optional field. Which slides exist is the author's choice (or `opf fill`'s per-record decks).
- Variables that point at relative image paths depend on where the filled file is saved.
- Schema support is not fidelity: the renderer and exporter lay out the resolved deck, so a long substituted value can overflow like any long authored value. Check the filled deck with the usual composition diagnostics.

## Follow-ups

- A `repeat` slide construct and per-record scoping for one-deck-many-records fills.
- Template provenance in PPTX export (re-import returns the template), and importing a PowerPoint deck with `{{id}}` tokens as a template.
- Locale-aware number and date formats; conditional visibility of a block.
- pptx.gallery: a template gallery and "use this template" flow; the gallery's examples gain optional variables.
- Image variables backed by a host asset picker in hosts other than the playground.
- A JSON Schema for a template's values file, generated from `listVariables`, for agents and form builders.
