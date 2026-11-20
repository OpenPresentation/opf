// OPF 0.35: `opf fix` applies the safe fixes of a deck's findings until none is left. Fixtures: openpresentation.org's Learn step
// regions-and-pins/08 (a custom record with flow "none") and its homepage design lesson (0.34 region pins, with a removed design key
// added so the pins are reported only in the second round), pptx.gallery's how-to-build-list-slides (an unedited copy of the 0.34
// list record, trimmed), and a custom record whose role "secondary" has only fixes a person must choose.
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { copyFile, mkdtemp, readFile, realpath, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { after, before, test } from "node:test";
import { fileURLToPath } from "node:url";

const executable = process.env.OPF_TEST_BIN ?? fileURLToPath(new URL("../dist/index.js", import.meta.url));
const fixture = (name) => fileURLToPath(new URL(`./fixtures/${name}`, import.meta.url));
let temp;
before(async () => { temp = await realpath(await mkdtemp(path.join(tmpdir(), "opf-cli-fix-"))); });
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
const copy = async (name, as = name) => {
  const file = path.join(temp, as);
  await copyFile(fixture(name), file);
  return file;
};
const readJson = async (file) => JSON.parse(await readFile(file, "utf8"));
const applied = (report) => report.fix.applied.map((entry) => `${entry.round} ${entry.ruleId} ${entry.path} ${entry.fix}`);

test("-i fixes a custom record's flow none, reports each fix, and leaves a deck with nothing to fix as it is", async () => {
  const deck = await copy("fix-custom-flow-none.opf.json");
  const report = run(["fix", deck, "-i"], 0);
  assert.deepEqual(Object.keys(report).slice(0, 6), ["command", "ok", "input", "outputs", "findings", "counts"]);
  assert.equal(report.command, "fix");
  assert.equal(report.ok, true);
  assert.deepEqual(applied(report), [
    "1 opf/catalog-record /catalogs/custom/layouts/story-and-evidence/regions/1/regions/0/flow use-max-1",
    "1 opf/catalog-record /catalogs/custom/layouts/story-and-evidence/regions/1/regions/1/flow use-max-1",
  ]);
  assert.deepEqual(report.fix, { ...report.fix, rounds: 1, stopped: "stable", unsafe: [] });
  assert.deepEqual(report.findings, []);
  assert.equal(report.outputs[0].file, deck);
  const regions = (await readJson(deck)).catalogs.custom.layouts["story-and-evidence"].regions[1].regions;
  assert.deepEqual(regions.map((region) => [region.max, region.flow]), [[1, undefined], [1, undefined]]);
  assert.equal(run(["validate", deck], 0).counts.error, 0);
  const before = await stat(deck);
  const again = run(["fix", deck, "-i"], 0);
  assert.deepEqual([again.fix.applied, again.outputs], [[], []]);
  assert.equal((await stat(deck)).mtimeMs, before.mtimeMs, "a deck with nothing to fix is not rewritten");
});

test("validates again after each round: a removed design key hides the region check until it is fixed", async () => {
  const deck = await copy("fix-region-pin.opf.json");
  const output = path.join(temp, "region-pin-fixed.opf.json");
  const report = run(["fix", deck, output], 0);
  assert.deepEqual(applied(report), [
    "1 opf/schema /slides/0/design/contentDirection remove:contentDirection",
    "2 opf/region-unknown /slides/0/blocks/0/region rename-region",
    "2 opf/region-unknown /slides/0/blocks/1/region rename-region",
  ]);
  assert.equal(report.fix.rounds, 2);
  const fixed = await readJson(output);
  assert.deepEqual(fixed.slides[0].blocks.map((block) => block.region), ["aside", "body"]);
  assert.deepEqual(fixed.slides[0].design, {});
  assert.equal((await readJson(deck)).slides[0].blocks[0].region, "note", "the input is not changed");
  const refused = run(["fix", deck, output], 1);
  assert.equal(refused.code, "output-exists");
  run(["fix", deck, output, "--force"], 0);
});

test("--check writes nothing and exits 1 when a safe fix would apply: the stale 0.34 copy takes the current record", async () => {
  const deck = await copy("fix-stale-0.34-list.opf.json");
  const raw = await readFile(deck, "utf8");
  const record = run(["validate", deck], 1).findings.find((finding) => finding.path.startsWith("/catalogs/default/layouts/list/"));
  assert.match(record.message, /^catalogs\.default\.layouts\.list is an unedited copy of OPF 0\.34's release of the built-in layout 'list': /, "the message names the cause");
  const check = run(["fix", deck, "--check"], 1);
  assert.equal(check.ok, false);
  assert.deepEqual(check.outputs, []);
  assert.deepEqual(applied(check), ["1 opf/catalog-record /catalogs/default/layouts/list/regions/1/listColumns use-current-record"]);
  assert.equal(await readFile(deck, "utf8"), raw, "--check wrote nothing");
  run(["fix", deck, "-i"], 0);
  assert.equal((await readJson(deck)).catalogs.default.layouts.list.regions[1].listColumns, undefined);
  assert.equal(run(["fix", deck, "--check"], 0).ok, true);
});

test("an unsafe fix is never applied: the finding stays, is listed in unsafe, and the exit status says so", async () => {
  const deck = await copy("fix-unsafe-only.opf.json");
  const report = run(["fix", deck, "-i"], 1);
  assert.equal(report.ok, false);
  assert.deepEqual(applied(report), ["1 opf/catalog-record /catalogs/custom/layouts/summary/regions/1/regions/0/flow use-max-1"]);
  const role = "/catalogs/custom/layouts/summary/regions/1/regions/1/role";
  assert.deepEqual(report.fix.unsafe, [{ ruleId: "opf/catalog-record", path: role, fixes: ["change-to:supporting", "change-to:primary"] }]);
  assert.ok(report.findings.some((finding) => finding.path === role && finding.severity === "error"));
  const regions = (await readJson(deck)).catalogs.custom.layouts.summary.regions[1].regions;
  assert.deepEqual([regions[0].max, regions[0].flow, regions[1].role], [1, undefined, "secondary"], "the safe fix is written, the unsafe one is not");
  const check = run(["fix", deck, "--check"], 0);
  assert.deepEqual([check.ok, check.fix.applied, check.counts.error], [true, [], 1], "--check: nothing safe is left to apply");
});

test("stdout carries the deck and stderr the report; --format text lists the fixes; YAML stays YAML", async () => {
  const deck = await copy("fix-region-pin.opf.json");
  const piped = spawn(["fix", deck], 0);
  assert.deepEqual(JSON.parse(piped.stdout).slides[0].blocks.map((block) => block.region), ["aside", "body"]);
  assert.equal(JSON.parse(piped.stderr).command, "fix");
  const text = spawn(["fix", deck, "--check", "--format", "text"], 1).stdout;
  assert.match(text, /fix-region-pin\.opf\.json:\/slides\/0\/blocks\/0\/region {2}to fix {2}opf\/region-unknown {2}rename-region: Pin to aside/);
  assert.match(text, /would apply 3 safe fixes in 2 rounds; 0 findings left/);
  const yaml = path.join(temp, "custom.opf.yaml");
  await writeFile(yaml, ["name: Launch plan", "language: en-US", "slides:", "  - title: Make the next launch count", "    layout: custom:story", "    blocks:", "      - text: A clearer launch plan starts with the people who will use it.", "catalogs:", "  custom:", "    layouts:", "      story:", "        name: Story", "        regions:", "          - name: title", "          - name: main", "            accepts: [text]", "            flow: none", ""].join("\n"));
  run(["fix", yaml, "-i"], 0);
  const written = await readFile(yaml, "utf8");
  assert.doesNotMatch(written, /^\s*\{/);
  assert.match(written, /max: 1/);
  assert.doesNotMatch(written, /flow: none/);
  assert.equal(spawn(["fix", deck, "-i", "--check"], 2).status, 2);
});
