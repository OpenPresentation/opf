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

## 1. Compressed script, decompressed at run time

The script is 8,856,984 bytes of the 9,064,031-byte HTML. Compressed, it is 2,694,281 bytes with gzip level 9 (3,592,376 as base64) or 2,130,459 with Brotli quality 11 (2,840,612 as base64). A page that carries the base64 text and a small loader would save about 5.3 MB (gzip, which the browser's `DecompressionStream` can read) to 6.0 MB (Brotli, which needs a decoder in the page) of the frame, leaving room for years of growth.

The catch is the step after decompression: the code is then a string, and running a string needs `eval`/`new Function` (the host CSP has no `unsafe-eval`), a `blob:` or `data:` module URL (`script-src 'self' 'unsafe-inline'` allows neither), or a dynamically inserted inline `<script>` (allowed by `unsafe-inline` in a plain page, but not when the host adds a nonce or hash, and a module graph cannot be split this way). To ship it, test in a real Claude host (web and desktop, inline and fullscreen) and in at least one other MCP Apps host: that `DecompressionStream("gzip")` exists in the sandboxed iframe; that an inline script created with `document.createElement("script")` and its `text` set runs under the host's actual CSP header and meta policy, with no console CSP report; that the page still starts when the host's CSP differs from the SEP-1865 default (a nonce, `strict-dynamic`, or `require-trusted-types-for 'script'`, which would block it); the time to first slide on a 4x-throttled CPU (decompressing and compiling 8.8 MB); and a fallback that shows a readable error when the step is refused, instead of a blank frame.

## 2. The PPTX exporter and the diagram engine on demand

In the viewer bundle the PPTX exporter (`@openpresentation/opf-pptx` with its vendored PptxGenJS and JSZip) is 1,176,452 bytes and the diagram engine `pele` 732,374 bytes, about 1.95 MB of the frame together with their string escapes. Neither is needed to show a deck that has no diagram, and the exporter only when the person exports. Both could come later through an app-only tool (`read_app_module`, like `read_font_file`) and be loaded when first needed, with the startup page unchanged otherwise.

Loading code later has the same catch as option 1: the module text must be run. Before it ships, test in a real Claude host that the delivery and run path works (the same checks as above), that a deck with a Mermaid, DOT or PlantUML diagram still draws on first view (the diagram waits for the module, so the first slide changes from a placeholder to the diagram) and that a validation finding for a diagram is identical to today's; that Export PowerPoint works on the first press with the module not yet loaded, including when the tool call fails (a visible error, no silent download of nothing); and that a host that limits app-only tool calls or their size does not break startup. The module files would also need SHA-256 pinning like the fonts.

## Smaller safe steps still open

Without either option, the remaining build-time candidates are small: a few more derived validator errors (enum and additionalProperties, about 20 KB of the script, proven the way RR-111 proved the others, by `test/precompiled-validators-errors.test.mjs`); the same column form for other generated tables whose rows repeat their keys (the DrawingML preset geometry, 222,149 bytes, is already arrays of arrays; the font policy, 117,727, is the next to measure); and the gallery as an object literal in the viewer only (about 47 KB, after a startup-time measurement). Each is tens of kilobytes; the two options above are the only ones that buy years of growth.

Measurements in sections 1 and 2 are of the 0.34 RR-111 build, before the quote pass; with it, the script's JSON escapes are about 70,000 bytes instead of 330,000, so option 1's saving is that much smaller.
