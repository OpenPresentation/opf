---
type: changed
---
FA-17: `composeSlide()` and the canvas no longer resolve `titleAlignment`, `contentAlignment` and `contentBox` from the slide and deck themselves; composition resolves them with the layout record's `design` as the lowest-precedence default (slide design, then deck design, then layout design), so a layout that sets alignment is drawn aligned in the editor canvas without copying its `design` into the deck or slide. Stacks on FA-01; needs the FA-17 core.
