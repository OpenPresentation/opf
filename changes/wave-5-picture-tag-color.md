---
type: fixed
packages: [pptx]
---
The PPTX export judges the slide tag's and an eyebrow's contrast on a picture background against the same color the preview does: the slide's variant `bg1` (the preview's canvas, and the color of the automatic scrim), not the color scheme's default background. A section on a photo, whose variant puts light text on accent1, wrote its tag in accent1 in PowerPoint (nearly invisible on the photo) while the preview drew it in the text color; both now draw the text color. The slide's base background color under a picture follows the same color.
