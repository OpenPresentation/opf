# RR-20: the default baseline records the core 0.17.0 examples

`opf-examples-png.cover-centering`, the default baseline that the publish workflow and a bare `npm test` use, moves from the examples of core 0.16.0 (digest `68846fb397092512f3506a3baf82393bf637e440e960b581d3761a4ac9a3acf6`) to those of core main, which core 0.17.0 ships (digest `bde29abcfa5320fbe21ba8ede83195eb959b0e9e699fd26318b5e2f6ac5a723f`). Both have 127 decks and 807 slides. **No slide hash changes against the reviewed fixture.** FA-31 rewrote the example decks' headers and footers to `{{slide.number}}`, `{{slide.section}}` and `{{deck.slideCount}}`, and core's `scripts/fixtures/opf-examples-png.fa-31.sha256.json` (reviewed in opf#490) already records their pixels.

How it was checked:

- The `regenerate-goldens` workflow wrote it in the pinned Playwright image ([run 37924722780](https://github.com/OpenPresentation/opf-render/actions/runs/37924722780), commit `4f9c599`: "0 decks"). It rendered the lock's core `72fcbf5` with renderer `afeae6b`, so only `_baseline.json`'s corpus digest moves.
- `rel017-baseline-check` against core's `opf-examples-png.fa-31.sha256.json` (the lock's golden) reports `sourceEqual: true`, `settingsEqual: true`, 807 entries on each side and `changedSlides: 0`.

This PR also resets `golden-override` to `''` in both `ecosystem-refs` steps, so the roller never adopts the renderer baseline (opf-render#130). Merge it before the renderer's 0.17.0 release prep.
