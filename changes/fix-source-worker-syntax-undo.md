---
type: fixed
packages: [editor]
---
Source pane with `worker` on: the syntax check in the worker no longer returns early when the text equals the last applied text, so after a quick fix and one Undo the "`design` needs a value" problem shows again at once instead of at the next key (the main-thread check never had that guard). The harness page takes `?applyDelay=` for the test.
