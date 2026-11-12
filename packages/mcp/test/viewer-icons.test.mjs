// RR-111: the deck view draws a deck's set icons ("lucide:rocket") from the server's icon sets through the app-only tool read_icons.
// Here: the tool over a real stdio round trip (opf-mcp, the installed icon files), a server without icon sets (no tool, and the
// show_deck result says so), and the view's own loader (app/icons.ts, bundled as build-app bundles it) against a real server: the
// viewer's checks report the icons as the server's validate_deck does, and a load that cannot happen is settled with a finding.
import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import path from "node:path";
import { after, test } from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { gallery } from "@openpresentation/gallery";
import { ensureIcons, validate } from "@openpresentation/opf";
import { createOpfServer } from "../dist/index.js";
import { connect, failure } from "./helpers/mcp-client.mjs";

const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const scratch = await mkdtemp(path.join(tmpdir(), "opf-mcp-viewer-icons-"));
after(() => rm(scratch, { recursive: true, force: true }));

/** app/icons.ts as the view's bundle has it (esbuild, browser conditions). */
async function viewerIcons() {
	const esbuild = createRequire(createRequire(path.join(packageRoot, "package.json")).resolve("tsup"))("esbuild");
	const result = await esbuild.build({ entryPoints: [path.join(packageRoot, "app", "icons.ts")], absWorkingDir: packageRoot, bundle: true, format: "esm", platform: "browser", conditions: ["worker", "module"], write: false, logLevel: "silent" });
	const file = path.join(scratch, "icons.mjs");
	await writeFile(file, result.outputFiles[0].text);
	return import(pathToFileURL(file).href);
}

async function linked(options) {
	const [a, b] = InMemoryTransport.createLinkedPair();
	await createOpfServer({ version: "0.0.0-test", ...options }).connect(b);
	const client = new Client({ name: "viewer-icons", version: "1" });
	await client.connect(a);
	return client;
}

const iconFindings = (findings) => findings.filter((finding) => /^opf\/icon-/.test(finding.ruleId)).map(({ ruleId, severity, path, message, help, suggestions }) => ({ ruleId, severity, path, message, help, ...(suggestions ? { suggestions } : {}) }));
const deck = {
	name: "Icons",
	language: "en",
	slides: [{ title: "Launch", items: [{ text: "Ship", icon: "lucide:rocket" }, { text: "Check", icon: "lucide:chek" }, { text: "Bolt", icon: "tabler:bolt" }, { text: "Odd", icon: "lucid:truck" }] }],
};

// First, before anything in this process loads a set: core keeps what it loaded per process, and the view's loader must be what loads it.
test("the view's checks report a deck's icons as the server's validate_deck does", async () => {
	const { serverIconSets, ICON_BATCH } = await viewerIcons();
	assert.equal(ICON_BATCH, 100);
	const client = await linked({});
	const calls = [];
	const read = async (set, names, index) => {
		calls.push({ set, names: [...names], index });
		const result = await client.callTool({ name: "read_icons", arguments: { set, names: [...names], ...(index ? { index: true } : {}) } });
		if (result.isError) throw new Error(result.content[0].text);
		return result.structuredContent;
	};
	const catalogs = [gallery, serverIconSets(read, () => ["lucide", "tabler"])];
	await ensureIcons(deck, { catalogs });
	assert.deepEqual(calls.map(({ set, index }) => [set, index]).sort(), [["lucide", true], ["tabler", true]], "one call per set, with its index");
	const viewer = iconFindings(validate(deck, { catalogs }).findings);
	const server = iconFindings((await client.callTool({ name: "validate_deck", arguments: { document: deck } })).structuredContent.findings);
	assert.deepEqual(viewer, server);
	assert.deepEqual(viewer.map((finding) => finding.message), ["The icon set lucide has no icon chek.", "No icon set lucid is embedded or registered (sets: lucide, tabler)."]);
	assert.ok(viewer[0].suggestions.some((suggestion) => suggestion.value === "lucide:check"), "an unknown name keeps its nearest names");
	assert.match(viewer[0].help, /Did you mean 'lucide:check'\?/);

	// A later load of the same set asks for the new icons only, without the index; a large one goes in batches of ICON_BATCH.
	calls.length = 0;
	const many = { name: "Many", slides: [{ title: "All", items: (await read("lucide", [], true)).index.names.slice(0, 230).map((name) => ({ text: name, icon: `lucide:${name}` })) }] };
	calls.length = 0;
	await ensureIcons(many, { catalogs });
	assert.ok(calls.length >= 2 && calls.every((call) => call.names.length <= ICON_BATCH && call.index === false), JSON.stringify(calls.map((call) => [call.names.length, call.index])));
	assert.deepEqual(iconFindings(validate(many, { catalogs }).findings), []);
	await client.close();
});

test("a load the server cannot serve is settled: the slide draws without the icon and a finding says why", async () => {
	const { serverIconSets } = await viewerIcons();
	let called = 0;
	const none = serverIconSets(async () => {
		called += 1;
		throw new Error("unreachable");
	}, () => []);
	const missing = { name: "Missing", slides: [{ title: "A", items: [{ text: "Anchor", icon: "lucide:zap" }] }] };
	await ensureIcons(missing, { catalogs: [gallery, none] });
	assert.equal(called, 0, "a set the server does not offer is not asked for");
	assert.deepEqual(iconFindings(validate(missing, { catalogs: [gallery, none] }).findings).map((finding) => finding.message), ["The icon lucide:zap could not be loaded: this server offers the viewer no icon sets."]);

	// The announcement is not known yet and the tool is missing: the call fails, and the load settles with its reason.
	const noTool = await linked({ sources: { iconSets: undefined } });
	const unannounced = serverIconSets(async (set, names, index) => {
		const result = await noTool.callTool({ name: "read_icons", arguments: { set, names: [...names], index } }).catch((error) => ({ isError: true, content: [{ text: String(error.message) }] }));
		if (result.isError) throw new Error(`the server did not send icons (read_icons: ${result.content[0].text}).`);
		return result.structuredContent;
	}, () => undefined);
	const bolt = { name: "Bolt", slides: [{ title: "A", items: [{ text: "Bolt", icon: "tabler:anchor" }] }] };
	await ensureIcons(bolt, { catalogs: [gallery, unannounced] });
	const [finding] = iconFindings(validate(bolt, { catalogs: [gallery, unannounced] }).findings);
	assert.equal(finding.ruleId, "opf/icon-unknown");
	assert.match(finding.message, /^The icon tabler:anchor could not be loaded: the server did not send icons \(read_icons: .*read_icons/);
	await noTool.close();
});

test("a server without icon sets offers no read_icons, says so in show_deck, and describes search_icons sensibly", async () => {
	const client = await linked({ sources: { iconSets: undefined } });
	const tools = (await client.listTools()).tools;
	assert.equal(tools.some((tool) => tool.name === "read_icons"), false);
	const search = tools.find((tool) => tool.name === "search_icons");
	assert.doesNotMatch(search.description, /icon sets: +\(|:\s*\(Lucide/);
	assert.match(search.description, /This server registers none/);
	const shown = await client.callTool({ name: "show_deck", arguments: { document: deck } });
	assert.deepEqual(shown.structuredContent.iconSets, []);
	const opened = await client.callTool({ name: "open_editor", arguments: {} });
	assert.deepEqual(opened.structuredContent.iconSets, []);
	await client.close();
});

test("opf-mcp over stdio: read_icons is app-only and returns icons from the installed files", async (t) => {
	const client = await connect();
	try {
		const tools = (await client.listTools()).tools;
		const readIcons = tools.find((tool) => tool.name === "read_icons");
		const readFont = tools.find((tool) => tool.name === "read_font_file");
		assert.deepEqual(readIcons._meta, { ui: { visibility: ["app"] } }, "callable by the view only");
		assert.deepEqual(readIcons._meta, readFont._meta, "the same visibility rule as read_font_file");
		// A model-facing host lists only tools whose visibility includes "model" (or that have none): read_icons is not one.
		const modelTools = tools.filter((tool) => !tool._meta?.ui?.visibility || tool._meta.ui.visibility.includes("model")).map((tool) => tool.name);
		assert.equal(modelTools.includes("read_icons"), false);
		assert.ok(modelTools.includes("search_icons") && modelTools.includes("show_deck"));
		const shown = await client.callTool({ name: "show_deck", arguments: { document: deck } });
		assert.deepEqual(shown.structuredContent.iconSets, ["lucide", "tabler"]);

		const size = (result) => JSON.stringify({ jsonrpc: "2.0", id: 1, result }).length;
		const three = await client.callTool({ name: "read_icons", arguments: { set: "lucide", names: ["rocket", "truck", "chek"], index: true } });
		assert.deepEqual(Object.keys(three.structuredContent.icons).sort(), ["rocket", "truck"]);
		assert.equal(three.structuredContent.errors, undefined, "a name the set lacks is not an error: the index names every icon");
		const { index } = three.structuredContent;
		assert.equal(index.license, "ISC");
		assert.match(index.copyright, /Lucide/);
		assert.ok(index.licenseText.length > 100, "the license text a host credits stays in the index");
		assert.deepEqual(index.viewBox, [0, 0, 24, 24]);
		assert.ok(index.names.length > 1500);
		assert.equal(index.icons, undefined);
		assert.ok(three.content[0].text.length < 200, "the text says what the result is; the path data is not repeated in it");
		const again = await client.callTool({ name: "read_icons", arguments: { set: "lucide", names: ["rocket", "truck", "chek"] } });
		assert.equal(again.structuredContent.index, undefined);
		const tabler = (await client.callTool({ name: "read_icons", arguments: { set: "tabler", names: [], index: true } })).structuredContent.index;
		assert.equal(tabler.license, "MIT");
		const sixtyTabler = await client.callTool({ name: "read_icons", arguments: { set: "tabler", names: tabler.names.slice(0, 60) } });
		assert.equal(Object.keys(sixtyTabler.structuredContent.icons).length, 60);
		const sixtyIndexed = await client.callTool({ name: "read_icons", arguments: { set: "tabler", names: tabler.names.slice(0, 60), index: true } });
		t.diagnostic(`3 icons + Lucide index: ${size(three)} bytes; 3 icons: ${size(again)}; 60 Tabler icons: ${size(sixtyTabler)}; 60 Tabler icons + index: ${size(sixtyIndexed)}`);
		assert.ok(size(sixtyIndexed) < 200_000, "one call stays far under a message frame");

		const invalid = await client.callTool({ name: "read_icons", arguments: { set: "lucide", names: ["Rocket", "../x"] } });
		assert.deepEqual(Object.keys(invalid.structuredContent.errors).sort(), ["../x", "Rocket"]);
		assert.equal(failure(await client.callTool({ name: "read_icons", arguments: { set: "lucid", names: ["rocket"] } })).code, "unknown-id");
		const tooMany = await client.callTool({ name: "read_icons", arguments: { set: "lucide", names: Array.from({ length: 101 }, (_, at) => `icon-${at}`) } });
		assert.equal(tooMany.isError, true, "at most 100 names a call");
	} finally {
		await client.close();
	}
});
