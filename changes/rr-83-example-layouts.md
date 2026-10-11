---
type: changed
packages: [opf]
---
RR-83: examples and authoring guidance use the 0.19 layout templates. Layouts changed without a migration API or aliases. The 28 built-ins are `cover`, `section`, `agenda`, `text`, `statement`, `quote`, `closing`, `image`, `image-beside`, `gallery`, `chart`, `chart-beside`, `dashboard`, `metrics`, `table`, `table-beside`, `list`, `pillars`, `comparison`, `timeline`, `process`, `scorecard`, `two-column`, `hero`, `team`, `faq`, `code` and `logos`. Existing example content, notes, assets and metadata are preserved.

V1 layout records and the `layoutLeaves`, `layoutSlots`, placeholder-group helpers, `MAX_PLACEHOLDER_GROUP_DEPTH`, `ComposedSlot` and `chartPrimaryLayout` APIs are removed. Automatic `design.chartPrimary` keeps its weighted chart and support-group geometry; `layoutContent` and `layoutStructure` summarize v2 regions.
