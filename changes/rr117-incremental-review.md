---
type: changed
packages: [opf, editor]
---

Repeated editor reviews reuse bounded, equivalent slide composition data while rerunning every selected validation rule and rebuilding findings, fixes and locations. The review panel exposes `whenIdle()` for the completed debounced audit/list and explicit resource invalidation; plain `validate()` remains cold.
