---
type: fixed
packages: [render]
---
RR-105: the browser font handle's role-name resolver (`registry.fontNames`, which the PPTX export asks for every style it resolves) no longer describes and serializes every held face on each call to notice a changed face pool; the registry keeps a generation counter that `addFaces` bumps, so a lookup is a map hit between changes (0.2 to 0.3 microseconds instead of 2 to 18, with 14 to 131 held faces). Output is unchanged.
