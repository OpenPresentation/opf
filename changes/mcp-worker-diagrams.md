---
type: fixed
packages: [mcp]
---
`validate_deck` checks diagrams in a Worker again. Since Workers take the lazy diagram engine, a hosted MCP server (`@openpresentation/mcp/server` on openpresentation.org/mcp) validated a deck before its diagram types were loaded and left out every diagram finding, such as a Mermaid syntax error; it now loads the types the deck draws (`ensureDiagrams`) before it validates, in JSON, YAML and Markdown, and reports what Node reports. A Worker that hosts the server carries the diagram types again (about 1.1 MB unminified).
