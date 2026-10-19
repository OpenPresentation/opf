---
type: fixed
packages: [opf]
---

RR-90: the optional peers `@openpresentation/opf-render` and `@openpresentation/opf-pptx` accept the 0.22 line (`>=0.20.0`; the siblings' own core floors keep versions in lockstep). Core 0.22.0 still named `^0.20.0`, so npm refused a tree with core 0.22 and renderer 0.22.1.
