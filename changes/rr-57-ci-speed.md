---
type: changed
packages: []
---
RR-57: core CI is faster without dropping a check. The combined `ecosystem-pptx-editor` job is now `ecosystem-pptx` and `ecosystem-editor`, and the two long sibling suites (opf-render and opf-pptx, about 15 minutes each) run as three parallel slices of equal weight (`scripts/ci-test-shards.mjs`, `scripts/ci-test-weights.json`). The slices together run exactly each sibling's `npm test` or `npm run test:contract`; `packages` still aggregates every job. npm's download cache is restored with a key made from the lockfile hashes.
