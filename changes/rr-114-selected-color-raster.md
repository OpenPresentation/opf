---
type: fixed
packages: [render]
---
RR-114: Node demand font preparation now also prepares the monochrome companion of a selected color-emoji face, so the same font handle keeps emoji correct in SVG and paints them in PNG and raster PDF. Font-package reports keep their declared order within each preparation batch, and optional resources are reported only after they have loaded.
