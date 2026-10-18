---
type: changed
packages: [opf]
---
RR-90 (output-changing for every table): table cell text asks for the body size (25 px, about 19 pt) instead of 15 px floored to the 16 px (12 pt) minimum, so a table no longer renders at 12 pt beside 24 pt bullets. The whole table shrinks together toward `composition.minFontSize` (one size for every cell, at most one trial per reference pixel) when its text and rows do not fit the box. A run's own `fontSize` is now drawn at that size when the table is at the body size, instead of being inflated by the floor. `composition.typeScale` is not added: sizes come from several layouts and from the renderer's chart text, so there is no single place to scale them.
