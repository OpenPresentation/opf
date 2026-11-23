// The image files of the bundled example decks (./assets/logo.svg) for the viewer: the default sources carry each example's own as
// data URIs, the decks a model reads are unchanged, the app-only read_example_files serves only the files the examples ship (a lookup:
// a path a deck names never makes the server read a file or fetch a URL), and the viewer's loader (app/example-files.ts, bundled as
// build-app bundles it) asks only for relative image paths and keeps only data URIs of images it asked for.
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import path from "node:path";
import { after, test } from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { examples as coreExamples } from "@openpresentation/opf/examples";
import { createOpfServer, defaultSources } from "../dist/index.js";
import { createOpfMcpServer } from "../dist/server.js";

const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(path.join(packageRoot, "package.json"));
const shipped = path.join(path.dirname(require.resolve("@openpresentation/opf/package.json")), "dist", "example-files");
const scratch = await mkdtemp(path.join(tmpdir(), "opf-mcp-example-files-"));
after(() => rm(scratch, { recursive: true, force: true }));

async function linked(server) {
	const [a, b] = InMemoryTransport.createLinkedPair();
	await server.connect(b);
	const client = new Client({ name: "example-files", version: "1" });
	await client.connect(a);
	return client;
}

/** Every file core ships for the examples, by its path under examples/. */
function shippedFiles(directory = shipped, prefix = "") {
	return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => (entry.isDirectory() ? shippedFiles(path.join(directory, entry.name), `${prefix}${entry.name}/`) : [[`${prefix}${entry.name}`, readFileSync(path.join(directory, entry.name))]]));
}
const bytesOf = (uri) => Buffer.from(uri.slice(uri.indexOf(",") + 1), "base64");

test("the default sources carry each example's image files, byte for byte the files core ships", () => {
	const files = new Map(shippedFiles());
	assert.ok(files.size > 0, "core ships the example image files (dist/example-files)");
	const used = new Set();
	for (const example of defaultSources().examples) {
		const folder = path.posix.dirname(example.file.replace(/^examples\//, ""));
		const text = JSON.stringify(example.deck);
		for (const [name, uri] of Object.entries(example.files ?? {})) {
			assert.ok(text.includes(JSON.stringify(name)), `${example.slug} names ${name}`);
			const key = path.posix.join(folder, name);
			assert.ok(files.has(key), `${key} is a file core ships`);
			assert.match(uri, /^data:image\/(png|svg\+xml);base64,/);
			assert.deepEqual(bytesOf(uri), files.get(key), `${example.slug} ${name}`);
			used.add(key);
		}
		// Every shipped image the deck names is attached.
		for (const ref of text.match(/"\.\/[^"]+"/g) ?? []) {
			const name = JSON.parse(ref);
			if (files.has(path.posix.join(folder, name)) && /\.(png|svg)$/.test(name)) assert.ok(example.files?.[name], `${example.slug} carries ${name}`);
		}
	}
	assert.deepEqual([...used].sort(), [...files.keys()].filter((key) => /\.(png|jpe?g|gif|webp|svg)$/.test(key)).sort(), "every shipped image belongs to an example");
});

test("a deck a model reads is the example as core has it: no image data in list_examples, get_catalog_record or opf://examples", async () => {
	const client = await linked(createOpfServer({ version: "0.0.0-test" }));
	const withFiles = defaultSources().examples.filter((example) => example.files);
	assert.ok(withFiles.length >= 5, `${withFiles.length} examples name shipped images`);
	const listed = JSON.stringify((await client.callTool({ name: "list_examples", arguments: {} })).structuredContent);
	for (const example of withFiles) {
		const core = coreExamples.find((item) => item.slug === example.slug).deck;
		const record = (await client.callTool({ name: "get_catalog_record", arguments: { kind: "examples", id: example.slug } })).structuredContent.record;
		assert.deepEqual(record, core, `${example.slug}: get_catalog_record`);
		const resource = (await client.readResource({ uri: `opf://examples/${example.slug}` })).contents[0].text;
		for (const uri of Object.values(example.files)) {
			assert.ok(!resource.includes(uri.slice(0, 200)), `${example.slug}: the resource carries no image data`);
			assert.ok(!listed.includes(uri.slice(0, 200)));
		}
	}
	await client.close();
});

test("read_example_files: for the view only, the shipped files by the path a deck names, and nothing else", async () => {
	const client = await linked(createOpfServer({ version: "0.0.0-test" }));
	const tool = (await client.listTools()).tools.find((item) => item.name === "read_example_files");
	assert.deepEqual(tool?._meta?.ui, { visibility: ["app"] }, "hidden from the model");
	const call = async (names) => (await client.callTool({ name: "read_example_files", arguments: { names } })).structuredContent;
	const got = await call(["./assets/logo.svg", "./assets/cover.png", "./assets/logo.svg"]);
	assert.deepEqual(Object.keys(got.files), ["./assets/logo.svg", "./assets/cover.png"]);
	assert.deepEqual(got.missing, []);
	assert.deepEqual(bytesOf(got.files["./assets/cover.png"]), readFileSync(path.join(shipped, "technical/assets/cover.png")));
	// The security boundary: a path that is not a shipped example file is never read, resolved or fetched; it is only reported missing.
	const hostile = [
		"./assets/../../package.json",
		"../package.json",
		"./package.json",
		"./dist/index.js",
		"assets/logo.svg",
		"/etc/passwd",
		"C:\\Windows\\win.ini",
		".\\assets\\logo.svg",
		"file:///etc/passwd",
		"https://example.com/logo.png",
		"./assets/LOGO.SVG",
		"./assets/logo.svg?x=1",
		"./assets/logo.svg/",
		"./assets/%2e%2e/logo.svg",
		"./data/pipeline.csv",
		"./media/demo.mp4",
		"__proto__",
		"constructor",
		"",
	];
	const refused = await call(hostile);
	assert.deepEqual(refused.files, {});
	assert.deepEqual(refused.missing, hostile);
	const tooMany = await client.callTool({ name: "read_example_files", arguments: { names: Array.from({ length: 33 }, (_, index) => `./assets/${index}.png`) } });
	assert.equal(tooMany.isError, true, "at most 32 paths a call");
	await client.close();
});

test("read_example_files serves only data URIs of images from a host's sources, and is listed whenever the viewer is offered", async () => {
	const base = { docs: [], skills: {} };
	const examples = [
		{ slug: "a", category: "x", file: "examples/x/a.opf.json", deck: {}, files: { "./ok.png": "data:image/png;base64,iVBORw0KGgo=", "./remote.png": "https://example.com/x.png", "./local.png": "file:///etc/passwd", "./page.svg": "data:text/html;base64,PGh0bWw+" } },
	];
	const html = "<!doctype html><title>view</title>";
	const client = await linked(createOpfMcpServer({ version: "0.0.0-test", sources: { ...base, examples }, deckApp: { html } }));
	const got = (await client.callTool({ name: "read_example_files", arguments: { names: ["./ok.png", "./remote.png", "./local.png", "./page.svg"] } })).structuredContent;
	assert.deepEqual(got, { files: { "./ok.png": "data:image/png;base64,iVBORw0KGgo=" }, missing: ["./remote.png", "./local.png", "./page.svg"] });
	await client.close();
	// A host may answer tools/list from a server built without its examples: with the viewer the tool is still listed (a client that
	// lets a view call only listed tools would refuse the call otherwise), and every path is missing. Without the viewer it is not offered.
	const bare = await linked(createOpfMcpServer({ version: "0.0.0-test", sources: { ...base, examples: [] }, deckApp: { html } }));
	const listed = (await bare.listTools()).tools.find((tool) => tool.name === "read_example_files");
	assert.deepEqual(listed?._meta?.ui?.visibility, ["app"]);
	assert.deepEqual((await bare.callTool({ name: "read_example_files", arguments: { names: ["./ok.png"] } })).structuredContent, { files: {}, missing: ["./ok.png"] });
	await bare.close();
	const none = await linked(createOpfMcpServer({ version: "0.0.0-test", sources: { ...base, examples }, processDecks: true }));
	assert.equal((await none.listTools()).tools.some((tool) => tool.name === "read_example_files"), false);
	await none.close();
});

/** app/example-files.ts as the view's bundle has it (esbuild, browser conditions). */
async function viewerLoader() {
	const esbuild = createRequire(require.resolve("tsup"))("esbuild");
	const result = await esbuild.build({ entryPoints: [path.join(packageRoot, "app", "example-files.ts")], absWorkingDir: packageRoot, bundle: true, format: "esm", platform: "browser", write: false, logLevel: "silent" });
	const file = path.join(scratch, "example-files.mjs");
	await writeFile(file, result.outputFiles[0].text);
	return import(pathToFileURL(file).href);
}

test("the view asks only for relative image paths, and keeps only image data URIs it asked for", async () => {
	const { exampleImages, localImages } = await viewerLoader();
	const client = await linked(createOpfServer({ version: "0.0.0-test" }));
	const asked = [];
	const loader = exampleImages(async (names) => {
		asked.push([...names]);
		return (await client.callTool({ name: "read_example_files", arguments: { names: [...names] } })).structuredContent;
	});
	const deck = {
		name: "Pictures",
		assets: { logo: { src: "./assets/logo.svg" }, far: { src: "../secrets/key.png" } },
		slides: [
			{ title: "A", image: "./assets/cover.png", blocks: [{ image: "./assets/not-shipped.png" }, { image: "./assets/../../package.json" }, { image: "/etc/passwd.png" }] },
			{ title: "B", image: "https://example.com/x.png", blocks: [{ image: "file:///c:/x.png" }, { image: "./data/pipeline.csv" }, { text: "./assets/cover.png" }] },
		],
	};
	assert.deepEqual(localImages(deck), ["./assets/logo.svg", "./assets/cover.png", "./assets/not-shipped.png"]);
	assert.equal(await loader.load(deck), true, "it got new images");
	assert.deepEqual(asked, [["./assets/logo.svg", "./assets/cover.png", "./assets/not-shipped.png"]]);
	assert.match(loader.resolve("./assets/cover.png"), /^data:image\/png;base64,/);
	assert.match(loader.resolve("./assets/logo.svg"), /^data:image\/svg\+xml;base64,/);
	for (const src of ["./assets/not-shipped.png", "../secrets/key.png", "https://example.com/x.png", undefined]) assert.equal(loader.resolve(src), undefined, String(src));
	assert.equal(await loader.load(deck), false, "a path is asked for once");
	assert.equal(asked.length, 1);

	// A server that answers with something else (another path, a remote URL, a page) is not believed.
	const lying = exampleImages(async () => ({ files: { "./a.png": "https://example.com/a.png", "./b.svg": "data:text/html;base64,PGh0bWw+", "./c.png": "data:image/png;base64,iVBORw0KGgo=", "./x.png": "data:image/png;base64,iVBORw0KGgo=" } }));
	assert.equal(await lying.load({ slides: [{ image: "./a.png" }, { image: "./b.svg" }, { image: "./c.png" }] }), true);
	assert.equal(lying.resolve("./a.png"), undefined);
	assert.equal(lying.resolve("./b.svg"), undefined);
	assert.equal(lying.resolve("./x.png"), undefined, "a path it did not ask for");
	assert.equal(lying.resolve("./c.png"), "data:image/png;base64,iVBORw0KGgo=");
	// No tool (a lean server, a host that cannot call the server): the placeholders stay, nothing throws.
	const failing = exampleImages(async () => {
		throw new Error("no such tool");
	});
	assert.equal(await failing.load({ slides: [{ image: "./assets/logo.svg" }] }), false);
	await client.close();
});
