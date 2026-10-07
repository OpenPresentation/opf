---
type: added
---
FA-09: `Chart.alt` in the preview. A chart with `alt` is wrapped in a `<g role="img" aria-label="...">` group, so a screen reader announces the text alternative and skips the marks inside; an empty `alt` wraps it in `<g aria-hidden="true">` (decorative). A chart without `alt` draws byte-identical SVG. Needs the core release that adds `Chart.alt`.
