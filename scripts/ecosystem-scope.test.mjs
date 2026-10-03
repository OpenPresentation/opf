import assert from "node:assert/strict";
import test from "node:test";
import { ecosystemScope, isEcosystemIndependent, scopeForEvent } from "./ecosystem-scope.mjs";

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
