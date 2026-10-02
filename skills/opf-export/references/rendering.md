# Rendering and conversion APIs

## CLI

```sh
npm install -g @openpresentation/cli @openpresentation/opf-render @openpresentation/opf-pptx
opf render deck.opf.json --slides 1,3-5 --format svg|png [--scale 2] [--out dir]
opf export deck.opf.json --format pptx|pdf|png|svg [--out file|dir|x.zip] [--pdf-mode vector|raster]
           [--chartex auto|native|fallback] [--provenance full|references-only|none] [--paginate] [--date YYYY-MM-DD]
opf import deck.pptx [--out deck.opf.json] [--signals signals.json]
```

Each prints one JSON report (the `opf lint` shape: `ok`, `diagnostics` with `ruleId`/`severity`/`path`/`help`, `counts`, plus `outputs` with SHA-256 digests) and exits 1 on errors, or on warnings with `--strict` (nothing is written then). The CLI uses the same `prepareNodeFonts` office pack as the recipe below (visual substitution, `scripts: 'auto'`) plus `.ttf`/`.otf` files from `--font-dir`, resolves relative images only inside the deck folder (`--asset-dir`), supplies opf-render as the PNG rasterizer for SVG pictures in a PPTX, and never reads a clock (`--date`). `--pdf-mode vector` and `--signals` need an opf-render and opf-pptx that have them; the CLI refuses them otherwise. Full reference: `docs/cli.md` in the core repository.

## Prepared font inputs

Published renderer 0.8.0 and later provides `prepareNodeFonts` in `/fonts-node`
(current coordinated set: core 0.12.0, renderer 0.12.0, PPTX 0.12.1, editor 0.11.1):

```js
const {registry, options} = await prepareNodeFonts({
  pack: 'office', substitutionPolicy: 'visual',
});
const {presentation} = paginatePresentation(document, options);
const slides = renderSvgDeck(presentation, options);
const png = await svgToPng(slides[0], options);
const pptx = await toPptx(presentation, options);
console.log(registry.substitutions);
```

Import the named functions from the same public modules shown below. This helper verifies pinned font/notice hashes and supplies one consistent measurement/SVG/raster option set. `pack: 'base'` suits authored Roboto decks; Office visual substitutions are explicit. It leaves source content, font choices and native font installation unchanged. Renderer 0.7.0 lacks this helper; inspect installed exports before following a recipe for an older package. Native PPTX embedding and pixel equivalence are separate gates.

## Node export

```js
import { renderSvgDeck, svgToPng, svgToPdf } from '@openpresentation/opf-render';
import { loadOfficeFontRegistry } from '@openpresentation/opf-render/fonts-node';
import { toPptx, fromPptx } from '@openpresentation/opf-pptx';

const fonts = await loadOfficeFontRegistry();
const diagnostics = [];
const options = {
  textMeasurement: fonts.textMeasurement,
  onDiagnostic: issue => diagnostics.push(issue),
};
const slides = renderSvgDeck(document, {...options, embeddedFonts: fonts.embeddedFonts});
const rasterOptions = {fontFiles: fonts.fontFiles, useBundledFonts: false, loadSystemFonts: false};
const firstSlidePng = await svgToPng(slides[0], rasterOptions);
const deckPdf = await svgToPdf(slides, rasterOptions);
const pptx = await toPptx(document, options);
// Write the returned strings/bytes to the user's requested local output paths.
// const imported = await fromPptx(inputPptxBytes);
```

The current Node `svgToPdf` accepts one SVG or an array, creating one PDF page per slide. The Node font loader requires its installed font resources. If unavailable, supply explicitly licensed font files through the supported registry API rather than claiming the starter pack was loaded. Pass those same font files to PNG/PDF conversion; embedding fonts in SVG does not by itself configure the Node rasterizer.

`loadOfficeFontRegistry()` defaults to metric substitutions, and its pack includes Intos, a metric-compatible replacement for the Aptos family, so default-scheme (Aptos) decks measure and draw with it. Opt into `{substitutionPolicy:'visual'}` only when a visual-only look-alike is acceptable as a documented fallback (a known layout-fidelity gap), for example Roboto or Carlito for Aptos in a registry without the office pack. Inspect `fonts.substitutions`. An SVG embeds only the bundled font families its text names. Replacements affect previews and measurement only; the exported PPTX keeps the selected font name. Synchronous SVG calls without `textMeasurement` estimate widths; loading a named font only at painting time can create gaps or overlaps between rich runs. Supply the registry to both layout and drawing. Current scalar and code layout preserve authored source whitespace through separate source-mapping contracts; general native rich-text round-trip remains a separate limit.

A raster snapshot embedded into PPTX is not equivalent to editable native shapes. The OPF PPTX converter writes supported native content, but visual and import coverage are incomplete. Verify what the requested deck uses.

## Templates and variables

A deck that declares content variables, or a template (`"template": true`), is resolved by core `resolveVariables` before it is composed, so preview and PPTX agree. Pass the values as the `variables` option of `renderSvg`, `renderSvgDeck`, `resolvePresentation` and `toPptx`. A template previews and exports with each variable's `example` (PPTX reports `variable-example-used` through `onDiagnostic`); a normal deck with an unfilled required variable is refused with code `unfilled-variables`. The PPTX holds the resolved text, so re-import returns the filled deck, not the template. Fill a template into a concrete deck first (`opf fill`) when the deliverable is a finished deck.

## Browser rendering

```js
import { renderSvg } from '@openpresentation/opf-render/svg';
import { loadBrowserFontRegistry } from '@openpresentation/opf-render/fonts-browser';
const fonts = await loadBrowserFontRegistry([
  {url: '/fonts/Roboto-Regular.ttf', family: 'Roboto', weight: 400},
  {url: '/fonts/Roboto-Bold.ttf', family: 'Roboto', weight: 700},
]);
const svg = renderSvg(document, {textMeasurement: fonts.textMeasurement});
// fonts.dispose() on final owner cleanup, not after each slide.
```

The host must provide those files and required additional faces. The loader registers `FontFace` and measures the same bytes. Cross-origin font URLs require CORS. `/svg` is browser-safe; PNG/PDF rasterization belongs to the Node entrypoint. Host UI and CSP determine how SVG is mounted.

Collect diagnostics and inspect actual previews. Font substitutes can preserve some metrics while changing glyph appearance or shaping. Exact schema/editing coverage, shared geometry, native PPTX text, and embedded SVG fonts are separate claims. None alone establishes pixel-identical PowerPoint output.

Text runs and character lists share measured wrapping across SVG and native PPTX. List descriptions and levels affect fitting; paginate between whole entries. Native output uses one editable box per fitted line, with bullets on first body lines. A numbered list (`numbering`) writes native `a:buAutoNum` auto-numbers on those lines, `startAt` set to the counted number, at the marker geometry core composes, and import maps them back. Image bullets and native PowerPoint raster parity remain unverified. Do not infer a lossless rich-list import round trip from export support.

Citations, footnotes and captions (RR-34) draw from the shared geometry: marker fragments are superscript text (native `baseline="30000"` runs in PPTX), the footnote area is a rule plus one tagged text box per listed line (`OPF footnotes <slide> ...`, `OPF_FOOTNOTES_V1`) above the footer placeholders, and a caption is one tagged text box per line (`OPF caption <path> ...`, `OPF_CAPTION_V1`) naming its media shape. Import re-attaches captions and rebuilds `references`, `cite` and `footnote` from those tags and the marker numbers; the deck's references also travel in the document provenance record. Without tags a superscript number stays a superscript run and a text box under a picture stays a text block.
