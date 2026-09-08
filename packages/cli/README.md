# @openpresentation/cli

A local CLI for agents and people working with `.opf.json` presentations. Create documents, validate them, apply precise edits, paginate content, and inspect the bundled schemas and catalogs. Node 20+ on macOS, Linux, or Windows is required.

The CLI bundles its OPF schema, catalogs, and validator. It needs no separate core package, API key, or network connection at runtime. `opf --version` reports the CLI and bundled core versions. It does not render slides; successful validation is not visual verification.

## Install

The CLI is published on npm. Install the current release:

```sh
npm install -g @openpresentation/cli
opf --version
```

Or install it as a development dependency and use `npx --no-install opf`. This checkout prepares CLI 0.2.0 with bundled OPF 0.5.0; that version supports rich table cells and headers during validation and pagination. Until 0.2.0 is published, the registry's latest release has the previous schema.

To verify the standalone package from source, run `pnpm install` and `pnpm test:cli:packed`. This creates `artifacts/cli/openpresentation-cli-0.2.0.tgz`, which can be installed using its absolute path. For source development, run `pnpm --filter @openpresentation/cli build` and `node packages/cli/dist/index.js --help`.

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

Validation prints the complete result, including errors, warnings, and the input's SHA-256 digest. `--strict` fails when there are warnings, even when `valid` is true. Reference warnings do not cover every possible unresolved reference: free-form layout IDs can pass without warnings.

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

## Import CSV and JSON data

```sh
opf import-data revenue.csv --as table --output table.opf.json
opf import-data revenue.json --as chart --chart-type line --output chart.opf.json
opf import-data revenue.csv --as chart --category Quarter --series '["Revenue","Costs"]' --into decision.opf.json --in-place
```

Data can come from a file or stdin (`-`). JSON accepts arrays of records, row matrices, or `{columns, rows}`. `--path /slides/0/table` replaces or adds a table field inside an existing parent; use `/chart` for charts. With `--into` and no path, a new slide is appended. Other options include `--format csv|tsv|json`, `--delimiter`, `--no-header`, `--columns` (a JSON array), and `--title`. Preview on stdout by omitting an output destination. All file writes validate the complete document. CSV table strings are preserved; chart measures must be numeric. Data is embedded, not linked to the source file.

## Discover format options

```sh
opf schemas
opf schema presentation '/$defs/Composition'
opf catalogs
opf catalog layouts
opf catalog fontSchemes roboto
```

`schemas` and `catalogs` list available names/kinds. `schema` returns the whole schema or a branch addressed by a pointer into the schema. `catalog` returns all records in a kind, or one exact ID. These commands inspect the bundled version and do not fetch galleries.

```sh
opf paginate decision.opf.json paginated.opf.json
```

Pagination emits ordinary OPF slides and a page mapping. Preview the result with the renderer to assess wrapping and visual fidelity.

## Agent output contract

- Reports and errors are JSON; only help text is plain text.
- `validate` reports to stdout, including for invalid documents.
- Commands emitting a document to stdout send validation diagnostics to stderr, so pipes remain valid JSON.
- File-writing commands report the absolute output path, output SHA-256, and warnings to stdout.
- Exit `0`: success, possibly with warnings. Exit `1`: invalid document, failed patch/test, strict warning failure, or file conflict. Exit `2`: usage, malformed JSON, or I/O failure.
- File-writing commands accept `--strict`. Use `--` before positional filenames that start with `--`.
- No telemetry, automatic uploads, or execution of instructions inside document text.

## Development checks

`pnpm test:cli` runs command-level regression checks. `pnpm test:cli:packed` builds and packs the CLI, installs the tarball offline into an isolated global prefix, exercises the actual executable, and reruns the same checks against the installation. It does not change your global installation. Package builds bundle their current core dependency; rebuild after schema/catalog changes.
