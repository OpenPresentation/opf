import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { FULL_TIER_PATHS, ecosystemScope, isEcosystemIndependent, scopeForEvent, tierForEvent } from "./ecosystem-scope.mjs";

test("program tracking and native evidence are independent of the ecosystem checks", () => {
  for (const file of [
    "docs/programs/release-readiness/burndown.md",
    "docs/programs/release-readiness/report.mjs",
    "docs/programs/font-fidelity-everywhere/font-tracker.json",
    "docs/evidence/rr-05b-native-20261002/README.md",
    "docs/evidence/rr-05b-native-20261002/compare.json",
    "docs/evidence/windows-native-charts-20260930/chartex/funnel.png",
  ]) assert.equal(isEcosystemIndependent(file), true, file);
});

test("evidence decks, top-level docs and every other path stay relevant", () => {
  for (const file of [
    // Read by scripts/test-code-layout-geometry.mjs and scripts/test-quote-layout-geometry.mjs.
    "docs/evidence/code-layout-gap-2026-09-09.opf.json",
    "docs/evidence/payload-fit-gaps-2026-09-09.opf.json",
    "docs/evidence/some-run/deck.opf.json",
    // Top-level docs are inlined into the core package; docs/fixtures are read by ecosystem tests.
    "docs/live-editor.md",
    "docs/ci-cd.md",
    "docs/fixtures/color-references.opf.json",
    "docs/quickstart/developer-quickstart.opf.json",
    "docs/programs",
    "README.md",
    "CHANGELOG.md",
    "package.json",
    "pnpm-lock.yaml",
    "skills/opf-author/SKILL.md",
    "spec/schemas/opf.schema.json",
    "scripts/test-packed-ecosystem.mjs",
    ".github/workflows/ecosystem-ci.yml",
  ]) assert.equal(isEcosystemIndependent(file), false, file);
});

test("only a non-empty, fully independent change skips the checks", () => {
  assert.equal(ecosystemScope([]).run, true);
  assert.equal(ecosystemScope(["docs/programs/release-readiness/burndown.md"]).run, false);
  assert.equal(ecosystemScope(["docs/programs/release-readiness/burndown.md", "docs/evidence/x/README.md"]).run, false);
  const mixed = ecosystemScope(["docs/programs/release-readiness/burndown.md", "scripts/pack-ecosystem.mjs"]);
  assert.equal(mixed.run, true);
  assert.deepEqual(mixed.relevant, ["scripts/pack-ecosystem.mjs"]);
});

test("only a pull request can skip; push, merge_group, manual and local runs always run in full", () => {
  const docsOnly = () => ["docs/programs/release-readiness/burndown.md"];
  assert.equal(scopeForEvent("pull_request", docsOnly).run, false);
  for (const event of ["push", "merge_group", "workflow_dispatch", "schedule", "local"]) {
    const decision = scopeForEvent(event, () => { throw new Error("must not list files for " + event); });
    assert.equal(decision.run, true, event);
    assert.match(decision.reason, new RegExp(event));
  }
  assert.equal(scopeForEvent("pull_request", () => { throw new Error("no parent"); }).run, true);
});

// RR-53: consumer-driven contracts. Only a pull request runs the siblings' contract suites.
test("merge_group, push, schedule, manual and local runs always run the full sibling suites, whatever the paths", () => {
  for (const event of ["merge_group", "push", "schedule", "workflow_dispatch", "local", "repository_dispatch"]) {
    const decision = tierForEvent(event, { listChangedFiles: () => { throw new Error("must not list files for " + event); }, labels: [] });
    assert.equal(decision.tier, "full", event);
    // A docs-only or contract-only change set must not lower a non-PR run (scopeForEvent already never skips one).
    assert.equal(scopeForEvent(event, () => ["docs/programs/release-readiness/burndown.md"]).run, true, event);
  }
});

test("an ordinary pull request runs the contract tier", () => {
  for (const files of [["README.md"], ["packages/opf/src/index.ts", "docs/live-editor.md"], ["spec/schemas/opf.schema.json"], ["scripts/test-packed-ecosystem.mjs"]]) {
    assert.equal(tierForEvent("pull_request", { listChangedFiles: () => files, headRef: "codex/x", labels: ["bug"] }).tier, "contract", files.join());
  }
});

test("a pull request that can change what the contract tier trusts runs the full suites", () => {
  const pr = (over) => tierForEvent("pull_request", { listChangedFiles: () => ["README.md"], headRef: "codex/x", labels: [], ...over });
  assert.equal(pr({}).tier, "contract");
  assert.equal(pr({ headRef: "ecosystem-roll/main" }).tier, "full");
  assert.equal(pr({ labels: ["ecosystem-full"] }).tier, "full");
  for (const file of FULL_TIER_PATHS) assert.equal(pr({ listChangedFiles: () => ["README.md", file] }).tier, "full", file);
  assert.equal(pr({ listChangedFiles: () => [] }).tier, "full", "an empty list is unclassified");
  assert.equal(pr({ listChangedFiles: () => { throw new Error("no parent"); } }).tier, "full", "unclassifiable means full");
});

test("every tier-defining file exists, so a rename cannot silently lower the tier", () => {
  for (const file of FULL_TIER_PATHS) assert.ok(readFileSync(new URL(`../${file}`, import.meta.url)), file);
});

test("the workflow runs the contract tier on pull requests and the full suites on merge_group, push and a nightly schedule", () => {
  const workflow = readFileSync(new URL("../.github/workflows/ecosystem-ci.yml", import.meta.url), "utf8");
  const triggers = workflow.slice(workflow.indexOf("\non:"), workflow.indexOf("\npermissions:"));
  for (const trigger of ["pull_request:", "merge_group:", "push:", "schedule:", "workflow_dispatch:"]) assert.ok(triggers.includes(`\n  ${trigger}`), trigger);
  // The tier is decided by tierForEvent and handed to every sibling shard; a shard cannot hard-code a depth.
  assert.equal([...workflow.matchAll(/test-package-ecosystem\.mjs --siblings [^\n]*--tier \$\{\{ steps\.scope\.outputs\.tier \}\}/g)].length, 2);
  assert.doesNotMatch(workflow, /--tier (contract|full)\b/);
  // The required names stay: `packages` aggregates exactly the three shards, and runs even when one fails.
  assert.match(workflow, /\n  packages:\n    needs: \[ecosystem-render, ecosystem-pptx-editor, ecosystem-core\]\n    if: always\(\)/);
  // RR-45 (opf#368, item 1): ecosystem-core runs as exactly these three shards, none of which can be dropped by fail-fast.
  const core = workflow.slice(workflow.indexOf("\n  ecosystem-core:\n"), workflow.indexOf("\n  installed-portability:\n"));
  assert.match(core, /\n    strategy:\n      fail-fast: false\n      matrix:\n        shard: \[model, installed, registry\]\n/);
  assert.doesNotMatch(core, /\n    if:/, "no job-level condition can skip the core shards");
  for (const shard of ["model", "installed", "registry"]) assert.ok(core.includes(`matrix.shard == '${shard}'`), shard);
  assert.match(core, /test-package-ecosystem\.mjs --skip-siblings --core model\n/);
  assert.match(core, /test-package-ecosystem\.mjs --skip-siblings --core packed\n/);
});
