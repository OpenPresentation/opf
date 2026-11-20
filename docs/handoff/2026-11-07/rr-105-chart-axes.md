# RR-105: box-and-whisker and scatter axes

Based on integration a12841f376c9d3be2fa4d382f0c67e9297c6ce20; coordinated under #1139. Native automatic axes differed from the preview. Core now composes numeric axes shared by preview and PPTX. Sampler slide 1 keeps box 0–15 by 5, scatter X 0–500 by 100 and Y 0–250 by 100; native scatter X has no vertical gridlines.

Vetoable decision: preserve the reviewed preview axes and write native axes explicitly. No source data, font size or comparison tolerance changed. Every slide of all 12 affected example decks has the same portable SVG hash before and after (default measurement); hashes are in rr-105-chart-preview-hashes.json. No goldens were regenerated locally.

Coordinator native recheck is owed on chart-type-sampler slide 1. Stacked horizontal sibling plots remain a separate v0.34 item.

Measured verification: the same 12-deck comparison with pinned Office-pack fonts and the visual substitution policy is byte-identical too (zero changed slides). Core typecheck passes, 38 focused axis/layer tests pass, and exact native XML assertions pass. Full check:changed was run against the integration base; Windows browser-safe/script-width and omitted-evidence checks fail as documented. Two obsolete scatter-layer assertions were corrected to exact numeric objects and pass in the focused rerun. Remaining package checks are tracked in the PR.
