---
type: fixed
packages: [editor]
---
CE-20: embedded editors with a canvas or thumbnail strip no longer render every slide into an unused manager cache after a document change. Actual slide managers and the active sorter retain their current thumbnails; the strip keeps its own lazy rendering.
