---
type: changed
packages: [opf]
---
The core's build includes the part of `jsonc-parser` it uses and the package no longer depends on it, so a server bundle made with esbuild for Node, which cannot follow `jsonc-parser`'s UMD build, now loads. The package also ships `THIRD-PARTY-NOTICES.md` for the bundled `jsonc-parser`, `ajv` and `ajv-formats` code.
