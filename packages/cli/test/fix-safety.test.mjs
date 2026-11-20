// OPF 0.35: what `opf fix` promises. It applies the repair checks' safe fixes by default and an audit's only with --audits; it never
// recolors text; it marks each fix that can change how a slide draws, in JSON and in --format text; a removed design key leaves no empty
// `design`; and a fix a person writes (focus-language, focus-alt) is never applied nor counted, so --check exits 0 when it is all there is.
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtemp, readFile, realpath, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { after, before, test } from "node:test";
import { fileURLToPath } from "node:url";

const executable = process.env.OPF_TEST_BIN ?? fileURLToPath(new URL("../dist/index.js", import.meta.url));
let temp;
before(async () => { temp = await realpath(await mkdtemp(path.join(tmpdir(), "opf-cli-fix-safety-"))); });
after(async () => { await rm(temp, { recursive: true, force: true }); });
const spawn = (args, status) => {
  const result = spawnSync(process.execPath, [executable, ...args], { cwd: temp, encoding: "utf8", timeout: 120000, maxBuffer: 64 * 1024 * 1024 });
  assert.equal(result.status, status, JSON.stringify({ args, stdout: result.stdout.slice(0, 2000), stderr: result.stderr.slice(0, 2000) }));
  return result;
};
const run = (args, status) => {
  const result = spawn(args, status);
  return JSON.parse(result.stdout || result.stderr);
};
const write = async (name, deck) => {
  const file = path.join(temp, name);
  await writeFile(file, `${JSON.stringify(deck, null, 2)}\n`);
  return file;
};
const readJson = async (file) => JSON.parse(await readFile(file, "utf8"));
const paragraphs = [{ text: "First paragraph of the slide that is reasonably long." }, { text: "Second paragraph also of decent length here." }];

test("--check with only fixes a person writes (focus-language, focus-alt) exits 0 and counts no safe fix", async () => {
  const deck = await write("focus.opf.json", { name: "Focus", slides: [{ title: "Picture", image: "https://example.com/a.png" }] });
  const report = run(["fix", deck, "--check"], 0);
  assert.equal(report.ok, true);
  assert.deepEqual([report.fix.applied, report.fix.changesDrawing, report.fix.audits], [[], 0, []]);
  assert.ok(report.findings.some((finding) => finding.fixes?.some((entry) => entry.id === "focus-language" && entry.kind === "focus")));
  const text = spawn(["fix", deck, "--check", "--format", "text", "--audits"], 0).stdout;
  assert.match(text, /fix: focus-language: Set the language \(you write it\)/);
  assert.match(text, /would apply 0 safe fixes; /);
});

test("a contrast finding keeps the author's color, with or without --audits", async () => {
  const deck = await write("faint.opf.json", { name: "Faint", language: "en-US", design: { background: "#FFFFFF" }, slides: [{ title: "Faint run", text: ["Readable and ", { text: "faint", color: "#CCCCCC" }] }] });
  for (const extra of [[], ["--audits"]]) {
    const report = run(["fix", deck, "--check", ...extra], 0);
    assert.deepEqual(report.fix.applied, []);
    assert.deepEqual(report.fix.unsafe.map((entry) => entry.fixes), [["use-readable-color"]]);
  }
  run(["fix", deck, "-i", "--audits"], 0);
  assert.equal((await readJson(deck)).slides[0].text[1].color, "#CCCCCC");
});

test("--audits applies an audit's safe fix; without it the report lists the finding in audits", async () => {
  const deck = await write("case.opf.json", { name: "Case", language: "EN-us", slides: [{ title: "Auto", layout: "auto", text: "Composed automatically." }] });
  const repair = run(["fix", deck, "--check"], 1);
  assert.deepEqual(repair.fix.applied.map((entry) => entry.fix), ["remove-layout-auto"]);
  assert.deepEqual(repair.fix.audits, [{ ruleId: "opf/language-tag", path: "/language", fixes: ["use-canonical-tag"] }]);
  const text = spawn(["fix", deck, "--check", "--format", "text"], 1).stdout;
  assert.match(text, /fix: use-canonical-tag: Use 'en-US' \(an audit's: --audits applies it\)/);
  assert.match(text, /1 audit finding has a safe fix that --audits applies\./);
  const all = run(["fix", deck, "--check", "--audits"], 1);
  assert.deepEqual(all.fix.applied.map((entry) => entry.fix).sort(), ["remove-layout-auto", "use-canonical-tag"]);
  assert.equal(Object.hasOwn(all.fix, "audits"), false, "with --audits nothing is left for it");
  run(["fix", deck, "-i"], 0);
  assert.equal((await readJson(deck)).language, "EN-us", "a migration does not touch the audits");
  assert.equal(run(["fix", deck, "--check"], 0).fix.audits.length, 1, "--check exits 0: only an audit's fix is left");
});

test("each fix applied says whether it changes the drawing, in JSON and in --format text", async () => {
  const deck = await write("layouts.opf.json", {
    name: "Layouts",
    language: "en-US",
    slides: [
      { title: "Agenda", layout: "agenda-split", items: ["Intro", "Plan", "Close"] },
      { title: "Down", layout: "vertical-flow", items: ["One", "Two", "Three"] },
    ],
  });
  const report = run(["fix", deck, "--check"], 1);
  assert.deepEqual(report.fix.applied.map((entry) => [entry.path, entry.fix, entry.changesDrawing]), [
    ["/slides/0/layout", "rename-layout", true],
    ["/slides/1/layout", "rename-layout", false],
  ]);
  assert.equal(report.fix.changesDrawing, 1);
  const text = spawn(["fix", deck, "--check", "--format", "text"], 1).stdout;
  assert.match(text, /\/slides\/0\/layout {2}to fix {2}opf\/unresolved-reference {2}rename-layout: Use layout agenda with the title beside it {2}\(changes the drawing\)\n/);
  assert.match(text, /\/slides\/1\/layout {2}to fix {2}opf\/unresolved-reference {2}rename-layout: Use layout vertical-process\n/);
  assert.match(text, /would apply 2 safe fixes in 1 round \(1 changes the drawing\); /);
  assert.match(spawn(["fix", "--help"], 0).stdout, /--audits/);
});

test("a removed design key leaves no empty design: slide, deck and layout record, alone or two in one design", async () => {
  const deck = await write("empty.opf.json", {
    name: "Empty",
    language: "en-US",
    design: { contentDirection: "vertical" },
    slides: [
      { title: "One key", design: { contentDirection: "vertical" }, blocks: paragraphs },
      { title: "Two keys", design: { contentDirection: "horizontal", chartPrimary: "start" }, blocks: paragraphs },
      { title: "Kept", design: { chartPrimary: "start", titleAlignment: "center" }, blocks: paragraphs },
      { title: "Mine", layout: "custom:mine", blocks: paragraphs },
    ],
    catalogs: { custom: { layouts: { mine: { name: "Mine", regions: [{ name: "title" }, { name: "body", accepts: ["text"] }], design: { contentDirection: "horizontal" } } } } },
  });
  const report = run(["fix", deck, "-i"], 0);
  assert.equal(report.fix.applied.length, 6);
  assert.ok(report.fix.applied.every((entry) => entry.changesDrawing));
  const fixed = await readJson(deck);
  assert.equal(Object.hasOwn(fixed, "design"), false);
  assert.deepEqual(fixed.slides.map((slide) => slide.design), [undefined, undefined, { titleAlignment: "center" }, undefined]);
  assert.equal(Object.hasOwn(fixed.catalogs.custom.layouts.mine, "design"), false);
  assert.doesNotMatch(await readFile(deck, "utf8"), /"design": \{\}/);
  assert.equal(run(["validate", deck], 0).counts.error, 0);
});
