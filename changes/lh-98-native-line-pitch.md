---
type: fixed
packages: [pptx]
---
LH-98 (output-changing for `bodyText: 'native'`): a native body writes core's measured line pitch as exact point line spacing (`a:lnSpc/a:spcPts`), as native titles do, and core's gap between list entries as space before each later entry, instead of 122% line spacing. PowerPoint applied the 122% to the face's own line height and drew lines about 20% taller than core measured, so a native list ended below core's body box; checked in PowerPoint, every line of a 6-entry Arial list now sits 2 px from the preview at the same pitch, and a 3 x 6 agenda list ends 10 px above the preview's end instead of 60 px below it.
