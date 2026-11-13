---
type: fixed
packages: [opf, render, pptx]
---
RR-105: an image block's overlay under `fit: "contain"` now covers the drawn picture instead of the empty frame around it, so an edge band takes its share of the picture (core's new `pictureOverlay` places it for a picture whose size only the host can read). The preview and the PPTX export draw the same band, and an unchanged export imports back as the same block.
