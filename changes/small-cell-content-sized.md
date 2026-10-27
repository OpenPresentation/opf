---
type: fixed
packages: [opf]
---
A block that a stacked column draws at the full height it needs is no longer reported as a too-small cell (`small-cell`). Since the content-sized rows of 0.28.0, a slide of short one-line notes could be split by `paginate` or rejected by `overflow: 'error'` although it fits; a block squeezed below its need in a crowded column is still reported. The fix shipped in 0.28.0 after its notes were written.
