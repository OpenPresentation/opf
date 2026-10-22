---
type: added
packages: []
---
MR-40: one-click release of the six packages. `.github/workflows/release.yml` (version and dry-run inputs) gates on the nightly set, prepares the release commit and pushes it with the tag `vX.Y.Z`; `.github/workflows/npm-publish.yml` publishes core, CLI, renderer, PPTX exporter, editor and gallery at one version in dependency order with provenance and an explicit dist-tag, verifies the registry and creates the GitHub release. `scripts/release.mjs` provides `prepare`, `pack`, `smoke`, `check-publish`, `publish`, `verify` and `notes`.
