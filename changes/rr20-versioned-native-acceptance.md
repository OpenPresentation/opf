---
type: added
packages: []
---
Versioned native PowerPoint acceptance fixtures, local generation and a guarded Windows runner replace one-time test-packet transfers. The suite records source revisions and installed runtime hashes and preserves failures separately from native acceptance.

The Windows prerequisite test isolates the child PowerShell module path so it works when launched through Node from PowerShell 7, while preserving the parent environment.
