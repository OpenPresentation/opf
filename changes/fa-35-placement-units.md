---
type: changed
packages: [opf, render, pptx, editor]
---

Give anchored overlay sizes one unit per key: `width` and `height` are fractions of their target, while `widthPx` and `heightPx` are reference pixels. Preserve useful oversized frames subject to finite representable geometry. Editor changes are undoable and refuse duplicate units; native provenance distinguishes legacy pixel anchors from current fractional anchors.
