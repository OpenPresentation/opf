// OPF 0.35 step 8: `opf fix` migrates a 0.34 deck that placed content in the cells of a slide's grid with slide keys (`start`,
// `center+end`, `top`, `bottom`). Fixture fix-cells-0.34: a slide in cells (cells-to-blocks); slides in cells beside the built-in
// `chart` and `section` layouts and the removed `flow` layout, which keep their layout and get blocks that bind to it by kind
// (cells-to-layout-blocks, marked changesDrawing); and a 0.34 region pin, reported only once the cells are fixed, so its fix comes in
// the second round.
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { copyFile, mkdtemp, readFile, realpath, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { after, before, test } from "node:test";
import { fileURLToPath } from "node:url";

const executable = process.env.OPF_TEST_BIN ?? fileURLToPath(new URL("../dist/index.js", import.meta.url));
const fixture = (name) => fileURLToPath(new URL(`./fixtures/${name}`, import.meta.url));
let temp;
before(async () => { temp = await realpath(await mkdtemp(path.join(tmpdir(), "opf-cli-fix-cells-"))); });
after(async () => { await rm(temp, { recursive: true, force: true }); });
const spawn = (args, status) => {
  const result = spawnSync(process.execPath, [executable, ...args], { cwd: temp, encoding: "utf8", timeout: 120000, maxBuffer: 64 * 1024 * 1024 });
  assert.equal(result.status, status, JSON.stringify({ args, stdout: result.stdout.slice(0, 2000), stderr: result.stderr.slice(0, 2000) }));
  return result;
};
const run = (args, status) => {
  const result = spawn(args, status);
  return JSON.parse(result.stdout || result.stderr);
};
const copy = async (name) => {
  const file = path.join(temp, name);
  await copyFile(fixture(name), file);
  return file;
};
const readJson = async (file) => JSON.parse(await readFile(file, "utf8"));
const applied = (report) => report.fix.applied.map((entry) => `${entry.round} ${entry.ruleId} ${entry.path} ${entry.fix}${entry.changesDrawing ? " (changes the drawing)" : ""}`);

test("a 0.34 deck in cells: the cells become blocks, a slide with a layout keeps it with blocks that bind to it, the pins follow", async () => {
  const deck = await copy("fix-cells-0.34.opf.json");
  const before = await readJson(deck);
  const report = run(["fix", deck, "-i"], 0);
  assert.equal(report.ok, true);
  assert.deepEqual(applied(report), [
    "1 opf/schema /slides/0/start cells-to-blocks",
    "1 opf/schema /slides/1/start cells-to-layout-blocks (changes the drawing)",
    "1 opf/schema /slides/2/top cells-to-layout-blocks (changes the drawing)",
    "1 opf/schema /slides/4/start cells-to-layout-blocks (changes the drawing)",
    "1 opf/unresolved-reference /slides/4/layout rename-layout (changes the drawing)",
    "2 opf/region-unknown /slides/3/blocks/0/region rename-region",
    "2 opf/region-unknown /slides/3/blocks/1/region rename-region",
  ]);
  assert.equal("layoutWithCells" in report.fix, false);
  assert.deepEqual({ rounds: report.fix.rounds, stopped: report.fix.stopped, unsafe: report.fix.unsafe, changesDrawing: report.fix.changesDrawing }, { rounds: 2, stopped: "stable", unsafe: [], changesDrawing: 4 });
  assert.deepEqual(report.findings.filter((finding) => finding.severity === "error"), []);

  const after = await readJson(deck);
  // Slide 0: the keys become blocks in reading order of their cells, each payload as written with `region` naming its cell.
  assert.deepEqual(after.slides[0], { title: before.slides[0].title, blocks: [{ region: "start", ...before.slides[0].start }, { region: "center+end", ...before.slides[0]["center+end"] }] });
  // Slides 1, 2 and 4 keep their layout (flow renamed to process); the content moves into blocks without region, in reading order.
  assert.deepEqual(after.slides[1], { title: before.slides[1].title, layout: "chart", blocks: [before.slides[1].start, before.slides[1]["center+end"]] });
  assert.deepEqual(after.slides[2], { title: before.slides[2].title, layout: "section", blocks: [before.slides[2].top, before.slides[2].bottom] });
  assert.equal(after.slides[4].layout, "process");
  assert.deepEqual(after.slides[4].blocks.map((block) => block.region), [undefined, undefined]);
  // Slide 3: the 0.34 region names of the metrics layout, renamed in the second round.
  assert.deepEqual(after.slides[3].blocks.map((block) => block.region), ["aside", "body"]);
  assert.equal(after.slides[3].layout, "metrics");
  assert.equal(run(["validate", deck], 0).counts.error, 0);

  // The text report marks the fixes that can change the drawing.
  const text = spawn(["fix", await copy("fix-cells-0.34.opf.json"), "--check", "--format", "text"], 1).stdout;
  assert.match(text, /fix-cells-0\.34\.opf\.json:\/slides\/2\/top {2}to fix {2}opf\/schema {2}cells-to-layout-blocks: Move the regions into blocks of the layout {2}\(changes the drawing\)/);
  assert.doesNotMatch(text, /layout and cells/);
});
