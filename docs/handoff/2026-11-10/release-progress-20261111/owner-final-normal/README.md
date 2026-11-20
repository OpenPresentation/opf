# Current normal-build performance and retention

The maintained normal run on `e092b5b022b79228c00b9e4a6411b6f7cc75d713` exited0: six cells,168 complete cold-oracle comparisons,108 retained primary timing rows,200 edits and ten destroy cycles. Its preceding functional smoke passed11 comparisons. Browser errors and blocked requests were zero; source and all301 compiled core/gallery/render/PPTX files stayed unchanged. Diagnostics were disabled. Fresh actual inputs, assets, fonts, HB/WASM and574 bundle inputs were bound to this source; the normal bundle is5,984,668 bytes, SHA256 `5cdc9940f80a9f4403334a186d7fa901f40be4f4f6fecc6e6e5cf9a15f3a8bd2`.

Apple M4/10 logical cores/24GiB, macOS26.6.2 (25G83), Node24.21.0 and Chromium158.0.8127.18. Each cell uses one warmup and three retained rounds. These are median settled milliseconds for this exact workload, including debounce; they are not a version speedup or physical-device result.

| Slides / viewport / CPU | Navigate | Sorter | Slide | Local title | Shared datum | Global name |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 16 / desktop /1× | 48.9 | 558.6 | 33.0 | 416.1 | 569.6 | 568.9 |
| 16 / desktop /4× | 185.4 | 2217.6 | 90.9 | 613.6 | 1207.5 | 1261.6 |
| 16 /390×844 /4× | 203.1 | 2237.8 | 77.4 | 609.1 | 1215.6 | 1268.6 |
| 36 / desktop /1× | 53.2 | 1129.6 | 37.3 | 509.6 | 807.9 | 826.7 |
| 36 / desktop /4× | 209.9 | 4413.1 | 100.4 | 859.8 | 2176.5 | 2194.6 |
| 36 /390×844 /4× | 227.2 | 4412.2 | 95.1 | 871.9 | 2209.5 | 2194.0 |

During edits the cache stayed at36 entries and approximately3.38MB, below64 entries/8MiB; DOM/listener counts stayed4839/476. After EVERY destroy: cache entries/bytes0, workspaces0, DOM nodes20/listeners13, and four shared font faces. Post-GC heap went33,599,124→37,894,264 bytes over200 edits; across destroy cycles0→9 it went32,226,164→33,437,656 (+1,211,492). This short observation does not establish leak freedom or a zero-growth threshold. The preceding instrumented owner-collection result remains separate.

Attempt01 is retained: a coordinator command mistakenly supplied the current revision as the projection's migration authority, and bundle admission refused it BEFORE browser/timing. The correct approved authority is immutable `ed51a7e8a6636bb2e08c9a446a7d22c21ad81066`. A fresh projection02 retained the exact31/59 operations, projected hashes and whole-document inverses; current compiled validation separately passed. Fresh build02 reused only the just-prepared, unchanged current inputs/assets after their admission checks. No protocol, product, guard, width, deadline or schema authority changed. Setup90s/phase30s/trace15s remain.

The public JSON files are selected numeric summaries and raw-file identities, not rewritten original receipts. All20 formal raw files (44,622,200 bytes), traces, exact source/bundle/assets receipts, failed attempt and smoke remain local. Known face substitutions and style-weight fallbacks are retained there; four prepared used faces and ten observed resources do not qualify every font or unused asset. Source-bound current performance does not replace remaining PS5/native, full CI/platform/registry, release or site acceptance.
