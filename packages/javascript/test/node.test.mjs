// The file API of `@openpresentation/opf` under the `node` condition (RR-62, RR-70): `convert`, `open` and `save` through the workspace's opf-render and opf-pptx (devDependencies),
// the file naming, atomic writes, the typed errors, the fonts prepared once per process, and a missing peer (a copy of core in a
// tree with no peer above it). Nothing in this file may touch the network: every socket connection and fetch is refused and
// recorded, and the last test asserts that none happened.
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, mkdtemp, readFile, readdir, rm, stat, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import net from "node:net";
import { tmpdir } from "node:os";
import path from "node:path";
import { after, describe, test } from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";
import { installIsolatedCore } from "../../../scripts/isolated-core.mjs";
import { installStubPeers } from "../../../scripts/stub-peers.mjs";
import { cliPeerGate, report } from "../../../scripts/unreleased-gate.mjs";

// Zero network: refuse and record any connection or fetch made in this process.
const network = [];
const connect = net.Socket.prototype.connect;
net.Socket.prototype.connect = function (...args) {
  const target = args[0];
  if ((target && typeof target === "object" && target.path === undefined) || typeof target === "number") {
    network.push(JSON.stringify(target));
    throw new Error("The test refuses network access");
  }
  return connect.apply(this, args);
};
globalThis.fetch = async (input) => {
  network.push(String(input?.url ?? input));
  throw new Error("The test refuses network access");
};

// RR-70: the Node build is the root itself; `core` is the browser build, which shares every class and function but the file API.
const opf = await import("../dist/index.js");
const core = await import("../dist/browser.js");
const { defaultCatalog } = await import("../dist/catalog.js");
const here = path.dirname(fileURLToPath(import.meta.url));
// RR-74: the drawing tests run through the opf-render that core's devDependencies install. While that is not the 0.18 release core asks
// for (toSvg, toPng, toPdf), they wait on a pull request and merge-queue run (scripts/unreleased-gate.mjs); every other run fails.
// The tests with a stub renderer, the option checks and the missing-peer test always run.
const coreRoot = path.join(here, "..");
const skip = report(cliPeerGate({ cliRoot: coreRoot, executable: path.join(coreRoot, "dist", "index.js"), names: ["@openpresentation/opf-render"], subject: "@openpresentation/opf" })) ? false : "the optional renderer is not on npm at the version core asks for";
const temp = await mkdtemp(path.join(tmpdir(), "opf-node-test-"));
after(() => rm(temp, { recursive: true, force: true }));

const deck = {
  name: "Node deck",
  slides: [
    { title: "Hello", subtitle: "From the Node build" },
    { title: "Points", items: ["One", "Two", "Three"] },
    { title: "Third", text: "Body" },
    { title: "Hidden", text: "Not shown by default", hidden: true },
  ],
};
const PIXEL = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGP4z8DwHwAFAAH/q842iQAAAABJRU5ErkJggg==", "base64");
const isPng = (bytes) => bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47;
const isPdf = (bytes) => Buffer.from(bytes.subarray(0, 5)).toString() === "%PDF-";
const isZip = (bytes) => bytes[0] === 0x50 && bytes[1] === 0x4b;
const b64 = (files) => files.map((file) => Buffer.from(file.bytes).toString("base64"));
let counter = 0;
/** A fresh folder holding the deck as JSON, YAML and Markdown. */
async function folder(presentation = deck) {
  const dir = path.join(temp, `case-${++counter}`);
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, "deck.opf.json"), core.stringify(presentation, { format: "json" }));
  await writeFile(path.join(dir, "deck.opf.yaml"), core.stringify(presentation, { format: "yaml" }));
  await writeFile(path.join(dir, "deck.opf.md"), core.stringify(presentation, { format: "markdown" }));
  return dir;
}
const fails = async (promise, ErrorClass, code) => {
  try {
    await promise;
  } catch (error) {
    assert.ok(error instanceof ErrorClass, `expected ${ErrorClass.name}, got ${error?.name}: ${error?.message}`);
    if (code !== undefined) assert.equal(error.code, code, error.message);
    return error;
  }
  assert.fail(`expected ${ErrorClass.name} ${code ?? ""}`);
};

describe("the entry", () => {
  test("exports convert, open and save beside the rest of core, with one set of classes", () => {
    for (const name of ["convert", "open", "save", "validate", "parse", "stringify", "parseSlideSelection", "OPFValidationError", "OPFApiError", "OPFExportError", "OPFImportError"]) assert.ok(name in opf, name);
    // RR-75: the Node build's validate registers the default catalog when a call names none (node-verbs.test.mjs).
    assert.notEqual(opf.validate, core.validate);
    assert.equal(opf.parse, core.parse);
    assert.equal(opf.OPFValidationError, core.OPFValidationError);
    assert.ok(new opf.OPFExportError("x", "y") instanceof opf.OPFApiError);
    for (const gone of ["readDeck", "writeDeck", "exportDeck", "importDeck", "defaultCatalog"]) assert.equal(opf[gone], undefined, gone);
  });
});

describe("convert with an output path", () => {
  test("every pair: .opf.md to .pdf, .pptx and per-slide .png; .pptx to .opf.yaml; .opf.json to .opf.md", { skip }, async () => {
    const dir = await folder();
    const pdf = await opf.convert(path.join(dir, "deck.opf.md"), path.join(dir, "deck.pdf"));
    assert.equal(pdf.files.length, 1);
    assert.equal(pdf.files[0].path, path.join(dir, "deck.pdf"));
    assert.equal(pdf.files[0].type, "application/pdf");
    assert.equal(pdf.files[0].pages, 3, "the hidden slide is skipped");
    assert.ok(isPdf(await readFile(path.join(dir, "deck.pdf"))));
    assert.ok(Array.isArray(pdf.findings));

    await opf.convert(path.join(dir, "deck.opf.md"), path.join(dir, "deck.pptx"));
    assert.ok(isZip(await readFile(path.join(dir, "deck.pptx"))));

    const png = await opf.convert(path.join(dir, "deck.opf.md"), path.join(dir, "slides", "deck.png"));
    assert.deepEqual(png.files.map((file) => path.basename(file.path)), ["deck-1.png", "deck-2.png", "deck-3.png"]);
    assert.deepEqual((await readdir(path.join(dir, "slides"))).sort(), ["deck-1.png", "deck-2.png", "deck-3.png"], "the parent folder is created");
    assert.deepEqual(png.files.map((file) => file.slide), [1, 2, 3]);
    for (const file of png.files) assert.ok(isPng(await readFile(file.path)));

    const imported = await opf.convert(path.join(dir, "deck.pptx"), path.join(dir, "back.opf.yaml"));
    assert.equal(imported.files[0].type, "application/yaml");
    const back = core.parse(await readFile(path.join(dir, "back.opf.yaml"), "utf8"), { filename: "back.opf.yaml", catalogs: [defaultCatalog] });
    assert.equal(back.slides.length, 4);
    assert.equal(back.slides[0].title, "Hello");

    const markdown = await opf.convert(path.join(dir, "deck.opf.json"), path.join(dir, "out.opf.md"));
    assert.equal(markdown.files[0].type, "text/markdown");
    assert.deepEqual(core.parse(await readFile(path.join(dir, "out.opf.md"), "utf8"), { format: "markdown" }), deck);
  });

  test("rare options go in the third argument: slides and scale for PNG", { skip }, async () => {
    const dir = await folder();
    const out = await opf.convert(path.join(dir, "deck.opf.md"), path.join(dir, "deck.png"), { slides: "1-3", scale: 2 });
    assert.deepEqual(out.files.map((file) => path.basename(file.path)), ["deck-1.png", "deck-2.png", "deck-3.png"]);
    assert.deepEqual([out.files[0].width, out.files[0].height], [2560, 1440]);
    const hidden = await opf.convert(path.join(dir, "deck.opf.md"), path.join(dir, "all.svg"), { includeHidden: true });
    assert.deepEqual(hidden.files.map((file) => path.basename(file.path)), ["all-1.svg", "all-2.svg", "all-3.svg", "all-4.svg"]);
  });

  test("one selected slide, or a one-slide deck, is written to the output name itself", { skip }, async () => {
    const dir = await folder({ name: "One", slides: [{ title: "Only" }] });
    const one = await opf.convert(path.join(dir, "deck.opf.json"), path.join(dir, "cover.png"));
    assert.deepEqual(one.files.map((file) => path.basename(file.path)), ["cover.png"]);
    assert.ok(isPng(await readFile(path.join(dir, "cover.png"))));
    const many = await folder();
    const picked = await opf.convert(path.join(many, "deck.opf.json"), path.join(many, "second.svg"), { slides: "2" });
    assert.deepEqual(picked.files.map((file) => [path.basename(file.path), file.slide]), [["second.svg", 2]]);
  });

  test("a .zip output is one archive of the slides, PNG unless format says svg", { skip }, async () => {
    const dir = await folder();
    const zip = await opf.convert(path.join(dir, "deck.opf.json"), path.join(dir, "slides.zip"));
    assert.equal(zip.files.length, 1);
    assert.equal(zip.files[0].type, "application/zip");
    assert.deepEqual(zip.files[0].entries, ["slides-1.png", "slides-2.png", "slides-3.png"]);
    assert.ok(isZip(await readFile(path.join(dir, "slides.zip"))));
    const svg = await opf.convert(path.join(dir, "deck.opf.json"), path.join(dir, "vector.zip"), { format: "svg" });
    assert.deepEqual(svg.files[0].entries, ["vector-1.svg", "vector-2.svg", "vector-3.svg"]);
    await fails(opf.convert(path.join(dir, "deck.opf.json"), path.join(dir, "bad.zip"), { format: "pdf" }), opf.OPFApiError, "invalid-option");
    await fails(opf.convert(path.join(dir, "deck.opf.json"), path.join(dir, "bad.png"), { zip: true }), opf.OPFApiError, "invalid-option");
  });

  test(".pptx to .pdf imports, then exports, and returns the findings of both steps", { skip }, async () => {
    const dir = await folder();
    await opf.convert(path.join(dir, "deck.opf.json"), path.join(dir, "deck.pptx"));
    const out = await opf.convert(path.join(dir, "deck.pptx"), path.join(dir, "from-pptx.pdf"));
    assert.ok(isPdf(await readFile(path.join(dir, "from-pptx.pdf"))));
    assert.ok(Array.isArray(out.findings));
    // The import step's diagnostics carry the import/ prefix, the export step's render/, pdf/ or fonts/.
    assert.ok(out.findings.every((found) => /^[a-z-]+\//.test(found.ruleId)));
    const again = await opf.convert(path.join(dir, "deck.pptx"), path.join(dir, "again.pptx"));
    assert.ok(isZip(again.files[0].bytes));
    const signals = await opf.convert(path.join(dir, "deck.pptx"), path.join(dir, "signals.opf.json"), { signals: true });
    assert.equal(typeof signals.signals.version, "number");
  });

  test("local images resolve next to the input file, from any working directory; assetDir overrides", { skip }, async () => {
    const dir = await folder({ name: "Pictures", slides: [{ title: "Picture", image: { src: "img/x.png", alt: "A dot" } }] });
    await mkdir(path.join(dir, "img"));
    await writeFile(path.join(dir, "img", "x.png"), PIXEL);
    const elsewhere = await mkdtemp(path.join(temp, "cwd-"));
    const before = process.cwd();
    process.chdir(elsewhere);
    try {
      const out = await opf.convert(path.relative(elsewhere, path.join(dir, "deck.opf.json")), path.join(dir, "picture.svg"));
      assert.ok(!out.findings.some((found) => /asset-blocked|unresolved-asset/.test(found.ruleId)), JSON.stringify(out.findings.map((found) => found.ruleId)));
      assert.match(Buffer.from(out.files[0].bytes).toString(), /data:image\/png;base64,/);
      const pptx = await opf.convert(path.join(dir, "deck.opf.json"), path.join(dir, "picture.pptx"));
      assert.ok(isZip(pptx.files[0].bytes), "the PPTX export reads the picture too");
      const blocked = await opf.convert(path.join(dir, "deck.opf.json"), path.join(dir, "blocked.svg"), { assetDir: elsewhere });
      assert.ok(blocked.findings.some((found) => /asset-blocked|unresolved-asset/.test(found.ruleId)), "assetDir replaces the input's folder");
    } finally {
      process.chdir(before);
    }
  });

  test("an existing output is replaced atomically by default; the same convert runs twice; overwrite: false refuses", { skip }, async () => {
    const dir = await folder();
    const target = path.join(dir, "deck.opf.md");
    const changed = { ...deck, name: "Changed" };
    await writeFile(path.join(dir, "changed.opf.json"), JSON.stringify(changed));
    await opf.convert(path.join(dir, "changed.opf.json"), target);
    assert.equal(core.parse(await readFile(target, "utf8"), { format: "markdown" }).name, "Changed");
    await opf.convert(path.join(dir, "deck.opf.json"), path.join(dir, "deck.pdf"));
    const again = await opf.convert(path.join(dir, "deck.opf.json"), path.join(dir, "deck.pdf"));
    assert.ok(isPdf(await readFile(path.join(dir, "deck.pdf"))));
    assert.equal(again.files[0].path, path.join(dir, "deck.pdf"));
    assert.deepEqual((await readdir(dir)).filter((name) => name.endsWith(".tmp")), []);
    const error = await fails(opf.convert(path.join(dir, "deck.opf.json"), target, { overwrite: false }), opf.OPFApiError, "output-exists");
    assert.equal(error.details.path, path.resolve(target));
    assert.equal(core.parse(await readFile(target, "utf8"), { format: "markdown" }).name, "Changed", "a refused output is left as it was");
    // A directory where a file is expected is never replaced, whatever overwrite says.
    await mkdir(path.join(dir, "folder.pdf"));
    await fails(opf.convert(path.join(dir, "deck.opf.json"), path.join(dir, "folder.pdf")), opf.OPFApiError, "output-not-file");
  });

  test("nothing is written when any output fails: one existing slide file stops all of them", { skip }, async () => {
    const dir = await folder();
    await mkdir(path.join(dir, "slides"));
    await writeFile(path.join(dir, "slides", "deck-2.png"), "keep");
    await fails(opf.convert(path.join(dir, "deck.opf.json"), path.join(dir, "slides", "deck.png"), { overwrite: false }), opf.OPFApiError, "output-exists");
    assert.deepEqual(await readdir(path.join(dir, "slides")), ["deck-2.png"]);
    assert.equal(await readFile(path.join(dir, "slides", "deck-2.png"), "utf8"), "keep");
    // An invalid deck writes nothing either.
    await writeFile(path.join(dir, "invalid.opf.json"), JSON.stringify({ slides: 42 }));
    const invalid = await fails(opf.convert(path.join(dir, "invalid.opf.json"), path.join(dir, "invalid.pdf")), opf.OPFExportError, "invalid-presentation");
    assert.ok(invalid.findings.some((found) => found.severity === "error" && found.location?.line >= 1), "the findings are located in the file");
    assert.equal(existsSync(path.join(dir, "invalid.pdf")), false);
  });

  test("unknown extensions, a missing input and options that do not fit the pair reject with typed errors", { skip }, async () => {
    const dir = await folder();
    await writeFile(path.join(dir, "notes.txt"), "x");
    await fails(opf.convert(path.join(dir, "notes.txt"), path.join(dir, "x.pdf")), opf.OPFApiError, "invalid-option");
    await fails(opf.convert(path.join(dir, "deck.md"), path.join(dir, "x.pdf")), opf.OPFApiError, "invalid-option");
    const output = await fails(opf.convert(path.join(dir, "deck.opf.json"), path.join(dir, "x.docx")), opf.OPFApiError, "invalid-option");
    assert.match(output.message, /\.pdf, \.pptx, \.png, \.svg, \.zip, \.opf\.md, \.yaml, \.yml or \.json/);
    await fails(opf.convert(path.join(dir, "deck.opf.json"), path.join(dir, "x.md")), opf.OPFApiError, "invalid-option");
    const missing = await fails(opf.convert(path.join(dir, "absent.opf.json"), path.join(dir, "x.pdf")), opf.OPFApiError, "input-not-found");
    assert.equal(missing.details.path, path.join(dir, "absent.opf.json"));
    await fails(opf.convert(path.join(dir, "deck.opf.json"), path.join(dir, "x.svg"), { raster: true }), opf.OPFApiError, "invalid-option");
    await fails(opf.convert(path.join(dir, "deck.opf.json"), path.join(dir, "x.pptx"), { slides: "1" }), opf.OPFApiError, "invalid-option");
    await fails(opf.convert(path.join(dir, "deck.opf.json"), path.join(dir, "x.opf.md"), { scale: 2 }), opf.OPFApiError, "invalid-option");
    await fails(opf.convert(path.join(dir, "deck.opf.json"), path.join(dir, "x.pdf"), { signals: true }), opf.OPFApiError, "invalid-option");
    await fails(opf.convert(path.join(dir, "deck.opf.json"), path.join(dir, "x.pdf"), { format: "png" }), opf.OPFApiError, "invalid-option");
    await fails(opf.convert(path.join(dir, "deck.opf.json"), path.join(dir, "x.png"), { scale: 9 }), opf.OPFApiError, "invalid-option");
    await fails(opf.convert(path.join(dir, "deck.opf.json"), path.join(dir, "x.png"), { slides: "9" }), opf.OPFApiError, "invalid-option");
    await fails(opf.convert(path.join(dir, "deck.opf.json"), path.join(dir, "x.svg"), { date: "2026-02-30" }), opf.OPFApiError, "invalid-option");
    await fails(opf.convert(path.join(dir, "deck.opf.json")), opf.OPFApiError, "invalid-option");
    await fails(opf.convert(42, path.join(dir, "x.pdf")), opf.OPFApiError, "invalid-option");
    assert.deepEqual((await readdir(dir)).filter((name) => name.startsWith("x.")), [], "nothing was written");
  });
});

// RR-74 (core part): the engine calls opf-render's 0.18 API (toSvg, toPng, toPdf) and passes the renamed options through. A stub
// renderer and a stub PowerPoint peer in a tree of their own record every call, so this runs whatever opf-render is installed.
describe("the renderer's 0.18 API, through stub peers", () => {
  const runner = [
    'import * as opf from "@openpresentation/opf";',
    'import { readFileSync, writeFileSync } from "node:fs";',
    'const cases = JSON.parse(readFileSync("cases.json", "utf8"));',
    'const deck = JSON.parse(readFileSync("deck.opf.json", "utf8"));',
    "const results = [];",
    "for (const item of cases) {",
    '  writeFileSync("log.jsonl", "");',
    "  let error;",
    "  try { await opf.convert(deck, item.options); } catch (failure) { error = { code: failure.code, message: failure.message }; }",
    '  results.push({ name: item.name, error, calls: readFileSync("log.jsonl", "utf8").split("\\n").filter(Boolean).map((line) => JSON.parse(line)) });',
    "}",
    "process.stdout.write(JSON.stringify(results));",
  ].join("\n");

  /** Run every case in a copy of core whose opf-render and opf-pptx are the stubs; returns the calls each case made. */
  async function stubbed(cases) {
    const isolated = await mkdtemp(path.join(temp, "stub-"));
    await installIsolatedCore(path.join(isolated, "node_modules"));
    await installStubPeers(path.join(isolated, "node_modules"));
    await mkdir(path.join(isolated, "fonts"));
    await writeFile(path.join(isolated, "fonts", "a.ttf"), "not a font; the stub never reads it");
    await writeFile(path.join(isolated, "deck.opf.json"), JSON.stringify({ name: "Stub deck", slides: [{ title: "One" }, { title: "Two" }] }));
    await writeFile(path.join(isolated, "cases.json"), JSON.stringify(cases));
    await writeFile(path.join(isolated, "run.mjs"), runner);
    const result = spawnSync(process.execPath, ["run.mjs"], { cwd: isolated, encoding: "utf8" });
    assert.equal(result.status, 0, `${result.error ?? ""} ${result.signal ?? ""} ${result.stderr}`);
    return Object.fromEntries(JSON.parse(result.stdout).map((item) => [item.name, item]));
  }
  const callsOf = (result, call) => result.calls.filter((item) => item.call === call);

  test("toSvg takes the slide number counted from 1; text picks what the SVG carries; PNG and PDF go through toPng and toPdf", async () => {
    const out = await stubbed([
      { name: "svg", options: { format: "svg" } },
      { name: "system", options: { format: "svg", text: "system" } },
      { name: "paths", options: { format: "svg", text: "paths" } },
      { name: "png", options: { format: "png", scale: 2 } },
      { name: "pdf", options: { format: "pdf" } },
      { name: "raster", options: { format: "pdf", raster: true } },
      { name: "folder", options: { format: "svg", fonts: ["fonts"] } },
    ]);
    for (const [name, result] of Object.entries(out)) assert.equal(result.error, undefined, `${name}: ${result.error?.message}`);

    const svg = callsOf(out.svg, "toSvg");
    assert.deepEqual(svg.map((item) => item.args[0]), [1, 2], "one call per slide, slides counted from 1");
    assert.equal(svg[0].args[1].text, undefined, "the default is the renderer's own: the faces the slide uses");
    assert.deepEqual(svg[0].args[1].fonts.embeddedFonts.map((face) => face.embed), ["used"], "faces are marked to embed only when the slide uses them");
    assert.equal(callsOf(out.svg, "loadFonts")[0].args[0].embedScriptFonts, true);

    const system = callsOf(out.system, "toSvg")[0].args[1];
    assert.equal(system.text, "system");
    assert.deepEqual(system.fonts.embeddedFonts, [], "system text embeds no face");
    assert.equal(callsOf(out.system, "loadFonts")[0].args[0].embedScriptFonts, false);

    const paths = callsOf(out.paths, "toSvg")[0].args[1];
    assert.equal(paths.text, "paths", "text: paths reaches the renderer");
    assert.equal(paths.fonts.stub, true, "the renderer gets the whole fonts handle it draws outlines from");
    assert.equal(callsOf(out.paths, "loadFonts")[0].args[0].embedScriptFonts, false, "no embedded-face bookkeeping for outlines");

    assert.equal(callsOf(out.png, "toSvg").length, 2);
    assert.deepEqual(callsOf(out.png, "toPng").map((item) => item.args[0].scale), [2, 2]);
    assert.equal(callsOf(out.pdf, "toPdf")[0].args[0], 2, "the SVG slides go to toPdf, a page each");
    assert.equal("raster" in callsOf(out.pdf, "toPdf")[0].args[1], false, "vector is the renderer's default");
    assert.equal(callsOf(out.raster, "toPdf")[0].args[1].raster, true);
    assert.equal("mode" in callsOf(out.raster, "toPdf")[0].args[1], false);
    assert.match(callsOf(out.folder, "loadFonts")[0].args[0].faces[0].path, /fonts[\\/]a\.ttf$/, "a folder in fonts loads its font files");
  });

  test("the PowerPoint peer still gets chartex and imageFormat: charts picture is its fallback", async () => {
    const out = await stubbed([
      { name: "picture", options: { format: "pptx", charts: "picture", images: "preserve" } },
      { name: "plain", options: { format: "pptx" } },
    ]);
    const picture = callsOf(out.picture, "toPptx")[0].args[0];
    assert.equal(picture.chartex, "fallback");
    assert.equal(picture.imageFormat, "preserve");
    const plain = callsOf(out.plain, "toPptx")[0].args[0];
    assert.equal("chartex" in plain || "imageFormat" in plain, false);
  });

  test("the 0.17 option names are refused with the new name", async () => {
    const out = await stubbed([
      { name: "svgFonts", options: { format: "svg", svgFonts: "none" } },
      { name: "pdfMode", options: { format: "pdf", pdfMode: "raster" } },
      { name: "chartex", options: { format: "pptx", chartex: "native" } },
      { name: "imageFormat", options: { format: "pptx", imageFormat: "preserve" } },
      { name: "fontDirs", options: { format: "svg", fontDirs: ["fonts"] } },
      { name: "filename", options: { format: "svg", filename: "x" } },
    ]);
    const replacements = { svgFonts: "text", pdfMode: "raster", chartex: "charts", imageFormat: "images", fontDirs: "fonts", filename: "name" };
    for (const [name, replacement] of Object.entries(replacements)) {
      assert.equal(out[name].error?.code, "invalid-option", name);
      assert.match(out[name].error.message, new RegExp(`^${name} was renamed ${replacement}\\b`));
      assert.deepEqual(out[name].calls, [], `${name}: nothing was drawn`);
    }
  });
});

describe("the options of RR-74", () => {
  test("each applies to its format and is checked before any peer loads", async () => {
    const dir = await folder();
    const deckPath = path.join(dir, "deck.opf.json");
    for (const [output, options] of [
      ["x.pdf", { text: "paths" }],
      ["x.svg", { raster: true }],
      ["x.svg", { charts: "native" }],
      ["x.pdf", { images: "preserve" }],
      ["x.svg", { text: "bold" }],
      ["x.pptx", { charts: "fallback" }],
      ["x.svg", { fonts: 42 }],
      ["x.svg", { raster: "yes" }],
    ]) await fails(opf.convert(deckPath, path.join(dir, output), options), opf.OPFApiError, "invalid-option");
    // zip and name are for output without a path: a path names the file, and a .zip path makes the archive.
    await fails(opf.convert(deckPath, path.join(dir, "x.zip"), { zip: true }), opf.OPFApiError, "invalid-option");
    await fails(opf.convert(deckPath, path.join(dir, "x.pdf"), { name: "other" }), opf.OPFApiError, "invalid-option");
    assert.deepEqual((await readdir(dir)).filter((name) => name.startsWith("x.")), [], "nothing was written");
  });

  test("name is the base name of the files returned without an output path, for a deck written as a deck too", async () => {
    const dir = await folder();
    const markdown = await opf.convert(path.join(dir, "deck.opf.json"), { format: "markdown", name: "renamed" });
    assert.equal(markdown.files[0].name, "renamed.opf.md");
  });
});

describe("convert without an output path", () => {
  test("returns the files with their names and bytes and writes nothing", { skip }, async () => {
    const dir = await folder();
    const before = (await readdir(dir)).sort();
    const pdf = await opf.convert(path.join(dir, "deck.opf.md"), { format: "pdf" });
    assert.equal(pdf.files[0].name, "Node-deck.pdf");
    assert.equal(pdf.files[0].path, undefined);
    assert.ok(isPdf(pdf.files[0].bytes));
    const pptx = await opf.convert(deck, { format: "pptx" });
    assert.equal(pptx.files[0].name, "Node-deck.pptx");
    const png = await opf.convert(deck, { format: "png", slides: [1, 3] });
    assert.deepEqual(png.files.map((file) => file.name), ["Node-deck-1.png", "Node-deck-3.png"]);
    const zip = await opf.convert(deck, { format: "svg", zip: true });
    assert.deepEqual([zip.files[0].name, zip.files[0].entries], ["Node-deck.zip", ["Node-deck-1.svg", "Node-deck-2.svg", "Node-deck-3.svg"]]);
    const yaml = await opf.convert(pptx.files[0].bytes, { format: "yaml" });
    assert.equal(yaml.files[0].name, "Node-deck.opf.yaml");
    assert.equal(core.parse(Buffer.from(yaml.files[0].bytes).toString(), { format: "yaml" }).slides.length, 4);
    const unnamed = await opf.convert(path.join(dir, "deck.opf.json"), { format: "markdown" });
    assert.equal(unnamed.files[0].name, "deck.opf.md");
    assert.deepEqual((await readdir(dir)).sort(), before);
    await fails(opf.convert(deck, {}), opf.OPFApiError, "invalid-option");
    await fails(opf.convert({ slides: 42 }, { format: "svg" }), opf.OPFExportError, "invalid-presentation");
  });

  test("is deterministic: the same deck gives the same bytes, with no clock", { skip }, async () => {
    for (const format of ["pdf", "png", "svg", "pptx"]) {
      const first = await opf.convert(deck, { format });
      const second = await opf.convert(structuredClone(deck), { format });
      assert.deepEqual(b64(first.files), b64(second.files), format);
    }
    const dated = { design: { footer: { right: { date: true } } }, slides: [{ title: "Today" }] };
    assert.ok((await opf.convert(dated, { format: "svg" })).findings.some((found) => /host-supplied ISO date/.test(found.message)));
    assert.ok(!(await opf.convert(dated, { format: "svg", date: "2026-02-03" })).findings.some((found) => /host-supplied ISO date/.test(found.message)));
  });
});

describe("open and save", () => {
  test("round trip in all three forms, returning the presentation itself", async () => {
    const dir = await folder();
    for (const name of ["deck.opf.json", "deck.opf.yaml", "deck.opf.md"]) {
      const opened = await opf.open(path.join(dir, name));
      assert.deepEqual(opened, deck, name);
      opened.slides.push({ title: "Q4" });
      for (const target of ["saved.opf.json", "saved.opf.yaml", "saved.opf.md"]) {
        const result = await opf.save(opened, path.join(dir, "out", target));
        assert.equal(result.path, path.join(dir, "out", target));
        assert.equal(result.format, { "saved.opf.json": "json", "saved.opf.yaml": "yaml", "saved.opf.md": "markdown" }[target]);
        assert.deepEqual(await opf.open(path.join(dir, "out", target)), opened, `${name} to ${target}`);
      }
    }
    // save replaces the file it names, atomically.
    await opf.save({ ...deck, name: "Replaced" }, path.join(dir, "deck.opf.md"));
    assert.equal((await opf.open(path.join(dir, "deck.opf.md"))).name, "Replaced");
    assert.deepEqual((await readdir(dir)).filter((name) => name.endsWith(".tmp")), []);
  });

  test("open imports a .pptx from a path or its bytes", { skip }, async () => {
    const dir = await folder();
    await opf.convert(path.join(dir, "deck.opf.json"), path.join(dir, "deck.pptx"));
    const fromPath = await opf.open(path.join(dir, "deck.pptx"));
    const fromBytes = await opf.open(await readFile(path.join(dir, "deck.pptx")));
    assert.equal(fromPath.slides.length, 4);
    assert.deepEqual(fromBytes, fromPath);
    await fails(opf.open(new TextEncoder().encode("this is not a zip")), opf.OPFImportError, "import-failed");
  });

  test("open throws OPFValidationError with located findings, and typed errors for names and missing files", async () => {
    const dir = await folder();
    await writeFile(path.join(dir, "broken.opf.yaml"), "name: X\nlanguage: 5\nslides:\n  - title: A\n");
    const error = await fails(opf.open(path.join(dir, "broken.opf.yaml")), opf.OPFValidationError);
    assert.equal(error.findings[0].location.line, 2);
    await fails(opf.open(path.join(dir, "absent.opf.md")), opf.OPFApiError, "input-not-found");
    await fails(opf.open(path.join(dir, "deck.pdf")), opf.OPFApiError, "invalid-option");
  });

  test("save refuses an invalid deck unless validate is false, and takes deck forms only", async () => {
    const dir = await folder();
    const draft = { slides: [{ title: "Draft", layout: "nowhere:two-column" }] };
    await fails(opf.save(draft, path.join(dir, "draft.opf.json")), opf.OPFValidationError);
    assert.equal(existsSync(path.join(dir, "draft.opf.json")), false);
    const saved = await opf.save(draft, path.join(dir, "draft.opf.json"), { validate: false });
    assert.equal(saved.format, "json");
    assert.deepEqual(JSON.parse(await readFile(path.join(dir, "draft.opf.json"), "utf8")), draft);
    await fails(opf.save(deck, path.join(dir, "deck.pdf")), opf.OPFApiError, "invalid-option");
    await fails(opf.save(deck, path.join(dir, "deck.md")), opf.OPFApiError, "invalid-option");
    await fails(opf.save("deck", path.join(dir, "deck.opf.json")), opf.OPFApiError, "invalid-option");
  });
});

describe("fonts prepared once per process", () => {
  test("two default calls and a call with its own handle give the same bytes", { skip }, async () => {
    const require = createRequire(path.join(here, "..", "package.json"));
    const { loadFonts } = await import(pathToFileURL(require.resolve("@openpresentation/opf-render/fonts-node")).href);
    for (const format of ["pdf", "png", "svg", "pptx"]) {
      const first = await opf.convert(deck, { format });
      const second = await opf.convert(deck, { format });
      const fonts = await loadFonts({ pack: "office", substitutionPolicy: "visual", scripts: "auto", presentation: deck, embedScriptFonts: format === "svg" });
      const own = await opf.convert(deck, { format, fonts });
      assert.deepEqual(b64(second.files), b64(first.files), format);
      assert.deepEqual(b64(own.files), b64(first.files), `${format}: the shared handle draws what a handle of its own draws`);
    }
    // Concurrent calls share the handle one at a time and still agree.
    const [a, b] = await Promise.all([opf.convert(deck, { format: "png" }), opf.convert({ ...deck, name: "Other" }, { format: "png" })]);
    assert.deepEqual(b64(a.files), b64((await opf.convert(deck, { format: "png" })).files));
    assert.equal(b.files[0].name, "Other-1.png");
  });

  test("the pack is prepared once, concurrent callers share the one preparation, and a script deck gets its own", async () => {
    const require = createRequire(path.join(here, "..", "package.json"));
    const { build } = createRequire(require.resolve("tsup"))("esbuild");
    const file = path.join(temp, "fonts-memo.mjs");
    await build({ entryPoints: [path.join(here, "../src/node/fonts.ts")], outfile: file, bundle: true, platform: "node", format: "esm", target: "node22", logLevel: "silent" });
    const { leaseSharedFonts } = await import(pathToFileURL(file).href);
    let loads = 0;
    let cleared = 0;
    const renderer = {
      fonts: {
        autoScriptSelection: (presentation) => (JSON.stringify(presentation).includes("日本") ? { detected: ["Jpan"], scripts: ["Jpan"], unavailable: [] } : { detected: [], scripts: [], unavailable: [] }),
        loadFonts: async () => {
          loads++;
          await new Promise((resolve) => setTimeout(resolve, 20));
          return { embeddedFonts: [], fontFiles: [], registry: { clearSubstitutions: () => cleared++ }, substitutions: [], pending: () => [] };
        },
      },
    };
    const reporter = { add: () => assert.fail("no diagnostic expected") };
    // Two callers at once: one preparation, and the second gets the handle when the first releases it.
    const firstLease = leaseSharedFonts(renderer, deck, [], reporter);
    const secondLease = leaseSharedFonts(renderer, deck, [], reporter);
    let secondDone = false;
    secondLease.then(() => {
      secondDone = true;
    });
    const one = await firstLease;
    await new Promise((resolve) => setTimeout(resolve, 30));
    assert.equal(secondDone, false, "the second export waits for the first");
    one.release();
    (await secondLease).release();
    assert.equal(loads, 1, "two concurrent callers, one preparation");
    const third = await leaseSharedFonts(renderer, { slides: [{ title: "Again" }] }, [], reporter);
    third.release();
    assert.equal(loads, 1, "a later deck reuses it");
    assert.equal(cleared, 3, "each export starts with no recorded substitutions");
    assert.equal(await leaseSharedFonts(renderer, { slides: [{ title: "日本語" }] }, [], reporter), undefined, "a deck that draws a script gets a handle of its own");
    const withDirs = await leaseSharedFonts(renderer, deck, ["/fonts/a.ttf"], reporter);
    withDirs.release();
    assert.equal(loads, 2, "a fonts folder keys its own handle");
  });
});

describe("a missing peer", () => {
  test("throws peer-not-installed with the install command, for export and import", async () => {
    const isolated = await mkdtemp(path.join(temp, "isolated-"));
    await installIsolatedCore(path.join(isolated, "node_modules"));
    await writeFile(path.join(isolated, "deck.opf.json"), JSON.stringify({ slides: [{ title: "x" }] }));
    await writeFile(
      path.join(isolated, "run.mjs"),
      `import * as opf from "@openpresentation/opf";
const out = {};
for (const [name, call] of [["export", () => opf.convert("deck.opf.json", "deck.pdf")], ["import", () => opf.open(new Uint8Array(4))], ["deck", () => opf.convert("deck.opf.json", "deck.opf.md")]]) {
  try { await call(); out[name] = "no error"; } catch (error) { out[name] = { name: error.name, code: error.code, package: error.details?.package, range: error.details?.range, message: error.message }; }
}
process.stdout.write(JSON.stringify(out));
`,
    );
    const result = spawnSync(process.execPath, ["run.mjs"], { cwd: isolated, encoding: "utf8" });
    assert.equal(result.status, 0, result.stderr);
    const out = JSON.parse(result.stdout);
    assert.equal(out.export.name, "OPFExportError");
    assert.equal(out.export.code, "peer-not-installed");
    assert.equal(out.export.package, "@openpresentation/opf-render");
    assert.match(out.export.range, /^\^0\.\d+\.\d+$/);
    assert.match(out.export.message, /npm install @openpresentation\/opf-render@/);
    assert.equal(out.import.name, "OPFImportError");
    assert.equal(out.import.code, "peer-not-installed");
    assert.equal(out.import.package, "@openpresentation/opf-pptx");
    assert.equal(out.deck, "no error", "a deck-to-deck conversion needs no peer");
    assert.ok((await stat(path.join(isolated, "deck.opf.md"))).isFile());
  });
});

describe("the network", () => {
  test("no call in this file connected or fetched", () => {
    assert.deepEqual(network, []);
  });
});
