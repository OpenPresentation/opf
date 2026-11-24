---
type: added
packages: [editor]
---
`updateJsonSource` (`@openpresentation/opf-editor/exact-source`) takes a fourth argument, `{ duplicateKeys: "reject" }`, that throws a `DuplicateKeyError` (`code: "duplicate-key"`, the `key`, its `path`, and the `offset`, `line` and `column` of the repeated key) when the source repeats an object key, instead of rewriting the whole document as indented JSON. The default is unchanged.
