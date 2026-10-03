---
type: changed
---
RR-52 (repository tooling; no package output changes): the raster golden is stored one file per deck (`test/golden/<baseline>/<deck>.sha256.json` plus `_baseline.json`) instead of one 805-entry manifest per baseline, migrated byte-for-byte (`scripts/golden-migrate.mjs verify`). `OPF_GOLDEN_BASELINE` and every legacy `.sha256.json` selection keep working. New `regenerate-goldens` workflow (label or `workflow_dispatch`; only in the pinned Playwright image) rewrites only the decks that differ and attaches `diff.json` and the review sheets; `npm run golden:promote`; review notes move to `test/golden/notes/`. The comparison (exact hashes) and the 0.1 px and 0.15 px metric gates are unchanged.
