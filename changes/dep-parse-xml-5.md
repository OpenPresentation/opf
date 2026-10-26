---
type: changed
packages: [pptx]
---
The runtime dependency `@rgrove/parse-xml` moves from 4.2.3 to 5.0.0 (the vendored engine's OMML and XML validation). The API is unchanged and PPTX output is byte-identical; the parser is now an ES module and its own minimum Node is 22.12.
