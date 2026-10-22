# RR-20: the default baseline records the core 0.16.0 examples

`opf-examples-png.cover-centering`, the default baseline that the publish workflow and a bare `npm test` use, moves from the examples of core 0.15.1 (digest `fbdd8346eba002eb8ca6015cd411beb6750cbe87ed5da89d3f84da72f4ff29f2`) to those of core main, which core 0.16.0 ships (digest `68846fb397092512f3506a3baf82393bf637e440e960b581d3761a4ac9a3acf6`). Both have 127 decks and 807 slides. **No slide hash changes.** FA-26 rewrote gallery example decks to embed the nested-group records, but they compose identically, so only the corpus digest moves.

How it was checked:

- The `regenerate-goldens` workflow wrote it in the pinned Playwright image ([run 37868950825](https://github.com/OpenPresentation/opf-render/actions/runs/37868950825), commit `fd288e6`: "0 decks"). It rendered the lock's core `850e211` with renderer `d94eeec`.
- `rel016-baseline-check` against core's `opf-examples-png.fa-wave-c.sha256.json` (the lock's golden) reports `sourceEqual: true`, `settingsEqual: true`, 807 entries on each side and `changedSlides: 0`.

This PR also resets `golden-override` to `''` in both `ecosystem-refs` steps, so the roller never adopts the renderer baseline (opf-render#130). Merge it before the renderer's 0.16.0 release prep.
