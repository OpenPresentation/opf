// Sustained-load soak for long-lived render and export workers (opf-render#171, RR-59 AUTO-30).
//
// Manual or scheduled; never part of the default CI gate. Each worker is a child process that holds ONE fonts handle
// (`loadFonts({ pack: 'office', scripts: 'auto' })` from `/fonts-node`), makes no network call (a guard counts and refuses
// any attempt) and repeats jobs. A job is one deck, run through `fonts.ensure(deck)`, `toSvg`, `toPng` (of the SVGs just
// drawn) and, when `@openpresentation/opf-pptx` is installed, `toPptx`. The decks are core's example decks plus one
// script-heavy deck built from the script corpora (every sixth job by default), taken in rotation, so each deck comes
// round several times and its output can be compared across iterations, workers and concurrency levels.
//
//   node scripts/soak.mjs                              500 jobs per worker at concurrency 1 and 4
//   node scripts/soak.mjs --iterations 20 --concurrency 1,2 --decks 6 --script-every 0     smoke run
//
// Options
//   --iterations N      jobs per worker (default 500)
//   --concurrency L     comma list of worker-process counts, run one after the other (default 1,4)
//   --duration S        stop starting jobs after S seconds (default: no limit; `--iterations` still caps)
//   --warmup N          jobs excluded from the steady-state window (default: min(one pass over the deck list, a quarter of the jobs))
//   --decks N           use only the first N example decks (default: all)
//   --only TEXT         use only example decks whose file name contains TEXT (and no script deck)
//   --script-every N    every Nth job is the script-heavy deck, 0 for never (default 6)
//   --ops L             comma list of svg,png,pptx (default svg,png,pptx; pptx is skipped when opf-pptx is not installed)
//   --sample-every N    take a memory sample after every Nth job (default 1)
//   --out DIR           report directory (default artifacts/soak, git-ignored)
//   --label TEXT        free text copied into the report
//   --link-renderer     make `@openpresentation/opf-render` resolvable from node_modules (a junction/symlink to this checkout):
//                       opf-pptx imports the renderer as an optional peer, and without it the export would use no script planner
//
// PPTX leg: opf-pptx is not a dependency of this package. For the measurement install the release matching the renderer's
// train without saving it:  npm install --no-save @openpresentation/opf-pptx@0.18.0
//
// Output: `<out>/soak-<stamp>.json` (config, environment, per-job records, memory series, verdicts) and `<out>/soak-<stamp>.md`
// (the summary). Exit code 1 when output drifted between iterations, a job failed, or a network attempt was made; 0 otherwise.
// Memory growth is reported, not a failure, so a scheduled run can track it.
//
// Memory-growth criterion (per worker process, over the steady-state window = jobs after the warm-up). The series are the heap
// in use after a forced garbage collection (`heapUsed`; the retained heap) and the resident set size (`rss`; what the host sees),
// both sampled after every job. A series GROWS when both hold:
//   1. Mann-Kendall trend test (ties corrected) z >= 3.29 (one-sided p <= 0.0005): the samples drift upward consistently,
//      which a plateau with noise or a single step does not satisfy.
//   2. the Theil-Sen slope (median of the pairwise slopes, robust against spikes) times the window length, the "rise", is at
//      least max(5 % of the window median, 16 MiB): a trend that is real but tiny is not growth that needs a recycle.
// A run shows "no monotonic growth" when no worker's heap or rss series grows. The Theil-Sen slope is reported in MiB per
// 100 jobs so a recycle-after-N can be computed from it. Latency has the same test on each job's time divided by the median
// time of the same deck in the window (a rise >= 10 % is flagged).

import { fork } from 'node:child_process';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { existsSync, mkdirSync, readFileSync, symlinkSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const MIB = 1024 * 1024;
const SELF = fileURLToPath(import.meta.url);

// ---------------------------------------------------------------------------------------------------------------- stats

const percentile = (sorted, p) => sorted.length ? sorted[Math.min(sorted.length - 1, Math.max(0, Math.ceil(p / 100 * sorted.length) - 1))] : null;
const median = values => percentile([...values].sort((a, b) => a - b), 50);
const round = (value, digits = 2) => value === null || !Number.isFinite(value) ? null : Math.round(value * 10 ** digits) / 10 ** digits;

/** Least-squares slope of y against x. */
function olsSlope(xs, ys) {
  const n = xs.length;
  if (n < 2) return 0;
  const mx = xs.reduce((a, b) => a + b, 0) / n, my = ys.reduce((a, b) => a + b, 0) / n;
  let num = 0, den = 0;
  for (let i = 0; i < n; i++) { num += (xs[i] - mx) * (ys[i] - my); den += (xs[i] - mx) ** 2; }
  return den === 0 ? 0 : num / den;
}

/** Theil-Sen slope: the median of all pairwise slopes (a strided subsample past 1500 points keeps it cheap). */
export function theilSen(xs, ys) {
  const stride = Math.max(1, Math.ceil(xs.length / 1500));
  const px = xs.filter((_, i) => i % stride === 0), py = ys.filter((_, i) => i % stride === 0);
  const slopes = [];
  for (let i = 0; i < px.length; i++) for (let j = i + 1; j < px.length; j++) if (px[j] !== px[i]) slopes.push((py[j] - py[i]) / (px[j] - px[i]));
  return slopes.length ? median(slopes) : 0;
}

/** Mann-Kendall trend statistic z (normal approximation with the tie correction), positive for an upward trend. */
export function mannKendallZ(ys) {
  const stride = Math.max(1, Math.ceil(ys.length / 1500));
  const y = ys.filter((_, i) => i % stride === 0), n = y.length;
  if (n < 8) return 0;
  let s = 0;
  for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) s += Math.sign(y[j] - y[i]);
  const ties = new Map();
  for (const value of y) ties.set(value, (ties.get(value) ?? 0) + 1);
  let variance = n * (n - 1) * (2 * n + 5);
  for (const t of ties.values()) if (t > 1) variance -= t * (t - 1) * (2 * t + 5);
  variance /= 18;
  if (variance <= 0) return 0;
  return s === 0 ? 0 : (s - Math.sign(s)) / Math.sqrt(variance);
}

const Z_CRITICAL = 3.29, RISE_FRACTION = 0.05, RISE_FLOOR = 16 * MIB, LATENCY_RISE = 0.10;

/** The growth test described in the header, on a series of {x: job index, y: bytes}. */
export function growthTest(points, { floor = RISE_FLOOR, fraction = RISE_FRACTION } = {}) {
  if (points.length < 8) return { samples: points.length, grows: false, note: 'too few samples for a trend test' };
  const xs = points.map(p => p.x), ys = points.map(p => p.y);
  const medianValue = median(ys), z = mannKendallZ(ys), slope = theilSen(xs, ys);
  const span = xs[xs.length - 1] - xs[0], rise = slope * span;
  const threshold = Math.max(fraction * medianValue, floor);
  return {
    samples: points.length,
    medianMiB: round(medianValue / MIB, 1), firstMiB: round(ys[0] / MIB, 1), lastMiB: round(ys[ys.length - 1] / MIB, 1), maxMiB: round(Math.max(...ys) / MIB, 1),
    theilSenMiBPer100Jobs: round(slope * 100 / MIB, 3), olsMiBPer100Jobs: round(olsSlope(xs, ys) * 100 / MIB, 3),
    riseMiB: round(rise / MIB, 1), thresholdMiB: round(threshold / MIB, 1), mannKendallZ: round(z, 2),
    grows: z >= Z_CRITICAL && rise >= threshold,
  };
}

// --------------------------------------------------------------------------------------------------------------- options

export function parseArgs(argv) {
  const options = { iterations: 500, concurrency: [1, 4], duration: 0, warmup: null, decks: 0, only: '', scriptEvery: 6, ops: ['svg', 'png', 'pptx'], sampleEvery: 1, out: path.join(root, 'artifacts', 'soak'), label: '', linkRenderer: false };
  const positive = (name, value, min = 1) => { const n = Number(value); if (!Number.isInteger(n) || n < min) throw new Error(`${name} needs an integer >= ${min}, got "${value}"`); return n; };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i], next = () => { if (i + 1 >= argv.length) throw new Error(`${arg} needs a value`); return argv[++i]; };
    switch (arg) {
      case '--iterations': options.iterations = positive(arg, next()); break;
      case '--concurrency': options.concurrency = next().split(',').map(value => positive(arg, value)); break;
      case '--duration': options.duration = Number(next()); if (!(options.duration >= 0)) throw new Error('--duration needs seconds'); break;
      case '--warmup': options.warmup = positive(arg, next(), 0); break;
      case '--decks': options.decks = positive(arg, next()); break;
      case '--only': options.only = next(); break;
      case '--script-every': options.scriptEvery = positive(arg, next(), 0); break;
      case '--ops': options.ops = next().split(',').map(op => op.trim()); for (const op of options.ops) if (!['svg', 'png', 'pptx'].includes(op)) throw new Error(`unknown op "${op}"`); break;
      case '--sample-every': options.sampleEvery = positive(arg, next()); break;
      case '--out': options.out = path.resolve(next()); break;
      case '--label': options.label = next(); break;
      case '--link-renderer': options.linkRenderer = true; break;
      default: throw new Error(`unknown option ${arg}`);
    }
  }
  return options;
}

// ----------------------------------------------------------------------------------------------------------------- worker

const sha = data => createHash('sha256').update(data).digest('hex');

/** The script-heavy deck: a slide per script corpus group (30 scripts: a title sample and the other samples as a list). */
async function scriptDeck() {
  const { loadCorpora } = await import('./script-corpora.mjs');
  const corpora = await loadCorpora();
  return {
    $schema: 'https://openpresentation.org/schema/opf/v1', name: 'Soak: script corpora', language: 'en',
    slides: corpora.groups.map(group => ({
      title: group.samples[0].text,
      text: group.samples.slice(1).map(sample => sample.text).join('\n') || ' ',
    })),
  };
}

function blockNetwork() {
  const attempts = [];
  const refuse = what => { attempts.push(what); throw Object.assign(new Error(`soak: network is blocked (${what})`), { code: 'soak-network-blocked' }); };
  globalThis.fetch = (input) => refuse(`fetch ${String(input?.url ?? input).slice(0, 80)}`);
  return Promise.all([import('node:net'), import('node:dns')]).then(([net, dns]) => {
    net.default.Socket.prototype.connect = function () { return refuse('net.Socket.connect'); };
    dns.default.lookup = () => refuse('dns.lookup');
    return attempts;
  });
}

async function runWorker() {
  const config = JSON.parse(process.env.OPF_SOAK_CONFIG);
  const { examples } = await import('@openpresentation/opf/examples');
  const { loadFonts } = await import('../dist/fonts-node.js');
  const { toSvg, toPng } = await import('../dist/index.js');
  let toPptx = null;
  if (config.ops.includes('pptx')) ({ toPptx } = await import('@openpresentation/opf-pptx'));

  let decks = examples.filter(example => !config.only || example.file.includes(config.only));
  if (config.decks) decks = decks.slice(0, config.decks);
  decks = decks.map(({ file, deck }) => ({ id: file.replace(/^examples\//, ''), deck }));
  if (!decks.length) throw new Error('no example deck selected');
  const script = config.scriptEvery > 0 && !config.only ? { id: 'soak/script-corpora.opf.json', deck: await scriptDeck() } : null;
  const stride = Math.ceil(decks.length / config.concurrency);

  const attempts = await blockNetwork();
  const loadStart = performance.now();
  // One handle for the life of the process. `scripts: 'auto'` needs a presentation to load: the first deck (Latin text) loads no script
  // face, so every later deck loads what it needs through `fonts.ensure(deck)`, as a long-lived worker serving arbitrary decks would.
  const fonts = await loadFonts({ pack: 'office', substitutionPolicy: 'visual', scripts: 'auto', presentation: decks[0].deck });
  send({ type: 'ready', worker: config.worker, loadMs: performance.now() - loadStart, pid: process.pid });

  const t0 = performance.now();
  const gc = globalThis.gc ?? null;
  let cursor = 0;
  const timed = async (record, op, fn) => {
    const start = performance.now();
    try { return await fn(); }
    catch (error) { record.errors.push({ op, code: error?.code ?? error?.name, message: String(error?.message ?? error).slice(0, 300) }); return null; }
    finally { record[`${op}Ms`] = round(performance.now() - start, 3); }
  };
  for (let i = 0; i < config.iterations; i++) {
    if (config.duration && performance.now() - t0 > config.duration * 1000) break;
    const entry = script && (i + 1) % config.scriptEvery === 0 ? script : decks[(cursor++ + config.worker * stride) % decks.length];
    const record = { worker: config.worker, i, deck: entry.id, slides: entry.deck.slides.length, errors: [], hashes: {} };
    await timed(record, 'ensure', () => fonts.ensure(entry.deck));
    let svgs = null;
    if (config.ops.includes('svg') || config.ops.includes('png')) {
      svgs = await timed(record, 'svg', () => toSvg(entry.deck, { fonts }));
      if (svgs) record.hashes.svg = svgs.map(svg => sha(svg));
    }
    if (config.ops.includes('png') && svgs) {
      const pngs = await timed(record, 'png', () => toPng(svgs, { fonts }));
      if (pngs) record.hashes.png = pngs.map(png => sha(png));
    }
    if (toPptx) {
      const pptx = await timed(record, 'pptx', () => toPptx(entry.deck, { fonts }));
      if (pptx) record.hashes.pptx = [sha(pptx)];
    }
    svgs = null;
    if ((i + 1) % config.sampleEvery === 0) {
      if (gc) gc();
      const mem = process.memoryUsage();
      record.mem = { t: round(performance.now() - t0, 1), rss: mem.rss, heapUsed: mem.heapUsed, heapTotal: mem.heapTotal, external: mem.external, arrayBuffers: mem.arrayBuffers };
    }
    send({ type: 'job', record });
  }
  send({ type: 'done', worker: config.worker, maxRssKiB: process.resourceUsage().maxRSS, networkAttempts: attempts, gcExposed: gc !== null, wallMs: performance.now() - t0, faces: fonts.fontFiles.length });
}

function send(message) { process.send(message); }

// ----------------------------------------------------------------------------------------------------------------- parent

function environment() {
  const cpus = os.cpus();
  return {
    node: process.version, v8: process.versions.v8, platform: process.platform, arch: process.arch, osRelease: `${os.type()} ${os.release()}`,
    cpu: cpus[0]?.model.trim(), logicalCores: cpus.length, totalMemoryGiB: round(os.totalmem() / 2 ** 30, 1), freeMemoryAtStartGiB: round(os.freemem() / 2 ** 30, 1),
    renderer: JSON.parse(readFileSync(path.join(root, 'package.json'), 'utf8')).version,
  };
}

function pptxStatus(options) {
  if (!options.ops.includes('pptx')) return { enabled: false, reason: 'not requested' };
  const require = createRequire(path.join(root, 'package.json'));
  let pptxEntry;
  try { pptxEntry = require.resolve('@openpresentation/opf-pptx'); }
  catch { return { enabled: false, reason: 'opf-pptx is not installed (npm install --no-save @openpresentation/opf-pptx@<renderer train>)' }; }
  const version = JSON.parse(readFileSync(path.join(path.dirname(pptxEntry), '..', 'package.json'), 'utf8')).version;
  try { createRequire(pptxEntry).resolve('@openpresentation/opf-render/fonts'); }
  catch {
    const target = path.join(root, 'node_modules', '@openpresentation', 'opf-render');
    if (!options.linkRenderer) throw new Error(`opf-pptx ${version} imports the renderer as an optional peer, and ${target} does not exist, so the export would run without the renderer's script planner. Re-run with --link-renderer (links this checkout there), or --ops svg,png.`);
    mkdirSync(path.dirname(target), { recursive: true });
    if (!existsSync(target)) symlinkSync(root, target, 'junction');
  }
  return { enabled: true, version };
}

function runConcurrency(options, concurrency, base) {
  return new Promise((resolve, reject) => {
    const workers = [], jobs = [], done = [], ready = [], errors = [];
    const started = performance.now();
    let exited = 0;
    for (let worker = 0; worker < concurrency; worker++) {
      const config = { ...base, worker, concurrency };
      const child = fork(SELF, ['--worker'], { execArgv: ['--expose-gc'], env: { ...process.env, OPF_SOAK_CONFIG: JSON.stringify(config) }, stdio: ['ignore', 'inherit', 'inherit', 'ipc'] });
      workers.push(child);
      child.on('message', message => {
        if (message.type === 'job') {
          jobs.push(message.record);
          if (jobs.length % 25 === 0) process.stderr.write(`  c${concurrency}: ${jobs.length}/${concurrency * base.iterations} jobs, ${((performance.now() - started) / 1000).toFixed(0)} s\n`);
        } else if (message.type === 'done') done.push(message);
        else if (message.type === 'ready') ready.push(message);
      });
      child.on('error', error => errors.push(error.message));
      child.on('exit', (code, signal) => {
        exited++;
        if (code !== 0) errors.push(`worker ${worker} exited with ${code ?? signal}`);
        if (exited === concurrency) resolve({ concurrency, wallMs: performance.now() - started, jobs, done, ready, errors });
      });
    }
    process.on('SIGINT', () => { for (const child of workers) child.kill(); reject(new Error('interrupted')); });
  });
}

function analyse(run, options) {
  const { concurrency, jobs, done, errors } = run;
  const deckCount = new Set(jobs.map(job => job.deck)).size;
  const warmup = options.warmup ?? Math.min(deckCount, Math.floor(options.iterations / 4));
  const ops = ['ensure', 'svg', 'png', 'pptx'].filter(op => jobs.some(job => job[`${op}Ms`] !== undefined));
  const steady = jobs.filter(job => job.i >= warmup);

  // latency: per job and per slide, whole run and steady state
  const latency = {};
  for (const op of ops) {
    const all = jobs.map(job => job[`${op}Ms`]).filter(Number.isFinite).sort((a, b) => a - b);
    const perSlide = steady.filter(job => Number.isFinite(job[`${op}Ms`])).map(job => job[`${op}Ms`] / job.slides).sort((a, b) => a - b);
    latency[op] = { jobs: all.length, p50Ms: round(percentile(all, 50), 1), p95Ms: round(percentile(all, 95), 1), maxMs: round(all[all.length - 1], 1), steadyPerSlideP50Ms: round(percentile(perSlide, 50), 2), steadyPerSlideP95Ms: round(percentile(perSlide, 95), 2) };
  }
  const total = job => ops.reduce((sum, op) => sum + (job[`${op}Ms`] ?? 0), 0);
  const jobMs = jobs.map(total).sort((a, b) => a - b);
  latency.job = { jobs: jobs.length, p50Ms: round(percentile(jobMs, 50), 1), p95Ms: round(percentile(jobMs, 95), 1), maxMs: round(jobMs[jobMs.length - 1], 1) };
  const slides = jobs.reduce((sum, job) => sum + job.slides, 0);

  // determinism: the first observation of each (deck, op) is the reference; any later difference is drift
  const reference = new Map(), drift = [];
  for (const job of [...jobs].sort((a, b) => a.i - b.i || a.worker - b.worker)) {
    for (const [op, hashes] of Object.entries(job.hashes)) {
      const key = `${job.deck}|${op}`;
      if (!reference.has(key)) { reference.set(key, { hashes, worker: job.worker, i: job.i, seen: 1 }); continue; }
      const first = reference.get(key);
      first.seen++;
      const slideIndexes = hashes.map((hash, index) => hash === first.hashes[index] ? -1 : index + 1).filter(index => index > 0);
      if (hashes.length !== first.hashes.length || slideIndexes.length) drift.push({ deck: job.deck, op, worker: job.worker, iteration: job.i, referenceWorker: first.worker, referenceIteration: first.i, slides: hashes.length === first.hashes.length ? slideIndexes : `slide count ${first.hashes.length} -> ${hashes.length}` });
    }
  }
  const comparisons = [...reference.values()].reduce((sum, entry) => sum + entry.seen - 1, 0);

  // memory growth per worker over the steady-state window
  const workers = [...new Set(jobs.map(job => job.worker))].sort((a, b) => a - b).map(worker => {
    const own = jobs.filter(job => job.worker === worker && job.mem).sort((a, b) => a.i - b.i);
    const window = own.filter(job => job.i >= warmup);
    const finish = done.find(entry => entry.worker === worker);
    const peak = own.reduce((max, job) => Math.max(max, job.mem.rss), 0);
    // latency trend: each job's time over its own deck's median in the window
    const byDeck = new Map();
    for (const job of window) byDeck.set(job.deck, [...(byDeck.get(job.deck) ?? []), total(job)]);
    const medians = new Map([...byDeck].map(([deck, values]) => [deck, median(values)]));
    const normalized = window.map(job => ({ x: job.i, y: total(job) / (medians.get(job.deck) || 1) }));
    let latencyTrend = { samples: normalized.length, grows: false };
    if (normalized.length >= 8) {
      const xs = normalized.map(p => p.x), ys = normalized.map(p => p.y);
      const z = mannKendallZ(ys), slope = theilSen(xs, ys), rise = slope * (xs[xs.length - 1] - xs[0]);
      latencyTrend = { samples: ys.length, mannKendallZ: round(z, 2), risePercent: round(rise * 100, 1), grows: z >= Z_CRITICAL && rise >= LATENCY_RISE };
    }
    return {
      worker, pid: run.ready.find(entry => entry.worker === worker)?.pid, samples: own.length, windowSamples: window.length,
      peakRssMiB: round(Math.max(peak, (finish?.maxRssKiB ?? 0) * 1024) / MIB, 1),
      heapUsed: growthTest(window.map(job => ({ x: job.i, y: job.mem.heapUsed }))),
      rss: growthTest(window.map(job => ({ x: job.i, y: job.mem.rss }))),
      external: growthTest(window.map(job => ({ x: job.i, y: job.mem.external + job.mem.arrayBuffers }))),
      latencyTrend,
      series: own.map(job => ({ i: job.i, t: job.mem.t, rssMiB: round(job.mem.rss / MIB, 1), heapUsedMiB: round(job.mem.heapUsed / MIB, 1), heapTotalMiB: round(job.mem.heapTotal / MIB, 1), externalMiB: round(job.mem.external / MIB, 1) })),
    };
  });

  const failures = jobs.flatMap(job => job.errors.map(error => ({ deck: job.deck, worker: job.worker, iteration: job.i, ...error })));
  const networkAttempts = done.flatMap(entry => entry.networkAttempts.map(what => ({ worker: entry.worker, what })));
  return {
    concurrency, warmupJobs: warmup, jobs: jobs.length, slides, decks: deckCount, wallSeconds: round(run.wallMs / 1000, 1),
    jobsPerSecond: round(jobs.length / (run.wallMs / 1000), 3), slidesPerSecond: round(slides / (run.wallMs / 1000), 2),
    fontLoadMs: run.ready.map(entry => round(entry.loadMs, 0)), facesLoadedAtEnd: done.map(entry => entry.faces), gcExposed: done.every(entry => entry.gcExposed),
    latency, determinism: { comparisons, references: reference.size, drift }, failures, networkAttempts, workerErrors: errors, workers,
    verdict: {
      heapGrows: workers.some(worker => worker.heapUsed.grows), rssGrows: workers.some(worker => worker.rss.grows),
      latencyGrows: workers.some(worker => worker.latencyTrend.grows), deterministic: drift.length === 0,
    },
  };
}

// --------------------------------------------------------------------------------------------------------------- summary

function markdown(report) {
  const { environment: env, options, pptx, runs } = report;
  const lines = [];
  lines.push('# Soak run', '');
  lines.push(`- Node ${env.node} (V8 ${env.v8}), ${env.osRelease}, ${env.platform}/${env.arch}`);
  lines.push(`- CPU: ${env.cpu}, ${env.logicalCores} logical cores; RAM ${env.totalMemoryGiB} GiB (${env.freeMemoryAtStartGiB} GiB free at start)`);
  lines.push(`- opf-render ${env.renderer}${pptx.enabled ? `, opf-pptx ${pptx.version}` : ` (PPTX leg skipped: ${pptx.reason})`}`);
  lines.push(`- One fonts handle per worker process: \`loadFonts({ pack: 'office', substitutionPolicy: 'visual', scripts: 'auto' })\`, no network (guard: ${runs.every(run => !run.networkAttempts.length) ? '0 attempts' : 'ATTEMPTS MADE'})`);
  lines.push(`- ${options.iterations} jobs per worker${options.duration ? `, at most ${options.duration} s` : ''}; a job is \`ensure\` + \`toSvg\` + \`toPng\`${pptx.enabled ? ' + \`toPptx\`' : ''} of one deck (core examples${options.scriptEvery && !options.only ? `, every ${options.scriptEvery}th job the script-corpora deck` : ''}); samples after a forced GC`);
  lines.push(`- Growth criterion: Mann-Kendall z >= ${Z_CRITICAL} and Theil-Sen rise over the steady-state window >= max(${RISE_FRACTION * 100} % of its median, ${RISE_FLOOR / MIB} MiB)`);
  if (options.label) lines.push(`- ${options.label}`);
  lines.push('');
  for (const run of runs) {
    lines.push(`## Concurrency ${run.concurrency}`, '');
    lines.push(`${run.jobs} jobs (${run.slides} slides, ${run.decks} decks) in ${run.wallSeconds} s: ${run.jobsPerSecond} jobs/s, ${run.slidesPerSecond} slides/s; warm-up ${run.warmupJobs} jobs per worker; font load ${run.fontLoadMs.join(', ')} ms.`, '');
    lines.push('| Op | Jobs | p50 ms | p95 ms | max ms | steady ms/slide p50 | steady ms/slide p95 |', '| --- | ---: | ---: | ---: | ---: | ---: | ---: |');
    for (const [op, row] of Object.entries(run.latency)) lines.push(`| ${op} | ${row.jobs} | ${row.p50Ms} | ${row.p95Ms} | ${row.maxMs} | ${row.steadyPerSlideP50Ms ?? ''} | ${row.steadyPerSlideP95Ms ?? ''} |`);
    lines.push('', '| Worker | Peak RSS MiB | RSS median MiB | RSS TS MiB/100 jobs | RSS rise MiB | RSS z | Heap median MiB | Heap TS MiB/100 jobs | Heap rise MiB | Heap z | Latency rise % | Grows |', '| ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |');
    for (const w of run.workers) lines.push(`| ${w.worker} | ${w.peakRssMiB} | ${w.rss.medianMiB} | ${w.rss.theilSenMiBPer100Jobs} | ${w.rss.riseMiB} | ${w.rss.mannKendallZ} | ${w.heapUsed.medianMiB} | ${w.heapUsed.theilSenMiBPer100Jobs} | ${w.heapUsed.riseMiB} | ${w.heapUsed.mannKendallZ} | ${w.latencyTrend.risePercent ?? ''} | ${[w.rss.grows && 'rss', w.heapUsed.grows && 'heap', w.latencyTrend.grows && 'latency'].filter(Boolean).join(', ') || 'no'} |`);
    lines.push('');
    const v = run.verdict;
    lines.push(`- Memory: ${v.heapGrows || v.rssGrows ? `GROWTH (${[v.rssGrows && 'rss', v.heapGrows && 'retained heap'].filter(Boolean).join(' and ')}); see the per-100-jobs slope for a recycle interval` : 'no monotonic growth in rss or retained heap in the steady-state window of any worker'}.`);
    lines.push(`- Latency: ${v.latencyGrows ? 'DRIFTS upward over the window' : 'no upward drift over the window'}.`);
    lines.push(`- Determinism: ${run.determinism.drift.length ? `DRIFT in ${run.determinism.drift.length} comparisons (first: ${JSON.stringify(run.determinism.drift[0])})` : `${run.determinism.comparisons} repeat observations of ${run.determinism.references} (deck, op) outputs matched their first observation byte for byte (hashes of every slide SVG and PNG, and the PPTX)`}.`);
    if (run.failures.length) lines.push(`- Failures: ${run.failures.length} (first: ${JSON.stringify(run.failures[0])}).`);
    if (run.workerErrors.length) lines.push(`- Worker errors: ${run.workerErrors.join('; ')}.`);
    lines.push('');
  }
  return lines.join('\n');
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const pptx = pptxStatus(options);
  const ops = options.ops.filter(op => op !== 'pptx' || pptx.enabled);
  const base = { iterations: options.iterations, duration: options.duration, decks: options.decks, only: options.only, scriptEvery: options.scriptEvery, ops, sampleEvery: options.sampleEvery };
  const report = { schema: 'opf-render-soak-1', startedAt: new Date().toISOString(), options: { ...options, out: undefined }, environment: environment(), pptx, runs: [] };
  for (const concurrency of options.concurrency) {
    process.stderr.write(`soak: concurrency ${concurrency}, ${options.iterations} jobs per worker\n`);
    const run = await runConcurrency(options, concurrency, base);
    report.runs.push(analyse(run, options));
    report.runs[report.runs.length - 1].jobRecords = run.jobs.map(({ mem, ...job }) => job);
  }
  mkdirSync(options.out, { recursive: true });
  const stamp = report.startedAt.replace(/[-:]/g, '').replace(/\..*/, '');
  const jsonPath = path.join(options.out, `soak-${stamp}.json`), mdPath = path.join(options.out, `soak-${stamp}.md`);
  writeFileSync(jsonPath, `${JSON.stringify(report, null, 1)}\n`);
  const summary = markdown(report);
  writeFileSync(mdPath, `${summary}\n`);
  process.stdout.write(`${summary}\n\nreport: ${jsonPath}\nsummary: ${mdPath}\n`);
  const bad = report.runs.some(run => run.determinism.drift.length || run.failures.length || run.networkAttempts.length || run.workerErrors.length);
  process.exitCode = bad ? 1 : 0;
}

const direct = process.argv[1] && path.resolve(process.argv[1]) === SELF;
if (!direct) { /* imported by a test: export the statistics only */ }
else if (process.argv[2] === '--worker') runWorker().catch(error => { process.stderr.write(`soak worker failed: ${error?.stack ?? error}\n`); process.exit(2); });
else main().catch(error => { process.stderr.write(`${error?.message ?? error}\n`); process.exit(2); });
