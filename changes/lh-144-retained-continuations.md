---
type: fixed
packages: [opf]
---
LH-144 (output-changing for continued slides): when an overfull slide continues onto further slides, its text keeps the size it was set at, and the split prefers pages whose body text reads at a comparable size. Continuation pages share one size without being held to the first page's, so pages that all have room keep their growth; no continuation page is smaller than v0.33.0 drew it.
