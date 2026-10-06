import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { after, describe, test } from "node:test";

// RR-29: opf audit, a design and accessibility checker.
const here = path.dirname(fileURLToPath(import.meta.url));
const CLI = path.resolve(here, "../dist/index.js");
const dir = mkdtempSync(path.join(tmpdir(), "opf-audit-"));
after(() => rmSync(dir, { recursive: true, force: true }));
const run = (args, input) => spawnSync(process.execPath, [CLI, ...args], { cwd: dir, input, encoding: "utf8", timeout: 30000 });
const write = (name, value) => {
  writeFileSync(path.join(dir, name), typeof value === "string" ? value : JSON.stringify(value, null, 2));
  return name;
};
const white = { background: { type: "solid", color: "#FFFFFF" } };
// One warning (low contrast), one info (no chart text) and no errors.
const deck = { name: "Audit", language: "en-US", design: white, slides: [
  { title: "Revenue", text: [{ text: "faint", color: "#CCCCCC" }, " and normal"] },
  { title: "Chart", chart: { type: "column", data: { columns: ["Q", "V"], rows: [["Q1", 1]] } } },
] };
const clean = { name: "Clean", language: "en-US", slides: [{ title: "Hello", text: "A readable slide." }] };

describe("opf audit", () => {
  test("clean deck: text report, exit 0", () => {
    const r = run(["audit", write("clean.opf.json", clean)]);
    assert.equal(r.status, 0, r.stderr);
    assert.match(r.stdout, /clean\.opf\.json: 0 findings \(0 errors, 0 warnings, 0 info\) in 1 slide;/);
  });

  test("findings: lint-shaped JSON with locations, file hash and rule ids; exit follows --fail-on", () => {
    const file = write("deck.opf.json", deck);
    const raw = readFileSync(path.join(dir, file), "utf8");
    const json = run(["audit", file, "--json"]);
    assert.equal(json.status, 0, "warnings and info do not fail by default");
    const report = JSON.parse(json.stdout);
    assert.equal(report.valid, true);
    assert.equal(report.documentValid, true);
    assert.deepEqual(report.diagnostics.map((d) => d.ruleId), ["audit/text-contrast", "audit/chart-text-alternative"]);
    const [contrast, chart] = report.diagnostics;
    assert.equal(contrast.severity, "warning");
    assert.equal(contrast.path, "/slides/0/text/0/color");
    assert.equal(raw.slice(contrast.location.offset, contrast.location.offset + contrast.location.length), '"#CCCCCC"');
    assert.equal(contrast.fixes[0].patch[0].path, "/slides/0/text/0/color");
    assert.equal(chart.severity, "info");
    assert.match(report.sha256, /^[a-f0-9]{64}$/);
    assert.match(report.opfVersion, /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/);
    assert.deepEqual(report.counts, { error: 0, warning: 1, info: 1 });
    assert.equal(run(["audit", file, "--fail-on", "warning"]).status, 1);
    assert.equal(run(["audit", file, "--fail-on", "info"]).status, 1);
    assert.equal(run(["audit", file, "--fail-on", "never"]).status, 0);
    assert.equal(run(["audit", file, "--fail-on", "error"]).status, 0);
    const text = run(["audit", file]).stdout;
    assert.match(text, /deck\.opf\.json:\d+:\d+ {2}warning audit\/text-contrast/);
    assert.match(text, /fix: Use the slide text colour/);
    assert.match(text, /2 findings \(0 errors, 1 warning, 1 info\) in 2 slides/);
  });

  test("--rule, --ignore and --severity select, skip and re-grade rules", () => {
    const file = write("deck.opf.json", deck);
    const ids = (args) => JSON.parse(run(["audit", file, "--json", ...args]).stdout).diagnostics.map((d) => d.ruleId);
    assert.deepEqual(ids(["--rule", "text-contrast"]), ["audit/text-contrast"]);
    assert.deepEqual(ids(["--rule", "audit/text-contrast,chart-text-alternative"]), ["audit/text-contrast", "audit/chart-text-alternative"]);
    assert.deepEqual(ids(["--ignore", "text-contrast", "--ignore", "missing-language"]), ["audit/chart-text-alternative"]);
    const strict = run(["audit", file, "--json", "--severity", "text-contrast=error"]);
    assert.equal(strict.status, 1);
    assert.equal(JSON.parse(strict.stdout).diagnostics[0].severity, "error");
    assert.deepEqual(ids(["--severity", "chart-text-alternative=off"]), ["audit/text-contrast"]);
    assert.deepEqual(ids(["--threshold", "contrastLarge=1.2"]), ["audit/chart-text-alternative"]);
  });

  test("--config reads a local JSON file; flags win; the config is hashed", () => {
    const file = write("deck.opf.json", deck);
    const config = write("audit.json", { ignore: ["text-contrast"], thresholds: { maxWordsPerSlide: 5 } });
    const report = JSON.parse(run(["audit", file, "--json", "--config", config]).stdout);
    assert.deepEqual(report.diagnostics.map((d) => d.ruleId), ["audit/chart-text-alternative"]);
    assert.equal(report.thresholds.maxWordsPerSlide, 5);
    assert.match(report.context.sha256, /^[a-f0-9]{64}$/);
    assert.equal(run(["audit", file, "--config", write("bad.json", { rulez: {} })]).status, 2);
    assert.equal(run(["audit", file, "--config", "-"]).status, 2);
    assert.equal(run(["audit", file, "--config", "missing.json"]).status, 2);
    const ignored = write("ignore-path.json", { ignorePaths: [{ rule: "text-contrast", path: "/slides/0" }] });
    assert.deepEqual(JSON.parse(run(["audit", file, "--json", "--config", ignored]).stdout).diagnostics.map((d) => d.ruleId), ["audit/chart-text-alternative"]);
  });

  test("stdin, invalid documents and usage errors", () => {
    const piped = run(["audit", "-", "--json"], JSON.stringify(deck));
    assert.equal(piped.status, 0, piped.stderr);
    assert.equal(JSON.parse(piped.stdout).file, null);
    const schema = run(["audit", "-", "--json"], '{"name":"x","slides":[{"title":3}]}');
    assert.equal(schema.status, 1);
    assert.equal(JSON.parse(schema.stdout).documentValid, false);
    assert.equal(JSON.parse(schema.stdout).diagnostics[0].ruleId, "audit/invalid-document");
    const syntax = run(["audit", "-", "--json"], '{"slides": [}');
    assert.equal(syntax.status, 1);
    assert.equal(JSON.parse(syntax.stdout).documentValid, false);
    assert.match(run(["audit", "-"], '{"slides":[}').stdout, /not valid JSON/);
    for (const args of [["audit"], ["audit", "missing.opf.json"], ["audit", "a", "b"], ["audit", "x.json", "--nope"], ["audit", write("d.opf.json", clean), "--rule", "nope"], ["audit", "d.opf.json", "--fail-on", "fatal"], ["audit", "d.opf.json", "--rule"], ["audit", "d.opf.json", "--severity", "text-contrast"], ["audit", "d.opf.json", "--threshold", "contrastLarge=abc"], ["audit", "d.opf.json", "--threshold", "nope=1"], ["audit", "--list-rules", "d.opf.json"], ["audit", "--explain", "nope"]])
      assert.equal(run(args).status, 2, JSON.stringify(args));
  });

  test("--list-rules and --explain describe every rule", () => {
    const list = JSON.parse(run(["audit", "--list-rules", "--json"]).stdout);
    assert.ok(list.length >= 25);
    assert.ok(list.every((rule) => /^audit\/[a-z-]+$/.test(rule.id) && rule.summary));
    assert.match(run(["audit", "--list-rules"]).stdout, /audit\/text-contrast {2,}warning {2,}accessibility/);
    const explained = JSON.parse(run(["audit", "--explain", "text-contrast", "--json"]).stdout);
    assert.equal(explained.id, "audit/text-contrast");
    assert.match(explained.standard, /WCAG/);
    assert.match(run(["audit", "--explain", "audit/reading-order"]).stdout, /^audit\/reading-order \(warning, accessibility\)/);
    assert.match(run(["audit", "--help"]).stdout, /--fail-on/);
    assert.match(run(["--help"]).stdout, /opf audit/);
  });

  test("audit never rewrites its input", () => {
    const file = write("keep.opf.json", deck);
    const before = readFileSync(path.join(dir, file), "utf8");
    run(["audit", file]);
    assert.equal(readFileSync(path.join(dir, file), "utf8"), before);
  });
});
