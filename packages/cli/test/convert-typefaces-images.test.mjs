// LH-28 / LH-20: `opf convert --typefaces safe` and `--as images` reach opf-pptx's toPptx, apply to .pptx output only, and are refused by
// an opf-pptx that predates them. A normal export notes the families that are not Office-safe. Drawing runs against stand-in peers.
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { cp, mkdtemp, readFile, realpath, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { after, before, describe, test } from "node:test";
import { fileURLToPath } from "node:url";
import { installIsolatedCore } from "../../../scripts/isolated-core.mjs";
import { STUB_LOG, installStubPeers, parseStubLog } from "../../../scripts/stub-peers.mjs";

const executable = process.env.OPF_TEST_BIN ?? fileURLToPath(new URL("../dist/index.js", import.meta.url));
let temp;
const sites = {};
before(async () => {
  temp = await realpath(await mkdtemp(path.join(tmpdir(), "opf-convert-typefaces-")));
  for (const [name, typefaces] of [["new", true], ["old", false]]) {
    const dir = path.join(temp, name);
    await cp(path.dirname(executable), path.join(dir, "dist"), { recursive: true });
    await installIsolatedCore(path.join(dir, "node_modules"));
    await installStubPeers(path.join(dir, "node_modules"), { "opf-pptx": "0.31.0" }, { typefaces });
    await writeFile(path.join(dir, "deck.opf.json"), JSON.stringify({ name: "Stub deck", slides: [{ title: "One", notes: "Hello" }, { title: "Two" }] }));
    sites[name] = { dir, bin: path.join(dir, "dist", path.basename(executable)) };
  }
});
after(() => rm(temp, { recursive: true, force: true }));

const run = (site, args, status = 0) => {
  const result = spawnSync(process.execPath, [site.bin, ...args], { cwd: site.dir, encoding: "utf8", timeout: 120000, env: { ...process.env, npm_config_user_agent: "" } });
  assert.equal(result.status, status, JSON.stringify({ args, stdout: result.stdout.slice(0, 2000), stderr: result.stderr.slice(0, 2000) }));
  return result;
};
const calls = async (site, name) => parseStubLog(await readFile(path.join(site.dir, STUB_LOG), "utf8").catch(() => "")).filter((item) => item.call === name);
const fresh = (site) => writeFile(path.join(site.dir, STUB_LOG), "");
const usage = (args) => JSON.parse(run(sites.new, args, 2).stderr).error;

describe("opf convert --typefaces", () => {
  test("safe reaches toPptx; a normal export reports the families that are not Office-safe", async () => {
    await fresh(sites.new);
    const plain = JSON.parse(run(sites.new, ["convert", "deck.opf.json", "plain.pptx"]).stdout);
    const [first] = await calls(sites.new, "toPptx");
    assert.equal("typefaces" in first.args[0], false);
    const note = plain.findings.find((finding) => finding.ruleId === "pptx/typeface-not-office-safe");
    assert.deepEqual([note.severity, note.families], ["info", ["Stub Sans"]]);
    assert.match(note.help, /--typefaces safe/);
    await fresh(sites.new);
    const safe = JSON.parse(run(sites.new, ["convert", "deck.opf.json", "safe.pptx", "--typefaces", "safe"]).stdout);
    const [second] = await calls(sites.new, "toPptx");
    assert.equal(second.args[0].typefaces, "safe");
    assert.equal(safe.findings.some((finding) => finding.ruleId === "pptx/typeface-not-office-safe"), false, "safe mode needs no note");
    assert.deepEqual(await calls(sites.new, "typefacesNotOfficeSafe"), []);
  });

  test("other values and other outputs are usage errors (exit 2)", () => {
    assert.match(usage(["convert", "deck.opf.json", "x.pptx", "--typefaces", "office"]), /--typefaces must be one of: selected, safe/);
    assert.match(usage(["convert", "deck.opf.json", "x.pdf", "--typefaces", "safe"]), /--typefaces/);
    assert.match(usage(["convert", "deck.opf.json", "x.opf.yaml", "--typefaces", "safe"]), /--typefaces applies to pdf, pptx, png and svg outputs/);
  });

  test("an opf-pptx without it is refused, not ignored", () => {
    const failure = JSON.parse(run(sites.old, ["convert", "deck.opf.json", "x.pptx", "--typefaces", "safe"], 2).stderr);
    assert.equal(failure.code, "peer-too-old");
    assert.match(failure.error, /--typefaces safe needs a newer @openpresentation\/opf-pptx/);
  });
});

describe("opf convert --as images", () => {
  test("it reaches toPptx with the picture scale and a slide rasterizer that draws with opf-render", async () => {
    await fresh(sites.new);
    const report = JSON.parse(run(sites.new, ["convert", "deck.opf.json", "pictures.pptx", "--as", "images"]).stdout);
    const [call] = await calls(sites.new, "toPptx");
    assert.equal(call.args[0].as, "images");
    assert.equal(call.args[0].scale, 2, "2 by default");
    assert.equal(report.findings.some((finding) => finding.ruleId === "pptx/typeface-not-office-safe"), false, "pictures name no fonts");
    await fresh(sites.new);
    run(sites.new, ["convert", "deck.opf.json", "small.pptx", "--as", "images", "--scale", "1"]);
    assert.equal((await calls(sites.new, "toPptx"))[0].args[0].scale, 1);
  });

  test("the text, chart and record options do not apply to pictures (exit 2)", () => {
    assert.match(usage(["convert", "deck.opf.json", "x.pptx", "--as", "slides"]), /--as must be one of: native, images/);
    assert.match(usage(["convert", "deck.opf.json", "x.pptx", "--as", "images", "--typefaces", "safe"]), /--typefaces does not apply to --as images/);
    assert.match(usage(["convert", "deck.opf.json", "x.pptx", "--as", "images", "--body-text", "native", "--charts", "native"]), /do not apply to --as images/);
    assert.match(usage(["convert", "deck.opf.json", "x.pptx", "--scale", "2"]), /--scale applies to png output/);
    assert.match(usage(["convert", "deck.opf.json", "x.png", "--as", "images"]), /--as/);
  });

  test("an opf-pptx without it is refused", () => {
    assert.equal(JSON.parse(run(sites.old, ["convert", "deck.opf.json", "x.pptx", "--as", "images"], 2).stderr).code, "peer-too-old");
  });
});
