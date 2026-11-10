---
type: changed
packages: [opf, render, pptx]
---

Prepare Node fonts by the document's actual family, weight and style instead of eagerly loading every face in a pack. Preserve explicit whole-pack loading without a presentation and caller-supplied faces; load missing styles and glyph fallbacks through serialized ensure. Share the same preferred-family metadata as physical font selection and forward real catalog/export context through conversion and pagination.
