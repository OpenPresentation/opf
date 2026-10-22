# FF-22: finite chart axes and bounded overflow rejection

Evidence for the finite-range repair (#46) in the classic chart renderer.

## Change and contract

- The `niceScale` exponent search is bounded. When its intermediate arithmetic cannot represent a scale, bounds and ticks are calculated in normalized units, endpoints are restored as finite values, and ticks merged by subnormal precision are deduplicated. Extra headroom stops at the finite numeric endpoints; authored values are never clamped or rewritten.
- Category, scatter and radar coordinate fractions divide before subtracting only where a finite range would otherwise overflow. Ordinary arithmetic is unchanged.
- Stacked, percentage, pie and doughnut totals that cannot be represented throw an actionable `RangeError` naming `slides.0.chart` and asking the caller to rescale. No empty-chart substitution and no invalid SVG. Such overflowing aggregates remain an unsupported fidelity case.

## What is retained

| File | Supports |
|---|---|
| `baseline-chart-scale.log` | Negative control: the `test/chart-scale.mjs` public-renderer check run against the unrepaired renderer fails at its 2-second worker deadline (the scale search never returns). |
| `chart-scale.log` | The same test against the repaired renderer: 36 finite-value geometry cases and 8 explicit aggregate-overflow rejections. |
| `visuals/*.opf.json`, `visuals/*.png` | Four synthetic renders (subnormal, maximum, mixed extremes, scatter extremes) with bundled fonts, system fonts disabled and estimated layout. The PNGs are reproducible byte for byte from the `.opf.json` files with `svgToPng(renderSvg(doc, {trace: true}), {useBundledFonts: true, loadSystemFonts: false, scale: 0.65})`; they were re-rendered after merging main and are unchanged. |

The 36 cases cover ordinary, minimum-subnormal, subnormal, maximum, mixed positive/negative extremes and negative extremes across column, bar, line-with-markers, area, radar-with-markers and scatter. They require finite SVG geometry, every authored mark, proportional bar magnitudes, bounded bars, distinct points, ordered scatter positions, non-collapsed area geometry, real axes and no placeholder output. Rendering and rejection leave the input JSON unchanged.

Limits that remain visible in the PNGs: the mixed-extremes title is clipped at its left edge, and extreme scatter axis labels overlap at the bottom-left or reach the edge. This is not a complete readability, loaded-font browser, pixel-parity or native PowerPoint claim.

Reproduce from the repository root: `npm ci`, `npm run build`, `node test/chart-scale.mjs`.
