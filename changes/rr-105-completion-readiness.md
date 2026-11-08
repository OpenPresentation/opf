---
type: fixed
packages: [editor]
---
Source-pane browser acceptance waits for the requested catalog completion before checking its values, avoiding stale-popup failures on slower runners while retaining the existing catalog coverage assertion.
