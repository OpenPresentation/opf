---
type: fixed
packages: [mcp]
---
RR-111: viewer downloads and messages follow Claude MCP Apps rules. A download file name is the last segment of the URI as written, one request runs at a time with a ten-minute timeout, and a host without downloads gets "This host does not offer downloads here" and the copy fallback. Send to Claude handles a refused or unconfirmed message and stays usable to retry. When a newer viewer of the same deck opens, the older one greys out and stops sending context, messages and tool edits; other decks stay independent.
