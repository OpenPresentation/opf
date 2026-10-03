import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { ancestry, goldenSelection, guard, handEditedPins, isSafeRelativePath, outputLines, parseLock, REPOSITORIES, readLock, resolveRefs, validateLock } from "./ecosystem-lock.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const schema = JSON.parse(readFileSync(path.join(root, "scripts/ecosystem-lock.schema.json"), "utf8"));
const sha = (digit) => digit.repeat(40);

function sampleLock(overrides = {}) {
  return {
    version: 1,
    repositories: { opf: { sha: sha("1") }, "opf-render": { sha: sha("2") }, "opf-pptx": { sha: sha("3") }, "opf-editor": { sha: sha("4") } },
    golden: { repository: "opf", path: "scripts/fixtures/opf-examples-png.audience-ids.sha256.json" },
    provenance: { source: "migration", at: "2026-10-03T03:00:00Z" },
    ...overrides,
  };
}

test("the checked-in ecosystem.lock.json is valid and its core golden exists", () => {
  const lock = readLock(path.join(root, "ecosystem.lock.json"));
  assert.deepEqual(Object.keys(lock.repositories), REPOSITORIES);
  if (lock.golden.repository === "opf") readFileSync(path.join(root, lock.golden.path));
});

test("a valid lock has no errors", () => {
  assert.deepEqual(validateLock(sampleLock()), []);
  assert.deepEqual(validateLock(sampleLock({ $schema: "./scripts/ecosystem-lock.schema.json", $comment: "x", provenance: { source: "roller", at: "2026-10-03T03:00:00Z", run: "https://github.com/OpenPresentation/opf/actions/runs/1", note: "n" } })), []);
});

test("the validator rejects malformed locks", () => {
  const cases = [
    [null, /JSON object/],
    [sampleLock({ version: 2 }), /version must be 1/],
    [sampleLock({ extra: true }), /unknown top-level field "extra"/],
    [sampleLock({ repositories: { opf: { sha: sha("1") } } }), /opf-render: missing/],
    [sampleLock({ repositories: { ...sampleLock().repositories, "pptx-gallery": { sha: sha("5") } } }), /pptx-gallery: not an OpenPresentation/],
    [sampleLock({ repositories: { ...sampleLock().repositories, opf: { sha: "8a16740" } } }), /opf\.sha must be a full/],
    [sampleLock({ repositories: { ...sampleLock().repositories, opf: { sha: "A".repeat(40) } } }), /opf\.sha must be a full/],
    [sampleLock({ repositories: { ...sampleLock().repositories, opf: { sha: sha("1"), ref: "main" } } }), /unknown field "ref"/],
    [sampleLock({ golden: { repository: "Data-Advantage/pptx-gallery", path: "x" } }), /golden\.repository/],
    [sampleLock({ golden: { repository: "opf", path: "../opf-render/test/golden/x" } }), /golden\.path/],
    [sampleLock({ provenance: { source: "hand", at: "2026-10-03T03:00:00Z" } }), /provenance\.source/],
    [sampleLock({ provenance: { source: "roller", at: "yesterday" } }), /provenance\.at/],
    [sampleLock({ provenance: { source: "roller", at: "2026-10-03T03:00:00Z", run: "https://example.com/run/1" } }), /provenance\.run/],
  ];
  for (const [lock, expected] of cases) assert.match(validateLock(lock).join("\n"), expected, JSON.stringify(lock));
  assert.throws(() => parseLock("{"), /not JSON/);
  assert.throws(() => parseLock(JSON.stringify(sampleLock({ version: 0 }))), /not a valid ecosystem lock/);
});

test("golden paths stay inside their checkout, and the schema pattern agrees with the validator", () => {
  const pattern = new RegExp(schema.properties.golden.properties.path.pattern, "u");
  const good = ["scripts/fixtures/opf-examples-png.audience-ids.sha256.json", "test/golden/opf-examples-png.cover-centering", "a", "a.b/c..d"];
  const bad = ["", "/abs/path", "C:/x", "a\\b", "../x", "a/../b", "./a", "a/./b", "a//b", "a/", ".", ".."];
  for (const value of good) {
    assert.equal(isSafeRelativePath(value), true, value);
    assert.equal(pattern.test(value), true, `schema: ${value}`);
  }
  for (const value of bad) {
    assert.equal(isSafeRelativePath(value), false, value);
    assert.equal(value.length > 0 && pattern.test(value), false, `schema: ${value}`);
  }
});

test("the schema lists the same repositories, fields and SHA rule as the validator", () => {
  assert.deepEqual(schema.properties.repositories.required, REPOSITORIES);
  assert.deepEqual(Object.keys(schema.properties.repositories.properties), REPOSITORIES);
  assert.deepEqual(schema.properties.golden.properties.repository.enum, REPOSITORIES);
  assert.deepEqual(schema.required, ["version", "repositories", "golden", "provenance"]);
  assert.equal(schema.$defs.entry.properties.sha.pattern, "^[0-9a-f]{40}$");
  assert.deepEqual(schema.properties.provenance.properties.source.enum, ["migration", "roller"]);
});

function fakeApi(statuses) {
  const calls = [];
  const api = async (route) => {
    calls.push(route);
    const match = /^\/repos\/OpenPresentation\/([\w.-]+)\/compare\/([0-9a-f]{40})\.\.\.main$/.exec(route);
    assert.ok(match, route);
    const status = statuses[match[1]];
    if (status === 404) throw Object.assign(new Error("HTTP 404 Not Found"), { status: 404 });
    return { status, ahead_by: status === "identical" ? 0 : 3, behind_by: status === "behind" || status === "diverged" ? 2 : 0 };
  };
  return { api, calls };
}

test("ancestry maps the compare status to merge-base --is-ancestor", async () => {
  const { api } = fakeApi({ a: "ahead", b: "identical", c: "behind", d: "diverged", e: 404 });
  assert.equal((await ancestry(api, "a", sha("1"))).onBranch, true);
  assert.equal((await ancestry(api, "b", sha("1"))).onBranch, true);
  assert.equal((await ancestry(api, "c", sha("1"))).onBranch, false);
  assert.equal((await ancestry(api, "d", sha("1"))).onBranch, false);
  const unknown = await ancestry(api, "e", sha("1"));
  assert.equal(unknown.onBranch, false);
  assert.equal(unknown.status, "unknown commit");
});

test("the guard reports every SHA that is not on main", async () => {
  const { api, calls } = fakeApi({ opf: "ahead", "opf-render": "diverged", "opf-pptx": "identical", "opf-editor": 404 });
  const { problems, lines } = await guard(sampleLock(), api);
  assert.equal(calls.length, 4);
  assert.equal(problems.length, 2);
  assert.match(problems[0], /opf-render is locked to 222222222222, which is not on OpenPresentation\/opf-render main \(2 commits not in main\)/);
  assert.match(problems[1], /opf-editor 444444444444 could not be checked against main \(unknown commit/);
  assert.equal(lines.length, 2);
});

test("only the roller's branches may change a locked SHA", () => {
  const base = sampleLock();
  const moved = sampleLock({ repositories: { ...base.repositories, "opf-pptx": { sha: sha("9") } } });
  assert.deepEqual(handEditedPins(base, moved, "codex/rr-99-repin"), [{ repository: "opf-pptx", from: sha("3"), to: sha("9") }]);
  assert.deepEqual(handEditedPins(base, moved, "ecosystem-roll/main"), []);
  assert.deepEqual(handEditedPins(undefined, moved, "codex/rr-99-repin"), []);
  assert.deepEqual(handEditedPins(base, sampleLock({ golden: { repository: "opf-render", path: "test/golden/x" } }), "codex/rr-99-golden"), []);
});

test("resolve gives the locked SHA for every repository and a workspace-relative golden", () => {
  const resolved = resolveRefs(sampleLock(), { consumer: "opf-render" });
  assert.deepEqual(Object.fromEntries(Object.entries(resolved.refs).map(([name, value]) => [name, value.ref])), { opf: sha("1"), "opf-render": sha("2"), "opf-pptx": sha("3"), "opf-editor": sha("4") });
  assert.match(resolved.refs["opf-render"].source, /own head/);
  assert.equal(resolved.refs.opf.source, "lock");
  assert.equal(resolved.golden.workspacePath, "opf/scripts/fixtures/opf-examples-png.audience-ids.sha256.json");
  assert.deepEqual(outputLines(resolved, "/w/opf/ecosystem.lock.json"), [
    `opf=${sha("1")}`,
    `opf_render=${sha("2")}`,
    `opf_pptx=${sha("3")}`,
    `opf_editor=${sha("4")}`,
    "golden=opf/scripts/fixtures/opf-examples-png.audience-ids.sha256.json",
    "golden_source=lock",
    "lock_file=/w/opf/ecosystem.lock.json",
  ]);
  assert.throws(() => resolveRefs(sampleLock(), { consumer: "pptx-gallery" }), /--consumer/);
});

test("a golden override must name a checkout and stay inside it", () => {
  assert.deepEqual(goldenSelection(sampleLock(), "opf-render/test/golden/opf-examples-png.cover-centering"), { repository: "opf-render", path: "test/golden/opf-examples-png.cover-centering", source: "override" });
  for (const bad of ["test/golden/x", "opf-render/../opf/x", "/opf-render/x", "opf-render/"]) assert.throws(() => goldenSelection(sampleLock(), bad), /golden override/, bad);
});

test("no core workflow pins an OpenPresentation repository by hand (RR-50: the lock is the only source)", () => {
  const directory = path.join(root, ".github/workflows");
  for (const file of readdirSync(directory).filter((name) => name.endsWith(".yml"))) {
    const text = readFileSync(path.join(directory, file), "utf8");
    assert.doesNotMatch(text, /^\s*OPF_(RENDER|PPTX|EDITOR)_REF:/m, `${file}: hand-written sibling pin`);
    const lines = text.split(/\r?\n/);
    lines.forEach((line, index) => {
      if (!/^\s*repository:\s*OpenPresentation\//.test(line)) return;
      for (const next of lines.slice(index + 1, index + 6)) {
        assert.doesNotMatch(next, /^\s*ref:\s*[0-9a-f]{7,40}\s*(#.*)?$/, `${file}:${index + 1}: hand-written SHA for ${line.trim()}`);
      }
    });
    assert.doesNotMatch(text, /OPF_GOLDEN_BASELINE:\s*\$\{\{\s*github\.workspace\s*\}\}\/(?!\$\{\{)/, `${file}: hand-written golden selection`);
  }
});

test("the composite action runs this script from the same commit as the lock", () => {
  const action = readFileSync(path.join(root, ".github/actions/ecosystem-refs/action.yml"), "utf8");
  assert.match(action, /node "\$GITHUB_ACTION_PATH\/\.\.\/\.\.\/\.\.\/scripts\/ecosystem-lock\.mjs"/);
  for (const output of ["opf", "opf_render", "opf_pptx", "opf_editor", "golden", "lock_file"]) assert.match(action, new RegExp(`^  ${output}:\\n`, "m"), output);
});
