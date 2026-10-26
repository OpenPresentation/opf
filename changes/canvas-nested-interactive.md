---
type: fixed
packages: [editor]
---
The canvas no longer nests interactive controls (axe `nested-interactive`). An editing target that holds other targets (a table with its cells, a code block with its filename, a list with its items, a timeline, a chart with its axis labels) is now a named `role="group"` that is not focusable, and its selection handle (the transparent rect that already covered it) is the `role="button"` and the tab stop, so Tab, Enter, F2 and Space, click and `reveal(path, { focus: true })` still reach the container, then its children. Leaf targets are unchanged: focusable buttons. `onSelect({ element })` is the container group for such a target; focus its handle (`element.querySelector(':scope > .opf-selection')`) rather than the group.
