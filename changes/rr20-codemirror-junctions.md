---
type: fixed
packages: []
---

Use explicit Windows directory junctions for the duplicate-CodeMirror test fixture, preserving its real second-copy detection, shared dependency identity and cleanup. Other platforms retain directory symlinks; editor runtime behavior is unchanged.
