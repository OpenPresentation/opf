---
type: fixed
packages: [cli]
---
CLI release preparation preserves runtime peer ranges that already accept the requested patch releases while advancing development pins. It no longer edits the published core's peer hints, and stops for a new peer contract that requires core reconciliation.
