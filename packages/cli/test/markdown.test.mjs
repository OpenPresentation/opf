import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { after, describe, test } from "node:test";

import { validatePresentation } from "@openpresentation/opf";

const here = path.dirname(fileURLToPath(import.meta.url));
const CLI_BIN = path.resolve(here, "../dist/index.js");
const EXAMPLES = path.resolve(here, "../../../examples/markdown");
const temp = mkdtempSync(path.join(tmpdir(), "opf-markdown-cli-"));
after(() => rmSync(temp, { recursive: true, force: true }));

const run = (args, input) => spawnSync(process.execPath, [CLI_BIN, ...args], { encoding: "utf8", input });

describe("opf from-md", () => {
  test("converts Markdown from stdin to an OPF document on stdout and reports on stderr", () => {
    const result = run(["from-md", "-"], "---\nname: Demo\n---\n\n# One\n\n- a\n- b\n");
    assert.equal(result.status, 0, result.stderr);
    const document = JSON.parse(result.stdout);
    assert.deepEqual(document, { name: "Demo", slides: [{ title: "One", items: ["a", "b"] }] });
    assert.equal(validatePresentation(document).valid, true);
    const report = JSON.parse(result.stderr);
    assert.equal(report.valid, true);
    assert.equal(report.slides, 1);
    assert.match(report.sha256, /^[a-f0-9]{64}$/);
  });

  test("writes a file atomically, refuses to overwrite without --force and prints the report on stdout", () => {
    const input = path.join(temp, "deck.md");
    const output = path.join(temp, "deck.opf.json");
    writeFileSync(input, "# Hello\n\nWorld\n");
    const first = run(["from-md", input, output]);
    assert.equal(first.status, 0, first.stderr);
    assert.deepEqual(JSON.parse(readFileSync(output, "utf8")), { slides: [{ title: "Hello", text: "World" }] });
    assert.equal(JSON.parse(first.stdout).output, path.resolve(output));
    const again = run(["from-md", input, output]);
    assert.equal(again.status, 1);
    assert.match(JSON.parse(again.stderr).error, /already exists/);
    assert.equal(run(["from-md", input, output, "--force"]).status, 0);
    assert.deepEqual(readdirSync(temp).filter((name) => name.endsWith(".tmp")), []);
  });

  test("a Markdown error exits 1 with line and column and writes nothing", () => {
    const output = path.join(temp, "broken.opf.json");
    const result = run(["from-md", "-", output], "# A\n\n<!-- slide: nope=1 -->\n");
    assert.equal(result.status, 1);
    assert.equal(result.stdout, "");
    const error = JSON.parse(result.stderr);
    assert.equal(error.error, "Markdown conversion failed.");
    const [first] = error.markdown.diagnostics;
    assert.equal(first.ruleId, "markdown/options-unknown-key");
    assert.deepEqual([first.location.line, first.location.column], [3, 1]);
    assert.equal(existsSync(output), false);
  });

  test("--strict fails on a warning, --split headings reads an outline, --title sets the name", () => {
    const warning = "1. one\n2. two\n";
    assert.equal(run(["from-md", "-"], warning).status, 0);
    assert.equal(run(["from-md", "-", "--strict"], warning).status, 1);
    const outline = run(["from-md", "-", "--split", "headings", "--title", "Outline deck"], "# One\n- a\n# Two\nText\n");
    assert.equal(outline.status, 0, outline.stderr);
    assert.deepEqual(JSON.parse(outline.stdout), { name: "Outline deck", slides: [{ title: "One", items: ["a"] }, { title: "Two", text: "Text" }] });
  });

  test("usage errors exit 2", () => {
    assert.equal(run(["from-md"]).status, 2);
    assert.equal(run(["from-md", "-", "--split", "paragraphs"], "# A").status, 2);
    assert.equal(run(["from-md", "-", "--bogus"], "# A").status, 2);
    assert.equal(run(["from-md", "-", "--drop-unsupported"], "# A").status, 2);
    assert.equal(run(["from-md", path.join(temp, "missing.md")]).status, 2);
  });
});

describe("opf to-md", () => {
  const deck = { name: "Deck", slides: [{ id: "a", title: "One", items: ["x"] }, { title: "Two", design: { background: "light2" }, text: "y" }] };

  test("writes Markdown that from-md reads back to the same deck", () => {
    const toMd = run(["to-md", "-"], JSON.stringify(deck));
    assert.equal(toMd.status, 0, toMd.stderr);
    const report = JSON.parse(toMd.stderr);
    assert.equal(report.lossless, true);
    assert.equal(report.native, false);
    assert.deepEqual(report.embedded.map((entry) => entry.path), ["/slides/1/design"]);
    const back = run(["from-md", "-"], toMd.stdout);
    assert.equal(back.status, 0, back.stderr);
    assert.deepEqual(JSON.parse(back.stdout), deck);
  });

  test("--drop-unsupported leaves out what has no Markdown syntax and lists it as loss", () => {
    const result = run(["to-md", "-", "--drop-unsupported"], JSON.stringify(deck));
    assert.equal(result.status, 0, result.stderr);
    assert.doesNotMatch(result.stdout, /opf-slide/);
    const report = JSON.parse(result.stderr);
    assert.equal(report.lossless, false);
    assert.match(report.loss[0], /^\/slides\/1\/design:/);
  });

  test("--strict fails when anything needed embedding; a file output needs --force to be replaced", () => {
    const strict = run(["to-md", "-", "--strict"], JSON.stringify(deck));
    assert.equal(strict.status, 1);
    assert.equal(JSON.parse(strict.stderr).markdown.native, false);
    const input = path.join(temp, "plain.opf.json");
    const output = path.join(temp, "plain.md");
    writeFileSync(input, JSON.stringify({ slides: [{ title: "Plain" }] }));
    assert.equal(run(["to-md", input, output, "--strict"]).status, 0);
    assert.equal(readFileSync(output, "utf8"), "# Plain\n");
    assert.equal(run(["to-md", input, output]).status, 1);
    assert.equal(run(["to-md", input, output, "--force"]).status, 0);
  });

  test("an invalid document exits 1 and bad JSON exits 2", () => {
    const invalid = run(["to-md", "-"], JSON.stringify({ slides: "no" }));
    assert.equal(invalid.status, 1);
    assert.match(JSON.parse(invalid.stderr).error, /not valid OPF/);
    assert.equal(run(["to-md", "-"], "{").status, 2);
  });
});

describe("the dialect examples", () => {
  test("convert with the CLI and come back unchanged", () => {
    for (const name of readdirSync(EXAMPLES).filter((file) => file.endsWith(".md"))) {
      const source = readFileSync(path.join(EXAMPLES, name), "utf8");
      const args = name.startsWith("outline") ? ["--split", "headings"] : [];
      const converted = run(["from-md", "-", ...args], source);
      assert.equal(converted.status, 0, `${name}: ${converted.stderr}`);
      assert.deepEqual(JSON.parse(converted.stderr).diagnostics, [], name);
      assert.equal(validatePresentation(JSON.parse(converted.stdout)).valid, true, name);
      const back = run(["to-md", "-", "--strict"], converted.stdout);
      assert.equal(back.status, 0, `${name}: ${back.stderr}`);
      if (!name.startsWith("outline")) assert.equal(back.stdout, source, name);
    }
  });

  test("the help text documents both commands", () => {
    const help = run(["--help"]);
    assert.match(help.stdout, /opf from-md <deck\.md\|->/);
    assert.match(help.stdout, /opf to-md <deck\.opf\.json\|->/);
  });
});
