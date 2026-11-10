# RR-114 formal02: replay has no demonstrated latency gain

Eight fresh Node24 children passed all624 exact SVG checks and exact three-face/file/license/shared-module/HarfBuzz identities. This is two replicates per size/runtime, with four warm calls per cell. Every raw vector is in summary.json; means below are a bounded screening, not statistical confidence.

| Slides | Preparation ms | Preparation+first ms | Warm ms | Prep CPU ms | Prep+first CPU ms | Warm CPU ms |
| --- | --- | --- | --- | --- | --- | --- |
| 16 | 1059.7 → 1138.2 | 2035.0 → 2124.1 | 803.9 → 805.6 | 1758.0 → 1718.0 | 3156.5 → 3054.0 | 917.8 → 953.0 |
| 36 | 1947.6 → 1911.0 | 3762.9 → 3760.6 | 1613.7 → 1637.8 | 2820.5 → 2601.5 | 4992.0 → 4953.5 | 1871.3 → 1808.5 |

All arrows are control → replay candidate. CPU means are actual process user+system deltas. No speed improvement is accepted:16-slide preparation+first changes 4.4%;36 changes -0.1%. The net result does not show a latency gain. Trace bookkeeping is a source-level suspect; no causal CPU profile was collected in this trial. The product source remains frozen and unmerged.

| Slides | First-render peak MiB | Final retained-three-batch peak MiB | Post-drop GC heap MiB | Post-drop RSS MiB |
| --- | --- | --- | --- | --- |
| 16 | 301.3 → 298.0 | 311.6 → 308.3 | 54.1 → 54.0 | 268.3 → 267.9 |
| 36 | 318.2 → 313.6 | 319.1 → 315.0 | 56.0 → 55.9 | 285.3 → 281.2 |

First/final HWM values were captured before output hashing or evidence work. The final value retains three output batches and is not single-render usage. Post-drop GC keeps fonts/deck/caches and a small hash vector. Small memory/warm differences here do not establish an improvement.

Formal01 is a preserved setup failure after its first control: the evidence code inferred WASM from imported JS and found none. No valid comparison came from it. Formal02 uses the exact two source-bound filesystem assets, same mirrored order and60s caps, without retries or source changes.

The earlier whole131/demand3 trial is not this control. These new runtimes both load3faces; the unrelated historical infinite Node normalizer was stopped before this trial, and the retained-output workload differs. Do not compare historical absolute times/RSS or add percentages across trials. No physical-mobile, native Office, CI, release or leak qualification is implied.
