import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { after, describe, test } from "node:test";
import { fileURLToPath } from "node:url";

// RR-55: opf/variable-unfilled is a format rule. A deck (not a template) with a required variable that has no value is
// invalid for the format check alone, so every command that writes a deck refuses it, as `validatePresentation` did.
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CLI_BIN = path.resolve(__dirname, "../dist/index.js");
const run = (args) => spawnSync(process.execPath, [CLI_BIN, ...args], { encoding: "utf8" });
const temp = await mkdtemp(path.join(tmpdir(), "opf-unfilled-"));
after(() => rm(temp, { recursive: true, force: true }));
const file = async (name, value) => {
  const target = path.join(temp, name);
  await writeFile(target, typeof value === "string" ? value : JSON.stringify(value));
  return target;
};

const declared = { name: "Unfilled", language: "en-US", variables: { who: { type: "text", label: "Who" } }, slides: [{ title: "Hello {{who}}" }] };
const unfilledFinding = (result) => {
  const report = JSON.parse(result.stderr || result.stdout);
  const findings = report.validation?.findings ?? report.findings ?? [];
  return findings.find((finding) => finding.ruleId === "opf/variable-unfilled");
};

describe("a deck with an unfilled required variable", () => {
  test("opf validate --only format reports it as a format error and exits 1", async () => {
    const result = run(["validate", await file("deck.json", declared), "--only", "format"]);
    assert.equal(result.status, 1, result.stderr);
    const report = JSON.parse(result.stdout);
    assert.equal(report.valid, false);
    assert.deepEqual(report.findings.map((finding) => [finding.ruleId, finding.severity, finding.category]), [["opf/variable-unfilled", "error", "format"]]);
  });

  test("convert, edit, paginate and fill refuse to write it", async () => {
    const deck = await file("deck.json", declared);
    const patch = await file("patch.json", [{ op: "replace", path: "/slides/0/title", value: "Hi {{who}}" }]);
    for (const [name, args] of [
      ["convert", ["convert", deck, path.join(temp, "created.opf.json")]],
      ["edit", ["edit", deck, path.join(temp, "edited.json"), "--patch", patch]],
      ["paginate", ["paginate", deck, path.join(temp, "paged.json")]],
      ["fill", ["fill", deck, path.join(temp, "filled.opf.json")]],
    ]) {
      const result = run(args);
      assert.equal(result.status, 1, `${name}: ${result.stdout}${result.stderr}`);
      if (name === "fill") assert.match(result.stderr, /who/, `${name} names the unfilled variable`);
      else assert.equal(unfilledFinding(result)?.severity, "error", `${name} reports opf/variable-unfilled: ${result.stderr}`);
    }
  });

  test("as a template it is incomplete on purpose: only a warning, and the write goes ahead", async () => {
    const template = await file("template.json", { ...declared, template: true });
    const output = path.join(temp, "template-created.opf.json");
    const result = run(["convert", template, output]);
    assert.equal(result.status, 0, result.stderr);
    const report = JSON.parse(result.stdout);
    assert.deepEqual(report.findings.map((finding) => [finding.ruleId, finding.severity]), [["opf/variable-unfilled", "warning"]]);
  });
});
