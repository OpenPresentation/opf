---
type: changed
packages: [opf]
---
LH-80 (output-changing for a table beside a picture with estimated text widths): a table beside a picture track keeps every cell on one line where some track allows it, as before. When no track does, LH-75's allowance now holds, so a cell may wrap onto two lines with its words whole and the table keeps its type size. The picture then takes its track instead of staying a small framed picture in the flow (m17 with estimated widths). With measured office fonts m17 keeps its full-height track and its one-line cells.
