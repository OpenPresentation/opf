---
type: added
packages: [opf, cli]
---
FA-09 (additive schema; lockstep with the renderer, PPTX and editor): `Chart.alt`, the text alternative for a chart (what the data shows, not "a chart"). `""` marks a chart decorative, like an empty `Asset.alt`. The preview exposes it as the chart's accessible name, the PowerPoint export writes it as the chart frame's `descr` and import reads it back. Core: `validate`'s `opf/chart-text-alternative` reads `chart.alt` first (a non-blank alt passes; without alt, text beside the chart still passes; `alt: ""` is reported as info so the choice is reviewed), its quick fix focuses the `alt` field, and `opf/poor-alt-text` also checks chart alt text (a bare "chart", a URL, a leading "chart of", over 250 characters). The Markdown chart fence takes it as ` ```chart column alt="..." ` (`markdown/chart-attributes` for an unknown attribute); a chart with `alt` converts to and from Markdown natively.
