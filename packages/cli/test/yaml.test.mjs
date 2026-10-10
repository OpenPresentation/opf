// RR-56, RR-75: decks as YAML (.opf.yaml, .yml) in every command, and YAML to and from JSON through opf convert (from-yaml and
// to-yaml were removed in 0.18). Stdin is JSON when it starts with { or [, else --from names its form.
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { after, describe, test } from "node:test";

import { validate } from "@openpresentation/opf";

const formatValid = (value) => validate(value, { only: ["format"] }).valid;

const here = path.dirname(fileURLToPath(import.meta.url));
const CLI_BIN = process.env.OPF_TEST_BIN ?? path.resolve(here, "../dist/index.js");
const TEMPLATE = path.resolve(here, "fixtures/template.opf.json");
const temp = mkdtempSync(path.join(tmpdir(), "opf-yaml-cli-"));
after(() => rmSync(temp, { recursive: true, force: true }));

const run = (args, input, cwd = temp) => spawnSync(process.execPath, [CLI_BIN, ...args], { encoding: "utf8", input, cwd, maxBuffer: 64 * 1024 * 1024 });
const write = (name, text) => {
  const file = path.join(temp, name);
  writeFileSync(file, text);
  return file;
};
const read = (name) => readFileSync(path.join(temp, name), "utf8");
const fromYaml = (args, input) => run(["convert", "-", "-", "--from", "yaml", "--to", "json", ...args], input);
const sha = (result) => JSON.parse(result.stdout).sha256;

const deckYaml = `# yaml-language-server: $schema=https://openpresentation.org/schema/opf/v1
$schema: https://openpresentation.org/schema/opf/v1
name: Q3 Review
slides:
  - id: one
    title: Revenue grew
    items:
      - Faster onboarding
      - "yes"
  - id: two
    title: "2026-10-01"
    text: Kickoff
`;
const deck = {
  $schema: "https://openpresentation.org/schema/opf/v1",
  name: "Q3 Review",
  slides: [
    { id: "one", title: "Revenue grew", items: ["Faster onboarding", "yes"] },
    { id: "two", title: "2026-10-01", text: "Kickoff" },
  ],
};

describe("opf convert, YAML to JSON", () => {
  test("converts YAML from stdin to an OPF document on stdout and reports on stderr", () => {
    const result = fromYaml([], deckYaml);
    assert.equal(result.status, 0, result.stderr);
    const document = JSON.parse(result.stdout);
    assert.deepEqual(document, deck);
    assert.equal(formatValid(document), true);
    const report = JSON.parse(result.stderr);
    assert.equal(report.ok, true);
    assert.equal(report.format, "json");
    assert.match(report.outputs[0].sha256, /^[a-f0-9]{64}$/);
  });

  test("writes a file, refuses to replace it without --force and prints the report on stdout", () => {
    const input = write("one.opf.yaml", deckYaml);
    const output = path.join(temp, "one.opf.json");
    const first = run(["convert", input, output]);
    assert.equal(first.status, 0, first.stderr);
    assert.deepEqual(JSON.parse(readFileSync(output, "utf8")), deck);
    assert.equal(JSON.parse(first.stdout).outputs[0].file, path.resolve(output));
    const again = run(["convert", input, output]);
    assert.equal(again.status, 1);
    assert.match(JSON.parse(again.stderr).error, /already exists/);
    assert.equal(run(["convert", input, output, "--force"]).status, 0);
    assert.deepEqual(readdirSync(temp).filter((name) => name.endsWith(".tmp")), []);
  });

  test("a YAML error exits 2 and an OPF error exits 1, each with line and column, and nothing is written", () => {
    const output = path.join(temp, "broken.opf.json");
    const dialect = run(["convert", "-", output, "--from", "yaml"], "name: x\nname: y\nslides: [{title: a}]\n");
    assert.equal(dialect.status, 2);
    assert.equal(dialect.stdout, "");
    const error = JSON.parse(dialect.stderr);
    assert.equal(error.code, "invalid-yaml");
    assert.equal(error.findings[0].ruleId, "yaml/duplicate-key");
    assert.deepEqual([error.findings[0].location.line, error.findings[0].location.column], [2, 1]);
    const opf = run(["convert", "-", output, "--from", "yaml"], "name: x\nslides:\n  - title: 5\n");
    assert.equal(opf.status, 1);
    const found = JSON.parse(opf.stderr).findings[0];
    assert.match(found.ruleId, /^opf\//);
    assert.deepEqual([found.location.line, found.location.column], [3, 12]);
    assert.equal(existsSync(output), false);
  });

  test("anchors and aliases are refused unless --aliases expands them", () => {
    const aliased = "name: Shared\nslides:\n  - title: One\n    extensions:\n      a: &a {owner: ops}\n      b: *a\n";
    const refused = fromYaml([], aliased);
    assert.equal(refused.status, 2);
    assert.equal(JSON.parse(refused.stderr).findings[0].ruleId, "yaml/alias");
    const accepted = fromYaml(["--aliases"], aliased);
    assert.equal(accepted.status, 0, accepted.stderr);
    assert.deepEqual(JSON.parse(accepted.stdout).slides[0].extensions, { a: { owner: "ops" }, b: { owner: "ops" } });
    assert.equal(JSON.parse(run(["convert", "-", "-", "--to", "yaml", "--aliases"], JSON.stringify(deck)).stderr).code, "option-not-applicable", "--aliases needs a YAML input");
  });

  test("--fail-on warning fails on a warning", () => {
    const warning = "slides:\n  - title: Validate target\n    layout: pratner\n";
    assert.equal(fromYaml([], warning).status, 0);
    assert.equal(fromYaml(["--fail-on", "warning"], warning).status, 1);
    assert.equal(fromYaml(["--strict"], warning).status, 2, "--strict is gone");
  });

  test("usage errors exit 2", () => {
    assert.equal(run(["convert"]).status, 2);
    assert.equal(fromYaml(["--bogus"], "a: 1").status, 2);
    assert.equal(fromYaml(["--schema-comment"], "a: 1").status, 2, "--schema-comment is for a YAML output");
    assert.equal(run(["convert", path.join(temp, "missing.yaml"), "x.opf.json"]).status, 2);
    assert.equal(run(["convert", "-", "-", "--from", "yaml", "--to", "toml"], deckYaml).status, 2);
    assert.equal(run(["convert", "-", "-", "--to", "json"], deckYaml).status, 2, "stdin that is not JSON needs --from");
  });
});

describe("opf convert, a deck to YAML", () => {
  test("writes canonical YAML that reads back to the same deck", () => {
    const written = run(["convert", "-", "-", "--to", "yaml"], JSON.stringify({ slides: deck.slides, name: deck.name, $schema: deck.$schema }));
    assert.equal(written.status, 0, written.stderr);
    assert.equal(written.stdout, deckYaml.split("\n").slice(1).join("\n"));
    const back = fromYaml([], written.stdout);
    assert.deepEqual(JSON.parse(back.stdout), deck);
  });

  test("--schema-comment adds the editor modeline", () => {
    const result = run(["convert", "-", "-", "--to", "yaml", "--schema-comment"], JSON.stringify(deck));
    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.stdout, deckYaml);
  });

  test("a file output needs --force to be replaced; the report is on stdout", () => {
    const input = write("plain.opf.json", JSON.stringify(deck));
    const output = path.join(temp, "plain.opf.yaml");
    const first = run(["convert", input, output]);
    assert.equal(first.status, 0, first.stderr);
    assert.equal(JSON.parse(first.stdout).outputs[0].file, path.resolve(output));
    assert.equal(readFileSync(output, "utf8"), deckYaml.split("\n").slice(1).join("\n"));
    assert.equal(run(["convert", input, output]).status, 1);
    assert.equal(run(["convert", input, output, "--force"]).status, 0);
  });

  test("an invalid deck exits 1 and bad JSON exits 2", () => {
    const invalid = run(["convert", "-", "-", "--to", "yaml"], JSON.stringify({ slides: "no" }));
    assert.equal(invalid.status, 1);
    assert.match(JSON.parse(invalid.stderr).error, /not valid OPF/);
    assert.equal(run(["convert", "-", "-", "--to", "yaml"], "{").status, 2);
  });

  test("format canonicalizes YAML input, keeps its modeline and warns that comments are lost", () => {
    const messy = "# yaml-language-server: $schema=https://openpresentation.org/schema/opf/v1\n# a comment\nslides:\n  - text: b   # trailing\n    title: 'a'\nname: x\n";
    write("messy.opf.yaml", messy);
    const result = run(["format", "messy.opf.yaml", "messy-out.opf.yaml"]);
    assert.equal(result.status, 0, result.stderr);
    assert.equal(read("messy-out.opf.yaml"), "# yaml-language-server: $schema=https://openpresentation.org/schema/opf/v1\nname: x\nslides:\n  - title: a\n    text: b\n");
    assert.match(result.stderr, /warning: messy\.opf\.yaml has 2 comments; comments are not preserved/);
  });
});

describe("decks read from YAML by every command", () => {
  const yamlFile = () => write("deck.opf.yaml", deckYaml);

  test("a file ending .yaml or .yml is YAML; stdin and other names are JSON when they start with { or [, else --from says", () => {
    yamlFile();
    write("deck.yml", deckYaml);
    write("deck.txt", deckYaml);
    assert.equal(run(["validate", "deck.opf.yaml"]).status, 0);
    assert.equal(run(["validate", "deck.yml"]).status, 0);
    const unknown = run(["validate", "deck.txt"]);
    assert.equal(unknown.status, 2, "an unknown name that is not JSON needs --from");
    assert.equal(JSON.parse(unknown.stderr).code, "unknown-input-format");
    assert.equal(run(["validate", "deck.txt", "--from", "yaml"]).status, 0);
    assert.equal(run(["validate", "-"], deckYaml).status, 2);
    assert.equal(run(["validate", "-", "--from", "yaml"], deckYaml).status, 0);
    assert.equal(run(["validate", "-"], JSON.stringify(deck)).status, 0, "JSON is sniffed");
    assert.equal(run(["validate", "-", "--from", "toml"], "x").status, 2);
    assert.equal(run(["validate", "-", "--from"], "x").status, 2);
    assert.equal(run(["validate", "-", "--input-format", "yaml"], deckYaml).status, 2, "--input-format was renamed --from");
    const result = run(["validate", "deck.opf.yaml"]);
    assert.equal(JSON.parse(result.stdout).valid, true);
    assert.equal(sha(result), sha(run(["validate", "-", "--from", "yaml"], deckYaml)));
  });

  test("a YAML syntax error exits 2 with the line and column in the message; validate reports it as a finding", () => {
    write("bad.opf.yaml", "name: x\nslides:\n  - title: a\n  - title: b\n    title: c\n");
    const checked = run(["validate", "bad.opf.yaml"]);
    assert.equal(checked.status, 1, checked.stderr);
    const report = JSON.parse(checked.stdout);
    assert.equal(report.valid, false);
    assert.equal(report.schemaValid, null);
    assert.equal(report.findings[0].ruleId, "yaml/duplicate-key");
    assert.equal(report.findings[0].category, "format");
    assert.deepEqual([report.findings[0].location.line, report.findings[0].location.column], [5, 5]);
    for (const args of [["format", "bad.opf.yaml", "--check"], ["convert", "bad.opf.yaml", "out.opf.md"], ["paginate", "bad.opf.yaml", "out.opf.json"], ["embed", "bad.opf.yaml", "out.opf.json"]]) {
      const result = run(args);
      assert.equal(result.status, 2, `${args[0]}: ${result.stderr}`);
      const error = JSON.parse(result.stderr);
      assert.match(error.error, /^Invalid YAML in bad\.opf\.yaml at line 5, column 5: /, args[0]);
      assert.equal(error.findings[0].ruleId, "yaml/duplicate-key");
    }
    assert.equal(existsSync(path.join(temp, "out.opf.json")), false);
    const stdin = run(["convert", "-", "-", "--from", "yaml", "--to", "md"], "a: [");
    assert.equal(stdin.status, 2);
    assert.match(JSON.parse(stdin.stderr).error, /^Invalid YAML in stdin at line \d+, column \d+: /);
    for (const [text, rule] of [["- a\n", "yaml/not-mapping"], ["", "yaml/empty"], ["a: 1\n---\nb: 2\n", "yaml/multiple-documents"], ["a: &x 1\nb: *x\n", "yaml/alias"], ["a: !x 1\n", "yaml/tag"], ["a: .nan\n", "yaml/number"]]) {
      const result = run(["validate", "-", "--from", "yaml"], text);
      assert.equal(result.status, 1, text);
      assert.equal(JSON.parse(result.stdout).findings[0].ruleId, rule, text);
    }
  });

  test("convert copies a YAML deck, and create writes YAML for a .yaml output or --to yaml", () => {
    yamlFile();
    const copy = run(["convert", "deck.opf.yaml", "copy.opf.json"]);
    assert.equal(copy.status, 0, copy.stderr);
    assert.deepEqual(JSON.parse(read("copy.opf.json")), deck);
    const created = run(["create", "new.opf.yaml", "--title", "Fresh", "--schema-comment"]);
    assert.equal(created.status, 0, created.stderr);
    assert.equal(read("new.opf.yaml"), "# yaml-language-server: $schema=https://openpresentation.org/schema/opf/v1\n$schema: https://openpresentation.org/schema/opf/v1\nname: Fresh\nslides:\n  - id: slide-1\n    title: Fresh\n");
    assert.equal(JSON.parse(created.stdout).outputs[0].sha256, sha(run(["validate", "new.opf.yaml"])));
    const stdout = run(["create", "-", "--title", "Piped", "--to", "yaml"]);
    assert.match(stdout.stdout, /^\$schema: .*\nname: Piped\nslides:\n {2}- id: slide-1\n {4}title: Piped\n$/);
    assert.equal(run(["create", "-", "--title", "Piped", "--to", "toml"]).status, 2);
    assert.equal(run(["create", "-", "--to", "json"]).stdout.trimStart()[0], "{");
    assert.equal(run(["create", "-", "--format", "yaml"]).status, 2, "--format names a report format only");
    assert.equal(JSON.parse(run(["create", "x.json", "--from", "deck.opf.yaml"]).stderr).code, "removed-option");
  });

  test("validate locates its findings in the YAML", () => {
    write("check.opf.yaml", "name: Check\nslides:\n  - title: Target\n    layout: pratner\n");
    const checked = run(["validate", "check.opf.yaml", "--only", "references"]);
    assert.equal(checked.status, 0, checked.stderr);
    const result = JSON.parse(checked.stdout);
    assert.equal(result.valid, true);
    assert.equal(result.counts.warning, 1);
    assert.equal(result.findings[0].ruleId, "opf/unresolved-reference");
    assert.deepEqual([result.findings[0].location.line, result.findings[0].location.column], [4, 13]);
    assert.equal(run(["validate", "check.opf.yaml", "--only", "references", "--fail-on", "warning"]).status, 1);
    const broken = run(["validate", "-", "--from", "yaml"], "name: x\nname: y\n");
    assert.equal(broken.status, 1);
    assert.equal(JSON.parse(broken.stdout).findings[0].ruleId, "yaml/duplicate-key");
    assert.equal(JSON.parse(broken.stdout).schemaValid, null);
    const config = write("check-config.json", JSON.stringify({ contracts: [{ path: "/slides/0/layout", allowedValues: ["title"] }] }));
    assert.equal(run(["validate", "check.opf.yaml", "--config", config]).status, 1, "a JSON config applies to a YAML deck");
    write("picture.opf.yaml", "name: Picture\nslides:\n  - title: Picture\n    image:\n      src: https://example.com/a.png\n");
    const full = JSON.parse(run(["validate", "picture.opf.yaml"]).stdout);
    assert.ok(full.findings.length > 0);
    for (const found of full.findings) assert.ok(found.location, found.ruleId);
    const alt = full.findings.find((found) => found.path.startsWith("/slides/0/image"));
    assert.ok(alt && alt.location.line >= 4);
  });

  test("edit applies a JSON patch or a YAML patch to a YAML deck and writes YAML in place, keeping the modeline", () => {
    write("edit.opf.yaml", `${deckYaml.replace("name: Q3 Review", "# the deck\nname: Q3 Review")}`);
    write("patch.json", JSON.stringify([{ op: "replace", path: "/slides/0/title", value: "Edited" }]));
    const result = run(["edit", "edit.opf.yaml", "--patch", "patch.json", "-i"]);
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stderr, /warning: edit\.opf\.yaml has 1 comment; comments are not preserved/);
    const edited = read("edit.opf.yaml");
    assert.match(edited, /^# yaml-language-server: \$schema=/);
    assert.match(edited, /title: Edited/);
    assert.doesNotMatch(edited, /the deck/);
    assert.doesNotMatch(edited, /^\s*\{/m);
    write("patch.yaml", "- op: replace\n  path: /slides/1/text\n  value: From YAML patch\n");
    const second = run(["edit", "edit.opf.yaml", "--patch", "patch.yaml", "--in-place"]);
    assert.equal(second.status, 0, second.stderr);
    assert.equal(second.stderr.includes("warning"), false, "the file has no comments left, so there is nothing to warn about");
    assert.match(read("edit.opf.yaml"), /text: From YAML patch/);
    // A patch on stdin that does not start with [ or { is YAML; the result goes to stdout and nothing is written.
    const stdout = run(["edit", "edit.opf.yaml", "--patch", "-"], "- op: replace\n  path: /name\n  value: Dry\n");
    assert.equal(stdout.status, 0, stdout.stderr);
    assert.match(stdout.stdout, /name: Dry/);
    assert.doesNotMatch(read("edit.opf.yaml"), /name: Dry/);
    assert.equal("dryRun" in JSON.parse(stdout.stderr), false);
    assert.equal(JSON.parse(run(["edit", "edit.opf.yaml", "--patch", "patch.json", "--dry-run"]).stderr).code, "removed-option");
  });

  test("edit on a YAML deck prints YAML to stdout by default, and JSON with --to json", () => {
    write("edit2.opf.yaml", deckYaml);
    write("patch2.json", JSON.stringify([{ op: "replace", path: "/name", value: "Stdout" }]));
    const yaml = run(["edit", "edit2.opf.yaml", "--patch", "patch2.json"]);
    assert.equal(yaml.status, 0, yaml.stderr);
    assert.match(yaml.stdout, /^# yaml-language-server: /);
    assert.match(yaml.stdout, /name: Stdout/);
    const json = run(["edit", "edit2.opf.yaml", "--patch", "patch2.json", "--to", "json"]);
    assert.equal(JSON.parse(json.stdout).name, "Stdout");
    const toJson = run(["edit", "edit2.opf.yaml", "edit2.out.json", "--patch", "patch2.json"]);
    assert.equal(toJson.status, 0, toJson.stderr);
    assert.equal(JSON.parse(read("edit2.out.json")).name, "Stdout");
    // A JSON deck is written as YAML for a .yaml output; --to that disagrees with the name is refused.
    write("edit2.json", JSON.stringify(deck));
    assert.equal(run(["edit", "edit2.json", "edit2.out.yaml", "--patch", "patch2.json"]).status, 0);
    assert.match(read("edit2.out.yaml"), /name: Stdout/);
    assert.equal(run(["edit", "edit2.json", "edit2.out2.yaml", "--patch", "patch2.json", "--to", "json"]).status, 2);
  });

  test("format rewrites YAML canonically and checks it; opf convert changes the form", () => {
    write("fmt.opf.yaml", "slides:\n  - text: b\n    title: 'a'\nname: x\n");
    assert.equal(run(["format", "fmt.opf.yaml", "--check"]).status, 1);
    const printed = run(["format", "fmt.opf.yaml"]);
    assert.equal(printed.stdout, "name: x\nslides:\n  - title: a\n    text: b\n");
    assert.equal(run(["format", "fmt.opf.yaml", "-i"]).status, 0);
    assert.equal(read("fmt.opf.yaml"), "name: x\nslides:\n  - title: a\n    text: b\n");
    assert.equal(run(["format", "fmt.opf.yaml", "--check"]).status, 0);
    assert.equal(run(["format", "fmt.opf.yaml", "--to", "json"]).status, 2, "format keeps the form");
    assert.equal(JSON.parse(run(["convert", "fmt.opf.yaml", "-", "--to", "json"]).stdout).name, "x");
    assert.equal(run(["format", "fmt.opf.yaml", "--indent", "4"]).status, 2, "--indent is for JSON");
    const crlf = run(["format", "fmt.opf.yaml", "--eol", "crlf"]);
    assert.equal(crlf.stdout, "name: x\r\nslides:\r\n  - title: a\r\n    text: b\r\n");
    write("fmt-crlf.opf.yaml", crlf.stdout);
    assert.equal(run(["format", "fmt-crlf.opf.yaml", "--check", "--eol", "preserve"]).status, 0);
    write("fmt-invalid.opf.yaml", "slides: nope\n");
    const invalid = run(["format", "fmt-invalid.opf.yaml"]);
    assert.equal(invalid.status, 1);
    assert.match(JSON.parse(invalid.stderr).error, /Cannot format fmt-invalid\.opf\.yaml/);
  });

  test("a rewrite keeps the file's own modeline verbatim", () => {
    const own = "# yaml-language-server: $schema=./schemas/local-opf.schema.json\nname: x\nslides:\n  - title: a\n";
    write("modeline.opf.yaml", own);
    assert.equal(run(["format", "modeline.opf.yaml"]).stdout, own);
    assert.equal(run(["format", "modeline.opf.yaml", "--check"]).status, 0);
    write("modeline.patch.json", JSON.stringify([{ op: "replace", path: "/name", value: "Renamed" }]));
    assert.equal(run(["edit", "modeline.opf.yaml", "--patch", "modeline.patch.json"]).stdout, own.replace("name: x", "name: Renamed"));
    const none = "name: x\nslides:\n  - title: a\n";
    write("nomodeline.opf.yaml", none);
    assert.equal(run(["format", "nomodeline.opf.yaml"]).stdout, none, "none is generated for a file without one");
    assert.equal(run(["convert", "nomodeline.opf.yaml", "-", "--to", "yaml", "--schema-comment"]).stdout, `# yaml-language-server: $schema=https://openpresentation.org/schema/opf/v1\n${none}`);
  });

  test("diff and merge read YAML; merge writes the ours format", () => {
    write("base.opf.yaml", deckYaml);
    write("ours.opf.yaml", deckYaml.replace("Revenue grew", "Ours"));
    write("theirs.opf.json", JSON.stringify({ ...deck, slides: [deck.slides[0], { ...deck.slides[1], text: "Theirs" }] }));
    const diff = run(["diff", "base.opf.yaml", "ours.opf.yaml", "--format", "json"]);
    assert.equal(JSON.parse(diff.stdout).equal, false);
    assert.equal(run(["diff", "base.opf.yaml", "base.opf.yaml", "--exit-code"]).status, 0);
    assert.equal(run(["diff", "base.opf.yaml", "theirs.opf.json", "--exit-code"]).status, 1);
    const merged = run(["merge", "base.opf.yaml", "ours.opf.yaml", "theirs.opf.json"]);
    assert.equal(merged.status, 0, merged.stderr);
    assert.match(merged.stdout, /^# yaml-language-server: /);
    assert.match(merged.stdout, /title: Ours/);
    assert.match(merged.stdout, /text: Theirs/);
    assert.equal(run(["merge", "base.opf.yaml", "ours.opf.yaml", "theirs.opf.json", "merged.opf.json"]).status, 0);
    assert.equal(JSON.parse(read("merged.opf.json")).slides[1].text, "Theirs");
  });

  test("ingest, paginate and embed read and write YAML", () => {
    write("data.csv", "Quarter,Revenue\nQ1,12\nQ2,18\n");
    write("data-deck.opf.yaml", deckYaml);
    const into = run(["ingest", "data.csv", "--as", "chart", "--into", "data-deck.opf.yaml", "-i"]);
    assert.equal(into.status, 0, into.stderr);
    const after = read("data-deck.opf.yaml");
    assert.match(after, /^# yaml-language-server: /);
    assert.match(after, /chart:/);
    assert.equal(formatValid(JSON.parse(run(["convert", "data-deck.opf.yaml", "-", "--to", "json"]).stdout)), true);
    const yaml = run(["ingest", "data.csv", "--as", "table", "--to", "yaml"]);
    assert.equal(yaml.status, 0, yaml.stderr);
    assert.match(yaml.stdout, /^slides:\n {2}- id: data-1\n/);
    assert.equal(run(["ingest", "data.csv", "--as", "table", "--data-format", "csv"]).stdout.trimStart()[0], "{");
    assert.equal(run(["ingest", "data.csv", "--as", "table", "--format", "csv"]).status, 2, "--format names a report format only");
    const paginated = run(["paginate", "data-deck.opf.yaml", "paginated.opf.yaml"]);
    assert.equal(paginated.status, 0, paginated.stderr);
    assert.match(read("paginated.opf.yaml"), /^# yaml-language-server: /);
    write("deck.opf.yaml", deckYaml);
    assert.equal(run(["embed", "deck.opf.yaml", "embedded.opf.yaml"]).status, 0);
    assert.match(read("embedded.opf.yaml"), /name: Q3 Review/);
  });

  test("fill reads a YAML template and data, and writes the form of the template, the pattern or --to", () => {
    const template = run(["convert", TEMPLATE, "template.opf.yaml"]);
    assert.equal(template.status, 0, template.stderr);
    write("values.json", JSON.stringify({ client: "Acme", revenue: 12, kickoff: "2026-10-01", wins: ["a", "b"] }));
    const single = run(["fill", "template.opf.yaml", "values.json"]);
    assert.equal(single.status, 0, single.stderr);
    assert.match(single.stdout, /^name: Quarterly review for Acme\n/m, single.stdout.slice(0, 200));
    const dir = path.join(temp, "filled");
    write("people.csv", "client,revenue,kickoff,wins\nAcme,10,2026-10-01,a\nBeta,20,2026-11-01,b\n");
    const many = run(["fill", "template.opf.yaml", "people.csv", path.join(dir, "{client}.opf.yaml")]);
    assert.equal(many.status, 0, many.stderr);
    assert.deepEqual(readdirSync(dir).sort(), ["acme.opf.yaml", "beta.opf.yaml"]);
    const json = run(["fill", "template.opf.yaml", "values.json", "--data-format", "json"]);
    assert.equal(json.status, 0, json.stderr);
    assert.match(json.stdout, /^name: Quarterly review for Acme/m, "--data-format names the data; the output follows the template");
    const asYaml = run(["fill", TEMPLATE, "values.json", "--to", "yaml"]);
    assert.equal(asYaml.status, 0, asYaml.stderr);
    assert.match(asYaml.stdout, /^\$schema: /);
    const jsonOut = path.join(temp, "filled-json");
    assert.equal(run(["fill", TEMPLATE, "people.csv", path.join(jsonOut, "{client}.opf.json")]).status, 0);
    assert.deepEqual(readdirSync(jsonOut).sort(), ["acme.opf.json", "beta.opf.json"]);
  });

  test("convert writes YAML from Markdown and Markdown from YAML", () => {
    const md = run(["convert", "-", "md.opf.yaml", "--from", "md"], "---\nname: From Markdown\n---\n\n# One\n\n- a\n- b\n");
    assert.equal(md.status, 0, md.stderr);
    assert.equal(read("md.opf.yaml"), "name: From Markdown\nslides:\n  - title: One\n    items:\n      - a\n      - b\n");
    assert.equal(JSON.parse(md.stdout).outputs[0].sha256, sha(run(["validate", "md.opf.yaml"])));
    assert.equal(run(["convert", "-", "-", "--from", "md", "--to", "yaml"], "# One\n").stdout, "slides:\n  - title: One\n");
    const back = run(["convert", "md.opf.yaml", "-", "--to", "md"]);
    assert.equal(back.status, 0, back.stderr);
    assert.equal(back.stdout, "---\nname: From Markdown\n---\n\n# One\n\n- a\n- b\n");
    assert.equal(run(["convert", "-", "-", "--to", "md"], deckYaml).status, 2, "stdin that is not JSON needs --from");
    assert.equal(run(["convert", "-", "-", "--from", "yaml", "--to", "md"], deckYaml).status, 0);
  });
});

describe("help", () => {
  test("the usage documents --from, --to and the YAML flags", () => {
    const help = run(["--help"]).stdout;
    assert.match(help, /--from json\|yaml\|md/);
    assert.match(help, /--to json\|yaml\|md/);
    assert.doesNotMatch(help, /--input-format|from-yaml|to-yaml/);
    assert.match(run(["convert", "-h"]).stdout, /--aliases/);
    assert.match(run(["format", "--help"]).stdout, /does not keep its comments/);
  });
});
