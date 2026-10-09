---
type: changed
---
RR-73 (breaking, OPF 0.18; needs core 0.18.0 and opf-render 0.18.0): the editor adopts the renderer's 0.18 names, and `exportDeck` becomes `convert(deck, { format })` from `@openpresentation/opf-editor/export`, with the name and the result of core's in-memory `convert`: `{ files, findings }` (core's `ConvertResult`). A PDF is one file (`pages`, and the one-based `slides` it shows); PNG and SVG give one file per slide, each with its one-based `slide`, `id`, `width` and `height`, or with `zip: true` one archive (`entries`). Findings are core's `Finding`: `ruleId` `render/<code>`, `pdf/<code>` or `fonts/export-font-license`, a JSON Pointer `path`, the zero-based `slide` and `slideId` of the Finding schema, and the note's facts in `measured`. Slide selections count from 1 and use core's `parseSlideSelection`; a malformed one or a slide past the end rejects with core's `invalid-option`, as do `zip` with a PDF and `raster` with PNG or SVG. File names follow core's numbering (`deck-001.png`, archives `deck.zip`). The canvas keeps its zero-based `slideIndex`; only its renderer call adds 1. Removed with no alias:

    | 0.17 | 0.18 |
    | --- | --- |
    | `exportDeck(deck, options)` | `convert(deck, options)` |
    | `slides: "all"` | `slides` omitted (every slide that is not hidden; `includeHidden` for all) |
    | `slides: "current"` with `slideIndex: i` (0-based) | `slides: i + 1` |
    | `slides: [0, 2]` (0-based) | `slides: [1, 3]` or `"1,3"` (core's `SlideSelection`) |
    | `pdfMode: "raster"` / `"vector"` | `raster: true` / omitted |
    | `convert: { svgToPdf, svgToPng }` | `converters: { toPdf, toPng }` |
    | `onDiagnostic(diagnostic)` | `onFinding(finding)` |
    | result `download` (one file or a ZIP) | `files` (one file per slide, or `zip: true` for one archive) |
    | result `diagnostics` (`{ code, severity, message, slide (0-based) }`) | `findings` (core's `Finding`; `ruleId` is `render/`, `pdf/` or `fonts/` plus the code) |
    | result `slides` (0-based) | each file's `slide` (1-based), a PDF's `slides` (1-based) |
    | `ExportResult`, `ExportFile`, `ExportDiagnostic`, `ExportOptions`, `ExportProgress` | core's `ConvertResult`, `ConvertedFile`, `Finding`; the editor's `ConvertOptions`, `ConvertProgress` |
    | `describeDiagnostic` | removed (findings are made inside `convert`) |
    | `slidesToExport(deck, { slides, slideIndex, includeHidden })` (0-based) | `slidesToConvert(deck, { slides, includeHidden })` (1-based) |
    | file names `deck-01.png`, `deck-png.zip` | `deck-001.png`, `deck.zip`; the new `name` option sets the base name |
    | `CanvasEditorOptions.renderOptions`, `FontsReadyHandlers.renderOptions`, `setRenderOptions`: `RenderSvgOptions` | `ToSvgOptions` |

    The canvas and the playground previews draw with `toSvg(deck, slideIndex + 1, { text: "system" })` in place of `renderSlideSvg(deck, slideIndex, { embedFonts: false })`. The `export-*` error codes are unchanged. The playground's download dialog packs several PNG or SVG slides into one ZIP with `zip: true`.
