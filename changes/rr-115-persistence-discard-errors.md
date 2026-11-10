---
type: fixed
packages: [editor]
---
RR-115: failed autosave-copy deletion now returns false with an error and retains the recovery offer for restore or retry. Discard is serialized with pending writes, and its prompt announces success only after deletion succeeds, preserving newer queued edits.
