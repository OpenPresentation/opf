---
type: added
packages: [opf]
---
`describeFinding` writes the message and a `next` hint of every `opf/*` rule in plain words (fields in backticks, no JSON Pointers, concrete values from the finding and the document), and `explain(ruleId)` returns a rule's summary, rationale, fix and a before/after example; `explain` is exported from the package root and `@openpresentation/opf/source`.
