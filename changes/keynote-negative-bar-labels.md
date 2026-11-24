---
type: fixed
packages: [pptx]
---
PPTX export (Keynote, opf#1278): a bar or column chart whose values run below zero no longer has its category names cut off in Keynote ("Cranes" read "ranes"). Such a chart writes its names at the low edge of the plot (`c:tickLblPos low`); below a header row its plot area was an outer box, which Keynote filled with the plot. The plot area is now the plot itself (`layoutTarget inner`): the sides where PowerPoint draws axis labels end where the preview's plot ends, so the names have their gutter outside it, and the other sides stay where PowerPoint's plot already reached. The preview, charts of positive values and every other chart type export as before.
