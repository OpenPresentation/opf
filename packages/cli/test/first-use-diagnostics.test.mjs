// RR-93, CLI side: `opf validate` checks local images, `opf stats` prints source metadata apart from the data, and a write works
// where the file system refuses hard links.
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdir, mkdtemp, readFile, readdir, realpath, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { after, before, describe, test } from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";

const executable = process.env.OPF_TEST_BIN ?? fileURLToPath(new URL("../dist/index.js", import.meta.url));
let temp;
// The real path: on macOS tmpdir() is a symlink (/var -> /private/var) and the CLI reports resolved paths (opf#547).
before(async () => { temp = await realpath(await mkdtemp(path.join(tmpdir(), "opf-cli-rr93-"))); });
after(async () => { await rm(temp, { recursive: true, force: true }); });

const run = (args, { input, status = 0, cwd = temp, node = [] } = {}) => {
  const result = spawnSync(process.execPath, [...node, executable, ...args], { cwd, input, encoding: "utf8", timeout: 30000 });
  assert.equal(result.status, status, JSON.stringify({ args, stdout: result.stdout, stderr: result.stderr }));
  return result;
};
const SVG = "<svg xmlns='http://www.w3.org/2000/svg' width='4' height='4'/>";
const deck = {
  name: "Assets",
  language: "en-US",
  organization: { id: "pike", name: "Pike", logo: { src: "assets/pike-logo.svg", alt: "Pike" } },
  slides: [
    { title: "Hero", image: { src: "assets/hero.svg", alt: "Hero" } },
    { title: "Remote", image: { src: "https://example.com/a.png", alt: "Remote" } },
  ],
};

describe("opf validate: local images", () => {
  test("a relative image that does not exist is a cli/asset-missing warning, as convert would stop on it", async () => {
    await writeFile(path.join(temp, "deck.opf.json"), JSON.stringify(deck));
    const report = JSON.parse(run(["validate", "deck.opf.json"]).stdout);
    const missing = report.findings.filter((finding) => finding.ruleId === "cli/asset-missing");
    assert.deepEqual(missing.map((finding) => [finding.path, finding.severity]), [["/organization/logo/src", "warning"], ["/slides/0/image/src", "warning"]]);
    assert.match(missing[0].message, /^Image "assets\/pike-logo\.svg" was not read: no such file under /);
    assert.equal(missing[1].slide, 0);
    assert.equal(report.counts.warning >= 2, true);
    assert.equal(report.valid, true);
    run(["validate", "deck.opf.json", "--fail-on", "warning"], { status: 1 });
  });

  test("--asset-dir (and the deck's own folder) decide where files are looked for; present files pass", async () => {
    await mkdir(path.join(temp, "pictures", "assets"), { recursive: true });
    await writeFile(path.join(temp, "pictures", "assets", "pike-logo.svg"), SVG);
    await writeFile(path.join(temp, "pictures", "assets", "hero.svg"), SVG);
    const quiet = (extra) => JSON.parse(run(["validate", "deck.opf.json", ...extra]).stdout).findings.filter((finding) => finding.ruleId.startsWith("cli/"));
    assert.deepEqual(quiet(["--asset-dir", "pictures"]), []);
    assert.equal(quiet([]).length, 2);
    // The deck lives elsewhere: its own folder is the default, as for convert.
    await mkdir(path.join(temp, "elsewhere"), { recursive: true });
    await writeFile(path.join(temp, "elsewhere", "deck.opf.json"), JSON.stringify(deck));
    assert.equal(JSON.parse(run(["validate", "elsewhere/deck.opf.json"]).stdout).findings.filter((finding) => finding.ruleId === "cli/asset-missing").length, 2);
    run(["validate", "deck.opf.json", "--asset-dir", "no-such-folder"], { status: 2 });
  });

  test("the text format names the file and path; --ignore asset-missing and --only leave the check out", () => {
    const text = run(["validate", "deck.opf.json", "--format", "text"]).stdout;
    assert.match(text, /^deck\.opf\.json:\/slides\/0\/image\/src {2}warning cli\/asset-missing {2}Image "assets\/hero\.svg"/m);
    const ignored = JSON.parse(run(["validate", "deck.opf.json", "--ignore", "asset-missing"]).stdout);
    assert.equal(ignored.findings.some((finding) => finding.ruleId === "cli/asset-missing"), false);
    const only = JSON.parse(run(["validate", "deck.opf.json", "--only", "format"]).stdout);
    assert.equal(only.findings.some((finding) => finding.ruleId === "cli/asset-missing"), false);
  });

  test("a schema error is printed with one line naming the other forms", async () => {
    const bad = { name: "Padding", slides: [{ table: { columns: ["A"], rows: [[{ value: "1", style: { padding: 12 } }]] } }] };
    const text = run(["validate", "-", "--format", "text"], { input: JSON.stringify(bad), status: 1 }).stdout;
    assert.match(text, /^stdin:1:\d+ {2}error {3}opf\/schema {2}must be object$/m);
    assert.match(text, /^ {4}\/slides\/0\/table\/rows\/0\/0\/style\/padding {2}\(slide 1\)$/m);
    assert.match(text, /^ {4}other forms: TableCellValue: must be string, number, boolean, null or array$/m);
    assert.equal(text.split("\n").filter((line) => line.includes("opf/schema")).length, 1);
  });
});

describe("opf stats: chart sources", () => {
  test("inline data with data.source is inline data with a recorded source", () => {
    const withSource = { name: "S", slides: [{ chart: { type: "column", data: { columns: ["A", "B"], rows: [["x", 1]], source: { src: "./a.csv", retrieved: "2026-10-05" } } } }] };
    const text = run(["stats", "-", "--format", "text"], { input: JSON.stringify(withSource) }).stdout;
    assert.match(text, /^Charts {9}1 \(column 1\); data inline 1, dataset 0; 1 with a recorded source$/m);
    assert.deepEqual(JSON.parse(run(["stats", "-"], { input: JSON.stringify(withSource) }).stdout).stats.charts.data, { inline: 1, dataset: 0, withSource: 1 });
  });
});

describe("opf create where hard links are refused", () => {
  test("EPERM from link falls back to an exclusive create; an existing file is still never replaced", async () => {
    const preload = path.join(temp, "no-links.mjs");
    await writeFile(preload, [
      'import fsp from "node:fs/promises";',
      'import { syncBuiltinESMExports } from "node:module";',
      'fsp.link = async () => { throw Object.assign(new Error("EPERM: operation not permitted, link"), { code: "EPERM" }); };',
      "syncBuiltinESMExports();",
    ].join("\n"));
    // A preload is an import specifier: a Windows path (C:\...) is not one, so pass its file: URL.
    const node = ["--import", pathToFileURL(preload).href];
    await mkdir(path.join(temp, "sandbox"));
    const created = JSON.parse(run(["create", "made.opf.json", "--title", "Decision"], { cwd: path.join(temp, "sandbox"), node }).stdout);
    assert.equal(created.ok, true);
    const file = path.join(temp, "sandbox", "made.opf.json");
    const original = await readFile(file, "utf8");
    assert.equal(JSON.parse(original).slides[0].title, "Decision");
    run(["create", "made.opf.json", "--title", "Other"], { cwd: path.join(temp, "sandbox"), node, status: 1 });
    assert.equal(await readFile(file, "utf8"), original);
    // Nothing is left beside the output: the staged temporary file is removed.
    assert.deepEqual(await readdir(path.join(temp, "sandbox")), ["made.opf.json"]);
  });
});
