---
type: added
packages: [opf]
---
Validation: a warning, `opf/shape-path-units`, when a custom shape `path` without a `viewBox` is wider or taller than three boxes, which means it was written from 0 to 100 (or an icon's 0 to 24) instead of 0 to 1 and draws far outside its frame with no other sign (opf#1308). A path that overshoots the unit box by less, and a path with its own `viewBox`, are not reported.
