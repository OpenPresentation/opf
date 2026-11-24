---
type: fixed
packages: [render]
---
The preview paints a preset shape's fills before its lines, as PowerPoint does, so a later path's fill no longer covers an earlier path's line: `chartX`, `chartStar` and `chartPlus` draw their X, star and plus inside the square instead of a plain square, and `cloudCallout`'s overlapping bubbles show each outline (#1415). The PowerPoint export is unchanged.
