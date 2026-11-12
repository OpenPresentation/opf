---
type: changed
packages: [opf, render, pptx, editor]
---

Give anchored overlay sizes one unit per key: `width` and `height` are fractions of their target, while `widthPx` and `heightPx` are reference pixels. To update a 0.33 deck, rename an anchored `width` or `height` that holds pixels to `widthPx` or `heightPx` (`"at": { "width": 160 }` becomes `"at": { "widthPx": 160 }`); the old key still validates but now reads as a fraction, and the new warning `opf/shape-anchor-size-unit` finds each one. See the [0.34 migration](../docs/migrations/0.34.md). Preserve useful oversized frames subject to finite representable geometry. Editor changes are undoable and refuse duplicate units; native provenance distinguishes legacy pixel anchors from current fractional anchors.
