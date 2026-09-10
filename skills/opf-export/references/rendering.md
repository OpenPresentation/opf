# Rendering and conversion APIs

## Prepared font inputs (unpublished source)

The coordinated renderer source adds `prepareNodeFonts` in `/fonts-node`:

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

Import the named functions from the same public modules shown below. This helper verifies pinned font/notice hashes and supplies one consistent measurement/SVG/raster option set. `pack: 'base'` suits authored Roboto decks; Office visual substitutions are explicit. It leaves source content, font choices and native font installation unchanged. Renderer 0.7.0 does not include this helper; inspect the installed exports and use the existing loader recipe for published packages. Native PPTX embedding and pixel equivalence are separate gates.

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

`loadOfficeFontRegistry()` defaults to metric substitutions. Opt into `{substitutionPolicy:'visual'}` when approximate alternatives such as Carlito for Aptos are acceptable, and inspect `fonts.substitutions`. Synchronous SVG calls without `textMeasurement` estimate widths; loading a named font only at painting time can create gaps or overlaps between rich runs. Supply the registry to both layout and drawing. Plain core fitting still normalizes whitespace; code has a separate source-preserving layout contract.

A raster snapshot embedded into PPTX is not equivalent to editable native shapes. The OPF PPTX converter writes supported native content, but visual and import coverage are incomplete. Verify what the requested deck uses.

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

Text runs and character lists share measured wrapping across SVG and native PPTX. List descriptions and levels affect fitting; paginate between whole entries. Native output uses one editable box per fitted line, with bullets on first body lines. Image bullets and native PowerPoint raster parity remain unverified. Do not infer a lossless rich-list import round trip from export support.
