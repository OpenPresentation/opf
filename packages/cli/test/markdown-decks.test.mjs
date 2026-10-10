// RR-60, RR-75: a deck can be Markdown (`deck.opf.md`) in every command that reads or writes a deck, as it can be YAML (RR-56).
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

  test("a plain .md file is a deck only for opf convert's input, or with --from md", () => {
    write("plain.md", deckMd);
    const validated = run(["validate", "plain.md"]);
    assert.equal(validated.status, 2);
    assert.match(JSON.parse(validated.stderr).error, /Pass --from yaml\|md/);
    const edited = run(["edit", "plain.md", "--patch", patch("rename.json", [{ op: "replace", path: "/name", value: "X" }])]);
    assert.equal(edited.status, 2);
    assert.equal(JSON.parse(edited.stderr).code, "unknown-input-format");
    // ... until the caller says what it is.
    assert.equal(run(["validate", "plain.md", "--from", "md"]).status, 0);
    // convert reads any .md input as OPF Markdown.
    assert.deepEqual(JSON.parse(run(["convert", "plain.md", "-", "--to", "json"]).stdout), deck);
  });

  test("--from md (or markdown) reads stdin and other names, and wins over the name", () => {
    for (const name of ["markdown", "md"]) {
      const result = run(["validate", "-", "--from", name], deckMd);
      assert.equal(result.status, 0, result.stderr);
      assert.equal(JSON.parse(result.stdout).valid, true);
    }
    write("deck.txt", deckMd);
    assert.equal(run(["validate", "deck.txt", "--from", "md"]).status, 0);
    assert.equal(run(["validate", "deck.opf.md", "--from", "json"]).status, 1, "--from json reads the Markdown as JSON");
    assert.equal(run(["validate", "-"], deckMd).status, 2, "stdin that does not start with { or [ needs --from");
    const bad = run(["validate", "-", "--from", "toml"], deckMd);
    assert.equal(bad.status, 2);
    assert.match(JSON.parse(bad.stderr).error, /--from takes json, yaml or md/);
  });

  test("a Markdown syntax error exits 2 with line:column and located findings; validate reports it as a finding and exits 1", () => {
    write("broken.opf.md", "---\nname: X\n\n# Title\n");
    const edit = run(["edit", "broken.opf.md", "--patch", patch("p.json", [{ op: "replace", path: "/name", value: "Y" }])]);
    assert.equal(edit.status, 2);
    const error = JSON.parse(edit.stderr);
    assert.match(error.error, /^Invalid Markdown in broken\.opf\.md at line 1, column 1: .*\[markdown\/front-matter-unterminated\]/);
    assert.equal(error.code, "invalid-markdown");
    assert.equal(error.findings[0].ruleId, "markdown/front-matter-unterminated");
    assert.deepEqual([error.findings[0].location.line, error.findings[0].location.column], [1, 1]);
    for (const args of [["format", "broken.opf.md"], ["paginate", "broken.opf.md", "x.opf.md"], ["diff", "broken.opf.md", "broken.opf.md"], ["stats", "broken.opf.md"], ["convert", "broken.opf.md", "x.opf.json"]]) {
      const result = run(args);
      assert.equal(result.status, 2, args.join(" "));
      assert.equal(JSON.parse(result.stderr).findings[0].ruleId, "markdown/front-matter-unterminated", args.join(" "));
    }
    const validated = run(["validate", "broken.opf.md"]);
    assert.equal(validated.status, 1);
    assert.equal(JSON.parse(validated.stdout).findings[0].ruleId, "markdown/front-matter-unterminated");
    const stdin = run(["edit", "-", "--from", "md", "--patch", "p.json"], "---\nname: X\n\n# Title\n");
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
    assert.equal(JSON.parse(run(["stats", "a.opf.md"]).stdout).stats.slides.total, 2);
    assert.equal(run(["diff", "a.opf.md", "a.opf.md", "--exit-code"]).status, 0);
    assert.equal(run(["diff", "a.opf.md", "b.opf.md", "--exit-code"]).status, 1);
    const merged = run(["merge", "a.opf.md", "b.opf.md", "c.opf.json"]);
    assert.equal(merged.status, 0, merged.stderr);
    assert.match(merged.stdout, /^---\nname: Q3 Review/);
    assert.match(merged.stdout, /# Revenue fell/);
    assert.match(merged.stdout, /Kickoff on Friday\./);
    assert.equal(run(["merge", "a.opf.md", "b.opf.md", "c.opf.json", "merged.opf.json"]).status, 0);
    assert.equal(JSON.parse(read("merged.opf.json")).slides[0].title, "Revenue fell");
  });

  test("convert locates the validation errors of a Markdown deck before it draws", () => {
    write("render-bad.opf.md", "---\nname: Render\nlanguage: 5\n---\n\n# Hello\n");
    const bad = run(["convert", "render-bad.opf.md", "-", "--to", "svg"]);
    if (bad.status === 2 && /opf-render/.test(bad.stderr)) return; // the optional renderer is not installed
    assert.equal(bad.status, 1);
    const found = JSON.parse(bad.stderr).findings.find((entry) => entry.path === "/language");
    assert.deepEqual([found.location.line, found.location.column], [3, 1]);
  });
});

describe("writing a deck.opf.md", () => {
  test("edit writes the format it read: Markdown to stdout, in place, and to a .opf.md name", () => {
    write("e.opf.md", deckMd);
    const rename = patch("rename.json", [{ op: "replace", path: "/name", value: "Renamed" }]);
    const stdout = run(["edit", "e.opf.md", "--patch", rename]);
    assert.equal(stdout.status, 0, stdout.stderr);
    assert.equal(stdout.stdout, deckMd.replace("name: Q3 Review", "name: Renamed"));
    assert.equal(run(["edit", "e.opf.md", "--patch", rename, "-i"]).status, 0);
    assert.equal(read("e.opf.md"), deckMd.replace("name: Q3 Review", "name: Renamed"));
    assert.equal(run(["edit", "e.opf.md", "copy.opf.md", "--patch", rename]).status, 0);
    assert.equal(read("copy.opf.md"), read("e.opf.md"));
  });

  test("an output name or --to overrides the format that was read, in both directions", () => {
    write("f.opf.md", deckMd);
    const noop = patch("noop.json", [{ op: "replace", path: "/name", value: "Q3 Review" }]);
    const toJson = run(["edit", "f.opf.md", "f.opf.json", "--patch", noop]);
    assert.equal(toJson.status, 0, toJson.stderr);
    assert.deepEqual(JSON.parse(read("f.opf.json")), deck);
    assert.deepEqual(JSON.parse(run(["edit", "f.opf.md", "--patch", noop, "--to", "json"]).stdout), deck);
    assert.match(run(["edit", "f.opf.md", "--patch", noop, "--to", "yaml"]).stdout, /^name: Q3 Review\nlanguage: en-US\nslides:\n/);
    write("g.opf.json", JSON.stringify(deck));
    for (const flag of ["markdown", "md"]) assert.equal(run(["edit", "g.opf.json", "--patch", noop, "--to", flag]).stdout, deckMd, flag);
    assert.equal(run(["edit", "g.opf.json", "g.opf.md", "--patch", noop]).status, 0);
    assert.equal(read("g.opf.md"), deckMd);
    assert.equal(run(["edit", "g.opf.json", "g.out", "--patch", noop, "--to", "md"]).status, 0);
    assert.equal(read("g.out"), deckMd, "--to decides for another name");
    write("h.opf.yaml", "name: Q3 Review\nslides:\n  - title: A\n");
    assert.equal(run(["edit", "h.opf.yaml", "h.opf.md", "--patch", noop]).status, 0);
    assert.equal(read("h.opf.md"), "---\nname: Q3 Review\n---\n\n# A\n");
    assert.equal(run(["edit", "h.opf.md", "--patch", noop, "--to", "toml"]).status, 2);
  });

  test("a rewrite that moves content into opf-slide fences says so on stderr; a deck that already had them does not", () => {
    write("w.opf.md", deckMd);
    const design = patch("design.json", [{ op: "add", path: "/slides/0/design", value: { colorScheme: "forest-green" } }]);
    const first = run(["edit", "w.opf.md", "--patch", design]);
    assert.equal(first.status, 0, first.stderr);
    assert.match(first.stdout, /```opf-slide\ndesign:\n {2}colorScheme: forest-green\n```/);
    assert.match(first.stderr, /warning: the output has 1 more opf-slide\/opf-block fence than before/);
    assert.equal(run(["edit", "w.opf.md", "--patch", design, "-i"]).status, 0);
    assert.match(read("w.opf.md"), /```opf-slide/);
    const again = run(["edit", "w.opf.md", "--patch", patch("rename2.json", [{ op: "replace", path: "/name", value: "Again" }])]);
    assert.equal(again.status, 0, again.stderr);
    assert.doesNotMatch(again.stderr, /fence/, "the fence was already there");
    // A JSON deck written as Markdown carries the same content in a fence, and says so.
    write("styled.opf.json", JSON.stringify({ name: "S", slides: [{ title: "A", design: { colorScheme: "forest-green" } }] }));
    const converted = run(["convert", "styled.opf.json", "-", "--to", "md"]);
    assert.match(converted.stderr, /1 more opf-slide\/opf-block fence than before/);
    assert.equal(run(["validate", "-", "--from", "md"], converted.stdout).status, 0);
  });

  test("format canonicalizes a Markdown deck; --check and -i work; convert changes the form", () => {
    const loose = "---\nname:   Q3 Review\nlanguage: en-US\n---\n\n\n# Revenue grew\n\n* Faster onboarding\n* Fewer tickets\n\n\n---\n\n# Next steps\nKickoff on Monday.\n";
    write("loose.opf.md", loose);
    const check = run(["format", "loose.opf.md", "--check"]);
    assert.equal(check.status, 1);
    assert.deepEqual(JSON.parse(check.stdout).unformatted, ["loose.opf.md"]);
    assert.equal(run(["format", "loose.opf.md"]).stdout, deckMd);
    assert.equal(run(["format", "loose.opf.md", "-i"]).status, 0);
    assert.equal(read("loose.opf.md"), deckMd);
    assert.equal(run(["format", "loose.opf.md", "--check"]).status, 0);
    assert.deepEqual(JSON.parse(run(["convert", "loose.opf.md", "-", "--to", "json"]).stdout), deck);
    write("fmt.opf.json", JSON.stringify(deck));
    assert.equal(run(["convert", "fmt.opf.json", "-", "--to", "md"]).stdout, deckMd);
    assert.equal(run(["convert", "fmt.opf.json", "fmt.opf.md"]).status, 0);
    assert.equal(read("fmt.opf.md"), deckMd);
    assert.equal(run(["format", "fmt.opf.json", "fmt2.opf.md"]).status, 2, "format keeps the form");
    assert.equal(run(["format", "-", "--from", "md"], loose).stdout, deckMd);
    assert.equal(run(["format", "loose.opf.md", "--indent", "4"]).status, 2, "--indent is for JSON");
    assert.equal(run(["format", "loose.opf.md", "--eol", "crlf"]).stdout, deckMd.replaceAll("\n", "\r\n"));
    write("fmt-crlf.opf.md", deckMd.replaceAll("\n", "\r\n"));
    assert.equal(run(["format", "fmt-crlf.opf.md", "--check", "--eol", "preserve"]).status, 0);
    write("fmt-invalid.opf.md", "---\nname: x\nlanguage: 5\n---\n\n# A\n");
    const invalid = run(["format", "fmt-invalid.opf.md"]);
    assert.equal(invalid.status, 1);
    assert.match(JSON.parse(invalid.stderr).error, /Cannot format fmt-invalid\.opf\.md/);
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

  test("convert copies any deck into the form the output names; create writes JSON unless the output or --to says otherwise", () => {
    write("c.opf.json", JSON.stringify(deck));
    const created = run(["convert", "c.opf.json", "created.opf.md"]);
    assert.equal(created.status, 0, created.stderr);
    assert.equal(read("created.opf.md"), deckMd);
    assert.equal(run(["convert", "created.opf.md", "-", "--to", "md"]).stdout, deckMd);
    assert.equal(run(["convert", "created.opf.md", "-", "--to", "json"]).stdout.trimStart()[0], "{");
    assert.equal(run(["create", "-", "--title", "Fresh"]).stdout.trimStart()[0], "{", "no deck input: JSON");
    assert.match(run(["create", "-", "--title", "Fresh", "--to", "md"]).stdout, /^---\n(?:\$schema: .*\n)?name: Fresh\n---\n\n(?:<!-- .* -->\n)?# Fresh\n/);
    assert.equal(run(["create", "fresh.opf.md", "--title", "Fresh"]).status, 0);
    assert.equal(run(["validate", "fresh.opf.md"]).status, 0);
  });

  test("ingest and fill read Markdown decks and write them by --to md or the output name", () => {
    write("data.csv", "Quarter,Revenue\nQ1,12\nQ2,18\n");
    write("data.opf.md", deckMd);
    const into = run(["ingest", "data.csv", "--as", "chart", "--into", "data.opf.md", "-i"]);
    assert.equal(into.status, 0, into.stderr);
    assert.match(read("data.opf.md"), /```chart/);
    assert.equal(run(["validate", "data.opf.md"]).status, 0);
    const fresh = run(["ingest", "data.csv", "--as", "table", "--to", "md"]);
    assert.equal(fresh.status, 0, fresh.stderr);
    assert.match(fresh.stdout, /\| Quarter \| Revenue \|/);

    const template = run(["convert", TEMPLATE, "template.opf.md"]);
    assert.equal(template.status, 0, template.stderr);
    write("values.json", JSON.stringify({ client: "Acme", revenue: 12, kickoff: "2026-10-01", wins: ["a", "b"] }));
    const single = run(["fill", "template.opf.md", "values.json"]);
    assert.equal(single.status, 0, single.stderr);
    assert.match(single.stdout, /^---\n(?:.*\n)*?name: Quarterly review for Acme\n/, single.stdout.slice(0, 200));
    const dir = path.join(temp, "filled-md");
    write("people.csv", "client,revenue,kickoff,wins\nAcme,10,2026-10-01,a\nBeta,20,2026-11-01,b\n");
    const many = run(["fill", "template.opf.md", "people.csv", path.join(dir, "{client}.opf.md")]);
    assert.equal(many.status, 0, many.stderr);
    assert.deepEqual(readdirSync(dir).sort(), ["acme.opf.md", "beta.opf.md"]);
    const asMd = run(["fill", TEMPLATE, "values.json", "--to", "md"]);
    assert.equal(asMd.status, 0, asMd.stderr);
    assert.match(asMd.stdout, /^---\n/);
    const jsonDir = path.join(temp, "filled-json");
    assert.equal(run(["fill", TEMPLATE, "people.csv", path.join(jsonDir, "{client}.opf.json")]).status, 0);
    assert.deepEqual(readdirSync(jsonDir).sort(), ["acme.opf.json", "beta.opf.json"]);
  });
});

describe("the removed conversion commands name opf convert", () => {
  test("from-md, to-md, from-yaml and to-yaml are usage errors that name the replacement", () => {
    write("source.md", deckMd);
    for (const command of ["from-md", "to-md", "from-yaml", "to-yaml"]) {
      const result = run([command, "source.md"]);
      assert.equal(result.status, 2, command);
      const error = JSON.parse(result.stderr);
      assert.equal(error.code, "removed-command", command);
      assert.match(error.error, /use opf convert/, command);
    }
    assert.equal(existsSync(path.join(temp, "out.opf.md")), false);
  });

  test("the help documents Markdown decks", () => {
    const help = run(["--help"]).stdout;
    assert.match(help, /--from json\|yaml\|md/);
    assert.match(help, /\.opf\.md/);
    assert.match(run(["validate", "--help"]).stdout, /\.opf\.md/);
  });
});

describe("the template round trip", () => {
  test("a template written as Markdown validates as a template and comes back", () => {
    const converted = run(["convert", TEMPLATE, "tpl.opf.md"]);
    assert.equal(converted.status, 0, converted.stderr);
    assert.equal(run(["validate", "tpl.opf.md"]).status, 0);
    assert.deepEqual(JSON.parse(run(["convert", "tpl.opf.md", "-", "--to", "json"]).stdout), JSON.parse(readFileSync(TEMPLATE, "utf8")));
  });
});
