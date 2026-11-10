# Why the 36-slide first render was slower

The demand font loader saves memory by loading only the faces this deck uses. Choosing those faces currently requires two complete analysis/layout passes before the actual SVG render. That added CPU work outweighed the faster first render in the original 36-slide test. Font-file reads were not the main cost.

## What the original controlled trial measured

Both paths used the same runtime, deck, font files and SVG output. These are Node24 measurements on one Windows computer, with two fresh processes per mode and deck size. Module import is separate; these figures are font preparation plus the first full SVG batch, rather than complete application startup.

| 36-slide phase | Whole-pack baseline | Demand loading |
| --- | --- | --- |
| Held font faces | 131 | 3 |
| Font preparation | 291 ms | 2,047 ms |
| First SVG batch | 3,196 ms | 1,913 ms |
| Preparation + first batch | 3,487 ms | 3,960 ms |
| Warm SVG batch | 2,124 ms | 1,689 ms |
| Peak process memory during rendering | 487-488 MiB | 323-324 MiB |
| Post-GC JavaScript heap | 99.8 MiB | 59.3 MiB |

Preparation added about 1,756 ms; the first render saved about 1,283 ms. The net first-use penalty was about 473 ms, or 13.6%. This trial's 131-face whole-pack baseline is distinct from the earlier 53-face configuration. The three selected faces were Intos 400/700 and Intos Display 700. Whole-process memory includes the engine and its caches; it is not raw font-file size.

[Original measurements](https://github.com/OpenPresentation/opf/blob/4d1ffa78440c47d955d9883575d347996325bf40/docs/handoff/2026-11-09/svg-performance/DEMAND-FONT-RESULTS.md).

## What the diagnostic established

A separate instrumented run observed two disjoint planner contexts, each composing all 36 slides: 72 analysis compositions before actual output. Together they occupied 2.154 seconds, 99.3% of that run's preparation. Verified local reads took 2.14 ms and hashing 0.93 ms. Those spans establish the extra work path; their instrumented durations do not replace the original benchmark.

The first pass discovers the styles the actual layout draws. The next checks selection and glyph coverage after verified font bytes have loaded. The engine also performed 5,079 fontkit shaping calls before attaching HarfBuzz, then discarded 880 metric-cache entries. The genuine first SVG batch made the same 48,955 HarfBuzz shaping calls under both font modes. Removing font coverage checks or reusing metrics across shapers would risk incorrect text or missing glyphs.

[Diagnostic and limits](https://github.com/OpenPresentation/opf/blob/697100785cc10bb21d03dce13907a926baf64935/docs/handoff/2026-11-09/rr114-cold-start-diagnostic/RESULTS.md).

## Latest optimization check

A separate candidate attempts to reuse verified analysis work while retaining coverage/fallback checks and exact SVG bytes. In a mirrored 12-process trial, startup was 1.83% faster at 16 slides and 8.00% faster at 36, but 5.58% slower at 48. Both 48-slide candidate repetitions were slower than both controls. The reason for that regression, including whether a replay cap was involved, was not instrumented and remains unknown. All 1,200 SVG checks matched. Post-GC heap was essentially unchanged.

Root independently replayed all 79 evidence records and exact output/input/source guards again. No new timing experiment or source change was made for this check. This is not a fresh comparison against the original whole-pack baseline, so the percentages cannot be subtracted to claim the original penalty is eliminated. The candidate remains UNFOLDED.

[Latest complete results](https://github.com/OpenPresentation/opf/blob/e8a813dd7325b302fb60638a8ad846928562d16f/docs/handoff/2026-11-10/rr114-replay-value-performance/RESULTS.md).

Vetoable decision: keep the established demand-loader memory and warm-render gains, retain the explicit whole-pack option, and hold this startup candidate while the larger-deck regression remains unexplained. Reuse a prepared handle for repeated work, calling ensure after edits that need additional faces. Browser/mobile/cloud performance requires its own measurements; these Node results do not qualify those environments.
