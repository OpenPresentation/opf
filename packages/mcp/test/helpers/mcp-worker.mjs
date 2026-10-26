// The Worker the workerd test runs: the OPF MCP server (`@openpresentation/mcp`, here its built entry) behind the SDK's web-standard
// Streamable HTTP transport, one stateless server per request, as a hosted deployment would run it. Bundled by test/helpers/workerd.mjs.
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { createOpfServer } from "../../dist/index.js";

export default {
	async fetch(request) {
		if (request.method !== "POST") return new Response("ok");
		const server = createOpfServer({ version: "0.0.0-test" });
		const transport = new WebStandardStreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true });
		await server.connect(transport);
		return transport.handleRequest(request);
	},
};
