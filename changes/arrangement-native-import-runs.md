---
type: fixed
packages: [pptx]
---
PPTX import of an arrangement exported as native shapes (a pyramid, matrix, cycle, chevrons or process that PowerPoint's SmartArt does not draw as the preview) gives its list back as written: the node text color the export writes on the lines, and the size and face the lines read back with, no longer return as run formatting (each node's OPF_ARRANGEMENT_V1 tag records the node color when no entry's run sets a color, size or face). Before, such a list came back as runs colored `#FFFFFF`.
