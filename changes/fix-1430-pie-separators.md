---
type: fixed
packages: [opf, pptx]
---
opf#1430: a pie or doughnut chart exports as the preview draws it. A `highlight` recolored each slice's outline along with its fill, so PowerPoint drew no line between slices and two muted slices of one fill read as one; the outline of every slice now stays the separator the preview draws, in the color of the surface the chart stands on, and its width scales with the slide as the preview's does. The plot area of a pie or doughnut is now the square the preview draws it in (an inner manual layout from core's `chartCircleSquare`, which gains a `labels` option that measures a pie's outside data labels as the preview does), with any legend position or none, data labels, a header, beside a table or text and right to left; PowerPoint drew it about a tenth larger and higher before. Import reads these charts back as before; the preview does not change.
