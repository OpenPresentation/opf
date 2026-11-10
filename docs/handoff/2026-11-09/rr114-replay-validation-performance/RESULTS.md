# RR-114 formal03: small36-slide startup gain;16-slide slight regression

Root session97110 actually terminated0. All8 fresh Node24 children and624 exact SVG comparisons passed, with identical3face/file/license/shared-module/HarfBuzz identities. Two replicates per size/runtime and four warm calls per cell are a bounded local screening. All values/means/medians/ranges are in summary.json. Arrows are control276 → candidatebcc/runtime23e; both use demand loading.

| Slides | Prep ms | Continuous prep→first ms | Warm ms | Prep CPU ms | Prep+first CPU ms | Warm CPU ms |
| --- | --- | --- | --- | --- | --- | --- |
| 16 | 1058.9 → 1076.4 | 2044.6 → 2064.1 | 804.0 → 807.8 | 1773.5 → 1499.5 | 3023.5 → 2835.0 | 906.5 → 914.5 |
| 36 | 1929.8 → 1773.3 | 3743.9 → 3626.6 | 1610.2 → 1638.9 | 2741.5 → 2421.5 | 5007.0 → 4711.0 | 1773.5 → 1867.5 |

Cells use medians.36-slide continuous preparation→first improves 3.13%;16 regresses 0.95%. Both36 candidate reps improve;16 does not. This is no universal startup improvement or fix for all earlier cold-start cost. No causal profile was collected. Source acceptance/fold and coherent mapper/CI/native gates remain separate.

| Slides | First-render peak MiB | Retained-three-batch peak MiB | Post-drop GC heap MiB | Post-drop RSS MiB |
| --- | --- | --- | --- | --- |
| 16 | 297.6 → 299.5 | 308.0 → 308.9 | 54.0 → 54.0 | 266.2 → 268.1 |
| 36 | 315.3 → 314.3 | 315.6 → 315.2 | 56.0 → 55.9 | 283.8 → 281.4 |

First/final HWM precedes hashing/evidence; final HWM retains3SVG batches and is not single-render allocation. Post-drop GC retains fonts/deck/cache and small hash metadata. Heap is effectively unchanged; no accepted RSS gain. Historical whole131 absolute times/RSS use a different workload/background condition. No additive percentage, physical-mobile, Office, release or leak claim is supported. Prior formal01 setup failure and formal02 no-win packets are unchanged. No retries or source changes occurred during formal03.
