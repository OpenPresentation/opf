---
type: fixed
packages: []
---

RR-57 (tooling only, no package change): `pnpm check:changed` passes Biome the changed files in batches, so a branch with hundreds of changed files no longer fails on Windows with "The command line is too long".
