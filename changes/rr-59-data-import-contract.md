---
type: fixed
packages: [opf]
---
RR-59: `importData` has literal overloads (`as: 'table'` returns `ImportedTable`, `as: 'chart'` returns `ImportedChart`), chart data declares its nonempty `columns` and `rows`, and `chart.type` and the `chartType` option are the OPF 0.15 chart-type vocabulary (`ImportedChartType`), so an imported table or chart composes into a `Presentation` without type assertions.
