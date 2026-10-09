---
type: changed
---
RR-73, RR-74 (breaking, OPF 0.18; requires core 0.18): one shape for every engine, `toX(deck, slides?, options?)`. The second argument is a slide number (one result), a selection (`"1-3"`, `"1,3-5"`, `"2-"`, `[1, 3]`, parsed by core's `parseSlideSelection`; a list of results) or the options, told apart by type, and slides count from 1. Renamed and removed outright, with no aliases:
    - `renderSvg(deck, options)` and `renderSlideSvg(deck, index, options)` are `toSvg(deck, slides?, options?)`. One slide is `toSvg(deck, index + 1)`; out of range throws `slide-out-of-range` (was `slide-index-out-of-range`), and a malformed selection throws `invalid-slide-selection`.
    - `svgToPng` and `svgToPdf` are `toPng` and `toPdf`, in Node, `/png`, `/pdf` and `/export-browser`. They take a deck, which they draw with `toSvg` and the same options, or SVG as before. A deck gives one PNG for a slide number and a list otherwise; one SVG gives one PNG and a list a list. `toPdf` gives one PDF for a deck, a selection, one SVG or a list.
    - `renderDeckHtml(deck, { slides })` is `toHtml(deck, slides?, options?)`. `slides: "all"` is `"1-"` and `slides: [2, 4]` is `[2, 4]`.
    - The options: `embedFonts: false` is `text: "system"`, `textAsPaths: true` is `text: "paths"` (default `"fonts"`), `mode: "raster"` is `raster: true` (vector stays the default), and `fontDirs` is `fonts`, which takes the handle or font folders (a path or a list) for SVG input.
    - The types: `RenderSvgOptions`, `SvgToPngOptions`, `SvgToPdfOptions` and `RenderDeckHtmlOptions` are `ToSvgOptions`, `ToPngOptions`, `ToPdfOptions` and `ToHtmlOptions`, and the browser export's `BrowserSvgToPngOptions` and `BrowserSvgToPdfOptions` are `BrowserToPngOptions` and `BrowserToPdfOptions`.

    An old option fails with `invalid-render-options` or `invalid-conversion-option`, and the message names its replacement.
