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

describe("opf from-yaml", () => {
  test("converts YAML from stdin to an OPF document on stdout and reports on stderr", () => {
    const result = run(["from-yaml", "-"], deckYaml);
    assert.equal(result.status, 0, result.stderr);
    const document = JSON.parse(result.stdout);
    assert.deepEqual(document, deck);
    assert.equal(formatValid(document), true);
    const summary = JSON.parse(result.stderr);
    assert.equal(summary.valid, true);
    assert.equal(summary.slides, 2);
    assert.match(summary.sha256, /^[a-f0-9]{64}$/);
  });

  test("writes a file, refuses to replace it without --force and prints the report on stdout", () => {
    const input = write("one.opf.yaml", deckYaml);
    const output = path.join(temp, "one.opf.json");
    const first = run(["from-yaml", input, output]);
    assert.equal(first.status, 0, first.stderr);
    assert.deepEqual(JSON.parse(readFileSync(output, "utf8")), deck);
    assert.equal(JSON.parse(first.stdout).output, path.resolve(output));
    const again = run(["from-yaml", input, output]);
    assert.equal(again.status, 1);
    assert.match(JSON.parse(again.stderr).error, /already exists/);
    assert.equal(run(["from-yaml", input, output, "--force"]).status, 0);
    assert.deepEqual(readdirSync(temp).filter((name) => name.endsWith(".tmp")), []);
  });

  test("a YAML or OPF error exits 1 with line and column and writes nothing", () => {
    const output = path.join(temp, "broken.opf.json");
    const dialect = run(["from-yaml", "-", output], "name: x\nname: y\nslides: [{title: a}]\n");
    assert.equal(dialect.status, 1);
    assert.equal(dialect.stdout, "");
    const error = JSON.parse(dialect.stderr);
    assert.equal(error.error, "YAML conversion failed.");
    assert.equal(error.yaml.findings[0].ruleId, "yaml/duplicate-key");
    assert.deepEqual([error.yaml.findings[0].location.line, error.yaml.findings[0].location.column], [2, 1]);
    const opf = run(["from-yaml", "-", output], "name: x\nslides:\n  - title: 5\n");
    assert.equal(opf.status, 1);
    const found = JSON.parse(opf.stderr).yaml.findings[0];
    assert.match(found.ruleId, /^opf\//);
    assert.deepEqual([found.location.line, found.location.column], [3, 12]);
    assert.equal(existsSync(output), false);
  });

  test("anchors and aliases are refused unless --aliases expands them", () => {
    const aliased = "name: Shared\nslides:\n  - title: One\n    extensions:\n      a: &a {owner: ops}\n      b: *a\n";
    const refused = run(["from-yaml", "-"], aliased);
    assert.equal(refused.status, 1);
    assert.equal(JSON.parse(refused.stderr).yaml.findings[0].ruleId, "yaml/alias");
    assert.match(JSON.parse(refused.stderr).yaml.findings[0].help, /aliases: true/);
    const accepted = run(["from-yaml", "-", "--aliases"], aliased);
    assert.equal(accepted.status, 0, accepted.stderr);
    assert.deepEqual(JSON.parse(accepted.stdout).slides[0].extensions, { a: { owner: "ops" }, b: { owner: "ops" } });
  });

  test("--fail-on warning fails on a warning", () => {
    const warning = "slides:\n  - title: Validate target\n    layout: pratner\n";
    assert.equal(run(["from-yaml", "-"], warning).status, 0);
    assert.equal(run(["from-yaml", "-", "--fail-on", "warning"], warning).status, 1);
    assert.equal(run(["from-yaml", "-", "--strict"], warning).status, 2, "--strict is gone");
  });

  test("usage errors exit 2", () => {
    assert.equal(run(["from-yaml"]).status, 2);
    assert.equal(run(["from-yaml", "-", "--bogus"], "a: 1").status, 2);
    assert.equal(run(["from-yaml", "-", "--schema-comment"], "a: 1").status, 2);
    assert.equal(run(["from-yaml", path.join(temp, "missing.yaml")]).status, 2);
    assert.equal(run(["from-yaml", "-", "out.opf.yaml"], deckYaml).status, 2, "from-yaml writes JSON");
  });
});

describe("opf to-yaml", () => {
  test("writes canonical YAML that from-yaml reads back to the same deck", () => {
    const toYaml = run(["to-yaml", "-"], JSON.stringify({ slides: deck.slides, name: deck.name, $schema: deck.$schema }));
    assert.equal(toYaml.status, 0, toYaml.stderr);
    assert.equal(toYaml.stdout, deckYaml.split("\n").slice(1).join("\n"));
    assert.equal(JSON.parse(toYaml.stderr).schemaComment, false);
    const back = run(["from-yaml", "-"], toYaml.stdout);
    assert.deepEqual(JSON.parse(back.stdout), deck);
  });

  test("--schema-comment adds the editor modeline", () => {
    const result = run(["to-yaml", "-", "--schema-comment"], JSON.stringify(deck));
    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.stdout, deckYaml);
    assert.equal(JSON.parse(result.stderr).schemaComment, true);
  });

  test("a file output needs --force to be replaced; the report is on stdout", () => {
    const input = write("plain.opf.json", JSON.stringify(deck));
    const output = path.join(temp, "plain.opf.yaml");
    const first = run(["to-yaml", input, output]);
    assert.equal(first.status, 0, first.stderr);
    assert.equal(JSON.parse(first.stdout).output, path.resolve(output));
    assert.equal(readFileSync(output, "utf8"), deckYaml.split("\n").slice(1).join("\n"));
    assert.equal(run(["to-yaml", input, output]).status, 1);
    assert.equal(run(["to-yaml", input, output, "--force"]).status, 0);
  });

  test("an invalid deck exits 1 and bad JSON exits 2", () => {
    const invalid = run(["to-yaml", "-"], JSON.stringify({ slides: "no" }));
    assert.equal(invalid.status, 1);
    assert.match(JSON.parse(invalid.stderr).error, /not valid OPF/);
    assert.equal(run(["to-yaml", "-"], "{").status, 2);
  });

  test("YAML input is canonicalized, keeps its modeline and warns that comments are lost", () => {
    const messy = "# yaml-language-server: $schema=https://openpresentation.org/schema/opf/v1\n# a comment\nslides:\n  - text: b   # trailing\n    title: 'a'\nname: x\n";
    const result = run(["to-yaml", "-", "--input-format", "yaml"], messy);
    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.stdout, "# yaml-language-server: $schema=https://openpresentation.org/schema/opf/v1\nname: x\nslides:\n  - title: a\n    text: b\n");
    assert.match(result.stderr, /warning: stdin has 2 comments; comments are not preserved/);
  });
});

describe("decks read from YAML by every command", () => {
  const yamlFile = () => write("deck.opf.yaml", deckYaml);

  test("a file ending .yaml or .yml is YAML; stdin and other names follow --input-format, JSON by default", () => {
    yamlFile();
    write("deck.yml", deckYaml);
    write("deck.txt", deckYaml);
    assert.equal(run(["validate", "deck.opf.yaml"]).status, 0);
    assert.equal(run(["validate", "deck.yml"]).status, 0);
    assert.equal(run(["validate", "deck.txt"]).status, 1, "an unknown name is JSON by default, and YAML is not valid JSON");
    assert.equal(run(["validate", "deck.txt", "--input-format", "yaml"]).status, 0);
    assert.equal(run(["validate", "-"], deckYaml).status, 1);
    assert.equal(run(["validate", "-", "--input-format", "yaml"], deckYaml).status, 0);
    assert.equal(run(["--input-format", "yaml", "validate", "-"], deckYaml).status, 0);
    assert.equal(run(["validate", "-", "--input-format", "json"], JSON.stringify(deck)).status, 0);
    assert.equal(run(["validate", "-", "--input-format", "toml"], "x").status, 2);
    assert.equal(run(["validate", "-", "--input-format"], "x").status, 2);
    const result = run(["validate", "deck.opf.yaml"]);
    assert.equal(JSON.parse(result.stdout).valid, true);
    assert.equal(JSON.parse(result.stdout).sha256, run(["validate", "-", "--input-format", "yaml"], deckYaml).stdout.match(/"sha256": "(\w+)"/)[1]);
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
    for (const args of [["format", "--check"], ["to-md"], ["paginate"], ["embed"]]) {
      const extra = args[0] === "paginate" || args[0] === "embed" ? ["bad.opf.yaml", "out.opf.json"] : ["bad.opf.yaml"];
      const result = run([args[0], ...extra, ...args.slice(1)]);
      assert.equal(result.status, 2, `${args[0]}: ${result.stderr}`);
      const error = JSON.parse(result.stderr);
      assert.match(error.error, /^Invalid YAML in bad\.opf\.yaml at line 5, column 5: /, args[0]);
      assert.equal(error.yaml.findings[0].ruleId, "yaml/duplicate-key");
    }
    assert.equal(existsSync(path.join(temp, "out.opf.json")), false);
    const stdin = run(["to-md", "-", "--input-format", "yaml"], "a: [");
    assert.equal(stdin.status, 2);
    assert.match(JSON.parse(stdin.stderr).error, /^Invalid YAML in stdin at line \d+, column \d+: /);
    for (const [text, rule] of [["- a\n", "yaml/not-mapping"], ["", "yaml/empty"], ["a: 1\n---\nb: 2\n", "yaml/multiple-documents"], ["a: &x 1\nb: *x\n", "yaml/alias"], ["a: !x 1\n", "yaml/tag"], ["a: .nan\n", "yaml/number"]]) {
      const result = run(["validate", "-", "--input-format", "yaml"], text);
      assert.equal(result.status, 1, text);
      assert.equal(JSON.parse(result.stdout).findings[0].ruleId, rule, text);
    }
  });

  test("create --from reads YAML, and create writes YAML for a .yaml output or --format yaml", () => {
    yamlFile();
    const copy = run(["create", "copy.opf.json", "--from", "deck.opf.yaml"]);
    assert.equal(copy.status, 0, copy.stderr);
    assert.deepEqual(JSON.parse(read("copy.opf.json")), deck);
    const created = run(["create", "new.opf.yaml", "--title", "Fresh", "--schema-comment"]);
    assert.equal(created.status, 0, created.stderr);
    assert.equal(read("new.opf.yaml"), "# yaml-language-server: $schema=https://openpresentation.org/schema/opf/v1\n$schema: https://openpresentation.org/schema/opf/v1\nname: Fresh\nslides:\n  - id: slide-1\n    title: Fresh\n");
    assert.equal(JSON.parse(created.stdout).sha256, run(["validate", "new.opf.yaml"]).stdout.match(/"sha256": "(\w+)"/)[1]);
    const stdout = run(["create", "-", "--title", "Piped", "--format", "yaml"]);
    assert.match(stdout.stdout, /^\$schema: .*\nname: Piped\nslides:\n {2}- id: slide-1\n {4}title: Piped\n$/);
    assert.equal(run(["create", "-", "--title", "Piped", "--format", "toml"]).status, 2);
    assert.equal(run(["create", "-", "--format", "json"]).stdout.trimStart()[0], "{");
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
    const broken = run(["validate", "-", "--input-format", "yaml"], "name: x\nname: y\n");
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
    const result = run(["edit", "edit.opf.yaml", "--patch", "patch.json", "--in-place"]);
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
    const stdout = run(["edit", "edit.opf.yaml", "--patch", "-", "--input-format", "yaml", "--dry-run"], "- op: replace\n  path: /name\n  value: Dry\n");
    assert.equal(stdout.status, 0, stdout.stderr);
    assert.match(stdout.stdout, /name: Dry/);
    assert.equal(JSON.parse(stdout.stderr).dryRun, true);
  });

  test("edit on a YAML deck prints YAML to stdout by default, and JSON with --format json", () => {
    write("edit2.opf.yaml", deckYaml);
    write("patch2.json", JSON.stringify([{ op: "replace", path: "/name", value: "Stdout" }]));
    const yaml = run(["edit", "edit2.opf.yaml", "--patch", "patch2.json"]);
    assert.equal(yaml.status, 0, yaml.stderr);
    assert.match(yaml.stdout, /^# yaml-language-server: /);
    assert.match(yaml.stdout, /name: Stdout/);
    const json = run(["edit", "edit2.opf.yaml", "--patch", "patch2.json", "--format", "json"]);
    assert.equal(JSON.parse(json.stdout).name, "Stdout");
    const toJson = run(["edit", "edit2.opf.yaml", "--patch", "patch2.json", "--output", "edit2.out.json"]);
    assert.equal(toJson.status, 0, toJson.stderr);
    assert.equal(JSON.parse(read("edit2.out.json")).name, "Stdout");
    // A JSON deck is written as YAML for a .yaml output.
    write("edit2.json", JSON.stringify(deck));
    assert.equal(run(["edit", "edit2.json", "--patch", "patch2.json", "--output", "edit2.out.yaml"]).status, 0);
    assert.match(read("edit2.out.yaml"), /name: Stdout/);
  });

  test("format rewrites YAML canonically, checks it, and converts with --format", () => {
    write("fmt.opf.yaml", "slides:\n  - text: b\n    title: 'a'\nname: x\n");
    assert.equal(run(["format", "fmt.opf.yaml", "--check"]).status, 1);
    const printed = run(["format", "fmt.opf.yaml"]);
    assert.equal(printed.stdout, "name: x\nslides:\n  - title: a\n    text: b\n");
    assert.equal(run(["format", "fmt.opf.yaml", "--in-place"]).status, 0);
    assert.equal(read("fmt.opf.yaml"), "name: x\nslides:\n  - title: a\n    text: b\n");
    assert.equal(run(["format", "fmt.opf.yaml", "--check"]).status, 0);
    const json = run(["format", "fmt.opf.yaml", "--format", "json", "--indent", "1"]);
    assert.equal(json.stdout, '{\n "name": "x",\n "slides": [\n  {\n   "title": "a",\n   "text": "b"\n  }\n ]\n}\n');
    assert.equal(run(["format", "fmt.opf.yaml", "--indent", "4"]).status, 2, "--indent is for JSON");
    const crlf = run(["format", "fmt.opf.yaml", "--eol", "crlf"]);
    assert.equal(crlf.stdout, "name: x\r\nslides:\r\n  - title: a\r\n    text: b\r\n");
    write("fmt-crlf.opf.yaml", crlf.stdout);
    assert.equal(run(["format", "fmt-crlf.opf.yaml", "--check", "--eol", "preserve"]).status, 0);
    write("fmt-invalid.opf.yaml", "slides: nope\n");
    const invalid = run(["format", "fmt-invalid.opf.yaml"]);
    assert.equal(invalid.status, 1);
    assert.match(JSON.parse(invalid.stderr).error, /Cannot format fmt-invalid\.opf\.yaml as YAML/);
  });

  test("a rewrite keeps the file's own modeline verbatim and generates one only for --schema-comment", () => {
    const own = "# yaml-language-server: $schema=./schemas/local-opf.schema.json\nname: x\nslides:\n  - title: a\n";
    write("modeline.opf.yaml", own);
    assert.equal(run(["format", "modeline.opf.yaml"]).stdout, own);
    assert.equal(run(["format", "modeline.opf.yaml", "--check"]).status, 0);
    assert.equal(run(["to-yaml", "modeline.opf.yaml", "--schema-comment"]).stdout, own, "the file's modeline wins over --schema-comment");
    assert.equal(run(["to-yaml", "modeline.opf.yaml"]).stdout, own);
    write("modeline.patch.json", JSON.stringify([{ op: "replace", path: "/name", value: "Renamed" }]));
    assert.equal(run(["edit", "modeline.opf.yaml", "--patch", "modeline.patch.json"]).stdout, own.replace("name: x", "name: Renamed"));
    const none = "name: x\nslides:\n  - title: a\n";
    write("nomodeline.opf.yaml", none);
    assert.equal(run(["format", "nomodeline.opf.yaml"]).stdout, none, "none is generated for a file without one");
    assert.equal(run(["to-yaml", "nomodeline.opf.yaml", "--schema-comment"]).stdout, `# yaml-language-server: $schema=https://openpresentation.org/schema/opf/v1\n${none}`);
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
    assert.equal(run(["merge", "base.opf.yaml", "ours.opf.yaml", "theirs.opf.json", "--output", "merged.opf.json"]).status, 0);
    assert.equal(JSON.parse(read("merged.opf.json")).slides[1].text, "Theirs");
  });

  test("import-data, paginate and embed read and write YAML", () => {
    write("data.csv", "Quarter,Revenue\nQ1,12\nQ2,18\n");
    write("data-deck.opf.yaml", deckYaml);
    const into = run(["import-data", "data.csv", "--as", "chart", "--into", "data-deck.opf.yaml", "--in-place"]);
    assert.equal(into.status, 0, into.stderr);
    const after = read("data-deck.opf.yaml");
    assert.match(after, /^# yaml-language-server: /);
    assert.match(after, /chart:/);
    assert.equal(formatValid(JSON.parse(run(["from-yaml", "data-deck.opf.yaml"]).stdout)), true);
    const toYaml = run(["import-data", "data.csv", "--as", "table", "--format", "yaml"]);
    assert.equal(toYaml.status, 0, toYaml.stderr);
    assert.match(toYaml.stdout, /^slides:\n {2}- id: data-1\n/);
    assert.equal(run(["import-data", "data.csv", "--as", "table", "--format", "csv"]).stdout.trimStart()[0], "{", "csv still names the data");
    const paginated = run(["paginate", "data-deck.opf.yaml", "paginated.opf.yaml"]);
    assert.equal(paginated.status, 0, paginated.stderr);
    assert.match(read("paginated.opf.yaml"), /^# yaml-language-server: /);
    write("deck.opf.yaml", deckYaml);
    assert.equal(run(["embed", "deck.opf.yaml", "embedded.opf.yaml"]).status, 0);
    assert.match(read("embedded.opf.yaml"), /name: Q3 Review/);
  });

  test("fill reads a YAML template, JSON data, and writes YAML next to the template's format", () => {
    const template = run(["to-yaml", TEMPLATE, "template.opf.yaml"]);
    assert.equal(template.status, 0, template.stderr);
    write("values.json", JSON.stringify({ client: "Acme", revenue: 12, kickoff: "2026-10-01", wins: ["a", "b"] }));
    const single = run(["fill", "template.opf.yaml", "--data", "values.json"]);
    assert.equal(single.status, 0, single.stderr);
    assert.match(single.stdout, /^name: Quarterly review for Acme\n/m, single.stdout.slice(0, 200));
    const dir = path.join(temp, "filled");
    write("people.csv", "client,revenue,kickoff,wins\nAcme,10,2026-10-01,a\nBeta,20,2026-11-01,b\n");
    const many = run(["fill", "template.opf.yaml", "--data", "people.csv", "--out-dir", dir, "--name", "{client}"]);
    assert.equal(many.status, 0, many.stderr);
    assert.deepEqual(readdirSync(dir).sort(), ["acme.opf.yaml", "beta.opf.yaml"]);
    const json = run(["fill", "template.opf.yaml", "--data", "values.json", "--format", "json"]);
    assert.equal(json.status, 0, json.stderr);
    assert.match(json.stdout, /^name: Quarterly review for Acme/m, "--format json names the data; the output follows the template");
    const asJson = run(["fill", TEMPLATE, "--data", "values.json", "--format", "yaml"]);
    assert.equal(asJson.status, 0, asJson.stderr);
    assert.match(asJson.stdout, /^\$schema: /);
    const jsonOut = path.join(temp, "filled-json");
    assert.equal(run(["fill", TEMPLATE, "--data", "people.csv", "--out-dir", jsonOut, "--name", "{client}"]).status, 0);
    assert.deepEqual(readdirSync(jsonOut).sort(), ["acme.opf.json", "beta.opf.json"]);
  });

  test("from-md and import write YAML for a .yaml output, and to-md reads YAML", () => {
    const md = run(["from-md", "-", "md.opf.yaml"], "---\nname: From Markdown\n---\n\n# One\n\n- a\n- b\n");
    assert.equal(md.status, 0, md.stderr);
    assert.equal(read("md.opf.yaml"), "name: From Markdown\nslides:\n  - title: One\n    items:\n      - a\n      - b\n");
    assert.equal(JSON.parse(md.stdout).sha256, run(["validate", "md.opf.yaml"]).stdout.match(/"sha256": "(\w+)"/)[1]);
    const stdout = run(["from-md", "-", "--format", "yaml"], "# One\n");
    assert.equal(stdout.stdout, "slides:\n  - title: One\n");
    const back = run(["to-md", "md.opf.yaml"]);
    assert.equal(back.status, 0, back.stderr);
    assert.equal(back.stdout, "---\nname: From Markdown\n---\n\n# One\n\n- a\n- b\n");
    assert.equal(run(["to-md", "-"], deckYaml).status, 2, "stdin is JSON unless --input-format says otherwise");
    assert.equal(run(["to-md", "-", "--input-format", "yaml"], deckYaml).status, 0);
  });

  test("render and export read a YAML deck and locate validation errors in it", () => {
    write("render.opf.yaml", "name: Render\nslides:\n  - id: s1\n    title: Hello\n    text: World\n");
    const rendered = run(["render", "render.opf.yaml", "--slides", "1", "--out", "-", "--format", "svg", "--svg-fonts", "none"]);
    if (rendered.status === 2 && /opf-render/.test(rendered.stderr)) return; // the optional renderer is not installed
    assert.equal(rendered.status, 0, rendered.stderr.slice(0, 500));
    assert.match(rendered.stdout, /<svg/);
    write("render-bad.opf.yaml", "name: Render\nslides:\n  - id: s1\n    title: 5\n");
    const bad = run(["render", "render-bad.opf.yaml", "--out", "-"]);
    assert.equal(bad.status, 1);
    const found = JSON.parse(bad.stdout).findings.find((d) => d.path === "/slides/0/title");
    assert.deepEqual([found.location.line, found.location.column], [4, 12]);
  });
});

describe("help", () => {
  test("the usage documents the commands, the YAML options and the input format", () => {
    const help = run(["--help"]).stdout;
    assert.match(help, /opf from-yaml <deck\.yaml\|->/);
    assert.match(help, /opf to-yaml <deck\.opf\.json\|->/);
    assert.match(help, /--input-format <json\|yaml>/);
    assert.match(help, /--format <json\|yaml>/);
    assert.match(help, /comments are not preserved|Rewriting a YAML file does not preserve its comments/);
  });
});
