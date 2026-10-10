# The `opf` CLI

The CLI (`@openpresentation/cli`, binary `opf`, Node 22 or later; verified on Node 24) creates, checks, edits, converts and
inspects decks (see [its README](../packages/cli/README.md)). `opf validate` is the one checker ([validate](validate.md)).
`opf convert` is the one command that changes formats: a deck form, PDF, PPTX, PNG and SVG. Every command runs core's
functions, the ones applications call from [`@openpresentation/opf`](node.md); the commands add the flags, the JSON report and
the exit codes.

Everything is deterministic and local: no network, no model, no telemetry, no system fonts. The same document, options and
installed package versions give the same bytes on every operating system.

## Commands

| Command | What it does |
| --- | --- |
| `opf create [output] [--title <text> \| --example <slug>]` | A one-slide starter deck, or one of core's bundled examples (`opf catalog examples` lists them). |
| `opf validate <file\|dir\|->...` | The one checker: format, references, policy, accessibility, layout, content. Several files, folders and stdin in one run; `--format json\|text\|github`. |
| `opf convert <input> <output>` | Any change of format: `.json`, `.opf.yaml`, `.opf.md` (and a plain `.md` input), `.pptx`, `.pdf`, `.png`, `.svg`, `.zip`, or stdin and stdout. |
| `opf edit <file> [output] --patch <patch>` | A JSON Patch, applied whole or not at all, the result checked. |
| `opf format <file>... [output]` | Canonical key order and layout, in the form the file has. |
| `opf diff <a> <b>` | What changed between two decks (`--format text\|json\|patch`). |
| `opf merge <base> <ours> <theirs> [output]` | A three-way merge; conflicts are listed. |
| `opf stats <file>` | Neutral facts about a deck (`--format json\|text`). |
| `opf paginate <input> [output]` | Overflowing slides split into continuation slides, measured with the renderer's fonts when it is installed. |
| `opf embed <input> [output]` | The catalog records a deck references, copied into it. |
| `opf fill <template> <data> [output]` | A template's variables filled: one deck per record (the output is a name pattern), or `--combine`. The second argument is always the data (`-` for stdin). |
| `opf ingest <data> [output] --as table\|chart` | CSV, TSV or JSON rows as a table or chart slide, alone or added `--into` a deck. |
| `opf doctor [deck]` | Which formats this install can write, and the one command that installs what is missing. |
| `opf schemas`, `opf schema [name] [pointer]` | The OPF schemas. |
| `opf catalogs`, `opf catalog <kind> [id]`, `opf catalog examples [slug]` | The default catalog and the bundled example decks. |
| `opf skills <install\|update\|status>` | The six bundled agent skills. |

`opf <command> --help` (or `-h`, or `opf help <command>`) prints a command's flags and examples.

Removed in 0.18 (each is a usage error, exit 2, that names its replacement): `opf render`, `opf export`, `opf import`,
`opf from-md`, `opf to-md`, `opf from-yaml` and `opf to-yaml` (all `opf convert`), `opf create --from` (`opf convert`), and the
flags `--output`, `--out`, `--out-dir` and `--name` (a positional output), `--input-format` (`--from`), `--json` (reports are
JSON), `--dry-run` (stdout), `--data` (fill's second argument) and the deck values of `--format` (`--to`).

## One output convention

Every command that writes a deck takes the same arguments:

| Form | Meaning |
| --- | --- |
| `opf embed deck.opf.json` | No output: the deck goes to stdout, the report to stderr. `-` says the same. |
| `opf embed deck.opf.json out.opf.json` | An output after the inputs: written atomically (a temporary sibling, then a rename); an existing file needs `--force`. |
| `opf embed deck.opf.json -i` | `-i` (`--in-place`) rewrites the input, refusing if it changed since it was read. Not for stdin, and not with an output. |
| `opf embed deck.opf.json --check` | Writes nothing and exits 1 when the command would change something: `format --check` (not canonical), `embed --check` (not self-contained) and `paginate --check` (a slide overflows). |

The form written is the output's extension (`.json`, `.opf.yaml`/`.yml`, `.opf.md`), else `--to json|yaml|md`, else the form
that was read. An existing output is refused before anything is printed or written.

`opf fill` writes one deck per record through a file name pattern: `{n}` is the record number, `{column}` a slug of that
column's value (`opf fill t.opf.md clients.csv decks/qbr-{client}.opf.md`); `--combine` writes one deck with every record's slides.

## What each flag means

| Flag | Meaning |
| --- | --- |
| `--format json\|text\|github\|patch` | The report format only: `json` (the default), `text`, `github` (validate's workflow annotations) or `patch` (diff's JSON Patch). |
| `--from json\|yaml\|md` | The form of a deck input: stdin, and names that say none. Without it, a name ending `.json`, `.opf.yaml`, `.yaml`, `.yml` or `.opf.md` says the form, and text that starts with `{` or `[` is JSON; anything else is a usage error that asks for `--from yaml\|md`. `opf convert` also takes `--from pptx`. |
| `--to json\|yaml\|md` | The form of a deck output, for stdout and names that say none. `opf convert` also takes `pdf`, `pptx`, `png`, `svg` and `zip`. A `--to` that disagrees with the output's extension is refused. |
| `--data-format csv\|tsv\|json` | The form of the data of `opf fill` and `opf ingest` (default: the extension, else JSON when it starts with `{` or `[`, else CSV). |
| `--fail-on error\|warning\|info` | Findings at or above this severity fail the command (exit 1) and nothing is written (default `error`). |
| `--force` | Replace an existing output. |

## Install

Deck forms (JSON, YAML, Markdown) need nothing beyond the CLI. PDF, PNG and SVG need `@openpresentation/opf-render`; PPTX output
and `.pptx` input also need `@openpresentation/opf-pptx`. Both are **optional peer dependencies** of the CLI and of core (decision
RR-27, below), loaded the first time a command needs them, from beside the CLI first and from the working directory second.

`opf doctor` says what this install can write and prints the one command that installs the rest:

```sh
opf doctor --format text          # per format: ready, or what is missing; then one install command
opf doctor deck.opf.md            # JSON; with a deck, a PDF needs sharp only when the deck has pictures
```

The command matches the package manager that runs the CLI (`npm_config_user_agent`: npm, pnpm, yarn or bun) and the way the CLI
is installed: global (`npm install -g ...`), a project (`npm install ...`), or one npx run (`npx -p @openpresentation/cli -p ... opf <command>`).
A conversion that misses a peer exits 2 with `code: "peer-not-installed"` (or `peer-too-old`), and its `install` field and message
carry that one command for the format asked for. What each output needs beside `@openpresentation/opf-render`:

| Output | Also install |
| --- | --- |
| every drawn format (the office font pack) | `@expo-google-fonts/roboto@0.4.3 @expo-google-fonts/roboto-mono@0.4.2 @expo-google-fonts/caladea@0.4.2 @expo-google-fonts/arimo@0.4.3 @expo-google-fonts/tinos@0.4.2 @expo-google-fonts/cousine@0.4.3 @expo-google-fonts/gelasio@0.4.1 @expo-google-fonts/noto-sans@0.4.2` |
| `png` | `@resvg/resvg-js@^2.6.2 sharp@^0.35.5` |
| `pdf` | nothing for text in the default vector mode; `pdf-lib@^1.17.1` for `--raster`; `sharp@^0.35.5` when the deck has pictures |
| `svg` | the fonts only |
| `pptx`, a `.pptx` input | `@openpresentation/opf-pptx` |

## From code

The engine the commands run is core's `@openpresentation/opf` in Node, which an application imports instead of spawning `opf`.
In Node, `validate`, `stats`, `paginate`, `embed` and `edit` register the default catalog when a call names none, as the commands
do, so `opf validate deck` and `validate(deck)` agree:

```ts
import * as opf from "@openpresentation/opf";

await opf.convert("deck.opf.md", "deck.pdf");                         // opf convert deck.opf.md deck.pdf
const { files } = await opf.convert(deck, { format: "png", scale: 2 }); // bytes, nothing written
const deck = await opf.open("deck.pptx");                             // opf convert deck.pptx -
const { presentation } = opf.edit(deck, patch);                       // opf edit deck --patch patch.json
const { decks } = opf.fill(template, csvText);                        // opf fill template data.csv out-{n}.opf.json
```

The options are the flags in camel case (`--raster` is `raster: true`, `--fonts` is `fonts` (a folder or a list of folders),
`--asset-dir` is `assetDir`, `--include-hidden` is `includeHidden`). The commands refuse an existing output without `--force`;
`convert` replaces it unless `overwrite: false`. See [OPF files in Node](node.md).

## `opf convert`

```sh
opf convert deck.opf.md deck.pdf
opf convert deck.opf.md slides/deck.png --slides 1,3-5 --scale 2   # slides/deck-001.png, -003, -004, -005
opf convert deck.opf.md slides.zip --to svg
opf convert deck.pptx deck.opf.md --signals signals.json
opf convert outline.md deck.opf.yaml                                 # a plain .md input is OPF Markdown
opf convert deck.opf.json deck.opf.yaml --schema-comment
opf convert deck.opf.md - --to pdf > deck.pdf
```

| Output | Written as |
| --- | --- |
| `.pdf`, `.pptx` | one file |
| `.png`, `.svg` | one file per slide beside the output, named after it: `slides/deck.png` writes `slides/deck-001.png`, `-002`, ... (the deck's slide numbers). One selected slide, or a one-slide deck, is written to the output itself. The extension is the format: `deck.png` is always PNG. |
| `.zip` | one archive of the slides, named as above inside it: PNG, or SVG with `--to svg`. Entries are stored with a fixed timestamp, so the archive is byte-identical everywhere. |
| `.json`, `.opf.yaml`, `.yml`, `.opf.md` | the deck in that form |
| `-` | stdout, with `--to`: one file (`pdf`, `pptx`, `zip`, a deck form, or one slide as `png` or `svg`) |

A flag applies only when its format is involved; anywhere else it is a usage error (exit 2, `option-not-applicable`):

| Involved | Flags |
| --- | --- |
| a Markdown input | `--split auto\|rules\|headings` (default `auto`: slides at `---` lines, and an outline with none at its `#` headings), `--title <text>` (the deck name unless the front matter sets one) |
| a YAML input | `--aliases` (expand anchors, aliases and merge keys, at most 100) |
| a `.pptx` input | `--signals <file>` (also write the raw per-shape layout and style signals, `fromPptx` with `signals: true`) |
| a YAML output | `--schema-comment` (the `# yaml-language-server: $schema=...` line) |
| a Markdown output | `--drop-unsupported` (leave out what the dialect has no syntax for and list it as loss, instead of embedding it as YAML in a fence) |
| pdf, png, svg | `--slides 1,3-5` (one-based; `2-` to the end), `--include-hidden` |
| pdf, png, svg, pptx | `--paginate`, `--date YYYY-MM-DD`, `--fonts <dir>` (repeatable), `--asset-dir <dir>` |
| png, raster pdf | `--scale 0.1-8` (1 draws the 1280 x 720 reference slide at 1280 x 720 pixels) |
| pdf | `--raster` (each page a picture instead of selectable vector text) |
| svg | `--text fonts\|system\|paths` (embed the faces the slide uses, none, or draw glyph outlines) |
| pptx | `--charts auto\|native\|picture`, `--images compatible\|preserve`, `--provenance full\|references-only\|none` |

A `.pptx` input is imported, checked and then written or drawn; `findings` holds both steps (`import/` rules from the importer).
Per-slide images and the PDF skip slides marked `hidden: true` unless `--include-hidden`; slides named with `--slides` are always
written, and the report lists the slides left out in `skippedHidden`. The PPTX keeps a hidden slide as a hidden slide.

## The other commands

- **`opf create`** writes a starter deck (`--title`) or a bundled example (`--example <slug>`, from `opf catalog examples`).
- **`opf validate`** checks files, folders (their `*.opf.json`, `*.opf.yaml`, `*.opf.yml` and `*.opf.md`, sorted, skipping
  `node_modules` and dot folders) and `-`. One input prints its report; several print `{ command, ok, files: [reports], counts }`.
  The exit status is the worst over every file. `--format github` prints `::error`, `::warning` and `::notice` annotations with the
  file, line and column. See [validate](validate.md).
- **`opf paginate`** measures the page breaks with the fonts `opf convert --paginate` draws with when `@openpresentation/opf-render`
  is installed (`layout: "measured"`); without it they are estimated (`layout: "estimated"`) and `hint` names the install command.
- **`opf fill`** reads CSV, TSV or JSON data; a blank cell keeps the variable's declared value; an unfilled required variable fails
  unless `--partial`; `--examples` fills from the declared examples. The second argument is always the data, whatever its name
  (`-` reads it from stdin), and the third is the output; a template alone fills from its own values, to stdout.
- **`opf ingest`** gives the same slide id and bytes for the same inputs; `--dataset <id>` stores the rows in the deck's datasets.

## Reports and errors

Every command that reports prints one envelope:

```json
{ "command": "convert", "ok": true, "input": { "file": "/abs/deck.opf.md", "sha256": "…", "bytes": 1234 },
  "outputs": [{ "file": "/abs/deck.pdf", "sha256": "…", "bytes": 56789, "mediaType": "application/pdf" }],
  "findings": [], "counts": { "error": 0, "warning": 0, "info": 0 }, "format": "pdf", "…": "…" }
```

`input` is `null` when nothing was read and a list when several were (diff, merge, fill). The report is on stdout, or on stderr when
stdout carries the document. Findings have the [`opf validate`](validate.md) shape (`ruleId`, `severity`, `category`, JSON Pointer
`path`, `message`, `help`, and `location` when read from text); engine findings carry the prefix `render/`, `pptx/`, `pdf/`,
`fonts/`, `import/` or `cli/`. The lookup commands (`schemas`, `schema`, `catalogs`, `catalog`, `--version`) print the data asked for.

Errors are `{ command, ok: false, code, error, ... }` on stderr. The message states the fix: a missing argument names it and
prints the usage, an unknown command, option or value suggests the nearest one ("Did you mean --check?"), and a removed command
or flag names its replacement. Codes include `usage`, `unknown-command`, `unknown-option`, `removed-command`, `removed-option`,
`missing-argument`, `extra-argument`, `missing-value`, `invalid-value`, `option-not-applicable`, `unknown-input-format`,
`input-not-found`, `invalid-json`, `invalid-yaml`, `invalid-markdown`, `invalid-document`, `findings-at-fail-on`,
`output-exists`, `merge-conflict`, `fill-failed`, `peer-not-installed` and `peer-too-old`.

Exit `0`: success (warnings allowed). Exit `1`: an invalid document, a finding at or above `--fail-on`, an existing output, a
merge conflict, or a `--check` that found a change. Exit `2`: usage, a read or I/O problem, text that is not valid JSON, YAML or
Markdown, or a missing or too-old peer. (`opf validate` reports text that does not parse as a finding, exit 1.)

## Fonts

The renderer's bundled open font pack (the office pack: Carlito, Intos for Aptos, the open families font schemes select and the
open replacements the font policy routes proprietary families to) with the visual substitution policy, plus the files from
`--fonts`. **System fonts are never loaded**, and nothing is downloaded. Font substitutions are listed under
`fonts.substitutions` in the report. The PPTX keeps the font names the document chose.

Scripts beyond Latin, Greek and Cyrillic need the optional Noto script packages of the renderer (`@expo-google-fonts/noto-sans-jp`
and so on); install the ones named in the `fonts/script-font-not-installed` diagnostic next to the CLI. A standalone SVG
(`--text fonts`, the default) embeds the faces its text uses; `--text system` omits all font bytes; `--text paths` draws the text
as glyph outlines (the real text kept invisible beside it for selection and search), so the SVG needs no font.

## Images and assets

Relative image paths and `file:` paths resolve against the input's folder (or `--asset-dir`). Only `.png`, `.jpg`, `.jpeg`,
`.gif`, `.webp` and `.svg` files whose content matches are read, and only inside that folder (symlinks are resolved first). URLs
are never fetched. For SVG and PNG an unreadable image draws the renderer's placeholder with an `unresolved-asset` or
`cli/asset-blocked` warning; for PPTX an unreadable or blocked local path stops the export (`pptx/asset-unresolved`), and an
unresolved remote URL becomes an unavailable-image placeholder with a `pptx/unresolved-asset` warning. Use `--fail-on warning` to
reject that output before any file is written.

## Markdown and YAML

JSON stays the canonical form of a deck. YAML (`deck.opf.yaml`) and Markdown (`deck.opf.md`) are authoring forms of the same data,
and every command that reads or writes a deck reads and writes all three:

```sh
opf convert deck.md deck.opf.json                      # Markdown in the OPF dialect (or an outline) to a deck
opf convert deck.opf.json deck.opf.md                  # a deck as Markdown that reads back unchanged
opf convert deck.opf.yaml deck.opf.json --aliases      # strict YAML (--aliases expands anchors)
opf validate deck.opf.yaml deck.opf.md                 # every command reads .yaml, .yml and .opf.md
opf edit deck.opf.md --patch changes.json -i           # the file stays Markdown
opf format deck.opf.md --check                         # canonical Markdown
opf validate - --from yaml < deck.txt                  # stdin and other names: --from
```

See [Markdown and outlines](markdown.md) and [OPF as YAML](yaml.md). A syntax error exits 2 with the line and column (`opf
validate` reports it as a `yaml/<rule>` or `markdown/<rule>` finding and exits 1); a command that rewrites a YAML file does not
keep its comments and says so on stderr, and one that has to put content into an `opf-slide`/`opf-block` fence says so too.

## Runtime choices

- **Peers, not bundled.** opf-render and opf-pptx are optional peer dependencies loaded lazily. opf-pptx pulls the native `sharp`
  engine, opf-render `resvg`, `fontkit` and the font packs (about 135 MB installed); bundling them would make the small CLI
  impossible to install offline or on a locked-down agent host, and validating or editing a deck would pay for it.
- **JSON reports.** `--format text` gives human-readable output where a command has it; `--format github` gives CI annotations.
- **No clock.** `--date` is explicit so a rerun tomorrow gives the same bytes.
- **Fonts are the bundled pack plus `--fonts`.** Never system fonts (owner font policy).
- **Stored zip entries.** Deflate output differs between zlib builds, which would make archive hashes host-dependent.

## Catalog names

`opf catalogs` lists canonical camelCase names such as `colorSchemes` and `fontSchemes`, and `examples`. `opf catalog` also
accepts the website-style `color-schemes`, `font-schemes` and `chart-types` spellings.
