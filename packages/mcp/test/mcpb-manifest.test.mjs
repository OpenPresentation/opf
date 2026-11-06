import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { validateManifest } from "@anthropic-ai/mcpb";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { createOpfServer } from "../dist/index.js";

// The Claude Desktop bundle (scripts/build-mcpb.mjs builds it from mcpb/manifest.json): the manifest is valid and names the tools
// the server offers the model, so the extension's listing in Claude Desktop says what it does. The build itself needs the npm
// registry and runs by hand (pnpm run build:mcpb).
const manifestFile = fileURLToPath(new URL("../mcpb/manifest.json", import.meta.url));
const manifest = JSON.parse(readFileSync(manifestFile, "utf8"));

test("the bundle manifest is a valid MCPB manifest that starts opf-mcp", () => {
	assert.equal(validateManifest(manifestFile), true);
	assert.equal(manifest.server.type, "node");
	assert.equal(manifest.server.entry_point, "node_modules/@openpresentation/mcp/dist/bin.js");
	assert.deepEqual(manifest.server.mcp_config.args, ["${__dirname}/node_modules/@openpresentation/mcp/dist/bin.js"]);
	assert.equal(manifest.icon, "icon.png");
	assert.equal(manifest.license, JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")).license);
});

test("the bundle manifest lists exactly the tools the model sees", async () => {
	const server = createOpfServer({ version: "0.0.0-test", deckApp: { readFontFile: () => undefined } });
	const [clientSide, serverSide] = InMemoryTransport.createLinkedPair();
	await server.connect(serverSide);
	const client = new Client({ name: "mcpb-manifest-test", version: "1.0.0" });
	await client.connect(clientSide);
	const { tools } = await client.listTools();
	// SEP-1865: a tool without visibility is for the model and the app; read_font_file is for the viewer only.
	const forModel = tools.filter((tool) => (tool._meta?.ui?.visibility ?? ["model", "app"]).includes("model")).map((tool) => tool.name);
	assert.deepEqual(manifest.tools.map((tool) => tool.name).sort(), forModel.sort());
	await client.close();
});
