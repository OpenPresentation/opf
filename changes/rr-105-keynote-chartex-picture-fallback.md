---
type: changed
packages: [pptx]
---
An extended chart (histogram, Pareto, box and whisker, waterfall, funnel, treemap) now falls back to a picture of OPF's own preview of the chart in apps that cannot draw extended charts, such as Keynote, instead of a clustered column chart of its raw data; PowerPoint still opens the same native, editable chart. The classic chart part that served as the fallback is no longer written (its embedded workbook stays), and without opf-render or an SVG rasterizer the clustered column fallback is kept with a `chartex-fallback-picture-unavailable` diagnostic.
