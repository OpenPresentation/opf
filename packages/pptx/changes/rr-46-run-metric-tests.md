---
type: changed
---
RR-46: `npm test` now also runs `test/shared-metric.mjs` and `test/metric-provenance.mjs`, the metric payload round-trip and provenance checks that no CI step ran (they were only behind `npm run test:metric`). The other 54 `test/*.mjs` files that `npm test` skips stay in `test/suites.json` `exclude`, each for a recorded reason (helper or fixture, native PowerPoint harness, a CI step of its own, or already run through `test/dependency-boundary.mjs`). No export or import behaviour changes.
