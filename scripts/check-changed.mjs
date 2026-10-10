#!/usr/bin/env node
// RR-57: `pnpm check:changed` checks what this branch changed, instead of the whole `pnpm test`. For an agent: run it
// after each change, leave the full `pnpm test` to CI and the last run before a pull request.
//   1. install   pnpm install --frozen-lockfile --prefer-offline when node_modules is missing or older than the lockfile
//   2. biome     `biome check` on the changed files Biome handles (what `pnpm lint` runs in CI, on those files only)
//   3. checks    the check:* scripts that scripts/checks.json "changed" maps the changed paths to, plus the check:*
//                script whose command names a changed file (a script, its test, ...)
//   4. typecheck `pnpm typecheck` when a .ts, .mts, .cts or tsconfig file changed
//   5. tests     the tests of each changed package (packages/javascript, packages/cli): only the changed test files
//                when nothing but tests changed, the whole package otherwise
// Changed files are the committed difference to the merge base with origin/main, plus uncommitted and untracked files.
// The typecheck and the package tests run through scripts/agent-slot.mjs (at most OPF_AGENT_SLOTS = 3 at once on the
// machine). Every step runs; a table of statuses and timings is printed at the end; the exit code is 1 when a step fails.
//   node scripts/check-changed.mjs                 run
//   node scripts/check-changed.mjs --plan          print the steps and run nothing
//   node scripts/check-changed.mjs --base <ref>   measure from the merge base with <ref> instead of origin/main
//   node scripts/check-changed.mjs --files a b     use these files instead of the git difference
import { spawn, spawnSync } from 'node:child_process';
import { createWriteStream, existsSync, mkdirSync, readFileSync, readdirSync, realpathSync, statSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { spawnSpec } from './package-manager.mjs';
import { checkJobs, selectChecks } from './run-checks.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const BIOME_EXTENSIONS = new Set(['.js', '.mjs', '.cjs', '.jsx', '.ts', '.mts', '.cts', '.tsx', '.json', '.jsonc', '.css']);
const TYPESCRIPT = /\.(ts|mts|cts)$|(^|\/)tsconfig[^/]*\.json$/;
const PACKAGES = [
  { id: 'opf', dir: 'packages/javascript', filter: '@openpresentation/opf' },
  { id: 'cli', dir: 'packages/cli', filter: '@openpresentation/cli' },
];
const BROWSER = /(^|-)browser(-|\.)/;

/** Split NUL-separated `git` output into paths with `/` separators. */
export function splitPaths(output) {
  return output.split('\0').filter(Boolean).map((file) => file.split(path.sep).join('/'));
}

function git(args) {
  const result = spawnSync('git', ['-c', 'core.quotepath=off', ...args], { cwd: root, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  return result.status === 0 ? result.stdout : null;
}

/** The changed files (sorted, unique, repository-relative) and the base they are measured from. */
export function changedFiles(ref) {
  let base = null;
  for (const candidate of ref ? [ref] : ['origin/main', 'main']) {
    const mergeBase = git(['merge-base', candidate, 'HEAD']);
    if (mergeBase) {
      base = mergeBase.trim();
      break;
    }
  }
  const committed = splitPaths(git(['diff', '--name-only', '-z', base ?? 'HEAD']) ?? '');
  const untracked = splitPaths(git(['ls-files', '--others', '--exclude-standard', '-z']) ?? '');
  return { base, files: [...new Set([...committed, ...untracked])].sort() };
}

/** Does `file` match a pattern: a directory prefix ending in `/`, or an exact path. */
export function matches(file, pattern) {
  return pattern.endsWith('/') ? file.startsWith(pattern) : file === pattern;
}

/** Paths a package.json script command names, e.g. `node --test scripts/a.test.mjs && node scripts/a.mjs`. */
export function referencedPaths(command) {
  return command.split(/\s+/).filter((token) => /^[\w./-]+\.(mjs|cjs|js|json)$/.test(token) && token.includes('/'));
}

/**
 * Which check:* scripts to run for the changed files. `scripts` is the root package.json "scripts"; `config` is
 * scripts/checks.json. A script is selected by a `changed.rules` entry whose `match` fits a changed file, by
 * `changed.always`, or because its command names a changed file. A script that run-checks.mjs would not run
 * (excluded, or not a check) is still allowed in a rule: `changed` may name check:examples, which `pnpm test` skips.
 */
export function selectChangedChecks(files, scripts, config) {
  const { always = [], rules = [] } = config.changed ?? {};
  const selected = new Set(always);
  for (const rule of rules) {
    if (files.some((file) => rule.match.some((pattern) => matches(file, pattern)))) for (const name of rule.run ?? []) selected.add(name);
  }
  const changed = new Set(files);
  for (const [name, command] of Object.entries(scripts)) {
    if (name !== 'check:changed' && name.startsWith('check:') && referencedPaths(command).some((file) => changed.has(file))) selected.add(name);
  }
  selected.delete('check:changed'); // this command, not one of the checks it selects
  for (const name of selected) {
    if (!(name in scripts)) throw new Error(`scripts/checks.json changed names ${name}, which is not a root script`);
  }
  return [...selected].sort();
}

/** Package test steps: which test files to run, or the whole package. Returns null when the package is untouched. */
export function selectPackageTests(pkg, files, { suites = {}, present = [], distExists = false } = {}) {
  const inside = files.filter((file) => file.startsWith(`${pkg.dir}/`)).map((file) => file.slice(pkg.dir.length + 1));
  if (!inside.length) return null;
  const isTest = (file) => /^test\/[^/]+\.mjs$/.test(file);
  const nonTests = inside.filter((file) => !isTest(file));
  const exclude = suites.exclude ?? [];
  const tests = inside.filter(isTest).map((file) => file.slice('test/'.length));
  const helper = tests.some((name) => exclude.includes(name));
  const build = nonTests.length > 0 || !distExists;
  // The package's own README, LICENSE and docs do not need its tests; code, scripts, configuration and tests do.
  const code = nonTests.some((file) => !/^(README|LICENSE|CHANGELOG)/i.test(file));
  if (!code && !tests.length) return null;
  if (code || helper) return { ...pkg, scope: 'all', build };
  const runnable = tests.filter((name) => present.includes(name) && !BROWSER.test(name));
  if (!runnable.length) return { ...pkg, scope: 'none', build: false, skipped: tests };
  return { ...pkg, scope: 'files', files: runnable, build };
}

// The bare name: spawnSpec (scripts/package-manager.mjs) turns it into the right Windows invocation, with no shell.
const pnpm = 'pnpm';
const slot = (...command) => [process.execPath, path.join(root, 'scripts', 'agent-slot.mjs'), '--', ...command];

function packageSteps(selection) {
  const steps = [];
  const label = `tests ${selection.id}`;
  if (selection.scope === 'none') return [{ name: label, note: `no runnable test among ${selection.skipped.join(', ')}`, skip: true }];
  const commands = [];
  if (selection.scope === 'all') commands.push(slot(pnpm, '--filter', selection.filter, 'test'));
  else {
    if (selection.build) commands.push(slot(pnpm, '--filter', selection.filter, 'build'));
    const cwd = path.join(root, selection.dir);
    const batch = selection.files.filter((name) => name.endsWith('.test.mjs'));
    if (batch.length) commands.push({ cwd, argv: slot(process.execPath, '--test', ...batch.map((name) => `test/${name}`)) });
    for (const name of selection.files.filter((file) => !file.endsWith('.test.mjs'))) commands.push({ cwd, argv: slot(process.execPath, `test/${name}`) });
  }
  steps.push({ name: label, heavy: true, commands: commands.map((command) => (Array.isArray(command) ? { argv: command } : command)) });
  return steps;
}

/** The whole plan, from the changed files. `env` carries what is read from disk, so the function stays testable. */
export function buildPlan(files, env) {
  const { scripts, config, needsInstall, packages } = env;
  const plan = [];
  if (needsInstall) plan.push({ name: 'install', commands: [{ argv: [pnpm, 'install', '--frozen-lockfile', '--prefer-offline'] }] });
  const existing = files.filter((file) => env.exists(file));
  const biomeFiles = existing.filter((file) => BIOME_EXTENSIONS.has(path.extname(file).toLowerCase()));
  if (biomeFiles.length) plan.push({ name: 'biome', light: true, detail: `${biomeFiles.length} files`, biome: biomeFiles });
  else plan.push({ name: 'biome', skip: true, note: 'no changed file Biome checks' });
  const checks = selectChangedChecks(files, scripts, config);
  for (const name of checks) plan.push({ name: `pnpm run ${name}`, light: true, commands: [{ argv: [pnpm, 'run', name] }] });
  if (files.some((file) => TYPESCRIPT.test(file))) plan.push({ name: 'typecheck', heavy: true, commands: [{ argv: slot(pnpm, 'run', 'typecheck') }] });
  else plan.push({ name: 'typecheck', skip: true, note: 'no .ts, .mts or tsconfig change' });
  for (const pkg of PACKAGES) {
    const selection = selectPackageTests(pkg, files, packages[pkg.id]);
    if (selection) plan.push(...packageSteps(selection));
  }
  return plan;
}

function needsInstall() {
  const modules = path.join(root, 'node_modules');
  if (!existsSync(modules)) return true;
  const marker = existsSync(path.join(modules, '.modules.yaml')) ? path.join(modules, '.modules.yaml') : modules;
  return statSync(path.join(root, 'pnpm-lock.yaml')).mtimeMs > statSync(marker).mtimeMs;
}

function readPackages() {
  const packages = {};
  for (const pkg of PACKAGES) {
    const dir = path.join(root, pkg.dir);
    const suitesFile = path.join(dir, 'test', 'suites.json');
    packages[pkg.id] = {
      suites: existsSync(suitesFile) ? JSON.parse(readFileSync(suitesFile, 'utf8')) : {},
      present: existsSync(path.join(dir, 'test')) ? readdirSync(path.join(dir, 'test')) : [],
      distExists: existsSync(path.join(dir, 'dist')),
    };
  }
  return packages;
}

export function runCommand(argv, cwd, log) {
  return new Promise((resolve) => {
    // No shell: a shell joins the executable and the arguments with spaces, so "C:\Program Files\nodejs\node.exe" (or a
    // checkout under a folder with a space) was split at the space ("'C:\Program' is not recognized", #525).
    const { command, args, options } = spawnSpec(argv);
    const child = spawn(command, args, { cwd, stdio: ['ignore', 'pipe', 'pipe'], ...options });
    child.stdout.pipe(log, { end: false });
    child.stderr.pipe(log, { end: false });
    let waited = false;
    child.stderr.on('data', (chunk) => {
      // Tell the person when the command is queued behind other heavy commands on this machine.
      const line = String(chunk).split('\n').find((text) => text.startsWith('agent-slot: waiting'));
      if (line && !waited) {
        waited = true;
        console.log(`  ${line}`);
      }
    });
    child.on('error', (error) => {
      log.write(`\ncheck-changed: could not start ${argv[0]}: ${error.message}\n`);
      resolve(1);
    });
    child.on('close', (code, signal) => resolve(code ?? signal ?? 1));
  });
}

// Windows caps a command line at 32,767 characters (8,191 through cmd.exe), and a long branch can change hundreds of
// files, so Biome gets the changed files in batches whose joined length stays well under the smaller limit.
export const BIOME_BATCH_CHARS = 6000;

/** The changed files split into batches whose space-joined length stays at or under `limit` characters. */
export function biomeBatches(files, limit = BIOME_BATCH_CHARS) {
  const batches = [];
  let batch = [];
  let length = 0;
  for (const file of files) {
    if (batch.length && length + file.length + 1 > limit) {
      batches.push(batch);
      batch = [];
      length = 0;
    }
    batch.push(file);
    length += file.length + 1;
  }
  if (batch.length) batches.push(batch);
  return batches;
}

function biomeCommand(files) {
  const bin = createRequire(path.join(root, 'package.json')).resolve('@biomejs/biome/bin/biome');
  return [process.execPath, bin, 'check', '--colors=off', '--files-ignore-unknown=true', '--no-errors-on-unmatched', ...files];
}

async function runStep(step, logs) {
  const started = Date.now();
  if (step.skip) return { ...step, status: 'skipped', seconds: 0 };
  const logFile = path.join(logs, `${step.name.replace(/[^A-Za-z0-9._-]+/g, '_')}.log`);
  const log = createWriteStream(logFile);
  const commands = step.biome ? biomeBatches(step.biome).map((files) => ({ argv: biomeCommand(files) })) : step.commands;
  let status = 0;
  for (const { argv, cwd = root } of commands) {
    status = await runCommand(argv, cwd, log);
    if (status !== 0) break;
  }
  await new Promise((resolve) => log.end(resolve));
  return { ...step, status: status === 0 ? 'passed' : 'FAILED', code: status, seconds: (Date.now() - started) / 1000, log: logFile };
}

export function formatTable(results, total) {
  const rows = results.map((result) => [result.name, result.status, result.skip ? '-' : `${result.seconds.toFixed(1)} s`, result.detail ?? result.note ?? '']);
  const widths = [0, 1, 2].map((column) => Math.max(...rows.map((row) => row[column].length), ['step', 'status', 'time'][column].length));
  const line = (row) => `${row[0].padEnd(widths[0])}  ${row[1].padEnd(widths[1])}  ${row[2].padStart(widths[2])}  ${row[3]}`.trimEnd();
  return [line(['step', 'status', 'time', '']), ...rows.map(line), line(['total', '', `${total.toFixed(1)} s`, ''])].join('\n');
}

async function main(argv) {
  const scripts = JSON.parse(readFileSync(path.join(root, 'package.json'), 'utf8')).scripts;
  const config = JSON.parse(readFileSync(path.join(root, 'scripts', 'checks.json'), 'utf8'));
  selectChecks(scripts, config); // fails on a stale checks.json before anything runs
  const flag = argv.indexOf('--files');
  const baseFlag = argv.indexOf('--base');
  const { base, files } = flag === -1 ? changedFiles(baseFlag === -1 ? undefined : argv[baseFlag + 1]) : { base: '(given)', files: argv.slice(flag + 1) };
  const plan = buildPlan(files, { scripts, config, needsInstall: needsInstall(), packages: readPackages(), exists: (file) => existsSync(path.join(root, file)) });
  console.log(`check-changed: ${files.length} changed files since ${base ? base.slice(0, 9) : 'HEAD'} (plus uncommitted and untracked)`);
  if (argv.includes('--plan')) {
    for (const step of plan) console.log(`${step.skip ? 'skip' : 'run '}  ${step.name}${step.note ? `  (${step.note})` : ''}`);
    return 0;
  }
  const logs = path.join(root, 'artifacts', 'check-changed');
  mkdirSync(logs, { recursive: true });
  const started = Date.now();
  const results = new Array(plan.length);
  const run = async (index) => {
    const result = await runStep(plan[index], logs);
    results[index] = result;
    console.log(`${result.status === 'skipped' ? '-' : result.status === 'passed' ? 'ok' : 'FAILED'}  ${result.name}${result.skip ? '' : ` (${result.seconds.toFixed(1)} s)`}`);
  };
  const indexes = (keep) => plan.map((step, index) => (keep(step) ? index : -1)).filter((index) => index >= 0);
  // Install first, then the cheap steps two at a time, then the heavy ones one after another (each through a slot).
  for (const index of indexes((step) => step.name === 'install')) await run(index);
  if (!results.some((result) => result?.status === 'FAILED')) {
    const light = indexes((step) => step.light);
    let next = 0;
    const jobs = Math.min(2, checkJobs());
    await Promise.all(
      Array.from({ length: Math.min(jobs, light.length) }, async () => {
        for (let at = next++; at < light.length; at = next++) await run(light[at]);
      }),
    );
    for (const index of indexes((step) => !step.light && step.name !== 'install')) await run(index);
  }
  const ordered = results.filter(Boolean);
  const failed = ordered.filter((result) => result.status === 'FAILED');
  for (const result of failed) {
    const text = readFileSync(result.log, 'utf8').trimEnd().split('\n');
    console.error(`\n--- ${result.name} failed (exit ${result.code}); last ${Math.min(text.length, 60)} lines of ${path.relative(root, result.log)}:`);
    console.error(text.slice(-60).join('\n'));
  }
  console.log(`\n${formatTable(ordered, (Date.now() - started) / 1000)}`);
  if (failed.length) console.error(`\ncheck-changed: ${failed.length} of ${ordered.length} steps failed: ${failed.map((result) => result.name).join(', ')}`);
  else console.log('\ncheck-changed: passed. Run the full `pnpm test` before opening the pull request.');
  return failed.length ? 1 : 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(realpathSync(process.argv[1])).href) {
  main(process.argv.slice(2)).then(
    (code) => {
      process.exitCode = code;
    },
    (error) => {
      console.error(`check-changed: ${error.message}`);
      process.exitCode = 1;
    },
  );
}
