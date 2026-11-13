---
type: fixed
packages: [editor]
---
RR-115: when deleting an autosave copy fails, discarding returns false with an error and keeps the recovery offer; a discard now waits for pending writes and keeps newer edits.
