# OPF as YAML

`@openpresentation/opf/yaml` (RR-56) reads and writes an OPF deck as YAML, in both directions, with no renderer, fonts, network or model: the same input always gives the same output. The CLI exposes it as `opf from-yaml` and `opf to-yaml`, and every command that reads or writes a deck understands `.opf.yaml` files (and, the same way, [`.opf.md` Markdown decks](markdown.md#markdown-decks-in-every-command)); `parse` and `stringify` read and write a deck in JSON, YAML or Markdown with one call, and `open` and `save` of `@openpresentation/opf` read and write the files in Node.

- **JSON stays canonical.** The schema, the interchange form and every package describe the JSON. A `.opf.yaml` file is an authoring serialization of the same data: the parsed YAML is exactly the JSON document, and the [schema](../spec/schemas/opf.schema.json) validates that parsed data.
- **Write a deck by hand.** YAML has no braces, no quotes around keys and no trailing-comma errors, and a block scalar (`text: |`) keeps a paragraph readable. Comments are allowed in the file (they are not data).
- **One strict dialect.** JSON-compatible YAML 1.2, core schema. Anything that could mean something else in another reader, or cannot exist in JSON, is an error with a line and a column.
- **Round trip.** `toYaml` writes canonical text that `fromYaml` reads back to the same deck, and that converts back to itself byte for byte. Every one of the 127 example decks round-trips, JSON to YAML to JSON and YAML to JSON to YAML.
- **Errors have places.** Findings use the shared Finding format of [validate](validate.md) and carry the source offset, length, line and column of the YAML that caused them, including the OPF findings mapped back to the YAML of the field they name.

```js
import { fromYaml, toYaml } from "@openpresentation/opf/yaml";

const { presentation, valid, findings } = fromYaml(text);
const { yaml } = toYaml(presentation, { schemaComment: true });
```

```sh
opf from-yaml deck.opf.yaml deck.opf.json
opf to-yaml deck.opf.json deck.opf.yaml --schema-comment
opf validate deck.opf.yaml
opf render deck.opf.yaml --out slides
```

## An example

```yaml
# yaml-language-server: $schema=https://openpresentation.org/schema/opf/v1
$schema: https://openpresentation.org/schema/opf/v1
name: Q3 Business Review
language: en-US
slides:
  - id: cover
    title: Q3 Business Review
    subtitle: Operations and growth
    notes: Two minutes on the agenda, then straight into the numbers.
  - title: Revenue grew every quarter
    blocks:
      - chart:
          type: column
          data:
            columns:
              - Quarter
              - Revenue
            rows:
              - - Q1
                - 12
              - - Q2
                - 18
      - quote:
          text: We would rather spend a week on capacity than a month on an outage.
          attribution: Priya Raman, Head of Platform
```

is the same deck as the JSON it converts to: `name`, `language` and `slides` with the values above. A comment and the first line are not data.

## The dialect

`fromYaml` accepts exactly this, and nothing else:

| Rule | What happens otherwise |
| --- | --- |
| One document, with a mapping at the root | `yaml/empty` (nothing, or only comments), `yaml/multiple-documents` (a `---` separates two), `yaml/not-mapping` (a list or a bare value) |
| YAML 1.2 core schema | `2026-10-01`, `yes`, `no`, `on`, `off` and `1_000` stay **strings**: only `true`/`false`, `null`/`~` and numbers (decimal, `0x1F`, `0o17`, exponents) are typed. Quote a value to force text |
| No duplicate keys | `yaml/duplicate-key`, at the repeated key |
| Keys are strings | `yaml/key` for `1:`, `true:`, `null:` or a collection used as a key. Quote it: `"1":` |
| No custom tags | `yaml/tag` for `!custom`, `!!binary`, `!!set` and the like. The core tags `!!str`, `!!int`, `!!float`, `!!bool`, `!!null`, `!!map` and `!!seq` are allowed |
| Finite numbers only | `yaml/number` for `.inf`, `-.inf` and `.nan`, with the hint to quote them |
| No anchors, aliases or merge keys | `yaml/alias`, with help that points at `aliases: true` |
| Syntax | `yaml/syntax` for anything the parser rejects, at the position it reports |

A leading byte order mark and CRLF line endings are accepted. Offsets are UTF-16 units into the text you passed (a BOM counts as one); lines and columns are one-based and ignore the BOM. After the YAML parses, the deck goes through `validate` and each finding (`opf/...` rule ids) is located at the YAML node of the field it names: the value for a scalar, the key through the value for a mapping or a list, and the nearest existing ancestor for something that is missing.

### `aliases: true`

Anchors (`&name`), aliases (`*name`) and the `<<` merge key are valid YAML and handy for repeated values, but they are not JSON, many tools handle them differently, and an alias hides the size of what it expands to. They are refused by default. `fromYaml(text, { aliases: true })` (CLI: `opf from-yaml --aliases`) expands them to plain data:

```yaml
slides:
  - title: One
    extensions:
      owner: &owner { team: ops, oncall: true }
  - title: Two
    extensions:
      owner: *owner
      other:
        <<: *owner
        extra: 1
```

The expansion is capped by the `yaml` package's `maxAliasCount` (100; each alias counts the nodes it expands to, so nested aliases that multiply exponentially are refused with `yaml/alias-limit`), and an alias that sits inside its own anchor is `yaml/alias-cycle`. What comes out is always finite, tree-shaped JSON data, and keys, tags and numbers are checked exactly as without the option. Writing never produces anchors or aliases.

## Writing OPF as YAML

`toYaml(presentation, { schemaComment })` first validates the presentation (`OPFYamlError`, `code: "invalid-document"`, when it is not valid OPF), then writes the canonical form:

- keys in the order of the schema (the same order as [`opf format`](../packages/cli/README.md)): `$schema`, `name`, ..., `slides`, `assets`, ..., with keys the schema does not declare after them in their own order;
- two-space indentation, block style throughout, no line folding (`lineWidth: 0`), a block scalar (`|`) for text with line breaks, one trailing newline, LF line endings;
- strings that would read as another type, or as another type in a YAML 1.1 reader, are quoted: `"yes"`, `"No"`, `"on"`, `"2026-10-01"`, `"123"`, `"null"`, `"0x1F"`, `"12:30"`, and any string with leading or trailing spaces, a `#` or `: `. Mapping keys such as `"yes":` follow the same rule;
- the text is **read back before it is returned**: it is parsed again in the strict dialect and compared with the input, key order included. If it does not read back to the same data, `toYaml` throws `OPFYamlError` with `code: "not-representable"` instead of writing something wrong (for example a lone surrogate in a string).

`schemaComment: true` starts the file with `# yaml-language-server: $schema=<url>`, the deck's own `$schema` or else the canonical `https://openpresentation.org/schema/opf/v1`.

### Editor autocomplete

Editors that use the YAML language server (VS Code with the Red Hat YAML extension, Neovim, Zed, JetBrains) read the modeline on the first line and validate and complete the file against the schema:

```yaml
# yaml-language-server: $schema=https://openpresentation.org/schema/opf/v1
```

`opf to-yaml --schema-comment` writes it. A command that rewrites a YAML file keeps the file's own first-line modeline verbatim (whatever URL it names, even a local schema path) and generates one only for `--schema-comment`. It is a comment: `fromYaml` ignores it.

## Other exports

These three exports are not part of the `fromYaml`/`toYaml` pair. They exist so the CLI and other tools can reuse the reader.

| Export | Purpose |
| --- | --- |
| `parseYamlData(yaml, options)` | The same strict dialect for any JSON-compatible root, for files that are not decks (a JSON Patch, a settings file). `{ value, valid, findings }` |
| `scanYamlComments(yaml)` | `{ count, modeline? }`: the comments a rewrite would lose, and the editor modeline (the first-line `# yaml-language-server:` comment, verbatim) |
| `YAML_SCHEMA_URL` | The canonical schema URL |

## Findings

`fromYaml(text, options)` never throws for malformed content. It returns the deck and the [validate](validate.md) report of it, `{ presentation, valid, findings, counts, schemaValid, checks }` (plus `template` and `unfilledVariables` for a deck with content variables), so a YAML file reports exactly what the same deck as JSON text does. `presentation` is a best effort when `valid` is false (an empty object after a YAML error). Each finding is a [Finding](finding-schema-reference.md) (`ruleId`, `severity`, `category`, `path`, `scope`, `message`, `help`) plus `location` (`offset`, `length`, `line`, `column`). Options: `validate` (`true`, the default, checks `format` and `references`; `validate` options pick other rules or categories, and `{}` runs every rule; `false` skips the check, so `schemaValid` is null) and `aliases` (default false).

YAML errors are `format` findings: `yaml/syntax`, `yaml/empty`, `yaml/not-mapping`, `yaml/multiple-documents`, `yaml/duplicate-key`, `yaml/key`, `yaml/tag`, `yaml/number`, `yaml/alias`, `yaml/alias-limit`, `yaml/alias-cycle`. After one, no OPF check runs (`schemaValid: null`). Ids starting `opf/` are the `validate` findings of the deck, located in the YAML.

## Command line

```text
opf from-yaml <deck.yaml|-> [output.opf.json|-] [--aliases] [--force] [--fail-on <level>]
opf to-yaml <deck.opf.json|-> [output.opf.yaml|-] [--schema-comment] [--force]
```

Both write to stdout by default and print a JSON report (on stderr when stdout carries the document), as `from-md` and `to-md` do. Exit codes: 0 success, 1 invalid content, an output conflict or a finding at or above `--fail-on`, 2 usage, a read error or I/O. `from-yaml` exits 1 with `yaml.findings` (line and column) on a YAML or OPF error and writes nothing; `--fail-on warning` also fails on warnings. `to-yaml` exits 1 for a deck that is not valid OPF.

### YAML everywhere

Every command that reads a deck or a JSON Patch reads YAML too, through one reader:

1. A file whose name ends `.yaml` or `.yml` is YAML, parsed in the strict dialect (no aliases). A name ending `.opf.md` is a [Markdown deck](markdown.md#markdown-decks-in-every-command), read the same way.
2. Anything else (stdin and every other name) follows the global option `--input-format <json|yaml|markdown>`, with **JSON as the default**. The option may appear anywhere before `--`; it applies to every input read from stdin or from a name that does not end `.yaml`, `.yml` or `.opf.md`.
3. A YAML syntax or dialect error exits **2**, like invalid JSON, and the message carries the position: `Invalid YAML in deck.opf.yaml at line 5, column 5: Map keys must be unique [yaml/duplicate-key]`, with the located findings under `yaml` in the JSON error report. `opf validate` instead reports a YAML error as a `yaml/<rule>` finding and exits 1, as it does for JSON that does not parse. A deck with a syntax-valid but invalid OPF structure is reported by the command as it is for JSON (`validate`, `render`, `export`...; `validate`, `render` and `export` locate their findings in the YAML).

A deck is written as YAML when the output name ends `.yaml`/`.yml` or `--format yaml` is given (`--format json` forces JSON, `--format markdown` writes a Markdown deck). When the output is stdout or has another name, the format of the deck that was read is used (a YAML deck is edited, merged, formatted, filled, paginated and bundled back to YAML); commands with no deck input (`create`, `from-md`, `import`) default to JSON. `opf format` canonicalizes a YAML file and converts with `--format`; `--check` works for both.

Left JSON-only on purpose: `validate --config` (a settings file), the `--data` values file of `fill` (CSV, TSV or JSON data, not a deck), the `ingest` source file, and `--signals` output. In `fill` and `ingest`, `--format csv|tsv|json` still names the data format; only `--format yaml` selects the output.

**Comments are not preserved.** A command that rewrites a YAML file (`edit`, `format`, `merge`, `paginate`, `bundle`, `fill`, `ingest --into`, `to-yaml`) writes the canonical text of the data, so comments and the original quoting and layout are lost. The CLI prints `warning: <file> has N comments; comments are not preserved when OPF rewrites a YAML file.` on stderr, and does not fail. The `# yaml-language-server:` line is kept.

## Decisions and limits

These choices are the defaults of the module and can be changed.

- **JSON stays canonical and the interchange form.** The schemas, the catalogs, the reports, the renderer, the editor and the PPTX converter all take the JSON document; YAML is converted at the edge, by `fromYaml` and `toYaml`, and `opf from-yaml` gives you the JSON. Nothing in OPF depends on a YAML library at run time except this subpath and the Markdown front matter.
- **Comments are not preserved by commands that rewrite.** The YAML is parsed to plain data and written again from the data, which is what makes the output canonical and the same deck always the same bytes. Preserving comments would need a lossless syntax tree through every edit and would make output depend on the history of the file. Use `opf from-yaml` / `opf to-yaml` or an editor to change a file that you annotate heavily, and keep the notes in `description`, `notes` or `extensions` when they should survive.
- **Strict by default.** Anchors, aliases, merge keys, custom tags, duplicate keys, non-string keys and non-finite numbers are where YAML readers disagree (YAML 1.1 and 1.2, `<<`, `on`/`yes`, sexagesimal numbers) or where a document stops being JSON. A deck should mean the same thing in every tool, so the reader accepts the intersection and says where the text leaves it. `aliases: true` opts into expansion for files that already use it.
- **pptx.dev's playground uses `aliases: true`** so that YAML pasted into it from other sources keeps working; the default of the module and of the CLI stays strict.
- **One YAML reader.** The `yaml` package (ISC, no dependencies) reads and writes, with the core schema. The [Markdown](markdown.md) front matter and the `opf-slide` and `opf-block` fences follow the same rules (JSON-compatible YAML 1.2 core schema: no anchors, tags or duplicate keys).
- **Block style only.** Tables and chart data are lists of lists, which block style spreads over many lines. The text is longer than the JSON but diffs line by line, and one style means one canonical form.
- **Quoting is conservative.** The core schema reads `yes` and `2026-10-01` as text, but a YAML 1.1 reader does not, so the writer quotes them anyway.
- **No new fields.** YAML adds nothing to the schema: there is no YAML-only key, and a file that does not validate as JSON does not validate as YAML.
