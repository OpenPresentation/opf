#!/usr/bin/env node
// RR-47: flake measurement. Runs the browser suites in test/browser-suites.json several times on the same checkout and records
// a pass rate per test. It measures; it does not gate: test failures are reported (job summary, annotations, JSON) and the
// exit code stays 0. A suite whose setup fails cannot be measured and fails the job.
//
//   node scripts/flake-repeat.mjs [--suite <name>]... [--repeat 5] [--out artifacts/flake-repeat] [--timeout-min 15]
//                                 [--suites test/browser-suites.json]
//   node scripts/flake-repeat.mjs --playwright-json <report.json> [--out ...]   (a Playwright --repeat-each JSON report)
//
// The result is `<out>/flake-repeat.json` and a markdown table in $GITHUB_STEP_SUMMARY. No dependencies, no network.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DEFAULT_SUITES, listTests, playwrightId, readJson, runArgv, splitCommand, summary } from './quarantine.mjs';

const median = (values) => {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
};
const rate = (passes, runs) => (runs ? passes / runs : 0);
const percent = (value) => `${Math.round(value * 1000) / 10}%`;

/** Fold per-run records ({ id, suite, ok, ms, tail? }) into one row per test. */
export function aggregate(runs) {
  const rows = new Map();
  for (const run of runs) {
    const row = rows.get(run.id) ?? { id: run.id, suite: run.suite, runs: 0, passes: 0, failures: [], times: [] };
    row.runs += 1;
    row.times.push(run.ms);
    if (run.ok) row.passes += 1;
    else row.failures.push({ rep: run.rep, code: run.code, tail: run.tail ?? [] });
    rows.set(run.id, row);
  }
  return [...rows.values()].map(({ times, ...row }) => ({ ...row, passRate: rate(row.passes, row.runs), medianSeconds: Math.round(median(times)) / 1000 }));
}

export function render(report) {
  const lines = [`### Flake measurement: ${report.repeat} runs per test`, '', `Commit \`${report.commit ?? 'unknown'}\`, ${report.runner}, ${report.startedAt}.`, ''];
  const unstable = report.tests.filter((row) => row.passes < row.runs);
  lines.push(unstable.length ? `**${unstable.length} of ${report.tests.length} tests failed at least once.**` : `All ${report.tests.length} tests passed every run.`, '');
  lines.push('| Suite | Test | Runs | Passed | Pass rate | Median s |', '|---|---|---|---|---|---|');
  for (const row of [...report.tests].sort((a, b) => a.passRate - b.passRate || a.id.localeCompare(b.id))) {
    lines.push(`| ${row.suite} | \`${row.id}\` | ${row.runs} | ${row.passes} | ${percent(row.passRate)} | ${row.medianSeconds} |`);
  }
  for (const row of unstable) {
    lines.push('', `<details><summary>\`${row.id}\` failures (${row.failures.length})</summary>`, '');
    for (const failure of row.failures.slice(0, 3)) lines.push(`Run ${failure.rep}, exit ${failure.code}:`, '```', ...failure.tail.slice(-25), '```');
    lines.push('</details>');
  }
  return lines.join('\n');
}

/** Per-test pass rates from a Playwright JSON report made with --repeat-each (the id is the spec file name and the title path, as Playwright's --grep sees it). */
export function fromPlaywrightJson(report) {
  const runs = [];
  const visit = (suite, titles) => {
    const here = suite.title && !/\.(spec|test)\.[jt]sx?$/.test(suite.title) ? [...titles, suite.title] : titles;
    for (const spec of suite.specs ?? []) {
      const id = playwrightId(spec.file ?? suite.file ?? '', [...here, spec.title]);
      for (const test of spec.tests ?? []) {
        (test.results ?? []).forEach((result, index) => {
          runs.push({ id, suite: test.projectName || 'playwright', rep: index + 1, ok: result.status === 'passed', code: result.status, ms: result.duration ?? 0, tail: result.error?.message ? String(result.error.message).split('\n').slice(0, 12) : [] });
        });
      }
    }
    for (const child of suite.suites ?? []) visit(child, here);
  };
  for (const suite of report.suites ?? []) visit(suite, []);
  return runs;
}

function parseOptions(argv) {
  const options = { suite: [] };
  for (let index = 0; index < argv.length; index++) {
    const arg = argv[index];
    if (!arg.startsWith('--')) throw new Error(`Unexpected argument ${arg}`);
    const key = arg.slice(2);
    const value = argv[++index];
    if (key === 'suite') options.suite.push(value); else options[key] = value;
  }
  return options;
}

export async function main(argv) {
  const options = parseOptions(argv);
  const out = path.resolve(options.out ?? 'artifacts/flake-repeat');
  const repeat = Number(options.repeat ?? 5);
  if (!Number.isInteger(repeat) || repeat < 1) throw new Error('--repeat must be a positive integer.');
  const meta = { schema: 1, repeat, startedAt: new Date().toISOString(), commit: process.env.GITHUB_SHA?.slice(0, 12), runner: `${process.env.RUNNER_OS ?? process.platform} node ${process.version}` };
  const runs = [];
  let setupFailed = false;
  if (options['playwright-json']) {
    runs.push(...fromPlaywrightJson(JSON.parse(readFileSync(options['playwright-json'], 'utf8'))));
    meta.repeat = Math.max(...runs.map((run) => run.rep), 0);
  } else {
    const suitesData = readJson(options.suites ?? DEFAULT_SUITES, 'Suites file');
    const tests = listTests(suitesData);
    const names = options.suite.length ? options.suite : Object.keys(suitesData.suites);
    const timeoutMs = Number(options['timeout-min'] ?? 15) * 60_000;
    for (const name of names) {
      const definition = suitesData.suites[name];
      if (!definition) throw new Error(`No suite "${name}".`);
      for (const command of definition.setup ?? []) {
        console.log(`\n> ${name} setup: ${command}`);
        const { code } = await runArgv(splitCommand(command));
        if (code !== 0) { setupFailed = true; console.error(`::error title=Flake measurement::Setup of suite ${name} failed (${command}); it cannot be measured.`); break; }
      }
      if (setupFailed) break;
      for (let rep = 1; rep <= repeat; rep++) {
        for (const test of tests.filter((candidate) => candidate.suite === name)) {
          console.log(`\n> ${test.id} (run ${rep} of ${repeat}): ${test.command}`);
          const started = Date.now();
          const { code, tail } = await runArgv(splitCommand(test.command), { timeoutMs });
          runs.push({ id: test.id, suite: name, rep, ok: code === 0, code, ms: Date.now() - started, tail: code === 0 ? [] : tail });
        }
      }
    }
  }
  const report = { ...meta, tests: aggregate(runs) };
  mkdirSync(out, { recursive: true });
  writeFileSync(path.join(out, 'flake-repeat.json'), `${JSON.stringify(report, null, 2)}\n`);
  writeFileSync(path.join(out, 'flake-repeat.md'), `${render(report)}\n`);
  console.log(`\n${render(report)}`);
  summary(render(report));
  for (const row of report.tests.filter((candidate) => candidate.passes < candidate.runs)) {
    console.log(`::warning title=Flaky test::${row.id} passed ${row.passes} of ${row.runs} runs (${percent(row.passRate)}).`);
  }
  return setupFailed ? 1 : 0;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main(process.argv.slice(2)).then((code) => { process.exitCode = code; }, (error) => { console.error(error.message); process.exitCode = 2; });
}
