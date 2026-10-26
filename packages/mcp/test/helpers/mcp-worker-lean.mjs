// The Worker of a host that supplies its own data: the server without the bundled docs, examples and skills
// (`@openpresentation/mcp/server`, here its built entry). Bundled by test/helpers/workerd.mjs.
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { createOpfMcpServer } from "../../dist/server.js";

const sources = { docs: [{ slug: "format-card", title: "Format card", markdown: "# Format card\n\nA presentation is { name, slides }." }], examples: [], skills: {} };

export default {
	async fetch(request) {
		if (request.method !== "POST") return new Response("ok");
		const server = createOpfMcpServer({ version: "0.0.0-test", sources });
		const transport = new WebStandardStreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true });
		await server.connect(transport);
		return transport.handleRequest(request);
	},
};
