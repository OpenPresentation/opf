---
type: changed
packages: [render]
---

Avoid a second synthetic slide recording during eligible Node font preparation by replaying bounded, ordered face-selection and strict glyph-coverage requirements. Uncertain contexts retain the existing cold path; normal rendering, native font naming and strict glyph failures stay unchanged.
