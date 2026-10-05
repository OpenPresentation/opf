---
type: changed
packages: []
---
RR-20 (repository tooling; no package change): `pnpm test:registry-fidelity` runs the pinned opf-render golden test against the reviewed core baseline that `ecosystem.lock.json` selects when the installed core's bundled examples hash to exactly the corpus that baseline records (core 0.12.1 moved 81 examples to singular audience ids and no pixel; the published renderer 0.12.0 baseline records the 0.12.0 corpus digest). Pixel hashes are still compared exactly and the corpus digest must still match; otherwise the renderer's own baseline applies, so a release with unreviewed example changes still fails. See `scripts/registry-golden.mjs`.
