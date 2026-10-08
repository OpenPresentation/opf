---
type: changed
packages: [opf]
---
FA-28 (docs and schema descriptions only): one rule for `items` versus `bullets`. Both draw the same list; `bullets` is for plain talking points (inferred `text`, no `description`) and `items` for entries that share a shape or carry a `description` (inferred `list`), and a block or region holds one of the two, never both. Stated in the content-payloads guide, the format card, the authoring skill and the schema descriptions of both fields.
