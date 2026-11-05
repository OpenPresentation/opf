# Changelog

## Unreleased

## 0.32.1 (2026-11-05)

- `validate_deck` checks diagrams in a Worker again. Since Workers take the lazy diagram engine, a hosted MCP server (`@openpresentation/mcp/server` on openpresentation.org/mcp) validated a deck before its diagram types were loaded and left out every diagram finding, such as a Mermaid syntax error; it now loads the types the deck draws (`ensureDiagrams`) before it validates, in JSON, YAML and Markdown, and reports what Node reports. A Worker that hosts the server carries the diagram types again (about 1.1 MB unminified).

## 0.32.0 (2026-11-04)

- Diagrams: a new `diagram` content kind (on slide roots, blocks and layout regions; a string of Mermaid source, or `{ source, syntax, alt }`) draws flowcharts, sequence, class, state, ER, gantt, pie, mind map, timeline, journey, C4, architecture and the other built-in Mermaid 12.1 families with [pele](https://pele.run), in the deck's own fonts and colors. Core lays each diagram out with the deck's measured fonts at the largest size that fits its block, never below the readability floor (a diagram that only fits smaller is drawn smaller and reports a `text-overflow` finding with advice), and centers it; node fills, outlines and data series follow the slide variant and the chart palette, so dark slides and color maps adapt on their own. `alt` is the text alternative (without it engines derive one from the diagram's labels), a source that cannot be parsed reports a finding with its line and column and draws a "Diagram unavailable" placeholder, and a diagram takes a `caption`. A fenced block whose info word is `mermaid` is a diagram in Markdown (` ```mermaid alt="What it shows" `), written back losslessly. The PPTX export writes a native SVG picture over a PNG fallback (crisp, with `alt` as its description, round-tripping through `fromPptx`); the nodes are not yet editable PowerPoint shapes. Limits: 20,000 characters of source and 500 edges. Node, Bun, Deno and edge runtimes load every diagram type with core; a browser bundle loads pele's core (about 12 KB gzipped) and each type the first time a deck draws one, through the new `#diagram-engine` import map: the renderer's browser fonts handle loads them in `ensure` (and lists them in `pending` as `diagram:<type>`), `toPptx` loads them itself, and other hosts call `ensureDiagrams(presentation)` from `@openpresentation/opf/composition`. New fixtures: `examples/technical/diagrams.opf.json` and `examples/markdown/diagrams.opf.md`.
- LH-13 and LH-37 (docs and skills only, no drawing change): the `opf-author` skill gains a storyline guide (outline the titles first in one grammar, one idea per slide with a content-to-structure table, never invent a figure or a quote and how bracketed placeholders interact with `opf/placeholder-text`, speaker notes as a script, ask before adding slides or statistics), and the `opf-layout` skill gains a measured vertical budget (how many list entries, table rows and paragraphs keep the default size on a 16:9 slide, the `composeSlide` call that measures your own content, and when to split or paginate). `docs/default-catalog.md` gains a review checklist for gallery records against slide-design clichés.

## 0.31.0 (2026-11-02)

No package changes; released with the set.

## 0.30.0 (2026-11-02)

No package changes; released with the set.

## 0.29.1 (2026-10-27)

No package changes; released with the set.

## 0.29.0 (2026-10-27)

No package changes; released with the set.

## 0.28.0 (2026-10-26)

- New package `@openpresentation/mcp` (published with the set from 0.27.0): an MCP server for learning and validating OPF. Run it with `npx -y @openpresentation/mcp` (bin `opf-mcp`, stdio). Tools: `start_here` (a guided path for a goal: docs, skill, examples, layouts and themes, and the validate step with `failOn: "warning"`), `validate_deck` (the findings of `opf validate`), `get_schema` (a schema, a `$defs` name or a JSON Pointer), `search_catalog` and `get_catalog_record` (the default catalog and the example decks), `convert` (JSON, YAML and Markdown), `search_docs` (ranked, with snippets) and `list_examples`. Resources with stable URIs: `opf://docs/<slug>` (the user documentation, including the format card), `opf://docs/whats-new` (the last releases), `opf://schema/<name>[#<pointer or $defs name>]`, `opf://examples/<slug>`, `opf://catalog/<kind>/<id>` and `opf://skills/<name>`, each listed and readable through templates. Prompts: `learn_opf`, `author_deck`, `fix_validation_findings` and `choose_layout`. The server keeps no state and reads no file. Its definition is a library, edge-safe (no Node builtin, precompiled validators, bundled data; tested in workerd) for a hosted server: `@openpresentation/mcp` (with the bundled data) and `@openpresentation/mcp/server` (sources supplied by the host). See `docs/mcp.md`.
