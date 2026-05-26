# OPF PPTX

Pure local PowerPoint conversion tooling for Open Presentation Format documents. This repo owns the Phase 3 and Phase 4 toolkit lanes: OPF to PPTX export and PPTX to OPF import.

## Scope

- Package: `@openpresentation/opf-pptx`
- Repository: `OpenPresentation/opf-pptx`
- License: MIT
- Compatibility target: `@openpresentation/opf`
- Renderer relationship: may use `@openpresentation/opf-render` for chart rasterization and visual verification
- Planned public API: `toPptx(opf, opts)` and `fromPptx(buffer, opts)`

Feature implementation is intentionally not in this provisioning slice. The first implementation task owns local OOXML packaging, deterministic ZIP output, and round-trip validation.

## Runtime Policy

The package runtime must stay local and deterministic:

- No hosted service in the critical path
- No telemetry or hidden analytics
- No commercial SDK dependency in the critical path
- No required network calls
- No required AI dependency
- No required LibreOffice dependency in the runtime path; LibreOffice is allowed only as an optional verification tool in CI
- Host applications own auth, storage, queues, analytics, collaboration, branding, and product workflow

## Development

```sh
npm ci
npm run build
npm run validate
```

## Release Lane

Public npm package publication is handled by `.github/workflows/release.yml` with npm provenance.

Required first-publish setup:

1. An npm owner for the `@openpresentation` scope must run the first publish or reserve/grant the `@openpresentation/opf-pptx` package.
2. Configure npm Trusted Publishing for GitHub repository `OpenPresentation/opf-pptx` and workflow `.github/workflows/release.yml`.
3. Publish by creating a GitHub Release or manually running the Release workflow after CI passes.

This repo does not require an npm automation token when Trusted Publishing is configured.
