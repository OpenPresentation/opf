import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { describe, test } from "node:test";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { DECK_APP_HTML, DECK_APP_URI, MCP_APP_MIME_TYPE, createOpfServer } from "../dist/index.js";
import { createOpfMcpServer } from "../dist/server.js";
import { installedFontFiles } from "../dist/stdio.js";
import { failure } from "./helpers/mcp-client.mjs";

// The deck view (an MCP App, SEP-1865): show_deck opens ui://opf/deck, read_font_file feeds it fonts, and a server that does no
// deck work (processDecks: false) leaves the checks to the view. test/deck-app-browser.mjs runs the view itself in Chromium.
const fontManifest = JSON.parse(readFileSync(new URL("../app-dist/deck-fonts.json", import.meta.url), "utf8"));
const deck = { name: "Quarterly update", language: "en-US", slides: [{ id: "intro", title: "Revenue grew 18%" }, { id: "next", title: "Next steps", blocks: [{ items: ["Hire", "Ship"] }] }] };

async function connected(options) {
	const server = createOpfServer({ version: "0.0.0-test", ...options });
	const [clientSide, serverSide] = InMemoryTransport.createLinkedPair();
	await server.connect(serverSide);
	const client = new Client({ name: "deck-app-test", version: "1.0.0" });
	await client.connect(clientSide);
	return client;
}

/** A whole font file, read in the pieces read_font_file returns. */
async function readWhole(client, file) {
	const pieces = [];
	let offset = 0;
	let total = Number.POSITIVE_INFINITY;
	while (offset < total) {
		const result = await client.callTool({ name: "read_font_file", arguments: { file, offset } });
		if (result.isError) return failure(result);
		assert.ok(!result.content[0].text.includes(result.structuredContent.bytes.slice(0, 40)), "the bytes are not repeated in the text");
		const bytes = Buffer.from(result.structuredContent.bytes, "base64");
		assert.ok(bytes.length <= 512 * 1024);
		pieces.push(bytes);
		offset += bytes.length;
		total = result.structuredContent.total;
	}
	return Buffer.concat(pieces);
}

describe("the deck view", () => {
	test("show_deck names its view, and read_font_file is for the view only", async () => {
		const client = await connected({ deckApp: { readFontFile: installedFontFiles() } });
		const { tools } = await client.listTools();
		const show = tools.find((tool) => tool.name === "show_deck");
		assert.deepEqual(show._meta, { ui: { resourceUri: DECK_APP_URI }, "ui/resourceUri": DECK_APP_URI });
		assert.deepEqual(show.inputSchema.required, ["document"]);
		assert.deepEqual(show.inputSchema.properties.view.enum, ["preview", "source", "both"]);
		const fonts = tools.find((tool) => tool.name === "read_font_file");
		assert.deepEqual(fonts._meta, { ui: { visibility: ["app"] } });
		assert.match(client.getInstructions(), /show_deck/);
		await client.close();
	});

	test("ui://opf/deck is one self-contained HTML page", async () => {
		const client = await connected({});
		const listed = (await client.listResources()).resources.find((resource) => resource.uri === DECK_APP_URI);
		assert.equal(listed.mimeType, MCP_APP_MIME_TYPE);
		const [content] = (await client.readResource({ uri: DECK_APP_URI })).contents;
		assert.equal(content.mimeType, "text/html;profile=mcp-app");
		assert.equal(content.text, DECK_APP_HTML);
		assert.deepEqual(content._meta, { ui: { prefersBorder: false } });
		assert.match(content.text, /^<!doctype html>/);
		// Nothing for the sandbox to load: no external script, stylesheet, image or font, and no font CDN.
		assert.doesNotMatch(content.text, /<(script|link|img)[^>]+(src|href)=["']?https?:/i);
		assert.doesNotMatch(content.text, /@import\s+(url\(|["'])|fonts\.(googleapis|gstatic)\.com/);
		assert.equal((content.text.match(/<script type="module">/g) ?? []).length, 1);
		await client.close();
	});

	test("show_deck checks the deck and answers in text for a client without MCP Apps", async () => {
		const client = await connected({});
		const result = await client.callTool({ name: "show_deck", arguments: { document: deck, view: "both", slide: 2 } });
		assert.equal(result.isError, undefined);
		assert.match(result.content[0].text, /^Opened "Quarterly update" in the OPF viewer \(2 slides\)/);
		assert.match(result.content[0].text, /Slides: 1\. Revenue grew 18%; 2\. Next steps\./);
		assert.match(result.content[0].text, /Checks: 0 errors, \d+ warnings/);
		assert.deepEqual({ ...result.structuredContent, findings: undefined, counts: undefined }, { opened: true, checked: true, view: "both", slide: 2, format: "json", name: "Quarterly update", slides: 2, outline: [{ slide: 1, title: "Revenue grew 18%" }, { slide: 2, title: "Next steps" }], valid: true, findings: undefined, counts: undefined });
		const yaml = await client.callTool({ name: "show_deck", arguments: { document: "name: Y\nslides:\n  - title: One\n", format: "yaml" } });
		assert.deepEqual(yaml.structuredContent.outline, [{ slide: 1, title: "One" }]);
		// A deck the server cannot read still opens: the view shows its text and the syntax error.
		const broken = await client.callTool({ name: "show_deck", arguments: { document: "{ not json" } });
		assert.equal(broken.isError, undefined);
		assert.equal(broken.structuredContent.checked, true);
		assert.equal(broken.structuredContent.valid, false);
		const unknown = await client.callTool({ name: "show_deck", arguments: { document: "slides are here" } });
		assert.equal(unknown.structuredContent.checked, false);
		assert.match(unknown.content[0].text, /could not be read/);
		await client.close();
	});

	test("read_font_file serves every face the view may ask for, in pieces, and nothing else", async () => {
		const client = await connected({ deckApp: { readFontFile: installedFontFiles() } });
		for (const face of fontManifest.extra) {
			const bytes = await readWhole(client, face.file);
			assert.ok(Buffer.isBuffer(bytes), `${face.file}: ${JSON.stringify(bytes)}`);
			assert.equal(createHash("sha256").update(bytes).digest("hex"), face.sha256, face.file);
		}
		const fontsNode = await import("@openpresentation/opf-render/fonts-node");
		const office = await fontsNode.loadFonts({ pack: "office" });
		const intos = office.registry.lazyFonts.find((face) => face.family === "Intos");
		assert.equal(createHash("sha256").update(await readWhole(client, intos.file)).digest("hex"), intos.sha256);
		const japanese = fontsNode.scriptFontPackages("all").find((pkg) => pkg.name.endsWith("/noto-sans-jp"));
		const face = japanese.faces[0];
		const whole = await readWhole(client, `script-fonts/noto-sans-jp/${face.file}`);
		assert.ok(whole.length > 512 * 1024, "a large face takes several pieces");
		assert.equal(createHash("sha256").update(whole).digest("hex"), face.sha256);
		for (const file of ["../package.json", "fonts/../../package.json", "embedded/Comic-Sans-400-normal.ttf", "script-fonts/noto-sans-jp/../package.json", "/etc/passwd"]) {
			assert.equal((await readWhole(client, file)).code, "unknown-font", file);
		}
		await client.close();
	});

	test("without a font reader the view gets no read_font_file, and deckApp: false leaves the view out", async () => {
		const plain = await connected({});
		const names = (await plain.listTools()).tools.map((tool) => tool.name);
		assert.ok(names.includes("show_deck") && !names.includes("read_font_file"));
		await plain.close();
		const none = await connected({ deckApp: false });
		const without = (await none.listTools()).tools.map((tool) => tool.name);
		assert.ok(!without.includes("show_deck"));
		assert.ok(!(await none.listResources()).resources.some((resource) => resource.uri === DECK_APP_URI));
		await none.close();
	});

	test("processDecks: false does no deck work: show_deck only opens the view, and validate_deck and convert are gone", async () => {
		const client = await connected({ processDecks: false });
		const names = (await client.listTools()).tools.map((tool) => tool.name).sort();
		assert.deepEqual(names, ["get_catalog_record", "get_schema", "list_examples", "search_catalog", "search_docs", "search_icons", "show_deck", "start_here"]);
		assert.deepEqual((await client.listPrompts()).prompts.map((prompt) => prompt.name).sort(), ["author_deck", "choose_layout", "learn_opf"]);
		assert.doesNotMatch(client.getInstructions(), /validate_deck|convert/);
		const result = await client.callTool({ name: "show_deck", arguments: { document: deck } });
		assert.deepEqual(result.structuredContent, { opened: true, checked: false, view: "preview", format: "json" });
		assert.match(result.content[0].text, /does not check decks itself/);
		// Not even a broken deck is read.
		const broken = await client.callTool({ name: "show_deck", arguments: { document: "{ not json" } });
		assert.deepEqual(broken.structuredContent, { opened: true, checked: false, view: "preview" });
		const path = (await client.callTool({ name: "start_here", arguments: { goal: "a board update" } })).structuredContent;
		assert.equal(path.validate.tool, "show_deck");
		assert.ok(path.steps.every((step) => step.tool !== "validate_deck" && step.tool !== "convert"));
		for (const name of ["learn_opf", "author_deck", "choose_layout"]) {
			const prompt = await client.getPrompt({ name, arguments: name === "author_deck" ? { brief: "x" } : name === "choose_layout" ? { content: "x" } : {} });
			assert.doesNotMatch(JSON.stringify(prompt.messages), /validate_deck/, name);
		}
		await client.close();
		assert.throws(() => createOpfMcpServer({ version: "0", sources: { docs: [], examples: [], skills: {} }, processDecks: false }), /processDecks: false needs deckApp/);
	});
});
