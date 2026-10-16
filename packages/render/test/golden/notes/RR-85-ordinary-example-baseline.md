# RR-85 ordinary example baseline

The new `opf-examples-png.rr85-metric-centering.sha256.json` is a byte-exact adoption of the already reviewed, officially generated Core fixture `scripts/fixtures/opf-examples-png.rr20-array-areas.sha256.json` at published Core 0.20.2 source `b1f0aa3c543424f7befb08785634a6a5a8652caa` (SHA-256 `683a70a34c85a98cc0d9cadbc705646cd45894eaf03302bd01c6c79964738d35`). It was read directly from that immutable Git object. No expected raster hash was regenerated or edited locally.

The historical Renderer baseline remains unchanged. Both baselines cover the same 807 slide keys, source corpus digest, scale, format and bundled-font policy. Only these four entries differ, reflecting the approved metric centering default:

- `technical/block-composition.opf.json#0`
- `technical/content-payload-matrix.opf.json#8`
- `technical/metrics-quotes-timeline.opf.json#0`
- `technical/promoted-region-grid.opf.json#2`

Ordinary checks choose between the two known baselines from the actual `layoutMetric` default, not a package version. Unknown defaults and missing or malformed selected fixtures fail. Explicit `OPF_GOLDEN_BASELINE` selections retain precedence, including reviewed source CI corpora. The separate 495-slide template selector and its reviewed 23 changed slides are untouched.

The original `opf-render-v0.20.1` tag is preserved. Its trusted workflow exposed the stale ordinary baseline before any npm publish; this source fix requires its own normal review and a new release. Exact raster hashes establish regression behavior, not native application parity or general readability.
