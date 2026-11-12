// RR-63: a host pays for the icons its decks draw and for nothing else. The gallery's icon sets are code only: the data is plain static
// files in the gallery package (dist/icons/<set>.json with every name, dist/icons/<set>/<name>.json per icon), read one icon at a time,
// from the installed package in Node (core's defaults, the CLI, the stdio MCP) or from the files a host serves (`fetchIcons`). So a
// server bundle carries no icon data whether or not it registers the sets, with or without code splitting; the unbundled Node API draws
// `lucide:` and `tabler:` icons with no setup and reads only the icons a deck names; and where the files cannot be read the deck gets
// a finding, never a crash.
import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { after, test } from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";
import { gallery } from "@openpresentation/gallery";
import { fetchIcons, galleryIconSets } from "@openpresentation/gallery/icon-sets";
import * as esbuild from "esbuild";

const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const iconRoot = path.resolve(packageRoot, "..", "gallery", "dist", "icons");
const opf = await import(pathToFileURL(path.resolve(packageRoot, "..", "javascript", "dist", "index.js")).href);
// Any icon data: the files under the gallery's dist/icons/, and the whole-set modules the gallery shipped before RR-63.
const ICON_DATA = /(?:gallery[\\/]dist[\\/]icons[\\/]|icon-sets[\\/](?:lucide|tabler)\.js$)/;
// The engines are optional peers core loads on the first drawing call; a server keeps them external like any native dependency.
const external = ["node:*", "@openpresentation/opf-render", "@openpresentation/opf-render/*", "@openpresentation/opf-pptx", "@openpresentation/opf-pptx/*"];
const deck = () => ({ name: "Icons", slides: [{ title: "Checks", items: [{ text: "Shipped", icon: "lucide:check" }, { text: "Launched", icon: "tabler:rocket" }] }] });
const svg = (result) => result.files.map((file) => new TextDecoder().decode(file.bytes));
const scratch = [];
after(async () => {
	for (const dir of scratch) await rm(dir, { recursive: true, force: true });
});

/** Bundle a server entry (esbuild) and sum the icon data in every output. `worker`: the conditions a Workers build resolves. */
async function bundle(contents, { splitting = false, worker = false } = {}) {
	const result = await esbuild.build({
		stdin: { contents, resolveDir: packageRoot, loader: "js", sourcefile: "server.mjs" },
		bundle: true,
		...(worker ? { platform: "neutral", conditions: ["workerd", "worker", "browser"] } : { platform: "node" }),
		format: "esm",
		splitting,
		outdir: path.join(packageRoot, "bundle-out"),
		write: false,
		metafile: true,
		// The ESM builds first, as webpack and Next.js resolve a server package (jsonc-parser's UMD main hides its requires).
		mainFields: ["module", "main"],
		// An ESM bundle for Node gives its CommonJS dependencies (yaml) a require for the builtins they need.
		...(worker ? {} : { banner: { js: 'import { createRequire as bannerRequire } from "node:module"; const require = bannerRequire(import.meta.url);' } }),
		logLevel: "silent",
		external,
	});
	let iconBytes = 0;
	for (const output of Object.values(result.metafile.outputs)) for (const [input, { bytesInOutput }] of Object.entries(output.inputs)) if (ICON_DATA.test(input)) iconBytes += bytesInOutput;
	const inputs = Object.keys(result.metafile.inputs);
	return { iconBytes, iconInputs: inputs.filter((input) => ICON_DATA.test(input)), files: result.outputFiles, warnings: result.warnings };
}

/** Write a one-file bundle under `root` and import it. */
async function load(files, root) {
	await mkdir(root, { recursive: true });
	const dir = await mkdtemp(path.join(root, "opf-icon-bundle-"));
	scratch.push(dir);
	assert.equal(files.length, 1);
	const file = path.join(dir, "server.mjs");
	await writeFile(file, files[0].contents);
	return import(pathToFileURL(file).href);
}

test("the Node API draws gallery icons with no setup, as a deck that embeds them, reading only the icons it names", async () => {
	// This runs first in the file, before any set is loaded in this copy of core: the defaults do the loading.
	const read = [];
	const counting = galleryIconSets(async (file) => {
		read.push(file);
		return JSON.parse(await readFile(path.join(iconRoot, ...file.split("/")), "utf8"));
	});
	const defaults = await opf.convert(deck(), { format: "svg" });
	const registered = await opf.convert(deck(), { format: "svg", catalogs: [gallery, counting] });
	assert.deepEqual(svg(defaults), svg(registered));
	assert.deepEqual(defaults.findings, registered.findings);
	const embedded = opf.embedIcons(deck(), { catalogs: [gallery, counting] }).document;
	assert.deepEqual(Object.keys(embedded.catalogs.default.iconSets.lucide.icons), ["check"]);
	assert.deepEqual(svg(await opf.convert(embedded, { format: "svg", catalogs: [gallery] })), svg(defaults), "the same drawing as the embedded icons");
	const plain = deck();
	for (const item of plain.slides[0].items) delete item.icon;
	assert.notDeepEqual(svg(defaults), svg(await opf.convert(plain, { format: "svg" })), "the icons are drawn");
	// The core registry already holds both icons, so a second catalog reads at most each set's index and nothing else.
	assert.ok(read.every((file) => /^(lucide|tabler)\.json$/.test(file) || file === "lucide/check.json" || file === "tabler/rocket.json"), read.join(", "));
	const typo = { slides: [{ title: "x", items: [{ text: "a", icon: "lucide:chek" }] }] };
	const unknown = opf.validate(typo).findings.filter((finding) => finding.ruleId === "opf/icon-unknown");
	assert.equal(unknown.length, 1);
	assert.equal(unknown[0].message, "The icon set lucide has no icon chek.", "the finding text of 0.33");
});

test("the gallery's sets read the index, then one file per icon asked for, and the keywords only for a search", async () => {
	const read = [];
	const sets = galleryIconSets(async (file) => {
		read.push(file);
		return JSON.parse(await readFile(path.join(iconRoot, ...file.split("/")), "utf8"));
	});
	const lucide = await sets.iconSets.lucide({ icons: ["truck", "nope", "truck"] });
	assert.deepEqual(read, ["lucide.json", "lucide/truck.json"]);
	assert.deepEqual(Object.keys(lucide.icons), ["truck"]);
	assert.ok(lucide.names.length > 1000 && lucide.names.includes("truck"));
	assert.equal(lucide.license, "ISC");
	assert.equal(lucide.tags, undefined);
	const searched = await sets.iconSets.lucide({ tags: true });
	assert.ok(Array.isArray(searched.tags.truck));
	assert.deepEqual(read, ["lucide.json", "lucide/truck.json", "lucide.tags.json"], "each file is read once");
});

test("a server bundle carries no icon data, whether or not it registers the sets, for Node and for Workers, with or without splitting", async () => {
	const entries = {
		defaults: `import { validate } from "@openpresentation/opf";\nexport { validate };`,
		fileApi: `import { convert, open, save } from "@openpresentation/opf";\nexport { convert, open, save };`,
		registered: `import { gallery } from "@openpresentation/gallery";\nimport { fetchIcons, galleryIconSets } from "@openpresentation/gallery/icon-sets";\nimport { ensureIcons, validate } from "@openpresentation/opf";\nexport const catalogs = [gallery, galleryIconSets(fetchIcons("https://example.test/opf-icons/"))];\nexport { ensureIcons, validate };`,
	};
	for (const [name, contents] of Object.entries(entries))
		for (const worker of [false, true])
			for (const splitting of [false, true]) {
				const built = await bundle(contents, { splitting, worker });
				assert.deepEqual(built.iconInputs, [], `${name}, ${worker ? "Worker" : "Node"}, splitting ${splitting}: no icon data in the graph`);
				assert.equal(built.iconBytes, 0);
				// esbuild's other notes are core's side-effect-free chunks, as before RR-63.
				assert.deepEqual(built.warnings.filter((warning) => warning.id !== "ignored-bare-import"), [], `${name}: no bundler warning`);
			}
});

test("a bundled server draws the icons it serves, and a bundle that cannot read them gets a finding, not a crash", async () => {
	const registered = svg(await opf.convert(deck(), { format: "svg", catalogs: [gallery, galleryIconSets()] }));
	// Beside the installed packages (a Node server deployed with its node_modules) the defaults read the files.
	const server = await bundle(`import { convert } from "@openpresentation/opf";\nexport { convert };`);
	const installed = await load(server.files, path.join(packageRoot, "node_modules", ".cache"));
	assert.deepEqual(svg(await installed.convert(deck(), { format: "svg" })), registered);

	// A host that serves dist/icons/ registers galleryIconSets(fetchIcons(url)): only the icons a deck names are fetched.
	const served = await bundle(`import { gallery } from "@openpresentation/gallery";
import { fetchIcons, galleryIconSets } from "@openpresentation/gallery/icon-sets";
import { ensureIcons, resolveIcon, validate } from "@openpresentation/opf";
export const sets = (fetchImpl) => [gallery, galleryIconSets(fetchIcons("https://example.test/opf-icons/", fetchImpl))];
export { ensureIcons, resolveIcon, validate };`);
	const host = await load(served.files, path.join(tmpdir(), "opf-icon-bundle-served"));
	const fetched = [];
	const fetchImpl = async (url) => {
		fetched.push(url);
		const file = String(url).replace("https://example.test/opf-icons/", "");
		return new Response(await readFile(path.join(iconRoot, ...file.split("/"))), { headers: { "content-type": "application/json" } });
	};
	const catalogs = host.sets(fetchImpl);
	await host.ensureIcons(deck(), { catalogs });
	assert.deepEqual(fetched.sort(), ["lucide.json", "lucide/check.json", "tabler.json", "tabler/rocket.json"].map((file) => `https://example.test/opf-icons/${file}`));
	assert.equal(host.resolveIcon(deck(), "lucide:check", { catalogs }).ok, true);
	assert.deepEqual(host.validate(deck(), { catalogs }).findings.filter((finding) => /icon/.test(finding.ruleId)), []);

	// Where nothing can read the files (a Worker, a directory with no node_modules) the set icon is a finding that says what to do.
	const lost = await bundle(`import { gallery } from "@openpresentation/gallery";
import { fetchIcons, galleryIconSets } from "@openpresentation/gallery/icon-sets";
import { ensureIcons, validate } from "@openpresentation/opf";
export const catalogs = [gallery, galleryIconSets(fetchIcons("https://example.test/missing/", async () => new Response("", { status: 404 })))];
export { ensureIcons, validate };`);
	const alone = await load(lost.files, path.join(tmpdir(), "opf-icon-bundle-alone"));
	assert.deepEqual(await alone.ensureIcons(deck(), { catalogs: alone.catalogs }), { sets: [], sources: [] });
	const findings = alone.validate(deck(), { catalogs: alone.catalogs }).findings.filter((finding) => finding.ruleId === "opf/icon-unknown");
	assert.equal(findings.length, 2);
	assert.match(findings[0].message, /^The icon set (lucide|tabler) is registered but could not be loaded: https:\/\/example\.test\/missing\/(lucide|tabler)\.json answered 404\.$/);
});

test("in a browser or Worker, galleryIconSets() with no load is a finding that says to serve the files", async () => {
	const worker = await bundle(`import { galleryIconSets } from "@openpresentation/gallery/icon-sets";\nexport const sets = galleryIconSets();`, { worker: true });
	const text = new TextDecoder().decode(worker.files[0].contents);
	assert.ok(!text.includes("node:fs"), "the Worker build takes the reader that reads nothing");
	const { sets } = await import(`data:text/javascript;base64,${Buffer.from(text).toString("base64")}`);
	await assert.rejects(sets.iconSets.lucide({ icons: ["truck"] }), /cannot be read in this runtime \(lucide\.json\): serve the package's dist\/icons\/ folder and register galleryIconSets\(fetchIcons\(baseUrl\)\)/);
	assert.equal(typeof fetchIcons, "function");
});
