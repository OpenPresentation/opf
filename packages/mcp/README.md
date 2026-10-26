# @openpresentation/mcp

The MCP server for OPF (Open Presentation Format). An agent or editor that speaks the [Model Context Protocol](https://modelcontextprotocol.io)
learns the format and checks decks through it, without shelling out and parsing text: documentation, schemas, the default catalog,
example decks and the six agent skills as resources, a `start_here` tool that gives a path for a goal, and `validate_deck`,
`get_schema`, `search_catalog`, `get_catalog_record`, `convert`, `search_docs` and `list_examples` as tools. It keeps no state, reads
no file, fetches nothing, and needs no API key. Node 22 or later.

```sh
claude mcp add opf -- npx -y @openpresentation/mcp          # Claude Code
npx -y @openpresentation/mcp                                  # any MCP client: command npx, args -y @openpresentation/mcp
```

Tools, resources (`opf://docs/format-card`, `opf://schema/presentation#Chart`, `opf://catalog/layouts/two-column`, ...), prompts, client
setup (Claude Code, Cursor, Claude Desktop) and a typical session: [the MCP server](https://github.com/OpenPresentation/opf/blob/main/docs/mcp.md).

## As a library

The server definition is separate from the transport and runs on an edge runtime (no Node builtin, no file read, precompiled
validators), for a hosted server:

```ts
import { createOpfServer } from "@openpresentation/mcp";           // with the bundled docs, examples, skills and release notes
import { createOpfMcpServer } from "@openpresentation/mcp/server"; // the same without that data: you pass `sources`

const server = createOpfServer({ version: "0.27.0" });
await server.connect(transport); // stdio, or Streamable HTTP in a Worker
```

`@openpresentation/mcp/stdio` is the Node stdio wrapper (`runStdio()`) that the `opf-mcp` binary and `opf mcp` of the CLI run. Layout
is measured with the real fonts when the optional peer `@openpresentation/opf-render` is installed beside it; otherwise it is estimated
and the report says so. The package is released with `@openpresentation/opf` and the other packages of
[OpenPresentation/opf](https://github.com/OpenPresentation/opf) at one version.
