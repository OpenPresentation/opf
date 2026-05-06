# Changelog

## 0.2.0 - Pending npm publish approval

### Breaking Changes

- Corrected the United Kingdom chart catalog ID from the removed misspelled slug to `united-kingdom`. See [`docs/migrations/0.2.0.md`](./docs/migrations/0.2.0.md).

### Changed

- Marked `@openpresentation/opf` as a public npm package at version `0.2.0`.
- Kept the canonical spec npm artifact on the existing `@openpresentation/opf` package instead of adding a separate `@openpresentation/opf-spec` package.
- Removed Xano-hosted chart preview URL objects from the bundled chart-type catalog records and chart-type index.
- Kept the JavaScript package boundary local and format-level: schemas, catalogs, generated TypeScript types, and local validation only.
- Included the full raw `spec/` tree in the packed JavaScript package, including `spec/openapi.yaml`, schemas, catalogs, reference files, and catalog indexes.
- Added typed raw spec file manifest exports at `@openpresentation/opf/spec-files`.
- Added a GitHub Actions npm publish workflow for semver tags with npm provenance.
- Clarified that the OPF CLI remains local-only and is not published as part of `@openpresentation/opf` v0.2.0.

### Not Included

- No hosted rendering, parsing, generation, remote catalog fetching, or PPTX.dev client behavior is included in this release-prep change.
