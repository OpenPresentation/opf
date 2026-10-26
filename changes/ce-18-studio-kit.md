---
type: changed
packages: [editor]
---
CE-18: Layout Studio runs on a shared studio kit, with no change in behavior. The parts the coming Studio needs (the viewport with zoom, fit, pinch and pan; the selection model; the overlay with its boxes, badges, dividers, drop line and ratio badge; the drag controller; the layers tree; the inspector frame and field builders; the command registry and keymap; gesture history) moved from the layout editor's files into `src/studio-kit/`, which knows nothing about layout records: `src/layout-adapter.js` supplies the layout's keys, boxes, trial moves and gestures. The kit is internal for now (no package subpath); its own unit and browser tests cover each part, and the Layout Studio suites pass unchanged.
