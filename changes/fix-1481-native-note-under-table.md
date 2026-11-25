---
type: fixed
packages: [pptx]
---
Native body text (`--body-text native`) writes a note that core moved out of its layout region's box, such as the note under a table on the `table` layout, at the box core drew it in (anchored at the top), not at the region's box near the foot of the slide, so PowerPoint shows the note under the table as the preview does (#1481). A block at its region's top, or centered in it, keeps the region's box; exports without `--body-text native` are unchanged.
