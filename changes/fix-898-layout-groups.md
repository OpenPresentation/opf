---
type: fixed
packages: [editor]
---
The layout pickers (the JSON field menu, the live completions and the slide manager's layout list) group a layout by its catalog record's group, the Gallery's index group, instead of a fixed list of 28 ids in the editor. `agenda-split` is listed under Openers and closers and `three-column` under Text, not under Custom layouts, and a layout a catalog adds later is grouped at once. A record with no group, a choice with no record and the deck's own layouts stay under Custom layouts. `LAYOUT_INTENT_GROUPS` is removed from `@openpresentation/opf-editor/layout-templates`; `layoutGroupName`, `layoutGroupOrder` and `CUSTOM_LAYOUTS_GROUP` replace it. (OpenPresentation/opf#898)
