---
type: changed
packages: []
---
MR-31: the example goldens have one home and one workflow. `packages/render/test/golden/` is the baseline of the repository's `examples/` (new default `opf-examples-png.fa-33-region-lists`: the same 818 slide hashes, the corpus digest moved from `22ebe285` to `70b9e5d4` with FA-33), `pnpm golden:update` and `.github/workflows/golden.yml` regenerate it in the pinned Playwright image, and core's `regenerate-core-golden` workflow, `scripts/core-golden.mjs`, the 17 `scripts/fixtures/opf-examples-png.*` fixtures, the ecosystem lock's `golden` field and the renderer's candidate-golden scripts are deleted.
