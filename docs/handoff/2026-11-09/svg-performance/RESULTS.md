# Server SVG baseline

Eight formal cases completed 2026-11-09T19:24:55.992Z; five warm runs per case after a separately recorded first render. Independent Node24.20 children ran serially on a Ryzen7 9700X/32GiB Windows workstation while every team member held heavy commands. OS file cache was warm. Smoke/profile runs are preserved but excluded from formal timing. No real mobile-device or cloud-instance claim.

| Slides | Mode | Warm median | Render peak RSS | Raw SVG | Gzip SVG |
| --- | --- | --- | --- | --- | --- |
| 16 | batch-fonts | 1168.0ms | 424.1MiB | 915738 | 401383 |
| 16 | selected-default | 1212.4ms | 437.9MiB | 915738 | 401383 |
| 16 | selected-once | 1171.1ms | 440.3MiB | 915738 | 401383 |
| 16 | batch-system | 1188.3ms | 327.0MiB | 103867 | 21806 |
| 36 | batch-fonts | 2822.4ms | 436.8MiB | 2084780 | 923187 |
| 36 | selected-default | 2568.0ms | 437.3MiB | 2084780 | 923187 |
| 36 | selected-once | 2445.5ms | 429.6MiB | 2084780 | 923187 |
| 36 | batch-system | 2560.0ms | 338.5MiB | 226680 | 48398 |

The three standalone modes produce identical per-slide SVG hashes, with stable repeated renders. Shared-font/system-text SVG intentionally omits embedded fonts and requires matching externally loaded fonts. It is a hosting scenario, not a self-contained export replacement. Compression is outside rendering and summed per slide; Brotli uses explicit quality5.

Between16 and36 slides, work grows roughly with slide count; these two points do not prove scaling at larger sizes. Fixed eager Node font preparation and repeated text work deserve investigation. The smoke CPU profile points to Unicode direction analysis, shaping and font resolution; it is attribution evidence rather than an optimization proof. No production optimization has been made yet.

The current Node office loader eagerly loads its pack; the actual browser loader is lazy and must be measured in its own lane. A font handle is reused. Potential cache changes must preserve glyphs, metrics, BiDi/language behavior, reset semantics and bounded memory. Next: browser/update/storage measurements, then controlled before/after optimization trials with exact SVG comparisons.

Raw member hashes, child stdout/stderr, samples, process CPU, memory checkpoints, font substitutions, storage/element counts, input validation and the excluded smoke profile are sealed in server-baseline-01.raw.json.gz. Run verify-server-baseline.mjs to replay the checks offline.
