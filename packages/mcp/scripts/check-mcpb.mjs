#!/usr/bin/env node
// Drive the server of an unpacked .mcpb the way Claude Desktop starts it, with the official MCP client:
//   node scripts/check-mcpb.mjs <entry point> <manifest.json> script-fonts|no-script-fonts
// It checks that the manifest lists exactly the tools the server offers the model, that the viewer is served, that show_deck
// answers, and that the bundled fonts reach the viewer (an Office face, a vendored face and, in a full bundle, a script face).
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const [entry, manifestPath, fonts] = process.argv.slice(2);
const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
const client = new Client({ name: "check-mcpb", version: "1.0.0" });
await client.connect(new StdioClientTransport({ command: process.execPath, args: [entry], stderr: "inherit" }));
try {
	const { tools } = await client.listTools();
	// SEP-1865: a tool without visibility is for the model and the app; read_font_file is for the app only.
	const forModel = tools.filter((tool) => (tool._meta?.ui?.visibility ?? ["model", "app"]).includes("model")).map((tool) => tool.name);
	assert.deepEqual([...manifest.tools.map((tool) => tool.name)].sort(), forModel.sort(), "the manifest lists the tools the model sees");
	assert.ok(tools.some((tool) => tool.name === "read_font_file"), "the bundled renderer's fonts are offered to the viewer");
	const [view] = (await client.readResource({ uri: "ui://opf/deck" })).contents;
	assert.equal(view.mimeType, "text/html;profile=mcp-app");
	const shown = await client.callTool({ name: "show_deck", arguments: { document: { name: "Bundle check", slides: [{ title: "It runs" }] } } });
	assert.match(shown.content[0].text, /^Opened "Bundle check" in the OPF viewer/);
	const read = async (file) => {
		const result = await client.callTool({ name: "read_font_file", arguments: { file } });
		return result.isError ? undefined : result.structuredContent.total;
	};
	assert.ok(await read("embedded/Carlito-700-normal.ttf"), "an Office face");
	assert.ok(await read("fonts/intos/Intos-Regular.ttf"), "a vendored face");
	const japanese = await read("script-fonts/noto-sans-jp/400Regular/NotoSansJP_400Regular.ttf");
	if (fonts === "script-fonts") assert.ok(japanese, "a script face");
	else assert.equal(japanese, undefined, "a lite bundle has no script faces");
	console.log(`check-mcpb: ok (${forModel.length} tools for the model, the viewer, show_deck and the fonts${fonts === "script-fonts" ? ", script faces included" : ""})`);
} finally {
	await client.close();
}
