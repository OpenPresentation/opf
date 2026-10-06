# OPF Finding Schema Reference

A finding is one thing a checker found at one place in a presentation, and a report lists them. `validate` in `@openpresentation/opf`, the Markdown and YAML converters, the editor's Review panel and hosted reviewers such as pptx.dev's AI review all produce this shape, so a host shows and applies findings from any of them the same way. This page summarizes `spec/schemas/finding.schema.json`; the schema remains the source of truth. How core produces findings is in [validate](validate.md).

## Report Contract

- Schema id: `https://openpresentation.org/schema/opf-finding/v1`
- Required top-level fields: `valid`, `findings`, `counts`
- Additional top-level fields: allowed (`validate` adds `schemaValid`, `checks`, `template` and `unfilledVariables`)

## Top-Level Fields

| Field | Required | Type | Notes |
| --- | --- | --- | --- |
| `valid` | yes | `boolean` | True when no finding has severity `error`. |
| `findings` | yes | `array<ref:Finding>` | Every finding, in report order. |
| `counts` | yes | `object` | How many findings each severity has. |

## Object And Type Reference

### FindingSeverity

- Type: `enum:error | warning | info`
- Required fields: none
- Purpose: `error` makes a report invalid. `warning` is a problem the author should fix. `info` is advisory.

_No named properties._


### FindingCategory

- Type: `anyOf:enum:format | references | policy | accessibility | layout | content / string`
- Required fields: none
- Purpose: What kind of question the finding answers. Core uses `format` (is it well-formed OPF), `references` (does everything it points at resolve), `policy` (host house rules), `accessibility`, `layout` (will it present as authored) and `content` (is anything left unfinished). Other producers may use their own category names, such as `narrative` or `audience-fit`.

_No named properties._


### FindingLocation

- Type: `object`
- Required fields: `offset`, `length`, `line`, `column`
- Purpose: A range in the checked text: UTF-16 offset and length from the start, and the one-based line and column of the start. Present when the finding was produced from text (JSON, Markdown or YAML).

| Field | Required | Type | Notes |
| --- | --- | --- | --- |
| `offset` | yes | `integer` |  |
| `length` | yes | `integer` |  |
| `line` | yes | `integer` |  |
| `column` | yes | `integer` |  |


### JsonPatchOperation

- Type: `oneOf:object / object / object`
- Required fields: none
- Purpose: One RFC 6902 JSON Patch operation. Paths are JSON Pointers into the checked presentation.

_No named properties._


### FindingFocus

- Type: `object`
- Required fields: `path`, `field`
- Purpose: The field an author has to fill in, for a fix that cannot be written as a patch.

| Field | Required | Type | Notes |
| --- | --- | --- | --- |
| `path` | yes | `string` | JSON Pointer of the field to edit. |
| `field` | yes | `string` | What the field is, such as `alt`, `title`, `text`, `link`, `language` or `fontSize`. |
| `value` | no | `string \| number \| boolean \| null \| array \| object` | The field's current value, when it has one. |


### FindingFix

- Type: `object`
- Required fields: `title`
- Purpose: A suggested repair. Core never applies it: the host shows it and applies it through its own undoable edit path. A `patch` fix carries JSON Patch operations; a `focus` fix only names the field the author has to fill in.

| Field | Required | Type | Notes |
| --- | --- | --- | --- |
| `title` | yes | `string` | What applying the fix does, in a few words. |
| `id` | no | `string` | Stable id within one finding, such as `focus-alt` or `use-readable-color`. |
| `kind` | no | `enum:patch \| focus` | `patch` fixes carry `patch`; `focus` fixes carry `focus`. |
| `safe` | no | `boolean` | True when applying the fix cannot change what the content says or how it looks beyond the repair, such as switching a failing colour to the one the theme chose. False fixes need a deliberate choice. |
| `patch` | no | `array<ref:JsonPatchOperation>` | RFC 6902 JSON Patch operations that apply the fix to the checked presentation. |
| `focus` | no | `ref:FindingFocus` |  |


### FindingSuggestion

- Type: `object`
- Required fields: `value`, `label`, `origin`
- Purpose: A value the author could use instead, such as a catalog record that exists. Suggestions name records actually present in the checked context and never replace authored values silently.

| Field | Required | Type | Notes |
| --- | --- | --- | --- |
| `value` | yes | `string \| number \| boolean \| null` |  |
| `label` | yes | `string` |  |
| `origin` | yes | `string` | Where the suggestion comes from: `schema`, `built-in`, `loaded`, `document` or `contract`. |
| `definition` | no | `string` | Where the suggested record or constraint is defined. |


### ValidationIssue

- Type: `object`
- Required fields: `path`, `message`, `keyword`, `schemaPath`, `params`
- Purpose: The raw schema or semantic issue behind a finding, kept with every union alternative so a host can inspect the exact constraint.

| Field | Required | Type | Notes |
| --- | --- | --- | --- |
| `path` | yes | `string` |  |
| `message` | yes | `string` |  |
| `keyword` | yes | `string` | The JSON Schema keyword that failed, or `opf` for a rule the schema cannot express. |
| `schemaPath` | yes | `string` |  |
| `params` | yes | `object` |  |


### Finding

- Type: `object`
- Required fields: `ruleId`, `severity`, `category`, `path`, `message`
- Purpose: One thing a checker found at one place in a presentation.

| Field | Required | Type | Notes |
| --- | --- | --- | --- |
| `ruleId` | yes | `string` | Stable `<producer>/<rule>` id, such as `opf/text-contrast` for core or `pptx.dev/narrative-gap` for a hosted reviewer. Ids do not change between releases. |
| `source` | no | `string` | The producer: `opf` (the default) for core, or the name of another tool such as `pptx.dev/review`. |
| `severity` | yes | `ref:FindingSeverity` |  |
| `category` | yes | `ref:FindingCategory` |  |
| `path` | yes | `string` | JSON Pointer to the value the finding is about, such as `/slides/4/title`. Empty for the whole document, or for a value in a supplied context such as a loaded catalog. |
| `scope` | no | `enum:document \| context` | `document` (the default) when `path` points into the checked presentation, `context` when it points into host-supplied context such as loaded catalog records. |
| `message` | yes | `string` | What is wrong, in a sentence. |
| `help` | no | `string` | What to do about it. |
| `slide` | no | `integer` | Zero-based index of the slide the finding belongs to. |
| `slideId` | no | `string` | The id of that slide, when it has one. |
| `location` | no | `ref:FindingLocation` |  |
| `definition` | no | `string` | A link to the rule's documentation or to the schema constraint or catalog record the finding is about. |
| `lookup` | no | `array<string>` | Arguments for the `opf schema` or `opf catalog` command that shows the definition, as an argument list rather than a shell string. |
| `suggestions` | no | `array<ref:FindingSuggestion>` |  |
| `measured` | no | `object` | The numbers behind the finding, such as `{ "ratio": 2.1, "needed": 4.5 }`. |
| `fixes` | no | `array<ref:FindingFix>` |  |
| `validation` | no | `ref:ValidationIssue` |  |
