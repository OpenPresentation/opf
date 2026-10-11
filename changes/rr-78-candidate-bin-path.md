---
type: fixed
packages: []
---
Candidate installed-binary checks normalize the optional leading `./` in the exact selected CLI bin path and reject absolute, traversal and unsafe path spellings before deriving the installation root.
