#!/usr/bin/env node
// opf#1319: regenerate scripts/ci-test-weights.json (the seconds per test that balance the CI shards) from the job logs of one
// full ci.yml run, and compare what the shards planned with what they measured.
//
//   gh api repos/OpenPresentation/opf/actions/runs/<run id>/logs > logs.zip    # one API call: every job log of the run
//   unzip logs.zip -d logs
//   node scripts/ci-test-weights.mjs --logs logs --run <run id>               # print measured against the committed weights
//   node scripts/ci-test-weights.mjs --logs logs --run <run id> --write       # and rewrite scripts/ci-test-weights.json
//
// Use a run where every package ran at the `full` tier (a push to main, or a pull request with the label full-ci) and every leg
// passed: every table the logs measured is replaced (a deleted or renamed test leaves it; a test the run did not reach drops to the
// planner's default), and a table they did not measure is kept. To see what the weights plan per leg: scripts/ci-leg-minutes.mjs.
//
// What it reads, per job log (the `<n>_<job name>.txt` files at the top of the archive; every line starts with a timestamp):
//   - the `node scripts/ci-test-shards.mjs --package <id>` step: a test starts at its `+ node ... test/<file>` line and ends at the
//     next `+ ` line (the next command of the shard) or at the end of the step; the weight is keyed by the file name, under the
//     package's key (`opf-render`, `opf-pptx`, `opf-editor`, as scripts/ci-test-shards.mjs reads them);
//   - the `quarantine.mjs run-suite <suite>` steps of the browser legs: a test starts at its `> <id>: <command>` line and ends at
//     the next `> ` line or at the end of the step; the weight is keyed by the test id under `browser-suites` / package / suite
//     (scripts/quarantine.mjs balances `--shard i/n` with them).
// A test that ran in several jobs (a full and a contract shard) keeps the longest time.
//
// Staleness: scripts/ci-test-shards.mjs and scripts/quarantine.mjs print, at the end of every shard, the seconds the weights
// planned and the seconds the shard measured, and warn (a GitHub annotation, never a failure) when they drift apart by more than
// half and two minutes; the warning names this script.
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
export const WEIGHTS_FILE = path.join(root, "scripts", "ci-test-weights.json");
/** The package id of a ci-test-shards step and the key of its weights (scripts/ci-test-shards.mjs SHARDED_PACKAGES). */
export const TEST_KEYS = Object.freeze({ render: "opf-render", pptx: "opf-pptx", editor: "opf-editor" });

const STAMP = /^(\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d+)?Z) ?(.*)$/;
const STEP = /^##\[group\]Run (.*)$/;
const SHARDS_STEP = /ci-test-shards\.mjs --package (\w+)/;
// Only a sharded suite step (`run-suite <suite> --shard i/n`, the editor's legs): a step that runs several suites one after the
// other (the renderer's browser leg) is not sharded and cannot be told apart by its header.
const SUITE_STEP = /quarantine\.mjs run-suite (\S+) --shard/;
const round = (seconds) => Math.max(0.1, Math.round(seconds * 10) / 10);

/** Drift beyond which a shard warns that its weights are stale: more than half the plan and more than two minutes. */
export const DRIFT = Object.freeze({ ratio: 0.5, seconds: 120 });

/**
 * The line a shard prints at its end (planned against measured seconds), and a GitHub warning annotation when the two drift
 * apart by more than DRIFT. Never a failure: a stale weight only unbalances the shards.
 */
export function driftReport(label, planned, measured) {
  const lines = [`${label}: planned ${Math.round(planned)} s of tests from scripts/ci-test-weights.json, measured ${Math.round(measured)} s`];
  if (Math.abs(measured - planned) > Math.max(DRIFT.seconds, planned * DRIFT.ratio)) {
    lines.push(`::warning title=Stale CI test weights::${label} planned ${Math.round(planned)} s and took ${Math.round(measured)} s. Regenerate scripts/ci-test-weights.json from a full run with node scripts/ci-test-weights.mjs (see its header).`);
  }
  return lines;
}

/**
 * The measured tests of one job log: [{ kind: "tests", package, file, seconds } | { kind: "suite", package, suite, id, seconds }].
 * `job` is the job name (`editor (browser 3/3)`); its first word is the package of a browser leg.
 */
export function parseJobLog(text, job) {
  const lines = text.split(/\r?\n/).map((line) => STAMP.exec(line)).filter(Boolean).map((match) => ({ at: Date.parse(match[1]), text: match[2] }));
  const results = [];
  let step = null;
  let open = null;
  const close = (at) => {
    if (open?.name) results.push({ ...open.name, seconds: round((at - open.at) / 1000) });
    open = null;
  };
  for (const line of lines) {
    const header = STEP.exec(line.text);
    if (header || line.text.startsWith("Post job cleanup") || line.text.startsWith("##[error]")) {
      close(line.at);
      if (!header) {
        step = null;
        continue;
      }
      const shards = SHARDS_STEP.exec(header[1]);
      const suite = SUITE_STEP.exec(header[1]);
      step = shards ? { kind: "tests", package: shards[1] } : suite ? { kind: "suite", package: job.split(/\s/)[0], suite: suite[1] } : null;
      continue;
    }
    if (!step) continue;
    if (step.kind === "tests" && line.text.startsWith("+ ")) {
      close(line.at);
      const words = line.text.slice(2).trim().split(/\s+/);
      const file = words[0] === "node" ? words.findLast((word) => /^test\/[^/]+\.m?js$/.test(word)) : undefined;
      open = { at: line.at, name: file ? { kind: "tests", package: step.package, file: path.posix.basename(file) } : null };
    } else if (step.kind === "suite" && line.text.startsWith("> ")) {
      const marker = /^> ([^\s:]+:[^\s:]+): /.exec(line.text);
      const setup = line.text.startsWith("> setup: ");
      if (!marker && !setup) continue;
      close(line.at);
      open = { at: line.at, name: marker ? { kind: "suite", package: step.package, suite: step.suite, id: marker[1] } : null };
    }
  }
  close(lines.at(-1)?.at ?? 0);
  return results;
}

/** The job name of a log file in a run's log archive: `19_pptx (tests 4_4).txt` is `pptx (tests 4/4)`. */
export const jobOfFile = (file) => path.basename(file, ".txt").replace(/^\d+_/, "").replace(/(\d+)_(\d+)\)$/, "$1/$2)");

/** Every measurement of a directory of job logs (only its top-level `*.txt` files). */
export function measureLogs(directory) {
  const results = [];
  for (const file of readdirSync(directory).filter((name) => name.endsWith(".txt")).sort()) {
    results.push(...parseJobLog(readFileSync(path.join(directory, file), "utf8"), jobOfFile(file)));
  }
  return results;
}

/**
 * The weights file with every table the logs measured replaced by the measurements (the longest one of a test that ran in several
 * jobs wins), so a deleted or renamed test leaves; a table the logs did not measure is kept as it was. Keys sorted.
 */
export function mergeWeights(current, results, comment) {
  const measured = {};
  const table = (keys) =>
    keys.reduce((object, key) => {
      object[key] ??= {};
      return object[key];
    }, measured);
  for (const result of results) {
    const key = result.kind === "tests" ? TEST_KEYS[result.package] : null;
    if (result.kind === "tests" && !key) continue;
    const target = result.kind === "tests" ? table([key]) : table(["browser-suites", result.package, result.suite]);
    const name = result.kind === "tests" ? result.file : result.id;
    target[name] = Math.max(target[name] ?? 0, result.seconds);
  }
  const next = structuredClone(current);
  for (const [key, value] of Object.entries(measured)) {
    if (key !== "browser-suites") {
      next[key] = value;
      continue;
    }
    next["browser-suites"] ??= {};
    for (const [pkg, suites] of Object.entries(value)) next["browser-suites"][pkg] = { ...next["browser-suites"][pkg], ...suites };
  }
  const sorted = (object) => Object.fromEntries(Object.keys(object).sort().map((key) => [key, object[key] !== null && typeof object[key] === "object" ? sorted(object[key]) : object[key]]));
  const { $comment, ...rest } = next;
  return { $comment: comment ?? $comment, ...sorted(rest) };
}

function main(argv) {
  const value = (name) => (argv.includes(name) ? argv[argv.indexOf(name) + 1] : undefined);
  const directory = value("--logs");
  if (!directory) throw new Error("Usage: node scripts/ci-test-weights.mjs --logs <directory of job logs> [--run <run id>] [--write]");
  const results = measureLogs(directory);
  if (!results.length) throw new Error(`no ci-test-shards or run-suite tests found in ${directory}`);
  const current = JSON.parse(readFileSync(WEIGHTS_FILE, "utf8"));
  const run = value("--run");
  const comment = `opf#1319: seconds each test took in the Linux CI run ${run ?? "(unnamed)"} (full tier), written by scripts/ci-test-weights.mjs from the run's job logs. scripts/ci-test-shards.mjs balances the test shards of render, pptx and the editor with the opf-* tables, scripts/quarantine.mjs the browser-suite shards with browser-suites/<package>/<suite>. A missing or stale entry only unbalances the shards (each shard warns when it drifts); every listed test still runs exactly once.`;
  const next = mergeWeights(current, results, comment);
  const total = (object) => Object.values(object ?? {}).reduce((sum, seconds) => sum + seconds, 0);
  for (const key of Object.values(TEST_KEYS)) console.log(`${key}: ${Object.keys(next[key] ?? {}).length} tests, ${Math.round(total(current[key]))} s before, ${Math.round(total(next[key]))} s now`);
  for (const [pkg, suites] of Object.entries(next["browser-suites"] ?? {})) {
    for (const [suite, table] of Object.entries(suites)) console.log(`browser-suites ${pkg} ${suite}: ${Object.keys(table).length} tests, ${Math.round(total(table))} s`);
  }
  if (argv.includes("--write")) {
    writeFileSync(WEIGHTS_FILE, `${JSON.stringify(next, null, 1)}\n`);
    console.log(`wrote ${path.relative(root, WEIGHTS_FILE)}`);
  }
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
