# OPF Render

Deterministic local renderer for Open Presentation Format documents. This repo is the Phase 1 toolkit lane for SVG, PNG, and PDF output. The current package implements the validation, catalog resolution, placeholder binding, deterministic text layout, and SVG core that PNG/PDF conversion will build on.

## Scope

- Package: `@openpresentation/opf-render`
- Repository: `OpenPresentation/opf-render`
- License: MIT
- Compatibility target: `@openpresentation/opf`
- Public API: `renderSvg(opf, opts)`, `renderSvgDeck(opf, opts)`, and `resolvePresentation(opf, opts)`
- Planned conversion API: `svgToPng(svg, opts)` and `svgToPdf(svgs, opts)`

`renderSvg` renders a single slide selected by `opts.slideIndex` (default `0`). `renderSvgDeck` returns one SVG string per slide. Both validate OPF at the boundary via `@openpresentation/opf`, resolve inline and bundled catalogs locally, and emit byte-stable SVG for the same input.

```js
import { renderSvgDeck } from "@openpresentation/opf-render";

const svgs = renderSvgDeck(opf, { trace: true });
```

Set `trace: true` to stamp rendered SVG elements with `data-opf-path` values such as `slides.0.title`; omit it for smaller production SVG.

## Runtime Policy

The package runtime must stay local and deterministic:

- No hosted service in the critical path
- No telemetry or hidden analytics
- No commercial SDK dependency in the critical path
- No required network calls
- No clock, locale, random, or system-font fallback drift in render output
- Host applications own auth, storage, queues, analytics, collaboration, and product workflow

## Development

```sh
npm ci
npm run build
npm run typecheck
npm run validate
npm test
```

When this repo is checked out beside `openpresentation/opf`, `npm test` also renders every `examples/**/*.opf.json` deck twice and asserts byte-identical SVG output.

## Release Lane

Public npm package publication is handled by `.github/workflows/release.yml` with npm provenance.

Required first-publish setup:

1. An npm owner for the `@openpresentation` scope must run the first publish or reserve/grant the `@openpresentation/opf-render` package.
2. Configure npm Trusted Publishing for GitHub repository `OpenPresentation/opf-render` and workflow `.github/workflows/release.yml`.
3. Publish by creating a GitHub Release or manually running the Release workflow after CI passes.

This repo does not require an npm automation token when Trusted Publishing is configured.
