---
type: added
packages: [opf, render, pptx, editor]
---

A slide can set its own `language` (a BCP-47 tag or inline Language object). Direction, script fonts, quotation marks, line breaking and number formatting follow the slide; omission inherits the deck language and a run's `lang` still wins. Markdown supports `<!-- slide: language=ar-SA -->`, source completion exposes the field, and PPTX language/script slots and import preserve it. An Arabic slide in an English deck now writes its selected complex-script font instead of relying on an application fallback.
