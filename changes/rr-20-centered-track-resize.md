---
type: fixed
packages: [opf, editor]
---

Content-sized track resizing keeps the document and history unchanged at rest, preserves outer space and existing type when first creating weighted cells, and clamps or explains moves that need smaller text. Pointer dividers now follow the actual gap and logical track direction in left-to-right and right-to-left rows; deliberate resizing can still reflow text inside its new cells.

Decorative text tiles respect effective authored row/column direction, column limits and weights. The same eligibility rule allows the existing body-growth path when those tiles cannot apply, keeping fitting text at its accepted display size and the editor flow frames consistent with actual rendered blocks.
