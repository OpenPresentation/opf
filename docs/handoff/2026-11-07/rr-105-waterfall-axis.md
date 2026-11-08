# RR-105: native waterfall numeric axis

Branch: `codex/rr-105-waterfall-axis`, derived from fresh main and fast-forwarded to the coordinator's exact preparation commit d26031b98ff9316d479f8db7a383511371cab4a6. Base PR target: codex/integration-033. Frozen #1140 and v0.34 feature branches are unchanged.

The final native pass found layout-harvest slide 19's 8.4-million bar too tall: the hidden native value axis still wrote empty valScaling while preview used a ten-million maximum. The v0.34 deferral is withdrawn. This supported defect blocks v0.33 until native recheck.

Vetoable decision: preserve the reviewed preview geometry. Core's numeric axis plan now includes waterfall running totals, null gaps, sign crossings, terminal totals, category-label reserves and axis titles. Preview consumes that plan, and native PPTX writes it on hidden as well as visible value axes. Numeric min/max are not authoring options in the current schema; existing axisTitles/dataLabels options remain respected.

Before/after hashes of all 130 SVG pages across the seven affected example/qualification decks, with portable and measured office fonts, match exactly. No golden is regenerated locally. Scalar/native-XML tests and the coordinator's native recheck are recorded in the PR before folding.

The three new core scalar tests, native XML scale controls, the existing box/scatter numeric tests and all 31 chartex checks pass. The chartex exact-value assertion now expects the reviewed waterfall 0..100 by 20; strict legacy archive digests remain unchanged and pass, so no archive fixture generator was needed. An additional 54-case category-label/options/narrow-layout matrix is SVG-identical to the preparation renderer. Check:changed is running (build/Biome/fragment checks pass; documented Windows/sparse-evidence checks fail). Fresh native input: `C:/opf-work/rr-105-waterfall-axis/artifacts/waterfall-axis/layout-harvest.pptx`, slide 19, matching `layout-harvest-19.png`; [manifest and proof](../../evidence/rr-105-waterfall-axis/README.md).
