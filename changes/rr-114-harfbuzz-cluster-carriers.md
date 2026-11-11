---
type: fixed
packages: [render]
---
RR-114: avoid repeated linear searches while assigning text to HarfBuzz cluster carriers. Long text preparation now walks the already-sorted cluster starts once, preserving exact glyphs, positions, carrier selection and code points.
