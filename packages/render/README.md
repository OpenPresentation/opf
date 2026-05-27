# OPF Render

Deterministic local renderer for Open Presentation Format documents. This repo is the Phase 1 toolkit lane for SVG, PNG, and PDF output. The current package implements the validation, catalog resolution, placeholder binding, deterministic text layout, and SVG core that PNG/PDF conversion will build on.

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

When this repo is checked out beside `openpresentation/opf`, `npm test` also renders every `examples/**/*.opf.json` deck twice and asserts byte-identical SVG output. Golden PNG drift is checked against `test/golden/opf-examples-png.sha256.json` when the sibling corpus is at the approved OPF commit. To regenerate the approved PNG hash manifest after an intentional visual change:

```sh
OPF_EXAMPLES_DIR=/path/to/opf/examples npm run golden:update
```

## Release Lane

Public npm package publication is handled by `.github/workflows/npm-publish.yml` with npm provenance.

Required first-publish setup:

1. An npm owner for the `@openpresentation` scope must run the first publish or reserve/grant the `@openpresentation/opf-render` package.
2. Configure npm Trusted Publishing for GitHub repository `OpenPresentation/opf-render` and workflow `.github/workflows/npm-publish.yml`.
3. Publish by pushing a git tag matching `opf-render-v<version>` or `@openpresentation/opf-render@v<version>` (the tag must match the `package.json` version), or by manually running the workflow after CI passes.

This repo does not require an npm automation token when Trusted Publishing is configured.
