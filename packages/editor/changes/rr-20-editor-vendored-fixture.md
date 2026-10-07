---
type: fixed
---
RR-20 (test only): `test/presentation-ids.mjs` reads its color-references fixture from `test/fixtures/` (copied from core 0.14.0, `docs/fixtures/color-references.opf.json`), not from a sibling OPF checkout. The release workflow has no such checkout, so opf-editor 0.14.0's publish run failed and that version was never published. 0.14.1 is the first 0.14 editor on npm.
