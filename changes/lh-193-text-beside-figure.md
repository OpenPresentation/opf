---
type: changed
packages: [opf]
---
LH-193 (output-changing for layout slides with one chart or picture and short text): a plain text or list alone in its region beside a layout's one chart, or beside a picture in a `media` region (`image-beside`, `hero`), grows as the lone block of its cell, as one text beside a chart already did: "Look here." beside a picture no longer stays at body size. Several texts each alone in a one-block region beside the chart (the columns of `three-column`) grow too and keep their whole column: their cards stay one height and one top beside the chart's card, with the text in the middle of each. A text that shares its region with another text (a `hero`'s lead over its body), and a picture in a plain column (`two-column`), keep their layout.
