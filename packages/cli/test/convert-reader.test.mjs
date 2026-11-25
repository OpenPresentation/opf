// NT-09: `opf convert --reader keynote` writes the same PPTX as the flags it stands for, `--reader powerpoint` the default PPTX, and a
// flag given beside it wins. It applies to .pptx output only, not with --as images, and an opf-pptx without readerOptions refuses it.
// The exports run against the workspace's own opf-render and opf-pptx; the old peer is a stand-in (scripts/stub-peers.mjs).
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
const KEYNOTE_FLAGS = ["--typefaces", "safe", "--slide-numbers", "static", "--smart-art", "shapes", "--body-text", "native"];
const deck = {
  name: "Reader deck",
  design: { footer: { end: { text: "{{slide.number}} / {{deck.slideCount}}" } } },
  slides: [
    { title: "Margins widened", text: "Quarterly revenue grew in every region while operating costs held flat, which lifted the margin by four points." },
    { title: "Three steps", items: ["Discover", "Build", "Launch"] },
  ],
};
let temp;
let old;
before(async () => {
  temp = await realpath(await mkdtemp(path.join(tmpdir(), "opf-convert-reader-")));
  await writeFile(path.join(temp, "deck.opf.json"), JSON.stringify(deck));
  old = path.join(temp, "old");
  await cp(path.dirname(executable), path.join(old, "dist"), { recursive: true });
  await installIsolatedCore(path.join(old, "node_modules"));
  await installStubPeers(path.join(old, "node_modules"), { "opf-pptx": "0.36.0" }, { typefaces: true });
  await writeFile(path.join(old, "deck.opf.json"), JSON.stringify(deck));
});
after(() => rm(temp, { recursive: true, force: true }));

const run = (args, { status = 0, cwd = temp, bin = executable } = {}) => {
  const result = spawnSync(process.execPath, [bin, ...args], { cwd, encoding: "utf8", timeout: 120000, maxBuffer: 16 * 1024 * 1024, env: { ...process.env, npm_config_user_agent: "" } });
  assert.equal(result.status, status, JSON.stringify({ args, stdout: result.stdout.slice(0, 2000), stderr: result.stderr.slice(0, 2000) }));
  return result;
};
const exported = async (name, flags) => {
  const report = JSON.parse(run(["convert", "deck.opf.json", name, "--date", "2026-11-25", ...flags]).stdout);
  return { report, bytes: await readFile(path.join(temp, name)) };
};
const noted = (report) => report.findings.some((finding) => finding.ruleId === "pptx/typeface-not-office-safe");

describe("opf convert --reader", () => {
  test("keynote is its flags, powerpoint is the default, and a flag beside it wins", async () => {
    const plain = await exported("plain.pptx", []);
    const powerpoint = await exported("powerpoint.pptx", ["--reader", "powerpoint"]);
    assert.ok(powerpoint.bytes.equals(plain.bytes), "--reader powerpoint writes the default PPTX");
    assert.equal(noted(powerpoint.report), noted(plain.report));
    const keynote = await exported("keynote.pptx", ["--reader", "keynote"]);
    const flags = await exported("flags.pptx", KEYNOTE_FLAGS);
    assert.ok(keynote.bytes.equals(flags.bytes), "--reader keynote writes what its four flags write");
    assert.equal(keynote.report.outputs[0].sha256, flags.report.outputs[0].sha256);
    assert.ok(!keynote.bytes.equals(plain.bytes));
    assert.equal(noted(keynote.report), false, "safe typefaces need no note");
    const selected = await exported("selected.pptx", ["--reader", "keynote", "--typefaces", "selected"]);
    const selectedFlags = await exported("selected-flags.pptx", [...KEYNOTE_FLAGS.slice(2), "--typefaces", "selected"]);
    assert.ok(selected.bytes.equals(selectedFlags.bytes), "--typefaces selected wins over the reader's set");
    assert.equal(noted(selected.report), true, "the note follows the typefaces in effect");
    assert.match(selected.report.findings.find((finding) => finding.ruleId === "pptx/typeface-not-office-safe").help, /--reader keynote/);
  });

  test("other values, other outputs and --as images are usage errors (exit 2)", () => {
    const usage = (args) => JSON.parse(run(args, { status: 2 }).stderr).error;
    assert.match(usage(["convert", "deck.opf.json", "x.pptx", "--reader", "impress"]), /--reader must be one of: powerpoint, keynote/);
    assert.match(usage(["convert", "deck.opf.json", "x.pdf", "--reader", "keynote"]), /--reader/);
    assert.match(usage(["convert", "deck.opf.json", "x.opf.yaml", "--reader", "keynote"]), /--reader applies to pdf, pptx, png and svg outputs/);
    assert.match(usage(["convert", "deck.opf.json", "x.pptx", "--reader", "keynote", "--as", "images"]), /--reader does not apply to --as images/);
  });

  test("an opf-pptx without readerOptions refuses it and writes nothing", async () => {
    await writeFile(path.join(old, STUB_LOG), "");
    const failed = JSON.parse(run(["convert", "deck.opf.json", "old.pptx", "--reader", "keynote"], { status: 2, cwd: old, bin: path.join(old, "dist", path.basename(executable)) }).stderr);
    assert.match(failed.error, /--reader keynote needs a newer @openpresentation\/opf-pptx/);
    const calls = parseStubLog(await readFile(path.join(old, STUB_LOG), "utf8").catch(() => "")).filter((item) => item.call === "toPptx");
    assert.equal(calls.length, 0);
  });

  test("the help names the flag and what it sets", () => {
    const help = run(["convert", "--help"]).stdout;
    assert.match(help, /--reader <powerpoint\|keynote>/);
    assert.match(help, /keynote sets --typefaces safe --slide-numbers static --smart-art shapes/);
  });
});
