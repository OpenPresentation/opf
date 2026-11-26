// opf#1469, opf#1471: a valid deck with two named cells, one text opening with "Label:", validates, draws and exports (it stopped every
// engine with "Cannot read properties of undefined (reading 'some')"), and `opf fix` of the 0.34 form of that slide ends with a valid deck;
// `opf fix` also removes the embedded layout record "auto" that fails its schema once no slide names it, so the fixed deck validates.
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtemp, readFile, realpath, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { after, before, test } from "node:test";
import { fileURLToPath } from "node:url";

const executable = process.env.OPF_TEST_BIN ?? fileURLToPath(new URL("../dist/index.js", import.meta.url));
let temp;
before(async () => { temp = await realpath(await mkdtemp(path.join(tmpdir(), "opf-cli-placed-run-in-"))); });
after(async () => { await rm(temp, { recursive: true, force: true }); });
const run = (args, status) => {
  const result = spawnSync(process.execPath, [executable, ...args], { cwd: temp, encoding: "utf8", timeout: 120000, maxBuffer: 64 * 1024 * 1024 });
  assert.equal(result.status, status, JSON.stringify({ args, stdout: result.stdout.slice(0, 2000), stderr: result.stderr.slice(0, 2000) }));
  return JSON.parse(result.stdout || result.stderr);
};
const write = async (name, value) => { const file = path.join(temp, name); await writeFile(file, JSON.stringify(value)); return file; };
const placed = { language: "en-US", slides: [{ blocks: [{ region: "top:start", text: "a: b" }, { region: "bottom:end", text: "c" }] }] };

test("opf validate, SVG, PNG and PPTX of the placed deck succeed", async () => {
  const deck = await write("placed.json", placed);
  assert.equal(run(["validate", deck], 0).ok, true);
  for (const out of ["placed.svg", "placed.png", "placed.pptx"]) {
    assert.equal(run(["convert", deck, path.join(temp, out)], 0).ok, true, out);
    assert.ok((await stat(path.join(temp, out))).size > 1000, out);
  }
  const svg = await readFile(path.join(temp, "placed.svg"), "utf8");
  assert.match(svg, /font-weight="700"[^>]*>a:<\/tspan>|font-weight="700"[^>]*>a:<\/text>/, "the run-in heading is bold");
});

for (const layout of [undefined, "auto"]) {
  test(`opf fix of the 0.34 form of the slide${layout ? ' with layout "auto"' : ""} ends with a valid deck`, async () => {
    const legacy = { language: "en-US", slides: [{ ...(layout ? { layout } : {}), "top:start": { text: "a: b" }, "bottom:end": { text: "c" } }] };
    const input = await write(`legacy-${layout ?? "none"}.json`, legacy);
    const output = path.join(temp, `fixed-${layout ?? "none"}.json`);
    const report = run(["fix", input, output], 0);
    assert.equal(report.ok, true);
    assert.deepEqual(JSON.parse(await readFile(output, "utf8")), placed);
    assert.equal(run(["validate", output], 0).ok, true);
  });
}

test('opf fix removes the embedded layout record "auto" that fails its schema, and the fixed deck validates', async () => {
  const input = await write("auto-record.json", { language: "en-US", catalogs: { custom: { layouts: { auto: { name: "Auto", regions: "not regions" } } } }, slides: [{ layout: "auto", title: "T" }] });
  const output = path.join(temp, "auto-record.fixed.json");
  const report = run(["fix", input, output], 0);
  assert.equal(report.ok, true);
  assert.ok(report.fix.applied.some((entry) => /embedded layout record "auto"/.test(entry.title)), JSON.stringify(report.fix.applied));
  const fixed = JSON.parse(await readFile(output, "utf8"));
  assert.deepEqual(fixed.slides, [{ title: "T" }]);
  assert.equal(fixed.catalogs?.custom?.layouts?.auto, undefined);
  assert.equal(run(["validate", output], 0).ok, true);
});
