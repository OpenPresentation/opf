---
type: fixed
packages: [opf, cli]
---
RR-87: Make `opf doctor` inspect fonts and converters from the selected renderer's own Node resolution chain, so an unrelated global or Core install cannot hide a missing or incompatible renderer peer. Root engine discovery still checks Core and the working directory.
