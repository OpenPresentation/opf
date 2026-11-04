// The OPF conformance suite (conformance/, docs/conformance.md): the reference implementation passes every available level,
// the manifest lists every fixture with a basis, and the runner fails tools that break a rule.
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

import referenceAdapter from "../conformance/adapters/opf-core.mjs";
import { commandAdapter, formatMarkdown, loadSuite, pathMatches, preservedValues, runSuite } from "../conformance/run.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const runner = path.join(repoRoot, "conformance", "run.mjs");

test("the reference implementation passes every available level on every case", async () => {
  const report = await runSuite({ adapter: referenceAdapter });
  const failures = report.results.filter((result) => result.status !== "pass");
  assert.deepEqual(failures, []);
  assert.deepEqual(report.passed, ["Core Reader", "Core Writer"]);
  const reader = report.levels.find((level) => level.id === "reader");
  assert.equal(reader.location.matched, reader.location.cases, "every invalid case with errorAt reports the expected path");
  assert.deepEqual(report.levels.filter((level) => level.status === "planned").map((level) => level.id), ["renderer", "converter"]);
  assert.match(report.suite.digest, /^[0-9a-f]{64}$/);
  assert.match(formatMarkdown(report), /\| Core Reader \| pass \|/);
});

test("the manifest lists every fixture once, with a description and a basis", () => {
  const { manifest, cases } = loadSuite();
  const available = new Set(manifest.levels.filter((level) => level.status === "available").map((level) => level.id));
  const listed = new Set(cases.map((entry) => entry.source));
  for (const kind of ["valid", "invalid"]) {
    for (const name of readdirSync(path.join(repoRoot, "conformance", "core", kind))) {
      assert.ok(listed.has(`conformance/core/${kind}/${name}`), `conformance/core/${kind}/${name} has no case`);
    }
  }
  for (const entry of cases) {
    assert.ok(entry.description && entry.basis, `${entry.id} needs a description and a basis`);
    assert.ok(entry.levels.length > 0 && entry.levels.every((level) => available.has(level)), `${entry.id}: unknown or planned level`);
    assert.equal(typeof entry.expect.valid, "boolean", entry.id);
    if (!entry.expect.valid) assert.deepEqual(entry.levels, ["reader"], `${entry.id}: an invalid document counts for the Reader level only`);
    if (entry.id.startsWith("core.")) assert.ok(entry.source.includes(entry.expect.valid ? "/valid/" : "/invalid/"), `${entry.id} is in the wrong folder`);
  }
  assert.ok(cases.some((entry) => entry.id.startsWith("examples.technical.")), "the technical examples are included");
});

test("a tool that accepts everything fails the Reader level and so cannot claim the Writer level", async () => {
  const adapter = { name: "accepts-everything", check: () => ({ valid: true }), roundTrip: (text) => text };
  const report = await runSuite({ adapter });
  const reader = report.levels.find((level) => level.id === "reader");
  const writer = report.levels.find((level) => level.id === "writer");
  assert.equal(reader.status, "fail");
  assert.ok(reader.fail > 0);
  assert.equal(writer.pass, writer.total);
  assert.equal(writer.status, "incomplete");
  assert.deepEqual(report.passed, []);
});

test("a writer that drops extensions or changes an id fails; one that only adds a field passes but is not lossless", async () => {
  const drop = (text) => {
    const document = JSON.parse(text);
    delete document.extensions;
    for (const slide of document.slides) if (slide.id) slide.id = `${slide.id}-copy`;
    return JSON.stringify(document);
  };
  const dropped = await runSuite({ adapter: { ...referenceAdapter, roundTrip: drop }, levels: ["reader", "writer"], only: "core.valid.extensions-everywhere" });
  const result = dropped.results.find((entry) => entry.level === "writer");
  assert.equal(result.status, "fail");
  assert.match(result.message, /extensions at \/extensions changed or is missing/);
  assert.match(result.message, /id at \/slides\/0\/id changed or is missing/);

  const named = (text) => JSON.stringify({ ...JSON.parse(text), name: "Renamed" });
  const added = await runSuite({ adapter: { ...referenceAdapter, roundTrip: named }, levels: ["reader", "writer"], only: "core.valid.title-only" });
  const writer = added.levels.find((level) => level.id === "writer");
  assert.equal(writer.status, "pass");
  assert.equal(writer.lossless, 0);

  const broken = await runSuite({ adapter: { ...referenceAdapter, roundTrip: () => '{"slides":[]}' }, levels: ["reader", "writer"], only: "core.valid.title-only" });
  assert.match(broken.results.find((entry) => entry.level === "writer").message, /not valid OPF \(opf\/schema at \/slides\)/);
});

test("extension content is not searched for ids", () => {
  const values = preservedValues({ slides: [{ id: "a", extensions: { "example.com": { id: "a" } }, blocks: [{ id: "b" }] }] });
  assert.deepEqual([...values.keys()], ["/slides/0/id", "/slides/0/extensions", "/slides/0/blocks/0/id"]);
});

test("pathMatches accepts the expected pointer and anything inside it", () => {
  assert.ok(pathMatches("/slides/0", "/slides/0"));
  assert.ok(pathMatches("/slides/0", "/slides/0/title"));
  assert.ok(!pathMatches("/slides/0", "/slides/01"));
  assert.ok(pathMatches("", "/anything"));
});

test("command adapters: exit 0 accepts, 1 rejects, JSON findings give the paths, and the writer writes {out}", async () => {
  const directory = mkdtempSync(path.join(tmpdir(), "opf-conformance-test-"));
  try {
    const core = path.join(repoRoot, "packages", "javascript", "dist", "index.js");
    const checker = path.join(directory, "check.mjs");
    writeFileSync(checker, `import { readFileSync } from "node:fs";\nimport { validate } from ${JSON.stringify(core)};\nconst report = validate(readFileSync(process.argv[2], "utf8"), { only: ["format", "references"], catalogs: [] });\nconsole.log(JSON.stringify({ findings: report.findings }));\nprocess.exit(report.valid ? 0 : 1);\n`);
    const writer = path.join(directory, "write.mjs");
    writeFileSync(writer, `import { readFileSync, writeFileSync } from "node:fs";\nwriteFileSync(process.argv[3], JSON.stringify(JSON.parse(readFileSync(process.argv[2], "utf8")), null, 2));\n`);
    const node = JSON.stringify(process.execPath);
    const adapter = commandAdapter({ check: `${node} ${JSON.stringify(checker)} {file}`, write: `${node} ${JSON.stringify(writer)} {in} {out}`, name: "fake-cli" });
    const report = await runSuite({ adapter, only: "core.valid.extensions" });
    assert.deepEqual(report.results.filter((result) => result.status !== "pass"), []);
    assert.equal(report.results.length, 6);
    const invalid = await runSuite({ adapter: commandAdapter({ check: `${node} ${JSON.stringify(checker)} {file}` }), only: "core.invalid.unknown-" });
    assert.ok(invalid.results.length >= 3);
    assert.ok(invalid.results.every((result) => result.status === "pass" && result.location === "matched"));
    const crashing = await runSuite({ adapter: commandAdapter({ check: `${node} -e "process.exit(3)"` }), only: "core.valid.title-only" });
    assert.equal(crashing.results[0].status, "error");
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("the command line: exit codes and the JSON report", () => {
  const json = execFileSync(process.execPath, [runner, "--case", "core.invalid.json", "--level", "reader", "--format", "json"], { encoding: "utf8" });
  const report = JSON.parse(json);
  assert.equal(report.levels.find((level) => level.id === "reader").status, "pass");
  assert.equal(report.levels.find((level) => level.id === "writer").status, "not-run");
  assert.equal(spawnSync(process.execPath, [runner, "--level", "renderer"], { encoding: "utf8" }).status, 2);
  assert.equal(spawnSync(process.execPath, [runner, "--bogus"], { encoding: "utf8" }).status, 2);
});
