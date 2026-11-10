---
type: changed
packages: [render]
---
RR-114: Node document font preparation checks verified styles and glyph coverage without shaping discarded widths. Real measurement and outlines still shape and fail normally, so shaping failures may move from preparation to rendering. Custom measurement/accessor and shaper overrides retain conservative full measurement. No new public option or metric cache is added.
