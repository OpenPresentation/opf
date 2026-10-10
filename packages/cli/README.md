# @openpresentation/cli

The `opf` command, for agents and people working with OPF presentations. Create decks, validate them, apply precise edits,
convert them between forms and formats (JSON, YAML, Markdown, PDF, PPTX, PNG, SVG), paginate content, embed the catalog records a
deck uses for offline use, fill templates, ingest data, and inspect the bundled schemas, the default catalog and the example
decks. Node 22 or later on macOS, Linux, or Windows is required.

The CLI depends on `@openpresentation/opf` (core), which holds the OPF schema, catalogs and validator and reads and writes the text
formats, and whose Node build reads and writes files; the CLI is the command over it. It needs no API key or network connection at
runtime. `opf --version` reports the CLI and the installed core versions. Validation and editing never render; successful validation
is not visual verification. PDF, PPTX, PNG and SVG use the optional peers `@openpresentation/opf-render` and
`@openpresentation/opf-pptx` (see [Drawing and PowerPoint](#drawing-and-powerpoint)); `opf doctor` says what is installed.

## Install

```sh
npm install -g @openpresentation/cli
opf --version
opf --help             # every command; opf <command> --help (or -h) for one
```

Or install it as a development dependency and use `npx --no-install opf`. [The compatibility matrix](../../docs/compatibility-matrix.md)
names the library releases that go with each CLI. Applications use core's functions instead of the command: see [From code](#from-code).

To verify the standalone package from source, run `pnpm install` and `pnpm test:cli:packed`. This creates
`artifacts/cli/openpresentation-cli-<version>.tgz` (with the core tarball it depends on), which can be installed using its absolute
path. For source development, run `pnpm --filter @openpresentation/cli build` and `node packages/cli/dist/index.js --help`.

## Install agent skills

```sh
npx @openpresentation/cli@latest skills install
npx @openpresentation/cli@latest skills status
npx @openpresentation/cli@latest skills update
```

The CLI installs all six bundled skill folders into the current project's `.agents/skills`, including references, examples and
inspection scripts. It requires no paid service, provider account or symlink privileges. Once the CLI is installed, these commands
work offline.

Use `--agent codex --global` for personal Codex skills, `--agent claude-code` or `--agent cursor` for those project skill
directories, or `--directory <path>` for another compatible agent. The default `universal` target uses `.agents/skills`; its global
target is `~/.agents/skills`. See [agent skill installation](https://github.com/OpenPresentation/opf/blob/main/docs/agent-skills.md)
for the complete target mapping and update behavior. The installer preserves AGENTS.md and unrelated configuration and refuses to
overwrite locally modified or unmanaged folders. `status` compares against the invoked CLI's bundled version without a network lookup.

## The conventions every command shares

- **One output convention.** A command that writes a deck takes an optional output after its inputs and writes stdout without one
  (`-` says the same). `-i` (`--in-place`) rewrites the input. `format`, `embed` and `paginate` take `--check`: write nothing,
  exit 1 when something would change. An existing output needs `--force`.
- **Fixed flag meanings.** `--format` is a report format only (`json`, `text`, `github` for validate, `patch` for diff). `--from` and
  `--to` name deck forms (`json`, `yaml`, `md`); a name ending `.json`, `.opf.yaml`, `.yml` or `.opf.md` says the form, stdin that
  starts with `{` or `[` is JSON, and anything else needs `--from`. `--data-format csv|tsv|json` names the data of `fill` and `ingest`.
- **One report.** `{ command, ok, input, outputs: [{ file, sha256, bytes, mediaType }], findings, counts, ... }`, on stdout, or on
  stderr when stdout carries the deck. Errors are `{ command, ok: false, code, error, ... }` on stderr, and the message states the
  fix (a missing argument, the nearest command or flag: "Did you mean --check?", a removed flag's replacement).
- **Exit codes.** `0` success, possibly with warnings. `1` an invalid document, a failed patch test, a finding at or above
  `--fail-on <error|warning|info>` (default `error`), an existing output, a merge conflict, or a `--check` that found a change.
  `2` usage, text that is not valid JSON, YAML or Markdown, I/O, or a missing optional peer.
- No telemetry, automatic uploads, or execution of instructions inside document text. Use `--` before file names that start with `-`.

## Create and validate

```sh
opf create decision.opf.json --title "Launch decision"
opf create brief.opf.md --example compliance-readiness-review      # opf catalog examples lists them
opf create - --title "Launch decision" | opf validate -
opf validate decision.opf.json
```

Creation supplies a minimal deck with one stable slide ID, `slide-1`; `--title` sets both deck name and visible slide title.
`--example <slug>` copies one of core's bundled example decks. To copy a deck into another form, use `opf convert`.

`opf validate` is the one checker. It reads each file as strict JSON text (or YAML, or a Markdown deck, by its name or `--from`) and
prints the report (`valid`, `schemaValid`, `findings`, `counts`, `checks`), the input's SHA-256 digest and the core version. Each
finding has a stable `opf/<rule>` id, a severity, a category (`format`, `references`, `policy`, `accessibility`, `layout`,
`content`), a JSON Pointer path, the source line and column, a hint and sometimes suggested fixes. Only format, references and
policy findings are errors by default, so `valid` keeps meaning "correct OPF".

```sh
opf validate deck.opf.json                                    # everything, JSON report
opf validate deck.opf.json --format text                      # one line per finding
opf validate decks/ --format github --fail-on warning         # every *.opf.* file in a folder, as CI annotations
opf validate a.opf.json b.opf.md -                            # several inputs: { command, ok, files, counts }
opf validate deck.opf.json --only format,references --ignore layout --config house-rules.json
opf validate --list-rules
```

A folder is searched for `*.opf.json`, `*.opf.yaml`, `*.opf.yml` and `*.opf.md` (sorted, skipping `node_modules` and dot folders).
The exit status is the worst over every file. `--only` and `--ignore` take comma-separated rule ids, bare names or category names,
and may be repeated. `--config` is an explicit local JSON file of `{ catalogs, contracts, severity, only, ignore, ignorePaths,
thresholds, chartPalette }`. Validation is read-only, fetches nothing and never rewrites the file. See [the validate guide](../../docs/validate.md).

## Convert

`opf convert <input> <output>` is every change of format, the formats named by the extensions or by `--from` and `--to`:

```sh
opf convert deck.opf.md deck.pdf
opf convert deck.opf.md slides/deck.png --slides 1,3-5 --scale 2   # slides/deck-001.png, -003, -004, -005
opf convert deck.pptx deck.opf.md --signals signals.json
opf convert outline.md deck.opf.yaml                                 # a plain .md input is OPF Markdown
opf convert deck.opf.json deck.opf.yaml --schema-comment
opf convert deck.opf.md - --to pdf > deck.pdf
```

Inputs: `.json`, `.opf.yaml`/`.yml`, `.opf.md` and a plain `.md`, `.pptx`, or `-`. Outputs: a deck form, `.pdf`, `.pptx`, `.png` or
`.svg` (one file per slide beside the output; one selected slide is written to the output itself), `.zip` (the slides as PNG, or
SVG with `--to svg`), or `-` with `--to`. A flag applies only where its format is involved, else it is a usage error: `--split` and
`--title` for a Markdown input, `--aliases` for YAML, `--signals` for a `.pptx` input, `--schema-comment` for a YAML output,
`--drop-unsupported` for a Markdown output, and `--slides`, `--include-hidden`, `--scale`, `--raster`, `--text`, `--charts`,
`--images`, `--provenance`, `--paginate`, `--date`, `--fonts` and `--asset-dir` for drawn and PowerPoint outputs. `opf convert --help`
lists which format each belongs to. Removed in 0.18: `render`, `export`, `import`, `from-md`, `to-md`, `from-yaml`, `to-yaml` and
`create --from`, all `opf convert` now. See [docs/cli.md](https://github.com/OpenPresentation/opf/blob/main/docs/cli.md).

## Edit with JSON Patch

Create `changes.json`:

```json
[
  { "op": "test", "path": "/slides/0/id", "value": "slide-1" },
  { "op": "replace", "path": "/slides/0/title", "value": "Approve the next milestone" },
  { "op": "add", "path": "/slides/-", "value": { "id": "next-steps", "title": "Next steps" } }
]
```

Preview the result, save a separate file, or update the source:

```sh
opf edit decision.opf.json --patch changes.json                      # stdout; nothing is written
opf edit decision.opf.json reviewed.opf.json --patch changes.json
opf edit decision.opf.json --patch changes.json -i --expect-sha256 "$EXPECTED_SHA256"
```

The editor implements [JSON Patch (RFC 6902)](https://www.rfc-editor.org/rfc/rfc6902): `add`, `remove`, `replace`, `move`, `copy`,
and `test`, applied whole or not at all; the patch is JSON or YAML. The result must pass the format and references check before it
is written, and the report carries `inverse`, the patch that undoes the edit. `--expect-sha256` takes the digest from an earlier
`opf validate` report and refuses an input that changed. Writes use a temporary sibling file and atomic publication; symlink and
non-regular destinations are rejected. There is no persistent undo history; use version control or save a separate output.

## Diff, merge and format

```sh
opf diff before.opf.json after.opf.json                 # readable report
opf diff before.opf.json after.opf.json --format patch  # JSON Patch from before to after
opf diff a.opf.json b.opf.json --exit-code              # exit 1 when they differ
opf merge base.opf.json ours.opf.json theirs.opf.json merged.opf.json
opf merge base.opf.json ours.opf.json theirs.opf.json -i --prefer theirs --report conflicts.json
opf format deck.opf.json -i
opf format --check decks/*.opf.json                     # CI: exit 1 if any file would change
```

`diff` matches slides by `id`, then identical content, then content similarity. `merge` combines two edits of a base; conflicts block
the write (exit 1) unless `--prefer ours|theirs` picks a side, and every conflict is reported. `format` rewrites a deck in canonical
key order and layout, keeping its form (`opf convert` changes forms); it is idempotent. See
[patch, diff, merge and format](../../docs/patch-diff-merge-format.md).

## Facts, pagination and embedding

```sh
opf stats deck.opf.json --format text --per-slide
opf paginate deck.opf.json paginated.opf.json
opf paginate deck.opf.json --check                      # CI: exit 1 when a slide overflows
opf embed deck.opf.json -i
opf embed deck.opf.json --check                         # CI: exit 1 when the deck is not self-contained
```

`stats` reports neutral facts (slides, sections, layouts, words, notes, images, charts, tables, datasets, citations, variables,
assets, fonts, an estimated speaking time) under `stats` in the report; it never validates, composes or rates anything. `paginate`
splits overflowing slides into continuation slides, measured with the fonts `opf convert` draws with when opf-render is installed
(`layout: "measured"`), else estimated (`layout: "estimated"`, with a `hint` that names the install command). `embed` copies every
catalog record the deck references, transitively, into it once, so the file renders the same with no catalog registered.

## Fill a template and ingest data

```sh
opf fill quarterly.opf.json globex.json globex.opf.json                  # one JSON object, one deck
opf fill quarterly.opf.md clients.csv decks/qbr-{client}.opf.md          # one deck per row, named by a column
opf fill quarterly.opf.json clients.csv all.opf.json --combine           # one deck, a slide group per row
opf fill quarterly.opf.json --examples > preview.opf.json               # no data: fill from each variable's example
export-rows | opf fill quarterly.opf.json - decks/deck-{n}.opf.json     # data from stdin
opf ingest revenue.csv table.opf.json --as table
opf ingest revenue.csv --as chart --category Quarter --series '["Revenue","Costs"]' --into decision.opf.json -i
```

`fill`'s second argument is always the data, whatever its name (`-` reads it from stdin), and the third is the output: a deck name,
or a file name pattern where `{n}` is the record number and `{column}` a slug of that column's value. A blank
cell keeps the declared value; an unfilled required variable fails unless `--partial`. `ingest` turns CSV, TSV or JSON rows into a
table or chart, alone or added `--into` a deck (`--path` replaces one); `--dataset <id>` stores the rows in the deck's datasets. The
same inputs give the same slide id and bytes. See [templates and variables](../../docs/templates-and-variables.md) and
[data import](../../docs/data-import.md).

## Discover format options

```sh
opf schemas
opf schema presentation '/$defs/Composition'
opf catalogs
opf catalog layouts
opf catalog fontSchemes roboto
opf catalog examples
```

They inspect the default catalog of the core the CLI runs on (the full pptx.gallery catalog) and the bundled example decks, and print
the data asked for. Nothing is fetched.

## Drawing and PowerPoint

PDF, PNG and SVG need `@openpresentation/opf-render`; PPTX output and a `.pptx` input also need `@openpresentation/opf-pptx`. They
are **optional peer dependencies**, loaded the first time a command needs them (beside the CLI first, then in the working
directory), so the CLI stays small. `opf doctor` reports, per format, whether this install can write it and prints the one command
that installs what is missing, for the package manager in use (npm, pnpm, yarn or bun) and the way the CLI is installed (global, a
project, or npx):

```sh
opf doctor --format text
opf doctor deck.opf.md          # with a deck: a PDF needs sharp only when it has pictures
```

A conversion that misses a peer exits 2 with `code: "peer-not-installed"` and that one command in `install`. Output is
deterministic: no network, no system fonts, no clock (`--date` supplies the date for `date: true` fields). Fonts are the renderer's
bundled open pack plus the `.ttf`/`.otf` files in each `--fonts` folder; relative images are read only from the input's folder
(`--asset-dir`); URLs are never fetched. Scripts beyond Latin, Greek and Cyrillic need the renderer's optional Noto script packages
(the report names them). The full reference is in [docs/cli.md](https://github.com/OpenPresentation/opf/blob/main/docs/cli.md).

## Markdown and YAML

JSON stays the canonical form of a deck; YAML (`deck.opf.yaml`) and Markdown (`deck.opf.md`) are authoring forms of the same data,
and every command that reads or writes a deck reads and writes all three. A syntax error exits 2 with `line:column` (`opf validate`
reports it as a finding, exit 1). A command that rewrites a YAML file does not keep its comments, and one that has to put content
into an `opf-slide`/`opf-block` fence, says so on stderr. See the [Markdown guide](../../docs/markdown.md) and the [YAML guide](../../docs/yaml.md).

## From code

The CLI is the command. An application calls core's `@openpresentation/opf` instead, the functions the commands run, so the command
and the code give the same result. In Node, `validate`, `stats`, `paginate`, `embed` and `edit` register the default catalog when a
call names none, as the commands do:

```ts
import * as opf from "@openpresentation/opf";

await opf.convert("deck.opf.md", "deck.pdf");
const deck = await opf.open("deck.opf.md");
const { presentation } = opf.edit(deck, [{ op: "replace", path: "/name", value: "Q4" }]);
await opf.save(presentation, "deck.opf.md");
const { decks } = opf.fill(template, csvText);
```

See [OPF files in Node](https://github.com/OpenPresentation/opf/blob/main/docs/node.md) for the options and the errors.

## Development checks

`pnpm test:cli` runs the command tests (`test/*.test.mjs` and `test/cli.mjs`), including `test/files.mjs` for drawing and
PowerPoint against the published opf-render and opf-pptx (set `UPDATE_GOLDEN=1` to refresh the pinned SVG digests after a renderer
or core bump). `pnpm test:cli:packed:peers` installs the packed CLI with both peers and repeats those checks against the installed
binary. `pnpm test:cli:packed` packs the CLI, installs the tarball and the core tarball it depends on into an isolated global prefix,
exercises the executable, asserts that the installation holds one core, and reruns `test/cli.mjs` against it. Rebuild the CLI after
a core change; the workspace links the CLI to the core in `packages/javascript`.
