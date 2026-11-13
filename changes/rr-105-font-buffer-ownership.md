---
type: fixed
packages: [render]
---
Font bytes passed in as Node `Buffer`s are copied before validation, so font subsetting can no longer corrupt the caller's data.
