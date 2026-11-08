---
type: added
packages: [opf, render, pptx]
---
LH-16: timeline events accept a positive relative `duration`, with omission equal to one unit. Shared geometry draws exact proportional ranges with native leader lines in SVG and PPTX, keeps authored date labels on a readable track without shrinking type, and preserves numeric periods and current native text through PPTX import. Timelines without durations draw as before.
