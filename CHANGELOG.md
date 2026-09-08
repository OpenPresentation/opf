# Changelog

## 0.4.0

Prepared for release; not yet published.

### Added

- Shared composition, nested groups, weighted tracks, measured rich text and lists, overflow diagnostics, and explicit content-preserving pagination.
- CSV/TSV/JSON conversion for native table and chart content, with browser-safe `./composition`, `./pagination`, and `./data` package exports.
- A standalone agent CLI and six portable skills for authoring, inspecting, validating, editing, and paginating OPF presentations.
- Coordinated source and packed-consumer verification across the open renderer, editor, and PPTX packages.

### Changed

- Smaller structural schema/catalog declarations and shared build chunks, retaining typed named schema definitions. Consumers that relied on inferred deeply nested literal types should use the schema values as JSON data or generated presentation types.
- Catalog index schemas and narrative index consistency, accurate preview byte counts, spec-integrity checks, and Node 20/24 test discovery.
- CLI validation reports stay on stdout for valid and invalid documents. Usage, JSON and I/O errors use exit 2; validation and edit conflicts use exit 1. The CLI is bundled and has no runtime package dependency.

### Compatibility and verification

The JSON format keeps its existing catalog IDs and adds nested composition. The raw narrative catalog index uses `records` instead of `templates`. This minor version acknowledges the structural TypeScript declaration changes. Renderer, editor and PPTX package releases must require this core version before standalone installation is supported. Schema acceptance does not establish visual fidelity; advanced editing, media, fonts, historical raster baselines and native PowerPoint comparisons remain documented work.

## 0.3.0

### Added

- Added [`docs/how-opf-works.md`](./docs/how-opf-works.md), a conceptual introduction to the format: the document model, the three content shapes, layouts-as-hints, narrative beats, catalog resolution, and the validation philosophy.
- Added [`docs/design-resolution.md`](./docs/design-resolution.md), an explicit design precedence algorithm (slide design → deck design → resolved theme → engine defaults) with worked examples.
- Added a `warnings` array to `ValidationResult`. The validator now warns — never errors — on unknown bare catalog ids (`narrative`, `design.theme`, `design.colorScheme`, `design.fontScheme`, chart `type`) and on broken catalog cross-links in audience, purpose, and tone records (`recommendedNarratives`, `recommendedTones`). Documents that declare matching inline `catalogs.<kind>.records[]` or a custom `catalogs.<kind>.source` are exempt. Warnings never affect `valid` or `assertValid`.
- Added [`spec/README.md`](./spec/README.md) orienting readers to the spec directory layout, including what the optional `spec/openapi.yaml` reference contract is for.
- Bundled example decks and catalog cross-links are now checked for unknown catalog ids in the package test suite.
- Added [`examples/technical/full-feature-tour.opf.json`](./examples/technical/full-feature-tour.opf.json), a single fixture exercising every major schema surface: intent metadata, organizations and speakers, narrative beat overrides, design with slide-level overrides, assets, inline catalog records, all ten content payload kinds, blocks, regions, hidden slides, and extensions.
- Expanded `docs/how-opf-works.md` with an anatomy diagram, the region-grid diagram, a catalog-resolution flow diagram, and runnable examples for every content shape, plus a complete small deck. Added the precedence-stack and base-plus-overrides diagrams to `docs/design-resolution.md` and the region-grid cheat sheet to `docs/content-payloads.md`.
- Presentation-shaped JSON examples embedded in the shipped docs are now validated in the package test suite, so documentation examples cannot drift from the schema.
- Added span-composition diagrams (sidebar + main, headline band + body, and their combination) to the region docs in `docs/how-opf-works.md` and `docs/content-payloads.md`.
- Added a "Start in three steps" section to the README and a root `llms.txt` index so human and agent adopters both get a direct path from problem to first validated deck.
- Shipped every `.opf.json` deck under `examples/` inside the npm package and exposed them via `@openpresentation/opf/examples` (`examples`, `galleries`, `exampleCategories`, `getExample`, `getGallery`, `getExamplesByGallery`, `getExamplesByCategory`). Each example deck is validated against the presentation schema at build time.
- Shipped the top-level `docs/*.md` reference pages inside the npm package and exposed them via `@openpresentation/opf/docs` (`docs`, `getDoc`). Subdirectories like `docs/migrations` and `docs/plans` are intentionally excluded.
- Shipped the upstream `README.md` markdown at the pinned release version via `@openpresentation/opf/repo-readme` so consumer sites can mirror it without a network fetch.
- Repositioned the repo docs around the OpenPresentation OSS boundary: specs, catalogs, examples, local validation, and planned local render/edit/convert libraries, with hosted service layers left to downstream applications.

## 0.2.2

### Changed

- Accepted mixed slide-root content payload shorthand as implicit layout-agnostic blocks when no explicit type, blocks, or regions are present.
- Allowed a single string shorthand for `audience` in addition to the existing array form.
- Documented the mixed slide-root payload shorthand in schema and content payload references.

## 0.2.1

_Prepared internally as `0.2.0` (see [`docs/migrations/0.2.0.md`](./docs/migrations/0.2.0.md) for the breaking catalog change drafted under that name), but the version was bumped straight to `0.2.1` before ever being published — `0.2.0` has no npm release or git tag. The changes below are what actually shipped, as `0.2.1`, the first release after `0.1.0`._

### Breaking Changes

- Corrected the United Kingdom chart catalog ID from the removed misspelled slug to `united-kingdom`. See [`docs/migrations/0.2.0.md`](./docs/migrations/0.2.0.md).

### Added

- Added typed raw spec file manifest exports at `@openpresentation/opf/spec-files`.
- Added a GitHub Actions npm publish workflow for semver tags with npm provenance.
- Added layout preview generation (`generate-previews.mjs`, `render-layout-previews.mjs`) and a `previews.ts` module exporting an HTML preview per canonical layout record.

### Changed

- Marked `@openpresentation/opf` as a public npm package.
- Kept the canonical spec npm artifact on the existing `@openpresentation/opf` package instead of adding a separate `@openpresentation/opf-spec` package.
- Removed Xano-hosted chart preview URL objects from the bundled chart-type catalog records and chart-type index.
- Kept the JavaScript package boundary local and format-level: schemas, catalogs, generated TypeScript types, and local validation only.
- Included the full raw `spec/` tree in the packed JavaScript package, including the optional downstream-service reference `spec/openapi.yaml`, schemas, catalogs, reference files, and catalog indexes.
- Clarified that the OPF CLI remains local-only and is not published as part of `@openpresentation/opf`.

### Not Included

- No hosted rendering, parsing, generation, remote catalog fetching, or hosted-service client behavior is included in this release-prep change.

## 0.1.0

First published release of `@openpresentation/opf` to npm.

### Added

- Published `@openpresentation/opf` to npm, dropping `private: true` and bumping the package version from `0.0.0` to `0.1.0`.

### Changed

- Updated the package README to lead with `pnpm add @openpresentation/opf` instead of workspace build instructions, and reframed the top-level README around installing the published package.
- Noted that the schema is pre-stable (0.x) and may include breaking changes between minor versions before a 1.0 release.
