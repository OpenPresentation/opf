# Changelog

## Unreleased

## 0.29.1 (2026-10-27)

No package changes; released with the set.

## 0.29.0 (2026-10-27)

No package changes; released with the set.

## 0.28.0 (2026-10-26)

- New package `@openpresentation/mcp` (published with the set from 0.27.0): an MCP server for learning and validating OPF. Run it with `npx -y @openpresentation/mcp` (bin `opf-mcp`, stdio). Tools: `start_here` (a guided path for a goal: docs, skill, examples, layouts and themes, and the validate step with `failOn: "warning"`), `validate_deck` (the findings of `opf validate`), `get_schema` (a schema, a `$defs` name or a JSON Pointer), `search_catalog` and `get_catalog_record` (the default catalog and the example decks), `convert` (JSON, YAML and Markdown), `search_docs` (ranked, with snippets) and `list_examples`. Resources with stable URIs: `opf://docs/<slug>` (the user documentation, including the format card), `opf://docs/whats-new` (the last releases), `opf://schema/<name>[#<pointer or $defs name>]`, `opf://examples/<slug>`, `opf://catalog/<kind>/<id>` and `opf://skills/<name>`, each listed and readable through templates. Prompts: `learn_opf`, `author_deck`, `fix_validation_findings` and `choose_layout`. The server keeps no state and reads no file. Its definition is a library, edge-safe (no Node builtin, precompiled validators, bundled data; tested in workerd) for a hosted server: `@openpresentation/mcp` (with the bundled data) and `@openpresentation/mcp/server` (sources supplied by the host). See `docs/mcp.md`.
