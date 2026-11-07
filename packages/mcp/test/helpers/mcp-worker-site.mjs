// The Worker of a site that hosts the deck view: the lean server with `deckApp`, its fonts read from the site's own static files
// through siteFontFiles, as the OpenPresentation site's /mcp does with env.ASSETS. The "site" here is a few files in memory.
// Bundled by test/helpers/workerd.mjs.
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { createOpfMcpServer, siteFontFiles } from "../../dist/server.js";

const sources = { docs: [{ slug: "format-card", title: "Format card", markdown: "# Format card" }], examples: [], skills: {} };
const manifest = { contract: "openpresentation-site-fonts/v1", base: [{ family: "Carlito", weight: 700, italic: false, file: "base/carlito/Carlito-Bold.ttf", sha256: "0".repeat(64) }] };
const assets = new Set(["/opf-fonts/base/carlito/Carlito-Bold.ttf", "/opf-fonts/lazy/fonts/intos/Intos-Regular.ttf", "/opf-fonts/scripts/noto-sans-jp/400Regular/NotoSansJP_400Regular.ttf"]);
// Each "font file" is its own path as bytes, so the test sees which site path a request read.
const ASSETS = {
	async fetch(path) {
		if (path === "/opf-fonts/manifest.json") return Response.json(manifest);
		return assets.has(path) ? new Response(new TextEncoder().encode(`font:${path}`)) : new Response("Not found", { status: 404 });
	},
};

export default {
	async fetch(request) {
		if (request.method !== "POST") return new Response("ok");
		const server = createOpfMcpServer({ version: "0.0.0-test", sources, deckApp: { html: "<!doctype html><title>OPF deck</title>", readFontFile: siteFontFiles({ fetch: (path) => ASSETS.fetch(path) }) } });
		const transport = new WebStandardStreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true });
		await server.connect(transport);
		return transport.handleRequest(request);
	},
};
