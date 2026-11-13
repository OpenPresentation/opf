---
type: fixed
packages: [opf, render, pptx]
---
RR-105: a reference line's label no longer sits on a bar or an area: when its own end has no free place above or below the line, it moves to the other end of the line (the import still returns the authored `labelPosition`), and only when both ends are blocked is `opf/chart-label-collision` reported. Such a label stands on a plate of the chart's surface color, in the preview and as a filled data label in PowerPoint, so it reads against the mark behind it.
