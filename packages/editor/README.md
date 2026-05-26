# OPF Editor

Embeddable local editor primitives for Open Presentation Format documents. This repo is the Phase 2 toolkit lane for WYSIWYG bindings and optional UI components.

## Scope

- Package: `@openpresentation/opf-editor`
- Repository: `OpenPresentation/opf-editor`
- License: MIT
- Compatibility target: `@openpresentation/opf`
- Renderer relationship: built on `@openpresentation/opf-render` trace output
- Planned public API: headless JSON edit bindings plus optional React or Svelte components

Feature implementation is intentionally not in this provisioning slice. The first implementation task owns trace binding, click-to-edit primitives, structured controls, and JSON Patch history.

## Runtime Policy

The package runtime must stay local and deterministic:

- No hosted service in the critical path
- No telemetry or hidden analytics
- No commercial SDK dependency in the critical path
- No required network calls
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

1. An npm owner for the `@openpresentation` scope must run the first publish or reserve/grant the `@openpresentation/opf-editor` package.
2. Configure npm Trusted Publishing for GitHub repository `OpenPresentation/opf-editor` and workflow `.github/workflows/release.yml`.
3. Publish by creating a GitHub Release or manually running the Release workflow after CI passes.

This repo does not require an npm automation token when Trusted Publishing is configured.
