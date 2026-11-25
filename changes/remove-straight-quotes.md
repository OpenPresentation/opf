---
type: changed
packages: [opf]
---
Removed the `opf/straight-quotes` check and its `use-typographic-quotes` fix: straight quotation marks are valid characters the author chose, and a validator should not question which characters a text uses. `validate` rejects an unknown rule id with a `TypeError`, so a caller that names `opf/straight-quotes` in `only`, `ignore`, `severity` or `ignorePaths` must take it out of those lists. The engines still draw the language's marks around a quote payload.
