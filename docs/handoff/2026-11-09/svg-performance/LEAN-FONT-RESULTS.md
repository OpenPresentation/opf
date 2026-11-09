# Existing font-selection options: controlled trial

Six serial fresh Node24 children completed 2026-11-09T20:15:01.927Z to 2026-11-09T20:15:50.751Z in an explicit team quiet window. The fixed mirrored order was full, no-open, office-only, office-only, no-open, full. Each rendered the exact 36-slide deck once initially and twice warm. Compression was outside the render intervals. All 216 per-case slide hashes matched the accepted standalone baseline; each child also checked repeated-render identity. This is a small configuration trial, not a production patch or a broad throughput study.

| Existing loader selection | Loaded faces | Raw font MiB | Setup RSS MiB, two runs | Render peak RSS MiB, two runs | Warm median ms, two runs |
| --- | --- | --- | --- | --- | --- |
| batch-fonts | 131 | 36.0 | 183.2 / 182.9 | 474.3 / 471.3 | 2428.1 / 2477.1 |
| batch-no-open | 53 | 22.6 | 143.4 / 145.5 | 407.7 / 404.7 | 2066.6 / 2082.5 |
| batch-office-only | 44 | 21.3 | 138.8 / 138.6 | 385.2 / 411.4 | 2031.6 / 2042.6 |

`batch-no-open` adds `includeOpenFonts:false` to the original office-pack options. `batch-office-only` also adds `includeBaseFonts:false`; the four-face Noto Sans fallback is retained in both. No font, glyph, geometry or serialization changed in this deck. The raw font total is the sum of registered face input bytes; process RSS also includes parsed tables, rendering, shaping/subset engines, caches, strings and allocator capacity. The two RSS runs are reported individually because garbage collection and allocation peaks vary. Do not compare these absolute peaks directly with the earlier five-warm-run protocol or label the difference as an isolated font allocation.

Vetoable decision: use these controls to guide a demand-based Node loading/encoding change, preserving font selection and fallback. Do not make `includeOpenFonts:false` a global default: decks and later edits may use those families. Do not remove the base pack globally on this one-deck result. Further cases must cover mixed fonts, styles, scripts, edits and output parity.

The source code remains the accepted runtime58e baseline. No production optimization or universal mobile/cloud memory claim is made. Run `node docs/handoff/2026-11-09/svg-performance/verify-lean-font-trial.mjs` from the checkout to verify the archive, six cases and exact-output controls. This evidence-only branch must not be merged.
