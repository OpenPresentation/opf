---
type: fixed
packages: [editor]
---

Invalidate retained review geometry when resource preparation fails after partial progress, so a different already-complete document receives fresh diagnostics even when no subsequent load is pending.