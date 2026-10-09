---
type: changed
packages: [cli]
---
RR-62 (breaking, 0.x minor): `@openpresentation/cli/api` is removed; the CLI is the `opf` command. Applications use `@openpresentation/opf/node` (`convert`, `open`, `save`). The CLI depends on core `^0.17.0`.
