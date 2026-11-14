#!/usr/bin/env node
// opf#1319: the planned minutes of every leg ci.yml would run for a change, from the scope (scripts/ci-scope.mjs) and the measured
// weights (scripts/ci-test-weights.json). It is the arithmetic behind LEG_PLAN's shard counts, for a person deciding them; CI does
// not run it (the scope job has no install and no package sources).
//
//   node scripts/ci-leg-minutes.mjs --files packages/javascript/src/index.ts       # the legs of a core-only change
//   node scripts/ci-leg-minutes.mjs --event push                                   # everything (a push to main)
//   node scripts/ci-leg-minutes.mjs --files packages/pptx/src/x.ts --json          # as JSON
//
// A sharded leg (render, pptx and editor `tests`, the editor's `playground` and `browser`) is LEG_FIXED_SECONDS (container, checkout,
// install, the builds of the dependencies, measured at 60 to 90 s) plus the weights of the tests the shard runs (the same partition
// the shard computes) plus, on `tests 1/n`, PACKAGE_SHARD_ONE_OVERHEAD (its extra checks). Every other leg is the minutes it took in
// the measured run (UNSHARDED_MINUTES), which the weights do not describe.
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadGraph, scope } from "./ci-scope.mjs";
import { DEFAULT_WEIGHT, PACKAGE_SHARD_ONE_OVERHEAD, planPackageShard, plannedSeconds } from "./ci-test-shards.mjs";
import { plannedSuiteSeconds, shardTests, suiteWeights } from "./quarantine.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
/** Seconds every sharded leg spends before its tests (job setup, container, checkout, install, builds): 59 to 97 s in run 43550563504. */
export const LEG_FIXED_SECONDS = 70;
/**
 * Minutes of the legs the weights do not plan, as run 43550563504 (push to main at 280f07a76, every package at full) measured them.
 * `lint (docs)` is the estimate of docs/programs/monorepo/ci-design.md.
 */
export const UNSHARDED_MINUTES = Object.freeze({
  "lint (static)": 1.6,
  "lint (checks 1/2)": 5.8,
  "lint (checks 2/2)": 3.8,
  "lint (docs)": 2.3,
  audit: 0.5,
  gallery: 1.0,
  core: 7.8,
  cli: 8.5,
  "mcp (tests)": 4.0,
  "mcp (browser)": 3.7,
  mcp: 4.0,
  "render (browser)": 4.8,
  "pptx (browser)": 2.4,
  integration: 4.3,
  goldens: 1.7,
  "gallery-gates": 1.2,
  "pack-shape": 0.9,
});

const memo = new Map();
/** Planned seconds of the tests of one leg (null for a leg the weights do not plan). */
export function legTestSeconds(leg) {
  const key = `${leg.job}:${leg.kind}:${leg.tier}:${leg.index}/${leg.count}`;
  if (memo.has(key)) return memo.get(key);
  let seconds = null;
  if (leg.kind === "tests" && ["render", "pptx", "editor"].includes(leg.job)) {
    const { weights, commands } = planPackageShard({ id: leg.job, scriptName: leg.tier === "full" ? "test" : "test:contract", shard: { index: leg.index, count: leg.count } });
    seconds = plannedSeconds(commands, weights) + (leg.index === 1 ? PACKAGE_SHARD_ONE_OVERHEAD : 0);
  } else if (leg.job === "editor" && (leg.kind === "browser" || leg.kind === "playground")) {
    const suites = JSON.parse(readFileSync(path.join(root, "packages/editor/test/browser-suites.json"), "utf8")).suites;
    const weights = suiteWeights("editor", leg.kind);
    seconds = plannedSuiteSeconds(shardTests(suites[leg.kind].tests, { index: leg.index, count: leg.count }, weights), weights);
  }
  memo.set(key, seconds);
  return seconds;
}

/** Planned minutes of one leg of the matrix, and where the number comes from. */
export function legMinutes(leg) {
  const tests = legTestSeconds(leg);
  if (tests !== null) return { minutes: (LEG_FIXED_SECONDS + tests) / 60, source: "weights" };
  const minutes = UNSHARDED_MINUTES[leg.name];
  return minutes === undefined ? { minutes: null, source: "unmeasured" } : { minutes, source: "measured" };
}

/** The legs of a decision with their minutes, the longest leg (the wall clock of `check`) and the runner minutes. */
export function planDecision(decision) {
  const legs = decision.legs.map((leg) => ({ name: leg.name, tier: leg.tier, ...legMinutes(leg) }));
  const known = legs.filter((leg) => leg.minutes !== null);
  return {
    legs,
    longest: known.reduce((best, leg) => (leg.minutes > (best?.minutes ?? -1) ? leg : best), null),
    runnerMinutes: known.reduce((sum, leg) => sum + leg.minutes, 0),
  };
}

function main(argv) {
  const files = [];
  let event = "pull_request";
  const labels = [];
  for (let index = 0; index < argv.length; index++) {
    if (argv[index] === "--files") while (index + 1 < argv.length && !argv[index + 1].startsWith("--")) files.push(argv[++index]);
    else if (argv[index] === "--event") event = argv[++index];
    else if (argv[index] === "--labels") labels.push(...argv[++index].split(","));
    else if (argv[index] !== "--json") throw new Error(`unknown argument ${argv[index]}`);
  }
  const decision = scope({ files, graph: loadGraph(root).graph, event, labels });
  const plan = planDecision(decision);
  if (argv.includes("--json")) {
    console.log(JSON.stringify({ tier: decision.tier, forced: decision.forced, ...plan }, null, 2));
    return 0;
  }
  console.log(`class ${decision.tier}${decision.forced ? " (forced)" : ""}: ${plan.legs.length} legs, ${plan.runnerMinutes.toFixed(0)} runner minutes, longest ${plan.longest?.name} ${plan.longest?.minutes.toFixed(1)} min (default weight ${DEFAULT_WEIGHT} s per unmeasured test)`);
  for (const leg of plan.legs) console.log(`  ${leg.name.padEnd(28)} ${leg.tier.padEnd(8)} ${leg.minutes === null ? "  ?  " : leg.minutes.toFixed(1).padStart(5)} min  ${leg.source}`);
  return 0;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    process.exit(main(process.argv.slice(2)));
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }
}
