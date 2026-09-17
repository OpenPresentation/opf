# CFF2 advance rounding counterexamples

This diagnostic compares 143,207 glyph/instance combinations across all four
pinned CFF2 fixtures and their named/default/interior selections. It calculates
base `hmtx` advance plus Fontkit's HVAR delta rounded away from zero, then
compares that result with the same selected face's HarfBuzz 14.4.0 advance.
There are 458 differences of one font unit. No source data or metric policy was
changed. These counterexamples rule out treating a simple final delta rounding
as a complete normalization fix.

The [OpenType variation algorithm](https://learn.microsoft.com/en-us/typography/opentype/spec/otvaroverview#coordinate-scales-and-normalization)
requires 16.16 normalization calculations followed by a specified 2.14 result.
It allows implementation-specific precision for subsequent derived values.
Fontkit's current processor uses floating calculations. Investigate the required
normalization steps, avar mapping and boundary cases before changing instance
metrics; the probe does not itself prove the complete cause of every difference.

The broader [renderer portability evidence](https://github.com/OpenPresentation/opf-render/tree/a5f3ec6d8acbccaae3ade462621349070d5244f7/docs/evidence/variable-metrics-portability-20260914)
also demonstrates distinct Mac/Linux native TrueType advances. That remains a
separate metric/paint compatibility question after normalization correctness.

The script and full comparison are deterministically compressed with hashes in
`manifest.json`. To reproduce, decode `probe.mjs.gz` to the renderer checkout's
`artifacts/font-shaping/variation-metrics/cff2-advance-probe.mjs`, then execute it
from that checkout with Node 24 and its locked dependencies. All original font
fixtures are unmodified, revision-pinned OFL files in the renderer repository.
