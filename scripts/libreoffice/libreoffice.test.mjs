// Portable tests of the LibreOffice qualification (docs/libreoffice.md): the checks, the PPTX reader, the font profile and the
// corpus. LibreOffice itself runs only in the nightly leg; nothing here needs it, fontconfig or the built packages.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { compareStructure, containment, inkOutside, missingWords, runExtent, shapeForRun, sourceBleeds, verdict } from "./checks.mjs";
import { corpusCases, selectCases } from "./corpus.mjs";
import { fontsConf, policyAliases } from "./fonts.mjs";
import { pinnedImage } from "./image.mjs";
import { readPptx, slideWords, tokenize } from "./pptx-model.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "../..");
const box = (x, y, width, height) => ({ x, y, width, height });
const textShape = (name, b, wrap = "none") => ({ id: name, name, kind: "text", box: b, rotated: false, body: { wrap }, paragraphs: [] });
const run = (str, x, baseline, width, size = 24) => ({ str, x, baseline, width, size, rotated: false });

test("the pinned environment names an exact LibreOffice build and the workflow image", () => {
  const environment = JSON.parse(readFileSync(path.join(here, "environment.json"), "utf8"));
  assert.match(environment.libreoffice.version, /^\d+\.\d+\.\d+\.\d+$/);
  assert.match(environment.libreoffice.sha256, /^[0-9a-f]{64}$/);
  assert.ok(environment.libreoffice.url.startsWith("https://downloadarchive.documentfoundation.org/libreoffice/old/"), "the permanent archive, not a mirror that drops old builds");
  assert.ok(environment.libreoffice.url.includes(environment.libreoffice.version));
  assert.match(pinnedImage(), /^mcr\.microsoft\.com\/playwright:v[\d.]+-[a-z]+@sha256:[0-9a-f]{64}$/);
});

test("tokenize drops invisible format characters and splits on any space", () => {
  assert.deepEqual(tokenize(`per${String.fromCodePoint(0xad)}minute for  audio\nmodels`), ["perminute", "for", "audio", "models"]);
});

test("runExtent ignores trailing spaces of a run's advance", () => {
  const extent = runExtent(run("for ", 100, 50, 40, 20));
  assert.equal(extent.right, 135);
});

test("a run is attributed to the smallest text shape it starts in", () => {
  const outer = textShape("outer", box(0, 0, 900, 200)), inner = textShape("inner", box(40, 20, 300, 40));
  assert.equal(shapeForRun(run("x", 50, 50, 10), [outer, inner]).name, "inner");
  assert.equal(shapeForRun(run("x", 600, 50, 10), [outer, inner]).name, "outer");
  assert.equal(shapeForRun(run("x", 50, 400, 10), [outer, inner]), null);
});

test("containment reports text past its box and past the slide, with distances", () => {
  const slide = { shapes: [textShape("line 0", box(43.2, 110, 873.6, 29))] };
  const page = { runs: [run("Price from every provider that hosts the model", 73, 130, 940)] };
  const result = containment(page, slide, { width: 960, height: 540 });
  assert.deepEqual(result.offSlide.map((entry) => [entry.side, entry.by]), [["right", 53]]);
  assert.deepEqual(result.outsideBox.map((entry) => [entry.side, entry.by]), [["right", 96.2]]);
  const fits = containment({ runs: [run("Price", 73, 130, 400)] }, slide, { width: 960, height: 540 });
  assert.equal(fits.offSlide.length + fits.outsideBox.length, 0);
});

test("missingWords counts occurrences and survives runs split by the viewer", () => {
  assert.deepEqual(missingWords(["audio", "models)"], "audio mod els)"), []);
  assert.deepEqual(missingWords(["the", "the", "Vercel."], "the deploy to"), [{ word: "the", expected: 2, found: 1 }, { word: "Vercel.", expected: 1, found: 0 }]);
});

test("compareStructure finds lost words and lost explicit breaks", () => {
  const source = [{ words: ["a", "b"], breaks: 2 }], same = [{ words: ["a", "b"], breaks: 2 }];
  assert.deepEqual(compareStructure(source, same), []);
  const [finding] = compareStructure(source, [{ words: ["a"], breaks: 1 }]);
  assert.deepEqual(finding.missing.map((entry) => entry.word), ["b"]);
  assert.deepEqual(finding.breaks, { source: 2, roundTrip: 1 });
  assert.deepEqual(compareStructure(source, []), [{ slide: 1, issue: "slide-lost" }]);
});

test("inkOutside counts ink in the margin only, outside a guard band", () => {
  const width = 20, height = 20, channels = 3, raw = Buffer.alloc(width * height * channels, 255);
  const paint = (x, y) => raw.fill(0, (y * width + x) * channels, (y * width + x) * channels + 3);
  paint(10, 10); // on the page
  paint(17, 10); // right margin, past the guard
  paint(16, 10); // inside the guard band
  assert.deepEqual(inkOutside({ raw, width, height, channels, offset: 5, pageWidth: 10, pageHeight: 10 }), { left: 0, right: 1, top: 0, bottom: 0 });
});

test("sourceBleeds lists the sides a deck itself draws past", () => {
  assert.deepEqual([...sourceBleeds({ shapes: [{ box: box(-10, 0, 100, 100) }, { box: box(900, 0, 100, 100) }] }, { width: 960, height: 540 })].sort(), ["left", "right"]);
});

test("verdict: defects fail, documented differences do not", () => {
  const clean = { converted: true, pages: 1, slides: 1, perSlide: [{ number: 1, missing: [], offSlide: [], outsideBox: [{ side: "bottom", wrap: "square", by: 4 }], inkOutside: {}, bleeds: [], preview: { largePercent: 12 } }], roundTrip: { converted: true, findings: [] } };
  const passed = verdict(clean);
  assert.equal(passed.status, "pass");
  assert.deepEqual(passed.differences.map((entry) => entry.check), ["vertical-growth", "preview"]);
  const overflow = structuredClone(clean);
  overflow.perSlide[0].outsideBox = [{ str: "for ", side: "right", wrap: "none", by: 30 }];
  overflow.perSlide[0].offSlide = [{ str: "for ", side: "right", by: 2 }];
  overflow.perSlide[0].missing = [{ word: "models)", expected: 1, found: 0 }];
  assert.deepEqual(verdict(overflow).defects.map((entry) => entry.check), ["clipped", "slide-edge", "text-box"]);
  const cut = structuredClone(clean);
  cut.perSlide[0].missing = [{ word: "for", expected: 1, found: 0 }];
  cut.perSlide[0].atEdge = [{ str: "per-minute", side: "right" }];
  assert.deepEqual(verdict(cut).defects.map((entry) => entry.check), ["clipped"], "a line cut at the page edge is clipped, not lost");
  const lost = structuredClone(clean);
  lost.perSlide[0].missing = [{ word: "for", expected: 1, found: 0 }];
  assert.deepEqual(verdict(lost).defects.map((entry) => entry.check), ["content"]);
  assert.deepEqual(verdict({ converted: false }).defects.map((entry) => entry.check), ["open"]);
  assert.deepEqual(verdict({ ...clean, pages: 2 }).defects.map((entry) => entry.check), ["slides"]);
});

test("the opf font profile aliases each previewed family to OPF's replacement", () => {
  const policy = JSON.parse(readFileSync(path.join(root, "spec/reference/font-policy.json"), "utf8"));
  const aliases = policyAliases(policy);
  const aptos = aliases.find((entry) => entry.family === "Aptos");
  assert.deepEqual(aptos, { family: "Aptos", prefer: "Intos", compatibility: "metric" });
  assert.equal(aliases.find((entry) => entry.family === "Calibri").prefer, "Carlito");
  assert.ok(!aliases.some((entry) => entry.family.toLowerCase() === entry.prefer.toLowerCase()));
  const conf = fontsConf({ fontDir: "/fonts", aliases: [aptos, { family: "A&B", prefer: "C", compatibility: "visual" }] });
  assert.match(conf, /<dir>\/fonts<\/dir>/);
  assert.match(conf, /<string>Aptos<\/string><\/test><edit name="family" mode="assign" binding="same"><string>Intos<\/string>/);
  assert.match(conf, /A&amp;B/);
});

test("readPptx reads the retained opf#925 artifact as its manifest records it", () => {
  const manifest = JSON.parse(readFileSync(path.join(root, "packages/pptx/test/fixtures/native-long-text/manifest.json"), "utf8"));
  const model = readPptx(readFileSync(path.join(root, "packages/pptx/test/fixtures/native-long-text/llmreference.pptx")));
  assert.equal(model.slides.length, manifest.expectedSlideCount);
  assert.deepEqual(model.slideSize, { width: manifest.slideSizeEmu.width / 12700, height: manifest.slideSizeEmu.height / 12700 });
  assert.ok(model.fonts.includes("Aptos") && model.fonts.includes("Aptos Display"));
  for (const expected of manifest.slides) {
    const slide = model.slides[expected.number - 1];
    for (const shape of expected.textShapes) {
      const found = slide.shapes.find((entry) => entry.id === shape.id);
      assert.equal(found.name, shape.name);
      assert.deepEqual(found.paragraphs.map((paragraph) => paragraph.text), shape.paragraphs);
      assert.equal(found.body.wrap, shape.wrap);
      assert.deepEqual(found.box, { x: shape.boxEmu.x / 12700, y: shape.boxEmu.y / 12700, width: shape.boxEmu.width / 12700, height: shape.boxEmu.height / 12700 });
    }
  }
  assert.ok(slideWords(model.slides[2]).includes("audio"));
});

test("the corpus covers the issue's areas and the shared native-acceptance decks", async () => {
  const cases = await corpusCases();
  const ids = cases.map((entry) => entry.id);
  assert.equal(new Set(ids).size, ids.length, "case ids are unique");
  for (const group of ["cover and text", "long and nested lists", "images and crops", "tables", "common charts", "opf#925", "shared native-acceptance corpus"]) assert.ok(cases.some((entry) => entry.group === group), group);
  assert.ok(cases.find((entry) => entry.id === "issue-925-original").pptx.endsWith("llmreference.pptx"));
  assert.ok(cases.filter((entry) => entry.id.startsWith("shared-chart-")).every((entry) => entry.scope === "advanced"));
  for (const entry of cases.filter((item) => item.input)) JSON.parse(readFileSync(entry.input, "utf8"));
  assert.deepEqual(selectCases(cases, ["opf#925"]).map((entry) => entry.id), ids.filter((id) => id.startsWith("issue-925")));
  assert.deepEqual(selectCases(cases, ["shared-feature-*"]).length, 8);
  assert.throws(() => selectCases(cases, ["nothing"]), /no case matches/);
});
