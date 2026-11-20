// RR-63: a host pays for the icons its decks draw and for nothing else. The gallery's icon sets are code only: the data is plain static
// files in the gallery package (dist/icons/<set>.json with every name, dist/icons/<set>/<name>.json per icon, dist/icons/<set>.icons.json
// the whole set), read one icon at a time, from the installed package in Node (core's defaults, the CLI, the stdio MCP) or from the files
// a host serves (`fetchIcons`). So a server bundle carries no icon data whether or not it registers the sets, with or without code
// splitting; the unbundled Node API and a bundled Node server (ESM or CommonJS) draw `lucide:` and `tabler:` icons with no setup and read
// only the icons a deck names; and where the files cannot be read the deck gets a finding that says what to do, never a crash.
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { after, test } from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";
import { promisify } from "node:util";
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
// The drawing without the embedded faces, which a fresh process may list in another order.
const drawing = (svgs) => svgs.map((text) => text.replace(/<style>[\s\S]*?<\/style>/g, ""));
const scratch = [];
after(async () => {
	for (const dir of scratch) await rm(dir, { recursive: true, force: true });
});

/** Bundle a server entry (esbuild) and sum the icon data in every output. `worker`: the conditions a Workers build resolves; `format`: esm or cjs. */
async function bundle(contents, { splitting = false, worker = false, format = "esm" } = {}) {
	const result = await esbuild.build({
		stdin: { contents, resolveDir: packageRoot, loader: "js", sourcefile: "server.mjs" },
		bundle: true,
		...(worker ? { platform: "neutral", conditions: ["workerd", "worker", "browser"] } : { platform: "node" }),
		format,
		splitting,
		outdir: path.join(packageRoot, "bundle-out"),
		write: false,
		metafile: true,
		// The ESM builds first, as webpack and Next.js resolve a server package (jsonc-parser's UMD main hides its requires).
		mainFields: ["module", "main"],
		// An ESM bundle for Node gives its CommonJS dependencies (yaml) a require for the builtins they need.
		...(worker || format === "cjs" ? {} : { banner: { js: 'import { createRequire as bannerRequire } from "node:module"; const require = bannerRequire(import.meta.url);' } }),
		logLevel: "silent",
		external,
	});
	let iconBytes = 0;
	for (const output of Object.values(result.metafile.outputs)) for (const [input, { bytesInOutput }] of Object.entries(output.inputs)) if (ICON_DATA.test(input)) iconBytes += bytesInOutput;
	const inputs = Object.keys(result.metafile.inputs);
	return { iconBytes, iconInputs: inputs.filter((input) => ICON_DATA.test(input)), files: result.outputFiles, warnings: result.warnings };
}

/** Write a one-file bundle into a new folder under `root`; resolves with its path. */
async function write(files, root, name = "server.mjs") {
	await mkdir(root, { recursive: true });
	const dir = await mkdtemp(path.join(root, "opf-icon-bundle-"));
	scratch.push(dir);
	assert.equal(files.length, 1);
	const file = path.join(dir, name);
	await writeFile(file, files[0].contents);
	return file;
}
/** Write a one-file bundle and import it in this process. */
const load = async (files, root) => import(pathToFileURL(await write(files, root)).href);

/**
 * Run a bundled server in a child process, with its own copy of core and nothing loaded. `draw`: it draws the deck with `convert`
 * (core's defaults) and prints the SVG and the icon findings. Else (a directory with no engines to draw with) it loads the deck's icons
 * with `ensureIcons` over the exported `catalogs` (`galleryIconSets()`, what the defaults register) and prints `validate`'s icon
 * findings. `cwd`: the directory the server runs in (the one with node_modules, or one without).
 */
async function runServer(file, cwd, { draw = true } = {}) {
	const script = `const module = await import(${JSON.stringify(pathToFileURL(file).href)});
const server = module.convert ? module : module.default;
const deck = ${JSON.stringify(deck())};
const icons = (findings) => findings.filter((finding) => /icon/.test(finding.ruleId)).map(({ ruleId, message }) => ({ ruleId, message }));
if (${draw}) {
	const result = await server.convert(deck, { format: "svg" });
	process.stdout.write(JSON.stringify({ svg: result.files.map((file) => new TextDecoder().decode(file.bytes)), findings: icons(result.findings) }));
} else {
	await server.ensureIcons(deck, { catalogs: server.catalogs });
	process.stdout.write(JSON.stringify({ findings: icons(server.validate(deck, { catalogs: server.catalogs }).findings) }));
}`;
	const { stdout } = await promisify(execFile)(process.execPath, ["--input-type=module", "-e", script], { cwd, maxBuffer: 64 * 1024 * 1024 });
	return JSON.parse(stdout);
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
	assert.equal(lucide.errors, undefined);
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

for (const format of ["esm", "cjs"])
	test(`a bundled Node server (${format}) draws the gallery icons in a fresh process where the package is installed, and says what to do where it is not`, async () => {
		// The unbundled Node API in a fresh process too: the same faces load in the same order.
		const unbundled = (await runServer(path.resolve(packageRoot, "..", "javascript", "dist", "index.js"), packageRoot)).svg;
		const plain = deck();
		for (const item of plain.slides[0].items) delete item.icon;
		const server = await bundle(
			`import { gallery } from "@openpresentation/gallery";\nimport { galleryIconSets } from "@openpresentation/gallery/icon-sets";\nimport { convert, ensureIcons, validate } from "@openpresentation/opf";\nexport const catalogs = [gallery, galleryIconSets()];\nexport { convert, ensureIcons, validate };`,
			{ format },
		);
		assert.deepEqual(server.iconInputs, []);
		// A CommonJS bundle has no import.meta: esbuild says so, and the reader falls back to the installed package.
		assert.deepEqual(server.warnings.filter((warning) => warning.id !== "ignored-bare-import" && warning.id !== "empty-import-meta"), []);
		const name = format === "cjs" ? "server.cjs" : "server.mjs";
		// Deployed with its node_modules: the bundle sits elsewhere (no icons/ beside it), the server runs where the packages are installed.
		const installed = await runServer(await write(server.files, path.join(packageRoot, "node_modules", ".cache"), name), packageRoot);
		assert.deepEqual(installed.findings, [], "no icon finding");
		assert.deepEqual(drawing(installed.svg), drawing(unbundled), "the icons drawn as the unbundled Node API draws them");
		assert.notDeepEqual(drawing(installed.svg), drawing(svg(await opf.convert(plain, { format: "svg" }))));
		// Deployed without them (and no icons/ beside the bundle): each set icon is a finding that names the folders tried and the remedies.
		const alone = await runServer(await write(server.files, path.join(tmpdir(), "opf-icon-bundle-alone"), name), tmpdir(), { draw: false });
		assert.deepEqual(alone.findings.map((finding) => finding.ruleId), ["opf/icon-unknown", "opf/icon-unknown"]);
		for (const finding of alone.findings) {
			assert.match(finding.message, /^The icon (lucide:check|tabler:rocket) could not be loaded: The gallery icon files were not found \(looked in /);
			assert.match(finding.message, /@openpresentation\/gallery installed for .+ \(not found\)/);
			assert.match(finding.message, /Deploy the server with @openpresentation\/gallery installed .+ or register galleryIconSets\(load\)/);
		}
	});

/** A fetch over the gallery's dist/icons/ at https://example.test/opf-icons/; `serve(file)` false answers as `missing` does. */
function host({ serve = () => true, missing = "404" } = {}) {
	const fetched = [];
	const fetcher = async (url) => {
		fetched.push(String(url).replace("https://example.test/opf-icons/", ""));
		const file = String(url).replace("https://example.test/opf-icons/", "");
		if (!serve(file)) return missing === "404" ? new Response("Not found", { status: 404 }) : new Response("<!doctype html><title>App</title>", { headers: { "content-type": "text/html" } });
		return new Response(await readFile(path.join(iconRoot, ...file.split("/"))), { headers: { "content-type": "application/json" } });
	};
	return { fetched, fetcher };
}
const setLevel = (file) => !file.includes("/");

test("fetchIcons picks the cheap path: one file per icon for a few, the whole set for a page of them, and the whole set when per-icon files are missing", async () => {
	const few = host();
	const lucide = await galleryIconSets(fetchIcons("https://example.test/opf-icons/", few.fetcher)).iconSets.lucide({ icons: ["truck", "anchor"] });
	assert.deepEqual(Object.keys(lucide.icons).sort(), ["anchor", "truck"]);
	assert.deepEqual(few.fetched.sort(), ["lucide.json", "lucide/anchor.json", "lucide/truck.json"]);

	const page = host();
	const names = JSON.parse(await readFile(path.join(iconRoot, "tabler.json"), "utf8")).names.slice(0, 60);
	const tabler = await galleryIconSets(fetchIcons("https://example.test/opf-icons/", page.fetcher)).iconSets.tabler({ icons: names });
	assert.equal(Object.keys(tabler.icons).length, 60);
	assert.deepEqual(page.fetched, ["tabler.icons.json"], "one request for a page of 60 icons");

	// A host that serves only the set-level files: a 404, or a single-page app's index.html with status 200, then the whole set once.
	for (const missing of ["404", "html"]) {
		const only = host({ serve: setLevel, missing });
		const sets = galleryIconSets(fetchIcons("https://example.test/opf-icons/", only.fetcher));
		const first = await sets.iconSets.lucide({ icons: ["truck", "anchor"] });
		assert.deepEqual(Object.keys(first.icons).sort(), ["anchor", "truck"], missing);
		assert.equal(first.errors, undefined, missing);
		const second = await sets.iconSets.lucide({ icons: ["bell"] });
		assert.deepEqual(Object.keys(second.icons), ["bell"]);
		assert.deepEqual(only.fetched.filter((file) => file.endsWith(".icons.json")), ["lucide.icons.json"], `${missing}: the whole set is read once`);
		assert.ok(!only.fetched.includes("lucide/bell.json"), `${missing}: after the whole set, no per-icon request`);
	}

	// Nothing served: every icon asked for has the reason, naming the URLs.
	const none = host({ serve: (file) => file === "lucide.json" });
	const failed = await galleryIconSets(fetchIcons("https://example.test/opf-icons/", none.fetcher)).iconSets.lucide({ icons: ["truck"] });
	assert.deepEqual(failed.icons, {});
	assert.equal(failed.errors.truck, "https://example.test/opf-icons/lucide/truck.json answered 404. (and https://example.test/opf-icons/lucide.icons.json answered 404.)");
});

test("fetchIcons takes a fetch binding without relying on this, refuses a relative base outside a page, and names the URL of a page served in place of a file", async () => {
	const files = host();
	// A Workers binding checks `this`: pass the binding itself (env.ASSETS), called as binding.fetch(url).
	const binding = { fetch(url) { if (this !== binding) throw new TypeError("Illegal invocation"); return files.fetcher(url); } };
	const record = await galleryIconSets(fetchIcons(new URL("https://example.test/opf-icons/"), binding)).iconSets.lucide({ icons: ["truck"] });
	assert.deepEqual(Object.keys(record.icons), ["truck"]);
	assert.throws(() => fetchIcons("/opf-icons/"), /a relative base URL needs a page to resolve against; pass an absolute URL/);
	assert.throws(() => fetchIcons("https://example.test/", 42), /fetcher must be a fetch function or an object with a fetch method/);
	const spa = fetchIcons("https://example.test/opf-icons", async () => new Response("<!doctype html>", { status: 200, headers: { "content-type": "text/html" } }));
	await assert.rejects(spa("lucide.json"), /^Error: https:\/\/example\.test\/opf-icons\/lucide\.json answered a web page, not the icon file/);
	const broken = fetchIcons("https://example.test/opf-icons/", async () => new Response("{ nope", { headers: { "content-type": "application/json" } }));
	await assert.rejects(broken("lucide.json"), /^Error: https:\/\/example\.test\/opf-icons\/lucide\.json is not JSON: /);
	const offline = fetchIcons("https://example.test/opf-icons/", async () => { throw new TypeError("fetch failed"); });
	await assert.rejects(offline("lucide.json"), /^Error: https:\/\/example\.test\/opf-icons\/lucide\.json could not be fetched: fetch failed$/);
});

test("a bundled server draws the icons it serves, and a bundle that cannot read them gets a finding, not a crash", async () => {
	// A host that serves dist/icons/ registers galleryIconSets(fetchIcons(url)): only the icons a deck names are fetched.
	const served = await bundle(`import { gallery } from "@openpresentation/gallery";
import { fetchIcons, galleryIconSets } from "@openpresentation/gallery/icon-sets";
import { ensureIcons, iconsPending, resolveIcon, validate } from "@openpresentation/opf";
export const sets = (fetcher) => [gallery, galleryIconSets(fetchIcons("https://example.test/opf-icons/", fetcher))];
export { ensureIcons, iconsPending, resolveIcon, validate };`);
	const bundled = await load(served.files, path.join(tmpdir(), "opf-icon-bundle-served"));
	const files = host();
	const catalogs = bundled.sets(files.fetcher);
	// Icons no earlier test loaded: every copy of core in a process shares what ensureIcons loaded.
	const fresh = { slides: [{ title: "x", items: [{ text: "a", icon: "lucide:badge-check" }, { text: "b", icon: "tabler:bolt" }] }] };
	await bundled.ensureIcons(fresh, { catalogs });
	assert.deepEqual(files.fetched.sort(), ["lucide.json", "lucide/badge-check.json", "tabler.json", "tabler/bolt.json"]);
	assert.equal(bundled.resolveIcon(fresh, "lucide:badge-check", { catalogs }).ok, true);
	assert.equal(opf.resolveIcon(fresh, "tabler:bolt").ok, true, "the unbundled copy of core (the one the engines import) sees what the bundled copy loaded");
	assert.deepEqual(bundled.validate(fresh, { catalogs }).findings.filter((finding) => /icon/.test(finding.ruleId)), []);

	// Where nothing can be read the set icon is a finding that says why, and it is settled: nothing is pending, nothing is asked again.
	const nothing = host({ serve: () => false });
	const lost = bundled.sets(nothing.fetcher);
	const other = { slides: [{ title: "x", items: [{ text: "a", icon: "lucide:anchor" }, { text: "b", icon: "tabler:bell" }] }] };
	assert.deepEqual(await bundled.ensureIcons(other, { catalogs: lost }), { sets: [], sources: [] }, "nothing loaded, and no rejection");
	assert.deepEqual(bundled.iconsPending(other, { catalogs: lost }), { sets: [], sources: [] });
	const findings = bundled.validate(other, { catalogs: lost }).findings.filter((finding) => finding.ruleId === "opf/icon-unknown");
	assert.deepEqual(findings.map((finding) => finding.message).sort(), [
		"The icon lucide:anchor could not be loaded: https://example.test/opf-icons/lucide.json answered 404. (and https://example.test/opf-icons/lucide.icons.json answered 404.)",
		"The icon tabler:bell could not be loaded: https://example.test/opf-icons/tabler.json answered 404. (and https://example.test/opf-icons/tabler.icons.json answered 404.)",
	].sort());
	const asked = nothing.fetched.length;
	await bundled.ensureIcons(other, { catalogs: lost });
	assert.equal(nothing.fetched.length, asked, "a settled failure is not asked again");
	await bundled.ensureIcons(other, { catalogs: lost, retry: true });
	assert.ok(nothing.fetched.length > asked, "an explicit retry asks again");
});

test("in a browser or Worker, galleryIconSets() with no load is a finding that says to serve the files, and installedIconSets() registers nothing", async () => {
	const worker = await bundle(`import { galleryIconSets, installedIconSets } from "@openpresentation/gallery/icon-sets";\nexport const sets = galleryIconSets();\nexport const installed = installedIconSets();`, { worker: true });
	const text = new TextDecoder().decode(worker.files[0].contents);
	assert.ok(!text.includes("node:fs"), "the Worker build takes the reader that reads nothing");
	const { sets, installed } = await import(`data:text/javascript;base64,${Buffer.from(text).toString("base64")}`);
	await assert.rejects(sets.iconSets.lucide({ icons: ["truck"] }), /^Error: The gallery icon files cannot be read in this runtime: serve @openpresentation\/gallery's dist\/icons\/ folder and register galleryIconSets\(fetchIcons\(baseUrl\)\)\.$/);
	assert.equal(installed, undefined);
	assert.equal(typeof fetchIcons, "function");
});

// Last: it loads the whole Lucide set into the process's registry, which the tests above read through.
test("a server that bundles a whole set imports its file and registers it, reading nothing at run time", async () => {
	const server = await bundle(`import lucide from "@openpresentation/gallery/icons/lucide.icons.json" with { type: "json" };
import { gallery } from "@openpresentation/gallery";
import { galleryIconSets } from "@openpresentation/gallery/icon-sets";
import { ensureIcons, resolveIcon } from "@openpresentation/opf";
export const catalogs = [gallery, galleryIconSets({ lucide })];
export { ensureIcons, resolveIcon };`);
	assert.ok(server.iconInputs.some((input) => input.endsWith("lucide.icons.json")) && server.iconInputs.length === 1, server.iconInputs.join(", "));
	const host = await load(server.files, path.join(tmpdir(), "opf-icon-bundle-whole"));
	assert.deepEqual(Object.keys(host.catalogs[1].iconSets), ["lucide"]);
	const one = { slides: [{ title: "x", items: [{ text: "a", icon: "lucide:sailboat" }] }] };
	await host.ensureIcons(one, { catalogs: host.catalogs });
	assert.equal(host.resolveIcon(one, "lucide:sailboat", { catalogs: host.catalogs }).ok, true);
	assert.throws(() => galleryIconSets({ lucide: {} }), /pass the whole-set file @openpresentation\/gallery\/icons\/lucide\.icons\.json/);
	assert.throws(() => galleryIconSets({ feather: {} }), /has no icon set feather/);
});
