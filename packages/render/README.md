# OPF Render

Deterministic local renderer for Open Presentation Format documents. This repo is the Phase 1 toolkit lane for SVG, PNG, and PDF output.

## Scope

- Package: `@openpresentation/opf-render`
- Repository: `OpenPresentation/opf-render`
- License: MIT
- Compatibility target: `@openpresentation/opf`
- Planned public API: `renderSvg(opf, opts)`, `svgToPng(svg, opts)`, and `svgToPdf(svgs, opts)`

Feature implementation is intentionally not in this provisioning slice. The first implementation task owns validation, catalog resolution, placeholder binding, SVG emission, and deterministic golden tests.

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
npm run validate
```

## Release Lane

Public npm package publication is handled by `.github/workflows/release.yml` with npm provenance.

Required first-publish setup:

1. An npm owner for the `@openpresentation` scope must run the first publish or reserve/grant the `@openpresentation/opf-render` package.
2. Configure npm Trusted Publishing for GitHub repository `OpenPresentation/opf-render` and workflow `.github/workflows/release.yml`.
3. Publish by creating a GitHub Release or manually running the Release workflow after CI passes.

This repo does not require an npm automation token when Trusted Publishing is configured.
