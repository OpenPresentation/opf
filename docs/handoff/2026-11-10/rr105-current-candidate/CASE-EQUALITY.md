# Exact per-case equality versus fd13

This compares data bytes only. The 53 equal-PPTX count and 53 generic-eligible count are unrelated; neither means 53 native cases passed. Existing native observations may be reused only after the coordinator matches the exact input AND required acceptance scope. Nothing is promoted here. B07/fonts/physical-glyph gaps remain open.

All 59 source documents match. Canonical mode JSON is distinguished from prepared raw source bytes. Every generated primary SVG/PNG matches. Mode/table cases without previews say not generated; no preview from another case is substituted.

| Case | Source equality | PPTX equality | Preview equality | Generic eligible |
| --- | --- | --- | --- | --- |
| layout-title-auto | equal | equal | equal (6 files) | true |
| layout-media-regions | equal | equal | equal (6 files) | true |
| layout-empty-custom | equal | equal | equal (6 files) | true |
| table-save | equal | equal | equal (6 files) | true |
| furniture-inherited | equal | equal | equal (6 files) | true |
| furniture-flags | equal | equal | equal (6 files) | true |
| list-description-native-edit | equal | equal | equal (2 files) | true |
| list-description-native-save | equal | equal | equal (2 files) | true |
| layout-bleed-card | equal | equal | equal (2 files) | true |
| picture-control | equal | equal | equal (2 files) | true |
| furniture-layouts | equal | equal | equal (6 files) | true |
| chart-treemap-category | equal | equal | equal (2 files) | true |
| chart-histogram-single | equal | equal | equal (2 files) | true |
| chart-histogram-category | equal | CHANGED | equal (2 files) | true |
| chart-pareto-multi | equal | equal | equal (2 files) | true |
| chart-box-multi | equal | equal | equal (2 files) | true |
| chart-waterfall-single | equal | equal | equal (2 files) | true |
| chart-funnel-category | equal | equal | equal (2 files) | true |
| chart-world-category | equal | equal | equal (2 files) | true |
| chart-all-seven | equal | CHANGED | equal (14 files) | false |
| feature-catalog-timeline | equal | equal | equal (2 files) | true |
| feature-dense-events | equal | equal | equal (2 files) | false |
| feature-custom-roadmap | equal | equal | equal (2 files) | true |
| feature-long-labels | equal | equal | equal (2 files) | true |
| feature-metrics | equal | equal | equal (2 files) | true |
| feature-quote | equal | equal | equal (2 files) | true |
| feature-list | equal | equal | equal (2 files) | true |
| feature-table | equal | equal | equal (2 files) | true |
| chart-mode-treemap-category-fallback | equal (canonical mode JSON) | equal | not generated | true |
| chart-mode-treemap-category-auto | equal (canonical mode JSON) | equal | not generated | true |
| chart-mode-treemap-category-native | equal (canonical mode JSON) | equal | not generated | true |
| chart-mode-histogram-single-fallback | equal (canonical mode JSON) | equal | not generated | true |
| chart-mode-histogram-single-auto | equal (canonical mode JSON) | equal | not generated | true |
| chart-mode-histogram-single-native | equal (canonical mode JSON) | equal | not generated | true |
| chart-mode-histogram-category-fallback | equal (canonical mode JSON) | equal | not generated | true |
| chart-mode-histogram-category-auto | equal (canonical mode JSON) | CHANGED | not generated | true |
| chart-mode-histogram-category-native | equal (canonical mode JSON) | CHANGED | not generated | true |
| chart-mode-pareto-multi-fallback | equal (canonical mode JSON) | equal | not generated | true |
| chart-mode-pareto-multi-auto | equal (canonical mode JSON) | equal | not generated | true |
| chart-mode-pareto-multi-native | equal (canonical mode JSON) | equal | not generated | true |
| chart-mode-box-multi-fallback | equal (canonical mode JSON) | equal | not generated | true |
| chart-mode-box-multi-auto | equal (canonical mode JSON) | equal | not generated | true |
| chart-mode-box-multi-native | equal (canonical mode JSON) | equal | not generated | true |
| chart-mode-waterfall-single-fallback | equal (canonical mode JSON) | equal | not generated | true |
| chart-mode-waterfall-single-auto | equal (canonical mode JSON) | equal | not generated | true |
| chart-mode-waterfall-single-native | equal (canonical mode JSON) | equal | not generated | true |
| chart-mode-funnel-category-fallback | equal (canonical mode JSON) | equal | not generated | true |
| chart-mode-funnel-category-auto | equal (canonical mode JSON) | equal | not generated | true |
| chart-mode-funnel-category-native | equal (canonical mode JSON) | equal | not generated | true |
| chart-mode-world-category-fallback | equal (canonical mode JSON) | equal | not generated | true |
| chart-mode-world-category-auto | equal (canonical mode JSON) | equal | not generated | true |
| chart-mode-world-category-native | equal (canonical mode JSON) | equal | not generated | true |
| chart-mode-all-seven-fallback | equal (canonical mode JSON) | equal | not generated | false |
| chart-mode-all-seven-auto | equal (canonical mode JSON) | CHANGED | not generated | false |
| chart-mode-all-seven-native | equal (canonical mode JSON) | CHANGED | not generated | false |
| chart-mode-pareto-single-auto | equal | equal | not generated | true |
| chart-mode-pareto-single-fallback | equal | equal | not generated | true |
| chart-mode-pareto-single-native | equal | equal | not generated | true |
| table-colors | equal | equal | not generated | false |

Exact old/new paths, sizes, SHA256 values and byte-pinned source snapshots are in case-equality-roster.json. Only histogram-category primary/auto/native and all-seven primary/auto/native PPTXs changed. No Office ran.
