# HarfBuzz layout measurement (renderer issue 213)

This report qualifies the synchronous measurement used by loaded font handles against independently shaped HarfBuzz glyphs. It was produced on Node 24.21.0 with renderer base `6615ad5` (the unpublished 0.18.1 preparation), core 0.18.3 and harfbuzzjs 1.6.3. `report.json` records the implementation source digests, WASM digest and the exact font-file SHA-256 for every sample; no system fonts or network font sources participate.

At 25 px, three of 140 regular-face corpus sample widths differ from the existing fontkit fallback:

| Corpus sample | Fontkit width | HarfBuzz width | Change |
| --- | ---: | ---: | ---: |
| Myanmar words | 478.675 | 462.425 | -16.25 |
| Myanmar medials | 340.2 | 341.7 | +1.5 |
| Syriac marks (RTL) | 176.6 | 179.5 | +2.9 |

The test also checks independent HarfBuzz ink bounds, both run directions, invalidation of pre-shaper caches, isolated handle caches with immutable shared font identities, strict missing-glyph errors, colour-emoji em-box fallback and unchanged Latin advances. Widths around each changed sample's midpoint exercise different line wrapping with core's actual `wrapText`; the table describes advance changes, not every possible ink or line-break change.

`examples.json` records 127 published core example decks: 807 SVG slides are byte-identical between the fontkit fallback and the final HarfBuzz measurement with the Office visual handle and all script faces. No approved golden was modified. An intermediate attempt to propagate paragraph RTL into every script run changed Latin kerning in seven SVGs; that attempt was removed before the final comparison.

`slides-browser.json` records actual Chromium output: 140 corpus titles, 229 pinned runs, maximum natural-advance deviation 0.0435 px against the existing 0.1 px tolerance; 22 RTL lines paint in the correct order. The new offline browser-loader regression separately verifies that supplied `shapeWasm` uses the reviewed HarfBuzz widths for all three changed samples, while an omitted WASM retains the original fontkit widths. It refuses unexpected network requests.

The separate `script-corpora-browser.mjs` fullwidth-punctuation assertion fails on this macOS Chromium installation: `hans-punctuation` draws 989.71875 px against 1026 px accepted. The identical baseline source at `6615ad5` reproduces exactly the same values. That existing platform residual is not a shaping exception and no tolerance was relaxed. Its production corpus rows use no fontkit width exceptions; browser handles explicitly loaded without shaping WASM continue to qualify the recorded `fontkitFallbackLimits`.

Reproduce from the locked install:

```sh
npm ci
npm run build
node test/harfbuzz-measurement.mjs artifacts/harfbuzz-measurement/report.json --examples
node test/harfbuzz-measurement-browser.mjs
node test/script-corpora.mjs artifacts/harfbuzz-measurement/corpora.json
node test/script-corpora-slides-browser.mjs artifacts/harfbuzz-measurement/slides-browser.json
```

The supervisor reviewed the numerical corpus changes. Native PowerPoint acceptance belongs to the coordinated release; these are renderer and browser measurements.
