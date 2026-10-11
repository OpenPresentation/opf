---
type: changed
packages: [opf, cli]
---
RR-83 (breaking, OPF 0.19): core and the CLI require renderer and PPTX 0.19 when those optional engines are installed, matching the v2 layout contract. Missing-engine diagnostics and install commands name the same engine ranges. Reading, validating and editing documents still do not require either engine.
