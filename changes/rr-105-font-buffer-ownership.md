---
type: fixed
packages: [render]
---

Copy caller font bytes into owned plain Uint8Array storage before registry and PDF font validation. Node Buffer inputs no longer share slice views that subset validation could corrupt; font permissions and shaping refusals stay unchanged.
