---
type: changed
packages: [opf, cli]
---
MR-62 (breaking, no alias): remove the `gallery-schema-mismatch` runtime refusal. Core and the gallery now release in lockstep at one version, so core no longer checks at load time that the installed `@openpresentation/gallery` declares the catalog record schema it reads: `galleryMismatch` is removed from the Node engine (`@openpresentation/opf/internal/engine`), the Node defaults (`validate`, `stats`, `paginate`, `open`, `save`, `convert`, ...) never throw `OPFApiError` `gallery-schema-mismatch`, and the CLI no longer stops every command with that code. `CATALOG_SCHEMA` (root export) and `opf.catalogSchema` (catalog packages' `package.json`) stay as the public contract for third-party catalogs; a new root check, `pnpm check:catalog-schema`, fails the build when core's and the gallery's constants differ.
