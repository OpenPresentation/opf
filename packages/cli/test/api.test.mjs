// `@openpresentation/cli/api` (RR-62): readDeck across the three formats, exportDeck for PDF, PNG, SVG and PPTX through the
// workspace's opf-render and opf-pptx, importDeck, the typed errors (a missing peer is simulated in a copy of the build that
// has no peer above it), and that the API runs on one core. The package imports itself by name, so the `exports` map is
// part of what is tested.
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { cp, mkdir, mkdtemp, readFile, readdir, rm, symlink, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { after, describe, test } from "node:test";
import * as core from "@openpresentation/opf";
import { defaultCatalog } from "@openpresentation/opf/catalog";
import * as api from "@openpresentation/cli/api";
import { cliPeerGate, report } from "../../../scripts/unreleased-gate.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const cliRoot = path.resolve(here, "..");
const dist = path.join(cliRoot, "dist");
// The tests that draw run through the workspace's published peers; while those do not satisfy the CLI's peer ranges (a
// coordinated release not on npm yet) a pull request skips them with a notice (scripts/unreleased-gate.mjs), as files.mjs does.
const peersGate = cliPeerGate({ cliRoot, executable: path.join(dist, "index.js"), names: ["@openpresentation/opf-render", "@openpresentation/opf-pptx"] });
const skip = report(peersGate) ? false : "the optional peers are not on npm at the versions the CLI asks for";
const temp = await mkdtemp(path.join(tmpdir(), "opf-api-test-"));
after(() => rm(temp, { recursive: true, force: true }));

const deck = {
	name: "API deck",
	slides: [
		{ title: "Hello", subtitle: "From the API" },
		{ title: "Points", items: ["One", "Two", "Three"] },
		{ title: "Hidden", text: "Not shown by default", hidden: true },
	],
};
const png = (bytes) => bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47;
const text = (bytes) => new TextDecoder().decode(bytes);
const zipNames = (bytes) => {
	const buffer = Buffer.from(bytes);
	let end = buffer.length - 22;
	while (end >= 0 && buffer.readUInt32LE(end) !== 0x06054b50) end--;
	const names = [];
	let offset = buffer.readUInt32LE(end + 16);
	for (let index = buffer.readUInt16LE(end + 10); index > 0; index--) {
		const length = buffer.readUInt16LE(offset + 28);
		names.push(buffer.toString("utf8", offset + 46, offset + 46 + length));
		offset += 46 + length + buffer.readUInt16LE(offset + 30) + buffer.readUInt16LE(offset + 32);
	}
	return names;
};
const fails = async (promise, ErrorClass, code) => {
	try {
		await promise;
	} catch (error) {
		assert.ok(error instanceof ErrorClass, `expected ${ErrorClass.name}, got ${error?.name}: ${error?.message}`);
		assert.equal(error.code, code, error.message);
		return error;
	}
	assert.fail(`expected ${ErrorClass.name} ${code}`);
};

describe("the entry", () => {
	test("exports the API through the package exports map and nothing else of the build", () => {
		assert.deepEqual(
			Object.keys(api).sort(),
			["OPFApiError", "OPFExportError", "OPFImportError", "OPFValidationError", "assertValid", "defaultCatalog", "exportDeck", "importDeck", "readDeck", "validate", "writeDeck"],
		);
		const manifest = JSON.parse(readFileSync(path.join(cliRoot, "package.json"), "utf8"));
		assert.equal(manifest.dependencies["@openpresentation/opf"], "^0.16.0", "core is a regular dependency");
		assert.equal(manifest.peerDependenciesMeta["@openpresentation/opf-render"].optional, true);
		assert.equal(manifest.peerDependenciesMeta["@openpresentation/opf-pptx"].optional, true);
		assert.deepEqual(Object.keys(manifest.exports), ["./api", "./package.json"]);
	});

	test("runs on one core: the re-exports are core's own and the build holds no copy of it", async () => {
		assert.equal(api.readDeck, core.readDeck);
		assert.equal(api.writeDeck, core.writeDeck);
		assert.equal(api.validate, core.validate);
		assert.equal(api.assertValid, core.assertValid);
		assert.equal(api.OPFValidationError, core.OPFValidationError);
		assert.equal(api.defaultCatalog, defaultCatalog);
		// An error core throws through the API is the class an application that imports core directly catches.
		assert.throws(
			() => api.assertValid({ slides: 42 }, { only: ["format"] }),
			(error) => error instanceof core.OPFValidationError && error.report.valid === false,
		);
		// Neither entry nor shared chunk bundles core: they import it.
		for (const file of (await readdir(dist)).filter((name) => name.endsWith(".js"))) {
			const source = await readFile(path.join(dist, file), "utf8");
			assert.ok(!/class OPFValidationError\b/.test(source), `${file} holds a copy of core`);
			assert.ok(!/class OPFVariableError\b/.test(source), `${file} holds a copy of core`);
		}
		assert.match(await readFile(path.join(dist, "api.js"), "utf8"), /from "@openpresentation\/opf"/);
		// The version the command reports is the installed core's.
		const run = spawnSync(process.execPath, [path.join(dist, "index.js"), "--version"], { encoding: "utf8" });
		assert.equal(JSON.parse(run.stdout).opf, createRequire(import.meta.url)("@openpresentation/opf/package.json").version);
	});

	test("the library entry is not an executable and the command still is", async () => {
		assert.ok(!(await readFile(path.join(dist, "api.js"), "utf8")).startsWith("#!"));
		assert.ok((await readFile(path.join(dist, "index.js"), "utf8")).startsWith("#!/usr/bin/env node"));
	});
});

describe("readDeck", () => {
	test("reads the same deck from JSON, YAML and Markdown text, named by format or by file name", () => {
		const slides = [{ title: "One", items: ["a", "b"] }, { title: "Two", text: "Body" }];
		const source = { name: "Three ways", slides };
		const json = api.writeDeck(source, { format: "json" });
		const yaml = api.writeDeck(source, { format: "yaml" });
		const markdown = api.writeDeck(source, { format: "markdown" });
		for (const [format, body, filename] of [["json", json, "deck.opf.json"], ["yaml", yaml, "deck.opf.yaml"], ["markdown", markdown, "deck.opf.md"]]) {
			for (const read of [api.readDeck(body, { format }), api.readDeck(body, { filename })]) {
				assert.equal(read.format, format);
				assert.equal(read.valid, true, JSON.stringify(read.findings));
				assert.deepEqual(read.presentation, source);
			}
		}
	});

	test("locates a syntax error instead of throwing", () => {
		const read = api.readDeck("slides: [\n", { filename: "broken.opf.yaml" });
		assert.equal(read.valid, false);
		assert.ok(read.findings.some((found) => found.severity === "error" && found.location?.line >= 1));
	});
});

describe("exportDeck", { skip }, () => {
	test("draws a PDF, with selectable text, from the bundled fonts", async () => {
		const out = await api.exportDeck(deck, { format: "pdf" });
		assert.equal(out.files.length, 1);
		assert.equal(out.files[0].name, "API-deck.pdf");
		assert.equal(out.files[0].type, "application/pdf");
		assert.equal(text(out.files[0].bytes.subarray(0, 5)), "%PDF-");
		assert.equal(out.files[0].pages, 2, "the hidden slide is not drawn");
		assert.deepEqual(out.skippedHidden, [3]);
		assert.equal(out.pdf.mode, "vector");
		assert.equal(out.fonts.pack, "office");
		assert.equal(out.renderer.package, "@openpresentation/opf-render");
		assert.ok(Array.isArray(out.findings));
		assert.equal((await api.exportDeck(deck, { format: "pdf", includeHidden: true })).files[0].pages, 3);
	});

	test("draws one PNG per slide, or a zip, at a scale", async () => {
		const out = await api.exportDeck(deck, { format: "png", scale: 0.5 });
		assert.deepEqual(out.files.map((file) => file.name), ["API-deck-001.png", "API-deck-002.png"]);
		for (const file of out.files) {
			assert.ok(png(file.bytes));
			assert.equal(file.type, "image/png");
			assert.equal(file.width, 640);
			assert.equal(file.height, 360);
		}
		assert.deepEqual(out.files.map((file) => file.slide), [1, 2]);
		const zipped = await api.exportDeck(deck, { format: "png", slides: "2", zip: true });
		assert.equal(zipped.files.length, 1);
		assert.equal(zipped.files[0].name, "API-deck.zip");
		assert.equal(zipped.files[0].type, "application/zip");
		assert.deepEqual(zipNames(zipped.files[0].bytes), ["API-deck-002.png"]);
		assert.deepEqual(zipped.files[0].entries, ["API-deck-002.png"]);
	});

	test("draws one SVG per slide, naming slides by array or selection", async () => {
		const out = await api.exportDeck(deck, { format: "svg", slides: [1, 3] });
		assert.deepEqual(out.files.map((file) => file.name), ["API-deck-001.svg", "API-deck-003.svg"]);
		assert.match(text(out.files[0].bytes), /^<svg\b/);
		assert.match(text(out.files[0].bytes), /From the API/);
		assert.equal(out.files[0].type, "image/svg+xml");
		const none = await api.exportDeck(deck, { format: "svg", svgFonts: "none", slides: "1-2" });
		assert.ok(none.files[0].bytes.length < out.files[0].bytes.length, "svgFonts none embeds no faces");
	});

	test("writes a PPTX that importDeck reads back", async () => {
		const out = await api.exportDeck(deck, { format: "pptx" });
		assert.equal(out.files.length, 1);
		assert.equal(out.files[0].name, "API-deck.pptx");
		assert.equal(out.files[0].type, "application/vnd.openxmlformats-officedocument.presentationml.presentation");
		assert.equal(out.files[0].bytes[0], 0x50);
		assert.ok(zipNames(out.files[0].bytes).includes("ppt/presentation.xml"));
		assert.equal(out.pptx.package, "@openpresentation/opf-pptx");
		// importDeck
		const back = await api.importDeck(out.files[0].bytes);
		assert.equal(back.presentation.slides.length, 3);
		assert.equal(back.presentation.slides[0].title, "Hello");
		assert.equal(core.validate(back.presentation, { only: ["format"] }).valid, true);
		assert.equal(back.pptx.package, "@openpresentation/opf-pptx");
		assert.ok(Array.isArray(back.findings));
		assert.equal(back.signals, undefined);
		const withSignals = await api.importDeck(new Uint8Array(out.files[0].bytes).buffer, { signals: true });
		assert.equal(typeof withSignals.signals.version, "number");
	});

	test("is deterministic: the same presentation gives the same bytes, with no clock", async () => {
		for (const format of ["pdf", "png", "svg", "pptx"]) {
			const first = await api.exportDeck(deck, { format });
			const second = await api.exportDeck(structuredClone(deck), { format });
			assert.deepEqual(first.files.map((file) => Buffer.from(file.bytes).toString("base64")), second.files.map((file) => Buffer.from(file.bytes).toString("base64")), format);
		}
		const dated = { design: { footer: { right: { date: true } } }, slides: [{ title: "Today" }] };
		const unset = await api.exportDeck(dated, { format: "svg" });
		assert.ok(unset.findings.some((found) => /host-supplied ISO date/.test(found.message)), "without date a date field is reported, never read from a clock");
		const set = await api.exportDeck(dated, { format: "svg", date: "2026-02-03" });
		assert.ok(!set.findings.some((found) => /host-supplied ISO date/.test(found.message)));
	});

	test("takes catalogs, font directories and a prepared fonts handle", async () => {
		const withCatalog = await api.exportDeck({ slides: [{ title: "Catalog", layout: "two-column", left: { text: "a" }, right: { text: "b" } }] }, { format: "svg", catalogs: [api.defaultCatalog] });
		assert.equal(withCatalog.files.length, 1);
		await fails(api.exportDeck(deck, { format: "svg", fontDirs: [path.join(temp, "no-fonts")] }), api.OPFExportError, "invalid-option");
		const { loadFonts } = await import(pathToFileURL(createRequire(path.join(cliRoot, "package.json")).resolve("@openpresentation/opf-render/fonts-node")).href);
		const handle = await loadFonts({ pack: "office", substitutionPolicy: "visual", presentation: deck });
		const reused = await api.exportDeck(deck, { format: "svg", fonts: handle, slides: "1" });
		const plain = await api.exportDeck(deck, { format: "svg", slides: "1" });
		assert.equal(text(reused.files[0].bytes), text(plain.files[0].bytes));
	});

	test("reads local images only from assetDir", async () => {
		const pixel = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGP4z8DwHwAFAAH/q842iQAAAABJRU5ErkJggg==", "base64");
		await mkdir(path.join(temp, "assets"), { recursive: true });
		await writeFile(path.join(temp, "assets", "dot.png"), pixel);
		const picture = { slides: [{ title: "Picture", image: { src: "dot.png", alt: "A dot" } }] };
		const without = await api.exportDeck(picture, { format: "svg" });
		assert.ok(without.findings.some((found) => found.ruleId === "cli/asset-blocked" || found.ruleId === "render/unresolved-asset"), JSON.stringify(without.findings.map((f) => f.ruleId)));
		const withDirectory = await api.exportDeck(picture, { format: "svg", assetDir: path.join(temp, "assets") });
		assert.ok(!withDirectory.findings.some((found) => found.ruleId === "cli/asset-blocked" || found.ruleId === "render/unresolved-asset"));
		assert.match(text(withDirectory.files[0].bytes), /data:image\/png;base64,/);
		const error = await fails(api.exportDeck(picture, { format: "pptx" }), api.OPFExportError, "export-failed");
		assert.ok(error.findings.some((found) => found.ruleId === "pptx/asset-unresolved"), "an unreadable local image stops a PPTX export and the finding says why");
	});

	test("throws typed errors for options, an invalid presentation and a selection that names no slide", async () => {
		await fails(api.exportDeck(deck, { format: "gif" }), api.OPFExportError, "invalid-option");
		await fails(api.exportDeck(deck, {}), api.OPFExportError, "invalid-option");
		await fails(api.exportDeck(deck, { format: "svg", pdfMode: "raster" }), api.OPFExportError, "invalid-option");
		await fails(api.exportDeck(deck, { format: "png", scale: 9 }), api.OPFExportError, "invalid-option");
		await fails(api.exportDeck(deck, { format: "svg", date: "2026-02-30" }), api.OPFExportError, "invalid-option");
		await fails(api.exportDeck(deck, { format: "pptx", slides: "1" }), api.OPFExportError, "invalid-option");
		await fails(api.exportDeck(deck, { format: "svg", slides: "9" }), api.OPFExportError, "invalid-option");
		await fails(api.exportDeck(JSON.stringify(deck), { format: "svg" }), api.OPFExportError, "invalid-option");
		const invalid = await fails(api.exportDeck({ slides: 42 }, { format: "svg" }), api.OPFExportError, "invalid-presentation");
		assert.ok(invalid.findings.some((found) => found.severity === "error"));
		await fails(api.exportDeck({ slides: [{ title: "Only", hidden: true }] }, { format: "png" }), api.OPFExportError, "all-slides-hidden");
	});
});

describe("importDeck", { skip }, () => {
	test("throws typed errors for input that is not a PowerPoint file", async () => {
		await fails(api.importDeck("not bytes"), api.OPFImportError, "invalid-option");
		const error = await fails(api.importDeck(new TextEncoder().encode("this is not a zip")), api.OPFImportError, "import-failed");
		assert.ok(error.findings.length > 0 && error.findings.every((found) => typeof found.ruleId === "string"));
	});
});

// A copy of the build in a tree with core and no peer above it, then with a peer that is too old and one that does not load.

describe("the peers", () => {
	const isolated = path.join(temp, "isolated");
	const script = `
		import { exportDeck, importDeck } from "@openpresentation/cli/api-copy";
		const out = {};
		for (const [name, call] of [["export", () => exportDeck({ slides: [{ title: "x" }] }, { format: process.argv[2] ?? "svg" })], ["import", () => importDeck(new Uint8Array(4))]]) {
			try { await call(); out[name] = "no error"; } catch (error) { out[name] = { name: error.name, code: error.code, package: error.details.package, range: error.details.range, message: error.message }; }
		}
		process.stdout.write(JSON.stringify(out));
	`;
	const ready = (async () => {
		await cp(dist, path.join(isolated, "dist"), { recursive: true });
		await mkdir(path.join(isolated, "node_modules/@openpresentation"), { recursive: true });
		await symlink(path.dirname(createRequire(path.join(dist, "api.js")).resolve("@openpresentation/opf/package.json")), path.join(isolated, "node_modules/@openpresentation/opf"), "junction");
		await writeFile(path.join(isolated, "run.mjs"), script.replace('"@openpresentation/cli/api-copy"', JSON.stringify("./dist/api.js")));
	})();
	const attempt = async (...args) => {
		await ready;
		const result = spawnSync(process.execPath, [path.join(isolated, "run.mjs"), ...args], { cwd: isolated, encoding: "utf8" });
		assert.equal(result.status, 0, result.stderr);
		return JSON.parse(result.stdout);
	};

	test("a missing peer throws a typed error that carries the install command", async () => {
		const out = await attempt("pdf");
		assert.equal(out.export.name, "OPFExportError");
		assert.equal(out.export.code, "peer-not-installed");
		assert.equal(out.export.package, "@openpresentation/opf-render");
		assert.match(out.export.range, /^\^0\.\d+\.\d+$/);
		assert.match(out.export.message, /npm install @openpresentation\/opf-render@/);
		assert.equal(out.import.name, "OPFImportError");
		assert.equal(out.import.code, "peer-not-installed");
		assert.equal(out.import.package, "@openpresentation/opf-pptx");
	});

	test("a peer that is too old, or does not load, is told apart from a missing one", async () => {
		await ready;
		const peer = path.join(isolated, "node_modules/@openpresentation/opf-render");
		await mkdir(peer, { recursive: true });
		await writeFile(path.join(peer, "package.json"), JSON.stringify({ name: "@openpresentation/opf-render", version: "0.1.0", type: "module", exports: { ".": "./index.js", "./fonts-node": "./fonts.js", "./package.json": "./package.json" } }));
		await writeFile(path.join(peer, "index.js"), "export function renderSlideSvg() {}\n");
		await writeFile(path.join(peer, "fonts.js"), "export {};\n");
		const old = await attempt("pdf");
		assert.equal(old.export.code, "peer-too-old");
		assert.match(old.export.message, /opf-render@0\.1\.0 does not provide svgToPng, svgToPdf/);
		await writeFile(path.join(peer, "index.js"), 'throw new Error("boom");\n');
		const broken = await attempt("pdf");
		assert.equal(broken.export.code, "peer-load-failed");
		assert.match(broken.export.message, /boom/);
	});
});
