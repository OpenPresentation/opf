import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { FULL_TIER_PATHS, ecosystemScope, isEcosystemIndependent, isRegistryIndependent, registryForEvent, scopeForEvent, tierForEvent } from "./ecosystem-scope.mjs";

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

// RR-45 (opf#368, item 6): the Windows and macOS legs keep their required check names on every pull request, but take a
// Windows or macOS runner only off pull requests or with the label ecosystem-full.
test("the installed-candidate legs always report under their required names and run on their OS outside plain pull requests", () => {
  const workflow = readFileSync(new URL("../.github/workflows/ecosystem-ci.yml", import.meta.url), "utf8");
  const job = workflow.slice(workflow.indexOf("\n  installed-portability:\n"), workflow.indexOf("\n  main-status:"));
  const policy = "(needs.gallery.outputs.candidate_gallery != '' || github.event_name != 'pull_request' || contains(github.event.pull_request.labels.*.name, 'ecosystem-full') || contains(github.event.pull_request.labels.*.name, 'full-ci'))";
  assert.ok(job.includes("    name: Installed candidates (${{ matrix.os }})\n"));
  assert.ok(job.includes(`    runs-on: \${{ ${policy} && matrix.os || 'ubuntu-24.04' }}\n`));
  assert.ok(job.includes(`      PORTABILITY: \${{ ${policy} && 'run' || 'policy-skip' }}\n`));
  assert.match(job, /os: \[windows-latest, macos-latest\]/);
  assert.doesNotMatch(job, /\n    if:/, "a skipped matrix job would not report the expanded required check names");
  // Candidate mode must run; ordinary mode retains docs-only scope and policy skips still report.
  assert.ok(job.includes(`if [ "$PORTABILITY" = run ]; then
            if [ -n '\${{ needs.gallery.outputs.candidate_gallery }}' ]; then echo 'run=true' >> "$GITHUB_OUTPUT"; else node scripts/ecosystem-scope.mjs; fi
          else
            echo "run=false" >> "$GITHUB_OUTPUT"`));
});

test("every tier-defining file exists, so a rename cannot silently lower the tier", () => {
  for (const file of FULL_TIER_PATHS) assert.ok(readFileSync(new URL(`../${file}`, import.meta.url)), file);
});

test("the workflow runs the contract tier on pull requests and the full suites on merge_group and a nightly schedule, with no push-to-main run", () => {
  const workflow = readFileSync(new URL("../.github/workflows/ecosystem-ci.yml", import.meta.url), "utf8");
  const triggers = workflow.slice(workflow.indexOf("\non:"), workflow.indexOf("\npermissions:"));
  for (const trigger of ["pull_request:", "merge_group:", "schedule:", "workflow_dispatch:"]) assert.ok(triggers.includes(`\n  ${trigger}`), trigger);
  // RR-57: the queue fast-forwards main to the commit its merge_group run tested, so a push run repeats the same SHA.
  assert.ok(!triggers.includes("\n  push:"), "no push-to-main trigger");
  // The tier is decided by tierForEvent and handed to every sibling shard; a shard cannot hard-code a depth.
  assert.equal([...workflow.matchAll(/test-package-ecosystem\.mjs --siblings [^\n]*--tier \$\{\{ steps\.scope\.outputs\.tier \}\}/g)].length, 3);
  assert.doesNotMatch(workflow, /--tier (contract|full)\b/);
  // The required name stays: packages aggregates both explicitly selected lanes and runs even when one fails.
  assert.match(workflow, /\n  packages:\n    needs: \[gallery, ecosystem-render, ecosystem-pptx, ecosystem-editor, ecosystem-core, candidate, control, installed-portability\]\n    if: always\(\)/);
  // RR-45 (opf#368, item 1): ecosystem-core runs as exactly these three shards, none of which can be dropped by fail-fast.
  const core = workflow.slice(workflow.indexOf("\n  ecosystem-core:\n"), workflow.indexOf("\n  installed-portability:\n"));
  assert.match(core, /\n    strategy:\n      fail-fast: false\n      matrix:\n        shard: \[model, installed, registry\]\n/);
  assert.match(core, /\n    needs: gallery\n    if: needs\.gallery\.outputs\.candidate_gallery == ''\n/, "only explicit candidate selection delegates the core contracts to the candidate lane");
  for (const shard of ["model", "installed", "registry"]) assert.ok(core.includes(`matrix.shard == '${shard}'`), shard);
  assert.match(core, /test-package-ecosystem\.mjs --skip-siblings --core model\n/);
  assert.match(core, /test-package-ecosystem\.mjs --skip-siblings --core packed\n/);
});

// RR-45 (opf#368, item 3): the registry checks are skipped only on a pull request that changes nothing they read.
test("the registry checks always run outside pull requests, and on a pull request unless every path is independent", () => {
  for (const event of ["push", "merge_group", "schedule", "workflow_dispatch", "local"]) {
    const decision = registryForEvent(event, { listChangedFiles: () => { throw new Error("must not list files for " + event); } });
    assert.equal(decision.registry, true, event);
  }
  const pr = (files, labels = []) => registryForEvent("pull_request", { listChangedFiles: () => files, labels }).registry;
  assert.equal(pr(["packages/javascript/src/composition.ts", "packages/cli/src/index.ts", "changes/x.md", "docs/live-editor.md", "spec/schemas/opf.schema.json"]), false);
  assert.equal(pr(["packages/javascript/src/composition.ts"], ["ecosystem-full"]), true, "the label runs them");
  assert.equal(pr([]), true, "an empty list is unclassified");
  assert.equal(registryForEvent("pull_request", { listChangedFiles: () => { throw new Error("no parent"); } }).registry, true);
  for (const file of [
    "scripts/test-packed-ecosystem.mjs", "scripts/test-registry-fidelity.mjs", "scripts/registry-golden.mjs", "scripts/fixtures/opf-examples-png.audience-ids.sha256.json",
    "release-plan.json", "ecosystem.lock.json", "package.json", "pnpm-lock.yaml", "packages/javascript/package.json", "packages/cli/package.json",
    "packages/cli/test/packed.mjs", ".github/workflows/ecosystem-ci.yml", ".github/actions/ecosystem-refs/action.yml", "test/browser-suites.json",
    "docs/evidence/payload-fit-gaps-2026-09-09.opf.json", "packages/javascript/tsup.config.ts",
  ]) {
    assert.equal(isRegistryIndependent(file), false, file);
    assert.equal(pr(["packages/javascript/src/index.ts", file]), true, file);
  }
  for (const file of ["packages/javascript/test/composition.mjs", "packages/cli/test/files.mjs", "docs/programs/x.md", "README.md", ".github/workflows/opf-ci.yml", "skills/opf-author/SKILL.md"]) {
    assert.equal(isRegistryIndependent(file), true, file);
  }
});

test("the registry shard installs the registry consumer on every change and gates only the published-package checks", () => {
  const workflow = readFileSync(new URL("../.github/workflows/ecosystem-ci.yml", import.meta.url), "utf8");
  const gated = [...workflow.matchAll(/steps\.scope\.outputs\.registry == 'true'/g)];
  assert.equal(gated.length, 1, "exactly one step is path-filtered");
  const step = workflow.slice(workflow.indexOf("      - name: Verify exact published registry packages and fidelity fixtures"));
  const body = step.slice(0, step.indexOf("\n      - name:", 10));
  assert.match(body, /steps\.scope\.outputs\.registry == 'true'/);
  assert.doesNotMatch(body, /test:registry-ecosystem|test-quote-layout-geometry|test-code-layout|test-metric/);
  assert.match(workflow, /name: Install the exact published registry packages and check the registry consumer\n        if: steps\.scope\.outputs\.run == 'true' && matrix\.shard == 'registry'\n/);
});

// RR-57: opf-render and opf-pptx run their serial suites as three parallel slices, opf-editor as one job. A slice that no job
// runs would silently drop tests, so the matrix, the denominators and the sibling list must agree.
test("the sibling jobs run every test slice: matrix shards match the --test-shard denominator, and the former combined job is gone", () => {
  const workflow = readFileSync(new URL("../.github/workflows/ecosystem-ci.yml", import.meta.url), "utf8");
  assert.doesNotMatch(workflow, /\n  ecosystem-pptx-editor:\n|needs: \[[^\]]*ecosystem-pptx-editor/, "the combined job was split into ecosystem-pptx and ecosystem-editor");
  const section = (id, next) => workflow.slice(workflow.indexOf(`\n  ${id}:\n`), workflow.indexOf(`\n  ${next}:\n`) > 0 ? workflow.indexOf(`\n  ${next}:\n`) : undefined);
  for (const [id, next, sibling] of [["ecosystem-render", "ecosystem-pptx", "opf-render"], ["ecosystem-pptx", "ecosystem-editor", "opf-pptx"]]) {
    const job = section(id, next);
    assert.match(job, /\n    strategy:\n      fail-fast: false\n      matrix:\n        shard: \[1, 2, 3\]\n/, `${id} runs three shards and none is dropped by fail-fast`);
    assert.match(job, /\n    needs: gallery\n    if: needs\.gallery\.outputs\.candidate_gallery == ''\n/);
    assert.ok(job.includes(`--siblings ${sibling} --tier \${{ steps.scope.outputs.tier }} --test-shard \${{ matrix.shard }}/3\n`), `${id} runs its slice of ${sibling}`);
    assert.equal([...job.matchAll(/--test-shard/g)].length, 1);
  }
  const editor = section("ecosystem-editor", "ecosystem-core");
  assert.ok(editor.includes("--siblings opf-editor --tier ${{ steps.scope.outputs.tier }}\n") && !editor.includes("--test-shard") && !editor.includes("strategy:"));
  // Every sibling suite runs in exactly one family of jobs.
  const runs = [...workflow.matchAll(/test-package-ecosystem\.mjs --siblings (\S+)/g)].map((match) => match[1]).sort();
  assert.deepEqual(runs, ["opf-editor", "opf-pptx", "opf-render"]);
});
