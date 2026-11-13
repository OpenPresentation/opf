---
type: fixed
packages: [pptx]
---
RR-105: a deck that mixes text and picture watermarks, such as a deck-level text watermark with a picture watermark on one slide, now exports a PPTX that PowerPoint opens; before, two slides shared one watermark tags part that `[Content_Types].xml` declared twice. Each slide's watermark now has its own tags part, and an unchanged watermark still imports back as `design.watermark`.
