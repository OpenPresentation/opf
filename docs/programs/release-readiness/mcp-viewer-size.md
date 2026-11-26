# MCP viewer size: what the frame is made of, what was cut, and the larger options

The viewer (`ui://opf/deck`) reaches a client as one `resources/read` result, and the MCP SDK's stdio transport refuses a message over 10 MiB (10,485,760 bytes). RR-111 brought the frame from 10,318,132 to 9,390,901 bytes (1,094,859 bytes of headroom) with build-time changes whose results are proven identical in this repository (`changes/rr-111-viewer-diet.md`); `packages/mcp/test/app-resource-frame.test.mjs` fails below 1,000,000 bytes of headroom. On 2026-11-16 three core changes (#1343, #1344, #1345), each green alone, together took the frame to 9,488,109 bytes (997,651 of headroom) and `main` went red; the cut below brought it to 9,160,454 bytes (1,325,306 of headroom) without lowering the floor. Two larger options were left out of 0.34 on purpose: each depends on how a host's sandbox behaves, which cannot be tested before the release, and a wrong guess stops the whole viewer from starting.

To measure: `OPF_MCP_APP_PROFILE=<file.json> node scripts/build-app.mjs` in `packages/mcp` writes esbuild's metafile, whose `bytesInOutput` per input is the table below. The build prints the HTML, script and frame bytes.

## Where the bytes are (2026-11-16)

Measured on `836f28f3c` (the red state, with #1343 to #1345) and after the two cuts below, Node 24, esbuild 0.28.2. The frame is the HTML as a JSON string inside the JSON-RPC message: every `"` and `\` costs a second byte. Before the cut the HTML was 9,158,029 bytes and the frame 9,488,109; 329,868 of the difference were escapes, 316,572 of them double quotes.

| Part of the script (minified bytes, `bytesInOutput`) | Before | After |
| --- | ---: | ---: |
| Whole script | 8,950,721 | 8,881,446 |
| Core (`@openpresentation/opf`), all of it | 3,238,287 | 3,169,014 |
| of which the precompiled validators (Ajv standalone code) | 1,009,263 | same |
| of which the diagram layouts, arrangements and the other composition code (one tsup chunk) | 785,256 | same |
| of which validation, rules, rule help and finding messages (`validator.ts`, `validation-rule-info.ts` and others, one chunk) | 342,172 | same |
| of which the generated JSON Schemas, with 1,056 `description` strings (213,747 bytes) and `$comment`s (4,417) | 331,831 | same |
| of which the DrawingML preset geometry | 222,149 | same |
| of which the symbol-font encoding table | 170,345 | 101,074 |
| of which the font policy (`font-policy.ts`, notes included) | 117,727 | same |
| of which the finding explanations (`explain`) | 39,950 | same |
| Editor (`@openpresentation/opf-editor`) | 1,269,267 | same |
| PPTX exporter (dist 607,831, vendored PptxGenJS and JSZip 595,963) | 1,203,794 | same |
| Diagram engine (`pele`) | 732,905 | same |
| CodeMirror and Lezer (the Source pane) | 431,527 | same |
| Renderer (`@openpresentation/opf-render`, its font manifest 78,798) | 413,744 | same |
| Gallery data (`@openpresentation/gallery`, one `JSON.parse` string) | 312,289 | same |
| Startup font, Roboto Regular as base64 (`OPF_DECK_FONTS`) | 257,060 | same |
| fontkit (236,347) and its Brotli decoder for WOFF2 (90,979) | 327,326 | same |
| MCP SDK (client, core, ext-apps) | 212,660 | same |
| zod (the MCP SDK's message schemas; English only) | 196,002 | same |
| YAML parser and the editor's YAML and Markdown source codecs | 179,027 | same |
| pako, fflate, tiny-inflate (PDF writer, JSZip, the exporter's packages) | 64,612 | same |
| Icon code (editor picker and options, exporter, viewer); no icon data is bundled, the viewer reads icons with `read_icons` | 24,346 | same |
| The viewer's own code (`app/`) | 32,657 | same |
| Comments (legal comments at the end) | 289 | same |

What is not there: no source maps, no docs or skills text, no module bundled twice (every package resolves to one install and no `@openpresentation` file appears under two paths), no Node-only code (the file API, the CLI) and no zod locale other than English. Everything listed is reached by a feature of the viewer: the YAML and Markdown codecs by the Source pane's formats, the schema descriptions by the editor's schema inspector and source help, the exporter by Export, the diagram engine by diagram blocks, Brotli by fontkit's WOFF2 reader (always imported by fontkit).

## Taken on 2026-11-16

Both are build-time changes; neither changes what a public API returns or what the viewer does.

1. **String literals in the cheaper quote** (`packages/mcp/scripts/app-quotes.mjs`, run by `build-app.mjs`): the build rewrites each double-quoted string literal of the minified script in single quotes when that makes the JSON text shorter. Only the delimiters and the escapes they need change. TypeScript's parser finds the literals, so a quote in a regular expression, template or comment is never touched, and the build stops unless esbuild prints byte-identical code from the script before and after (its syntax tree keeps no quote style). 129,190 literals; frame -258,380 bytes (9,488,109 to 9,229,729); the HTML is the same size. Tests: `packages/mcp/test/app-quotes.test.mjs` (the value of every kind of literal esbuild writes, which literals change, both failure paths, nothing left to shorten in the served viewer) and the browser suite unchanged.
2. **The symbol-font encoding table in a column form** (`packages/javascript/scripts/generate.mjs`, expanded in `src/symbol-font-encodings.ts` when the module loads): each of the 1,120 code rows is the index of its key list and its values, without `code` and `hex`, which the row's position gives (the generator stops if a row breaks that). `SYMBOL_FONT_ENCODINGS` is the same frozen table: `test/symbol-font-encodings.test.mjs` now compares `JSON.stringify` of it with the spec file (same values, keys in the same order; it passed before the change too) and checks that every nested object is frozen. Frame -69,275 bytes (to 9,160,454).

Together: frame 9,488,109 to 9,160,454 bytes (-327,655), headroom 997,651 to 1,325,306.

## Looked at and not taken

- **The gallery data as an object literal** instead of its `JSON.parse` string: the JSON string has a `"` around every key and value, which the frame pays twice even in single quotes. As a literal it would be 296,631 frame bytes instead of 343,815 (-47,184), but V8 parses a large `JSON.parse` string faster than the same object literal, and the gallery package builds it this way for every consumer; a viewer-only rewrite (an esbuild `onLoad` for `gallery/dist/index.js`) would need a startup-time measurement first. (The 0.34 note proposed the opposite direction, a `JSON.parse` string; that is what the gallery already ships.)
- **Schema `description` strings** (213,747 bytes): the editor's schema inspector (`schema-inspector.js`) and source help and completions read them, and `schemas` is a public export.
- **The MCP client's default JSON Schema validator** (`cfWorkerProvider`, 22,293 bytes, imported by the client's browser shims) and zod's `fromJSONSchema` (12,304, re-exported by zod's namespace): both are imported by the SDK's own modules, and dropping them would mean replacing an SDK module at build time with no test that proves the App never reaches them.
- **One deflate library** instead of pako, fflate and tiny-inflate (64,612 bytes together): each belongs to a different package's code path (the PDF writer, the vendored JSZip, the exporter's packages); merging them changes those packages.

## 2026-11-26: the 0.37.0 cut (opf#1516)

The format changes of 0.37.0 took the frame back to 9,468,222 bytes (1,017,538 of headroom) on `main` at 14170de4f, and the changes still in review add tens of kilobytes each. Six build-time steps took it to 9,183,256 bytes (1,302,504 of headroom, -284,966) on that base, Node 24, esbuild 0.28.2. No public export changes its value, type or freezing, and the viewer does the same.

### Where the bytes are

`bytesInOutput` of the metafile, before the quote pass (so a row's difference here is not its frame saving; the frame saving of each step is below).

| Part of the script (minified bytes) | 2026-11-16, after | 14170de4f | After this cut |
| --- | ---: | ---: | ---: |
| Whole script | 8,881,446 | 9,176,050 | 8,922,998 |
| Core (`@openpresentation/opf`), all of it | 3,169,014 | 3,380,999 | 3,247,608 |
| of which the precompiled validators | 1,009,263 | 1,052,751 | 1,017,741 |
| of which the composition chunk (diagrams, charts, tables, dates, variables, data sources, the engine vocabularies) | 785,256 | 882,418 | 870,973 |
| of which validation, rules, rule help and finding messages | 342,172 | 384,669 | 384,827 |
| of which the generated JSON Schemas | 331,831 | 349,176 | 349,176 |
| of which the DrawingML preset geometry | 222,149 | 222,149 | 199,802 |
| of which the font policy | 117,727 | 124,219 | 59,372 |
| of which the symbol-font encoding table | 101,074 | 101,074 | 101,074 |
| Editor | 1,269,267 | 1,295,210 | 1,294,755 |
| PPTX exporter (dist and vendored PptxGenJS and JSZip) | 1,203,794 | 1,223,261 | 1,223,295 |
| Diagram engine (`pele`) | 732,905 | 733,224 | 732,925 |
| Renderer (of which the font manifest) | 413,744 (78,798) | 416,331 (78,798) | 395,532 (57,982) |
| Gallery data | 312,289 | 320,078 | 221,712 |
| Startup font (Roboto Regular, base64) | 257,060 | 257,060 | 257,060 |

The growth since 2026-11-16 (+294,604 bytes of script) is mostly core: +43,488 in the validators (new schema keys), +97,162 in the composition chunk (data sources, typed columns, dates in the deck's language with their name table, translations), +42,497 in validation and rules, +17,345 in the schemas and +6,492 in the font policy; the editor grew by 25,943, the exporter by 19,467 and the gallery data by 7,789.

The frame is the HTML (9,396,523 bytes before, 9,143,471 after) plus its JSON escapes and the message around it: 71,699 bytes before, 39,785 after. The escaped double quotes went from 57,580 to 25,694 bytes: the gallery's JSON text was most of them.

### Taken

Load times are the import of a module that exports the table, minified as the bundle is, in a fresh Node 24 process per run, the plain and the new form alternating, 20 runs each, median. The machine was shared with other builds, so absolute times drift between sets; each pair was measured together.

1. **A compact form for generated tables** (`packages/javascript/scripts/compact-literal.mjs`). A table becomes an immediately invoked arrow function that names each repeated string once and builds each repeated object shape with a small function, so a row is `o3(s12, "x", ...)`. Every object and array is still a fresh literal with its keys in the source's order; only strings, which are primitives, are shared. The generator evaluates the expression and stops unless `JSON.stringify` of what it builds equals the source's. `test/compact-literal.test.mjs` checks every kind of JSON value, key order (numeric keys too), that nothing is aliased, and that each table it is used on builds its spec file exactly. The font policy (`spec/reference/font-policy.json`) is the first: frame -64,844 (9,468,222 to 9,403,378). `test/font-policy.test.mjs` now also compares the exact JSON text of `FONT_POLICY` with the spec file with decisions applied, and checks that every nested object is frozen. Load 2.61 ms plain, 2.66 ms compact.
2. **The DrawingML preset geometry** in the compact form, with strings named only where they are arguments of a row's function: frame -22,343 (to 9,381,035). Naming every string saves 40 KB more, but each name inside an array literal turns a constant the engine copies from the literal's template into a store of its own, and the table's thousands of path commands made it load measurably slower (4.95 to 8.77 ms with strings alone, 7.55 to 11.48 ms with strings and shapes). In the mode taken: 4.81 ms plain, 4.98 ms compact. `test/shape-geometry.test.mjs` evaluates every preset.
3. **The gallery data in the viewer only** (`packages/mcp/scripts/app-data.mjs`, an esbuild `onLoad` rule in `build-app.mjs`): the `const data = JSON.parse("...")` line of `@openpresentation/gallery`'s `dist/index.js` becomes the compact expression. Frame -129,240 (to 9,251,795). The build stops unless the value's JSON text is the same and exactly one such line was rewritten; `test/app-data.test.mjs` compares every export with the published package, its freezing depth, and that no other line changes. Other consumers keep the JSON string, which V8 loads faster in isolation (6.53 ms as `JSON.parse`, 9.33 ms as the expression, 8.29 ms as a plain literal), so the step was measured as the brief required: the viewer page in Chromium (Playwright), served with the restrictive default CSP, a fresh context per run (no code cache), the two pages alternating. DOMContentLoaded medians, before and after: 440.3 and 447.3 ms (15 runs), 449.8 and 455.9 ms (30 runs), 2,408.0 and 2,409.5 ms (15 runs at 4x CPU throttling), 406.8 and 407.0 ms (40 runs; paired difference median -4.1 ms, the new page slower in 17 of 40 pairs, middle half -13.8 to +13.9 ms). The fastest and slowest runs of each set were 60 ms or more apart, so no slowdown is measurable at the page.
4. **The renderer's font manifest in the viewer only**: a second rule of `app-data.mjs` writes `BUNDLED_FONT_MANIFEST`'s indented JSON (`@openpresentation/opf-render`'s `dist/font-manifest.js`) as the compact expression inside the same `freeze()`. Frame -20,816 (to 9,230,979); the test checks that the manifest is the same and deeply frozen and that the lines before it do not change. Load 1.40 ms plain, 1.53 ms compact.
5. **The engine vocabularies** (`spec/reference/engine-vocabularies.json`, whose language rows repeat their keys) in the compact form, typed with the type `as const` gave the literal it replaces (`asConstType`), so every consumer type-checks unchanged: frame -11,186 (to 9,219,793). The test compares `CHART_TYPES`, `SOCIAL_PLATFORMS` and `LANGUAGES` with the spec file. Load 0.88 ms both.
6. **Three more derived validator errors** (`scripts/validators-codegen.mjs`): `opfEnumError`, `opfAdditionalPropertyError` and `opfLimitError` (the numeric bounds and the minimum and maximum counts of items, characters and properties) build params and message from the schema value or the property name, each chosen only when Ajv's own params and message code equal what the helper builds. Frame -36,537 (to 9,183,256). `test/precompiled-validators-errors.test.mjs` adds bound mutants of the corpus (numbers far out of range, empty strings, longer arrays, wider objects) and checks that the errors it compares with Ajv's property by property include every keyword these helpers write (no schema uses `maxLength` as a keyword); the file runs in about 15 s instead of 11 s.

The catalog-free entries stay within their gzip budgets (`check:catalog-free`); the `font-policy` entry got smaller (15,624 bytes gzipped against a budget of 17,383), the others moved by less than 1%.

### Measured and not taken

- **The JSON Schemas in the compact form** (63 KB of frame as one pool, 42 KB schema by schema, 55 KB with the presentation schema alone and the other thirteen pooled so that `format.ts`, which imports only `presentation`, does not pull the rest): every variant loads measurably slower, because the schemas are deep trees the engine copies from one literal template and the shape calls break that up: the presentation schema 6.16 to 7.93 ms with strings and shapes, 3.86 to 4.61 ms with shapes alone, 3.80 to 4.24 ms with only the ten most used shapes (11 KB).
- **Naming every string in the preset geometry**: 40 KB more, at about 4 ms more load (step 2).
- **The symbol-font encoding table** in the compact form on top of its column form: no gain (101,048 frame bytes either way).
- **The date names and number locales**: already one joined string per language; nothing repeats.
- **Code the viewer never reaches**: nothing on this base. No live-embed module is in the bundle (embed was not on `main` at 14170de4f), and no Node file API module either; the other inputs are reached as the 2026-11-16 section says.
- **Escapes**: what is left after the gallery step is in template literals (already delimited by a backtick), regular expressions (10,130 bytes, mostly `\`) and the CSS; none has a provably identical spelling that is shorter.

## 1. Compressed script, decompressed at run time

The script is 8,856,984 bytes of the 9,064,031-byte HTML. Compressed, it is 2,694,281 bytes with gzip level 9 (3,592,376 as base64) or 2,130,459 with Brotli quality 11 (2,840,612 as base64). A page that carries the base64 text and a small loader would save about 5.3 MB (gzip, which the browser's `DecompressionStream` can read) to 6.0 MB (Brotli, which needs a decoder in the page) of the frame, leaving room for years of growth.

The catch is the step after decompression: the code is then a string, and running a string needs `eval`/`new Function` (the host CSP has no `unsafe-eval`), a `blob:` or `data:` module URL (`script-src 'self' 'unsafe-inline'` allows neither), or a dynamically inserted inline `<script>` (allowed by `unsafe-inline` in a plain page, but not when the host adds a nonce or hash, and a module graph cannot be split this way). To ship it, test in a real Claude host (web and desktop, inline and fullscreen) and in at least one other MCP Apps host: that `DecompressionStream("gzip")` exists in the sandboxed iframe; that an inline script created with `document.createElement("script")` and its `text` set runs under the host's actual CSP header and meta policy, with no console CSP report; that the page still starts when the host's CSP differs from the SEP-1865 default (a nonce, `strict-dynamic`, or `require-trusted-types-for 'script'`, which would block it); the time to first slide on a 4x-throttled CPU (decompressing and compiling 8.8 MB); and a fallback that shows a readable error when the step is refused, instead of a blank frame.

## 2. The PPTX exporter and the diagram engine on demand

In the viewer bundle the PPTX exporter (`@openpresentation/opf-pptx` with its vendored PptxGenJS and JSZip) is 1,176,452 bytes and the diagram engine `pele` 732,374 bytes, about 1.95 MB of the frame together with their string escapes. Neither is needed to show a deck that has no diagram, and the exporter only when the person exports. Both could come later through an app-only tool (`read_app_module`, like `read_font_file`) and be loaded when first needed, with the startup page unchanged otherwise.

Loading code later has the same catch as option 1: the module text must be run. Before it ships, test in a real Claude host that the delivery and run path works (the same checks as above), that a deck with a Mermaid, DOT or PlantUML diagram still draws on first view (the diagram waits for the module, so the first slide changes from a placeholder to the diagram) and that a validation finding for a diagram is identical to today's; that Export PowerPoint works on the first press with the module not yet loaded, including when the tool call fails (a visible error, no silent download of nothing); and that a host that limits app-only tool calls or their size does not break startup. The module files would also need SHA-256 pinning like the fonts.

## Smaller safe steps still open

The candidates this section listed on 2026-11-16 (more derived validator errors, a compact form for the tables whose rows repeat their keys, and the gallery data in the viewer only) were taken on 2026-11-26; see that section for what was measured and left. What remains is a few kilobytes each: the compact form for the other generated tables loads measurably slower or saves nothing, and the two options above are the only ones that buy years of growth.

Measurements in sections 1 and 2 are of the 0.34 RR-111 build, before the quote pass; with it, the script's JSON escapes are about 70,000 bytes instead of 330,000, so option 1's saving is that much smaller.

## 2026-11-26: the 0.37.0 format changes reach the floor

`main` with eight of the eleven format changes of 0.37.0 measures about 9,468,000 frame bytes (about 1,017,000 of headroom). With embed it is 9,501,842 (983,918), with the table color scale instead 9,492,922 (992,838), and the computed metric, bands with the bullet chart and the gauge follow. So that these land one after another, the test's floor is 800,000 from the embed change on; 0.37.0 is not released until the viewer has 1,000,000 bytes of headroom again and the test says so. The work is opf#1516: the smaller safe steps above, measured and taken in order, and anything 0.37.0 added that the viewer never reaches.
