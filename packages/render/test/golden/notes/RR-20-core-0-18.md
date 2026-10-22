# RR-20: the default baseline records the core 0.18.0 examples

`opf-examples-png.cover-centering`, the default baseline that the publish workflow and a bare `npm test` use, moves from the examples of core 0.17.0 (digest `bde29abcfa5320fbe21ba8ede83195eb959b0e9e699fd26318b5e2f6ac5a723f`) to those of core main, which core 0.18.0 ships (digest `20da988227cb90ad9a1f04185981f83d24c0afee7c9070d7b84e55fe7895e71b`). Both have 127 decks and 807 slides. One slide changes: `technical/header-footer-logo-set#0`, where RR-71 draws the organization's logo icon beside its name in the footer zone. That slide was reviewed for core's `scripts/fixtures/opf-examples-png.rr-71.sha256.json` (opf#529, regenerate-core-golden run 38009288711).

How it was checked:

- The `regenerate-goldens` workflow wrote it in the pinned Playwright image ([run 38020688464](https://github.com/OpenPresentation/opf-render/actions/runs/38020688464), commit `b57a021`: "1 decks").
- `rel018-baseline-check` against core's rr-71 fixture (the lock's golden) reports `sourceEqual: true`, `settingsEqual: true`, 807 entries on each side and `changedSlides: 0`.

This PR also resets `golden-override` to `''` in both `ecosystem-refs` steps. Merge it before the renderer's 0.18.0 release prep.
