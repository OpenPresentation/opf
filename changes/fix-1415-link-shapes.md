---
type: fixed
packages: [pptx]
---
opf#1415 (output-changing for decks with footer social accounts or linked video captions): a text box whose whole text is one link carries the link on the shape (`a:hlinkClick` in its `p:cNvPr`) instead of on its run. PowerPoint underlines every run that is a link, whatever its `u` says, so the footer social lines and video captions showed an underline the preview does not draw; their runs are now plain (`u="none"`, their own color), and a click on the box opens the link in Slide Show. A link inside longer text stays on its run, underlined in the link color in PowerPoint and in the preview alike. The import reads a text box's shape link as the link of its runs that have none, so such a box (also one edited in PowerPoint) comes back as linked text; a shape block keeps its link as its own.
