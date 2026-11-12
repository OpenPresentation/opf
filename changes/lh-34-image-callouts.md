---
type: added
packages: [opf, render, pptx]
---
LH-34: an image can carry `callouts`, text panels placed in fractions of the picture's visible frame that may cross the picture and slide edges, drawn as real text in SVG and as editable panels in PowerPoint. PPTX import restores them, also after PowerPoint has saved the file.
