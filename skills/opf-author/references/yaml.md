# Authoring a deck as YAML

Use this when the user wants a deck they can write and read by hand, or a file called `*.opf.yaml`. A YAML deck is the same data as the JSON deck: the parsed YAML is the OPF document and the same schema validates it. JSON stays the canonical form; convert at the edge. The conversion is deterministic and local: core's `@openpresentation/opf/yaml` (`fromYaml`, `toYaml`) and the CLI's `opf from-yaml` and `opf to-yaml`. Check `opf --help` for `from-yaml`: releases before the one that lists RR-56 in the changelog do not have it. The full guide is `docs/yaml.md` in the OpenPresentation/opf repository.

```sh
opf validate deck.opf.yaml                       # every command reads .yaml and .yml files
opf from-yaml deck.opf.yaml deck.opf.json        # YAML to a validated JSON deck
opf to-yaml deck.opf.json deck.opf.yaml --schema-comment   # canonical YAML with the editor modeline
opf create deck.opf.yaml --title "Q3 review"     # a new deck, written as YAML
opf edit deck.opf.yaml --patch changes.json --in-place    # edits keep the file YAML
```

## Write it like this

```yaml
# yaml-language-server: $schema=https://openpresentation.org/schema/opf/v1
name: Q3 Business Review
slides:
  - title: Revenue grew every quarter
    items:
      - Faster onboarding
      - "yes"            # quote text that looks like another type
    notes: |
      Two minutes on the agenda.
      Then straight into the numbers.
```

The first line gives editors (YAML language server) validation and completion against the schema. Keys follow the schema order when OPF writes the file; reading accepts any order.

## The strict dialect

- One document, a mapping at the root. No `---` between documents.
- Plain YAML 1.2 types only: `2026-10-01`, `yes`, `no`, `on` and `off` are **text**; `true`/`false`, `null` and numbers are typed. Quote anything that must stay text: `"123"`, `"null"`, `"12:30"`, and any text starting or ending with a space, containing `#` after a space, or `: `.
- No duplicate keys, no non-string keys (`"1":`, not `1:`), no custom tags, no `.inf` or `.nan`.
- No anchors (`&x`), aliases (`*x`) or merge keys (`<<`). If the user's file already uses them, convert with `opf from-yaml --aliases` (or `fromYaml(text, { aliases: true })`), which expands them to plain data, at most 100 aliases.
- A block scalar (`|`) keeps line breaks in `notes`, `text` and code `source`.

## Errors and rewriting

A YAML error exits 2 with the line and column (`Invalid YAML in deck.opf.yaml at line 5, column 5: ...`); `opf validate deck.opf.yaml` locates its findings at YAML lines. Commands that rewrite a YAML file (`edit`, `format`, `merge`, `fill`, `to-yaml`...) write canonical YAML and **do not preserve comments**: they print a warning on stderr. Keep notes that must survive in `description`, `notes` or `extensions`, not in comments. Never hand-edit a file that a tool also rewrites without telling the user; use `opf edit --patch` for repeatable changes.

JSON-only inputs: `--config` files, the `fill --data` values file and the `ingest` source (CSV, TSV or JSON).
