---
type: added
---
FA-26 (needs core 0.16.0): the export places every leaf of a layout record with nested placeholder groups (`{ "type": "group", "composition", "placeholders" }`, up to three levels) in the box core composition gives it, the same box the preview draws, and a document's own records, groups included, survive an unchanged round trip. `design.chartPrimary` exports the placeholder group it stands for, with unchanged geometry. `test/placeholder-groups.mjs` exports core's cross-engine fixture (`test/fixtures/placeholder-groups.opf.json`) and checks every native frame within 0.5 pt.
