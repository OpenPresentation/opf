# pptx-mcp

Official **Model Context Protocol** server for [pptx.dev](https://www.pptx.dev) — let Claude Desktop, Cursor, and any MCP client generate, parse, validate, and render PowerPoint presentations natively.

Built on top of [`@pptx/sdk`](https://www.npmjs.com/package/@pptx/sdk). All requests go to the REST API at `https://api.pptx.dev/v1`.

## Tools

| Tool | What it does |
| --- | --- |
| `generate_presentation` | Submit an OPF document; pptx.dev returns a job with slide count + validation warnings. |
| `parse_pptx` | Convert a `.pptx` file into OPF JSON (or return a `parseId` for per-slide reads). |
| `validate_opf` | Validate an OPF document against the canonical schema. Always free. |
| `render_format` | Render a `.pptx` to `web` (interactive HTML), `svg`, or `png`. |

All tools accept JSON documents or base64 file bytes; file tools also accept absolute filesystem paths.

## Install

### Local (stdio)

No install step — just run with `npx`:

```sh
npx pptx-mcp
```

Or pin a version:

```sh
npx pptx-mcp@latest
```

### Remote (HTTP streaming)

The pptx.dev team hosts a public MCP endpoint at:

```
https://mcp.pptx.dev
```

Point any MCP client that supports HTTP-streaming transport at that URL and pass your pptx.dev API key as a bearer token.

## Configure

### Claude Desktop

Add this to your `claude_desktop_config.json` (macOS: `~/Library/Application Support/Claude/claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "pptx": {
      "command": "npx",
      "args": ["-y", "pptx-mcp"],
      "env": {
        "PPTX_API_KEY": "ppx_your_key_here"
      }
    }
  }
}
```

Restart Claude Desktop. You should see the four pptx tools in the tool picker.

### Cursor

Add to `~/.cursor/mcp.json` (or your project's `.cursor/mcp.json`):

```json
{
  "mcpServers": {
    "pptx": {
      "command": "npx",
      "args": ["-y", "pptx-mcp"],
      "env": {
        "PPTX_API_KEY": "ppx_your_key_here"
      }
    }
  }
}
```

Cursor picks up config changes without a full restart; open the MCP panel to confirm the tools are listed.

### Remote transport (any MCP client)

For clients that support the HTTP-streaming MCP transport, point them at `https://mcp.pptx.dev` and send your API key as:

```
Authorization: Bearer ppx_your_key_here
```

## Environment variables

| Variable | Purpose |
| --- | --- |
| `PPTX_API_KEY` | Bearer token for api.pptx.dev. Required for every tool except `validate_opf`. |
| `PPTX_API_BASE_URL` | Override base URL (defaults to `https://api.pptx.dev`). Useful for dev/staging. |

## Example: generate a slide from OPF JSON

Once configured, ask your agent something like:

> Generate a pptx with one title slide that says "Q1 Review" and save me the job metadata.

The agent will call `generate_presentation` with an OPF document such as:

```json
{
  "$schema": "https://pptx.dev/schema/opf/v1",
  "meta": { "title": "Q1 Review" },
  "design": { "theme": "corporate-minimal" },
  "slides": [
    {
      "id": "title",
      "layout": "title-slide",
      "elements": [
        { "id": "h1", "type": "text", "content": { "text": "Q1 Review" } }
      ]
    }
  ]
}
```

## Programmatic use

Build your own transport (HTTP streaming, SSE, WebSocket) around the shared server:

```ts
import { createPptxMcpServer } from "pptx-mcp";

const server = createPptxMcpServer({
  apiKey: process.env.PPTX_API_KEY,
});

// Connect any @modelcontextprotocol/sdk transport
await server.connect(myTransport);
```

## References

- REST API: [pptx.dev/docs](https://www.pptx.dev/docs)
- OPF schema: [pptx.dev/schema/opf/v1](https://pptx.dev/schema/opf/v1)
- TypeScript SDK: [`@pptx/sdk`](https://www.npmjs.com/package/@pptx/sdk)
- MCP spec: [modelcontextprotocol.io](https://modelcontextprotocol.io)

## Releasing

Releases are driven by git tags matching `sdk-mcp-v<version>`. The [`publish-sdk-mcp.yml`](../../.github/workflows/publish-sdk-mcp.yml) workflow:

1. Builds `@pptx/sdk` (bundled into the package via tsup `noExternal`).
2. Installs, typechecks, and builds `pptx-mcp`.
3. Verifies the tag version matches `package.json`.
4. Publishes to npm with provenance.

To cut a release:

```sh
# bump sdk/mcp/package.json version, commit, then:
git tag sdk-mcp-v0.1.0
git push origin sdk-mcp-v0.1.0
```

The `workflow_dispatch` entrypoint supports a `dry_run` toggle for rehearsals.

## License

MIT — see [LICENSE](./LICENSE).
