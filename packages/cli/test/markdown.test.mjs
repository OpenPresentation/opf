// RR-30, RR-75: Markdown in the OPF dialect to and from an OPF document, through opf convert (from-md and to-md were removed in
// 0.18). A plain .md input is read as OPF Markdown; an outline with no --- line splits at its # headings.
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { after, describe, test } from "node:test";

import { validate } from "@openpresentation/opf";

const here = path.dirname(fileURLToPath(import.meta.url));
const CLI_BIN = process.env.OPF_TEST_BIN ?? path.resolve(here, "../dist/index.js");
const EXAMPLES = path.resolve(here, "../../../examples/markdown");
const temp = mkdtempSync(path.join(tmpdir(), "opf-markdown-cli-"));
after(() => rmSync(temp, { recursive: true, force: true }));

const run = (args, input) => spawnSync(process.execPath, [CLI_BIN, ...args], { encoding: "utf8", input, cwd: temp });
const fromMd = (args, input) => run(["convert", "-", "-", "--from", "md", "--to", "json", ...args], input);
const toMd = (args, input) => run(["convert", "-", "-", "--from", "json", "--to", "md", ...args], input);
/** The JSON report on stderr, after any warning lines. */
const stderrReport = (result) => JSON.parse(result.stderr.slice(result.stderr.indexOf("{")));

describe("opf convert, Markdown to a deck", () => {
  test("converts Markdown from stdin to an OPF document on stdout and reports on stderr", () => {
    const result = fromMd([], "---\nname: Demo\n---\n\n# One\n\n- a\n- b\n");
    assert.equal(result.status, 0, result.stderr);
    const document = JSON.parse(result.stdout);
    assert.deepEqual(document, { name: "Demo", slides: [{ title: "One", items: ["a", "b"] }] });
    assert.equal(validate(document, { only: ["format"] }).valid, true);
    const report = JSON.parse(result.stderr);
    assert.equal(report.command, "convert");
    assert.equal(report.ok, true);
    assert.equal(report.outputs[0].file, "-");
    assert.equal(report.outputs[0].mediaType, "application/json");
    assert.match(report.outputs[0].sha256, /^[a-f0-9]{64}$/);
  });

  test("a plain .md input is OPF Markdown; a file output is written atomically, refused without --force, and the report is on stdout", () => {
    const input = path.join(temp, "deck.md");
    const output = path.join(temp, "deck.opf.json");
    writeFileSync(input, "# Hello\n\nWorld\n");
    const first = run(["convert", input, output]);
    assert.equal(first.status, 0, first.stderr);
    assert.deepEqual(JSON.parse(readFileSync(output, "utf8")), { slides: [{ title: "Hello", text: "World" }] });
    assert.equal(JSON.parse(first.stdout).outputs[0].file, path.resolve(output));
    const again = run(["convert", input, output]);
    assert.equal(again.status, 1);
    assert.equal(JSON.parse(again.stderr).code, "output-exists");
    assert.equal(run(["convert", input, output, "--force"]).status, 0);
    assert.deepEqual(readdirSync(temp).filter((name) => name.endsWith(".tmp")), []);
  });

  test("a Markdown error exits 2 with line and column and writes nothing", () => {
    const output = path.join(temp, "broken.opf.json");
    const result = run(["convert", "-", output, "--from", "md"], "# A\n\n<!-- slide: nope=1 -->\n");
    assert.equal(result.status, 2);
    assert.equal(result.stdout, "");
    const error = JSON.parse(result.stderr);
    assert.equal(error.code, "invalid-markdown");
    const [first] = error.findings;
    assert.equal(first.ruleId, "markdown/options-unknown-key");
    assert.deepEqual([first.location.line, first.location.column], [3, 1]);
    assert.equal(existsSync(output), false);
  });

  test("--fail-on warning fails on a warning; an outline splits at # headings by default; --split rules does not; --title sets the name", () => {
    const warning = "1. one\n2. two\n";
    assert.equal(fromMd([], warning).status, 0);
    assert.equal(fromMd(["--fail-on", "warning"], warning).status, 1);
    assert.equal(fromMd(["--fail-on", "never"], warning).status, 2);
    assert.equal(fromMd(["--strict"], warning).status, 2);
    const outline = fromMd(["--title", "Outline deck"], "# One\n- a\n# Two\nText\n");
    assert.equal(outline.status, 0, outline.stderr);
    assert.deepEqual(JSON.parse(outline.stdout), { name: "Outline deck", slides: [{ title: "One", items: ["a"] }, { title: "Two", text: "Text" }] });
    assert.equal(JSON.parse(fromMd(["--split", "headings"], "# One\n- a\n# Two\nText\n").stdout).slides.length, 2);
    assert.equal(fromMd(["--split", "rules"], "# One\n- a\n# Two\nText\n").status, 2, "with rules the second # is a second title, a syntax error");
  });

  test("usage errors exit 2: Markdown flags need a Markdown input, Markdown output flags a Markdown output", () => {
    assert.equal(run(["convert", "-"]).status, 2);
    assert.equal(fromMd(["--split", "paragraphs"], "# A").status, 2);
    assert.equal(fromMd(["--bogus"], "# A").status, 2);
    assert.equal(fromMd(["--drop-unsupported"], "# A").status, 2);
    assert.equal(JSON.parse(toMd(["--split", "headings"], '{"slides":[]}').stderr).code, "option-not-applicable");
    assert.equal(run(["convert", path.join(temp, "missing.md"), "x.opf.json"]).status, 2);
    const plainOut = run(["convert", "-", "out.md", "--from", "json"], '{"slides":[{"title":"A"}]}');
    assert.equal(plainOut.status, 2);
    assert.match(JSON.parse(plainOut.stderr).error, /\.opf\.md/);
  });
});

describe("opf convert, a deck to Markdown", () => {
  const deck = { name: "Deck", slides: [{ id: "a", title: "One", items: ["x"] }, { title: "Two", design: { background: "light2" }, text: "y" }] };

  test("writes Markdown that reads back to the same deck", () => {
    const written = toMd([], JSON.stringify(deck));
    assert.equal(written.status, 0, written.stderr);
    const report = stderrReport(written);
    assert.equal(report.markdown.lossless, true);
    assert.equal(report.markdown.native, false);
    assert.deepEqual(report.markdown.embedded.map((entry) => entry.path), ["/slides/1/design"]);
    assert.equal(report.findings.at(-1).ruleId, "markdown/embedded");
    const back = fromMd([], written.stdout);
    assert.equal(back.status, 0, back.stderr);
    assert.deepEqual(JSON.parse(back.stdout), deck);
  });

  test("--drop-unsupported leaves out what has no Markdown syntax and lists it as loss", () => {
    const result = toMd(["--drop-unsupported"], JSON.stringify(deck));
    assert.equal(result.status, 0, result.stderr);
    assert.doesNotMatch(result.stdout, /opf-slide/);
    const report = stderrReport(result);
    assert.equal(report.markdown.lossless, false);
    assert.match(report.markdown.loss[0], /^\/slides\/1\/design:/);
  });

  test("--fail-on warning fails when anything needed embedding; a file output needs --force to be replaced", () => {
    const strict = toMd(["--fail-on", "warning"], JSON.stringify(deck));
    assert.equal(strict.status, 1);
    assert.equal(stderrReport(strict).code, "findings-at-fail-on");
    const input = path.join(temp, "plain.opf.json");
    const output = path.join(temp, "plain.opf.md");
    writeFileSync(input, JSON.stringify({ slides: [{ title: "Plain" }] }));
    assert.equal(run(["convert", input, output, "--fail-on", "warning"]).status, 0);
    assert.equal(readFileSync(output, "utf8"), "# Plain\n");
    assert.equal(run(["convert", input, output]).status, 1);
    assert.equal(run(["convert", input, output, "--force"]).status, 0);
  });

  test("an invalid document exits 1 and bad JSON exits 2", () => {
    const invalid = toMd([], JSON.stringify({ slides: "no" }));
    assert.equal(invalid.status, 1);
    assert.match(JSON.parse(invalid.stderr).error, /not valid OPF/);
    assert.equal(JSON.parse(invalid.stderr).code, "invalid-document");
    assert.equal(toMd([], "{").status, 2);
  });
});

describe("the dialect examples", () => {
  test("convert with the CLI and come back unchanged", () => {
    for (const name of readdirSync(EXAMPLES).filter((file) => file.endsWith(".md"))) {
      const source = readFileSync(path.join(EXAMPLES, name), "utf8");
      const converted = fromMd([], source);
      assert.equal(converted.status, 0, `${name}: ${converted.stderr}`);
      assert.deepEqual(JSON.parse(converted.stderr).findings, [], name);
      assert.equal(validate(JSON.parse(converted.stdout), { only: ["format"] }).valid, true, name);
      const back = toMd(["--fail-on", "warning"], converted.stdout);
      assert.equal(back.status, 0, `${name}: ${back.stderr}`);
      if (!name.startsWith("outline")) assert.equal(back.stdout, source, name);
    }
  });

  test("opf convert --help documents the Markdown flags", () => {
    const help = run(["convert", "--help"]);
    assert.equal(help.status, 0);
    assert.match(help.stdout, /--split <auto\|rules\|headings>/);
    assert.match(help.stdout, /--drop-unsupported/);
    assert.match(help.stdout, /plain \.md/);
  });
});
