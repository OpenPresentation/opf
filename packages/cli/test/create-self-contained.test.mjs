// `opf create`: a starter deck validates clean (it names a language), an example that uses image files is created with them, and
// the asset-missing hint says what convert does.
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdir, mkdtemp, readFile, readdir, realpath, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { after, before, test } from "node:test";
import { fileURLToPath } from "node:url";

const executable = process.env.OPF_TEST_BIN ?? fileURLToPath(new URL("../dist/index.js", import.meta.url));
let temp;
before(async () => { temp = await realpath(await mkdtemp(path.join(tmpdir(), "opf-cli-create-"))); });
after(async () => { await rm(temp, { recursive: true, force: true }); });
const run = (args, { cwd = temp, status = 0 } = {}) => {
  const result = spawnSync(process.execPath, [executable, ...args], { cwd, encoding: "utf8", timeout: 60000 });
  assert.equal(result.status, status, JSON.stringify({ args, stdout: result.stdout, stderr: result.stderr }));
  return result;
};

test("a created starter deck validates with no findings; --language sets the tag", async () => {
  const dir = path.join(temp, "starter");
  await mkdir(dir);
  run(["create", "deck.opf.json", "--title", "Hello"], { cwd: dir });
  const deck = JSON.parse(await readFile(path.join(dir, "deck.opf.json"), "utf8"));
  assert.equal(deck.language, "en-US");
  assert.deepEqual(JSON.parse(run(["validate", "deck.opf.json"], { cwd: dir }).stdout).findings, []);
  run(["create", "de.opf.json", "--title", "Hallo", "--language", "de-DE"], { cwd: dir });
  assert.equal(JSON.parse(await readFile(path.join(dir, "de.opf.json"), "utf8")).language, "de-DE");
  run(["create", "x.opf.json", "--example", "minimal", "--language", "de-DE"], { cwd: dir, status: 2 });
});

test("create --example copies the image files the deck names; validate then finds none missing", async () => {
  const dir = path.join(temp, "example");
  await mkdir(dir);
  const created = JSON.parse(run(["create", "deck.opf.json", "--example", "header-footer-logo-set"], { cwd: dir }).stdout);
  const written = created.outputs.map((output) => path.relative(dir, output.file).replaceAll("\\", "/")).sort();
  assert.deepEqual(written, ["assets/icon.svg", "assets/logo-dark.svg", "assets/logo-light.svg", "assets/watermark.png", "assets/wordmark.svg", "deck.opf.json"]);
  assert.deepEqual((await readdir(path.join(dir, "assets"))).sort(), written.filter((name) => name.startsWith("assets/")).map((name) => name.slice(7)));
  const findings = JSON.parse(run(["validate", "deck.opf.json"], { cwd: dir }).stdout).findings;
  assert.deepEqual(findings.filter((finding) => finding.ruleId.startsWith("cli/asset")), []);
});

test("create --example refuses to overwrite an existing asset unless --force, and writes nothing then", async () => {
  const dir = path.join(temp, "collide");
  await mkdir(path.join(dir, "assets"), { recursive: true });
  await writeFile(path.join(dir, "assets", "icon.svg"), "mine");
  const refused = run(["create", "deck.opf.json", "--example", "header-footer-logo-set"], { cwd: dir, status: 1 });
  assert.match(refused.stderr, /icon\.svg/);
  assert.deepEqual(await readdir(dir), ["assets"]);
  assert.equal(await readFile(path.join(dir, "assets", "icon.svg"), "utf8"), "mine");
  run(["create", "deck.opf.json", "--example", "header-footer-logo-set", "--force"], { cwd: dir });
  assert.notEqual(await readFile(path.join(dir, "assets", "icon.svg"), "utf8"), "mine");
});

test("the asset-missing hint says convert draws a placeholder and stops only with --fail-on warning", async () => {
  const dir = path.join(temp, "hint");
  await mkdir(dir);
  await writeFile(path.join(dir, "deck.opf.json"), JSON.stringify({ name: "D", language: "en-US", slides: [{ title: "T", image: { src: "./nope.png", alt: "x" } }] }));
  const finding = JSON.parse(run(["validate", "deck.opf.json"], { cwd: dir }).stdout).findings.find((item) => item.ruleId === "cli/asset-missing");
  assert.match(finding.help, /placeholder/);
  assert.match(finding.help, /--fail-on warning/);
  assert.doesNotMatch(finding.help, /convert stops on it/);
});
