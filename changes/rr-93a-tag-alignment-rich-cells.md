---
type: fixed
packages: [opf]
---
RR-93a (output-changing for slides with a tag): the slide tag (eyebrow) follows `titleAlignment` (left when none resolves), like the title, instead of `contentAlignment`, so a layout such as `metrics` that centres its content no longer centres the tag over a left-aligned title; only the slide's own `design.contentAlignment` keeps the tag on content alignment, as on a cover. A rich (`TextRun[]`) body cell in a numeric column keeps the column's right alignment, and `TableCellStyle` gains `bold` so a number cell can be bold and still use its number `format`.
