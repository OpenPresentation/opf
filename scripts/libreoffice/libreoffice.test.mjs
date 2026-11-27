// Portable tests of the LibreOffice qualification (docs/libreoffice.md): the checks, the PPTX reader, the font profile and the
// corpus. LibreOffice itself runs only in the nightly leg; nothing here needs it, fontconfig or the built packages.
import assert from "node:assert/strict";
import { existsSync, readFileSync, mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { prepareOutputDirectory, writeNativeRun } from "./output.mjs";
import { impressResult, impressRun, systemFrom } from "../native-acceptance/apps/impress/from-libreoffice.mjs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { compareStructure, containment, inkOutside, missingWords, runExtent, shapeForRun, sourceBleeds, verdict } from "./checks.mjs";
import { corpusCases, LIBREOFFICE_CASES, qualificationSelection, selectCases, sharedFixtureCases } from "./corpus.mjs";
import { decksForTier, sourceDecks } from "../native-acceptance/qualification/tiers.mjs";
import { fileIdentity } from "../native-acceptance/apps/impress/from-libreoffice.mjs";
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
  assert.deepEqual(missingWords(["the", "the", "Vercel."], "the deploy to"), [{ word: "the", expected: 2, found: 1 }, { word: "vercel.", expected: 1, found: 0 }]);
});

test("missingWords folds case (an all-caps eyebrow) and compares right-to-left words as letters", () => {
  assert.deepEqual(missingWords(["Why", "data", "storytelling"], "WHY DATA STORYTELLING"), []);
  const arabic = "الرؤية";
  assert.deepEqual(missingWords([arabic], [...arabic].reverse().join(" | ")), [], "visual-order fragments of the same letters");
  assert.equal(missingWords([arabic], "ال").length, 1);
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

test('output preparation preserves prior qualification evidence and refuses a nonempty directory', () => {
  const scratch = mkdtempSync(path.join(tmpdir(), 'opf-lo-output-'));
  try {
    const empty = path.join(scratch, 'empty'), fresh = path.join(scratch, 'fresh');
    mkdirSync(empty);
    assert.equal(prepareOutputDirectory(empty), empty);
    assert.equal(prepareOutputDirectory(fresh), fresh);
    const receipt = path.join(fresh, 'results.json');
    writeFileSync(receipt, '{"passed":false}');
    assert.throws(() => prepareOutputDirectory(fresh), /earlier files are preserved/);
    assert.equal(readFileSync(receipt, 'utf8'), '{"passed":false}');
    assert.throws(() => prepareOutputDirectory(receipt), /fresh or empty directory/);
    assert.throws(() => prepareOutputDirectory(scratch), /fresh or empty directory/);
    assert.equal(readFileSync(receipt, 'utf8'), '{"passed":false}');
  } finally { rmSync(scratch, { recursive: true, force: true }); }
});

test("the runner also writes the shared native result format, and writes nothing when a result is invalid", () => {
  const nightly = JSON.parse(readFileSync(path.join(root, "scripts/native-acceptance/apps/impress/fixtures/nightly-2026-11-25.json"), "utf8"));
  const entry = nightly.cases.find((item) => item.id === "tables");
  const system = systemFrom({ platform: "linux", release: nightly.environment.os });
  const when = { started: "2026-11-25T11:40:00Z", finished: "2026-11-25T11:41:00Z" };
  const result = impressResult({ caseId: entry.id, profile: "opf", environment: nightly.environment, system, input: { path: "tables.pptx", sha256: entry.pptxSha256 }, hidden: entry.hidden, measured: entry.result, ...when });
  const run = impressRun({ environment: nightly.environment, system, profiles: ["opf"], ...when, results: [result] });
  const scratch = mkdtempSync(path.join(tmpdir(), "opf-lo-native-"));
  try {
    writeNativeRun(path.join(scratch, "native"), run, [result]);
    assert.deepEqual(JSON.parse(readFileSync(path.join(scratch, "native/run.json"), "utf8")).files.map((file) => file.result), ["files/tables~default.opf/result.json"]);
    assert.equal(JSON.parse(readFileSync(path.join(scratch, "native/files/tables~default.opf/result.json"), "utf8")).target, "impress");
    const invalid = { ...result, verbs: { ...result.verbs, probe: { status: "skipped" } } };
    assert.throws(() => writeNativeRun(path.join(scratch, "again"), run, [invalid]), /files\/tables~default\.opf\/result\.json does not validate/);
    assert.equal(existsSync(path.join(scratch, "again")), false, "nothing is written when a result is invalid");
  } finally { rmSync(scratch, { recursive: true, force: true }); }
});

// NT-14: the qualification part of the list comes from the manifest's tiers (tiers.mjs), as in the Keynote runner.
const manifest = JSON.parse(readFileSync(path.join(root, "scripts/native-acceptance/qualification/manifest.json"), "utf8"));

/** A build directory as build.mjs writes it, for every deck and variant of the manifest (no files are read except build.json). */
function fakeBuild(failing = []) {
  const dir = mkdtempSync(path.join(tmpdir(), "opf-lo-build-"));
  const decks = manifest.decks.map((deck) => ({
    id: deck.id,
    source: deck.source,
    variants: (deck.variants ?? [{ name: "default" }]).map((variant) => ({ name: variant.name, ok: !failing.includes(`${deck.id}~${variant.name}`), pptx: `pptx/${variant.name === "default" ? deck.id : `${deck.id}~${variant.name}`}.pptx`, sha256: "0".repeat(64) })),
  }));
  writeFileSync(path.join(dir, "build.json"), JSON.stringify({ revision: "abc", decks }));
  return dir;
}

test("a tier selects exactly the decks and variants decksForTier names, in the tier's order", () => {
  const dir = fakeBuild();
  try {
    for (const tier of ["smoke", "release", "full"]) {
      const expected = decksForTier(manifest, tier).flatMap(({ deck, variants }) => variants.map((variant) => `${deck}~${variant}`));
      const { cases, failed } = qualificationSelection(dir, { tier });
      assert.deepEqual(cases.map((entry) => `${entry.qualification.deck}~${entry.qualification.variant}`), expected, tier);
      assert.deepEqual(failed, []);
    }
    const release = qualificationSelection(dir).cases;
    const files = (tier) => decksForTier(manifest, tier).reduce((total, entry) => total + entry.variants.length, 0);
    assert.equal(release.length, files("release"), "the default is release");
    const corpus = manifest.decks.filter((deck) => !deck.group);
    const fromSources = (manifest.tiers.release.sources ?? []).flatMap((item) => (typeof item === "string" ? [] : item.decks));
    assert.equal(release.length, corpus.reduce((total, deck) => total + (deck.variants?.length || 1), 0) + fromSources.reduce((total, item) => total + (item.variants?.length ?? (manifest.decks.find((deck) => deck.id === item.deck).variants?.length || 1)), 0), "release: every corpus deck in every variant, plus the source decks it names");
    const full = qualificationSelection(dir, { tier: "full" });
    assert.equal(full.cases.length, manifest.decks.reduce((total, deck) => total + (deck.variants?.length || 1), 0), "full: every manifest deck in every variant, the group decks included");
    assert.ok(!full.sources.some((source) => sourceDecks(manifest, source).length > 0), "a source that is a group of decks is not reported as unresolved");
    const smoke = qualificationSelection(dir, { tier: "smoke" });
    assert.ok(smoke.cases.length < release.length / 2);
    assert.deepEqual(smoke.sources, ["native-fragments"], "named sources are reported, not resolved");
    assert.ok(qualificationSelection(dir, { tier: "full" }).sources.includes("examples"));
    assert.throws(() => qualificationSelection(dir, { tier: "nightly" }), /unknown tier/);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test("a variant that did not export is left out and named; a tier entry the build lacks throws", () => {
  const dir = fakeBuild(["smartart~shapes"]);
  try {
    const { cases, failed } = qualificationSelection(dir, { tier: "release" });
    assert.deepEqual(failed, ["smartart~shapes"]);
    assert.ok(!cases.some((entry) => entry.id === "q-smartart~shapes") && cases.some((entry) => entry.id === "q-smartart"));
    const short = structuredClone(manifest);
    short.tiers.smoke.decks.push({ deck: "not-built" });
    assert.throws(() => qualificationSelection(dir, { tier: "smoke", manifest: short }), /tier smoke: no deck "not-built"/);
    const build = JSON.parse(readFileSync(path.join(dir, "build.json"), "utf8"));
    build.decks = build.decks.filter((deck) => deck.id !== "footers");
    writeFileSync(path.join(dir, "build.json"), JSON.stringify(build));
    assert.throws(() => qualificationSelection(dir, { tier: "smoke" }), /deck footers is not in/);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test("qualification cases keep their case ids and scope, and name the manifest deck and variant", () => {
  const dir = fakeBuild();
  try {
    const { cases } = qualificationSelection(dir, { tier: "release" });
    const sampler = cases.find((entry) => entry.id === "q-chart-type-sampler");
    assert.equal(sampler.scope, "advanced");
    assert.deepEqual(sampler.qualification, { deck: "chart-type-sampler", variant: "default", sha256: "0".repeat(64), revision: "abc" });
    assert.equal(cases.find((entry) => entry.id === "q-layout-sampler~native-body").qualification.variant, "native-body");
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test("LibreOffice's own cases are one named list with a reason each, and none repeats a manifest deck", async () => {
  assert.equal(new Set(LIBREOFFICE_CASES.map((entry) => entry.id)).size, LIBREOFFICE_CASES.length);
  for (const entry of LIBREOFFICE_CASES) assert.ok(entry.why.length > 20, `${entry.id} says why it is not a corpus deck`);
  const shared = await sharedFixtureCases();
  assert.ok(shared.every((entry) => entry.why));
  const decks = new Set(manifest.decks.map((deck) => deck.id));
  const mine = [...LIBREOFFICE_CASES, ...shared].map((entry) => fileIdentity(entry.id, "opf").deck);
  assert.equal(new Set(mine).size, mine.length, "file ids of the non-manifest cases are unique");
  assert.deepEqual(mine.filter((deck) => decks.has(deck)), [], "a case that is a manifest deck belongs to the tier, not to this list");
  const ids = (await corpusCases({ tier: "release" })).map((entry) => entry.id);
  assert.equal(ids.length, LIBREOFFICE_CASES.length + shared.length);
  const smoke = await corpusCases({ tier: "smoke" });
  assert.deepEqual(smoke.map((entry) => entry.id), LIBREOFFICE_CASES.map((entry) => entry.id), "a smoke run keeps the own cases and leaves the shared fixtures out");
  assert.ok(smoke.every((entry) => !("why" in entry)), "run.mjs never sees the documentation fields");
});

test("file ids of a whole release run are unique and valid in both profiles", async () => {
  const dir = fakeBuild();
  try {
    const cases = [...(await corpusCases({ tier: "release" })), ...qualificationSelection(dir, { tier: "release" }).cases];
    const ids = cases.flatMap((entry) => ["opf", "stock"].map((profile) => fileIdentity(entry.id, profile, entry.qualification).id));
    assert.equal(new Set(ids).size, ids.length);
    const shared = await sharedFixtureCases();
    const release = decksForTier(manifest, "release").reduce((total, entry) => total + entry.variants.length, 0);
    assert.equal(ids.length, 2 * (LIBREOFFICE_CASES.length + shared.length + release));
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
