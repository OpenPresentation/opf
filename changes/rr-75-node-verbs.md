---
type: changed
packages: [opf]
---
RR-75 (breaking, OPF 0.18): core's Node build has the CLI's verbs with the CLI's defaults, so `opf validate deck` and `validate(deck)` agree.
    - **Default catalog in Node:** `validate`, `stats`, `paginate`, `embed` and `edit` of the Node build (the `node`, `bun` and `deno` conditions of `@openpresentation/opf`) register the default catalog when a call names no `catalogs`; `catalogs: []` registers none. The browser build exports the same functions and registers no catalog (FA-21). In Node they are no longer the same bindings as `@openpresentation/opf/validator`, `/pagination` and the browser build.
    - **Markdown outlines split by default:** the Markdown reader's `split` option has a new default, `"auto"`: a deck with no `---` line and two or more `# ` headings outside fences, comments and speaker notes is cut at its headings (an outline); any other is cut at `---` lines as before. `split: "rules"` keeps the old behaviour, where a second `# ` heading is a `markdown/duplicate-title` error.
    - **Engine:** `@openpresentation/opf/internal/engine` (the CLI's, not an application API) adds `paginateDeck`, `locatePackage` and `RENDER_EXTRAS`.
