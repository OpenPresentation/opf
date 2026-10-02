#!/usr/bin/env node
// RR-47: the flake quarantine. `test/quarantine.json` lists tests that are known to flake and are tracked by an issue.
// A quarantined test still runs, in a separate non-blocking step that reports its result; it never fails the job.
// Every other test is a gate. The rule (supervisor approval, 14-day expiry) is in test/QUARANTINE.md.
//
//   node scripts/quarantine.mjs check                 validate test/quarantine.json against test/browser-suites.json (CI step)
//   node scripts/quarantine.mjs run-suite <suite>     run a suite's setup and tests in order; quarantined tests are deferred
//   node scripts/quarantine.mjs run-deferred          run the deferred tests (always-run, continue-on-error step) and report them
//
// Options: --quarantine <file> (default test/quarantine.json), --suites <file> (default test/browser-suites.json),
// --today YYYY-MM-DD (tests; default the current UTC date). No dependencies, no network.
import { spawn } from 'node:child_process';
import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const MAX_DAYS = 14;
export const DEFAULT_QUARANTINE = 'test/quarantine.json';
export const DEFAULT_SUITES = 'test/browser-suites.json';
const DAY_MS = 86_400_000;
const ISSUE = /^https:\/\/github\.com\/(OpenPresentation|Data-Advantage)\/[A-Za-z0-9._-]+\/issues\/[1-9][0-9]*$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;

/** Milliseconds for a YYYY-MM-DD date, or NaN when it is not a real calendar date. */
export function dayNumber(text) {
  if (typeof text !== 'string' || !DATE.test(text)) return Number.NaN;
  const time = Date.parse(`${text}T00:00:00Z`);
  return Number.isNaN(time) || new Date(time).toISOString().slice(0, 10) !== text ? Number.NaN : time;
}
export const todayUtc = () => new Date().toISOString().slice(0, 10);

/** Split a command string into argv. Quoting is not supported on purpose: a suite command is a plain argument list. */
export function splitCommand(command) {
  if (typeof command !== 'string' || !command.trim()) throw new Error('A suite command must be a non-empty string.');
  if (/["'`$|&;<>()\\]/.test(command)) throw new Error(`A suite command is a plain argument list (no quotes, pipes or shell syntax): ${command}`);
  return command.trim().split(/\s+/);
}

export function readJson(file, what) {
  let text;
  try { text = readFileSync(file, 'utf8'); } catch (error) { throw new Error(`${what} ${file} cannot be read (${error.code ?? error.message}).`); }
  try { return JSON.parse(text); } catch (error) { throw new Error(`${what} ${file} is not valid JSON (${error.message}).`); }
}

/** Every test in a suites file: [{ suite, id, command }]. Throws on a malformed file or a duplicate id. */
export function listTests(suitesData) {
  if (!suitesData || typeof suitesData !== 'object' || suitesData.schema !== 1 || !suitesData.suites || typeof suitesData.suites !== 'object') throw new Error('The suites file needs { "schema": 1, "suites": { ... } }.');
  const tests = [];
  const seen = new Set();
  for (const [suite, definition] of Object.entries(suitesData.suites)) {
    if (!Array.isArray(definition.tests) || !definition.tests.length) throw new Error(`Suite "${suite}" needs a non-empty "tests" array.`);
    for (const command of definition.setup ?? []) splitCommand(command);
    for (const test of definition.tests) {
      if (typeof test?.id !== 'string' || !test.id) throw new Error(`Suite "${suite}" has a test without an id.`);
      if (seen.has(test.id)) throw new Error(`Test id "${test.id}" is used twice; ids are unique across suites.`);
      seen.add(test.id);
      splitCommand(test.command);
      tests.push({ suite, id: test.id, command: test.command });
    }
  }
  return tests;
}

/**
 * Validate the quarantine list. Returns { errors, expired, active }: `errors` fail the check (malformed entries and expired
 * ones), `expired` is the subset that ran out, `active` are the ids the CI honours today.
 */
export function validateQuarantine(data, { today = todayUtc(), knownIds } = {}) {
  const errors = [];
  const expired = [];
  const active = [];
  if (!data || typeof data !== 'object' || data.schema !== 1 || !Array.isArray(data.entries)) {
    return { errors: ['test/quarantine.json needs { "schema": 1, "entries": [ ... ] }.'], expired, active };
  }
  const todayDay = dayNumber(today);
  if (Number.isNaN(todayDay)) throw new Error(`"${today}" is not a YYYY-MM-DD date.`);
  const ids = new Set();
  data.entries.forEach((entry, index) => {
    const label = `entry ${index + 1}${typeof entry?.id === 'string' ? ` (${entry.id})` : ''}`;
    const problems = [];
    if (!entry || typeof entry !== 'object') { errors.push(`${label}: must be an object.`); return; }
    if (typeof entry.id !== 'string' || !entry.id) problems.push('"id" is required');
    else if (ids.has(entry.id)) problems.push('the id is listed twice');
    else if (knownIds && !knownIds.has(entry.id)) problems.push('the id is not a test in the suites file (a typo quarantines nothing)');
    if (typeof entry.id === 'string') ids.add(entry.id);
    if (typeof entry.issue !== 'string' || !ISSUE.test(entry.issue)) problems.push('"issue" must be a link to a GitHub issue in an OpenPresentation or Data-Advantage repository');
    if (typeof entry.owner !== 'string' || !entry.owner.trim()) problems.push('"owner" is required');
    if (typeof entry.reason !== 'string' || !entry.reason.trim()) problems.push('"reason" is required (what flakes, in one sentence)');
    const added = dayNumber(entry.added);
    const expires = dayNumber(entry.expires);
    if (Number.isNaN(added)) problems.push('"added" must be a YYYY-MM-DD date');
    if (Number.isNaN(expires)) problems.push('"expires" must be a YYYY-MM-DD date');
    if (!Number.isNaN(added) && added > todayDay) problems.push('"added" is in the future');
    if (!Number.isNaN(added) && !Number.isNaN(expires)) {
      if (expires <= added) problems.push('"expires" must be after "added"');
      else if ((expires - added) / DAY_MS > MAX_DAYS) problems.push(`"expires" is more than ${MAX_DAYS} days after "added"`);
    }
    if (problems.length) { errors.push(`${label}: ${problems.join('; ')}.`); return; }
    if (expires < todayDay) {
      expired.push(entry.id);
      errors.push(`${label}: expired on ${entry.expires}. Fix the test and remove the entry, or (with the supervisor's approval in the PR) renew it for at most ${MAX_DAYS} days.`);
      return;
    }
    active.push(entry.id);
  });
  return { errors, expired, active };
}

/** Load both files and validate. Quarantined ids are checked against the suites file when it exists. */
export function loadState({ quarantineFile = DEFAULT_QUARANTINE, suitesFile = DEFAULT_SUITES, today = todayUtc() } = {}) {
  const suites = readJson(suitesFile, 'Suites file');
  const tests = listTests(suites);
  const quarantine = readJson(quarantineFile, 'Quarantine file');
  const result = validateQuarantine(quarantine, { today, knownIds: new Set(tests.map((test) => test.id)) });
  return { suites, tests, quarantine, ...result };
}

// --- running -----------------------------------------------------------------------------------------------

const needsShell = (program) => process.platform === 'win32' && /^(npm|pnpm|npx)$/.test(program);

/** Run argv with inherited output. Resolves { code, tail } where `tail` is the last lines of output. */
export function runArgv(argv, { cwd = process.cwd(), timeoutMs = 0, tailLines = 60 } = {}) {
  return new Promise((resolve) => {
    const lines = [];
    const keep = (chunk, sink) => {
      sink.write(chunk);
      for (const line of chunk.toString().split(/\r?\n/)) if (line) lines.push(line);
      if (lines.length > tailLines * 2) lines.splice(0, lines.length - tailLines);
    };
    let child;
    try { child = spawn(argv[0], argv.slice(1), { cwd, stdio: ['ignore', 'pipe', 'pipe'], shell: needsShell(argv[0]) }); }
    catch (error) { resolve({ code: 127, tail: [String(error.message)] }); return; }
    let timer;
    let timedOut = false;
    if (timeoutMs > 0) timer = setTimeout(() => { timedOut = true; child.kill('SIGKILL'); }, timeoutMs);
    child.stdout.on('data', (chunk) => keep(chunk, process.stdout));
    child.stderr.on('data', (chunk) => keep(chunk, process.stderr));
    child.on('error', (error) => { clearTimeout(timer); resolve({ code: 127, tail: [String(error.message)] }); });
    child.on('close', (code, signal) => {
      clearTimeout(timer);
      if (timedOut) lines.push(`(timed out after ${Math.round(timeoutMs / 1000)} s)`);
      resolve({ code: timedOut ? 124 : code ?? (signal ? 1 : 0), tail: lines.slice(-tailLines) });
    });
  });
}

const quarantineDirectory = () => path.resolve(process.env.OPF_QUARANTINE_DIR ?? 'artifacts/quarantine');
const deferredFile = () => path.join(quarantineDirectory(), 'deferred.json');
export function summary(markdown) {
  if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${markdown}\n`);
}
const annotate = (level, title, message) => console.log(`::${level} title=${title}::${message.replace(/\r?\n/g, ' ')}`);

export async function runSuite(name, state) {
  const definition = state.suites.suites[name];
  if (!definition) throw new Error(`No suite "${name}" in the suites file (have: ${Object.keys(state.suites.suites).join(', ')}).`);
  for (const command of definition.setup ?? []) {
    console.log(`\n> setup: ${command}`);
    const { code } = await runArgv(splitCommand(command));
    if (code !== 0) return code || 1;
  }
  const honoured = new Set(state.active);
  const deferred = [];
  let failure = 0;
  for (const test of definition.tests) {
    if (honoured.has(test.id)) {
      console.log(`\n> ${test.id}: quarantined, deferred to the non-blocking step`);
      annotate('notice', 'Quarantined test deferred', `${test.id} runs in the non-blocking quarantine step.`);
      deferred.push({ suite: name, id: test.id, argv: splitCommand(test.command), cwd: process.cwd() });
      continue;
    }
    console.log(`\n> ${test.id}: ${test.command}`);
    const { code } = await runArgv(splitCommand(test.command));
    if (code !== 0) {
      // By default a failure stops the suite, like `a && b`. A suite with "continueOnFailure" runs the rest and fails at the end.
      if (!definition.continueOnFailure) return code || 1;
      failure ||= code || 1;
    }
  }
  if (deferred.length) {
    mkdirSync(quarantineDirectory(), { recursive: true });
    const earlier = existsSync(deferredFile()) ? JSON.parse(readFileSync(deferredFile(), 'utf8')) : [];
    writeFileSync(deferredFile(), `${JSON.stringify([...earlier, ...deferred], null, 2)}\n`);
  }
  return failure;
}

export async function runDeferred(state) {
  const queue = existsSync(deferredFile()) ? JSON.parse(readFileSync(deferredFile(), 'utf8')) : [];
  const byId = new Map((state.quarantine.entries ?? []).map((entry) => [entry.id, entry]));
  const rows = [];
  for (const item of queue) {
    console.log(`\n> quarantined ${item.id}: ${item.argv.join(' ')}`);
    const { code, tail } = await runArgv(item.argv, { cwd: item.cwd });
    const entry = byId.get(item.id);
    rows.push({ ...item, code, tail, issue: entry?.issue, owner: entry?.owner, expires: entry?.expires });
    annotate(code === 0 ? 'notice' : 'warning', `Quarantined test ${code === 0 ? 'passed' : 'failed'}`, `${item.id} (${entry?.issue ?? 'no issue'}); it does not block this job.`);
  }
  const report = { schema: 1, ran: rows.length, failed: rows.filter((row) => row.code !== 0).length, tests: rows.map(({ argv, tail, ...row }) => ({ ...row, command: argv.join(' '), tail: row.code === 0 ? [] : tail })) };
  mkdirSync(quarantineDirectory(), { recursive: true });
  writeFileSync(path.join(quarantineDirectory(), 'report.json'), `${JSON.stringify(report, null, 2)}\n`);
  summary(renderReport(state, report));
  return 0;
}

export function renderReport(state, report) {
  const lines = ['### Quarantined tests (non-blocking)', ''];
  if (!state.quarantine.entries.length) lines.push('The quarantine list is empty: every test is a gate.');
  else if (!report.ran) lines.push(`${state.quarantine.entries.length} entries, none ran in this job.`);
  else {
    lines.push('| Test | Result | Issue | Owner | Expires |', '|---|---|---|---|---|');
    for (const row of report.tests) lines.push(`| \`${row.id}\` | ${row.code === 0 ? 'passed' : `FAILED (${row.code})`} | ${row.issue ?? ''} | ${row.owner ?? ''} | ${row.expires ?? ''} |`);
  }
  return lines.join('\n');
}

export function renderCheck(state, today) {
  const lines = ['### Test quarantine', ''];
  if (!state.quarantine.entries.length) lines.push(`Empty. Every test in \`${DEFAULT_SUITES}\` is a gate.`);
  else {
    lines.push('| Test | Issue | Owner | Added | Expires | State |', '|---|---|---|---|---|---|');
    for (const entry of state.quarantine.entries) {
      const status = state.expired.includes(entry.id) ? 'EXPIRED' : `${Math.round((dayNumber(entry.expires) - dayNumber(today)) / DAY_MS)} days left`;
      lines.push(`| \`${entry.id}\` | ${entry.issue} | ${entry.owner} | ${entry.added} | ${entry.expires} | ${status} |`);
    }
  }
  return lines.join('\n');
}

function parseOptions(argv) {
  const options = { _: [] };
  for (let index = 0; index < argv.length; index++) {
    const arg = argv[index];
    if (arg.startsWith('--')) options[arg.slice(2)] = argv[++index];
    else options._.push(arg);
  }
  return options;
}

export async function main(argv) {
  const options = parseOptions(argv);
  const [command, ...rest] = options._;
  const today = options.today ?? todayUtc();
  const files = { quarantineFile: options.quarantine ?? DEFAULT_QUARANTINE, suitesFile: options.suites ?? DEFAULT_SUITES, today };
  if (command === 'check') {
    const state = loadState(files);
    console.log(renderCheck(state, today));
    summary(renderCheck(state, today));
    for (const error of state.errors) { console.error(`error: ${error}`); annotate('error', 'Test quarantine', error); }
    return state.errors.length ? 1 : 0;
  }
  if (command === 'run-suite') {
    if (!rest[0]) throw new Error('Usage: quarantine.mjs run-suite <suite>');
    // An expired or malformed entry is not honoured: its test runs as a gate (the check step reports the entry).
    const state = loadState(files);
    for (const error of state.errors) annotate('error', 'Test quarantine', error);
    return runSuite(rest[0], state);
  }
  if (command === 'run-deferred') return runDeferred(loadState(files));
  throw new Error('Usage: quarantine.mjs check | run-suite <suite> | run-deferred [--quarantine file] [--suites file] [--today YYYY-MM-DD]');
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main(process.argv.slice(2)).then((code) => { process.exitCode = code; }, (error) => { console.error(error.message); process.exitCode = 2; });
}
