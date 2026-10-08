# @openpresentation/cli

A local CLI for agents and people working with `.opf.json` presentations. Create documents, validate them, apply precise edits, paginate content, embed the catalog records a deck uses for offline use (`opf embed`), inspect the bundled schemas and the default catalog, and render, export (PPTX, PDF, PNG, SVG) and import (PPTX) files. Node 22 or later on macOS, Linux, or Windows is required (`engines.node` `>=22` from the release after 0.10.0; 0.10.0 and earlier 24.x-only releases make npm on Node 22 or 26 silently install the 0.7.0 CLI, which has no `export` or `render` command).

The CLI bundles its OPF schema, catalogs, and validator. It needs no separate core package, API key, or network connection at runtime. `opf --version` reports the CLI and bundled core versions. Validation and editing never render; successful validation is not visual verification. `opf render`, `opf export` and `opf import` use the optional peers `@openpresentation/opf-render` and `@openpresentation/opf-pptx` (see [Render, export and import](#render-export-and-import)).

## Install

The CLI is published on npm. Install the current release:

```sh
npm install -g @openpresentation/cli
opf --version
```

Or install it as a development dependency and use `npx --no-install opf`. CLI 0.11.0 bundles OPF 0.13.0 (chart and table data: number formats, datasets and `chart.mapping`; plus templates and variables, numbered lists, footnotes and captions, chart options, the 0.01 pt font grid, the design fields, the 100-layout catalog and the pinned gallery default catalog), including the reference layer (`variables`, ColorRef, payload ids, and the command then named `opf bundle`, which is `opf embed` from OPF 0.15), complete code and quote composition, source-preserving pagination and readability floors, styled/merged table cells, shared headers/footers, `opf lint`, and the six OPF agent skills. Browser rendering and editable PowerPoint export require the coordinated library releases documented in [the compatibility matrix](../../docs/compatibility-matrix.md).

To verify the standalone package from source, run `pnpm install` and `pnpm test:cli:packed`. This creates `artifacts/cli/openpresentation-cli-0.11.0.tgz`, which can be installed using its absolute path. For source development, run `pnpm --filter @openpresentation/cli build` and `node packages/cli/dist/index.js --help`.

## Install agent skills

```sh
npx @openpresentation/cli@latest skills install
npx @openpresentation/cli@latest skills status
npx @openpresentation/cli@latest skills update
```

CLI 0.5.0 and later install all six bundled skill folders into the current project's `.agents/skills`, including references, examples and inspection scripts. It requires no paid service, provider account or symlink privileges. Once the CLI is installed, these commands work offline.

Use `--agent codex --global` for personal Codex skills, `--agent claude-code` or `--agent cursor` for those project skill directories, or `--directory <path>` for another compatible agent. The default `universal` target uses `.agents/skills`; its global target is `~/.agents/skills`. See [agent skill installation](https://github.com/OpenPresentation/opf/blob/main/docs/agent-skills.md) for the complete target mapping and update behavior.

The installer preserves AGENTS.md and unrelated configuration. It checks all existing skills before making changes and refuses to overwrite locally modified or unmanaged folders, including manual copies. Repeating an unchanged install does nothing. Successful updates return backup paths outside the active skill directory. `status` compares against the invoked CLI's bundled version without a network lookup. Use the same target options for install, update and status.

## Create and validate

```sh
opf create decision.opf.json --title "Launch decision"
opf validate decision.opf.json
opf create copy.opf.json --from decision.opf.json
```

Creation supplies a minimal deck with one stable slide ID, `slide-1`. `--title` sets both deck name and visible slide title. `--from` accepts a complete OPF document and preserves its fields; use it to supply arbitrary content, assets, and design options. `--title` and `--from` cannot be combined.

Use `-` for stdin/stdout. Creation defaults to stdout if no destination is supplied:

```sh
opf create - --title "Launch decision" | opf validate -
opf create imported.opf.json --from - < authored.opf.json
```

`opf validate` is the one checker: it reads the file as strict JSON text (or as YAML for a name ending `.yaml`/`.yml` or `--input-format yaml`, or as a Markdown deck for a name ending `.opf.md` or `--input-format markdown`) and prints the report (`valid`, `schemaValid`, `findings`, `counts`, `checks`), the input's SHA-256 digest and the bundled core version. Each finding has a stable `opf/<rule>` id, a severity, a category (`format`, `references`, `policy`, `accessibility`, `layout`, `content`), a JSON Pointer path, the source line and column, a hint and sometimes suggested fixes. Only format, references and policy findings are errors by default, so `valid` keeps meaning "correct OPF"; accessibility, layout and content findings are warnings and info. A content reference that resolves nowhere is the warning `opf/unresolved-reference`; a `name:id` prefix that names no catalog group is the error `opf/undeclared-catalog`.

```sh
opf validate deck.opf.json                                    # everything, JSON report
opf validate deck.opf.json --format text                      # one line per finding
opf validate deck.opf.json --only format,references --fail-on warning
opf validate deck.opf.json --ignore layout --config house-rules.json
opf validate --list-rules
```

`--only` and `--ignore` take comma-separated rule ids (`opf/text-contrast`), bare names (`text-contrast`) or category names, and may be repeated. `--fail-on <error|warning|info>` picks the exit threshold (default `error`); it is the one way to say "fail on warnings" (`--fail-on warning`) on every command that checks a document. `--config` is an explicit local JSON file of `{ catalogs, contracts, severity, only, ignore, ignorePaths, thresholds, chartPalette }`: host policy and loaded catalog records, never read from the document, which can only carry data. Exit `0`: nothing at or above `--fail-on`. Exit `1`: findings at or above it, or text that is not valid JSON (an `opf/json-syntax` finding). Exit `2`: usage, configuration or I/O error. Validation is read-only, fetches nothing and never rewrites the file. See [the validate guide](../../docs/validate.md).

## Edit with JSON Patch

Create `changes.json`:

```json
[
  { "op": "test", "path": "/slides/0/id", "value": "slide-1" },
  { "op": "replace", "path": "/slides/0/title", "value": "Approve the next milestone" },
  { "op": "add", "path": "/slides/0/text", "value": "Describe the evidence and requested decision here." },
  { "op": "add", "path": "/slides/-", "value": { "id": "next-steps", "title": "Next steps" } }
]
```

Preview the result, save a separate file, or update the source:

```sh
opf edit decision.opf.json --patch changes.json --dry-run
opf edit decision.opf.json --patch changes.json --output reviewed.opf.json
opf edit decision.opf.json --patch changes.json --in-place
```

The editor implements [JSON Patch (RFC 6902)](https://www.rfc-editor.org/rfc/rfc6902): `add`, `remove`, `replace`, `move`, `copy`, and `test`. Paths are JSON Pointers: `~1` escapes `/`, `~0` escapes `~`, and the empty path addresses the whole document. `add` can insert into arrays or append with `-`; `replace` requires an existing target. It preserves unrelated fields and validates the complete result before writing. An invalid input document can be repaired as long as the final document validates. Failed operations or validation leave the file untouched.

With no destination, editing writes the resulting document to stdout. Either the source or patch can come from stdin, but not both. `--dry-run` always writes the candidate document to stdout without saving, even with `--in-place` or `--output`.

Use `test` to guard specific values. Resolve a slide ID to its current array index before constructing edits. For a whole-file guard, pass the digest from an earlier `opf validate` result:

```sh
opf edit decision.opf.json --patch changes.json --in-place --expect-sha256 "$EXPECTED_SHA256"
```

The digest compares the exact input bytes, including whitespace. The CLI also rechecks the input before replacing that same path. Writes use a temporary sibling file and atomic publication. Existing destinations require `--force`; `--in-place` explicitly authorizes replacing the input. Symlink and non-regular destinations are rejected. Coordinate concurrent writers externally: the hash check and rename are not a filesystem compare-and-swap or a collaboration lock. There is no persistent undo history; use version control or save a separate output when needed.

## Diff, merge and format

Added in CLI 0.10.0 (RR-31; not in 0.9.2 or earlier): check `opf --help`. These commands are local and deterministic. See [patch, diff, merge and format](../../docs/patch-diff-merge-format.md) for the matching rules, conflict objects and key order.

```sh
opf diff before.opf.json after.opf.json                 # readable report
opf diff before.opf.json after.opf.json --format patch  # JSON Patch from before to after
opf diff a.opf.json b.opf.json --exit-code              # exit 1 when they differ
opf merge base.opf.json ours.opf.json theirs.opf.json --output merged.opf.json
opf merge base.opf.json ours.opf.json theirs.opf.json --prefer theirs --report conflicts.json --output merged.opf.json
opf format deck.opf.json --in-place
opf format decks/*.opf.json --check                     # CI: exit 1 if any file would change (the shell expands the glob)
```

`diff` matches slides by `id`, then identical content, then content similarity, and reports additions, removals, moves and field, block, design and metadata changes; `--format json` adds the structured changes and `--format patch` prints only the patch, which `opf edit --patch` applies. `merge` combines two edits of a base: changes in different places merge, and conflicts are listed with the base, our and their values and **block the write** (exit 1, report on stderr) unless `--prefer ours|theirs` picks a side, in which case every conflict is still reported. The merged document is validated before it is written. `format` rewrites a file with canonical key order (the schema's property order), two-space indentation, LF endings (`--eol crlf|preserve`) and one trailing newline; it is idempotent and does not validate. `opf edit`, `diff` and `merge` share one RFC 6902 implementation with the editor.

## Facts about a deck

```sh
opf stats deck.opf.json                  # JSON
opf stats deck.opf.json --format text    # a readable block per topic
opf stats - --per-slide < deck.opf.json  # adds a row per slide
```

`opf stats <file|-> [--format <json|text>] [--per-slide]` reports neutral facts: slides, hidden slides and sections, layouts, payload kinds, words in content and in notes, notes coverage, images with and without alt text, charts, tables, datasets, citations, variables, assets, header and footer, fonts, colour variables and an estimated speaking time from the notes. It never validates, composes or loads fonts and never rates anything (no severities or thresholds), so it works on a deck that fails `opf validate`. Not a JSON document the other commands read: invalid JSON exits 2 and a JSON value that is not an object exits 1. See [the stats guide](../../docs/stats.md).

## Import CSV and JSON data

```sh
opf import-data revenue.csv --as table --output table.opf.json
opf import-data revenue.json --as chart --chart-type line --output chart.opf.json
opf import-data revenue.csv --as chart --category Quarter --series '["Revenue","Costs"]' --into decision.opf.json --in-place
```

Data can come from a file or stdin (`-`). JSON accepts arrays of records, row matrices, or `{columns, rows}`. `--path /slides/0/table` replaces or adds a table field inside an existing parent; use `/chart` for charts. With `--into` and no path, a new slide is appended. Other options include `--format csv|tsv|json`, `--delimiter`, `--no-header`, `--columns` (a JSON array), and `--title`. Preview on stdout by omitting an output destination. All file writes validate the complete document. CSV table strings are preserved; chart measures must be numeric (strict decimal syntax: `12%` or `$5` is rejected). `--dataset <id>` writes the data into the deck's top-level `datasets` map (replacing that dataset's columns and rows, keeping the format of each column whose name is unchanged, and recording the file as its `source`) and references it from the table or chart, so several tables and charts can share it. Data is embedded, not linked to the source file.

## Fill a template

A template is an OPF file with `"template": true` and variables (`{{id}}` tokens and `var:id` references, see [templates and variables](../../docs/templates-and-variables.md)). `opf fill` resolves them from data:

```sh
opf fill quarterly.opf.json --data globex.json --output globex.opf.json   # one JSON object, one deck
opf fill quarterly.opf.json --data clients.csv --out-dir decks --name "qbr-{client}"   # one deck per row
opf fill quarterly.opf.json --data clients.csv --combine --output all.opf.json        # one deck, a slide group per row
opf fill quarterly.opf.json --examples --output preview.opf.json                      # fill from each variable's example
```

CSV and TSV headers match variable ids and cells coerce per kind (numbers, ISO dates, newline-separated lists); JSON also carries rich text, lists and image objects. A blank cell keeps the declared value. An unfilled required variable or a value of the wrong kind exits 1 before any file is written; `--partial` allows unfilled variables and keeps their declarations for a later pass. `opf validate` accepts a template and reports its unfilled variables.

## Discover format options

```sh
opf schemas
opf schema presentation '/$defs/Composition'
opf catalogs
opf catalog layouts
opf catalog fontSchemes roboto
```

`schemas` and `catalogs` list available names/kinds. `schema` returns the whole schema or a branch addressed by a pointer into the schema. `catalog` returns the records in a kind, keyed by id, or one exact ID. They inspect the default catalog the CLI bundles (the full pptx.gallery catalog of its core) and do not fetch galleries.

```sh
opf paginate decision.opf.json paginated.opf.json
```

Pagination emits ordinary OPF slides and a page mapping. Preview the result with the renderer to assess wrapping and visual fidelity.

```sh
opf embed decision.opf.json embedded.opf.json
```

Embed copies every catalog record the document references — including transitive references such as a theme's color and font schemes — into the document, once, in the group it resolves in (`catalogs.default` for the default catalog, with its `source`), so the file renders the same with no catalog registered. Records already embedded are kept, and the report lists the added records and the references that resolve nowhere. Remote media and data assets (`https:` images, chart `data.src` URLs) are not inlined. Embedding twice is a no-op. Every CLI command registers the default catalog (the pinned pptx.gallery snapshot); a validate configuration's `catalogs` registers more, first.

## Agent output contract

- Reports and errors are JSON; only help text is plain text.
- `validate` reports to stdout, including for invalid documents.
- Commands emitting a document to stdout send their findings to stderr, so pipes remain valid JSON.
- File-writing commands report the absolute output path, output SHA-256, and `findings` (format and references only) to stdout.
- Exit `0`: success, possibly with warnings. Exit `1`: invalid document, failed patch/test, a finding at or above `--fail-on`, or file conflict. Exit `2`: usage, malformed JSON input to a command other than `validate`, or I/O failure.
- Commands that check a document before writing it take `--fail-on <error|warning|info>` (default `error`). Use `--` before positional filenames that start with `--`.
- No telemetry, automatic uploads, or execution of instructions inside document text.

## Markdown and outlines

`opf from-md <deck.md|-> [output.opf.json|output.opf.yaml|-] [--split <rules|headings>] [--title <text>] [--force] [--fail-on <level>]` converts Markdown in the OPF dialect (YAML front matter, `---` between slides, `#` title, lists, quotes, tables, `chart`, `metric` and `timeline` fences, `Note:` notes, `<!-- slide: ... -->` options) to a validated deck, and `opf to-md <deck.opf.json|-> [output.md|-] [--drop-unsupported] [--force] [--fail-on <level>]` writes a deck as that Markdown, which `from-md` reads back unchanged. Both print JSON reports and follow the exit codes above; Markdown findings carry `line` and `column`. Not in releases before the one that lists it in the changelog. See the [Markdown guide](../../docs/markdown.md).

### Markdown decks in every command

JSON stays the canonical form of a deck; YAML and Markdown are authoring forms of the same data, and every command that reads or writes a deck reads and writes all three. A file ending `.opf.md` (any case) is a Markdown deck: `opf validate deck.opf.md`, `opf render deck.opf.md`, `opf export deck.opf.md --format pptx`, `opf edit deck.opf.md --patch changes.json --in-place`, `opf format deck.opf.md` (canonical Markdown; `--check` works), `opf paginate`, `opf fill`, `opf merge`, `opf diff`, `opf stats`. Only `.opf.md` counts: a plain `.md` file is never taken for a deck. Stdin and other names are JSON unless `--input-format markdown` (alias `md`) says otherwise. A Markdown syntax error exits 2 with `line:column` in the message and located findings under `markdown` in the error report, except in `opf validate`, which reports it as a `markdown/<rule>` finding (exit 1); `validate`, `render` and `export` report their findings at Markdown lines. A deck is written as Markdown when the output name ends `.opf.md` or with `--format markdown` (`md`); without either, a command writes the format it read (`create`, `import` and `from-md` have no deck input and default to JSON), and a rewrite that has to put content into an `opf-slide`/`opf-block` fence prints a warning on stderr. `from-md` and `to-md` stay explicit conversions with any file names. See [Markdown decks in every command](../../docs/markdown.md#markdown-decks-in-every-command).
## OPF as YAML

A deck can be written as YAML (`deck.opf.yaml`) and every command that reads a deck or a JSON Patch reads it: a file ending `.yaml` or `.yml` is YAML (strict JSON-compatible YAML 1.2, no anchors, tags or duplicate keys); stdin and other names are JSON unless `--input-format yaml` (or `markdown`) says otherwise. A YAML syntax error exits 2 with the line and column in the message, like invalid JSON, except in `opf validate`, which reports it as a `yaml/<rule>` finding (exit 1); `validate`, `render` and `export` report their findings at YAML lines. A deck is written as YAML when the output name ends `.yaml`/`.yml` or with `--format yaml` (`create`, `edit`, `merge`, `format`, `paginate`, `embed`, `fill`, `import-data`, `from-md`, `import`); without either, a command writes the format it read, and JSON when it read none.

`opf from-yaml <deck.yaml|-> [output.opf.json|-] [--aliases] [--force] [--fail-on <level>]` converts YAML to a validated JSON deck (`--aliases` expands anchors, aliases and merge keys, capped at 100 aliases), and `opf to-yaml <deck.opf.json|-> [output.opf.yaml|-] [--schema-comment] [--force]` writes canonical YAML that `from-yaml` reads back unchanged; `--schema-comment` adds the `# yaml-language-server: $schema=...` line that gives editors validation and completion. Both print JSON reports and follow the exit codes above; YAML findings carry `line` and `column`. Commands that rewrite a YAML file do not preserve its comments and print a warning on stderr. Settings files (`--config`), `fill --data` and `import-data` sources stay JSON, CSV or TSV. See the [YAML guide](../../docs/yaml.md).

## Render, export and import

```sh
npm install -g @openpresentation/cli @openpresentation/opf-render @openpresentation/opf-pptx
opf render deck.opf.json --slides 1,3-5 --format png --scale 2 --out slides
opf export deck.opf.json --format pptx            # deck.pptx
opf export deck.opf.json --format pdf --pdf-mode vector
opf export deck.opf.json --format svg --out slides.zip
opf import deck.pptx --out deck.opf.json --signals signals.json
```

These commands write files; every other command only prints JSON. They check the document's format and references first and print the `opf validate` report (`findings`, `counts`, exit 1 on errors, or on findings at or above `--fail-on`, in which case nothing is written) plus an `outputs` list with each file's SHA-256. Output is deterministic: no network, no system fonts, no clock (`--date` supplies the date for `date: true` fields). Fonts are the renderer's bundled open pack plus the `.ttf`/`.otf` files in each `--font-dir`; relative images are read only from the document's folder (`--asset-dir`); URLs are never fetched. Existing outputs need `--force`.

opf-render and opf-pptx are **optional peer dependencies**, loaded the first time a command needs them (beside the CLI first, then in the working directory), so the CLI stays small and dependency-free; a missing peer, or one that lacks `loadFonts`, `renderSlideSvg` or the other names of its API, exits 2 (the declared range is `^0.15.0`) with the install command. Scripts beyond Latin, Greek and Cyrillic need the renderer's optional Noto script packages (the report names them). The full reference, the report fields and the decisions are in [docs/cli.md](https://github.com/OpenPresentation/opf/blob/main/docs/cli.md).

## Development checks

`pnpm test:cli` runs command-level regression checks, including `test/files.mjs` for render, export and import against the workspace's pinned opf-render and opf-pptx (set `UPDATE_GOLDEN=1` to refresh the pinned SVG digests after a renderer or core bump). `pnpm test:cli:packed:peers` installs the packed CLI with both peers from the npm registry and repeats those checks against the installed binary and through `npm exec`. `pnpm test:cli:packed` builds and packs the CLI, installs the tarball offline into an isolated global prefix, exercises the actual executable, and reruns the same checks against the installation. It does not change your global installation. Package builds bundle their current core dependency; rebuild after schema/catalog changes.
