# Charts: 26 values

Classification: **works** 19, **partial** 7

Schema-valid 26/26. Catalog id resolves in core 26/26.

## Top reasons

| count | reason |
|---|---|
| 7 | export reports chart-data-adapted (..) |
| 2 | export writes barChart, barDir col, grouping clustered; core catalog mappings.openxml histogramChart |
| 1 | export writes barChart, barDir col, grouping clustered; core catalog mappings.openxml treemapChart |
| 1 | re-import returns chart type "column", expected "treemap" (..) |
| 1 | re-import returns chart type "column", expected "histogram" (..) |
| 1 | re-import returns chart type "column", expected "pareto" (..) |
| 1 | export writes barChart, barDir col, grouping clustered; core catalog mappings.openxml mapChart |
| 1 | re-import returns chart type "column", expected "world" (..) |

| id | valid | catalog | engine effect | reasons | class |
|---|---|---|---|---|---|
| column | true | true | preview column marks {"marks":8}; export barChart, barDir col, grouping clustered; re-import column |  | works |
| stacked-column-3x | true | true | preview stacked-column-3x marks {"marks":24}; export barChart, barDir col, grouping stacked; re-import stacked-column-3x |  | works |
| 100pct-stacked-column-3x | true | true | preview 100pct-stacked-column-3x marks {"marks":24}; export barChart, barDir col, grouping percentStacked; re-import 100pct-stacked-column-3x |  | works |
| line | true | true | preview line marks {"lines":1,"markers":0}; export lineChart, grouping standard, no markers; re-import line |  | works |
| line-with-markers | true | true | preview line-with-markers marks {"lines":1,"markers":12}; export lineChart, grouping standard, markers; re-import line-with-markers |  | works |
| stacked-line-3x | true | true | preview stacked-line-3x marks {"lines":3,"markers":0}; export lineChart, grouping stacked, no markers; re-import stacked-line-3x |  | works |
| stacked-line-with-markers-3x | true | true | preview stacked-line-with-markers-3x marks {"lines":3,"markers":36}; export lineChart, grouping stacked, markers; re-import stacked-line-with-markers-3x |  | works |
| pie | true | true | preview pie marks {"slices":2}; export pieChart; re-import pie |  | works |
| doughnut | true | true | preview doughnut marks {"slices":2}; export doughnutChart; re-import doughnut |  | works |
| bar | true | true | preview bar marks {"marks":6}; export barChart, barDir bar, grouping clustered; re-import bar |  | works |
| stacked-bar-3x | true | true | preview stacked-bar-3x marks {"marks":18}; export barChart, barDir bar, grouping stacked; re-import stacked-bar-3x |  | works |
| 100pct-stacked-bar-3x | true | true | preview 100pct-stacked-bar-3x marks {"marks":18}; export barChart, barDir bar, grouping percentStacked; re-import 100pct-stacked-bar-3x |  | works |
| area | true | true | preview area marks {"areas":1}; export areaChart, grouping standard; re-import area |  | works |
| stacked-area-3x | true | true | preview stacked-area-3x marks {"areas":3}; export areaChart, grouping stacked; re-import stacked-area-3x |  | works |
| 100pct-stacked-area-3x | true | true | preview 100pct-stacked-area-3x marks {"areas":3}; export areaChart, grouping percentStacked; re-import 100pct-stacked-area-3x |  | works |
| scatter | true | true | preview scatter marks {"points":9}; export scatterChart, scatterStyle marker; re-import scatter |  | works |
| radar | true | true | preview radar marks {"series":1,"markers":0}; export radarChart, radarStyle standard, no markers; re-import radar |  | works |
| radar-with-markers | true | true | preview radar-with-markers marks {"series":1,"markers":8}; export radarChart, radarStyle marker, markers; re-import radar-with-markers |  | works |
| filled-radar | true | true | preview filled-radar marks {"series":1,"markers":0}; export radarChart, radarStyle filled, no markers; re-import filled-radar |  | works |
| treemap | true | true | preview treemap marks null; export barChart, barDir col, grouping clustered (chart-data-adapted: chartex-fallback); re-import column | export writes barChart, barDir col, grouping clustered; core catalog mappings.openxml treemapChart; export reports chart-data-adapted (chartex-fallback); re-import returns chart type "column", expected "treemap" (diagnostics: heading-import-reflow) | partial |
| histogram | true | true | preview histogram marks null; export barChart, barDir col, grouping clustered (chart-data-adapted: chartex-fallback); re-import column | export writes barChart, barDir col, grouping clustered; core catalog mappings.openxml histogramChart; export reports chart-data-adapted (chartex-fallback); re-import returns chart type "column", expected "histogram" (diagnostics: heading-import-reflow) | partial |
| pareto | true | true | preview pareto marks null; export barChart, barDir col, grouping clustered (chart-data-adapted: chartex-fallback); re-import column | export writes barChart, barDir col, grouping clustered; core catalog mappings.openxml histogramChart; export reports chart-data-adapted (chartex-fallback); re-import returns chart type "column", expected "pareto" (diagnostics: heading-import-reflow) | partial |
| world | true | true | preview world marks null; export barChart, barDir col, grouping clustered (chart-data-adapted: chartex-fallback); re-import column | export writes barChart, barDir col, grouping clustered; core catalog mappings.openxml mapChart; export reports chart-data-adapted (chartex-fallback); re-import returns chart type "column", expected "world" (diagnostics: heading-import-reflow) | partial |
| box-and-whisker | true | true | preview box-and-whisker marks null; export barChart, barDir col, grouping clustered (chart-data-adapted: chartex-fallback); re-import column | export writes barChart, barDir col, grouping clustered; core catalog mappings.openxml boxWhiskerChart; export reports chart-data-adapted (chartex-fallback); re-import returns chart type "column", expected "box-and-whisker" (diagnostics: heading-import-reflow) | partial |
| waterfall | true | true | preview waterfall marks null; export barChart, barDir col, grouping clustered (chart-data-adapted: chartex-fallback); re-import column | export writes barChart, barDir col, grouping clustered; core catalog mappings.openxml waterfallChart; export reports chart-data-adapted (chartex-fallback); re-import returns chart type "column", expected "waterfall" (diagnostics: heading-import-reflow) | partial |
| funnel | true | true | preview funnel marks null; export barChart, barDir col, grouping clustered (chart-data-adapted: chartex-fallback); re-import column | export writes barChart, barDir col, grouping clustered; core catalog mappings.openxml funnelChart; export reports chart-data-adapted (chartex-fallback); re-import returns chart type "column", expected "funnel" (diagnostics: heading-import-reflow) | partial |
