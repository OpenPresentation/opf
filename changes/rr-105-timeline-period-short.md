---
type: added
packages: [opf]
---
RR-105: a timeline period shorter than its marker (its `duration` proportions are the author's) is the new layout warning `opf/timeline-period-short`, and a chart reference label that meets another label or a data line on both of its sides is the new warning `opf/chart-label-collision`, both instead of `opf/text-overflow`: no size changes them, so a strict composition (`overflow: "error"`) reports them and does not refuse the slide. A reference label past its chart stays `text-overflow`, and every reference diagnostic names the authored `referenceLines.<n>` entry.
