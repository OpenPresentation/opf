# RR-20: the default baseline records the core 0.14.0 examples

`opf-examples-png.cover-centering` (the default baseline: the publish workflow and a bare `npm test`) moves from the examples of core 0.13.0 (digest `394c4ce7c81821d34a9edacb705aa7703631016563b0b4357475de72d594e155`, 126 decks, 805 slides) to those of core main, which core 0.14.0 ships (digest `d414d352f6668bcad3c9184252eb0c9ef0fe02280c81b621c08e15f3b5a5cc78`, 127 decks, 807 slides). 13 slide hashes change and 2 slides are added, in 14 deck files; the other deck files are untouched.

Why: core's format-audit work for 0.14 (FA, [opf#429](https://github.com/OpenPresentation/opf/pull/429)) and the chart data fixes changed the example decks. The renderer draws them as they are now authored; no renderer change moves a pixel. Coordinated CI has compared these hashes through core's reviewed fixture `opf/scripts/fixtures/opf-examples-png.fa-0-14.sha256.json` (the lock's golden). The publish workflow installs the registry core and always uses this repository's own default baseline, so without this change `opf-render-v0.14.0` would fail "Golden corpus changed" exactly as `opf-render-v0.12.1` did ([run 37396674784](https://github.com/OpenPresentation/opf-render/actions/runs/37396674784)).

How it was checked:

- Written by the `regenerate-goldens` workflow in the pinned Playwright image ([run 37606586266](https://github.com/OpenPresentation/opf-render/actions/runs/37606586266), commit `5a64326`: "14 decks"), rendering the lock's core (`f1e7d4c`, examples digest `d414d352...`) with renderer `38ad562`.
- `rel014-baseline-check` against core's fixture: `sourceEqual: true`, `settingsEqual: true`, 807 entries on each side, `changedSlides: 0`. The reassembled manifest equals the reviewed fixture, so every changed slide was already reviewed for that fixture.

Merge order: ci.yml keeps `golden-override: ''` (the temporary override only served `regenerate-goldens` on this branch), so the lock's golden stays core's fixture and the roller never adopts the renderer baseline (opf-render#130). Merge it before the renderer's 0.14.0 release prep.
