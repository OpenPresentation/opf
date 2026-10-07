---
type: changed
---
FA-07 (needs the core release that ships the FA-07 schema; lockstep with core, PPTX and the editor): the SVG preview links `tel:` run links as well as http(s) and mailto, the three targets `TextRun.link` now allows. Font roles are family-name strings, so tests and fixtures use `heading`/`body`/`accent`/`code` as strings and `FontScheme.app` as `powerpoint | google-slides`; a data source by file or asset (`ChartDataSource`) is no longer part of the format and is rejected at the boundary like any other invalid chart data.
