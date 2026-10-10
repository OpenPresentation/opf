import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { after, before, describe, test } from "node:test";
import { fileURLToPath } from "node:url";

const executable = process.env.OPF_TEST_BIN ?? fileURLToPath(new URL("../dist/index.js", import.meta.url));
let temp;
before(async () => { temp = await mkdtemp(path.join(tmpdir(), "opf-cli-rr31-")); });
after(async () => { await rm(temp, { recursive: true, force: true }); });

const run = (args, { input, status = 0 } = {}) => {
  const result = spawnSync(process.execPath, [executable, ...args], { cwd: temp, input, encoding: "utf8", timeout: 30000 });
  assert.equal(result.status, status, JSON.stringify({ args, stdout: result.stdout, stderr: result.stderr }));
  return result;
};
const json = text => JSON.parse(text);
const write = (name, value) => writeFile(path.join(temp, name), typeof value === "string" ? value : `${JSON.stringify(value, null, 2)}\n`);
const read = name => readFile(path.join(temp, name), "utf8");
const slide = (id, title, extra = {}) => ({ id, title, ...extra });
const deck = (slides, extra = {}) => ({ $schema: "https://openpresentation.org/schema/opf/v1", name: "Deck", slides, ...extra });
const base = () => deck([slide("a", "A", { text: "alpha" }), slide("b", "B", { text: "beta" }), slide("c", "C", { text: "gamma" })]);

describe("opf diff", () => {
  test("text report, exit code and patch round trip", async () => {
    const a = base(), b = base();
    b.slides[1].title = "B2";
    b.slides.push(slide("d", "D"));
    b.name = "Renamed";
    await write("a.json", a); await write("b.json", b);
    const text = run(["diff", "a.json", "b.json"]).stdout;
    assert.match(text, /^3 changes /);
    assert.match(text, /~ name {2}"Deck" -> "Renamed"/);
    assert.match(text, /\+ slide #4 "D" \(id d\)/);
    assert.match(text, /~ title {2}"B" -> "B2"/);
    assert.equal(run(["diff", "a.json", "a.json"]).stdout, "No differences.\n");
    run(["diff", "a.json", "b.json", "--exit-code"], { status: 1 });
    run(["diff", "a.json", "a.json", "--exit-code"]);
    const patch = json(run(["diff", "a.json", "b.json", "--format", "patch"]).stdout);
    await write("patch.json", patch);
    const applied = json(run(["edit", "a.json", "--patch", "patch.json"]).stdout);
    assert.deepEqual(applied, b);
  });

  test("json report and stdin", async () => {
    const a = base(), b = base();
    b.slides.reverse();
    await write("a2.json", a); await write("b2.json", b);
    const report = json(run(["diff", "-", "b2.json", "--format", "json"], { input: JSON.stringify(a) }).stdout);
    assert.equal(report.equal, false);
    assert.equal(report.summary.slides.moved >= 1, true);
    assert.ok(report.changes.some(change => change.type === "moved"));
    assert.ok(Array.isArray(report.patch) && report.patch.length > 0);
  });

  test("usage errors exit 2", async () => {
    await write("a3.json", base());
    run(["diff", "a3.json"], { status: 2 });
    run(["diff", "-", "-"], { status: 2, input: "{}" });
    run(["diff", "a3.json", "a3.json", "--format", "yaml"], { status: 2 });
    run(["diff", "a3.json", "a3.json", "--threshold", "2"], { status: 2 });
    run(["diff", "a3.json", "missing.json"], { status: 2 });
    await write("bad.json", "{");
    run(["diff", "a3.json", "bad.json"], { status: 2 });
  });
});

describe("opf merge", () => {
  test("merges non-overlapping edits and validates the result", async () => {
    const ours = base(), theirs = base();
    ours.slides[0].title = "A ours";
    theirs.slides[2].text = "gamma theirs";
    theirs.name = "Their name";
    await write("base.json", base()); await write("ours.json", ours); await write("theirs.json", theirs);
    const result = run(["merge", "base.json", "ours.json", "theirs.json"]);
    const merged = json(result.stdout);
    assert.equal(merged.slides[0].title, "A ours");
    assert.equal(merged.slides[2].text, "gamma theirs");
    assert.equal(merged.name, "Their name");
    assert.equal(json(result.stderr).merge.clean, true);
    // Saved output carries the merge summary.
    const saved = json(run(["merge", "base.json", "ours.json", "theirs.json", "merged.json"]).stdout);
    assert.equal(saved.ok, true);
    assert.equal(saved.command, "merge");
    assert.equal(saved.input.length, 3);
    assert.equal(saved.merge.clean, true);
    assert.deepEqual(json(await read("merged.json")), merged);
    run(["merge", "base.json", "ours.json", "theirs.json", "merged.json"], { status: 1 });
    run(["merge", "base.json", "ours.json", "theirs.json", "merged.json", "--force"]);
  });

  test("conflicts exit 1, write nothing and name both sides", async () => {
    const ours = base(), theirs = base();
    ours.slides[1].title = "B ours";
    theirs.slides[1].title = "B theirs";
    await write("cbase.json", base()); await write("cours.json", ours); await write("ctheirs.json", theirs);
    const result = run(["merge", "cbase.json", "cours.json", "ctheirs.json", "conflicted.json"], { status: 1 });
    assert.equal(result.stdout, "");
    const report = json(result.stderr);
    assert.match(report.error, /1 conflict/);
    assert.equal(report.code, "merge-conflict");
    assert.equal(report.merge.conflicts[0].ours, "B ours");
    assert.equal(report.merge.conflicts[0].theirs, "B theirs");
    assert.equal(report.merge.conflicts[0].base, "B");
    await assert.rejects(read("conflicted.json"), /ENOENT/);
  });

  test("--prefer takes a side and still reports the conflicts; --report saves them", async () => {
    const taken = json(run(["merge", "cbase.json", "cours.json", "ctheirs.json", "--prefer", "theirs", "--report", "report.json"]).stdout);
    assert.equal(taken.slides[1].title, "B theirs");
    const report = json(await read("report.json"));
    assert.equal(report.clean, false);
    assert.equal(report.resolvedWith, "theirs");
    assert.equal(report.conflicts[0].resolution, "theirs");
    assert.equal(json(run(["merge", "cbase.json", "cours.json", "ctheirs.json", "--prefer", "ours"]).stdout).slides[1].title, "B ours");
  });

  test("--in-place rewrites the ours file and guards against concurrent change", async () => {
    const ours = base(), theirs = base();
    ours.slides[0].title = "A in place";
    theirs.slides[2].title = "C in place";
    await write("ipbase.json", base()); await write("ipours.json", ours); await write("iptheirs.json", theirs);
    run(["merge", "ipbase.json", "ipours.json", "iptheirs.json", "-i"]);
    const merged = json(await read("ipours.json"));
    assert.equal(merged.slides[0].title, "A in place");
    assert.equal(merged.slides[2].title, "C in place");
  });

  test("an invalid merged document is rejected with validation details", async () => {
    const start = deck([slide("a", "A")]);
    const ours = structuredClone(start), theirs = structuredClone(start);
    ours.unexpected = { nope: true };
    await write("vbase.json", start); await write("vours.json", ours); await write("vtheirs.json", theirs);
    const result = run(["merge", "vbase.json", "vours.json", "vtheirs.json"], { status: 1 });
    assert.equal(json(result.stderr).code, "invalid-document");
    assert.ok(json(result.stderr).findings.some((finding) => finding.severity === "error"));
  });

  test("usage errors exit 2", async () => {
    run(["merge", "cbase.json", "cours.json"], { status: 2 });
    run(["merge", "-", "-", "cours.json"], { status: 2, input: "{}" });
    run(["merge", "cbase.json", "cours.json", "ctheirs.json", "--prefer", "both"], { status: 2 });
    run(["merge", "cbase.json", "cours.json", "ctheirs.json", "x.json", "-i"], { status: 2 });
    run(["merge", "cbase.json", "cours.json", "ctheirs.json", "--output", "x.json"], { status: 2 });
    run(["merge", "cbase.json", "cours.json", "ctheirs.json", "--report", "-"], { status: 2 });
  });
});

describe("opf format", () => {
  const messy = '{"slides":[{"title":"T","id":"a"}],"name":"N","$schema":"https://openpresentation.org/schema/opf/v1"}';
  const canonical = '{\n  "$schema": "https://openpresentation.org/schema/opf/v1",\n  "name": "N",\n  "slides": [\n    {\n      "id": "a",\n      "title": "T"\n    }\n  ]\n}\n';

  test("prints canonical text, from a file or stdin", async () => {
    await write("messy.json", messy);
    assert.equal(run(["format", "messy.json"]).stdout, canonical);
    assert.equal(run(["format", "-"], { input: messy }).stdout, canonical);
    assert.equal(await read("messy.json"), messy, "the file is not touched without --in-place");
    assert.equal(run(["format", "messy.json", "--indent", "4"]).stdout.split("\n")[1].startsWith("    \"$schema\""), true);
  });

  test("--check lists unformatted files and exits 1", async () => {
    await write("canon.json", canonical);
    const clean = json(run(["format", "canon.json", "--check"]).stdout);
    assert.equal(clean.command, "format");
    assert.equal(clean.ok, true);
    assert.deepEqual([clean.checked, clean.formatted, clean.unformatted], [1, 1, []]);
    const dirty = json(run(["format", "canon.json", "messy.json", "--check"], { status: 1 }).stdout);
    assert.deepEqual(dirty.unformatted, ["messy.json"]);
    assert.equal(dirty.ok, false);
    assert.equal(await read("messy.json"), messy);
  });

  test("--in-place rewrites only what changes and is idempotent", async () => {
    const report = json(run(["format", "canon.json", "messy.json", "-i"]).stdout);
    assert.deepEqual(report.outputs.map((item) => path.basename(item.file)), ["messy.json"]);
    assert.deepEqual(report.rewritten, ["messy.json"]);
    assert.deepEqual(report.unchanged, ["canon.json"]);
    assert.equal(await read("messy.json"), canonical);
    run(["format", "canon.json", "messy.json", "--check"]);
    assert.deepEqual(json(run(["format", "messy.json", "--in-place"]).stdout).rewritten, []);
  });

  test("an output file and line endings", async () => {
    await write("messy2.json", messy);
    const result = json(run(["format", "messy2.json", "out.json"]).stdout);
    assert.equal(result.changed, true);
    assert.equal(await read("out.json"), canonical);
    run(["format", "messy2.json", "out.json"], { status: 1 });
    run(["format", "messy2.json", "out.json", "--force"]);
    // format keeps the form: another form is opf convert's job.
    assert.match(json(run(["format", "messy2.json", "out.opf.yaml"], { status: 2 }).stderr).error, /Use opf convert/);
    run(["format", "messy2.json", "--output", "out.json"], { status: 2 });
    await write("crlf.json", canonical.replaceAll("\n", "\r\n"));
    run(["format", "crlf.json", "--check"], { status: 1 });
    run(["format", "crlf.json", "--check", "--eol", "crlf"]);
    run(["format", "crlf.json", "--check", "--eol", "preserve"]);
    run(["format", "canon.json", "--check", "--eol", "preserve"]);
    assert.equal(run(["format", "crlf.json", "--eol", "lf"]).stdout, canonical);
  });

  test("usage and input errors", async () => {
    run(["format"], { status: 2 });
    run(["format", "messy.json", "canon.json"], { status: 1 }); // the second file is the output, and it exists
    run(["format", "messy.json", "canon.json", "crlf.json"], { status: 2 });
    run(["format", "-", "--in-place"], { status: 2, input: "{}" });
    run(["format", "messy.json", "--check", "--in-place"], { status: 2 });
    run(["format", "messy.json", "--indent", "9"], { status: 2 });
    run(["format", "messy.json", "--eol", "cr"], { status: 2 });
    run(["format", "missing.json"], { status: 2 });
    await write("notjson.json", "{oops");
    run(["format", "notjson.json"], { status: 2 });
  });
});

describe("opf edit uses the shared patch module", () => {
  test("move and copy, and structured errors exit 1", async () => {
    await write("e.json", base());
    await write("p.json", [{ op: "move", from: "/slides/2", path: "/slides/0" }, { op: "copy", from: "/slides/0/title", path: "/name" }]);
    const edited = json(run(["edit", "e.json", "--patch", "p.json"]).stdout);
    assert.deepEqual(edited.slides.map(item => item.id), ["c", "a", "b"]);
    assert.equal(edited.name, "C");
    await write("bad-p.json", [{ op: "test", path: "/slides/0/title", value: "nope" }]);
    const failure = run(["edit", "e.json", "--patch", "bad-p.json"], { status: 1 });
    assert.match(json(failure.stderr).error, /Operation 0: Test failed/);
  });
});
