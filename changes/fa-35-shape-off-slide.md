---
type: added
packages: [opf]
---

FA-35: the warning `opf/shape-off-slide` for an overlay shape or an image callout with no part on the slide, which draws nothing and is nearly always a percent or a pixel written where a fraction belongs (`"x": 70` for 70%). A position outside the slide stays valid and a shape that straddles an edge is never reported; a hidden shape is exempt, a rotated one is judged by the circle through its corners, and a strict composition (`overflow: "error"`) still composes it. The finding says to write the position as fractions, and `explain` shows the repair.
