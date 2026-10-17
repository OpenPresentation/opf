// RR-88 / RR-91: `opf convert --body-text` and `--slide-numbers` reach opf-pptx's toPptx, apply to .pptx output only, and are refused
// by an opf-pptx that predates them. Drawing runs against stand-in peers that record what the engine asks of them.
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
  temp = await realpath(await mkdtemp(path.join(tmpdir(), "opf-convert-text-")));
  for (const [name, version] of [["new", "0.21.0"], ["old", "0.20.4"]]) {
    const dir = path.join(temp, name);
    await cp(path.dirname(executable), path.join(dir, "dist"), { recursive: true });
    await installIsolatedCore(path.join(dir, "node_modules"));
    await installStubPeers(path.join(dir, "node_modules"), { "opf-pptx": version });
    await writeFile(path.join(dir, "deck.opf.json"), JSON.stringify({ name: "Stub deck", slides: [{ title: "One" }, { title: "Two" }] }));
    sites[name] = { dir, bin: path.join(dir, "dist", path.basename(executable)) };
  }
});
after(() => rm(temp, { recursive: true, force: true }));

const run = (site, args, status = 0) => {
  const result = spawnSync(process.execPath, [site.bin, ...args], { cwd: site.dir, encoding: "utf8", timeout: 120000, env: { ...process.env, npm_config_user_agent: "" } });
  assert.equal(result.status, status, JSON.stringify({ args, stdout: result.stdout.slice(0, 2000), stderr: result.stderr.slice(0, 2000) }));
  return result;
};
const pptxCalls = async (site) => parseStubLog(await readFile(path.join(site.dir, STUB_LOG), "utf8").catch(() => "")).filter((item) => item.call === "toPptx");
const fresh = (site) => writeFile(path.join(site.dir, STUB_LOG), "");

describe("opf convert --body-text and --slide-numbers", () => {
  test("they reach toPptx as bodyText and slideNumberWithText", async () => {
    await fresh(sites.new);
    run(sites.new, ["convert", "deck.opf.json", "native.pptx", "--body-text", "native", "--slide-numbers", "static"]);
    const [first] = await pptxCalls(sites.new);
    assert.equal(first.args[0].bodyText, "native");
    assert.equal(first.args[0].slideNumberWithText, "static");
    await fresh(sites.new);
    run(sites.new, ["convert", "deck.opf.json", "live.pptx", "--slide-numbers", "live", "--force"]);
    const [second] = await pptxCalls(sites.new);
    assert.equal(second.args[0].slideNumberWithText, "field");
    assert.equal("bodyText" in second.args[0], false);
  });

  test("without them toPptx gets neither option", async () => {
    await fresh(sites.new);
    run(sites.new, ["convert", "deck.opf.json", "plain.pptx"]);
    const [call] = await pptxCalls(sites.new);
    assert.equal("bodyText" in call.args[0] || "slideNumberWithText" in call.args[0], false);
  });

  test("other values are usage errors (exit 2)", () => {
    assert.match(JSON.parse(run(sites.new, ["convert", "deck.opf.json", "x.pptx", "--body-text", "wrapped"], 2).stderr).error, /--body-text must be one of: measured, native/);
    assert.match(JSON.parse(run(sites.new, ["convert", "deck.opf.json", "x.pptx", "--slide-numbers", "field"], 2).stderr).error, /--slide-numbers must be one of: static, live/);
  });

  test("they are refused for any output but .pptx", () => {
    for (const output of ["x.svg", "x.png", "x.pdf", "x.opf.yaml"]) {
      for (const flags of [["--body-text", "native"], ["--slide-numbers", "static"]]) {
        const failed = JSON.parse(run(sites.new, ["convert", "deck.opf.json", output, ...flags], 2).stderr).error;
        assert.match(failed, /--body-text|--slide-numbers/, `${output} ${flags.join(" ")}`);
        assert.match(failed, /pptx|export outputs/);
      }
    }
  });

  test("an opf-pptx that predates them is refused, naming the flag, not silently ignored", async () => {
    await fresh(sites.old);
    const failed = JSON.parse(run(sites.old, ["convert", "deck.opf.json", "old.pptx", "--body-text", "native"], 2).stderr);
    assert.match(failed.error, /--body-text native needs @openpresentation\/opf-pptx@0\.21\.0 or later; 0\.20\.4 is installed/);
    assert.equal((await pptxCalls(sites.old)).length, 0);
    run(sites.old, ["convert", "deck.opf.json", "old-measured.pptx", "--body-text", "measured"]);
    assert.equal((await pptxCalls(sites.old)).length, 1);
  });

  test("convert --help documents both flags", () => {
    const help = run(sites.new, ["convert", "--help"]).stdout;
    assert.match(help, /--body-text <measured\|native>/);
    assert.match(help, /--slide-numbers <static\|live>/);
  });
});
