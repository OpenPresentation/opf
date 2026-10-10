// Slide file names (RR-77): `opf convert` and core's `convert` name per-slide files the same way: `{n}` in a .png or .svg output is
// the slide number, and every number is padded to the width of the largest number written. Drawing runs against stand-in opf-render
// and opf-pptx packages (scripts/stub-peers.mjs) in a tree holding a copy of the CLI and of core, so the CLI and the API are run on
// the same deck side by side. `opf fill` pads its `{n}` through the same helper.
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { cp, mkdir, mkdtemp, readdir, realpath, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { after, before, describe, test } from "node:test";
import { fileURLToPath } from "node:url";
import { installIsolatedCore } from "../../../scripts/isolated-core.mjs";
import { installStubPeers } from "../../../scripts/stub-peers.mjs";

const cliRoot = fileURLToPath(new URL("..", import.meta.url));
const executable = process.env.OPF_TEST_BIN ?? path.join(cliRoot, "dist", "index.js");
const TEMPLATE = path.join(cliRoot, "test", "fixtures", "template.opf.json");
const temp = await realpath(await mkdtemp(path.join(tmpdir(), "opf-slide-names-")));
after(() => rm(temp, { recursive: true, force: true }));

const deckOf = (count, name = "Names deck") => ({ name, slides: Array.from({ length: count }, (_, index) => ({ title: `Slide ${index + 1}` })) });
const sequence = (count, name, extension, width) => Array.from({ length: count }, (_, index) => `${name}${String(index + 1).padStart(width, "0")}.${extension}`);
const walk = async (dir, prefix = "") => {
  const names = [];
  for (const item of await readdir(dir, { withFileTypes: true })) names.push(...(item.isDirectory() ? await walk(path.join(dir, item.name), `${prefix}${item.name}/`) : [`${prefix}${item.name}`]));
  return names.sort();
};

const API = [
  'import * as opf from "@openpresentation/opf";',
  'import { readFileSync } from "node:fs";',
  'const [deck, output, options] = [JSON.parse(readFileSync(process.argv[2], "utf8")), process.argv[3], JSON.parse(process.argv[4])];',
  "try { await opf.convert(deck, output, options); } catch (error) { process.stdout.write(JSON.stringify({ code: error.code })); process.exit(1); }",
].join("\n");

let tree;
let counter = 0;
before(async () => {
  tree = await mkdtemp(path.join(temp, "stub-"));
  await cp(path.dirname(executable), path.join(tree, "dist"), { recursive: true });
  await installIsolatedCore(path.join(tree, "node_modules"));
  await installStubPeers(path.join(tree, "node_modules"));
  await writeFile(path.join(tree, "api.mjs"), API);
});

/** A folder of its own holding deck.opf.json with `count` slides. */
async function folder(count) {
  const dir = path.join(tree, `case-${++counter}`);
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, "deck.opf.json"), JSON.stringify(deckOf(count)));
  return dir;
}
const cli = (args, cwd, status = 0) => {
  const result = spawnSync(process.execPath, [path.join(tree, "dist", path.basename(executable)), ...args], { cwd, encoding: "utf8", timeout: 120000 });
  assert.equal(result.status, status, JSON.stringify({ args, stdout: result.stdout.slice(0, 1500), stderr: result.stderr.slice(0, 1500) }));
  return { stdout: result.stdout, stderr: result.stderr, error: status === 0 ? undefined : JSON.parse(result.stderr.slice(result.stderr.indexOf("{"))) };
};
/** The files `opf convert` and core's `convert` write for the same deck and output, each in a folder of its own. */
async function both(count, output, { flags = [], options = {} } = {}) {
  const viaCli = await folder(count);
  cli(["convert", "deck.opf.json", output, ...flags], viaCli);
  const viaApi = await folder(count);
  const result = spawnSync(process.execPath, [path.join(tree, "api.mjs"), "deck.opf.json", output, JSON.stringify(options)], { cwd: viaApi, encoding: "utf8" });
  assert.equal(result.status, 0, result.stdout + result.stderr);
  const [fromCli, fromApi] = [(await walk(viaCli)).filter((name) => !["deck.opf.json", "log.jsonl"].includes(name)), (await walk(viaApi)).filter((name) => !["deck.opf.json", "log.jsonl"].includes(name))];
  assert.deepEqual(fromCli, fromApi, `opf convert and convert name ${output} alike`);
  return fromCli;
}

describe("{n} in the output of opf convert and convert", () => {
  test("3, 12 and 120 slides give widths 1, 2 and 3, the same through the CLI and the API", async () => {
    assert.deepEqual(await both(3, "slides/slide-{n}.png"), sequence(3, "slides/slide-", "png", 1));
    assert.deepEqual(await both(12, "slides/slide-{n}.svg"), sequence(12, "slides/slide-", "svg", 2).sort());
    assert.deepEqual(await both(120, "slide-{n}.png"), sequence(120, "slide-", "png", 3).sort());
  });

  test("--slides 2,5 numbers by the deck's slide numbers; a one-slide deck and one selected slide are still numbered", async () => {
    assert.deepEqual(await both(12, "slide-{n}.png", { flags: ["--slides", "2,5"], options: { slides: "2,5" } }), ["slide-2.png", "slide-5.png"]);
    assert.deepEqual(await both(12, "slide-{n}.png", { flags: ["--slides", "2,10"], options: { slides: "2,10" } }), ["slide-02.png", "slide-10.png"]);
    assert.deepEqual(await both(1, "cover-{n}.svg"), ["cover-1.svg"]);
    assert.deepEqual(await both(12, "only-{n}.png", { flags: ["--slides", "7"], options: { slides: "7" } }), ["only-7.png"]);
  });

  test("the plain form pads the same way and still writes one slide to the output name itself", async () => {
    assert.deepEqual(await both(5, "slides/deck.png"), sequence(5, "slides/deck-", "png", 1));
    assert.deepEqual(await both(12, "slides/deck.png"), sequence(12, "slides/deck-", "png", 2).sort());
    assert.deepEqual(await both(12, "deck.png", { flags: ["--slides", "2,5"], options: { slides: "2,5" } }), ["deck-2.png", "deck-5.png"]);
    assert.deepEqual(await both(1, "cover.png"), ["cover.png"]);
    assert.deepEqual(await both(12, "second.svg", { flags: ["--slides", "2"], options: { slides: "2" } }), ["second.svg"]);
  });

  test("zip entries use the plain rule; {n} is refused for a .zip", async () => {
    const dir = await folder(12);
    const report = JSON.parse(cli(["convert", "deck.opf.json", "slides.zip"], dir).stdout);
    assert.deepEqual(report.outputs[0].entries, sequence(12, "slides-", "png", 2).sort());
    const short = await folder(3);
    assert.deepEqual(JSON.parse(cli(["convert", "deck.opf.json", "short.zip", "--to", "svg"], short).stdout).outputs[0].entries, ["short-1.svg", "short-2.svg", "short-3.svg"]);
    assert.equal(cli(["convert", "deck.opf.json", "slides-{n}.zip"], dir, 2).error.code, "invalid-option");
  });

  test("{n} in a single-file output, and any other key, are usage errors (exit 2, invalid-option) that write nothing", async () => {
    const dir = await folder(3);
    for (const output of ["deck-{n}.pdf", "deck-{n}.pptx", "deck-{n}.opf.md", "deck-{n}.opf.yaml", "deck-{n}.json", "slide-{id}.png", "slide-{n}-{title}.svg", "slide-{}.png"]) {
      const failed = cli(["convert", "deck.opf.json", output], dir, 2);
      assert.equal(failed.error.code, "invalid-option", output);
    }
    assert.match(cli(["convert", "deck.opf.json", "deck-{n}.pdf"], dir, 2).error.error, /\{n\}.*single file/);
    assert.match(cli(["convert", "deck.opf.json", "slide-{id}.png"], dir, 2).error.error, /Unknown \{id\}/);
    assert.deepEqual((await walk(dir)).filter((name) => name !== "log.jsonl"), ["deck.opf.json"]);
  });
});

describe("opf fill pads {n} through the same helper", () => {
  const csvOf = (count) => ["client,revenue,kickoff,wins", ...Array.from({ length: count }, (_, index) => `Client ${index + 1},${index + 1},2026-01-01,x`)].join("\n");
  async function fillNames(count) {
    const dir = await mkdtemp(path.join(temp, "fill-"));
    await writeFile(path.join(dir, "rows.csv"), csvOf(count));
    const result = spawnSync(process.execPath, [executable, "fill", TEMPLATE, path.join(dir, "rows.csv"), path.join(dir, "out", "deck-{n}.opf.json")], { encoding: "utf8" });
    assert.equal(result.status, 0, result.stderr);
    return walk(path.join(dir, "out"));
  }

  test("3, 12 and 120 records give widths 1, 2 and 3", async () => {
    assert.deepEqual(await fillNames(3), sequence(3, "deck-", "opf.json", 1));
    assert.deepEqual(await fillNames(12), sequence(12, "deck-", "opf.json", 2).sort());
    assert.deepEqual((await fillNames(120)).slice(0, 2), ["deck-001.opf.json", "deck-002.opf.json"]);
  });
});
