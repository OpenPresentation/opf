// RR-63: `defaultSources()` registers the gallery icon sets only where it can read their files. In Node (the stdio server, a Node host)
// they are the installed package's files; in a Worker bundle (the `worker`/`browser` conditions) there is nothing to read, so the sets
// are left out, as in the lean server, and `search_icons` and `validate_deck` answer as a server with no icon sets does instead of an
// error on every search and a warning on every set icon. A Worker that serves the files passes its own `sources.iconSets`.
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { after, test } from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { fetchIcons, galleryIconSets } from "@openpresentation/gallery/icon-sets";
import { defaultSources } from "../dist/index.js";
import { bundleWorker } from "./helpers/workerd.mjs";

const scratch = await mkdtemp(path.join(tmpdir(), "opf-mcp-icons-"));
after(() => rm(scratch, { recursive: true, force: true }));

async function connect(createOpfServer, options) {
	const [a, b] = InMemoryTransport.createLinkedPair();
	await createOpfServer({ version: "0.0.0-test", ...options }).connect(b);
	const client = new Client({ name: "test", version: "1" });
	await client.connect(a);
	return client;
}
const deck = { name: "Icons", language: "en", slides: [{ title: "Why", items: [{ text: "Fast", icon: "lucide:truck" }] }] };
const iconFindings = (result) => result.structuredContent.findings.filter((finding) => /icon/.test(finding.ruleId));

test("in Node, defaultSources() registers the gallery icon sets over the installed files", () => {
	assert.deepEqual(Object.keys(defaultSources().iconSets.iconSets), ["lucide", "tabler"]);
});

test("in a Worker bundle, defaultSources() leaves the icon sets out, and a host that serves the files passes its own", async () => {
	const bundle = await bundleWorker("mcp-icons-entry.mjs");
	const file = path.join(scratch, "worker.mjs");
	await writeFile(file, bundle.text);
	const worker = await import(pathToFileURL(file).href);
	assert.equal(Object.hasOwn(worker.defaultSources(), "iconSets"), false, "no loader that cannot work");

	const client = await connect(worker.createOpfServer);
	const search = await client.callTool({ name: "search_icons", arguments: { query: "truck" } });
	assert.equal(search.isError, true);
	assert.match(search.content[0].text, /This server bundles no icon sets/);
	// validate_deck checks the deck as a server with no icon sets does: one finding that names the missing set, no load failure.
	const findings = iconFindings(await client.callTool({ name: "validate_deck", arguments: { document: deck } }));
	assert.deepEqual(findings.map((finding) => finding.ruleId), ["opf/icon-unknown"]);
	assert.match(findings[0].message, /^No icon set lucide is embedded or registered/);
	await client.close();

	// The host serves dist/icons/ (here: a fetch over the installed files) and registers the sets itself.
	const icons = path.join(path.dirname(fileURLToPath(import.meta.resolve("@openpresentation/gallery/package.json"))), "dist", "icons");
	const assets = { fetch: async (url) => new Response(await readFile(path.join(icons, ...new URL(url).pathname.replace("/opf-icons/", "").split("/"))), { headers: { "content-type": "application/json" } }) };
	const served = await connect(worker.createOpfServer, { sources: { iconSets: galleryIconSets(fetchIcons("https://worker.test/opf-icons/", assets)) } });
	const found = (await served.callTool({ name: "search_icons", arguments: { query: "truck" } })).structuredContent;
	assert.equal(found.icons[0].icon, "lucide:truck");
	assert.deepEqual(iconFindings(await served.callTool({ name: "validate_deck", arguments: { document: deck } })), []);
	await served.close();
});
