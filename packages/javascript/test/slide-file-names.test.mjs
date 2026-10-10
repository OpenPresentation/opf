// Slide file names (RR-77): `{n}` in a .png or .svg output path, and one padding rule: numbers are padded to the width of the
// largest number written. Runs against stand-in opf-render and opf-pptx packages (scripts/stub-peers.mjs) in a copy of core, so it
// needs no real renderer and always runs.
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdir, mkdtemp, realpath, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { after, before, describe, test } from "node:test";
import { installIsolatedCore } from "../../../scripts/isolated-core.mjs";
import { installStubPeers } from "../../../scripts/stub-peers.mjs";

const temp = await realpath(await mkdtemp(path.join(tmpdir(), "opf-slide-names-")));
after(() => rm(temp, { recursive: true, force: true }));

const runner = [
  'import * as opf from "@openpresentation/opf";',
  'import { readFileSync, readdirSync, writeFileSync } from "node:fs";',
  'import path from "node:path";',
  'const walk = (dir) => readdirSync(dir, { withFileTypes: true }).flatMap((item) => item.isDirectory() ? walk(path.join(dir, item.name)).map((name) => `${item.name}/${name}`) : [item.name]);',
  'const cases = JSON.parse(readFileSync("cases.json", "utf8"));',
  "const results = [];",
  "for (const item of cases) {",
  "  const deck = { name: item.name, slides: Array.from({ length: item.slides }, (_, index) => ({ title: `Slide ${index + 1}` })) };",
  "  const result = { name: item.name };",
  "  try {",
  "    const out = item.output === undefined ? await opf.convert(deck, item.options) : await opf.convert(deck, item.output, item.options);",
  '    result.files = out.files.map((file) => file.name);',
  "    result.entries = out.files[0].entries;",
  "    result.slides = out.files.map((file) => file.slide);",
  "  } catch (failure) { result.error = { code: failure.code, message: failure.message }; }",
  '  result.written = item.output === undefined ? [] : walk(".").filter((name) => name.startsWith(item.dir + "/") || name === item.dir).sort();',
  "  results.push(result);",
  "}",
  "process.stdout.write(JSON.stringify(results));",
].join("\n");

let root;
before(async () => {
  root = await mkdtemp(path.join(temp, "core-"));
  await installIsolatedCore(path.join(root, "node_modules"));
  await installStubPeers(path.join(root, "node_modules"));
  await writeFile(path.join(root, "run.mjs"), runner);
});

let batches = 0;
/** Run the cases in the isolated core; each case: { name, slides, output?, options? }. Each case writes into a folder of its own. */
async function convertAll(cases) {
  const batch = ++batches;
  const prepared = cases.map((item, index) => ({ ...item, dir: `case${batch}-${index}`, output: item.output === undefined ? undefined : `case${batch}-${index}/${item.output}` }));
  await writeFile(path.join(root, "cases.json"), JSON.stringify(prepared));
  const result = spawnSync(process.execPath, ["run.mjs"], { cwd: root, encoding: "utf8" });
  assert.equal(result.status, 0, `${result.error ?? ""} ${result.stderr}`);
  return JSON.parse(result.stdout).map((item, index) => ({ ...item, written: item.written.map((name) => name.slice(prepared[index].dir.length + 1)) }));
}
const sequence = (count, name, extension, width) => Array.from({ length: count }, (_, index) => `${name}${String(index + 1).padStart(width, "0")}.${extension}`);

describe("{n} in the output pattern", () => {
  test("pads to the width of the largest number: 3, 12 and 120 slides give widths 1, 2 and 3", async () => {
    const [three, twelve, many] = await convertAll([
      { name: "three", slides: 3, output: "slides/slide-{n}.png" },
      { name: "twelve", slides: 12, output: "slides/slide-{n}.svg" },
      { name: "many", slides: 120, output: "slide-{n}.png" },
    ]);
    assert.deepEqual(three.written, sequence(3, "slides/slide-", "png", 1));
    assert.deepEqual(three.slides, [1, 2, 3]);
    assert.deepEqual(twelve.written, sequence(12, "slides/slide-", "svg", 2).sort());
    assert.deepEqual(many.written, sequence(120, "slide-", "png", 3).sort());
    assert.deepEqual(many.slides.slice(0, 3), [1, 2, 3], "the files come in slide order");
  });

  test("the number is the deck's slide number: --slides 2,5 writes 2 and 5, padded to the largest selected", async () => {
    const [few, wide] = await convertAll([
      { name: "few", slides: 12, output: "s-{n}.png", options: { slides: "2,5" } },
      { name: "wide", slides: 12, output: "s-{n}.png", options: { slides: "2,10" } },
    ]);
    assert.deepEqual(few.written, ["s-2.png", "s-5.png"]);
    assert.deepEqual(few.slides, [2, 5]);
    assert.deepEqual(wide.written, ["s-02.png", "s-10.png"]);
  });

  test("a pattern always numbers, for a one-slide deck and for one selected slide", async () => {
    const [one, picked, plain] = await convertAll([
      { name: "one", slides: 1, output: "cover-{n}.png" },
      { name: "picked", slides: 12, output: "p-{n}.svg", options: { slides: "7" } },
      { name: "plain", slides: 1, output: "cover.png" },
    ]);
    assert.deepEqual(one.written, ["cover-1.png"]);
    assert.deepEqual(picked.written, ["p-7.svg"]);
    assert.deepEqual(plain.written, ["cover.png"], "without a pattern one slide is written to the output name itself");
  });

  test("{n} may appear in a folder name, and more than once", async () => {
    const [both] = await convertAll([{ name: "both", slides: 2, output: "s{n}/slide-{n}.png" }]);
    assert.deepEqual(both.written, ["s1/slide-1.png", "s2/slide-2.png"]);
  });

  test("a single-file output refuses {n}, and a per-slide output refuses any other key (invalid-option)", async () => {
    const results = await convertAll([
      { name: "pdf", slides: 3, output: "deck-{n}.pdf" },
      { name: "pptx", slides: 3, output: "deck-{n}.pptx" },
      { name: "zip", slides: 3, output: "deck-{n}.zip" },
      { name: "yaml", slides: 3, output: "deck-{n}.opf.yaml" },
      { name: "unknown", slides: 3, output: "slide-{id}.png" },
      { name: "empty", slides: 3, output: "slide-{}.svg" },
      { name: "mixed", slides: 3, output: "slide-{n}-{title}.png" },
    ]);
    for (const result of results) {
      assert.equal(result.error?.code, "invalid-option", result.name);
      assert.deepEqual(result.written, [], `${result.name} writes nothing`);
    }
    assert.match(results[0].error.message, /{n}.*single file/);
    assert.match(results[4].error.message, /Unknown {id}.*only placeholder is {n}/);
  });

  test("a brace that is not a key stays in the name of a single file", async () => {
    const [pdf] = await convertAll([{ name: "pdf", slides: 2, output: "draft {v1}.pdf" }]);
    assert.equal(pdf.error, undefined);
    assert.deepEqual(pdf.written, ["draft {v1}.pdf"]);
  });
});

describe("one padding rule: the width of the largest number written", () => {
  test("the plain form pads 5 and 12 slides alike", async () => {
    const [five, twelve, subset] = await convertAll([
      { name: "five", slides: 5, output: "deck.png" },
      { name: "twelve", slides: 12, output: "deck.svg" },
      { name: "subset", slides: 12, output: "deck.png", options: { slides: "2,5" } },
    ]);
    assert.deepEqual(five.written, sequence(5, "deck-", "png", 1));
    assert.deepEqual(twelve.written, sequence(12, "deck-", "svg", 2).sort());
    assert.deepEqual(subset.written, ["deck-2.png", "deck-5.png"]);
  });

  test("without an output path the names follow the deck and the same rule", async () => {
    const [short, long, subset] = await convertAll([
      { name: "Q4 Review", slides: 3, options: { format: "png" } },
      { name: "Q4 Review", slides: 12, options: { format: "svg" } },
      { name: "Q4 Review", slides: 12, options: { format: "png", slides: [3, 11] } },
    ]);
    assert.deepEqual(short.files, ["Q4-Review-1.png", "Q4-Review-2.png", "Q4-Review-3.png"]);
    assert.deepEqual(long.files, sequence(12, "Q4-Review-", "svg", 2));
    assert.deepEqual(subset.files, ["Q4-Review-03.png", "Q4-Review-11.png"]);
  });

  test("zip entries follow the same rule, with a path or without", async () => {
    const [short, long, memory, one] = await convertAll([
      { name: "z", slides: 3, output: "slides.zip" },
      { name: "z", slides: 12, output: "slides.zip", options: { format: "svg" } },
      { name: "Q4 Review", slides: 12, options: { format: "png", zip: true } },
      { name: "z", slides: 1, output: "one.zip" },
    ]);
    assert.deepEqual(short.entries, ["slides-1.png", "slides-2.png", "slides-3.png"]);
    assert.deepEqual(long.entries, sequence(12, "slides-", "svg", 2).sort());
    assert.deepEqual(memory.entries, sequence(12, "Q4-Review-", "png", 2));
    assert.deepEqual(one.entries, ["one-1.png"], "a zip entry is always numbered");
  });
});
