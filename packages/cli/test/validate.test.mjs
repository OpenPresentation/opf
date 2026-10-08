import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { after, describe, test } from "node:test";

// RR-29, RR-55: opf validate, the one checker (format, references, policy, accessibility, layout, content).
const here = path.dirname(fileURLToPath(import.meta.url));
const CLI = path.resolve(here, "../dist/index.js");
const dir = mkdtempSync(path.join(tmpdir(), "opf-validate-"));
after(() => rmSync(dir, { recursive: true, force: true }));
const run = (args, input) => spawnSync(process.execPath, [CLI, ...args], { cwd: dir, input, encoding: "utf8", timeout: 30000 });
const write = (name, value) => {
  writeFileSync(path.join(dir, name), typeof value === "string" ? value : JSON.stringify(value, null, 2));
  return name;
};
const white = { background: { type: "solid", color: "#FFFFFF" } };
// One warning (low contrast), one info (no chart text) and no errors.
const deck = { name: "Validate", language: "en-US", design: white, slides: [
  { title: "Revenue", text: [{ text: "faint", color: "#CCCCCC" }, " and normal"] },
  { title: "Chart", chart: { type: "column", data: { columns: ["Q", "V"], rows: [["Q1", 1]] } } },
] };
const clean = { name: "Clean", language: "en-US", slides: [{ title: "Hello", text: "A readable slide." }] };

describe("opf validate", () => {
  test("clean deck: text report, exit 0", () => {
    const r = run(["validate", write("clean.opf.json", clean), "--format", "text"]);
    assert.equal(r.status, 0, r.stderr);
    assert.ok(r.stdout.includes("clean.opf.json: 0 findings (0 errors, 0 warnings, 0 info). Checked: "), r.stdout);
    assert.ok(r.stdout.includes("accessibility"), r.stdout);
    assert.ok(r.stdout.includes("layout (estimated)"), r.stdout);
  });

  test("findings: JSON report with locations, file hash and rule ids; exit follows --fail-on", () => {
    const file = write("deck.opf.json", deck);
    const raw = readFileSync(path.join(dir, file), "utf8");
    const json = run(["validate", file]);
    assert.equal(json.status, 0, "warnings and info do not fail by default");
    const report = JSON.parse(json.stdout);
    assert.equal(report.valid, true);
    assert.equal(report.schemaValid, true);
    assert.deepEqual(report.findings.map((d) => d.ruleId), ["opf/text-contrast", "opf/chart-text-alternative"]);
    assert.deepEqual(report.findings.map((d) => d.category), ["accessibility", "accessibility"]);
    const [contrast, chart] = report.findings;
    assert.equal(contrast.severity, "warning");
    assert.equal(contrast.path, "/slides/0/text/0/color");
    assert.equal(raw.slice(contrast.location.offset, contrast.location.offset + contrast.location.length), '"#CCCCCC"');
    assert.equal(contrast.fixes[0].patch[0].path, "/slides/0/text/0/color");
    assert.equal(chart.severity, "info");
    assert.match(report.sha256, /^[a-f0-9]{64}$/);
    assert.match(report.opfVersion, /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/);
    assert.deepEqual(report.counts, { error: 0, warning: 1, info: 1 });
    assert.equal(report.checks.layout, "estimated");
    assert.equal(report.diagnostics, undefined);
    assert.equal(report.errors, undefined);
    assert.equal(run(["validate", file, "--fail-on", "warning"]).status, 1);
    assert.equal(run(["validate", file, "--fail-on", "info"]).status, 1);
    assert.equal(run(["validate", file, "--fail-on", "error"]).status, 0);
    assert.equal(run(["validate", file, "--fail-on", "never"]).status, 2, "never is not a level");
    const text = run(["validate", file, "--format", "text"]).stdout;
    assert.match(text, /deck\.opf\.json:\d+:\d+ {2}warning opf\/text-contrast/);
    assert.match(text, /fix: Use the slide text colour/);
    assert.match(text, /2 findings \(0 errors, 1 warning, 1 info\)\./);
  });

  test("--only and --ignore select and skip rules and categories", () => {
    const file = write("deck.opf.json", deck);
    const ids = (args) => JSON.parse(run(["validate", file, ...args]).stdout).findings.map((d) => d.ruleId);
    assert.deepEqual(ids(["--only", "text-contrast"]), ["opf/text-contrast"]);
    assert.deepEqual(ids(["--only", "opf/text-contrast,chart-text-alternative"]), ["opf/text-contrast", "opf/chart-text-alternative"]);
    assert.deepEqual(ids(["--ignore", "text-contrast", "--ignore", "missing-language"]).includes("opf/text-contrast"), false);
    assert.deepEqual(ids(["--only", "format,references"]), []);
    assert.deepEqual(ids(["--ignore", "accessibility"]), []);
    const checks = JSON.parse(run(["validate", file, "--only", "format"]).stdout).checks;
    assert.equal(checks.layout, "not-run");
    assert.equal(checks.accessibility, "not-run");
  });

  test("--config reads a local JSON file; flags win; the config is hashed", () => {
    const file = write("deck.opf.json", deck);
    const config = write("house.json", { ignore: ["text-contrast"], severity: { "opf/chart-text-alternative": "error" }, thresholds: { contrastLarge: 2 } });
    const run1 = run(["validate", file, "--config", config]);
    assert.equal(run1.status, 1, "the promoted rule is an error");
    const report = JSON.parse(run1.stdout);
    assert.deepEqual(report.findings.map((d) => [d.ruleId, d.severity]), [["opf/chart-text-alternative", "error"]]);
    assert.equal(report.valid, false);
    assert.match(report.context.sha256, /^[a-f0-9]{64}$/);
    assert.equal(run(["validate", file, "--config", write("bad.json", { rulez: {} })]).status, 2);
    assert.equal(run(["validate", file, "--config", "-"]).status, 2);
    assert.equal(run(["validate", file, "--config", "missing.json"]).status, 2);
    const ignored = write("ignore-path.json", { ignorePaths: [{ rule: "text-contrast", path: "/slides/0" }] });
    assert.deepEqual(JSON.parse(run(["validate", file, "--config", ignored]).stdout).findings.map((d) => d.ruleId), ["opf/chart-text-alternative"]);
    // --only replaces the file's only, --ignore adds to its ignore
    const only = write("only.json", { only: ["text-contrast"] });
    assert.deepEqual(JSON.parse(run(["validate", file, "--config", only, "--only", "chart-text-alternative"]).stdout).findings.map((d) => d.ruleId), ["opf/chart-text-alternative"]);
  });

  test("a config file carries lint's catalogs and contracts too", () => {
    const raw = '﻿{\r\n  "name" : "Keep  spacing",\r  "slides": [{"title":"Target","layout":"pratner"}]\n}';
    const file = write("target.opf.json", raw);
    const loaded = write("brand.json", {
      catalogs: [{ source: "pkg:@brand/catalog", layouts: { partner: { name: "Partner", placeholders: [{ type: "title" }] } } }],
      contracts: [{ path: "/slides/*/layout", allowedValues: ["text-1x"], message: "Brand layouts: {{allowed}}." }],
    });
    const report = JSON.parse(run(["validate", file, "--only", "format,references,policy"]).stdout);
    assert.equal(report.valid, true);
    assert.equal(report.counts.warning, 1);
    assert.equal(report.findings[0].location.offset, raw.indexOf('"pratner"'));
    const policy = run(["validate", file, "--config", loaded, "--only", "policy"]);
    assert.equal(policy.status, 1);
    const found = JSON.parse(policy.stdout).findings;
    assert.ok(found.some((item) => item.ruleId === "opf/contract" && item.category === "policy" && item.message.includes("text-1x")));
    assert.equal(readFileSync(path.join(dir, file), "utf8"), raw, "validate never rewrites source, including BOM and mixed line endings");
  });

  test("stdin, invalid documents and usage errors", () => {
    const piped = run(["validate", "-"], JSON.stringify(deck));
    assert.equal(piped.status, 0, piped.stderr);
    assert.equal(JSON.parse(piped.stdout).file, null);
    const schema = run(["validate", "-"], '{"name":"x","slides":[{"title":3}]}');
    assert.equal(schema.status, 1);
    assert.equal(JSON.parse(schema.stdout).schemaValid, false);
    assert.equal(JSON.parse(schema.stdout).findings[0].ruleId, "opf/schema");
    // Invalid JSON exits 1 as an invalid document, not 2 as a usage error.
    const syntax = run(["validate", "-"], '{"slides": [}');
    assert.equal(syntax.status, 1);
    assert.equal(JSON.parse(syntax.stdout).schemaValid, null);
    assert.equal(JSON.parse(syntax.stdout).findings[0].ruleId, "opf/json-syntax");
    assert.equal(run(["validate", "-"], "{").status, 1);
    assert.ok(run(["validate", "-"], '{"slides":[{"title":"First","title":"Second"}]}').stdout.includes("opf/duplicate-key"));
    const yaml = JSON.parse(run(["validate", "-"], "name: Deck\nslides: []\n").stdout);
    assert.match(yaml.findings[0].help, /fromYaml/);
    for (const args of [["validate"], ["validate", "missing.opf.json"], ["validate", "a", "b"], ["validate", "x.json", "--nope"], ["validate", write("d.opf.json", clean), "--only", "nope"], ["validate", "d.opf.json", "--ignore", "nope"], ["validate", "d.opf.json", "--format", "yaml"], ["validate", "d.opf.json", "--strict"]]) {
      assert.equal(run(args).status, 2, JSON.stringify(args));
    }
  });

  test("--list-rules describes every rule; the old commands and flags are gone", () => {
    const list = JSON.parse(run(["validate", "--list-rules"]).stdout);
    assert.ok(list.length >= 50);
    assert.ok(list.every((rule) => /^opf\/[a-z-]+$/.test(rule.id) && rule.summary && rule.category && rule.cost));
    assert.deepEqual([...new Set(list.map((rule) => rule.category))], ["format", "references", "policy", "accessibility", "layout", "content"]);
    assert.match(run(["validate", "--list-rules", "--format", "text"]).stdout, /opf\/text-contrast {2,}accessibility {2,}warning {2,}composition/);
    assert.equal(run(["validate", "--list-rules", "deck.json"]).status, 2);
    assert.match(run(["validate", "--help"]).stdout, /--fail-on/);
    const usage = run(["--help"]).stdout;
    assert.match(usage, /opf validate <file\|-> /);
    assert.doesNotMatch(usage, /opf lint|opf audit|--strict/);
    for (const command of ["lint", "audit"]) {
      const result = run([command, "deck.opf.json"]);
      assert.equal(result.status, 2);
      assert.match(result.stderr, /Unknown command/);
    }
  });

  test("validate never rewrites its input", () => {
    const file = write("keep.opf.json", deck);
    const before = readFileSync(path.join(dir, file), "utf8");
    run(["validate", file]);
    assert.equal(readFileSync(path.join(dir, file), "utf8"), before);
  });
});
