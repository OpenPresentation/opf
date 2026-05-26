# Changelog

## Unreleased

### Added

- Shipped every `.opf.json` deck under `examples/` inside the npm package and exposed them via `@openpresentation/opf/examples` (`examples`, `galleries`, `exampleCategories`, `getExample`, `getGallery`, `getExamplesByGallery`, `getExamplesByCategory`). Each example deck is validated against the presentation schema at build time.
- Shipped the top-level `docs/*.md` reference pages inside the npm package and exposed them via `@openpresentation/opf/docs` (`docs`, `getDoc`). Subdirectories like `docs/migrations` and `docs/plans` are intentionally excluded.
- Shipped the upstream `README.md` markdown at the pinned release version via `@openpresentation/opf/repo-readme` so consumer sites can mirror it without a network fetch.
- Repositioned the repo docs around the OpenPresentation OSS boundary: specs, catalogs, examples, local validation, and planned local render/edit/convert libraries, with hosted service layers left to downstream applications.

## 0.2.2

### Changed

- Accepted mixed slide-root content payload shorthand as implicit layout-agnostic blocks when no explicit type, blocks, or regions are present.
- Allowed a single string shorthand for `audience` in addition to the existing array form.
- Documented the mixed slide-root payload shorthand in schema and content payload references.

## 0.2.0 - Pending npm publish approval

### Breaking Changes

- Corrected the United Kingdom chart catalog ID from the removed misspelled slug to `united-kingdom`. See [`docs/migrations/0.2.0.md`](./docs/migrations/0.2.0.md).

### Changed

- Marked `@openpresentation/opf` as a public npm package at version `0.2.0`.
- Kept the canonical spec npm artifact on the existing `@openpresentation/opf` package instead of adding a separate `@openpresentation/opf-spec` package.
- Removed Xano-hosted chart preview URL objects from the bundled chart-type catalog records and chart-type index.
- Kept the JavaScript package boundary local and format-level: schemas, catalogs, generated TypeScript types, and local validation only.
- Included the full raw `spec/` tree in the packed JavaScript package, including the optional downstream-service reference `spec/openapi.yaml`, schemas, catalogs, reference files, and catalog indexes.
- Added typed raw spec file manifest exports at `@openpresentation/opf/spec-files`.
- Added a GitHub Actions npm publish workflow for semver tags with npm provenance.
- Clarified that the OPF CLI remains local-only and is not published as part of `@openpresentation/opf` v0.2.0.

### Not Included

- No hosted rendering, parsing, generation, remote catalog fetching, or hosted-service client behavior is included in this release-prep change.
