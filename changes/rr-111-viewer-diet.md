---
type: changed
packages: [opf, mcp]
---
RR-111: core's precompiled validators (the `worker`, `workerd` and `edge-light` engine and `@openpresentation/opf/precompiled`) are about 900 KB smaller: the generator builds each error with a shared helper function instead of an object literal at every site, and leaves out the values the helper reads from the schema. The errors are the same objects as Ajv's runtime build, property by property and in order (a new test compares every error over the example corpus, mutants and invalid fixtures); the Node and browser entries, which compile with Ajv, do not change. The MCP viewer (`ui://opf/deck`) shrinks by the same amount: its JSON-RPC frame is 9,390,901 bytes, 1,094,859 under the 10 MiB stdio limit (167,628 before), and a test now fails when that headroom drops below 1,000,000 bytes.
