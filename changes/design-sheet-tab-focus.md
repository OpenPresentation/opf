---
type: fixed
packages: [editor, mcp]
---
The Design menu's bottom sheet keeps the keyboard focus on a section tab (Theme, Colors, Fonts, Layout) when the sheet scrolls or the window resizes. Each scroll or resize inserted the section switch into the sheet again, which took the focus from the tab in it, so the arrow keys stopped moving along the switch and a screen reader lost its place. The switch is now inserted only when it is not there.
