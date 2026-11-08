---
type: changed
packages: [opf, gallery]
drawing: ["layouts:team"]
---
LH-187 (output-changing for a team of five or six people with side portraits): each person's card now takes its whole cell, so the rows fill the body as four people with portraits across the top already do. The picture and the text sit in the middle of the card. The portrait grows with the card, up to `PORTRAIT_SIDE_FILL` (0.6) tall for its width, and the text keeps its size. Narrative n23 now fills its two rows.
