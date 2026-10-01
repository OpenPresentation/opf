# Script corpora evidence (FF-44, RR-17), 2026-10-01

Numbers behind [script-corpora.md](../../programs/font-fidelity-everywhere/script-corpora.md). Produced on one Windows 11 host
(Microsoft 365, Node 26.4.0, Edge 154.0.4258.37, opf-render at the head of
[opf-render#93](https://github.com/OpenPresentation/opf-render/pull/93), pinned `@expo-google-fonts/*` packages, `harfbuzzjs` 1.6.2, fontkit 2.0.4,
resvg-js 2.6.2). No Office was opened and no font was copied: the Windows originals were read in place and only numbers and file hashes are stored.

| File | Produced by | What it holds |
| --- | --- | --- |
| `script-corpora.json` | opf-render `test/fixtures/script-corpora.json` (copied; the repository file is authoritative) | the corpus: 30 scripts, 140 original samples, `knownShapingLimits`, `rasterLimits` |
| `qualification.json` | `node scripts/script-corpora.mjs qualification.json` | per bundled face (63): line metrics, own-script and national-charset coverage, and per sample: coverage, the renderer's fontkit width, HarfBuzz width, glyph counts, shaping applied, zero-advance marks; plus the Latin design faces' corpus coverage (`latinFaces`) |
| `browser.json` | `node test/script-corpora-browser.mjs browser.json` | the same samples set in Chromium with the pinned bytes: natural advance, deltas against HarfBuzz and the renderer, right-to-left order |
| `raster.json` | `node test/script-corpora-raster.mjs raster.json` | resvg against a HarfBuzz outline reference for the regular-weight samples: ink width, ratio, mean pixel difference |
| `references.json` | `node scripts/measure-script-references.mjs references.json` (Windows only) | the installed original script fonts (25 families) measured in place: width ratio of the replacement per sample, line metrics, file name, version and SHA-256; and the 31 families that are not installed |

Reading the data: `widthDelta` in `qualification.json` is the renderer's width minus HarfBuzz's at 100 px (so 0.011 is 0.011 px); `ratio`
in `raster.json` is resvg ink width over the reference; `meanSignedDelta` in `references.json` is the replacement's width over the original's, minus one.

Not here: any native PowerPoint observation. The supervisor's native decks and their results are recorded separately (FF-46, RR-05).
