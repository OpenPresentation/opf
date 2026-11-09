# RR-116 metric-cache comparison

Eight serial fresh Node24.20 children ran in an explicit team quiet window from 2026-11-09T20:45:49.518Z to 2026-11-09T20:46:44.139Z. Both variants use the same frozen a9ad390a17c9d55d84e727e4489b37bc81915ad4 core/gallery/renderer build, pinned eager office fonts and input decks. Symmetric font-module copies differ only in the metrics-cache implementation: exact eeb Git source before, exact a9 built source after. Only import locations are adapted. Each child records one first render and two warm runs; mirrored order includes two children for each size/variant. All208 per-child slide hashes equal the original standalone baseline, and every repeated render is byte-stable.

| Slides | Before warm ms, two child medians | After warm ms, two child medians | Reduction in mean child median | Before/after warm CPU ms, mean |
| --- | --- | --- | --- | --- |
| 16 | 1164.4 / 1184.6 | 1020.7 / 1035.2 | 12.5% | 1328.3 / 1234.5 |
| 36 | 2437.1 / 2536.9 | 2131.2 / 2101.6 | 14.9% | 2719.0 / 2367.3 |

These results support the narrow CPU optimization on the supplied text/shape-heavy decks. They are not a universal throughput guarantee or physical-mobile/cloud-instance result. Peak RSS varies in both directions across sizes; no memory-reduction claim is made. Post-GC JS heap is essentially unchanged, and the per-face cache remains bounded at512 entries with strings above2048 characters unretained. Automatic/explicit requests have distinct keys and can consume separate entries; exact semantic/output controls remain required.

The production patch moves Unicode direction and OpenType language analysis behind a successful unit-metrics cache lookup. Face/policy resolution stays outside the cache, and an outline request still upgrades a width-only entry. New public-handle semantic controls cover direction/paragraph/isolate/language/size/face/outline/eviction/engine-reset behavior. Existing real-font99 outline combinations and127-face preparation/integrity controls pass. Original install/build/check logs are included, with their dirty-source hashes bound to the eventual exact a9 source blob. The final coherent mapped/CI/native/release gates are still owed.

Vetoable decision: retain the measured speed change with byte-identical output; do not label it a font-memory fix. RR-114 demand loading is separate. This branch is evidence only and MUST NOT MERGE. Run `node docs/handoff/2026-11-09/svg-performance/verify-text-cache-trial.mjs` from this checkout for the38 raw members, exact source adaptation and208 SVG comparisons.
