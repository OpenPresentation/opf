// `@openpresentation/mcp`: the OPF MCP server as a library, for a host that is not a terminal (a Cloudflare Worker with the
// Streamable HTTP transport, an editor, a test). Transport-agnostic and edge-safe: no Node builtin, no file read; the docs,
// examples, skills and release notes are bundled data. `opf-mcp` (stdio) is the wrapper around it. A host that must stay small
// imports `@openpresentation/mcp/server` instead, which bundles none of the data.
//
//   import { createOpfServer } from "@openpresentation/mcp";
//   const server = createOpfServer({ version: "0.27.0" });
//   await server.connect(transport);
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { DOC_SLUGS, defaultSources } from "./data.js";
import { type OpfMcpOptions, createOpfMcpServer } from "./server.js";

export { DOC_SLUGS, defaultSources };
export { type CheckText, type DeckFormat, type DocPage, type ExamplePage, McpToolError, type OpfMcpOptions, type OpfMcpSources, type ResolvedSchema, createOpfMcpServer, resolveSchema } from "./server.js";

declare const OPF_CORE_VERSION: string;

/** The server with the bundled docs, examples, skills and release notes (`sources` replaces any of them, for a host that must stay small). */
export function createOpfServer(options: Omit<OpfMcpOptions, "sources"> & { sources?: Partial<OpfMcpOptions["sources"]> }): McpServer {
	return createOpfMcpServer({ ...options, opfVersion: options.opfVersion ?? OPF_CORE_VERSION, sources: { ...defaultSources(), ...options.sources } });
}
