---
type: fixed
packages: [editor]
---
Source pane with a worker: when a check took longer than the gap between two keys, the pane counted the superseded request as still running, so `pane.whenIdle()` never resolved and `data-opf-checking` stayed set; only the newest request of each kind is tracked now.
