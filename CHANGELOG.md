# Changelog

## 0.6.0

- Add shared `layoutTable` geometry and fitting to the composition API. Wrapped and multiline rows grow into available space; constrained tables reduce spare row height before readable text, preserve complete cells and report real overflow. Short rows keep their existing preferred height.
- Add optional uniform rich-text line advances for native table spacing. The coordinated renderer and PPTX exporter consume the same row and text geometry. No schema change is required.
- Rebuild CLI 0.3.0 with bundled core 0.6.0. Shared variable-row geometry is available in renderer/PPTX 0.4.0 and editor 0.3.0; PPTX 0.4.0 also imports supported native rich table text.

## 0.5.0

- Accept canonical `TextRun[]` values in table cells and column headers, alongside existing scalar cells and string headers. Measure rich cells with their actual font and run styles for overflow detection and pagination; preserve complete rows and repeated headers without mutating the document.
- Rebuild the standalone CLI as 0.2.0 with bundled OPF 0.5.0. The generated table types now include rich arrays, so consumers that exhaustively handle scalar cells or string-only headers must handle the additional form.
- Rich table rendering, editor interactions and editable PPTX export are available in renderer 0.3.0, editor 0.2.0 and PPTX 0.3.0. Older core 0.4.1 does not accept this syntax; native PPTX import still flattens table text.

## 0.4.1

- Replace the truncated PNG in the asset-source-forms example with a complete project-authored image so the inline asset can render and export.

- Rebuild the standalone CLI as 0.1.1 with bundled OPF 0.4.1.
- Verify the corrected example corpus against the reviewed renderer baseline and coordinated image/PPTX fidelity commits.

## 0.4.0

Published to npm on 2026-09-08 (UTC): [`@openpresentation/opf@0.4.0`](https://www.npmjs.com/package/@openpresentation/opf/v/0.4.0). See the [tagged release](https://github.com/OpenPresentation/opf/releases/tag/opf-v0.4.0) for the exact source snapshot.

### Added

- Shared composition, nested groups, weighted tracks, measured rich text and lists, overflow diagnostics, and explicit content-preserving pagination.
- CSV/TSV/JSON conversion for native table and chart content, with browser-safe `./composition`, `./pagination`, and `./data` package exports.
- Six portable agent skills for authoring, layout, presets, editing, export, and inspection, with shared APIs for validating and paginating OPF presentations.
- Coordinated source and packed-consumer verification across the open renderer, editor, and PPTX packages.

### Changed

- Smaller structural schema/catalog declarations and shared build chunks, retaining typed named schema definitions. Consumers that relied on inferred deeply nested literal types should use the schema values as JSON data or generated presentation types.
- Catalog index schemas and narrative index consistency, accurate preview byte counts, spec-integrity checks, and Node 20/24 test discovery.

### Compatibility and verification

The JSON format keeps its existing catalog IDs and adds nested composition. The raw narrative catalog index uses `records` instead of `templates`. This minor version acknowledges the structural TypeScript declaration changes. Renderer, editor and PPTX package releases must require this core version before their new composition features support standalone installation. Schema acceptance does not establish visual fidelity; advanced editing, media, fonts and native PowerPoint comparisons remain documented work.

The release source also prepares a standalone, bundled `@openpresentation/cli@0.1.0`. It is a separate package and was not published with this core release.

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
