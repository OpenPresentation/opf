# RR-20: the default baseline records the core 0.15.0 examples

`opf-examples-png.cover-centering` (the default baseline: the publish workflow and a bare `npm test`) moves from the examples of core 0.14.0 (digest `d414d352f6668bcad3c9184252eb0c9ef0fe02280c81b621c08e15f3b5a5cc78`, 127 decks, 807 slides) to those of core main, which core 0.15.0 ships (digest `fbdd8346eba002eb8ca6015cd411beb6750cbe87ed5da89d3f84da72f4ff29f2`, 127 decks, 807 slides). 148 slides in 99 decks change.

Why: format-audit wave C ([opf#452](https://github.com/OpenPresentation/opf/pull/452), with [opf-render#159](https://github.com/OpenPresentation/opf-render/pull/159)) is the breaking 0.15 spec. Every example embeds its catalog records, image-bleed slides became image backgrounds and placed image blocks, and the regenerated gallery examples changed. The changes are listed in `notes/FA-23.md`. Coordinated CI compared these hashes through core's reviewed fixture `opf/scripts/fixtures/opf-examples-png.fa-wave-c.sha256.json`, which core's `regenerate-core-golden` workflow wrote with this renderer ([run 37728567691](https://github.com/OpenPresentation/opf/actions/runs/37728567691)). The publish workflow installs the registry core and always uses this repository's own default baseline, so without this change `opf-render-v0.15.0` would fail "Golden corpus changed", as `opf-render-v0.12.1` did.

How it was checked:

- Written by the `regenerate-goldens` workflow in the pinned Playwright image ([run 37759650555](https://github.com/OpenPresentation/opf-render/actions/runs/37759650555), commit `60ddd9b`: "99 decks"). It rendered the lock's core (`2340459`, examples digest `fbdd8346...`) with renderer `8b27cd2`.
- `rel015-baseline-check` against core's fixture: `sourceEqual: true`, `settingsEqual: true`, 807 entries on each side, `changedSlides: 0`. The reassembled manifest equals the reviewed fixture, so every changed slide was already reviewed for that fixture.

Merge order: this PR also resets `golden-override` to `''` in both `ecosystem-refs` steps. It had selected core's fixture since opf-render#159, and the lock's golden is now that fixture (roll opf#457), so the roller never adopts the renderer baseline (opf-render#130). Merge it before the renderer's 0.15.0 release prep.
