# Face-level Node fonts: measured memory and startup tradeoff

Evidence only; NEVER MERGE. Eight fresh Node24 processes ran once in a confirmed all-team quiet window, mirrored whole/demand order, two processes per16/36-slide configuration. Actual process57278 exited0. Both modes use the SAME reviewed runtime ed29f47f092aeefbde5fabac26d395f92c6b7823, built at3857ff1bbc467ddb0d0031bc400e159d120b67b9. Whole mode uses the historical no-presentation full-pack path; demand mode supplies the actual presentation and scripts:auto. Each process renders once then twice warm. All208 per-child slide hashes match across modes and repetitions; repeated outputs are stable. Input bytes and all pinned face/license/manifest bytes are preserved.

| Input/mode | Held faces | Font preparation mean | First SVG batch mean | Warm mean of process medians | Peak process RSS during render | Final post-GC JS heap |
| --- | ---: | ---: | ---: | ---: | --- | --- |
|16 whole |131 |267ms |2048ms |1064ms |477.5–481.1MiB |96.1MiB |
|16 demand |3 |1063ms |1035ms |843ms |305.0–305.6MiB |55.5MiB |
|36 whole |131 |291ms |3196ms |2124ms |487.3–488.3MiB |99.8MiB |
|36 demand |3 |2047ms |1913ms |1689ms |323.0–324.4MiB |59.3MiB |

The3 exact faces are Intos400/700 and Intos Display700, serving the authored Aptos scheme. Observed peak process RSS falls about36%/34%, or roughly172–176MiB/163–165MiB on16/36slides. These are whole-process measurements, not an assertion that all saved memory belonged to raw font files. Warm rendering is about20.8%/20.5% faster; mean warm process CPU falls1195→946ms /2372→1883ms. These same-runtime gains are not additive guarantees with the separate RR116 trial.

Preparation is more expensive because the demand planner analyzes the actual document before loading faces. Preparation plus first batch is2316→2099ms for16slides, but3487→3960ms for36: the larger deck's first use is about13.6% slower despite the substantial memory reduction. Module import is recorded separately; these sums are not complete application startup. Reusing the handle amortizes preparation, but a host must await ensure after newly used faces/edits; synchronous drawing does not secretly fetch resources. Handles retain previously prepared faces during their lifetime. The no-presentation path deliberately retains explicit whole-pack behavior.

Vetoable decision: retain face-level demand as the memory-oriented Node default when a presentation is provided, record the first-use analysis cost openly, and keep the explicit full-pack path. Further cold-start planner work must preserve the actual glyph/style/fallback checks and exact output. This small two-process-per-mode trial is not physical-mobile, every-deck, cloud-provider, RSS-limit or leak qualification. Browser loading is a separate path and already fetched only4faces in its historical baseline.

Compression/hashing/controlled GC are outside measured render intervals. Standalone output and compression sizes are identical between modes (summed gzip401383B /923187B for16/36). Raw samples record setup RSS, buffers/external/heap, per-render CPU/RSS and first/warm distinctions. No production pin, golden, Office, CI or release changed in this evidence lane. Root reviewed the source and final69-record source qualification separately; the coherent mapper/CI/native/release gates remain owed.

Replay offline with node docs/handoff/2026-11-09/svg-performance/verify-demand-font-trial.mjs. The source objects must be available from the pushed RR114 branch. The archive retains all raw child stdout/stderr/results, exact inputs, both drivers and actual terminal receipt. Fresh output directories and45s child deadlines are enforced; no retry or failed formal case was discarded.
