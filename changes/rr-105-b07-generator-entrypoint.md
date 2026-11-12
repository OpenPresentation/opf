---
type: fixed
packages: []
---
Fix the current B07 qualification generator's case10 CLI import cycle by sharing its unchanged native-shape reader with the profile controller. Bind the explicit retained packed-producer root separately from current generator source so the immutable qualified consumer/proof can be reused without repacking or changing runtime, worker limits or native acceptance.
