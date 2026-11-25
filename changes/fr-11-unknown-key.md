---
type: changed
packages: [opf, cli, mcp, editor]
---
FR-11: the `opf/schema` finding for a key the object does not define and that is not close to a known key (not a typo) now says in its `help` which OPF release the validator is and that a later release may define the key, and carries the version as `validation.params.validatorVersion`. A validator cannot name the release a key needs, so it names its own. `opf validate`, the editor and the MCP `validate` tool show it because they share core's findings; a key with a "did you mean" suggestion keeps its help. The version comes from a generated constant, so core stays edge-safe.
