// RR-40: decide whether the coordinated ecosystem checks in .github/workflows/ecosystem-ci.yml must run.
//
// The answer is "skip" only for a pull request whose every changed path is program tracking or native
// evidence that no ecosystem check reads: docs/programs/** and docs/evidence/** (except evidence decks,
// *.opf.json, which the ecosystem geometry checks load). Everything else runs in full: every other path,
// every push to main, every manual run, and any case this script cannot classify. `Verify OPF packages`
// (opf-ci.yml) runs `pnpm test` on every change, including these paths, so the program report, font
// tracker and audit tests under docs/programs still gate.
//
// Usage (inside the opf checkout of a pull_request merge commit):
//   node scripts/ecosystem-scope.mjs            # prints the decision, writes run=true|false to $GITHUB_OUTPUT
//   node scripts/ecosystem-scope.mjs --files a b # classifies the given paths instead (local check)
import { execFileSync } from "node:child_process";
import { appendFileSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

/** True when no ecosystem check reads `file`, so a change to it cannot change their result. */
export function isEcosystemIndependent(file) {
  if (file.startsWith("docs/programs/")) return true;
  if (file.startsWith("docs/evidence/")) return !file.endsWith(".opf.json");
  return false;
}

/** The ecosystem checks run unless the change is non-empty and every path is independent of them. */
export function ecosystemScope(files) {
  if (files.length === 0) return { run: true, reason: "no changed paths could be listed" };
  const relevant = files.filter((file) => !isEcosystemIndependent(file));
  if (relevant.length > 0) return { run: true, reason: `${relevant.length} of ${files.length} changed paths can affect the ecosystem`, relevant };
  return { run: false, reason: `all ${files.length} changed paths are under docs/programs or docs/evidence (no evidence decks)` };
}

function changedFiles() {
  // A pull_request checkout is the merge commit of the head into the base: its first parent is the base.
  // --no-renames lists both sides of a rename, so moving a script into docs/evidence is not docs-only.
  const out = execFileSync("git", ["diff", "--name-only", "--no-renames", "HEAD^1", "HEAD"], { encoding: "utf8" });
  return out.split("\n").map((line) => line.trim()).filter(Boolean);
}

/**
 * The decision for one workflow event. Only a pull_request can skip: its checkout is a merge commit whose first parent
 * is the base, so the changed paths are known. Every other event runs in full, including `merge_group` (RR-48): a
 * merge queue run has no pull_request payload and is the last gate before main, so the queue always tests the whole
 * coordinated ecosystem (ci-cd.md, tier T2).
 */
export function scopeForEvent(event, listChangedFiles) {
  if (event !== "pull_request") return { run: true, reason: `${event} runs always run the ecosystem checks` };
  try {
    return ecosystemScope(listChangedFiles());
  } catch (error) {
    return { run: true, reason: `could not list the changed paths (${error.message.split("\n")[0]})` };
  }
}

/**
 * RR-53, consumer-driven contracts (ci-cd.md, section 3): which depth of the sibling suites the ecosystem shards run.
 *   contract  each sibling's `npm run test:contract` (the part of its suite that exercises core's APIs): pull requests only.
 *   full      each sibling's whole `npm test`: everything else. merge_group, push to main, the nightly schedule, manual runs
 *             and any case this function cannot classify. A docs-only or contract-only change never lowers a non-PR run.
 * A pull request is also `full` when it can change what the contract tier trusts: the ecosystem lock, the roller's branches
 * (ecosystem-roll/*), the tiering machinery itself, or when it carries the label `ecosystem-full` (the opt-in for a change
 * the author knows reaches past the contract).
 */
export const FULL_TIER_PATHS = new Set([
  "ecosystem.lock.json",
  ".github/workflows/ecosystem-ci.yml",
  ".github/actions/ecosystem-refs/action.yml",
  "scripts/ecosystem-scope.mjs",
  "scripts/package-ecosystem-plan.mjs",
  "scripts/test-package-ecosystem.mjs",
]);

export function tierForEvent(event, { listChangedFiles = () => [], headRef = "", labels = [] } = {}) {
  if (event !== "pull_request") return { tier: "full", reason: `${event} runs always run the full sibling suites` };
  if (headRef.startsWith("ecosystem-roll/")) return { tier: "full", reason: "the roller's branch (ecosystem-roll/*) must pass the full suites" };
  if (labels.includes("ecosystem-full")) return { tier: "full", reason: "the pull request carries the label ecosystem-full" };
  let files;
  try {
    files = listChangedFiles();
  } catch (error) {
    return { tier: "full", reason: `could not list the changed paths (${error.message.split("\n")[0]})` };
  }
  if (files.length === 0) return { tier: "full", reason: "no changed paths could be listed" };
  const sensitive = files.filter((file) => FULL_TIER_PATHS.has(file));
  if (sensitive.length > 0) return { tier: "full", reason: `the change touches ${sensitive.join(", ")}`, sensitive };
  return { tier: "contract", reason: "a pull request runs the siblings' contract suites; merge_group, main and the nightly run run the full suites" };
}

/**
 * RR-45 (opf#368, item 3): whether a run executes the registry checks of the `ecosystem-core (registry)` shard, the ones
 * that test what is already published on npm (layout contracts, the registry browser harness and its guards, the JSON
 * editor, the registry fidelity fixtures and the registry CLI). They read the published packages, the release plan, the
 * lock, the golden fixtures and the scripts and tooling that run them, never core's or the CLI's own sources. So a pull
 * request skips them when every changed path is one they cannot read: core and CLI sources and tests (not the packed CLI
 * test), schemas and catalogs, docs (not evidence decks), skills, changelog fragments and the other workflows. Anything
 * else runs them (every script, package.json, the lockfile, release-plan.json, ecosystem.lock.json, scripts/fixtures, this
 * workflow), and so does every non-PR event (push to main, merge_group, the nightly run, manual runs: the hard gate), a
 * pull request with the label `ecosystem-full`, and any case this cannot classify. The registry consumer install and the
 * current-checkout measurements that use it run on every change regardless.
 */
const REGISTRY_INDEPENDENT = [
  /^packages\/javascript\/(src|test|scripts)\//,
  /^packages\/cli\/src\//,
  /^packages\/cli\/test\/(?!packed\.mjs$)/,
  /^spec\//,
  /^skills\//,
  /^changes\//,
  /^docs\/(?!evidence\/.*\.opf\.json$)/,
  /^\.github\/workflows\/(?!ecosystem-ci\.yml$)[^/]+$/,
  /^[^/]+\.md$/,
];
export const isRegistryIndependent = (file) => REGISTRY_INDEPENDENT.some((pattern) => pattern.test(file));

export function registryForEvent(event, { listChangedFiles = () => [], labels = [] } = {}) {
  if (event !== "pull_request") return { registry: true, reason: `${event} runs always run the registry checks` };
  if (labels.includes("ecosystem-full")) return { registry: true, reason: "the pull request carries the label ecosystem-full" };
  let files;
  try {
    files = listChangedFiles();
  } catch (error) {
    return { registry: true, reason: `could not list the changed paths (${error.message.split("\n")[0]})` };
  }
  if (files.length === 0) return { registry: true, reason: "no changed paths could be listed" };
  const relevant = files.filter((file) => !isRegistryIndependent(file));
  if (relevant.length > 0) return { registry: true, reason: `${relevant.length} of ${files.length} changed paths can affect them (${relevant.slice(0, 3).join(", ")}${relevant.length > 3 ? ", ..." : ""})`, relevant };
  return { registry: false, reason: `none of the ${files.length} changed paths is read by them (core or CLI sources, schemas, docs); main, the merge queue and the nightly run run them` };
}

function pullRequestLabels() {
  try {
    return (JSON.parse(readFileSync(process.env.GITHUB_EVENT_PATH, "utf8")).pull_request?.labels ?? []).map((label) => label.name);
  } catch {
    return [];
  }
}

function main(argv) {
  const event = process.env.GITHUB_EVENT_NAME ?? "local";
  const decision = argv[0] === "--files" ? ecosystemScope(argv.slice(1)) : scopeForEvent(event, changedFiles);
  const line = `Ecosystem checks: ${decision.run ? "run" : "skipped"} (${decision.reason}).`;
  console.log(line);
  const tier = argv[0] === "--files" ? tierForEvent("pull_request", { listChangedFiles: () => argv.slice(1) }) : tierForEvent(event, { listChangedFiles: changedFiles, headRef: process.env.GITHUB_HEAD_REF ?? "", labels: pullRequestLabels() });
  console.log(`Sibling suites: ${tier.tier} (${tier.reason}).`);
  if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `tier=${tier.tier}\n`);
  const registry = argv[0] === "--files" ? registryForEvent("pull_request", { listChangedFiles: () => argv.slice(1) }) : registryForEvent(event, { listChangedFiles: changedFiles, labels: pullRequestLabels() });
  console.log(`Registry checks: ${registry.registry ? "run" : "skipped"} (${registry.reason}).`);
  if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `registry=${registry.registry}\n`);
  if (process.env.GITHUB_STEP_SUMMARY && decision.run) appendFileSync(process.env.GITHUB_STEP_SUMMARY, `Registry checks: **${registry.registry ? "run" : "skipped"}** (${registry.reason}).\n`);
  if (process.env.GITHUB_STEP_SUMMARY && decision.run) appendFileSync(process.env.GITHUB_STEP_SUMMARY, `Sibling suites: **${tier.tier}** (${tier.reason}).\n`);
  if (decision.relevant) console.log(decision.relevant.slice(0, 20).join("\n"));
  if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `run=${decision.run}\n`);
  if (process.env.GITHUB_STEP_SUMMARY && !decision.run) {
    appendFileSync(
      process.env.GITHUB_STEP_SUMMARY,
      `${line} The job reports success without running them; \`Verify OPF packages\` still runs \`pnpm test\`, and the push to main after merge runs them in full.\n`,
    );
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) main(process.argv.slice(2));
