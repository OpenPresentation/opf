---
type: changed
packages: [opf, render, pptx, editor]
---
FA-35 (breaking): anchored overlay sizes have one unit per key. `width` and `height` are fractions of their target; `widthPx` and `heightPx` are reference pixels. To update a 0.33 deck, rename an anchored `width` or `height` that holds pixels (`"at": { "width": 160 }` becomes `"at": { "widthPx": 160 }`); a value above 8 is a schema error that asks `Did you mean "widthPx"?` and carries the rename as a patch, and a value above 4 up to 8 validates as a fraction with the warning `opf/shape-anchor-size-unit`, which offers the same rename ([0.34 migration](../docs/migrations/0.34.md)). Also breaking: `OverlayShape.width` and `height` and `OverlayAnchor.width` and `height` have a maximum of 8 (slides, or times the target), and a larger value is a schema error. The editor frame changes stop at 8 and refuse duplicate units, and PPTX import limits a native shape larger than 8 slides to 8 and reports `shape-property-dropped`.
