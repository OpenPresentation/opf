---
type: changed
packages: [opf, mcp]
---
RR-111: core precompiled validators (the `worker`, `workerd` and `edge-light` engine and `@openpresentation/opf/precompiled`) are about 900 KB smaller, with the same errors as the Ajv runtime build; the Node and browser entries do not change. The MCP viewer (`ui://opf/deck`) shrinks by the same amount and stays about 1 MB under the 10 MiB stdio frame limit.
