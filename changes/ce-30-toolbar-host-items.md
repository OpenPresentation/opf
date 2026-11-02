---
type: added
packages: [editor]
---
CE-30: a toolbar item of your own. `{ id, priority }` with a name that is not one of the editor's items (in `createToolbar` or the `toolbar` option) adds an empty slot with that priority: put your element in `editor.toolbar.slot(id)` and register its ⋯ entries with `editor.toolbar.mount(id, { menuItems })`. A bare unknown name still throws. `setItem(id, { collapsible: false })` on an item that was in ⋯ now brings it back to the bar.
