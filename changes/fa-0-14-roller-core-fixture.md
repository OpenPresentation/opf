---
type: changed
packages: []
---
FA 0.14 integration: the ecosystem roller also adopts a renderer `golden-override` that names a reviewed core fixture (`opf/scripts/fixtures/<name>.sha256.json`, a safe relative path that must exist at the core SHA being rolled), and records "golden adopted from opf-render golden-override (core fixture)" in the lock and its provenance. A coordinated release keeps a transitional lock golden that records the pre-roll renderer, while its renderer pull request selects the true fixture (scripts/fixtures/README.md).
