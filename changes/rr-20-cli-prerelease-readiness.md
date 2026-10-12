---
type: fixed
packages: [cli]
---
`opf doctor` no longer reports prerelease engines as satisfying a stable caret requirement. Explicit prerelease requirements admit only the same numeric version at or above the requested prerelease identifier; read/edit formats remain available without drawing engines.
