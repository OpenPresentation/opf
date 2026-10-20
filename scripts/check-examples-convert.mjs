#!/usr/bin/env node
// RR-97: every example deck under examples/ converts to a preview and to PPTX with no error finding. A deck that names a resource
// that does not exist (a relative image path, an unreadable data URI) fails `opf convert` with pptx/asset-unresolved, so a first-use
// `opf convert examples/... out.pptx` must never be the way the gap is found. The check fails when a conversion throws, writes a
// file of the wrong format or has an error-severity finding in its report.
//
// Speed (RR-97: the publish job has a 15-minute limit; this check took 298 s on a 4-core runner and the publish was cancelled):
//  1. In-process. The first version spawned the CLI once per conversion (131 decks x 2 formats), and nearly all of that time was
//     process start, font loading and exporter loading. The conversions now run on a pool of worker threads
//     (OPF_EXAMPLES_CONVERT_JOBS, default the number of CPUs). Each worker calls core's conversion engine, the `planConversion` that
//     `opf convert` calls (scripts/examples-convert-worker.mjs), and loads the renderer, its fonts and the PPTX exporter once for
//     all its decks. Every conversion still checks the deck, draws every slide and builds the whole PPTX package; only writing the
//     files is skipped. That alone is about 3.9x less CPU time.
//  2. SVG for the preview of most decks. A PNG is the SVG plus rasterization with resvg, and rasterizing is more than half of a PNG
//     conversion (measured: 187 ms per deck as SVG, 373 ms as PNG, in-process). The drawing, and so every render finding
//     (asset-unresolved, a missing font, an unresolved reference), comes from the SVG, so the SVG leg proves the preview converts.
//     What SVG leaves unproved is the rasterizer, so PNG runs on a fixed sample: every 26th deck and the Markdown example.
//  The CLI itself stays covered: a fixed sample (the Markdown example and the first deck) also runs through the built
//  workspace CLI as PNG and PPTX, exit code and report included, which also pins the in-process verdict to the CLI's.
//   node scripts/check-examples-convert.mjs           convert every example
//   node scripts/check-examples-convert.mjs --list    print the example decks and exit
import { spawn, spawnSync } from 'node:child_process';
import { existsSync, readdirSync, statSync } from 'node:fs';
import { mkdtemp, rm } from 'node:fs/promises';
import { availableParallelism, tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Worker } from 'node:worker_threads';
import { spawnSpec } from './package-manager.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const cli = path.join(root, 'packages', 'cli', 'dist', 'index.js');
// The formats the CLI sample converts to; the in-process legs are svg or png (see pngSample) and pptx.
export const FORMATS = ['png', 'pptx'];

const isDeck = (name) => /\.opf\.(json|ya?ml|md)$/.test(name) || (name.endsWith('.md') && !/^README\.md$/i.test(name));

/** Every example deck under `directory`, as sorted repository-relative paths with forward slashes. */
export function exampleDecks(directory = path.join(root, 'examples')) {
  const found = [];
  const walk = (dir) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.isFile() && isDeck(entry.name)) found.push(path.relative(root, full).split(path.sep).join('/'));
    }
  };
  walk(directory);
  return found.sort();
}

/** Why a finished conversion fails, or undefined when it passed: exit code, unreadable report or error-severity findings. */
export function failureOf({ code, stdout, stderr }) {
  let report;
  try {
    report = JSON.parse(stdout.trim() === '' ? stderr : stdout);
  } catch {
    return code === 0 ? 'the report is not JSON' : `exit ${code}: ${(stderr || stdout).trim().split('\n')[0] ?? ''}`;
  }
  const errors = (report.findings ?? []).filter((finding) => finding.severity === 'error');
  const lines = errors.map((finding) => `${finding.ruleId}${finding.path ? ` ${finding.path}` : ''}: ${finding.message}`);
  if (code !== 0) return [`exit ${code}${report.error ? `: ${report.error}` : ''}`, ...lines].join('\n    ');
  if (lines.length > 0) return lines.join('\n    ');
  if (report.ok === false) return `the report says ok: false${report.error ? `: ${report.error}` : ''}`;
  return undefined;
}

// The CLI's dist is what the check runs. CI builds before `pnpm test`; a checkout without it, or with sources newer than
// it, builds here (the build is a reuse hit inside a CI job).
export function ensureBuilt() {
  const newest = (dir) => readdirSync(dir, { withFileTypes: true }).reduce((latest, entry) => {
    const full = path.join(dir, entry.name);
    return Math.max(latest, entry.isDirectory() ? newest(full) : statSync(full).mtimeMs);
  }, 0);
  if (existsSync(cli) && statSync(cli).mtimeMs >= newest(path.join(root, 'packages', 'cli', 'src'))) return;
  console.log('check-examples-convert: building the workspace CLI');
  const spec = spawnSpec(['pnpm', '--filter', '@openpresentation/cli', 'build']);
  const built = spawnSync(spec.command, spec.args, { cwd: root, stdio: 'inherit', ...spec.options });
  if (built.status !== 0) throw new Error('the workspace CLI did not build');
}

function convert(input, output) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [cli, 'convert', input, output, '--force'], { cwd: root, stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk) => { stdout += chunk; });
    child.stderr.on('data', (chunk) => { stderr += chunk; });
    child.on('error', (error) => resolve({ code: 1, stdout, stderr: String(error) }));
    child.on('close', (code) => resolve({ code: code ?? 1, stdout, stderr }));
  });
}

/** The decks that also run through the built CLI: the first Markdown or YAML deck and the first deck. */
export function cliSample(decks) {
  return [...new Set([decks.find((deck) => !deck.endsWith('.json')), decks[0]].filter(Boolean))];
}

/** The decks whose preview is also rasterized to PNG in-process: every 26th deck and the first Markdown or YAML deck. */
export function pngSample(decks) {
  return [...new Set([decks.find((deck) => !deck.endsWith('.json')), ...decks.filter((_, index) => index % 26 === 0)].filter(Boolean))];
}

/** Run `tasks` ({deck, format}) on `jobs` worker threads. Resolves to the tasks that failed, with their reason. */
export function convertInProcess(tasks, jobs) {
  const failures = [];
  const file = new URL('./examples-convert-worker.mjs', import.meta.url);
  return new Promise((resolve, reject) => {
    let next = 0;
    let running = 0;
    const workers = [];
    const stop = (error) => {
      for (const worker of workers) worker.terminate();
      reject(error);
    };
    const finish = () => {
      running -= 1;
      if (running === 0) resolve(failures);
    };
    for (let n = 0; n < Math.min(jobs, tasks.length); n += 1) {
      const worker = new Worker(file);
      workers.push(worker);
      running += 1;
      let current;
      const feed = () => {
        if (next >= tasks.length) {
          current = undefined;
          worker.terminate().then(finish, finish);
          return;
        }
        current = tasks[next++];
        worker.postMessage({ deck: current.deck, format: current.format });
      };
      worker.on('message', ({ reason }) => {
        if (reason) failures.push({ ...current, reason });
        feed();
      });
      worker.on('error', stop);
      worker.on('exit', (code) => { if (current) stop(new Error(`a conversion worker exited with ${code} while converting ${current.deck}`)); });
      feed();
    }
  });
}

/** `tasks` ({deck, format}) through the built CLI, two at a time. Resolves to the tasks that failed. */
export async function convertWithCli(tasks) {
  const failures = [];
  const work = await mkdtemp(path.join(tmpdir(), 'opf-examples-convert-'));
  try {
    let next = 0;
    const worker = async () => {
      for (let at = next++; at < tasks.length; at = next++) {
        const { deck, format } = tasks[at];
        // The output is a file of its own under a directory the CLI creates.
        const reason = failureOf(await convert(deck, path.join(work, `${at}`, `deck.${format}`)));
        if (reason) failures.push({ deck, format, reason });
      }
    };
    await Promise.all(Array.from({ length: Math.min(2, tasks.length) }, worker));
  } finally {
    await rm(work, { recursive: true, force: true });
  }
  return failures;
}

/**
 * Convert every deck of `decks` (repository-relative paths) to its preview (SVG, or PNG for the decks of `png`) and to PPTX in
 * worker threads, and the decks of `sample` to PNG and PPTX through the built CLI. Resolves to {conversions, failures, seconds}; a
 * failure is {deck, format, reason}, sorted by deck and format.
 */
export async function checkDecks(decks, { jobs = Math.max(1, Number(process.env.OPF_EXAMPLES_CONVERT_JOBS) || availableParallelism()), png = pngSample(decks), sample = cliSample(decks) } = {}) {
  const rasterized = new Set(png);
  const tasks = decks.flatMap((deck) => [
    { deck, format: rasterized.has(deck) ? 'png' : 'svg' },
    { deck, format: 'pptx' },
  ]);
  const started = Date.now();
  const sampled = sample.flatMap((deck) => FORMATS.map((format) => ({ deck, format })));
  const [inProcess, throughCli] = await Promise.all([convertInProcess(tasks, jobs), convertWithCli(sampled)]);
  const failures = [...inProcess, ...throughCli.map((failure) => ({ ...failure, reason: `through the CLI: ${failure.reason}` }))].sort((a, b) => a.deck.localeCompare(b.deck) || a.format.localeCompare(b.format));
  return { conversions: tasks.length + sampled.length, failures, seconds: ((Date.now() - started) / 1000).toFixed(1) };
}

async function main(argv) {
  const decks = exampleDecks();
  if (argv.includes('--list')) {
    console.log(decks.join('\n'));
    return 0;
  }
  if (decks.length === 0) throw new Error('no example decks found under examples/');
  ensureBuilt();
  const jobs = Math.max(1, Number(process.env.OPF_EXAMPLES_CONVERT_JOBS) || availableParallelism());
  const { conversions, failures, seconds } = await checkDecks(decks, { jobs });
  if (failures.length > 0) {
    console.error(`check-examples-convert: ${failures.length} of ${conversions} conversions failed:`);
    for (const { deck, format, reason } of failures) console.error(`  ${deck} -> ${format}\n    ${reason}`);
    return 1;
  }
  console.log(`check-examples-convert: ${decks.length} example decks convert to the preview and to PPTX (${conversions} conversions on ${Math.min(jobs, decks.length * 2)} workers: PNG for ${pngSample(decks).length} decks and through the CLI for ${cliSample(decks).length}, SVG for the rest, ${seconds}s)`);
  return 0;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main(process.argv.slice(2)).then((code) => { process.exitCode = code; }, (error) => { console.error(error); process.exitCode = 1; });
}
