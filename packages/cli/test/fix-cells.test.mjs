// OPF 0.35 step 8: `opf fix` migrates a 0.34 deck that placed content in the cells of a slide's grid with slide keys (`start`,
// `center+end`, `top`, `bottom`). Fixtures: fix-cells-0.34 (a slide in cells; one beside the built-in `chart` layout and one beside
// `section`, whose design and variant the slide keeps; a 0.34 region pin, reported only once the cells are fixed, so its fix comes in the
// second round; and a slide beside the removed `flow` layout), and fix-cells-layout-left (a slide in cells beside `quote`, whose
// regions shaped how 0.34 drew the cells, so it is left for a person with the reason).
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
const applied = (report) => report.fix.applied.map((entry) => `${entry.round} ${entry.ruleId} ${entry.path} ${entry.fix}`);

test("a 0.34 deck in cells: the cells become blocks that name them, a layout beside cells is removed keeping what it gave, the pins follow", async () => {
  const deck = await copy("fix-cells-0.34.opf.json");
  const before = await readJson(deck);
  const report = run(["fix", deck, "-i"], 0);
  assert.equal(report.ok, true);
  assert.deepEqual(applied(report), [
    "1 opf/schema /slides/0/start cells-to-blocks",
    "1 opf/schema /slides/1/start cells-to-blocks",
    "1 opf/schema /slides/2/top cells-to-blocks",
    "1 opf/schema /slides/4/start cells-to-blocks",
    "2 opf/region-unknown /slides/3/blocks/0/region rename-region",
    "2 opf/region-unknown /slides/3/blocks/1/region rename-region",
  ]);
  assert.deepEqual(report.fix.layoutWithCells, [
    { slide: 1, layout: "chart", rewritten: true },
    { slide: 2, layout: "section", rewritten: true, kept: ["design.titleAlignment", "design.contentAlignment", "design.variant"] },
    { slide: 4, layout: "flow", rewritten: true },
  ]);
  assert.deepEqual({ rounds: report.fix.rounds, stopped: report.fix.stopped, unsafe: report.fix.unsafe }, { rounds: 2, stopped: "stable", unsafe: [] });
  assert.deepEqual(report.findings.filter((finding) => finding.severity !== "info"), []);

  const after = await readJson(deck);
  // Slide 0: the keys become blocks in reading order of their cells, each payload as written with `region` naming its cell.
  assert.deepEqual(after.slides[0], { title: before.slides[0].title, blocks: [{ region: "start", ...before.slides[0].start }, { region: "center+end", ...before.slides[0]["center+end"] }] });
  // Slide 1: the chart layout gave the slide nothing, so only the layout goes.
  assert.deepEqual(after.slides[1], { title: before.slides[1].title, blocks: [{ region: "start", ...before.slides[1].start }, { region: "center+end", ...before.slides[1]["center+end"] }] });
  // Slide 2: the section layout's alignment and its accent1 variant stay on the slide.
  assert.equal(after.slides[2].layout, undefined);
  assert.deepEqual(after.slides[2].blocks.map((block) => block.region), ["top", "bottom"]);
  assert.deepEqual(after.slides[2].design, { titleAlignment: "start", contentAlignment: "start", variant: "accent1" });
  // Slide 3: the 0.34 region names of the metrics layout, renamed in the second round.
  assert.deepEqual(after.slides[3].blocks.map((block) => block.region), ["aside", "body"]);
  assert.equal(after.slides[3].layout, "metrics");
  // Slide 4: the removed flow layout gave the slide nothing either (its rename does not apply once the layout is gone).
  assert.equal(after.slides[4].layout, undefined);
  assert.equal(run(["validate", deck, "--fail-on", "warning"], 0).counts.error, 0);

  // The text report names each slide that had a layout beside its cells.
  const text = spawn(["fix", await copy("fix-cells-0.34.opf.json"), "--check", "--format", "text"], 1).stdout;
  assert.match(text, /fix-cells-0\.34\.opf\.json:\/slides\/2 {2}layout and cells: would remove layout "section" and named the cells, keeping design\.titleAlignment, design\.contentAlignment, design\.variant/);
});

test("a slide in cells beside a layout whose regions shaped it is left, with the reason, and the deck is still written with the other fixes", async () => {
  const deck = await copy("fix-cells-layout-left.opf.json");
  const report = run(["fix", deck, "-i"], 1);
  assert.equal(report.ok, false);
  assert.deepEqual(applied(report), ["1 opf/schema /slides/0/start cells-to-blocks"]);
  assert.equal(report.fix.layoutWithCells.length, 2);
  assert.deepEqual(report.fix.layoutWithCells[0], { slide: 0, layout: "chart", rewritten: true });
  const [left] = report.fix.layoutWithCells.slice(1);
  assert.deepEqual({ ...left, reason: undefined }, { slide: 1, layout: "quote", rewritten: false, reason: undefined });
  assert.match(left.reason, /regions also shaped how its cells drew/);
  assert.deepEqual(report.fix.unsafe, [
    { ruleId: "opf/schema", path: "/slides/1/start", fixes: ["cells-to-blocks", "cells-to-layout-blocks"] },
    { ruleId: "opf/schema", path: "/slides/1/center+end", fixes: ["cells-to-blocks", "cells-to-layout-blocks"] },
  ]);
  const finding = report.findings.find((entry) => entry.path === "/slides/1/start");
  assert.match(finding.help, /The fix that removes layout is not marked safe: the layout record's regions/);
  const after = await readJson(deck);
  assert.equal(after.slides[1].layout, "quote");
  assert.ok(after.slides[1].start && after.slides[1]["center+end"], "the slide left keeps its keys");
  assert.match(spawn(["fix", deck, "--check", "--format", "text"], 0).stdout, /\/slides\/1 {2}layout and cells: left as it is \(layout "quote"\): the layout record's regions/);
});
