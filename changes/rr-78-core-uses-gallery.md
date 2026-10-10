---
type: changed
packages: [opf, cli]
---
RR-78 (breaking, OPF 0.19): the pptx.gallery catalog moved out of core into the package `@openpresentation/gallery`, which is released on its own version line. Core and the CLI now depend on `@openpresentation/gallery@^1`.
    - `@openpresentation/opf/catalog` is removed with no alias, and so are `defaultCatalog`, `DEFAULT_CATALOG_SOURCE`, `catalogDisplay`, `catalogIndexes` and the layout previews it exported. Import them from the gallery package instead: `import { gallery } from "@openpresentation/gallery"`, then `catalogs: [gallery]`. `defaultCatalog` is now `gallery`, `DEFAULT_CATALOG_SOURCE` is now `GALLERY_SOURCE`, and the previews come from `@openpresentation/gallery/previews`.
    - The package no longer ships `spec/catalogs/` or `spec/previews/`, so `@openpresentation/opf/spec/catalogs/...` and `.../spec/previews/...` no longer resolve. Records are served at `https://www.pptx.gallery/<kind>/<id>.json`, and the companion schemas stay in `spec/schemas/`.
    - In Node, `open`, `save`, `convert`, `validate`, `stats`, `paginate`, `embed` and `edit` register `gallery` when a call names no catalogs, and so does every CLI command. The browser build still registers none.
    - Core's root exports `CATALOG_SCHEMA` (`1`), the version of the catalog record schemas it reads. A gallery that declares another version (`CATALOG_SCHEMA`, `opf.catalogSchema`) is never registered: the Node defaults throw `OPFApiError` `gallery-schema-mismatch`, and the CLI stops with the same code and exit 2.
