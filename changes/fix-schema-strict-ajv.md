---
type: fixed
packages: [opf]
---
The published schemas (`spec/schemas`, served at `openpresentation.org/schema/...`) compile under Ajv in its default strict mode again, with no `addKeyword("x-opf-catalog")` and no `--strict=false`. 0.26.2 put a non-validating `x-opf-catalog` annotation into `opf.schema.json` and `theme.schema.json`, which strict Ajv and ajv-cli reject as an unknown keyword. The catalog kind of each reference field now lives in core, as `schemaCatalogKinds` (exported from `@openpresentation/opf/schema`, keyed by schema name and JSON Pointer), and `describeField` and `catalogKindAt` answer exactly as before. New `pnpm check:schema-strict` compiles every published schema with strict Ajv so a vendor keyword cannot return. Validation is unchanged.
