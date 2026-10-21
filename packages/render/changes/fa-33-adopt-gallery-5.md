---
type: changed
---
FA-33 (needs core with FA-33; no renderer code or pixel changes): the development and test dependency `@openpresentation/gallery` moves from `^4.0.0` to `^5.0.0` (theme variants, layouts as one list of regions, catalog schema 4), so the suites read Gallery 5's records instead of Gallery 4's `areas` layouts. The published package declares no runtime dependency on Gallery; hosts still register the catalogs they choose.
