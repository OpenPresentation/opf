# Markdown and outlines

`@openpresentation/opf/markdown` (RR-30) converts between OPF and a small, documented Markdown dialect, in both directions, with no renderer, fonts, network or model: the same input always gives the same output. The CLI exposes it as `opf from-md` and `opf to-md`.

- **Write a deck as text.** YAML front matter holds the deck, `---` separates slides, `#` is the title, `##` the subtitle, and lists, quotes, tables, images, code, charts, metrics, timelines and speaker notes have their own syntax.
- **Read a deck as text.** `opfToMarkdown` writes any valid OPF document as that dialect. What the dialect has no syntax for (a design, nested groups, a styled table cell) is embedded as YAML in a fenced block, so nothing is lost; or it is left out and reported, on request.
- **Round trip.** The Markdown the writer produces converts back to the same deck and to itself, byte for byte. Markdown written by hand converts to a deck whose canonical Markdown is the same text, apart from layout the dialect treats as equivalent (the examples in `examples/markdown/` are canonical).
- **Errors have places.** Diagnostics use the shape of [OPF lint](lint.md) and carry the source offset, length, line and column of the Markdown that caused them, including OPF validation errors mapped back to the Markdown that produced the field.

```js
import { markdownToOpf, opfToMarkdown } from "@openpresentation/opf/markdown";

const { document, valid, diagnostics } = markdownToOpf(markdown);
const { markdown: text, report } = opfToMarkdown(document);
```

```sh
opf from-md deck.md deck.opf.json
opf to-md deck.opf.json deck.md
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

[`examples/markdown/quarterly-review.md`](../examples/markdown/quarterly-review.md) uses every block kind. [`examples/markdown/outline.md`](../examples/markdown/outline.md) is a plain outline read with `split: "headings"`.

## The dialect

### Document

| Part | Syntax | OPF |
| --- | --- | --- |
| Deck | YAML between a first line `---` and a closing `---` (or `...`) | Every deck property except `slides`: `name`, `description`, `language`, `design`, `variables`, `assets`, `extensions`, ... in the order written. JSON-compatible YAML only: no anchors, tags or duplicate keys. `slides` is not allowed |
| Slides | Lines of three or more hyphens, outside fences, HTML comments and speaker notes' fences | One slide per segment. Empty segments are skipped (a warning when between two slides); `<!-- slide -->` keeps an empty slide |
| Outline | `split: "headings"` (`--split headings`) | A `# ` heading also starts a slide, even inside speaker notes, so a bare outline needs no `---` |

A deck without front matter starts with its first slide, so a file never begins with `---` unless it opens the front matter. Line endings may be LF, CRLF or CR and a leading BOM is ignored. The converter adds nothing the Markdown does not say: no `$schema`, no `name` (pass `defaults: { name }` or `--title` for a fallback that the front matter overrides).

### Slide

| Part | Syntax | OPF |
| --- | --- | --- |
| Options | `<!-- slide: id=cover layout=title section="Part 1" tag=NEW hidden beat=a beat=b type=chart -->` | `id`, `layout`, `section`, `tag`, `hidden` (`hidden=false` too), `beat` (repeat for several), `type`. Values are bare words or JSON strings. At most one per slide, anywhere in it; written first |
| Title | `# Title` | `title`. One per slide; closing `#` characters are dropped |
| Subtitle | `## Subtitle` | `subtitle`. One per slide |
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
| `- item` (`*` and `+` too) | `items` | Nested by deeper indentation (two spaces when written) into `level`. An indented line `  : text` after an item is its `description`. A different marker character starts a new list (the writer alternates `-` and `*` for lists in a row). Numbered markers (`1.`) are read as bullets with a `numbered-list` warning: OPF lists have no numbering yet |
| `> text` and trailing dash lines | `quote` | `> — Name, Title` is the `attribution`, a second dash line the `source`. The rules (`—`, `–`, `--`, `~`, `-`; one short line; not a dashed list) are those of [content conversions](conversions.md), as is the code fence rule. A quote with a `role` or a `photo` has no Markdown form (a dash line holds a name and a title in one string, and a quote has no image syntax): it is written as an `opf-block`, which reads back exactly. Put `Name, Title` in the attribution line for a plain Markdown quote |
| ```` ```lang title="file" ```` | `code` | `{ source, language, filename }`, or just the string when there is neither. Backtick or tilde fences, longer fences for code that contains fences |
| `\| a \| b \|` rows with a `\| --- \| --- \|` row | `table` | The first row is `columns`; an all-empty first row means none. Cells are text with inline formatting, as in the [data import](data-import.md) (`007` and `2024` stay text); an empty cell is `null`. `\|` is a pipe, `<br>` a line break. Alignment colons are ignored. Short and long rows warn |
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

Flanking follows CommonMark, so `2*(3+4)*5` and `a * b` are text. A backtick that has no matching fence, or that is escaped with a backslash, is text. There is no raw HTML beyond the tags above and `<br>`, no entities (`&amp;` is literal) and no setext headings or indented code. Fields that hold plain text (the title, the subtitle, and a quote's text, attribution and source) drop formatting with a `formatting-dropped` warning; backticks in them stay literal characters. Image alt text, code, metric values and timeline lines are read as written, without inline formatting.

## Writing OPF as Markdown

`opfToMarkdown(document, { unsupported })` first validates the document (`OPFMarkdownError`, `code: "invalid-document"`, when it is not valid OPF). Every part is written in the dialect and **read back before it is kept**: a part whose text could not be read back as the same value (a table cell that is not text, a title that ends in ` #`, notes with a `---` line, formatting next to punctuation that CommonMark cannot open) takes the fallback instead of being written wrongly.

| `unsupported` | Behaviour |
| --- | --- |
| `"embed"` (default) | The part is written as YAML: a block in an `opf-block` fence, slide fields (and any region that is not one plain block) in an `opf-slide` fence. The result converts back to the same deck |
| `"drop"` | The part is left out and listed in `report.loss`. For Markdown to read, not to convert back |

The report is `{ lossless, native, embedded, loss }`: `native` is true when the whole document is plain dialect syntax, `embedded` lists the JSON Pointer and reason of each YAML part, `loss` is empty unless `unsupported` is `drop`. The 126 example decks need YAML for fewer than 5% of their slides (36 of 805): table cells that are numbers, booleans or styled, video assets with a `description`, nested groups, `href` runs.

The writer's canonical form: front matter, then slides joined by a blank line, `---` and a blank line; the options comment directly above what follows it; one blank line between blocks; two lists in a row alternate `-` and `*` so they stay two blocks. A round trip may collapse equivalent forms:

- `blocks` with one plain block becomes the root field; a root with several content fields becomes `blocks` in key order.
- Shorthand and object forms collapse to the shorter one: a metric with only `value`, a code object with only `source`, an image with only `src`, a quote with only `text`, a timeline array with no name, a list item with level 0 and no description.
- Adjacent runs with the same formatting merge and `false` flags drop.

## Diagnostics

`markdownToOpf(markdown, options)` never throws for malformed content. It returns `{ document, valid, diagnostics, counts }`; `document` is a best effort when `valid` is false. Each diagnostic is a lint diagnostic (`ruleId`, `severity`, `path`, `scope`, `message`, `help`) plus `location` (`offset`, `length` in UTF-16 units, one-based `line` and `column`). Rule ids starting `markdown/` come from the Markdown; ids starting `opf/` are the OPF lint findings of the converted deck, located by the Markdown of the field they name. Options: `split` (`"rules"` or `"headings"`), `defaults`, `validate` (false skips the OPF lint).

Errors: `front-matter`, `front-matter-not-mapping`, `front-matter-unterminated`, `front-matter-slides`, `no-slides`, `options-syntax`, `options-unknown-key`, `options-value`, `options-duplicate`, `options-orphan`, `options-trailing`, `options-embedded`, `comment-unterminated`, `duplicate-title`, `duplicate-subtitle`, `empty-heading`, `empty-quote`, `image-source`, `fence-unterminated`, `code-fence`, `chart-type`, `chart-attributes`, `chart-data`, `metric-block`, `timeline-attributes`, `timeline-description`, `timeline-events`, `opf-slide`, `opf-slide-not-mapping`, `opf-block`, `opf-block-not-mapping`, `slide-property-conflict`, `span-attributes`. Warnings: `front-matter-comments`, `empty-slide`, `heading-demoted`, `numbered-list`, `table-ragged`, `chart-ragged`, `formatting-dropped`.

## Command line

```text
opf from-md <deck.md|-> [output.opf.json|-] [--split <rules|headings>] [--title <text>] [--force] [--strict]
opf to-md <deck.opf.json|-> [output.md|-] [--drop-unsupported] [--force] [--strict]
```

Both write to stdout by default and print a JSON report (on stderr when stdout carries the document). Exit codes follow the other commands: 0 success, 1 invalid content, an output conflict or `--strict` failure, 2 usage, JSON or I/O error. `from-md` exits 1 with `markdown.diagnostics` (line and column) on a Markdown or OPF error, and writes nothing; `--strict` also fails on warnings. `to-md --strict` fails when anything had to be embedded or dropped, which keeps a deck inside the plain dialect.

## Decisions and limits

These choices are the defaults of the module and can be changed.

- **A dialect, not all of Markdown.** The block and inline syntax is the subset above with CommonMark's rules where they overlap. Setext headings, indented code, nested block quotes, raw HTML, reference links, footnotes and task lists are not part of it. Text the writer produces is escaped so it reads back as text.
- **One YAML reader.** Front matter and the `opf-slide` and `opf-block` fences use the `yaml` package (ISC, no dependencies, YAML 1.2 core schema: `2026-10-01` and `yes` stay strings). Metric blocks, timelines and chart CSV have small readers of their own because hand-written values such as `unit: %` are not valid YAML.
- **Slide options live in HTML comments**, so any other Markdown viewer shows the slide content and ignores them.
- **The pptx.dev Markdown view** targets the pre-v1 `elements` model: it starts a slide at each `##` heading and writes `{id=...}` attribute lines. This module keeps its front matter and its escape-hatch fences (`opf-slide`, `opf-block`) and replaces the rest, because the v1 slide is a title, a subtitle and content that maps one-to-one onto `#`, `##` and blocks.
- **Templates.** A [template](templates-and-variables.md) is an ordinary deck here: `template: true` and `variables` are front matter, and placeholders such as `{{client}}` and `var:logo` fields are plain text. Convert, then fill with `opf fill`.
- **Not yet in the dialect.** Numbered lists (until the spec has them, RR-33: `1.` markers read as bullets with a warning), footnotes, citations and captions (RR-34), video with a description, and per-slide `design`, `composition` and nested groups (all of these embed as YAML and round trip).
