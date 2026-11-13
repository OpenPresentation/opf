---
type: fixed
packages: [opf, pptx]
---
RR-105: `star24` and `star32` accept an `adjust.adj` from 0 to 0.5 like every other star and draw the author's value; the preset table gave their handle the length `ssd2` as its maximum, so the range read as 0 to about 0.0005 and the default was drawn. The PPTX export now writes the authored `adj` for both, and the table records the correction as an erratum of the standard's file.
