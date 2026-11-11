---
type: added
packages: [mcp]
---
RR-107: GitHub releases include the checked full-font Claude Desktop extension `opf-<version>.mcpb` and its SHA-256 file. The trusted publisher attaches them after registry verification, and retries preserve release notes and existing assets while safely adding missing files. Bundle font resolution also works with native Windows paths, covered by the actual font subprocess test.
