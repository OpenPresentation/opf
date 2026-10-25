---
type: fixed
packages: [editor]
---
Autosave no longer commits an inline edit in progress: the debounced write stores the committed document and leaves the draft alone, so a change made a moment before no longer closes the inline editor under the user (on a slow machine the 800 ms debounce fired mid-typing and ended the edit). `flush()`, `markSaved()`, `beforeunload` and `pagehide` still call `beforeFlush` first, so a draft is committed before the page goes.
