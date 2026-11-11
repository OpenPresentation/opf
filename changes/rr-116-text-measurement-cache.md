---
type: fixed
packages: [render]
---
RR-116: reuse cached text metrics without repeating Unicode direction analysis and OpenType language lookup. Keep explicit direction, language, outline upgrades, font selection and bounded cache eviction independent.
