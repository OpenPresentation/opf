---
type: fixed
---

Preserve the native font-observation failure latch when an adapted property getter throws. Read the descriptor chain through explicit adapted getters, while retaining legitimate missing or mixed font values; pure controls cover every chain property and prohibit later reads after failure.
