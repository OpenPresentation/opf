import assert from "node:assert/strict";
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { CLASSES, FILES, ROOT, STATUSES, buildTracker, checkTracker, renderMarkdown, serialize } from "./build-font-tracker.mjs";

const read = (file) => JSON.parse(readFileSync(path.join(ROOT, file), "utf8"));
const policy = read(FILES.policy);
const overrides = read(FILES.overrides);
const committed = read(FILES.json);
const policyNames = policy.families.map((row) => row.family);

// A scratch copy of the inputs, outputs and script, so drift and error cases never touch the checkout.
function scratchCopy() {
  const dir = mkdtempSync(path.join(tmpdir(), "font-tracker-"));
  const files = [FILES.policy, FILES.overrides, FILES.json, FILES.markdown, overrides.manifestSnapshot, overrides.measurementReport, overrides.paritySource, "scripts/build-font-tracker.mjs"];
  for (const file of files) {
    mkdirSync(path.dirname(path.join(dir, file)), { recursive: true });
    cpSync(path.join(ROOT, file), path.join(dir, file));
  }
  return dir;
}

test("every policy family has exactly one record", () => {
  const names = committed.records.map((record) => record.family);
  assert.equal(new Set(names).size, names.length, "duplicate records");
  for (const name of policyNames) assert.ok(names.includes(name), `no record for policy family ${name}`);
  assert.equal(committed.records.filter((record) => record.inPolicy).length, policy.families.length);
});

test("no record references a family that is neither in the policy nor a declared shipped dependency", () => {
  const extras = new Set(overrides.extras.map((extra) => extra.family));
  const snapshot = read(overrides.manifestSnapshot);
  const shipped = new Set(snapshot.packages.flatMap((pkg) => pkg.faces.map((face) => face.family)));
  for (const record of committed.records) {
    if (record.inPolicy) {
      assert.ok(policyNames.includes(record.family), `${record.family} is not a policy family`);
      continue;
    }
    assert.ok(extras.has(record.family), `${record.family} is not declared in overrides.extras`);
    assert.ok(shipped.has(record.family), `${record.family} is not in the pinned render manifest snapshot`);
    assert.equal(record.status, "policy-gap");
  }
  for (const name of Object.keys(overrides.families)) assert.ok(policyNames.includes(name), `overrides name ${name}, which is not a policy family`);
  for (const name of [...overrides.classes.proprietaryScript, ...overrides.classes.special]) assert.ok(policyNames.includes(name), `class list names ${name}`);
});

test("the 160 reviewed families split into the owner's four classes", () => {
  assert.equal(committed.summary.records, 160);
  assert.equal(policy.families.length + overrides.extras.length, 160);
  assert.equal(overrides.extras.length, 7);
  const counts = Object.fromEntries(CLASSES.map((cls) => [cls, committed.records.filter((record) => record.class === cls).length]));
  assert.equal(CLASSES.reduce((sum, cls) => sum + counts[cls], 0), 160);
  assert.deepEqual(committed.records.filter((record) => record.class === "special").map((record) => record.family).sort(), ["Cambria Math", "Segoe UI Emoji", "Symbol", "Webdings", "Wingdings"]);
  for (const record of committed.records.filter((item) => item.class === "special")) assert.equal(record.status, "needs-special-path");
  for (const record of committed.records.filter((item) => item.class === "open")) assert.equal(record.licenseClass, "open");
  for (const record of committed.records.filter((item) => item.class.startsWith("proprietary"))) assert.notEqual(record.licenseClass, "open");
});

test("every record carries the fields the owner asked for, with valid values", () => {
  const ranks = new Set();
  for (const record of committed.records) {
    const where = record.family;
    assert.equal(record.selectedNamePreservedInPptx, true, where);
    assert.ok(["metric", "visual", "real", "none"].includes(record.previewRoute.tier), where);
    assert.ok(Array.isArray(record.previewRoute.alternates), where);
    assert.equal(typeof record.bundled.yes, "boolean", where);
    assert.ok(Array.isArray(record.stylesRequired) && Array.isArray(record.stylesMissing), where);
    assert.ok(record.scripts.length > 0, where);
    assert.ok(record.measurements === null || typeof record.measurements.meanAbsWidthDelta === "number", where);
    for (const host of ["node", "browser", "editor", "gallery"]) assert.ok(["verified", "unverified", "NA"].includes(record.hostVerification[host]), `${where} ${host}`);
    assert.ok(["verified", "partial", "unverified", "NA"].includes(record.nativeVerification.status), where);
    assert.ok(STATUSES.includes(record.status), where);
    assert.ok([1, 2, 3, 4, 5].includes(record.phase), where);
    assert.ok(record.nextAction.length > 20, where);
    assert.ok(record.evidence.length > 0, where);
    assert.equal(record.paritySignals.totalValues, committed.inputs.parity.values, where);
    assert.equal(record.acceptance.accepted, false, `${where}: no family has an acceptance record yet`);
    assert.ok(Number.isInteger(record.priority.rank), where);
    ranks.add(record.priority.rank);
    if (record.bundled.yes) for (const face of record.bundled.faces) assert.match(face.sha256, /^[0-9a-f]{64}$/, `${where} ${face.file}`);
    // An unbundled route must not claim styles, and a bundled one must list the styles it ships.
    if (!record.bundled.yes) assert.deepEqual(record.bundled.stylesAvailable, [], where);
    for (const evidence of record.evidence) {
      if (!/^https?:/.test(evidence.url)) assert.ok(existsSync(path.join(ROOT, evidence.url)), `${where}: missing evidence file ${evidence.url}`);
    }
  }
  assert.equal(ranks.size, committed.records.length, "priority ranks are unique");
});

test("records agree with the policy table and the pinned manifest", () => {
  const decisions = policy.provisionalDecisions.decisions;
  for (const row of policy.families) {
    const record = committed.records.find((item) => item.family === row.family);
    const replacement = row.replacement;
    if (!replacement) {
      assert.equal(record.previewRoute.family, row.licenseClass === "open" ? row.family : null, row.family);
      continue;
    }
    const decided = replacement.decision ? decisions[replacement.decision] : replacement;
    assert.equal(record.previewRoute.family, replacement.decision ? decided.replacement : replacement.family, row.family);
    assert.equal(record.previewRoute.tier, decided.compatibility, row.family);
  }
  const snapshot = read(overrides.manifestSnapshot);
  assert.match(snapshot.source.commit, /^[0-9a-f]{40}$/);
  assert.equal(snapshot.source.repository, "OpenPresentation/opf-render");
  assert.equal(committed.inputs.renderManifest.commit, snapshot.source.commit);
});

test("Aptos and Aptos Display lead the priority queue with their 704 audited values", () => {
  const top = [...committed.records].sort((a, b) => a.priority.rank - b.priority.rank).slice(0, 2).map((record) => record.family);
  assert.deepEqual(top.sort(), ["Aptos", "Aptos Display"]);
  for (const name of top) {
    const record = committed.records.find((item) => item.family === name);
    assert.equal(record.paritySignals.valuesAffected, 704, name);
    assert.equal(record.phase, 3, name);
  }
});

test("the committed tracker matches a fresh build", () => {
  const { drift } = checkTracker();
  assert.deepEqual(drift, [], "run node scripts/build-font-tracker.mjs and commit the result");
  const { tracker } = buildTracker();
  assert.equal(serialize(tracker), readFileSync(path.join(ROOT, FILES.json), "utf8"));
  assert.equal(renderMarkdown(tracker), readFileSync(path.join(ROOT, FILES.markdown), "utf8"));
});

test("--check detects drift in the tracker files and passes after a rebuild", () => {
  const dir = scratchCopy();
  try {
    const script = path.join(dir, "scripts/build-font-tracker.mjs");
    const run = (...args) => spawnSync(process.execPath, [script, ...args], { encoding: "utf8" });
    assert.equal(run("--check").status, 0, "fresh copy is current");

    writeFileSync(path.join(dir, FILES.markdown), `${readFileSync(path.join(dir, FILES.markdown), "utf8")}\nhand edit\n`);
    const markdownDrift = run("--check");
    assert.equal(markdownDrift.status, 1);
    assert.match(markdownDrift.stderr, /font-tracker\.md/);

    const rebuilt = run();
    assert.equal(rebuilt.status, 0, rebuilt.stderr);
    assert.equal(run("--check").status, 0, "rebuild clears the drift");

    // Editing a derived input (the policy) without rebuilding is drift too.
    const policyFile = path.join(dir, FILES.policy);
    const edited = JSON.parse(readFileSync(policyFile, "utf8"));
    edited.families.find((row) => row.family === "Calibri").replacement.compatibility = "visual";
    writeFileSync(policyFile, JSON.stringify(edited, null, 2));
    const policyDrift = run("--check");
    assert.equal(policyDrift.status, 1);
    assert.match(policyDrift.stderr, /font-tracker\.json/);

    // A deleted tracker file is drift, not a crash.
    rmSync(path.join(dir, FILES.json));
    assert.equal(run("--check").status, 1);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("a policy family without an override, or an override without a policy family, fails the build", () => {
  const dir = scratchCopy();
  try {
    const policyFile = path.join(dir, FILES.policy);
    const original = readFileSync(policyFile, "utf8");
    const withNew = JSON.parse(original);
    withNew.families.push({ ...withNew.families.find((row) => row.family === "Calibri"), family: "Brand New Face" });
    writeFileSync(policyFile, JSON.stringify(withNew));
    assert.throws(() => buildTracker({ root: dir }), /no nextAction for Brand New Face/);

    const withoutRow = JSON.parse(original);
    withoutRow.families = withoutRow.families.filter((row) => row.family !== "Wingdings");
    writeFileSync(policyFile, JSON.stringify(withoutRow));
    assert.throws(() => buildTracker({ root: dir }), /Wingdings/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("a declared shipped dependency that the policy later adopts must leave overrides.extras", () => {
  const dir = scratchCopy();
  try {
    const policyFile = path.join(dir, FILES.policy);
    const adopted = JSON.parse(readFileSync(policyFile, "utf8"));
    adopted.families.push({ ...adopted.families.find((row) => row.family === "Noto Sans JP"), family: "Noto Sans Arabic" });
    writeFileSync(policyFile, JSON.stringify(adopted));
    assert.throws(() => buildTracker({ root: dir }), /Noto Sans Arabic is in the policy/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
