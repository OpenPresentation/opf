---
type: fixed
packages: [mcp]
---
The OPF viewer in a very narrow pane, such as Cursor's IDE chat pane (about 215px): below 300px the chrome stays two rows (the name with Send and More, then Preview, Source and Design) and Undo and Redo move into More; with a mouse the controls keep 32px (a finger keeps the 44px targets), so the bar no longer takes three rows and More no longer leaves the frame after an edit. The slide takes the whole width, the Design sheet's section switch is two rows of two that can be read, the Find card scrolls inside the view instead of being cut off, and focusing it no longer shifts the view sideways. A host resizing the frame to the view's height no longer closes an open More menu. Below 200px the view keeps 200px and the frame scrolls sideways.

The More menu's host line, and the footer version's title, now also say what the host announced that the viewer acts on ("message: no · save files: no · full screen: no · tools: yes · context: yes"; from `hostCapabilities.message`, `downloadFile`, `serverTools`, `updateModelContext` and `hostContext.availableDisplayModes`), so a screenshot shows why Send, Export or Expand are missing in a host.
