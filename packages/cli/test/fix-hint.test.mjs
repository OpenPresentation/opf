// OPF 0.35: a writing command that refuses a deck names `opf fix <deck> -i` when the deck's findings carry a safe fix (a 0.34
// cell key, a stale embedded copy, ...), keeps `opf embed <deck> -i` for stale copies, and says nothing of it otherwise.
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtemp, realpath, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { after, before, test } from "node:test";
import { fileURLToPath } from "node:url";

const executable = process.env.OPF_TEST_BIN ?? fileURLToPath(new URL("../dist/index.js", import.meta.url));
const STALE = fileURLToPath(new URL("./fixtures/stale-0.34-cover.opf.json", import.meta.url));
const FIX = /`opf fix <deck> -i` applies (it|them), then validate again\./;
let temp;
before(async () => { temp = await realpath(await mkdtemp(path.join(tmpdir(), "opf-cli-fix-hint-"))); });
after(async () => { await rm(temp, { recursive: true, force: true }); });
const run = (args, status) => {
  const result = spawnSync(process.execPath, [executable, ...args], { cwd: temp, encoding: "utf8", timeout: 120000 });
  assert.equal(result.status, status, JSON.stringify({ args, stdout: result.stdout.slice(0, 2000), stderr: result.stderr.slice(0, 2000) }));
  return JSON.parse(result.stdout || result.stderr);
};
const deck = async (name, slides) => {
  const file = path.join(temp, name);
  await writeFile(file, JSON.stringify({ name: "Hint", language: "en-US", slides }));
  return file;
};

test("convert, paginate and embed name opf fix for a deck with 0.34 cell keys", async () => {
  const file = await deck("cells.opf.json", [{ title: "Context and plan", start: { text: "Context" }, "center+end": { text: "The plan." } }]);
  for (const args of [["convert", file, path.join(temp, "cells.svg")], ["paginate", file, "-i"], ["embed", file, "-i"]]) {
    const refused = run(args, 1);
    assert.equal(refused.code, "invalid-document", args[0]);
    assert.match(refused.error, /2 findings carry a safe fix: `opf fix <deck> -i` applies them, then validate again\.$/, args[0]);
    assert.doesNotMatch(refused.error, /opf embed/, args[0]);
  }
});

test("a stale embedded copy gets both commands, the embed hint last", () => {
  const refused = run(["convert", STALE, path.join(temp, "cover.svg")], 1);
  assert.equal(refused.code, "invalid-document");
  assert.match(refused.error, FIX);
  assert.match(refused.error, /`opf embed <deck> -i` refreshes each one it can without changing what it draws; validate again after it\.$/);
  assert.ok(refused.error.indexOf("opf fix") < refused.error.indexOf("opf embed"));
});

test("no hint when no finding carries a safe fix, and none from opf fix itself", async () => {
  const file = await deck("chart.opf.json", [{ title: "A", chart: { type: "nonsense-chart", data: { columns: ["a", "b"], rows: [["x", 1]] } } }]);
  const refused = run(["convert", file, path.join(temp, "chart.svg")], 1);
  assert.equal(refused.code, "invalid-document");
  assert.match(refused.error, /chart\.opf\.json is not valid OPF; nothing was written\.$/);
  const fixed = spawnSync(process.execPath, [executable, "fix", file], { cwd: temp, encoding: "utf8", timeout: 120000 });
  assert.doesNotMatch(fixed.stdout + fixed.stderr, FIX);
});
