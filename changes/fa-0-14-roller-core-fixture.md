---
type: changed
packages: []
---
FA 0.14 integration: the ecosystem roller also adopts a renderer `golden-override` that names a reviewed core fixture (`opf/scripts/fixtures/<name>.sha256.json`, a safe relative path that must exist at the core SHA being rolled), and records "golden adopted from opf-render golden-override (core fixture)" in the lock and its provenance. A coordinated release keeps a transitional lock golden that records the pre-roll renderer, while its renderer pull request selects the true fixture (scripts/fixtures/README.md). A plan-only check of a pull request (`plan --lock`) looks for the lock's own core golden in its checkout, since the pull request adds that fixture before main has it; an adopted override is still looked up at the rolled SHA.
