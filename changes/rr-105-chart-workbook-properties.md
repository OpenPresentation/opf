---
type: fixed
packages: [pptx]
---
RR-105 (#1290): the workbook embedded in each chart names the deck's author (else "OPF") as its author and last editor and "OPF" as its application, instead of the vendored writer's name, which Excel showed in File > Info after Edit Data; a package test checks that no exported part names a vendored library.
