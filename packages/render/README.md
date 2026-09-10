# OPF Render

Version 0.7.0 requires core 0.9.0 and renders accepted quote and code geometry without fitting it again. Code filename/language/body parts preserve source whitespace, literal tabs and metadata case and expose trace targets for editing. The [43 reviewed code raster changes](docs/evidence/shared-code/raster-review.json) retain the other 762 corpus hashes. Planned coordinated releases PPTX 0.7.0 and editor 0.6.0 will add native source recovery and editing. Glyph containment and separation do not establish native pixel equivalence.

Deterministic local renderer for Open Presentation Format documents. The shared SVG core implements validation, catalog resolution, placeholder binding and text layout. Node APIs additionally convert SVG to PNG and raster-backed PDF.

Code strings that [XML 1.0 cannot represent](https://www.w3.org/TR/xml/#charsets) reject rendering with `invalid-code-text`, the OPF field path and UTF-16 offset. Input JSON stays unchanged. Tabs, line endings and valid supplementary Unicode remain accepted; schema validity and XML serialization do not certify font coverage or native fidelity.

## Scope

- Package: `@openpresentation/opf-render`
- Repository: `OpenPresentation/opf-render`
- License: MIT
- Compatibility target: `@openpresentation/opf`
- Public API: `renderSvg(opf, opts)`, `renderSvgDeck(opf, opts)`, `resolvePresentation(opf, opts)`, `svgToPng(svg, opts)`, and `svgToPdf(svgs, opts)`

`renderSvg` renders a single slide selected by `opts.slideIndex` (default `0`). `renderSvgDeck` returns one SVG string per slide. Both validate OPF at the boundary via `@openpresentation/opf`, resolve inline and bundled catalogs locally, and emit byte-stable SVG for the same input.

```js
import { renderSvgDeck } from "@openpresentation/opf-render";

const svgs = renderSvgDeck(opf, { trace: true });
```

Set `trace: true` to stamp rendered SVG elements with `data-opf-path` values such as `slides.0.title`; omit it for smaller production SVG.

PNG and PDF conversion APIs are async because they load the local raster/PDF engines on demand:

```js
import { renderSvgDeck, svgToPdf, svgToPng } from "@openpresentation/opf-render";

const svgs = renderSvgDeck(opf);
const png = await svgToPng(svgs[0], { scale: 1 });
const pdf = await svgToPdf(svgs, { scale: 1 });
```

`svgToPng` returns PNG bytes for one SVG. `svgToPdf` accepts one SVG or an array of SVGs and returns PDF bytes with one slide per page. The SVG page `width`/`height` or `viewBox` determines the PDF page size; `scale` controls raster density only.

## Browser preview and fonts

Use `@openpresentation/opf-render/svg` for browser rendering without Node dependencies. Browser-aware bundlers also select this shared SVG implementation for the root import; Node's root import retains PNG/PDF conversion.

```js
import { renderSvg } from '@openpresentation/opf-render/svg';
import { loadBrowserFontRegistry } from '@openpresentation/opf-render/fonts-browser';

const fonts = await loadBrowserFontRegistry(fontFileEntries);
container.innerHTML = renderSvg(presentation, {
  textMeasurement: fonts.textMeasurement,
});
// fonts.dispose() when its canvases are unmounted.
```

Each entry contains `url` or `data: Uint8Array`, with optional `family`, `weight`, `italic` and `license`. The loader registers browser FontFaces using the same bytes used for measurement. It fetches only URLs supplied by the host, supports an AbortSignal and custom fetch, and awaits font loading. Use pinned static faces and retain their licenses. For standalone SVG export also pass `embeddedFonts: fonts.embeddedFonts`; embedding is unnecessary for each live draft after browser fonts are loaded.

These browser entrypoints are included in the published package. For coordinated development, the sibling OPF repository's `pnpm pack:ecosystem` prepares local npm tarballs. See the core repository's [live editor guide](https://github.com/OpenPresentation/opf/blob/main/docs/live-editor.md) for installation and the fidelity contract. Identical SVG geometry does not guarantee identical raster pixels across browser engines or PowerPoint.

## Runtime Policy

The package runtime must stay local and deterministic:

- No hosted service in the critical path
- No telemetry or hidden analytics
- No commercial SDK dependency in the critical path
- No required network calls
- No clock, locale, random, or system-font fallback drift in render output
- Host applications own auth, storage, queues, analytics, collaboration, and product workflow

Dependency policy:

- `@openpresentation/opf` is the compatibility source for schemas, validation, and bundled catalogs.
- `@resvg/resvg-js` is used only for local SVG rasterization in Node; it makes no network calls and does not require a browser.
- `pdf-lib` assembles PDF bytes locally. Metadata timestamps are disabled so repeated PDF output is byte-stable for the same SVG input and options.
- Bundled OFL Roboto and Roboto Mono TTF files provide the default deterministic font fallback.
- `svgToPng` and `svgToPdf` disable system-font loading by default. Hosts that require branded fonts should pass explicit `fontFiles` or `fontDirs`; `loadSystemFonts: true` is an opt-in escape hatch and can make output environment-dependent.

Browser support boundary: `renderSvg`, `renderSvgDeck`, and `resolvePresentation` are browser-importable pure JavaScript APIs. `svgToPng` and `svgToPdf` are Node APIs in this package version because they depend on the Node build of resvg.

## Development

```sh
npm ci
npm run build
npm run typecheck
npm run validate
npm test
```

When this repo is checked out beside `openpresentation/opf`, `npm test` also renders every `examples/**/*.opf.json` deck twice and asserts byte-identical SVG output. Golden PNG drift is checked on every run against all 805 slides from the installed core package, identified by a content digest. Changed or missing corpora fail; Git history cannot skip the gate. To generate a review candidate after an intentional visual change:

```sh
npm run golden:update
```

## Release Lane

Public npm package publication is handled by `.github/workflows/npm-publish.yml` with npm provenance.

Required first-publish setup:

1. An npm owner for the `@openpresentation` scope must run the first publish or reserve/grant the `@openpresentation/opf-render` package.
2. Configure npm Trusted Publishing for GitHub repository `OpenPresentation/opf-render` and workflow `.github/workflows/npm-publish.yml`.
3. Publish by pushing a git tag matching `opf-render-v<version>` or `@openpresentation/opf-render@v<version>` (the tag must match the `package.json` version), or by manually running the workflow after CI passes.

This repo does not require an npm automation token when Trusted Publishing is configured.

## Shared dynamic composition (local development)

The current checkout uses `@openpresentation/opf/composition` for portable geometry. Slides can select `auto`, `row`, `column`, or `grid`, set weighted tracks, and request path-specific overflow diagnostics. See the sibling OPF repo's `docs/dynamic-composition.md` for the complete contract.

Version 0.3.0 requires core 0.5.0 and renders rich table cells and headers using canonical `TextRun[]`, including editor trace geometry.

Version 0.2.x requires the published `@openpresentation/opf@^0.4.1` for composition, pagination and measured text. A clean `npm ci && npm test` uses registry packages and runs the full raster corpus without sibling checkouts. For coordinated source development, build OPF and run `node scripts/link-ecosystem.mjs` there; `pnpm test:ecosystem` checks editing, rendering, editable PowerPoint geometry and import together.

For actual font measurement, load `loadBundledFontRegistry()` from `@openpresentation/opf-render/fonts-node`, then pass its `textMeasurement` to rendering and its `embeddedFonts` to SVG export. Pass its `fontFiles` to PNG/PDF conversion. The browser-safe `@openpresentation/opf-render/fonts` entry accepts local font bytes. Missing fonts/glyphs fail explicitly; aliases and fallback are opt-in and recorded in `registry.substitutions`. Bundled font license notices travel with embedded SVG fonts.

Raster updates produce an HTML gallery and `artifacts/golden/candidate.json`; they never overwrite the approved baseline automatically. See [baseline review and known limitations](test/golden/README.md).

Version 0.1.1 adds rich-text line offsets and measured boxes to opt-in SVG tracing, including blank lines, for editor caret placement. Normal SVG/PNG output is unchanged.

## Embedded WebP in PNG/PDF output (since 0.2.0)

PNG and PDF conversion now decode embedded WebP image data URIs to static PNG before rasterization. This preserves fit/crop, transparency, EXIF orientation and the first animation frame. The source SVG and OPF document remain unchanged; browser SVG output keeps the original embedded image. Both href and legacy xlink:href are supported, including base64 and percent-encoded data. This step does not resolve local filenames, download remote images or change the existing host imageResolver contract.

The Node-only raster path lazily loads pinned Sharp 0.35.4, requiring Node 20.9 or later and normal installation of its optional platform binaries. Browser exports do not include the decoder. Malformed embedded WebP produces image-conversion-failed with its data-opf-path when present, otherwise svg.images.N. Decoding has a 40-megapixel limit. PNG/PDF are static outputs; animation beyond the first frame and original image metadata are not retained.

Regression checks compare six fixtures against independent Pillow pixels, verify fit/crop, inspect actual PDF image streams and transparency masks, and exercise input encodings and diagnostics. All 805 existing raster baselines remain unchanged. Test fixtures are project-authored and MIT licensed; the decoder and its bundled codecs retain their upstream licenses.

## JPEG EXIF orientation in raster output (since 0.2.0)

PNG/PDF raster preparation now honors all eight JPEG EXIF orientations. JPEGs with orientation 2–8 are decoded to oriented PNG pixels for rasterization; JPEGs with orientation 1 or no orientation keep their original SVG attribute spelling and compressed bytes. This does not modify the source document or the browser SVG output. The Node path reads JPEG metadata through the same lazy Sharp dependency used for WebP.

Twenty-four cases verify fit/crop, PNG pixels and actual PDF image streams against independent Pillow references (maximum two channel values of decoder difference). Sixteen browser OPF-SVG checks verify orientation and fit/crop with an explicitly incorrect-orientation control. Browser JPEG/PNG scaling differs around high-contrast edges: measured average channel error is below 0.62, but individual differences reach 49. These checks therefore establish geometry/orientation agreement, not pixel-identical output across engines.

`npm test` also builds the browser comparison and rejects native raster modules in browser output. Serve this repository and open `/artifacts/jpeg/browser/index.html` to run it. The harness permits mean channel error up to 1 and at most 2% of channels differing by more than 10; a deliberately unrotated image must fail that criterion.

Version 0.2.0 requires Node 20.9 or later for native image decoding. Browser bundles continue using browser-safe entrypoints.

## Styled and merged table cells

Renderer 0.5.0 requires core 0.7.0 and uses its shared styled-cell geometry. A cell may wrap a scalar or rich value with styles and spans:

```json
{"rows":[[{"value":"Merged heading","colSpan":2,"style":{"fill":"#DBEAFE","align":"center","padding":{"top":12},"borders":{"bottom":{"color":"#445566","width":2,"dash":"dot"}}}},null],["Left","Right"]]}
```

Every covered position is explicit `null`. Each merged anchor renders once; traced text uses its `.value` path for editing. Styles support RGB/RGBA fills and text colors, horizontal and vertical alignment, reference-pixel padding and per-edge solid/dashed/dotted borders. Rich-run colors override the cell text color. Columns remain equal width; rows grow from measured text, padding and span constraints. Pagination preserves connected vertical merge groups.

The Node20/24 renderer suite retains all 805 existing raster baselines. Browser fixtures verify merged text containment and styled-cell typing, formatting, cancellation and undo with actual loaded fonts. Native PowerPoint appearance remains a separate converter verification boundary.
