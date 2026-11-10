# RR-114 previous-owned-value lookup: formal04

The candidate improves measured 36-slide preparation plus first render about 8.0%, while the 48-slide stress case regresses 5.58% in both mirrored repetitions. It remains **UNFOLDED / not accepted as a universal startup fix**. All 12 fresh children exited 0 and all 1,200 SVG checks passed, with exactly the same three selected faces, font files, licenses, notices, shared modules and HarfBuzz assets. No further experiment ran.

Control 276f339a is the current three-face demand path. Candidate b7bd3e8f/runtime de1015ba uses the previous equal owned-style lookup. This comparison is not a concurrent repeat against the older 131-face whole pack; it does not establish that the original 14% startup regression is fully fixed. Original cold-diagnosis and formal02/03 records remain unchanged.

## Size comparison

Means below use two fresh processes per variant (also medians because n=2). Each process prepares once and renders first plus two warm batches. Warm means use four samples per variant. Negative change means lower elapsed time/CPU, without statistical significance.

| Slides | Continuous prep→first ms control→candidate | Change | Preparation ms control→candidate | Startup CPU ms control→candidate | Warm ms control→candidate |
| --- | --- | --- | --- | --- | --- |
| 16 | 2080.9 → 2042.8 | -1.83% | 1085.8 → 1052.6 | 2891.0 → 2930.0 | 848.3 → 838.7 |
| 36 | 3921.3 → 3607.7 | -8.00% | 1939.4 → 1658.9 | 5281.0 → 4860.0 | 1792.5 → 1788.1 |
| 48 | 4626.3 → 4884.3 | +5.58% | 2441.9 → 2668.8 | 6140.5 → 6500.5 | 1973.3 → 1956.9 |

At 36 slides, preparation falls 14.46% (1,939.4→1,658.9ms), first render falls 1.68%, and startup CPU falls 7.97%. At 48, preparation rises 9.29% (2,441.9→2,668.8ms), first render rises 1.43%, and startup CPU rises 5.86%. Both candidate 48 startups (4,873.4/4,895.2ms) exceed both controls (4,581.6/4,670.9ms).

**48-slide replay/cap eligibility is UNKNOWN.** No internal counters or instrumentation ran. Latency does not establish a cap refusal or its causal contribution.

## Complete wall-time vectors

Milliseconds are rounded for display only; summary.json and raw child JSON retain exact numbers. Continuous startup includes the tiny boundary between preparation and first render; phase sums remain separately recorded.

| Child | Slides / variant | Preparation | First | Continuous startup | Warm 1 | Warm 2 |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | 16 / control | 1087.0 | 1015.2 | 2102.4 | 844.1 | 872.0 |
| 2 | 16 / candidate | 1053.7 | 1002.6 | 2056.5 | 820.9 | 866.5 |
| 3 | 36 / control | 1954.0 | 1999.3 | 3953.4 | 1766.1 | 1796.2 |
| 4 | 36 / candidate | 1672.9 | 1921.7 | 3594.8 | 1807.8 | 1787.3 |
| 5 | 48 / control | 2426.1 | 2155.3 | 4581.6 | 2027.7 | 1974.0 |
| 6 | 48 / candidate | 2657.9 | 2215.3 | 4873.4 | 1939.8 | 1955.1 |
| 7 | 48 / candidate | 2679.7 | 2215.4 | 4895.2 | 1923.4 | 2009.4 |
| 8 | 48 / control | 2457.7 | 2213.1 | 4670.9 | 1945.1 | 1946.5 |
| 9 | 36 / candidate | 1645.0 | 1975.3 | 3620.5 | 1816.6 | 1740.5 |
| 10 | 36 / control | 1924.8 | 1964.3 | 3889.2 | 1796.6 | 1811.0 |
| 11 | 16 / candidate | 1051.5 | 977.5 | 2029.1 | 810.2 | 857.2 |
| 12 | 16 / control | 1084.6 | 974.7 | 2059.5 | 815.0 | 862.2 |

## Complete CPU vectors

CPU means process user+system time in milliseconds; it may exceed wall time. It is not added to wall time.

| Child | Slides / variant | Prep CPU | First CPU | Startup CPU | Warm 1 CPU | Warm 2 CPU |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | 16 / control | 1563.0 | 1344.0 | 2907.0 | 1000.0 | 937.0 |
| 2 | 16 / candidate | 1625.0 | 1297.0 | 2922.0 | 1031.0 | 1047.0 |
| 3 | 36 / control | 2827.0 | 2391.0 | 5218.0 | 1953.0 | 1922.0 |
| 4 | 36 / candidate | 2422.0 | 2469.0 | 4891.0 | 2016.0 | 1875.0 |
| 5 | 48 / control | 3438.0 | 2687.0 | 6125.0 | 2313.0 | 2156.0 |
| 6 | 48 / candidate | 3578.0 | 2845.0 | 6423.0 | 2219.0 | 2203.0 |
| 7 | 48 / candidate | 3766.0 | 2812.0 | 6578.0 | 2172.0 | 2156.0 |
| 8 | 48 / control | 3453.0 | 2703.0 | 6156.0 | 2156.0 | 2094.0 |
| 9 | 36 / candidate | 2375.0 | 2454.0 | 4829.0 | 2218.0 | 1985.0 |
| 10 | 36 / control | 2923.0 | 2421.0 | 5344.0 | 2141.0 | 2063.0 |
| 11 | 16 / candidate | 1640.0 | 1298.0 | 2938.0 | 1031.0 | 922.0 |
| 12 | 16 / control | 1563.0 | 1312.0 | 2875.0 | 1000.0 | 922.0 |

## Complete memory vectors

MiB = 2^20 bytes. Actual process HWM is captured immediately after first/final return, before hashing/evidence work. Three full SVG batches remain alive until validation; all SVG references are then released before forced GC and post-drop heap. That heap still includes fonts, deck and caches. HWM is not isolated font memory and cannot shrink when objects are released.

| Child | Slides / variant | First HWM MiB | Final HWM MiB | Post-drop heap MiB |
| --- | --- | --- | --- | --- |
| 1 | 16 / control | 295.9 | 305.2 | 54.1 |
| 2 | 16 / candidate | 295.3 | 305.3 | 54.0 |
| 3 | 36 / control | 315.7 | 317.3 | 56.0 |
| 4 | 36 / candidate | 314.3 | 315.1 | 55.9 |
| 5 | 48 / control | 330.0 | 330.8 | 56.8 |
| 6 | 48 / candidate | 322.8 | 324.7 | 57.0 |
| 7 | 48 / candidate | 326.3 | 327.7 | 57.0 |
| 8 | 48 / control | 330.6 | 330.6 | 56.8 |
| 9 | 36 / candidate | 314.2 | 314.4 | 55.9 |
| 10 | 36 / control | 313.7 | 315.6 | 56.0 |
| 11 | 16 / candidate | 297.5 | 308.3 | 54.0 |
| 12 | 16 / control | 300.8 | 311.5 | 54.0 |

Final HWM means change about −0.50%, −0.54%, −1.37% for 16/36/48; post-drop heap changes −0.04%, −0.16%, +0.44%. Two repetitions do not establish robust memory savings. At 16, startup CPU rises 1.35% despite lower wall time. Warm CPU changes +4.46%, +0.19%, +0.36%. No universal CPU/RSS saving is claimed.

## Execution and evidence limits

Root session33356 actually terminated0. Frozen driver e000d364c791d4290ffc77fa7b6505ecbd2fe24e ran once from 2026-11-10T02:47:47.8635531Z to 02:49:13.9524611Z. Team builds/browser/native/compression were held; ambient desktop processes remained, with their primitive inventory preserved. Order: 16C,16V,36C,36V,48C,48V,48V,48C,36V,36C,16V,16C. Child deadline60s, retries0. Source/build/Node/input/font/license/module/WASM guards and formal03 timing boundaries remain unchanged.

The predeclared 48 fixture is 136,065 bytes, SHA256 31a4e04cadf81664db4c2883eb5004a7796ec72c18d6f5d5bdce4f85bdda1fec. It preserves first36 objects AND serialized slide token bytes and root metadata. Twelve clones change only12 slide IDs plus4 payload IDs; titles/content/styles stay exact. Both cores validate all three fixtures with zero format/reference errors and exact inherited Lucide warnings19/46/62; cloned warning paths are checked.

Preparation failures remain separate: working/Git CRLF byte refusal and dependent missing-script invocation; incorrect zero-warning expectation; four duplicate cloned payload IDs; overbroad string guard mistaking layout:cover for a local reference. Original bad48 input, findings and captured logs are retained. Tool-only refusal receipts explicitly state rawLogCaptured:false. The later evidence-packager log-filename refusal is documented in sealing-refusal.json and changed no trial or driver.

[summary.json](summary.json) retains every exact comparison/vector. raw.json.gz holds79 lossless records /1,779,248 decoded bytes: all actual child JSON/stdout/stderr/receipt, coordinator logs/quiet/exit, initial failed inputs/proofs, final preparation03 and executed driver bytes. receipt.json pins every member and historical Git source. Offline verifier: node docs/handoff/2026-11-10/rr114-replay-value-performance/verify.mjs. It performs no product imports, font loading, render or timing, and checks12 children/1,200 hashes, identities, metrics, derivation, original REDs and immutable driver.

Only two repetitions per variant/size, one Windows/Node24 machine and one deck family were screened. No browser/mobile/cloud throughput, p-value, general cap policy, native/PPTX acceptance or release conclusion follows. Parent owns the held-candidate decision. No new source fix/build/experiment occurred while sealing.
