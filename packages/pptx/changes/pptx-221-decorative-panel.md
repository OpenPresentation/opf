---
type: fixed
---
opf-pptx#221 follow-up (output-changing for images that cannot be embedded): the empty dashed panel `OPF image placeholder N` inside the unavailable-image placeholder group is marked decorative (the `adec:decorative` extension in its `p:cNvPr`, PowerPoint's "Mark as decorative"). The group carries the accessible name, so the panel had empty alt text and PowerPoint's Accessibility Checker could flag it. The label lines and cross strokes, which carry text, and the group's `descr` are unchanged, and `fromPptx` restores the image block exactly as before.
