---
type: fixed
packages: [editor]
---

The presenter no longer misreads the visitor leaving full screen as an exit it asked for itself. When a browser merged an exit and the next presentation's full screen request into one change, the exit's `fullscreenchange` never came and the stale record swallowed the visitor's own Esc, so the presentation stayed open. Also, focus returns to the opener after the exit button was clicked even when the browser had not yet moved focus off the hidden button.
