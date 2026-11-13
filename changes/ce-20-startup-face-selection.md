---
type: fixed
packages: [render]
---
CE-20, RR-114, RR-116: text preparation is faster: font-face choices are reused while a layout is refitted, cached text metrics skip repeated direction and language analysis, and long text is matched to HarfBuzz clusters in one pass. Output is unchanged.
