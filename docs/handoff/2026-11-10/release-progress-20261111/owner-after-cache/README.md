# Owner browser workload after the cache repairs

Actual source `e6497ee68b6b5fc73661a9b1cb45124e6dd902b0`, tree `d9131cda3a5ecb22823b77b5f3eec27df51b1872`, remained clean and unchanged throughout this run. The source is unpublished and still uses the source version0.33.0. These observations do not qualify a released0.34 package.

The unchanged smoke protocol passes11complete cold-report oracles. The formal run exits0 in977.661seconds, from2026-11-11T00:32:42.633Z through00:49:00.301Z, with six workload cells,168complete cold-report comparisons,108primary action rows,200edits and10destroy cycles. Chromium158.0.8127.18, Node24.21.0 and pinnedpnpm10.33.2 run on the same Mac. The390×844 viewport and4×CPU throttle are proxies; no physical-phone or cloud-runtime claim follows.

Median operation latency in milliseconds:

| Slides / configuration | Navigation | Sorter | Slide view | Local title | Shared edit | Global name |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
|16 desktop1×|48.4|564.5|33.0|421.6|568.5|1106.2|
|36 desktop1×|53.5|1128.3|35.8|510.9|794.4|1871.7|
|16 desktop4×|190.2|2236.1|92.2|607.9|1191.6|3277.2|
|36 desktop4×|212.1|4464.5|98.0|860.8|2192.8|6293.8|
|16 viewport4×|208.5|2225.2|82.2|596.7|1185.0|3298.6|
|36 viewport4×|235.2|4502.1|92.1|858.1|2193.0|6374.7|

Earlier frozen89a9 observations remain immutable: the36desktop4× navigation/local-title medians were3786/4971ms. This is a same-machine, separately timed observation, not a randomized version comparison. Sorter and global-name latency remain substantial; the latter is under a separate source audit.

Retention acceptance remains OPEN. The review cache stays36entries/about3.38MB against64entries/8MiB limits, then clears tozero; workspaces becomezero and destroyed DOM/listeners remain20/13. The shared fonts handle deliberately survives editor destruction. Post-GC heap nevertheless rises across the ten destroy cycles, approximately32.22→33.41MB; bounded shared text caches do not establish the cause of this continuing slope. No leak threshold or acceptance is invented.

Twenty raw files totaling45,578,311bytes remain immutable in the local artifact directory named by raw-manifest.json. This packet contains compact receipts/metrics and hashes; it does not claim those raw files were uploaded. The17selected delta logs are losslessly archived separately, including the real153.0-second17/17PASS run. Their membership was taken from that exact selected-step table, excluding stale logs from other runs. Source, asset, protocol, projected input and bundle digests remain bound to e649, not to later fixes.
