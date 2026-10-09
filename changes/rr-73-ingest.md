---
type: changed
packages: [opf, cli]
---
RR-73 (breaking, OPF 0.18): `importData` and `opf import-data` are renamed `ingest` and `opf ingest`, with no alias. The function is exported from the package root and `@openpresentation/opf/data`, and its options type `ImportDataOptions` is now `IngestOptions`; `ImportedTable`, `ImportedChart` and `OPFDataImportError` keep their names. The CLI command takes the same flags and gives the same report, output and exit codes; `opf import-data` is now an unknown command (usage error, exit 2). Replace `importData(` with `ingest(` and `opf import-data` with `opf ingest`.
