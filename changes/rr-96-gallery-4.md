---
type: changed
packages: [opf, cli]
---
Breaking for documents that name the `dark` theme: the `@openpresentation/gallery` dependency moves to `^4.0.0` (RR-96), and Gallery 4 removes the `dark` theme because dark is now a `design.variant` of every theme. `design.theme: "dark"` is an unresolved reference (`opf/unresolved-reference`) and the deck falls back to the engine default theme. Use a theme with a dark variant instead, for example `{ "theme": "classic", "variant": "dark1" }`, plus `colorScheme: "boost"` and `fontScheme: "seaford"` for the old dark look. The gallery examples that named `dark` now use `classic` (with `variant: "dark1"` where the deck's own background is `dark1`), their embedded theme records carry the new `variants`, and seven layout previews are redrawn (`chart`, `chart-beside`, `code`, `dashboard`, `table`, `table-beside`, `timeline`). `CATALOG_SCHEMA` stays 3.
