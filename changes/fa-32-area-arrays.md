---
type: changed
packages: [cli]
---

Layout `areas` now uses nested arrays of cell names instead of space-separated row strings. Each inner array is one row; repeated names span a rectangular region and `.` is an empty cell. Schemas, engines, examples and authoring documentation use the same array-only contract.
