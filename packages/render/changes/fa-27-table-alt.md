---
type: added
---
FA-27: `Table.alt` in the preview. A table with `alt` is wrapped in a `<g role="group" aria-label="...">` group, so a screen reader announces the summary and the cells stay readable (unlike a chart, which is `role="img"`); an empty `alt` wraps it in `<g aria-hidden="true">` (decorative). A table without `alt` draws byte-identical SVG. Needs the core release that adds `Table.alt`.
