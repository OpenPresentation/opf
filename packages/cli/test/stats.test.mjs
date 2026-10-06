import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { after, before, describe, test } from "node:test";
import { fileURLToPath } from "node:url";

import { stats } from "@openpresentation/opf";

const executable = process.env.OPF_TEST_BIN ?? fileURLToPath(new URL("../dist/index.js", import.meta.url));
let temp;
before(async () => { temp = await mkdtemp(path.join(tmpdir(), "opf-cli-stats-")); });
after(async () => { await rm(temp, { recursive: true, force: true }); });

const run = (args, { input, status = 0 } = {}) => {
  const result = spawnSync(process.execPath, [executable, ...args], { cwd: temp, input, encoding: "utf8", timeout: 30000 });
  assert.equal(result.status, status, JSON.stringify({ args, stdout: result.stdout, stderr: result.stderr }));
  return result;
};
const deck = {
  name: "CLI facts",
  language: "en-US",
  organization: { id: "acme", name: "Acme" },
  slides: [
    { id: "intro", title: "Intro", layout: "title", section: "Open", notes: "Say hello to everyone" },
    { id: "data", title: "Data", section: "Open", chart: { type: "column", data: { columns: ["A", "B"], rows: [["x", 1]] } }, table: { columns: ["A"], rows: [["b"]] } },
    { id: "pic", title: "Picture", image: "./nothing.png", hidden: true },
  ],
};

describe("opf stats", () => {
  test("prints the same facts as stats(), as JSON by default, and never validates or composes", async () => {
    await writeFile(path.join(temp, "deck.opf.json"), JSON.stringify(deck));
    const result = run(["stats", "deck.opf.json"]);
    assert.equal(result.stderr, "");
    assert.deepEqual(JSON.parse(result.stdout), stats(deck));
    assert.equal(JSON.parse(result.stdout).slides.total, 3);
    assert.equal("perSlide" in JSON.parse(result.stdout), false);
    // A deck that fails validation still has facts.
    const invalid = run(["stats", "-"], { input: JSON.stringify({ slides: [{ title: 1, unknownField: true }] }) });
    assert.equal(JSON.parse(invalid.stdout).slides.total, 1);
  });

  test("--per-slide adds a row per slide", () => {
    const result = JSON.parse(run(["stats", "deck.opf.json", "--per-slide"]).stdout);
    assert.deepEqual(result.perSlide.map((row) => row.id), ["intro", "data", "pic"]);
    assert.deepEqual(result.perSlide, stats(deck, { perSlide: true }).perSlide);
  });

  test("--format text is a readable summary of the same facts", () => {
    const text = run(["stats", "-", "--format", "text"], { input: JSON.stringify(deck) }).stdout;
    assert.match(text, /^CLI facts\n/);
    assert.match(text, /^Slides {9}3, 1 hidden \(pic\); 3 with a title$/m);
    assert.match(text, /^Notes {10}1 of 3 slides have notes; none on data, pic$/m);
    assert.match(text, /^Charts {9}1 \(column 1\)/m);
    assert.match(text, /^Speaking time {2}0 min from the notes \(estimate at 130 wpm\)/m);
    assert.doesNotMatch(text, /Per slide/);
    const perSlide = run(["stats", "-", "--format", "text", "--per-slide"], { input: JSON.stringify(deck) }).stdout;
    assert.match(perSlide, /\nPer slide\n {2} {2}1 {2}intro {2}title {2}"Intro"/);
  });

  test("usage and input errors exit 2 (unreadable or malformed input) or 1 (not a presentation)", () => {
    run(["stats"], { status: 2 });
    run(["stats", "deck.opf.json", "--format", "yaml"], { status: 2 });
    run(["stats", "missing.opf.json"], { status: 2 });
    run(["stats", "-"], { input: "{not json", status: 2 });
    run(["stats", "-"], { input: "[1, 2]", status: 1 });
    run(["stats", "deck.opf.json", "--bogus"], { status: 2 });
  });

  test("is listed in the usage text", () => {
    assert.match(run(["--help"]).stdout, /opf stats <file\|-> \[--format <json\|text>\] \[--per-slide\]/);
  });
});
