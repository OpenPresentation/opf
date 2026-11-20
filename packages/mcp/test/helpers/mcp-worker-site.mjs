// The Worker of a site that hosts the deck view: the lean server with `deckApp`, its fonts read from the site's own static files
// through siteFontFiles, as the OpenPresentation site's /mcp does with env.ASSETS. The "site" here is a few files in memory.
// The page comes from a function, as a host that keeps it in storage passes it. RR-111: the site also serves the icon sets' set-level
// files under /opf-icons/ (here only Lucide's two, so Tabler cannot be read) and passes `sources.iconSets` over them, so the server
// offers the viewer read_icons. Bundled by test/helpers/workerd.mjs.
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { fetchIcons, galleryIconSets } from "@openpresentation/gallery/icon-sets";
import lucideIndex from "@openpresentation/gallery/icons/lucide.json" with { type: "json" };
import lucideWhole from "@openpresentation/gallery/icons/lucide.icons.json" with { type: "json" };
import { createOpfMcpServer, siteFontFiles } from "../../dist/server.js";

const sources = { docs: [{ slug: "format-card", title: "Format card", markdown: "# Format card" }], examples: [], skills: {} };
const manifest = { contract: "openpresentation-site-fonts/v1", base: [{ family: "Carlito", weight: 700, italic: false, file: "base/carlito/Carlito-Bold.ttf", sha256: "0".repeat(64) }] };
const assets = new Set(["/opf-fonts/base/carlito/Carlito-Bold.ttf", "/opf-fonts/lazy/fonts/intos/Intos-Regular.ttf", "/opf-fonts/scripts/noto-sans-jp/400Regular/NotoSansJP_400Regular.ttf"]);
const icons = { "/opf-icons/lucide.json": lucideIndex, "/opf-icons/lucide.icons.json": lucideWhole };
// Each "font file" is its own path as bytes, so the test sees which site path a request read. fetchIcons asks with whole URLs.
const ASSETS = {
	async fetch(input) {
		const path = input.startsWith("/") ? input : new URL(input).pathname;
		if (path === "/opf-fonts/manifest.json") return Response.json(manifest);
		if (Object.hasOwn(icons, path)) return Response.json(icons[path]);
		return assets.has(path) ? new Response(new TextEncoder().encode(`font:${path}`)) : new Response("Not found", { status: 404 });
	},
};

export default {
	async fetch(request) {
		if (request.method !== "POST") return new Response("ok");
		const iconSets = galleryIconSets(fetchIcons(new URL("/opf-icons/", request.url), ASSETS));
		const server = createOpfMcpServer({ version: "0.0.0-test", sources: { ...sources, iconSets }, deckApp: { html: async () => "<!doctype html><title>OPF deck</title>", readFontFile: siteFontFiles({ fetch: (path) => ASSETS.fetch(path) }) } });
		const transport = new WebStandardStreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true });
		await server.connect(transport);
		return transport.handleRequest(request);
	},
};
