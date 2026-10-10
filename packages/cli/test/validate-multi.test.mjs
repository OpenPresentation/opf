// RR-75: opf validate over several files, folders and stdin in one run. One input keeps its report; several give
// { command, ok, files, counts }; the exit status is the worst of them; --format github prints workflow annotations.
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdir, mkdtemp, realpath, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { after, before, describe, test } from "node:test";
import { fileURLToPath } from "node:url";

const executable = process.env.OPF_TEST_BIN ?? fileURLToPath(new URL("../dist/index.js", import.meta.url));
const temp = await realpath(await mkdtemp(path.join(tmpdir(), "opf-validate-multi-")));
after(() => rm(temp, { recursive: true, force: true }));
const run = (args, { status = 0, input } = {}) => {
  const result = spawnSync(process.execPath, [executable, ...args], { cwd: temp, input, encoding: "utf8", timeout: 60000 });
  assert.equal(result.status, status, JSON.stringify({ args, stdout: result.stdout.slice(0, 1500), stderr: result.stderr.slice(0, 1500) }));
  return result;
};
const write = async (name, value) => {
  await mkdir(path.dirname(path.join(temp, name)), { recursive: true });
  await writeFile(path.join(temp, name), typeof value === "string" ? value : JSON.stringify(value, null, 2));
};
const clean = { name: "Clean", language: "en-US", slides: [{ title: "Hello", text: "A readable slide." }] };
const warned = { name: "Warned", language: "en-US", slides: [{ title: "Target", layout: "pratner" }] };

before(async () => {
  await write("decks/b.opf.json", clean);
  await write("decks/a.opf.yaml", "name: A\nlanguage: en-US\nslides:\n  - title: Hello\n    text: A readable slide.\n");
  await write("decks/nested/c.opf.md", "---\nname: C\nlanguage: en-US\n---\n\n# Hello\n\nA readable slide.\n");
  await write("decks/notes.md", "# not a deck\n");
  await write("decks/data.json", "{}");
  await write("decks/node_modules/skip.opf.json", "{");
  await write("decks/.hidden/skip.opf.json", "{");
  await write("warned.opf.json", warned);
  await write("invalid.opf.json", { slides: 42 });
  await write("empty/readme.txt", "nothing");
});

describe("opf validate over several inputs", () => {
  test("a folder is searched for *.opf.json, *.opf.yaml, *.opf.yml and *.opf.md, sorted, skipping node_modules and dot folders", () => {
    const report = JSON.parse(run(["validate", "decks"]).stdout);
    assert.equal(report.command, "validate");
    assert.equal(report.ok, true);
    assert.deepEqual(report.files.map((item) => path.relative(temp, item.file).split(path.sep).join("/")), ["decks/a.opf.yaml", "decks/b.opf.json", "decks/nested/c.opf.md"]);
    for (const item of report.files) {
      assert.deepEqual(Object.keys(item).slice(0, 6), ["command", "ok", "input", "outputs", "findings", "counts"]);
      assert.equal(item.valid, true);
    }
    assert.deepEqual(Object.keys(report.counts), ["error", "warning", "info"]);
  });

  test("one input keeps today's report; several give { command, ok, files, counts } with the counts summed", () => {
    const one = JSON.parse(run(["validate", "warned.opf.json"]).stdout);
    assert.equal(one.files, undefined);
    assert.equal(one.valid, true);
    assert.equal(one.file, path.join(temp, "warned.opf.json"));
    const several = JSON.parse(run(["validate", "warned.opf.json", "decks/b.opf.json", "-"], { input: JSON.stringify(clean) }).stdout);
    assert.equal(several.files.length, 3);
    assert.equal(several.files[2].file, null, "stdin");
    assert.equal(several.counts.warning, several.files.reduce((sum, item) => sum + item.counts.warning, 0));
    assert.ok(several.counts.warning >= 1);
  });

  test("the exit status is the worst over every file: 1 for findings at --fail-on, 2 for an unreadable file", () => {
    run(["validate", "decks", "warned.opf.json"]);
    const failed = JSON.parse(run(["validate", "decks", "warned.opf.json", "--fail-on", "warning"], { status: 1 }).stdout);
    assert.equal(failed.ok, false);
    assert.deepEqual(failed.files.map((item) => item.ok), [true, true, true, false]);
    run(["validate", "decks", "invalid.opf.json"], { status: 1 });
    const missing = JSON.parse(run(["validate", "invalid.opf.json", "missing.opf.json"], { status: 2 }).stdout);
    assert.equal(missing.files[1].code, "input-not-found");
    assert.equal(missing.files[0].valid, false, "the readable file is still checked");
    run(["validate", "empty"], { status: 2 });
    run(["validate", "-", "-"], { status: 2, input: "{}" });
  });

  test("--format github prints one workflow annotation per finding, with the file, line and column", () => {
    const result = run(["validate", "warned.opf.json", "invalid.opf.json", "--format", "github"], { status: 1 });
    const lines = result.stdout.trim().split("\n");
    assert.ok(lines.every((line) => /^::(error|warning|notice) file=[^,]+(,line=\d+,col=\d+)?,title=[^:]+::/.test(line)), result.stdout);
    assert.ok(lines.some((line) => line.startsWith("::warning file=warned.opf.json,line=") && line.includes("title=opf/unresolved-reference::")));
    assert.ok(lines.some((line) => line.startsWith("::error file=invalid.opf.json")));
    assert.equal(run(["validate", "decks", "--format", "github"]).stdout.includes("::error"), false);
    run(["validate", "--list-rules", "--format", "github"], { status: 2 });
  });

  test("--format text separates the files and ends each with its summary", () => {
    const text = run(["validate", "decks/b.opf.json", "warned.opf.json", "--format", "text"]).stdout;
    assert.match(text, /^decks\/b\.opf\.json: 0 findings/m);
    assert.match(text, /^warned\.opf\.json: \d+ findings?/m);
  });
});
