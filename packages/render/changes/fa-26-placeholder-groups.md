---
type: added
---
FA-26 (needs core 0.16.0): the preview draws layout records with nested placeholder groups (`{ "type": "group", "composition", "placeholders" }`, up to three levels) in the boxes core composition gives each leaf, and exposes the record's slots on each resolved slide's `geometry.slots` (`resolvePresentation`). `design.chartPrimary` draws the placeholder group it stands for, with unchanged geometry. `test/placeholder-groups.mjs` renders core's cross-engine fixture (`test/fixtures/placeholder-groups.opf.json`) and checks every traced leaf against its composed box. No golden changes.
