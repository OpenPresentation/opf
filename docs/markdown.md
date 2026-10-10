# Markdown and outlines

`@openpresentation/opf/markdown` (RR-30) converts between OPF and a small, documented Markdown dialect, in both directions, with no renderer, fonts, network or model: the same input always gives the same output. The CLI exposes it through `opf convert` (`deck.md` or `deck.opf.md` to `deck.opf.json` and back; `opf from-md` and `opf to-md` before 0.18), and every command that reads or writes a deck understands a file ending `.opf.md` ([Markdown decks in every command](#markdown-decks-in-every-command)); `parse` and `stringify` read and write a deck in JSON, YAML or Markdown with one call, and `open`, `save` and `convert` of `@openpresentation/opf` do it for files in Node.

- **JSON stays canonical.** The schema, the interchange form and every package describe the JSON. A `.opf.md` file is an authoring serialization of the same data, as a `.opf.yaml` file is ([OPF as YAML](yaml.md)).
- **Write a deck as text.** YAML front matter holds the deck, `---` separates slides, `#` is the title, `##` the subtitle, and lists, quotes, tables, images, code, charts, metrics, timelines and speaker notes have their own syntax.
- **Read a deck as text.** `toMarkdown` writes any valid OPF document as that dialect. What the dialect has no syntax for (a design, nested groups, a styled table cell) is embedded as YAML in a fenced block, so nothing is lost; or it is left out and reported, on request.
- **Round trip.** The Markdown the writer produces converts back to the same deck and to itself, byte for byte. Markdown written by hand converts to a deck whose canonical Markdown is the same text, apart from layout the dialect treats as equivalent (the examples in `examples/markdown/` are canonical).
- **Errors have places.** Findings use the shared [Finding format](finding-schema-reference.md) and carry the source offset, length, line and column of the Markdown that caused them, including OPF validation errors mapped back to the Markdown that produced the field.

```js
import { fromMarkdown, toMarkdown } from "@openpresentation/opf/markdown";

const { presentation, valid, findings } = fromMarkdown(markdown);
const { markdown: text, report } = toMarkdown(presentation);
```

```sh
opf convert deck.md deck.opf.json
opf convert deck.opf.json deck.opf.md
opf validate deck.opf.md
opf convert deck.opf.md slides/deck.svg
```

## An example

````md
---
name: Q3 Business Review
language: en-US
---

<!-- slide: id=cover layout=title section=Overview -->
# Q3 Business Review

## Operations and growth

Note: Two minutes on the agenda, then straight into the numbers.

---

# Revenue grew every quarter

```chart column
Quarter,Revenue
Q1,12
Q2,18
```

> We would rather spend a week on capacity than a month on an outage.
> — Priya Raman, Head of Platform
````

converts to

```json
{
  "name": "Q3 Business Review",
  "language": "en-US",
  "slides": [
    { "id": "cover", "layout": "title", "section": "Overview", "title": "Q3 Business Review", "subtitle": "Operations and growth", "notes": "Two minutes on the agenda, then straight into the numbers." },
    {
      "title": "Revenue grew every quarter",
      "blocks": [
        { "chart": { "type": "column", "data": { "columns": ["Quarter", "Revenue"], "rows": [["Q1", 12], ["Q2", 18]] } } },
        { "quote": { "text": "We would rather spend a week on capacity than a month on an outage.", "attribution": "Priya Raman, Head of Platform" } }
      ]
    }
  ]
}
```

[`examples/markdown/quarterly-review.opf.md`](../examples/markdown/quarterly-review.opf.md) uses every block kind. [`examples/markdown/outline.md`](../examples/markdown/outline.md) is a plain outline read with `split: "headings"`.

## The dialect

### Document

| Part | Syntax | OPF |
| --- | --- | --- |
| Deck | YAML between a first line `---` and a closing `---` (or `...`) | Every deck property except `slides`: `name`, `description`, `language`, `design`, `variables`, `assets`, `extensions`, ... in the order written. JSON-compatible YAML only: no anchors, tags or duplicate keys. `slides` is not allowed |
| Slides | Lines of three or more hyphens, outside fences, HTML comments and speaker notes' fences | One slide per segment. Empty segments are skipped (a warning when between two slides); `<!-- slide -->` keeps an empty slide |
| Outline | `split: "auto"` (the default) or `"headings"` (`--split headings`) | With no `---` line and two or more `# ` headings outside fences, comments and notes, each `# ` heading starts a slide, so a bare outline needs no `---`. `"headings"` cuts at every `# ` heading, even inside speaker notes; `"rules"` (`--split rules`) cuts only at `---`, so a second `# ` is a second title |

A deck without front matter starts with its first slide, so a file never begins with `---` unless it opens the front matter. Line endings may be LF, CRLF or CR and a leading BOM is ignored. The converter adds nothing the Markdown does not say: no `$schema`, no `name` (pass `defaults: { name }` or `--title` for a fallback that the front matter overrides).

### Slide

| Part | Syntax | OPF |
| --- | --- | --- |
| Options | `<!-- slide: id=cover layout=title section="Part 1" tag=NEW hidden beat=a beat=b type=chart -->` | `id`, `layout`, `section`, `tag`, `hidden` (`hidden=false` too), `beat` (repeat for several), `type`. Values are bare words or JSON strings. At most one per slide, anywhere in it; written first |
| Title | `# Title` | `title`: a string, or `TextRun[]` when the line has [inline formatting](#inline-text). One per slide; closing `#` characters are dropped |
| Subtitle | `## Subtitle` | `subtitle`, a string or `TextRun[]` like the title. One per slide |
| Deeper headings | `### Text` | A bold paragraph, with a `heading-demoted` warning |
| Notes | `Note: ...` or `Notes: ...` at the start of a line | `notes`: plain text, every following line of the slide verbatim (blank lines, `#`, `-` and fences included), ending at the next `---` |
| Content | The blocks below, top to bottom | One block with no `id`/`type`/`region`: a root field (`text`, `items`, `chart`, ...). Otherwise `blocks` |
| Embedded | A fenced `opf-slide` block of YAML | Extra slide fields merged in (`composition`, `design`, `extensions`, ...). A field set both here and in Markdown is an error |

### Blocks

Blocks are separated by blank lines; a fence, heading, quote, table, image line or comment also ends a paragraph or list without one. A comment `<!-- block: ... -->` directly before a block gives it options:

| Option | Meaning |
| --- | --- |
| `id=...`, `type=...` | The block's `id` and explicit `type`. Such a block is always an entry in `blocks` |
| `as=bullets` | Store a list as `bullets` instead of `items` |
| `as=video` | Store an image line as `video` |
| `region=top:left` | Put the block in that promoted region of the slide (`left`, `center+right`, `top+middle`, `middle+bottom:left+center+right`, ...) instead of the content |

| Markdown | OPF field | Notes |
| --- | --- | --- |
| A paragraph | `text` | A soft line break is a space; a backslash at the end of a line is a hard break (`\n`). Inline formatting becomes `TextRun[]`, otherwise a string |
| `- item` (`*` and `+` too) | `items` | Nested by deeper indentation (two spaces when written) into `level`. An indented line `  : text` after an item is its `description`. A different marker character starts a new list (the writer alternates `-` and `*` for lists in a row). Numbered markers (`1.`) are read as bullets with a `numbered-list` warning: the dialect has no syntax for the `numbering` field of [numbered lists](numbered-lists.md), so numbers and styles are not kept (add `numbering` in an `opf-slide` or `opf-block` fence) |
| `> text` and trailing dash lines | `quote` | `> — Name, Title` is the `attribution`, a second dash line the `source`. The rules (`—`, `–`, `--`, `~`, `-`; one short line; not a dashed list) are those of [content conversions](conversions.md), as is the code fence rule. A quote with a `role` or a `photo` has no Markdown form (a dash line holds a name and a title in one string, and a quote has no image syntax): it is written as an `opf-block`, which reads back exactly. Put `Name, Title` in the attribution line for a plain Markdown quote |
| ```` ```lang title="file" ```` | `code` | `{ source, language, filename }`, or just the string when there is neither. Backtick or tilde fences, longer fences for code that contains fences |
| `\| a \| b \|` rows with a `\| --- \| --- \|` row | `table` | The first row is `columns`; an all-empty first row means none. Cells are text with inline formatting, as in the [data import](data-import.md) (`007` and `2024` stay text); an empty cell is `null`. `\|` is a pipe, `<br>` a line break. Alignment colons are ignored. Short and long rows warn. A table with an `alt` has no pipe-table syntax for it, so it is written as an `opf-block` and reads back exactly |
| `![alt](src "title")` | `image` | `{ src, alt, title }`, or the string when there is only a source. `<src with spaces>` in angle brackets |
| ```` ```metric ```` | `metric` | `key: value` lines: `value`, `label`, `description`, `unit`, `delta`, `trend`, `sentiment`. A plain decimal `value` or `delta` is a number; `"..."` is a JSON string; `unit: %` and `delta: +3 pts` are plain text |
| ```` ```chart column ```` | `chart` | The word after `chart` is the chart `type`; an optional `alt="..."` after it is the chart's text alternative (`alt=""` marks it decorative; a quoted JSON string, as on the timeline fence). The body is CSV with a header row (the first column is the category labels and always text; in the other columns an unquoted decimal is a number, `true` and `false` are booleans, an empty field is `null` and a quoted field is text) or a JSON object holding `columns` and `rows` |
| ```` ```timeline name="Roadmap" ```` | `timeline` | One event per line: `when — what` (spaced em dash), or the date forms of the conversions (`2026 Q1: Pilot`, `Jan - Kickoff`), or just `what`. A task-list prefix sets the event's `status`: `[x]` done, `[>]` current ("we are here"), `[ ]` planned. An indented line is the event's `description`. `name` and `description` go on the fence line |
| ```` ```opf-block ```` | any block | A YAML `ContentPayload`: `id`, `type`, any content field, nested `blocks` groups |

### Inline text

| Syntax | Run |
| --- | --- |
| `**bold**`, `__bold__` | `bold` |
| `*italic*`, `_italic_` | `italic` (`_` only at word edges: `snake_case` is text) |
| `~~strike~~` | `strikethrough` |
| `` `code` ``, ``` ``a ` b`` ``` | `code` (a backtick fence of any length; one space is trimmed from each side when both sides have one; the text is literal and other formatting wraps the span) |
| `<u>`, `<sup>`, `<sub>` | `underline`, `superscript`, `subscript` |
| `[text](url)`, `<https://...>` | `link` (a link title is ignored) |
| `[text]{color=#B42318 size=24 font="Open Sans"}` | `color` (a hex colour, scheme slot or `var:name`), `fontSize`, `fontFamily`, `lang` (a BCP-47 tag); `bold italic underline strike sup sub` work inside the braces too |
| `\*` and any backslash before ASCII punctuation | The character itself |

Flanking follows CommonMark, so `2*(3+4)*5` and `a * b` are text. A backtick that has no matching fence, or that is escaped with a backslash, is text. There is no raw HTML beyond the tags above and `<br>`, no entities (`&amp;` is literal) and no setext headings or indented code. The title, the subtitle and a quote's text keep inline formatting (a string when nothing is formatted, `TextRun[]` otherwise); a quote with formatted text and no attribution stays `{ text: [...] }`, because the string shorthand is for plain text. A quote's attribution and source are plain strings and drop formatting with a `formatting-dropped` warning; backticks in them stay literal characters. `cite` and `footnote` have no inline syntax: a heading or quote that carries one is written in an `opf-slide` fence. Image alt text, code, metric values and timeline lines are read as written, without inline formatting.

## Writing OPF as Markdown

`toMarkdown(presentation, { unsupported })` first validates the presentation (`OPFMarkdownError`, `code: "invalid-document"`, when it is not valid OPF). Every part is written in the dialect and **read back before it is kept**: a part whose text could not be read back as the same value (a table cell that is not text, a title that ends in ` #`, a title or quote run with `cite` or `footnote`, notes with a `---` line, formatting next to punctuation that CommonMark cannot open) takes the fallback instead of being written wrongly.

| `unsupported` | Behaviour |
| --- | --- |
| `"embed"` (default) | The part is written as YAML: a block in an `opf-block` fence, slide fields (and any region that is not one plain block) in an `opf-slide` fence. The result converts back to the same deck |
| `"drop"` | The part is left out and listed in `report.loss`. For Markdown to read, not to convert back |

The report is `{ lossless, native, embedded, loss }`: `native` is true when the whole document is plain dialect syntax, `embedded` lists the JSON Pointer and reason of each YAML part, `loss` is empty unless `unsupported` is `drop`. The 126 example decks need YAML for fewer than 5% of their slides (36 of 805): table cells that are numbers, booleans or styled, video assets with a `description`, nested groups, `href` runs.

The writer's canonical form: front matter, then slides joined by a blank line, `---` and a blank line; the options comment directly above what follows it; one blank line between blocks; two lists in a row alternate `-` and `*` so they stay two blocks. A round trip may collapse equivalent forms:

- `blocks` with one plain block becomes the root field; a root with several content fields becomes `blocks` in key order.
- Shorthand and object forms collapse to the shorter one: a metric with only `value`, a code object with only `source`, an image with only `src`, a quote with only `text`, a timeline array with no name, a list item with level 0 and no description.
- Adjacent runs with the same formatting merge and `false` flags drop.

## Findings

`fromMarkdown(markdown, options)` never throws for malformed content. It returns the deck with the [validate](validate.md) report of it, `{ presentation, valid, findings, counts, schemaValid, checks }` (plus `template` and `unfilledVariables` for a deck with content variables), as `fromYaml` does; `presentation` is a best effort when `valid` is false and `schemaValid` is `null` when the check did not run (`validate: false`, or no slides). Each finding is a [Finding](finding-schema-reference.md) (`ruleId`, `severity`, `category` `format`, `path`, `scope`, `message`, `help`) plus `location` (`offset`, `length` in UTF-16 units, one-based `line` and `column`). Rule ids starting `markdown/` come from the Markdown; ids starting `opf/` are the [`validate`](validate.md) findings of the converted deck, located by the Markdown of the field they name. Options: `split` (`"rules"` or `"headings"`), `defaults`, `validate` (`true`, the default, checks `format` and `references`; a `ValidateOptions` object such as `{ only: ["content"] }` picks other rules; `false` skips the check).

Errors: `front-matter`, `front-matter-not-mapping`, `front-matter-unterminated`, `front-matter-slides`, `no-slides`, `options-syntax`, `options-unknown-key`, `options-value`, `options-duplicate`, `options-orphan`, `options-trailing`, `options-embedded`, `comment-unterminated`, `duplicate-title`, `duplicate-subtitle`, `empty-heading`, `empty-quote`, `image-source`, `fence-unterminated`, `code-fence`, `chart-type`, `chart-attributes`, `chart-data`, `metric-block`, `timeline-attributes`, `timeline-description`, `timeline-events`, `opf-slide`, `opf-slide-not-mapping`, `opf-block`, `opf-block-not-mapping`, `slide-property-conflict`, `span-attributes`. Warnings: `front-matter-comments`, `empty-slide`, `heading-demoted`, `numbered-list`, `table-ragged`, `chart-ragged`, `formatting-dropped`.

## Command line

```text
opf convert <deck.md|deck.opf.md|-> <output.opf.json|output.opf.yaml|-> [--from md] [--to json|yaml] [--split <auto|rules|headings>] [--title <text>] [--force] [--fail-on <level>]
opf convert <deck.opf.json|-> <output.opf.md|-> [--to md] [--drop-unsupported] [--force] [--fail-on <level>]
```

A plain `.md` input is read as OPF Markdown (only on `opf convert`'s input side; a Markdown output is named `.opf.md`). Output `-` writes stdout (with `--to`) and the JSON report goes to stderr. Exit codes follow the other commands: 0 success, 1 a deck that is not valid OPF, an output conflict or a `--fail-on` failure, 2 usage, a Markdown syntax error (with the located `findings`), or I/O. Nothing is written on a failure. A part the dialect has no syntax for is embedded and counted as a warning (`markdown/embedded`; `markdown/dropped` with `--drop-unsupported`), so `--fail-on warning` keeps a deck inside the plain dialect. `--split` and `--title` apply to a Markdown input and `--drop-unsupported` to a Markdown output; anywhere else they are usage errors. `opf from-md` and `opf to-md` were removed in 0.18.

## Markdown decks in every command

Every command that reads a deck reads Markdown, through one reader, as it reads [YAML](yaml.md#yaml-everywhere):

1. A file whose name ends `.opf.md` (in any case) is a Markdown deck. **Only `.opf.md` counts**: a plain `.md` file is never taken for a deck, so a README or notes file is never converted by accident (a plain `.md` needs `--from md`, or convert it with `opf convert notes.md deck.opf.json`, or name it `.opf.md`).
2. Anything else (stdin and every other name) is JSON when the text starts with `{` or `[`; otherwise `--from md` (`markdown` is an alias; or `--from yaml`) says what it is, and without it the command exits 2 and asks for it. `--from` wins over a name.
3. The Markdown is converted with the CLI's registered catalogs (the default catalog), so the references check of `validate` and `convert` resolves `name:id` references as it does for JSON. A Markdown syntax or conversion error exits **2**, like invalid JSON, and the message carries the position: `Invalid Markdown in deck.opf.md at line 1, column 1: The front matter starting on line 1 is not closed. [markdown/front-matter-unterminated]`, with the located `findings` and `code: "invalid-markdown"` in the JSON error report. `opf validate` instead reports it as a `markdown/<rule>` finding and exits 1. A deck that is valid Markdown but not valid OPF is reported by the command as it is for JSON, and `validate` and `convert` locate every finding in the Markdown (`deck.opf.md:3:1  error  opf/schema ...`). A JSON Patch is JSON or YAML, never Markdown.

A deck is written as Markdown when the output name ends `.opf.md` or `--to md` (or `--to markdown`) is given; `--to json` and `--to yaml` force the others. When the output is stdout or has another name, the format of the deck that was read is used: a Markdown deck is edited, merged, filled, paginated and embedded back to Markdown, in place (`-i`) or to stdout. `create` has no deck input and defaults to JSON. In `fill` and `ingest`, `--data-format csv|tsv|json` names the data format and `--to` the output.

```sh
opf edit deck.opf.md --patch changes.json -i             # the file stays Markdown
opf format deck.opf.md                                    # canonical Markdown: toMarkdown(fromMarkdown(text))
opf format deck.opf.md --check                            # exit 1 if the file would change
opf convert deck.opf.json deck.opf.md                     # convert; - --to md for stdout
opf paginate deck.opf.md deck.paginated.opf.md
opf validate - --from md < deck.txt
```

`opf format` rewrites a Markdown deck to the canonical form the writer produces, so the layout the dialect treats as equivalent (`*` and `-` bullets, extra blank lines, spacing in front matter) is normalized. Anything the dialect has no syntax for is carried in an `opf-slide` or `opf-block` fence, so a command that rewrites a deck can move content into a fence that was not there: for example an `edit` that adds `design` to a slide. The CLI prints `warning: <file> has N more opf-slide/opf-block fences than before: ...` on stderr when that happens (it does not fail, nothing is lost, and a deck that already had its fences does not warn). The `<!-- -->` comments of the source are not preserved beyond the slide and block options the dialect reads.

In code, `parse(text, { format, filename, catalogs })` and `stringify(presentation, { format | filename })` (the root and `@openpresentation/opf/deck`) read and write the three forms, and in Node `@openpresentation/opf` reads and writes the files (`open`, `save`, `convert("deck.opf.json", "deck.opf.md")`): see [Reading and writing a deck in any form](validate.md#reading-a-deck-in-any-form).

## Decisions and limits

These choices are the defaults of the module and can be changed.

- **A dialect, not all of Markdown.** The block and inline syntax is the subset above with CommonMark's rules where they overlap. Setext headings, indented code, nested block quotes, raw HTML, reference links, footnotes and task lists are not part of it. Text the writer produces is escaped so it reads back as text.
- **One YAML reader.** Front matter and the `opf-slide` and `opf-block` fences follow the same rules as a whole deck written as YAML ([OPF as YAML](yaml.md)) and use the `yaml` package (ISC, no dependencies, YAML 1.2 core schema: `2026-10-01` and `yes` stay strings). Metric blocks, timelines and chart CSV have small readers of their own because hand-written values such as `unit: %` are not valid YAML.
- **Slide options live in HTML comments**, so any other Markdown viewer shows the slide content and ignores them.
- **The pptx.dev Markdown view** targets the pre-v1 `elements` model: it starts a slide at each `##` heading and writes `{id=...}` attribute lines. This module keeps its front matter and its escape-hatch fences (`opf-slide`, `opf-block`) and replaces the rest, because the v1 slide is a title, a subtitle and content that maps one-to-one onto `#`, `##` and blocks.
- **Templates.** A [template](templates-and-variables.md) is an ordinary deck here: `template: true` and `variables` are front matter, and placeholders such as `{{client}}` and `var:logo` fields are plain text. Convert, then fill with `opf fill`.
- **Not yet in the dialect.** `numbering` on lists ([numbered lists](numbered-lists.md): the schema and the renderers have it, but the dialect does not read `1.` markers as numbering; they become bullets with a warning, and a `numbering` field in a deck is written in an `opf-slide` or `opf-block` fence and round trips), footnotes, citations and captions (RR-34), video with a description, and per-slide `design`, `composition` and nested groups (all of these embed as YAML and round trip).
