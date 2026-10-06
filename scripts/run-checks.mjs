#!/usr/bin/env node
// RR-46: runs the repository-level checks of `pnpm test` without a list in package.json. A root script is a check of
// `pnpm test` when its name starts with `check:` (or is named in `include`), unless scripts/checks.json lists it in
// `exclude`. Adding a check:* script therefore touches only its own line.
// RR-45 (opf#368, item 5): the checks are independent read-only checks, so they run on a bounded pool (OPF_CHECKS_JOBS,
// default min(4, available parallelism); 1 runs them one at a time). Each check's output goes to its own log,
// artifacts/checks/<name>.log; a passing check prints one line, a failing check prints its whole log at the end, in name
// order, so failure output stays readable. Every check runs (no check is skipped after a failure) and any failure fails.
//   node scripts/run-checks.mjs           run the checks
//   node scripts/run-checks.mjs --list    print the commands, one per line, and run nothing
import { spawn } from 'node:child_process';
import { createWriteStream, mkdirSync, readFileSync, realpathSync } from 'node:fs';
import { availableParallelism } from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

// scripts: the root package.json "scripts" object; config: scripts/checks.json. Returns the script names to run.
export function selectChecks(scripts, config) {
  const { exclude = [], include = [] } = config;
  for (const [key, names] of Object.entries({ exclude, include })) {
    if (new Set(names).size !== names.length) throw new Error(`scripts/checks.json ${key} lists a script twice`);
    for (const name of names) if (!(name in scripts)) throw new Error(`scripts/checks.json ${key} names ${name}, which is not a root script`);
  }
  for (const name of exclude) {
    if (!name.startsWith('check:')) throw new Error(`scripts/checks.json exclude names ${name}, which is not a check: script`);
  }
  for (const name of include) {
    if (name.startsWith('check:')) throw new Error(`scripts/checks.json include names ${name}; check: scripts run without being listed`);
  }
  return Object.keys(scripts)
    .filter((name) => (name.startsWith('check:') && !exclude.includes(name)) || include.includes(name))
    .sort();
}

/** How many checks run at once: OPF_CHECKS_JOBS, or min(4, available parallelism). */
export function checkJobs(env = process.env, cores = availableParallelism()) {
  if (env.OPF_CHECKS_JOBS !== undefined && env.OPF_CHECKS_JOBS !== '') {
    const jobs = Number(env.OPF_CHECKS_JOBS);
    if (!Number.isInteger(jobs) || jobs < 1) throw new Error(`OPF_CHECKS_JOBS must be a positive integer, not ${env.OPF_CHECKS_JOBS}`);
    return jobs;
  }
  return Math.max(1, Math.min(4, cores));
}

/**
 * Run `names` on a pool of `jobs` workers. `start(name)` returns a promise of {status, log}. Resolves to the results in
 * name order: {name, status, log, seconds}. Never stops early: every check runs.
 */
export async function runPool(names, jobs, start, report = () => {}) {
  const results = new Array(names.length);
  let next = 0;
  const worker = async () => {
    for (let index = next++; index < names.length; index = next++) {
      const started = Date.now();
      const outcome = await start(names[index]);
      results[index] = { name: names[index], ...outcome, seconds: (Date.now() - started) / 1000 };
      report(results[index]);
    }
  };
  await Promise.all(Array.from({ length: Math.min(jobs, names.length) }, worker));
  return results;
}

function startCheck(root, logs, name) {
  const log = path.join(logs, `${name.replace(/[^A-Za-z0-9._-]/g, '_')}.log`);
  return new Promise((resolve) => {
    const out = createWriteStream(log);
    const child = spawn('pnpm', ['run', name], { cwd: root, stdio: ['ignore', 'pipe', 'pipe'], shell: process.platform === 'win32' });
    child.stdout.pipe(out, { end: false });
    child.stderr.pipe(out, { end: false });
    let settled = false;
    const finish = (status) => {
      if (settled) return;
      settled = true;
      out.end(() => resolve({ status, log }));
    };
    child.on('error', (error) => { out.write(`\nrun-checks: could not start pnpm run ${name}: ${error.message}\n`); finish(1); });
    child.on('close', (code, signal) => finish(code ?? signal ?? 1));
  });
}

async function main(argv) {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  const scripts = JSON.parse(readFileSync(path.join(root, 'package.json'), 'utf8')).scripts;
  const config = JSON.parse(readFileSync(path.join(root, 'scripts', 'checks.json'), 'utf8'));
  const names = selectChecks(scripts, config);
  if (argv.includes('--list')) {
    console.log(names.map((name) => `pnpm run ${name}`).join('\n'));
    return 0;
  }
  const jobs = checkJobs();
  const logs = path.join(root, 'artifacts', 'checks');
  mkdirSync(logs, { recursive: true });
  console.log(`run-checks: ${names.length} checks, ${jobs} at a time; logs in ${path.relative(root, logs)}`);
  let done = 0;
  const results = await runPool(names, jobs, (name) => startCheck(root, logs, name), (result) => {
    done += 1;
    console.log(`[${done}/${names.length}] pnpm run ${result.name}: ${result.status === 0 ? 'passed' : `FAILED (exit ${result.status})`} in ${result.seconds.toFixed(1)} s`);
  });
  const failed = results.filter((result) => result.status !== 0);
  for (const result of failed) {
    console.error(`\n::group::run-checks: ${result.name} failed (exit ${result.status}); its output (${path.relative(root, result.log)}):`);
    console.error(readFileSync(result.log, 'utf8'));
    console.error('::endgroup::');
  }
  if (failed.length) {
    console.error(`run-checks: ${failed.length} of ${names.length} checks failed: ${failed.map((result) => result.name).join(', ')}`);
    return 1;
  }
  console.log(`run-checks: ${names.length} checks passed`);
  return 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(realpathSync(process.argv[1])).href) {
  main(process.argv.slice(2)).then((code) => { process.exitCode = code; }, (error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
