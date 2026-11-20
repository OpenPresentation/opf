// OPF 0.35: `opf embed -i` replaces a deck's stale copies of built-in layouts with the current records (fixture: pptx.gallery's
// how-to-create-title-slides, trimmed), still refuses other invalid content, and the writing commands name `opf embed -i` when such
// copies are why they refuse.
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { copyFile, mkdtemp, readFile, realpath, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { after, before, test } from "node:test";
import { fileURLToPath } from "node:url";

const executable = process.env.OPF_TEST_BIN ?? fileURLToPath(new URL("../dist/index.js", import.meta.url));
const FIXTURE = fileURLToPath(new URL("./fixtures/stale-0.34-cover.opf.json", import.meta.url));
let temp;
before(async () => { temp = await realpath(await mkdtemp(path.join(tmpdir(), "opf-cli-stale-"))); });
after(async () => { await rm(temp, { recursive: true, force: true }); });
const run = (args, status) => {
  const result = spawnSync(process.execPath, [executable, ...args], { cwd: temp, encoding: "utf8", timeout: 120000 });
  assert.equal(result.status, status, JSON.stringify({ args, stdout: result.stdout.slice(0, 2000), stderr: result.stderr.slice(0, 2000) }));
  return JSON.parse(result.stdout || result.stderr);
};

test("validate names the stale copy and does not call it missing", () => {
  const report = run(["validate", FIXTURE], 1);
  const record = report.findings.find((finding) => finding.path === "/catalogs/default/layouts/cover/regions/1/flow");
  assert.match(record.help, /is a copy of the built-in layout 'cover' from before OPF 0\.35/);
  assert.deepEqual(record.fixes.map((fix) => [fix.id, fix.safe, fix.changesDrawing]), [["use-current-record", true, true]]);
  const slide = report.findings.find((finding) => finding.path === "/slides/0/layout");
  assert.match(slide.message, /^Layout 'cover' is embedded in catalogs\.default, but the record fails the layout schema/);
});

test("embed -i replaces the copy with the current record, reports it, and the deck then validates", async () => {
  const deck = path.join(temp, "cover.opf.json");
  await copyFile(FIXTURE, deck);
  const check = run(["embed", deck, "--check"], 1);
  assert.deepEqual(check.embed.refreshed.map((entry) => `${entry.id} ${entry.how}`), ["cover current"]);
  const report = run(["embed", deck, "-i"], 0);
  assert.deepEqual(report.embed.refreshed, [{ group: "default", kind: "layouts", id: "cover", source: "https://www.pptx.gallery", how: "current", changesDrawing: true, references: [] }]);
  const written = JSON.parse(await readFile(deck, "utf8"));
  assert.equal(written.catalogs.default.layouts.cover.regions[1].flow, undefined);
  assert.equal(run(["validate", deck], 0).counts.error, 0);
  assert.deepEqual(run(["embed", deck, "--check"], 0).embed.refreshed, []);
});

test("embed -i still refuses other invalid content, and convert names the command that fixes the copies", async () => {
  const deck = path.join(temp, "other.opf.json");
  const value = JSON.parse(await readFile(FIXTURE, "utf8"));
  value.slides[0].design.contentDirection = "horizontal";
  await writeFile(deck, JSON.stringify(value));
  const refused = run(["embed", deck, "-i"], 1);
  assert.equal(refused.code, "invalid-document");
  assert.deepEqual(refused.findings.filter((finding) => finding.severity === "error").map((finding) => finding.path), ["/slides/0/design/contentDirection"]);
  assert.equal(JSON.parse(await readFile(deck, "utf8")).catalogs.default.layouts.cover.regions[1].flow, "none", "nothing was written");
  const converted = run(["convert", FIXTURE, path.join(temp, "cover.svg")], 1);
  assert.equal(converted.code, "invalid-document");
  assert.match(converted.error, /The deck embeds copies of built-in layouts from before OPF 0\.35 \(cover\): `opf embed <deck> -i` replaces each one with the current record/);
});
