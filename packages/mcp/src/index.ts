// `@openpresentation/mcp`: the OPF MCP server as a library, for a host that is not a terminal (a Cloudflare Worker with the
// Streamable HTTP transport, an editor, a test). Transport-agnostic and edge-safe: no Node builtin, no file read; the docs,
// examples, skills and release notes are bundled data. `opf-mcp` (stdio) is the wrapper around it. A host that must stay small
// imports `@openpresentation/mcp/server` instead, which bundles none of the data.
//
//   import { createOpfServer } from "@openpresentation/mcp";
//   const server = createOpfServer({ version: "0.27.0" });
//   await server.connect(transport);
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import deckAppHtml from "../app-dist/deck-app.html";
import { DOC_SLUGS, defaultSources } from "./data.js";
import { type OpfDeckApp, type OpfMcpOptions, createOpfMcpServer } from "./server.js";

export { DOC_SLUGS, defaultSources };
export {
	type CheckText,
	DECK_APP_URI,
	type DeckFormat,
	type DocPage,
	type ExamplePage,
	MCP_APP_MIME_TYPE,
	McpToolError,
	type OpfDeckApp,
	type OpfMcpOptions,
	type OpfMcpSources,
	type ReadFontFile,
	type ResolvedSchema,
	type SiteFontsOptions,
	createOpfMcpServer,
	deckFontFile,
	resolveSchema,
	siteFontFiles,
} from "./server.js";

declare const OPF_CORE_VERSION: string;

/**
 * The deck view (an MCP App): one HTML page with the OPF editor, renderer and validators, which `show_deck` opens in a host that
 * supports MCP Apps. It needs nothing else; a lean host (`@openpresentation/mcp/server`) can serve it from its own storage.
 */
export const DECK_APP_HTML: string = deckAppHtml;

/**
 * The server with the bundled docs, examples, skills, release notes and deck view (`sources` replaces any of the data, for a host
 * that must stay small; `deckApp: false` leaves the view out, and `deckApp: { readFontFile }` gives it font files).
 */
export function createOpfServer(options: Omit<OpfMcpOptions, "sources" | "deckApp"> & { sources?: Partial<OpfMcpOptions["sources"]>; deckApp?: Partial<OpfDeckApp> | false }): McpServer {
	const deckApp = options.deckApp === false ? undefined : { html: DECK_APP_HTML, ...options.deckApp };
	return createOpfMcpServer({ ...options, deckApp, opfVersion: options.opfVersion ?? OPF_CORE_VERSION, sources: { ...defaultSources(), ...options.sources } });
}
