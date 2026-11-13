---
type: changed
packages: [pptx]
---
RR-105 (opf#1291): in the default PPTX export every slide title is the layout's Title placeholder, so PowerPoint's Accessibility Checker and Outline view and Keynote see it: a wrapped title is one box that PowerPoint wraps itself where its line breaks are proven to match the preview, otherwise the preview's lines joined by line breaks. Where the lines are fixed (the font could not be measured exactly), the title is one editable title that keeps those breaks when edited in PowerPoint and imports back as the same title.
