---
type: added
packages: [opf, cli]
---
Agent guidance from the 2026-10-26 outside audit: a chart written in the Chart.js or ECharts shape (`categories` and `series`, or `labels` and `datasets`, and no `data`) is one `opf/schema` finding whose hint shows the author's own values as `data: { columns, rows }`, with a patch fix, instead of a missing-`data` error plus one additional-property error per key; the `Chart` and `ChartData` schema descriptions state the shape with a one-line example. Every schema carries a `$comment` that says `v1` is the pre-1.0 line and may change in any 0.x minor release, `opf schemas` lists the `@openpresentation/opf` version beside each schema id, `opf schema` names it in the whole schema's `$comment`, `opf --version` names the schema id, and `docs/schema-versioning.md` explains how to pin it.
