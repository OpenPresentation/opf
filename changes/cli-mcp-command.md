---
type: added
packages: [cli]
---
`opf mcp` runs the OPF MCP server of `@openpresentation/mcp` on stdio when that package is installed beside the CLI or in the working directory; otherwise it prints `npx -y @openpresentation/mcp` and exits with 2. The CLI has no MCP code and no dependency on the package.
