// RR-60: a deck can be Markdown (`deck.opf.md`) in every command that reads or writes a deck, as it can be YAML (RR-56).
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
const TEMPLATE = path.resolve(here, "fixtures/template.opf.json");
const EXAMPLE = path.resolve(here, "../../../examples/markdown/quarterly-review.opf.md");
const temp = mkdtempSync(path.join(tmpdir(), "opf-md-deck-cli-"));
after(() => rmSync(temp, { recursive: true, force: true }));

const run = (args, input, cwd = temp) => spawnSync(process.execPath, [CLI_BIN, ...args], { encoding: "utf8", input, cwd, maxBuffer: 64 * 1024 * 1024 });
const write = (name, text) => {
  const file = path.join(temp, name);
  writeFileSync(file, text);
  return file;
};
const read = (name) => readFileSync(path.join(temp, name), "utf8");
const patch = (name, operations) => write(name, JSON.stringify(operations));
const formatValid = (value) => validate(value, { only: ["format"] }).valid;

const deckMd = `---
name: Q3 Review
language: en-US
---

# Revenue grew

- Faster onboarding
- Fewer tickets

---

# Next steps

Kickoff on Monday.
`;
const deck = {
  name: "Q3 Review",
  language: "en-US",
  slides: [
    { title: "Revenue grew", items: ["Faster onboarding", "Fewer tickets"] },
    { title: "Next steps", text: "Kickoff on Monday." },
  ],
};

describe("reading a deck.opf.md", () => {
  test("a name ending .opf.md is a Markdown deck, in any case; validate locates findings in the Markdown", () => {
    write("deck.opf.md", deckMd);
    const valid = run(["validate", "deck.opf.md"]);
    assert.equal(valid.status, 0, valid.stderr);
    assert.equal(JSON.parse(valid.stdout).valid, true);
    write("UPPER.OPF.MD", deckMd);
    assert.equal(run(["validate", "UPPER.OPF.MD"]).status, 0);

    write("located.opf.md", "---\nname: X\nlanguage: 5\n---\n\n# A\n");
    const report = JSON.parse(run(["validate", "located.opf.md"]).stdout);
    const found = report.findings.find((entry) => entry.path === "/language");
    assert.deepEqual([found.location.line, found.location.column], [3, 1]);
    const text = run(["validate", "located.opf.md", "--format", "text"]);
    assert.equal(text.status, 1);
    assert.match(text.stdout, /located\.opf\.md:3:1 {2}error/);
  });

  test("the dialect example validates with the default catalog and embeds nothing it should not", () => {
    const result = run(["validate", EXAMPLE]);
    assert.equal(result.status, 0, result.stderr);
    const report = JSON.parse(result.stdout);
    assert.equal(report.valid, true);
    assert.deepEqual(report.findings.filter((entry) => entry.severity !== "info"), []);
  });

  test("a plain .md file is never a deck", () => {
    write("plain.md", deckMd);
    const validated = run(["validate", "plain.md"]);
    assert.equal(validated.status, 1);
    assert.equal(JSON.parse(validated.stdout).findings[0].ruleId, "opf/json-syntax");
    const edited = run(["edit", "plain.md", "--patch", patch("rename.json", [{ op: "replace", path: "/name", value: "X" }])]);
    assert.equal(edited.status, 2);
    assert.match(JSON.parse(edited.stderr).error, /^Invalid JSON in plain\.md/);
    // ... until the caller says what it is.
    assert.equal(run(["validate", "plain.md", "--input-format", "markdown"]).status, 0);
    // from-md converts any file name.
    assert.deepEqual(JSON.parse(run(["from-md", "plain.md"]).stdout), deck);
  });

  test("--input-format markdown (or md) reads stdin and other names; a file name wins over the option", () => {
    for (const name of ["markdown", "md"]) {
      const result = run(["validate", "-", "--input-format", name], deckMd);
      assert.equal(result.status, 0, result.stderr);
      assert.equal(JSON.parse(result.stdout).valid, true);
    }
    write("deck.txt", deckMd);
    assert.equal(run(["validate", "deck.txt", "--input-format", "md"]).status, 0);
    assert.equal(run(["validate", "deck.opf.md", "--input-format", "json"]).status, 0, "the .opf.md name wins");
    assert.equal(run(["validate", "-"], deckMd).status, 1, "stdin is JSON by default");
    const bad = run(["validate", "-", "--input-format", "toml"], deckMd);
    assert.equal(bad.status, 2);
    assert.match(JSON.parse(bad.stderr).error, /--input-format takes json, yaml or markdown/);
  });

  test("a Markdown syntax error exits 2 with line:column and located findings; validate reports it as a finding and exits 1", () => {
    write("broken.opf.md", "---\nname: X\n\n# Title\n");
    const edit = run(["edit", "broken.opf.md", "--patch", patch("p.json", [{ op: "replace", path: "/name", value: "Y" }])]);
    assert.equal(edit.status, 2);
    const error = JSON.parse(edit.stderr);
    assert.match(error.error, /^Invalid Markdown in broken\.opf\.md at line 1, column 1: .*\[markdown\/front-matter-unterminated\]/);
    assert.equal(error.markdown.findings[0].ruleId, "markdown/front-matter-unterminated");
    assert.deepEqual([error.markdown.findings[0].location.line, error.markdown.findings[0].location.column], [1, 1]);
    for (const args of [["format", "broken.opf.md"], ["paginate", "broken.opf.md", "x.opf.md"], ["diff", "broken.opf.md", "broken.opf.md"], ["stats", "broken.opf.md"]]) {
      const result = run(args);
      assert.equal(result.status, 2, args.join(" "));
      assert.equal(JSON.parse(result.stderr).markdown.findings[0].ruleId, "markdown/front-matter-unterminated", args.join(" "));
    }
    const validated = run(["validate", "broken.opf.md"]);
    assert.equal(validated.status, 1);
    assert.equal(JSON.parse(validated.stdout).findings[0].ruleId, "markdown/front-matter-unterminated");
    const stdin = run(["edit", "-", "--input-format", "md", "--patch", "p.json"], "---\nname: X\n\n# Title\n");
    assert.equal(stdin.status, 2);
    assert.match(JSON.parse(stdin.stderr).error, /^Invalid Markdown in stdin at line 1, column 1/);
  });

  test("a patch is JSON or YAML, never Markdown", () => {
    write("deck.opf.md", deckMd);
    const result = run(["edit", "deck.opf.md", "--patch", write("patch.opf.md", "# patch\n")]);
    assert.equal(result.status, 2);
    assert.match(JSON.parse(result.stderr).error, /A JSON Patch is JSON or YAML, not Markdown/);
  });

  test("stats, diff and merge read Markdown decks", () => {
    write("a.opf.md", deckMd);
    write("b.opf.md", deckMd.replace("Revenue grew", "Revenue fell"));
    write("c.opf.json", JSON.stringify({ ...deck, slides: [deck.slides[0], { ...deck.slides[1], text: "Kickoff on Friday." }] }));
    assert.equal(JSON.parse(run(["stats", "a.opf.md"]).stdout).slides.total, 2);
    assert.equal(run(["diff", "a.opf.md", "a.opf.md", "--exit-code"]).status, 0);
    assert.equal(run(["diff", "a.opf.md", "b.opf.md", "--exit-code"]).status, 1);
    const merged = run(["merge", "a.opf.md", "b.opf.md", "c.opf.json"]);
    assert.equal(merged.status, 0, merged.stderr);
    assert.match(merged.stdout, /^---\nname: Q3 Review/);
    assert.match(merged.stdout, /# Revenue fell/);
    assert.match(merged.stdout, /Kickoff on Friday\./);
    assert.equal(run(["merge", "a.opf.md", "b.opf.md", "c.opf.json", "--output", "merged.opf.json"]).status, 0);
    assert.equal(JSON.parse(read("merged.opf.json")).slides[0].title, "Revenue fell");
  });

  test("render and export read a Markdown deck and locate validation errors in it", () => {
    write("render.opf.md", "---\nname: Render\n---\n\n<!-- slide: id=s1 -->\n# Hello\n\nWorld\n");
    const rendered = run(["render", "render.opf.md", "--slides", "1", "--out", "-", "--format", "svg", "--text", "system"]);
    if (rendered.status === 2 && /opf-render/.test(rendered.stderr)) return; // the optional renderer is not installed
    assert.equal(rendered.status, 0, rendered.stderr.slice(0, 500));
    assert.match(rendered.stdout, /<svg/);
    const exported = run(["export", "render.opf.md", "--format", "svg", "--out", "exported", "--text", "system"]);
    assert.equal(exported.status, 0, exported.stderr.slice(0, 500));
    assert.ok(readdirSync(path.join(temp, "exported")).some((name) => name.endsWith(".svg")));
    write("render-bad.opf.md", "---\nname: Render\nlanguage: 5\n---\n\n# Hello\n");
    const bad = run(["render", "render-bad.opf.md", "--out", "-"]);
    assert.equal(bad.status, 1);
    const found = JSON.parse(bad.stdout).findings.find((entry) => entry.path === "/language");
    assert.deepEqual([found.location.line, found.location.column], [3, 1]);
    write("render-broken.opf.md", "---\nname: Render\n\n# Hello\n");
    const broken = run(["render", "render-broken.opf.md", "--out", "-"]);
    assert.equal(broken.status, 1);
    assert.equal(JSON.parse(broken.stdout).findings[0].ruleId, "markdown/front-matter-unterminated");
  });
});

describe("writing a deck.opf.md", () => {
  test("edit writes the format it read: Markdown to stdout, in place, and to a .opf.md name", () => {
    write("e.opf.md", deckMd);
    const rename = patch("rename.json", [{ op: "replace", path: "/name", value: "Renamed" }]);
    const stdout = run(["edit", "e.opf.md", "--patch", rename]);
    assert.equal(stdout.status, 0, stdout.stderr);
    assert.equal(stdout.stdout, deckMd.replace("name: Q3 Review", "name: Renamed"));
    assert.equal(run(["edit", "e.opf.md", "--patch", rename, "--in-place"]).status, 0);
    assert.equal(read("e.opf.md"), deckMd.replace("name: Q3 Review", "name: Renamed"));
    assert.equal(run(["edit", "e.opf.md", "--patch", rename, "--output", "copy.opf.md"]).status, 0);
    assert.equal(read("copy.opf.md"), read("e.opf.md"));
  });

  test("an output name or --format overrides the format that was read, in both directions", () => {
    write("f.opf.md", deckMd);
    const noop = patch("noop.json", [{ op: "replace", path: "/name", value: "Q3 Review" }]);
    const toJson = run(["edit", "f.opf.md", "--patch", noop, "--output", "f.opf.json"]);
    assert.equal(toJson.status, 0, toJson.stderr);
    assert.deepEqual(JSON.parse(read("f.opf.json")), deck);
    assert.deepEqual(JSON.parse(run(["edit", "f.opf.md", "--patch", noop, "--format", "json"]).stdout), deck);
    assert.match(run(["edit", "f.opf.md", "--patch", noop, "--format", "yaml"]).stdout, /^name: Q3 Review\nlanguage: en-US\nslides:\n/);
    write("g.opf.json", JSON.stringify(deck));
    for (const flag of ["markdown", "md"]) assert.equal(run(["edit", "g.opf.json", "--patch", noop, "--format", flag]).stdout, deckMd, flag);
    assert.equal(run(["edit", "g.opf.json", "--patch", noop, "--output", "g.opf.md"]).status, 0);
    assert.equal(read("g.opf.md"), deckMd);
    assert.equal(run(["edit", "g.opf.json", "--patch", noop, "--output", "g.out", "--format", "md"]).status, 0);
    assert.equal(read("g.out"), deckMd, "--format decides for another name");
    write("h.opf.yaml", "name: Q3 Review\nslides:\n  - title: A\n");
    assert.equal(run(["edit", "h.opf.yaml", "--patch", noop, "--output", "h.opf.md"]).status, 0);
    assert.equal(read("h.opf.md"), "---\nname: Q3 Review\n---\n\n# A\n");
    assert.equal(run(["edit", "h.opf.md", "--patch", noop, "--format", "toml"]).status, 2);
  });

  test("a rewrite that moves content into opf-slide fences says so on stderr; a deck that already had them does not", () => {
    write("w.opf.md", deckMd);
    const design = patch("design.json", [{ op: "add", path: "/slides/0/design", value: { colorScheme: "forest-green" } }]);
    const first = run(["edit", "w.opf.md", "--patch", design]);
    assert.equal(first.status, 0, first.stderr);
    assert.match(first.stdout, /```opf-slide\ndesign:\n {2}colorScheme: forest-green\n```/);
    assert.match(first.stderr, /warning: the output has 1 more opf-slide\/opf-block fence than before/);
    assert.equal(run(["edit", "w.opf.md", "--patch", design, "--in-place"]).status, 0);
    assert.match(read("w.opf.md"), /```opf-slide/);
    const again = run(["edit", "w.opf.md", "--patch", patch("rename2.json", [{ op: "replace", path: "/name", value: "Again" }])]);
    assert.equal(again.status, 0, again.stderr);
    assert.doesNotMatch(again.stderr, /fence/, "the fence was already there");
    // A JSON deck written as Markdown carries the same content in a fence, and says so.
    write("styled.opf.json", JSON.stringify({ name: "S", slides: [{ title: "A", design: { colorScheme: "forest-green" } }] }));
    const converted = run(["edit", "styled.opf.json", "--patch", patch("noop2.json", [{ op: "replace", path: "/name", value: "S" }]), "--format", "markdown"]);
    assert.match(converted.stderr, /1 more opf-slide\/opf-block fence than before/);
    assert.equal(run(["validate", "-", "--input-format", "md"], converted.stdout).status, 0);
  });

  test("format canonicalizes a Markdown deck; --check and --in-place work; --format converts", () => {
    const loose = "---\nname:   Q3 Review\nlanguage: en-US\n---\n\n\n# Revenue grew\n\n* Faster onboarding\n* Fewer tickets\n\n\n---\n\n# Next steps\nKickoff on Monday.\n";
    write("loose.opf.md", loose);
    const check = run(["format", "loose.opf.md", "--check"]);
    assert.equal(check.status, 1);
    assert.deepEqual(JSON.parse(check.stdout).unformatted, ["loose.opf.md"]);
    assert.equal(run(["format", "loose.opf.md"]).stdout, deckMd);
    assert.equal(run(["format", "loose.opf.md", "--in-place"]).status, 0);
    assert.equal(read("loose.opf.md"), deckMd);
    assert.equal(run(["format", "loose.opf.md", "--check"]).status, 0);
    assert.deepEqual(JSON.parse(run(["format", "loose.opf.md", "--format", "json"]).stdout), deck);
    write("fmt.opf.json", JSON.stringify(deck));
    assert.equal(run(["format", "fmt.opf.json", "--format", "markdown"]).stdout, deckMd);
    assert.equal(run(["format", "fmt.opf.json", "--output", "fmt.opf.md"]).status, 0);
    assert.equal(read("fmt.opf.md"), deckMd);
    assert.equal(run(["format", "-", "--input-format", "md"], loose).stdout, deckMd);
    assert.equal(run(["format", "loose.opf.md", "--indent", "4"]).status, 2, "--indent is for JSON");
    assert.equal(run(["format", "loose.opf.md", "--eol", "crlf"]).stdout, deckMd.replaceAll("\n", "\r\n"));
    write("fmt-crlf.opf.md", deckMd.replaceAll("\n", "\r\n"));
    assert.equal(run(["format", "fmt-crlf.opf.md", "--check", "--eol", "preserve"]).status, 0);
    write("fmt-invalid.opf.md", "---\nname: x\nlanguage: 5\n---\n\n# A\n");
    const invalid = run(["format", "fmt-invalid.opf.md"]);
    assert.equal(invalid.status, 1);
    assert.match(JSON.parse(invalid.stderr).error, /Cannot format fmt-invalid\.opf\.md as Markdown/);
  });

  test("paginate and embed read and write Markdown", () => {
    write("p.opf.md", deckMd);
    const paginated = run(["paginate", "p.opf.md", "paginated.opf.md"]);
    assert.equal(paginated.status, 0, paginated.stderr);
    const text = read("paginated.opf.md");
    assert.match(text, /^---\nname: Q3 Review/);
    assert.equal(run(["validate", "paginated.opf.md"]).status, 0);
    const toJson = run(["paginate", "p.opf.md", "paginated.json"]);
    assert.equal(toJson.status, 0, toJson.stderr);
    assert.equal(formatValid(JSON.parse(read("paginated.json"))), true);
    assert.equal(run(["embed", "p.opf.md", "embedded.opf.md"]).status, 0);
    assert.match(read("embedded.opf.md"), /name: Q3 Review/);
    assert.equal(run(["validate", "embedded.opf.md"]).status, 0);
  });

  test("create --from reads any deck and writes by the output name; create without --from keeps JSON", () => {
    write("c.opf.json", JSON.stringify(deck));
    const created = run(["create", "created.opf.md", "--from", "c.opf.json"]);
    assert.equal(created.status, 0, created.stderr);
    assert.equal(read("created.opf.md"), deckMd);
    const fromMd = run(["create", "-", "--from", "created.opf.md"]);
    assert.equal(fromMd.stdout, deckMd, "the format that was read decides for stdout");
    assert.equal(run(["create", "-", "--from", "created.opf.md", "--format", "json"]).stdout.trimStart()[0], "{");
    assert.equal(run(["create", "-", "--title", "Fresh"]).stdout.trimStart()[0], "{", "no deck input: JSON");
    assert.match(run(["create", "-", "--title", "Fresh", "--format", "md"]).stdout, /^---\n(?:\$schema: .*\n)?name: Fresh\n---\n\n(?:<!-- .* -->\n)?# Fresh\n/);
    assert.equal(run(["create", "fresh.opf.md", "--title", "Fresh"]).status, 0);
    assert.equal(run(["validate", "fresh.opf.md"]).status, 0);
  });

  test("ingest and fill read Markdown decks and write them by --format markdown or the output name", () => {
    write("data.csv", "Quarter,Revenue\nQ1,12\nQ2,18\n");
    write("data.opf.md", deckMd);
    const into = run(["ingest", "data.csv", "--as", "chart", "--into", "data.opf.md", "--in-place"]);
    assert.equal(into.status, 0, into.stderr);
    assert.match(read("data.opf.md"), /```chart/);
    assert.equal(run(["validate", "data.opf.md"]).status, 0);
    const fresh = run(["ingest", "data.csv", "--as", "table", "--format", "markdown"]);
    assert.equal(fresh.status, 0, fresh.stderr);
    assert.match(fresh.stdout, /\| Quarter \| Revenue \|/);
    assert.equal(run(["ingest", "data.csv", "--as", "table", "--format", "csv"]).stdout.trimStart()[0], "{", "csv still names the data");

    const template = run(["edit", TEMPLATE, "--patch", patch("noop3.json", []), "--output", "template.opf.md"]);
    assert.equal(template.status, 0, template.stderr);
    write("values.json", JSON.stringify({ client: "Acme", revenue: 12, kickoff: "2026-10-01", wins: ["a", "b"] }));
    const single = run(["fill", "template.opf.md", "--data", "values.json"]);
    assert.equal(single.status, 0, single.stderr);
    assert.match(single.stdout, /^---\n(?:.*\n)*?name: Quarterly review for Acme\n/, single.stdout.slice(0, 200));
    const dir = path.join(temp, "filled-md");
    write("people.csv", "client,revenue,kickoff,wins\nAcme,10,2026-10-01,a\nBeta,20,2026-11-01,b\n");
    const many = run(["fill", "template.opf.md", "--data", "people.csv", "--out-dir", dir, "--name", "{client}"]);
    assert.equal(many.status, 0, many.stderr);
    assert.deepEqual(readdirSync(dir).sort(), ["acme.opf.md", "beta.opf.md"]);
    const asMd = run(["fill", TEMPLATE, "--data", "values.json", "--format", "markdown"]);
    assert.equal(asMd.status, 0, asMd.stderr);
    assert.match(asMd.stdout, /^---\n/);
    const jsonDir = path.join(temp, "filled-json");
    assert.equal(run(["fill", TEMPLATE, "--data", "people.csv", "--out-dir", jsonDir, "--name", "{client}"]).status, 0);
    assert.deepEqual(readdirSync(jsonDir).sort(), ["acme.opf.json", "beta.opf.json"]);
  });
});

describe("the conversion commands stay explicit", () => {
  test("from-md converts any name and never writes Markdown; to-md writes any name and reads any deck", () => {
    write("source.md", deckMd);
    assert.deepEqual(JSON.parse(run(["from-md", "source.md"]).stdout), deck);
    assert.equal(run(["from-md", "source.md", "out.opf.yaml"]).status, 0);
    const refused = run(["from-md", "source.md", "out.opf.md"]);
    assert.equal(refused.status, 2);
    assert.match(JSON.parse(refused.stderr).error, /from-md writes JSON or YAML/);
    assert.equal(existsSync(path.join(temp, "out.opf.md")), false);
    assert.equal(run(["from-md", "source.md", "--format", "markdown"]).status, 2);
    const yamlRefused = run(["from-yaml", "-", "out.opf.md"], "name: X\nslides:\n  - title: A\n");
    assert.equal(yamlRefused.status, 2);
    assert.match(JSON.parse(yamlRefused.stderr).error, /from-yaml writes JSON/);

    write("to.opf.json", JSON.stringify(deck));
    assert.equal(run(["to-md", "to.opf.json", "anything.txt"]).status, 0);
    assert.equal(read("anything.txt"), deckMd);
    assert.equal(run(["to-md", "anything.txt"], undefined).status, 2, "anything.txt is JSON by name");
    assert.equal(run(["to-md", "-", "--input-format", "markdown"], deckMd).stdout, deckMd);
    assert.equal(run(["to-md", "source.md"]).status, 2, "a plain .md name is not a deck");
  });

  test("the help documents Markdown decks", () => {
    const help = run(["--help"]).stdout;
    assert.match(help, /--input-format <json\|yaml\|markdown>/);
    assert.match(help, /--format <json\|yaml\|markdown>/);
    assert.match(help, /\.opf\.md/);
    assert.match(run(["validate", "--help"]).stdout, /\.opf\.md/);
  });
});

describe("the template round trip", () => {
  test("a template written as Markdown validates as a template and fills", () => {
    const converted = run(["create", "tpl.opf.md", "--from", TEMPLATE]);
    assert.equal(converted.status, 0, converted.stderr);
    assert.equal(run(["validate", "tpl.opf.md"]).status, 0);
    assert.deepEqual(JSON.parse(run(["format", "tpl.opf.md", "--format", "json"]).stdout), JSON.parse(readFileSync(TEMPLATE, "utf8")));
  });
});
