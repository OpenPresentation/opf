---
type: changed
---
RR-73 (breaking, OPF 0.18; needs core 0.18): `@openpresentation/opf-editor/data` re-exports core's `ingest` and `IngestOptions` in place of `importData` and `ImportDataOptions`, with no alias. `prepareDatasetImport` takes the same content, and its error message and docs name `ingest`. Replace `importData(` with `ingest(`.
