---
type: changed
---
FA-07 (needs the core release that ships the FA-07 schema; lockstep with core, the renderer and the editor): `tel:` run links export as native PowerPoint hyperlinks like http(s) and mailto, the three targets `TextRun.link` now allows; a root `audience` that is one inline Audience object round-trips through the document provenance; chart data without inline columns and rows reports `chart-data-unplottable` with reason `no-columns` (the `data-not-inline` reason left with `ChartDataSource`, which core removed from the format). Font roles in fixtures are family-name strings and `FontScheme.app` is `powerpoint | google-slides`.
