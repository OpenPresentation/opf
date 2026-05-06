# Changelog

## 0.2.0 - Pending npm publish approval

### Breaking Changes

- Corrected the United Kingdom chart catalog ID from the removed misspelled slug to `united-kingdom`. See [`docs/migrations/0.2.0.md`](./docs/migrations/0.2.0.md).

### Changed

- Marked `@openpresentation/opf` as a public npm package at version `0.2.0`.
- Removed Xano-hosted chart preview URL objects from the bundled chart-type catalog records and chart-type index.
- Kept the JavaScript package boundary local and format-level: schemas, catalogs, generated TypeScript types, and local validation only.
- Excluded the legacy PPTX.dev OpenAPI service contract from the packed JavaScript package while retaining the source file in the repository for service reference.
- Clarified that the OPF CLI remains local-only and is not published as part of `@openpresentation/opf` v0.2.0.

### Not Included

- No hosted rendering, parsing, generation, remote catalog fetching, PPTX.dev client behavior, or npm publish action is included in this release-prep change.
