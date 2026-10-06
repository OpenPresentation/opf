import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { branchErrors, changedPaths, commitMessage, deckCount, diffManifests, goldenInputs, isFixturePath, manifestErrors, pathErrors, resolveLock, slideCount, slideLines, splitKey, summaryMarkdown } from "./core-golden.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const script = path.join(root, "scripts/core-golden.mjs");
const workflowText = readFileSync(path.join(root, ".github/workflows/regenerate-core-golden.yml"), "utf8");
const hash = (digit) => digit.repeat(64);

function manifest(entries, source = hash("a")) {
  return {
    version: 2,
    source: { repository: "OpenPresentation/opf", path: "examples", sha256: source, decks: new Set(Object.keys(entries).map((key) => splitKey(key).deck)).size },
    format: "png-sha256",
    scale: 0.25,
    systemFonts: false,
    entries: Object.fromEntries(Object.entries(entries).map(([key, digit]) => [key, { sha256: hash(digit), bytes: 100 }])),
  };
}
const base = () => manifest({ "a/one.opf.json#0": "1", "a/one.opf.json#1": "2", "a/one.opf.json#10": "3", "b/two.opf.json#0": "4" });

test("the committed lock golden is a core fixture in the canonical format the generator writes (so the byte comparison is meaningful)", () => {
  const { goldenPath, rendererSha } = resolveLock(readFileSync(path.join(root, "ecosystem.lock.json"), "utf8"));
  assert.match(rendererSha, /^[0-9a-f]{40}$/);
  const text = readFileSync(path.join(root, goldenPath), "utf8");
  assert.equal(JSON.stringify(JSON.parse(text), null, 2) + "\n", text);
  assert.deepEqual(manifestErrors(JSON.parse(text), JSON.parse(text)), []);
});

test("only a plain branch of this repository is accepted", () => {
  for (const good of ["codex/fa-03-chart-types", "fa-00b-regenerate-core-golden", "release/1.2", "feature_x.y"]) assert.deepEqual(branchErrors(good), [], good);
  const bad = ["", "main", "someone:fa-03", "refs/heads/fa-03", "origin/fa-03", "pull/12/head", "a".repeat(40), "-x", "/x", "a..b", "a b", "a;rm -rf", "$(id)", "x.lock", "a//b", "x/"];
  for (const name of bad) assert.notDeepEqual(branchErrors(name), [], JSON.stringify(name));
  assert.match(branchErrors("someone:fa-03").join(), /fork/);
  assert.match(branchErrors("trunk", "trunk").join(), /default branch/);
});

test("the lock must select a core fixture", () => {
  const lock = (golden) => JSON.stringify({
    version: 1,
    repositories: { opf: { sha: "1".repeat(40) }, "opf-render": { sha: "2".repeat(40) }, "opf-pptx": { sha: "3".repeat(40) }, "opf-editor": { sha: "4".repeat(40) } },
    golden,
    provenance: { source: "migration", at: "2026-10-03T03:00:00Z" },
  });
  assert.deepEqual(resolveLock(lock({ repository: "opf", path: "scripts/fixtures/x.sha256.json" })), { goldenPath: "scripts/fixtures/x.sha256.json", rendererSha: "2".repeat(40) });
  assert.throws(() => resolveLock(lock({ repository: "opf-render", path: "test/golden/x" })), /only core's scripts\/fixtures/);
  assert.throws(() => resolveLock(lock({ repository: "opf", path: "docs/x.json" })), /not scripts\/fixtures/);
});

test("only fixtures directly under scripts/fixtures are writable", () => {
  assert.equal(isFixturePath("scripts/fixtures/opf-examples-png.example-decks.sha256.json"), true);
  for (const bad of ["scripts/fixtures/README.md", "scripts/fixtures/sub/x.sha256.json", "scripts/x.sha256.json", "../scripts/fixtures/x.sha256.json", "scripts/fixtures/x.sha256.json/../y", "ecosystem.lock.json", ""]) assert.equal(isFixturePath(bad), false, bad);
});

test("main changes that move a render make a stale branch fail; unrelated ones do not", () => {
  assert.deepEqual(goldenInputs(["docs/x.md", "changes/a.md", "CHANGELOG.md", "scripts/ecosystem-roll.mjs"]), []);
  assert.deepEqual(goldenInputs(["examples/a.opf.json", "docs/x.md", "packages/javascript/src/a.ts", "spec/catalogs/x.json", "scripts/fixtures/y.sha256.json", "ecosystem.lock.json", "pnpm-lock.yaml"]).length, 6);
  const dir = mkdtempSync(path.join(tmpdir(), "core-golden-"));
  const file = path.join(dir, "paths.txt");
  writeFileSync(file, "docs/x.md\n");
  assert.equal(spawnSync("node", [script, "behind", "--paths-file", file], { encoding: "utf8" }).status, 0);
  writeFileSync(file, "docs/x.md\nexamples/a.opf.json\n");
  const result = spawnSync("node", [script, "behind", "--paths-file", file], { encoding: "utf8" });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /Rebase the branch onto main/);
});

test("diffManifests lists changed, added and removed slides in deck and numeric slide order, and the changed top-level fields", () => {
  const next = manifest({ "a/one.opf.json#0": "1", "a/one.opf.json#1": "9", "a/one.opf.json#10": "8", "a/one.opf.json#2": "7", "c/three.opf.json#0": "6" }, hash("b"));
  const diff = diffManifests(base(), next);
  assert.deepEqual(diff.changed.map((row) => row.key), ["a/one.opf.json#1", "a/one.opf.json#10"]);
  assert.deepEqual(diff.changed[0], { key: "a/one.opf.json#1", deck: "a/one.opf.json", index: 1, old: hash("2"), new: hash("9") });
  assert.deepEqual(diff.added.map((row) => row.key), ["a/one.opf.json#2", "c/three.opf.json#0"]);
  assert.deepEqual(diff.removed.map((row) => row.key), ["b/two.opf.json#0"]);
  assert.deepEqual(diff.meta.map((row) => row.field).sort(), ["source.sha256"]);
  assert.equal(slideCount(diff), 5);
  assert.equal(deckCount(diff), 3);
  assert.equal(diff.total, 5);
  assert.deepEqual(slideLines(diff).slice(0, 2), [`a/one.opf.json#1 ${"2".repeat(12)} -> ${"9".repeat(12)}`, `a/one.opf.json#10 ${"3".repeat(12)} -> ${"8".repeat(12)}`]);
  const same = diffManifests(base(), base());
  assert.equal(slideCount(same), 0);
  assert.deepEqual(same.meta, []);
});

test("a changed byte count with the same hash is still a change", () => {
  const next = base();
  next.entries["b/two.opf.json#0"].bytes = 101;
  assert.equal(diffManifests(base(), next).changed.length, 1);
});

test("the commit message and the summary name every changed slide with old and new hash", () => {
  const next = manifest({ "a/one.opf.json#0": "5", "a/one.opf.json#1": "2", "a/one.opf.json#10": "3", "b/two.opf.json#0": "6" }, hash("b"));
  const diff = diffManifests(base(), next);
  const message = commitMessage(diff, { baseLabel: "main abc", runUrl: "https://example.test/run/1", renderer: "759017eca214", image: "playwright:x" });
  assert.match(message, /^Regenerate examples golden: 2 slides in 2 decks\n/);
  assert.match(message, /- a\/one\.opf\.json#0 111111111111 -> 555555555555/);
  assert.match(message, /- b\/two\.opf\.json#0 444444444444 -> 666666666666/);
  assert.match(message, /reproduced main abc's committed fixture byte for byte/);
  assert.match(message, /source.sha256: aaaaaaaaaaaa -> bbbbbbbbbbbb/);
  const summary = summaryMarkdown(diff, { branch: "codex/x", head: "f".repeat(40), base: "e".repeat(40), goldenPath: "scripts/fixtures/g.sha256.json", renderer: "d".repeat(40), notes: ["a note"] });
  assert.match(summary, /\*\*2 slides changed in 2 decks\*\*/);
  assert.match(summary, /- `a\/one\.opf\.json`: #0 \(1\)\. Reason:/);
  assert.match(summary, /\| `b\/two\.opf\.json#0` \| 444444444444 \| 666666666666 \|/);
  assert.match(summary, /a note/);
  assert.match(summaryMarkdown(diffManifests(base(), base()), { goldenPath: "x" }), /No slide differs/);
});

test("a candidate must be the same kind of manifest as the base", () => {
  assert.deepEqual(manifestErrors(base(), base()), []);
  const cases = [
    [(m) => { m.scale = 1; }, /scale/],
    [(m) => { m.systemFonts = true; }, /systemFonts/],
    [(m) => { m.version = 3; }, /version/],
    [(m) => { m.extra = 1; }, /top-level fields/],
    [(m) => { m.entries["a/one.opf.json#0"].sha256 = "zz"; }, /bad entry/],
    [(m) => { m.entries = {}; }, /no entries/],
    [(m) => { m.source.sha256 = "short"; }, /source\.sha256/],
    [(m) => { m.source.decks = 9; }, /source\.decks/],
  ];
  for (const [mutate, expected] of cases) {
    const candidate = base();
    mutate(candidate);
    assert.match(manifestErrors(candidate, base()).join("\n"), expected);
  }
  assert.deepEqual(manifestErrors(null, base()), ["the candidate is not a golden manifest"]);
});

test("the commit may touch only the fixture", () => {
  const dir = mkdtempSync(path.join(tmpdir(), "core-golden-git-"));
  const git = (...args) => spawnSync("git", ["-c", "user.name=t", "-c", "user.email=t@example.test", ...args], { cwd: dir, encoding: "utf8" });
  const fixture = "scripts/fixtures/x.sha256.json";
  git("init", "-q");
  mkdirSync(path.join(dir, "scripts/fixtures"), { recursive: true });
  writeFileSync(path.join(dir, fixture), "{}\n");
  writeFileSync(path.join(dir, "keep.txt"), "a\n");
  git("add", "-A");
  git("commit", "-q", "-m", "init");
  assert.deepEqual(changedPaths(dir), []);
  writeFileSync(path.join(dir, fixture), "{ }\n");
  assert.deepEqual(changedPaths(dir), [fixture]);
  assert.deepEqual(pathErrors(changedPaths(dir), fixture), []);
  writeFileSync(path.join(dir, "leak.txt"), "x\n");
  mkdirSync(path.join(dir, "nested"));
  writeFileSync(path.join(dir, "nested/also.txt"), "x\n");
  const errors = pathErrors(changedPaths(dir), fixture);
  assert.equal(errors.length, 2, errors.join("\n"));
  assert.match(errors.join("\n"), /nested\/also\.txt/);
  assert.match(pathErrors([], "docs/x.json").join(), /not a core fixture/);
});

test("the CLI compares byte for byte and reports what differs", () => {
  const dir = mkdtempSync(path.join(tmpdir(), "core-golden-cli-"));
  const write = (name, value) => { writeFileSync(path.join(dir, name), `${JSON.stringify(value, null, 2)}\n`); return path.join(dir, name); };
  const a = write("a.json", base());
  const same = write("same.json", base());
  const moved = write("moved.json", manifest({ "a/one.opf.json#0": "7", "a/one.opf.json#1": "2", "a/one.opf.json#10": "3", "b/two.opf.json#0": "4" }));
  assert.equal(spawnSync("node", [script, "compare", "--expected", a, "--actual", same], { encoding: "utf8" }).status, 0);
  const result = spawnSync("node", [script, "compare", "--expected", a, "--actual", moved], { encoding: "utf8" });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /a\/one\.opf\.json#0 111111111111 -> 777777777777/);
  assert.match(result.stderr, /nothing is pushed/);
  const out = path.join(dir, "out");
  const outputFile = path.join(dir, "github-output");
  const report = spawnSync("node", [script, "report", "--base", a, "--candidate", moved, "--branch-fixture", a, "--out-dir", out, "--branch", "codex/x", "--head", "f".repeat(40), "--base-sha", "e".repeat(40), "--golden-path", "scripts/fixtures/g.sha256.json", "--renderer", "d".repeat(40), "--note", "n", "--github-output"], { encoding: "utf8", env: { ...process.env, GITHUB_OUTPUT: outputFile } });
  assert.equal(report.status, 0, report.stderr);
  assert.deepEqual(readdirSync(out).sort(), ["changes.json", "commit-message.txt", "summary.md"]);
  assert.match(readFileSync(outputFile, "utf8"), /^changed-slides=1\nchanged-decks=1\npush-needed=true\n$/);
  // The branch already carries the candidate bytes: nothing to push.
  const again = spawnSync("node", [script, "report", "--base", a, "--candidate", moved, "--branch-fixture", moved, "--out-dir", out], { encoding: "utf8" });
  assert.match(again.stdout, /push-needed=false/);
  // A missing branch fixture (the branch selects a new file) needs a push.
  assert.match(spawnSync("node", [script, "report", "--base", a, "--candidate", moved, "--branch-fixture", path.join(dir, "missing.json"), "--out-dir", out], { encoding: "utf8" }).stdout, /push-needed=true/);
  assert.equal(spawnSync("node", [script, "check-branch", "--branch", "main"], { encoding: "utf8" }).status, 1);
  assert.equal(spawnSync("node", [script, "check-branch", "--branch", "codex/fa-1"], { encoding: "utf8" }).status, 0);
  assert.equal(spawnSync("node", [script, "bogus"], { encoding: "utf8" }).status, 1);
});

test("the workflow keeps its contract: dispatch on main only, same-repo branch, pinned image, write token only in the push job", () => {
  const ecosystem = readFileSync(path.join(root, ".github/workflows/ecosystem-ci.yml"), "utf8");
  const pinned = ecosystem.match(/container: (mcr\.microsoft\.com\/playwright:[^\s]+)/u)[1];
  const images = [...workflowText.matchAll(/mcr\.microsoft\.com\/playwright:[^\s]+/gu)].map((match) => match[0]);
  assert.equal(images.length, 2, "the container and the OPF_PLAYWRIGHT_IMAGE note");
  for (const image of images) assert.equal(image, pinned);
  assert.match(workflowText, /^on:\n {2}workflow_dispatch:\n {4}inputs:\n {6}branch:\n(?:.*\n)*? {8}required: true/mu);
  assert.doesNotMatch(workflowText.slice(0, workflowText.indexOf("\npermissions:")),/^ {2}(pull_request|push|schedule|repository_dispatch|workflow_run)/mu);
  assert.match(workflowText, /refs\/heads\/\$DEFAULT_BRANCH/);
  assert.match(workflowText, /node-version: 24/);
  assert.match(workflowText, /OPF_GOLDEN_ARTIFACTS=changed node test\/golden\.mjs --update/);
  // Workflow-level permissions are read only; contents: write appears once, in the push job.
  assert.match(workflowText, /^permissions:\n {2}contents: read/mu);
  assert.equal(workflowText.match(/^ +contents: write/gmu).length, 1);
  assert.ok(workflowText.search(/^ +contents: write/mu) > workflowText.indexOf("\n  push:"));
  // The branch is never checked out from another repository, and no input is interpolated into a script.
  for (const step of workflowText.split("\n      - ").filter((block) => /ref: \$\{\{ inputs\.branch \}\}/u.test(block))) assert.doesNotMatch(step, /repository:/);
  const scripts = [...workflowText.matchAll(/ {8}run: ([^\n]*)\n|run: \|\n((?: {10}.*\n|\n)+)/gu)].map((match) => match[1] ?? match[2]).join("\n");
  assert.doesNotMatch(scripts, /\$\{\{ *inputs\./u);
  assert.doesNotMatch(scripts, /\$\{\{ *github\.event\.(?!repository\.default_branch)/u);
  // The renderer test and the guard come before the branch render; the push job never runs branch code.
  assert.ok(workflowText.indexOf("core-golden.mjs compare") < workflowText.indexOf("render opf out/branch"));
  const pushJob = workflowText.slice(workflowText.indexOf("\n  push:"));
  assert.doesNotMatch(pushJob, /pnpm|npm |node branch\//u);
  assert.match(pushJob, /git -C branch push "https:\/\/x-access-token:\$\{GH_TOKEN\}@github\.com\/\$\{GITHUB_REPOSITORY\}\.git" "HEAD:refs\/heads\/\$BRANCH"/);
  assert.doesNotMatch(pushJob, /--force|push[^\n]* -f /u);
});

test("the workflow is valid YAML with the expected jobs", async () => {
  let yaml;
  try { yaml = createRequire(path.join(root, "packages/javascript/package.json"))("yaml"); } catch { return; }
  const parsed = yaml.parse(workflowText);
  assert.deepEqual(Object.keys(parsed.jobs), ["regenerate", "push"]);
  assert.deepEqual(Object.keys(parsed.on.workflow_dispatch.inputs), ["branch", "dry-run", "dispatch-ci"]);
  assert.equal(parsed.jobs.push.needs, "regenerate");
  assert.deepEqual(parsed.jobs.push.permissions, { contents: "write", actions: "write" });
  assert.equal(parsed.jobs.regenerate.permissions, undefined);
});
