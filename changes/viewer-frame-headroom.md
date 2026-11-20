---
type: changed
packages: [opf, mcp]
---
The MCP viewer (`ui://opf/deck`) is 327,655 bytes smaller as a `resources/read` frame (9,488,109 to 9,160,454 bytes, 1,325,306 under the 10 MiB stdio limit), with nothing it does or returns changed. The build writes each string literal of the viewer's script in single quotes when that makes the JSON frame shorter (a double quote costs two bytes there) and stops unless esbuild prints the same program from both; core generates the symbol-font encoding rows in a column form that `@openpresentation/opf/symbol-font-encodings` expands when it loads, so `SYMBOL_FONT_ENCODINGS` is the same frozen table, keys in the same order. What the frame is made of and what is left to cut: `docs/programs/release-readiness/mcp-viewer-size.md`.
