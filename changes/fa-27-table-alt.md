---
type: added
packages: [opf, cli]
---
FA-27 (additive schema; lockstep with the renderer, PPTX and editor): `Table.alt`, the text alternative for a table, mirroring `Chart.alt`: what the table shows (the point and the key numbers), not "a table". `""` marks a table decorative. The preview exposes it as the table's accessible name, the PowerPoint export writes it as the table frame's `descr` and import reads it back. Core adds no validation rule: a native table is read cell by cell, so `validate` neither asks for a table alt nor reports an empty one, and a table keeps counting as text beside a chart for `opf/chart-text-alternative`. The Markdown dialect round trips it (a pipe table has no syntax for it, so a table with `alt` is written as an `opf-block`).
