#!/usr/bin/env node
// NT-05: one command from OPF's decks to the classified result of one native application.
//
//   pnpm native <target> [--tier smoke|release|full] [--decks a,b] [--variants default,native-body] [--baseline <opf version>|none]
//                        [--out <dir>] [--from-run <dir>] [--inputs <dir>] [--previews <dir>] [--warnings-dir <dir>]
//                        [--look deck#slide,...] [--no-sheets] [--write-summary] [--release <x.y.z>] [--force-summary] [--json]
//
// Targets: keynote, powerpoint, impress, powerpoint-mac. The steps (README.md, "One command: pnpm native"):
//   a. select   the decks and variants of the tier (qualification/manifest.json, tiers.mjs) or --decks; the smoke tier adds the
//               decks that unreleased changelog fragments name (`native:`), and every tier hands those slides to the classifier
//   b. build    the selected decks' .pptx files and OPF's previews (qualification/build.mjs) into <out>/build
//   c. check    the target's driver: can this machine run it now (a refusal opens nothing)
//   d. run      per file open -> probe -> render -> resave -> close through the driver into <out>/run (the shared format)
//   e. classify round trip (core/roundtrip), compare with the previews (core/compare), classify (core/classify) against
//               known/<target>.json and the baseline summary runs/<version>/<target>.json; a sheet per new slide
//   f. report   the counts, every new item with its reason and sheet, and what was not run
// --from-run <dir> skips a to d and classifies a run directory another machine's driver (or import-recorded.mjs) wrote.
// --write-summary writes runs/<version>/<target>.json: the workspace's version, or with --release <x.y.z> the version a
// release candidate will be released as (run.json and result.json keep the workspace's version and commit). It never
// replaces a summary unless --force-summary is given. Both work with --from-run.
// Exit: 0 nothing new, 1 something new, 2 refused, not run, or failed to finish.
import { execFileSync, spawnSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, realpathSync } from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { nativeSlides } from '../changelog-fragments.mjs';
import { buildRun, iso, runFile, writeRun } from './apps/keynote/run-file.mjs';
import { classifyRun, UnusableRun } from './core/classify/classify.mjs';
import { readBaseline, summarize, writeSummary } from './core/classify/summary.mjs';
import { compareRun } from './core/compare/compare-run.mjs';
import { slideSheet } from './core/compare/sheet.mjs';
import { fileId, TARGETS } from './core/result/result.mjs';
import { importResaved } from './core/roundtrip/import.mjs';
import { roundTripRun } from './core/roundtrip/roundtrip-run.mjs';
import { decksForTier, sourcesForTier, TIERS } from './qualification/tiers.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
export const ROOT = path.resolve(here, '../..');

export const USAGE = `usage: pnpm native <${TARGETS.join('|')}> [--tier ${TIERS.join('|')}] [--decks a,b] [--variants default,native-body]
                   [--baseline <opf version>|none] [--out <dir>] [--from-run <dir>] [--inputs <dir>] [--previews <dir>]
                   [--warnings-dir <dir>] [--look deck#slide,...] [--no-sheets] [--write-summary] [--release <x.y.z>] [--force-summary] [--json]`;

/** What a target without a driver in this repository says instead of a check. */
export const NO_DRIVER = Object.freeze({
  powerpoint: "the PowerPoint driver runs on the release supervisor's Windows computer and writes a run directory; pass it with --from-run",
  'powerpoint-mac': 'powerpoint-mac: no driver yet, opf#1314',
});

/** A bad command line: exit 2 with the message and the usage. */
export class UsageError extends Error {}

const LOOK = /^([A-Za-z0-9][A-Za-z0-9._/-]*)#([1-9][0-9]*)$/u;
const list = (value) => value.split(',').map((item) => item.trim()).filter(Boolean);

export function parseArgs(argv) {
  const options = { tier: 'smoke', tierGiven: false, look: [], sheets: true, writeSummary: false, json: false };
  const valued = {
    '--tier': 'tier',
    '--decks': 'decks',
    '--variants': 'variants',
    '--baseline': 'baseline',
    '--out': 'out',
    '--from-run': 'fromRun',
    '--inputs': 'inputs',
    '--previews': 'previews',
    '--warnings-dir': 'warningsDir',
    '--look': 'look',
    '--release': 'release',
  };
  const flags = { '--no-sheets': ['sheets', false], '--write-summary': ['writeSummary', true], '--force-summary': ['forceSummary', true], '--json': ['json', true], '--help': ['help', true], '-h': ['help', true] };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (valued[arg]) {
      const value = argv[index + 1];
      if (value === undefined || value.startsWith('--')) throw new UsageError(`${arg} needs a value`);
      index += 1;
      const key = valued[arg];
      if (key === 'look') options.look.push(...list(value));
      else if (key === 'decks' || key === 'variants') options[key] = list(value);
      else options[key] = value;
      if (key === 'tier') options.tierGiven = true;
    } else if (flags[arg]) {
      const [key, value] = flags[arg];
      options[key] = value;
    } else if (arg.startsWith('-')) throw new UsageError(`unknown option ${arg}`);
    else if (options.target) throw new UsageError(`one target only (got ${options.target} and ${arg})`);
    else options.target = arg;
  }
  if (options.help) return options;
  if (!options.target) throw new UsageError('name a target');
  if (!TARGETS.includes(options.target)) throw new UsageError(`unknown target "${options.target}": use ${TARGETS.join(', ')}`);
  if (!TIERS.includes(options.tier)) throw new UsageError(`unknown tier "${options.tier}": use ${TIERS.join(', ')}`);
  for (const key of ['decks', 'variants']) if (options[key] && options[key].length === 0) throw new UsageError(`--${key} names nothing`);
  for (const item of options.look) if (!LOOK.test(item)) throw new UsageError(`--look "${item}" is not deck#slide`);
  if (options.baseline !== undefined && options.baseline !== 'none' && !/^\d+\.\d+\.\d+$/u.test(options.baseline)) throw new UsageError(`--baseline "${options.baseline}" is not an OPF version (such as 0.36.0) or none`);
  if (options.release !== undefined && !/^\d+\.\d+\.\d+$/u.test(options.release)) throw new UsageError(`--release "${options.release}" is not a version (such as 0.37.0)`);
  if (options.release && options.baseline === options.release) throw new UsageError(`--baseline ${options.baseline} is the release this run is for; a run cannot be its own baseline`);
  if (options.fromRun && options.out) throw new UsageError('--from-run classifies that run directory in place; --out does not apply');
  if (options.fromRun && (options.decks || options.variants)) throw new UsageError('--from-run classifies every file of the run directory; --decks and --variants do not apply');
  if (!options.fromRun && (options.inputs || options.previews)) throw new UsageError('--inputs and --previews go with --from-run');
  return options;
}

const variantsOf = (deck) => (deck.variants ?? [{ name: 'default' }]).map((variant) => variant.name);

/**
 * Step a. The files of a run and the slides to look at.
 *   selectFiles({ manifest, tier, decks?, variants?, fragments }) -> { files: [{ deck, variant, id }], look, notRun }
 * fragments: nativeSlides() of changelog-fragments.mjs ([{ fragment, deck, slide }]). look: [{ deck, slide, reason }] for the
 * classifier. notRun: [{ what, reason, blocking }]; a blocking entry makes the run exit 2 (a tier source the runner cannot
 * resolve, unless --decks narrowed the run).
 */
export function selectFiles({ manifest, tier, decks, variants, fragments = [], look = [] }) {
  const byId = new Map(manifest.decks.map((deck) => [deck.id, deck]));
  const rule = manifest.tiers?.[tier]?.variants ?? 'default';
  const pickVariants = (deck, wanted) => {
    const all = variantsOf(deck);
    if (variants) return all.filter((name) => variants.includes(name));
    return wanted ?? (rule === 'all' ? all : ['default']);
  };
  const notRun = [];
  const picked = new Map();
  if (decks) {
    for (const id of decks) {
      const deck = byId.get(id);
      if (!deck) throw new UsageError(`--decks: no deck "${id}" in qualification/manifest.json`);
      picked.set(id, pickVariants(deck));
    }
  } else {
    for (const entry of decksForTier(manifest, tier)) picked.set(entry.deck, pickVariants(byId.get(entry.deck), variants ? undefined : entry.variants));
  }
  for (const source of sourcesForTier(manifest, tier)) {
    if (source === 'native-fragments') {
      for (const { fragment, deck } of fragments) {
        if (decks || picked.has(deck)) continue;
        if (byId.has(deck)) picked.set(deck, pickVariants(byId.get(deck), variants ? undefined : ['default']));
        else notRun.push({ what: `deck ${deck}`, reason: `named by changes/${fragment}.md, but not a deck of qualification/manifest.json (the builder exports the manifest's decks only)`, blocking: !decks });
      }
    } else {
      notRun.push({ what: `source ${source}`, reason: `${manifest.sources?.[source] ?? 'a tier source'} The runner cannot build it yet.${decks ? ' (--decks narrowed the run.)' : ''}`, blocking: !decks });
    }
  }
  const files = [];
  for (const [deck, names] of picked) for (const variant of names) files.push({ deck, variant, id: fileId(deck, variant) });
  if (files.length === 0) throw new UsageError(`nothing to run: no selected deck has the variants ${variants?.join(', ')}`);
  return { files, look: lookSlides(fragments, look), notRun };
}

/** The slides the classifier calls new whatever their score: the fragments' `native:` slides and --look. */
export function lookSlides(fragments = [], look = []) {
  return [...fragments.map(({ fragment, deck, slide }) => ({ deck, slide, reason: `changes/${fragment}.md` })), ...look.map((item) => ({ deck: item.split('#')[0], slide: Number(item.split('#')[1]), reason: '--look' }))];
}

/**
 * The look list as the classifier matches it (on the result's deck). Impress's run directory names a file by the LibreOffice
 * runner's case id ("q-<deck>" or "q-<deck>.<variant>", apps/impress/from-libreoffice.mjs), so a slide is listed under those too.
 */
export function lookForTarget(target, look, manifest) {
  if (target !== 'impress') return look;
  const byId = new Map(manifest.decks.map((deck) => [deck.id, deck]));
  return look.flatMap((item) => {
    const deck = byId.get(item.deck);
    const names = deck ? variantsOf(deck).map((variant) => (variant === 'default' ? `q-${item.deck}` : `q-${item.deck}.${variant}`)) : [`q-${item.deck}`];
    return [item, ...names.map((name) => ({ ...item, deck: name }))];
  });
}

/** The qualification deck behind an Impress file's deck ("q-smartart.shapes" -> "smartart"). */
export const impressDeck = (deck) => String(deck).replace(/^q-/u, '').replace(/\..*$/u, '');

const compareVersions = (a, b) => {
  const x = a.split('.').map(Number);
  const y = b.split('.').map(Number);
  for (let i = 0; i < 3; i += 1) if (x[i] !== y[i]) return x[i] - y[i];
  return 0;
};

/**
 * The baseline summary: `none` -> null; a version -> runs/<version>/<target>.json (must exist); absent -> the newest version
 * under runs/ that has this target (below `release` when one is given: a run is never its own baseline), or null.
 * Returns { version, file } or null.
 */
export function resolveBaseline(target, requested, runsDir, release = null) {
  if (requested === 'none') return null;
  if (requested) {
    const file = path.join(runsDir, requested, `${target}.json`);
    if (!existsSync(file)) throw new UsageError(`--baseline ${requested}: there is no runs/${requested}/${target}.json`);
    return { version: requested, file };
  }
  const versions = existsSync(runsDir)
    ? readdirSync(runsDir)
        .filter((name) => /^\d+\.\d+\.\d+$/u.test(name) && existsSync(path.join(runsDir, name, `${target}.json`)) && (!release || compareVersions(name, release) < 0))
        .sort(compareVersions)
    : [];
  const version = versions.at(-1);
  return version ? { version, file: path.join(runsDir, version, `${target}.json`) } : null;
}

/** The workspace's OPF: the CLI package's version, the checkout's commit, and whether the packages are built. */
export function workspace(root = ROOT) {
  const version = JSON.parse(readFileSync(path.join(root, 'packages/cli/package.json'), 'utf8')).version;
  let commit = null;
  try {
    commit = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  } catch {
    // Not a git checkout: the commit stays unknown.
  }
  return { version, commit, built: existsSync(path.join(root, 'packages/cli/dist/index.js')) };
}

/** True when `dir` is the repository or inside it (also through a symlink). */
export function insideRepository(dir, root = ROOT) {
  const real = (file) => {
    let existing = path.resolve(file);
    const rest = [];
    while (!existsSync(existing) && path.dirname(existing) !== existing) {
      rest.unshift(path.basename(existing));
      existing = path.dirname(existing);
    }
    return path.join(realpathSync(existing), ...rest);
  };
  const roots = [path.resolve(root), real(root)];
  return [path.resolve(dir), real(dir)].some((candidate) => roots.some((base) => candidate === base || candidate.startsWith(`${base}${path.sep}`)));
}

/** The default output folder: ~/opf-work/native/<target>-<date>-<time> where ~/opf-work exists, else <tmp>/opf-native/... (UTC). */
export function defaultOut(target, now, { home = homedir(), temp = tmpdir() } = {}) {
  const stamp = now
    .toISOString()
    .replace(/\.\d{3}Z$/u, '')
    .replace(/[-:]/gu, '')
    .replace('T', '-');
  const base = existsSync(path.join(home, 'opf-work')) ? path.join(home, 'opf-work', 'native') : path.join(temp, 'opf-native');
  return path.join(base, `${target}-${stamp}`);
}

/** The builder, as a process: qualification/build.mjs --out <dir> --only <decks>. Returns { status }. */
export function buildDecks({ out, decks, root = ROOT, quiet = false }) {
  const answer = spawnSync(process.execPath, [path.join(root, 'scripts/native-acceptance/qualification/build.mjs'), '--out', out, '--only', decks.join(',')], { cwd: root, stdio: ['ignore', quiet ? 2 : 'inherit', 'inherit'] });
  if (answer.error) throw answer.error;
  return { status: answer.status };
}

/** Where LibreOffice is, the way scripts/libreoffice/run.mjs looks: the pinned program, else soffice on PATH. */
export function findSoffice({ root = ROOT, env = process.env } = {}) {
  const pinned = JSON.parse(readFileSync(path.join(root, 'scripts/libreoffice/environment.json'), 'utf8')).libreoffice.program;
  if (existsSync(pinned)) return { program: pinned, pinned };
  for (const folder of String(env.PATH ?? '').split(path.delimiter).filter(Boolean)) {
    const candidate = path.join(folder, 'soffice');
    if (existsSync(candidate)) return { program: candidate, pinned };
  }
  return { program: null, pinned };
}

const readJson = (file) => JSON.parse(readFileSync(file, 'utf8'));

/** The known records of a target, or an empty list (and a note) when the target has none yet. */
export function knownFor(target, knownDir) {
  const file = path.join(knownDir, `${target}.json`);
  if (existsSync(file)) return { known: readJson(file), note: null };
  return { known: { schemaVersion: 1, target, records: [] }, note: `there is no known/${target}.json: classified with an empty list of known records` };
}

/** Defaults for everything the run touches outside its folders; tests replace them. */
function defaults(deps) {
  return {
    root: ROOT,
    log: console.log,
    error: console.error,
    now: () => new Date(),
    manifest: () => readJson(path.join(ROOT, 'scripts/native-acceptance/qualification/manifest.json')),
    fragments: () => nativeSlides(ROOT),
    workspace: () => workspace(ROOT),
    build: buildDecks,
    loadDriver: (target) => import(`./apps/${target}/driver.mjs`),
    soffice: () => findSoffice({ root: ROOT }),
    importer: importResaved,
    knownDir: path.join(here, 'known'),
    runsDir: path.join(here, 'runs'),
    home: homedir(),
    temp: tmpdir(),
    ...deps,
  };
}

const seconds = (from, to) => Math.round((to - from) / 100) / 10;

/**
 * The whole command; returns { exit, report }. deps (tests): { log, error, now, manifest(), fragments(), workspace(), build(),
 * loadDriver(target), soffice(), importer, knownDir, runsDir, home, temp }.
 */
export async function runNative(argv, deps = {}) {
  const d = defaults(deps);
  let options;
  try {
    options = parseArgs(argv);
  } catch (problem) {
    d.error(`pnpm native: ${problem.message}\n${USAGE}`);
    return { exit: 2, report: { error: problem.message } };
  }
  if (options.help) {
    d.log(USAGE);
    return { exit: 0, report: {} };
  }
  const say = options.json ? d.error : d.log;
  const report = { target: options.target, tier: options.tier, fromRun: Boolean(options.fromRun), steps: [], notRun: [], notes: [], exit: 2 };
  const finish = (exit) => {
    report.exit = exit;
    if (options.json) d.log(JSON.stringify(report, null, 2));
    return { exit, report };
  };
  const refuse = (step, reasons) => {
    report.refused = { step, reasons };
    d.error(`pnpm native: ${step} refused; nothing was opened:`);
    for (const reason of reasons) d.error(`  - ${reason}`);
    return finish(2);
  };
  const step = async (name, work) => {
    const started = d.now();
    say(`[${name}] ...`);
    const entry = { name, status: 'done' };
    report.steps.push(entry);
    try {
      const value = await work(entry);
      return value;
    } catch (problem) {
      entry.status = 'failed';
      entry.message = problem.message;
      throw problem;
    } finally {
      entry.seconds = seconds(started, d.now());
      say(`[${name}] ${entry.status} in ${entry.seconds} s${entry.message ? `: ${entry.message}` : ''}`);
    }
  };

  const manifest = d.manifest();
  const { target } = options;
  let runDir;
  let inputRoot = null;
  let previewRoot = null;
  let look = [];
  let stopped = false;
  let baseline;
  try {
    baseline = resolveBaseline(target, options.baseline, d.runsDir, options.release ?? null);
  } catch (problem) {
    d.error(`pnpm native: ${problem.message}`);
    return finish(2);
  }
  report.baseline = baseline?.version ?? null;
  report.release = options.release ?? null;

  if (options.fromRun) {
    runDir = path.resolve(options.fromRun);
    if (insideRepository(runDir, d.root)) {
      d.error('pnpm native: --from-run must be outside the repository (raw evidence stays out of it)');
      return finish(2);
    }
    if (!existsSync(path.join(runDir, 'run.json'))) {
      d.error(`pnpm native: ${runDir} has no run.json (a run directory of the shared format: core/result/README.md)`);
      return finish(2);
    }
    const run = readJson(path.join(runDir, 'run.json'));
    if (run.target !== target) {
      d.error(`pnpm native: ${runDir} is a ${run.target} run, not ${target}`);
      return finish(2);
    }
    report.runDir = runDir;
    report.tier = options.tierGiven ? options.tier : (run.tier ?? null);
    await step('select', (entry) => {
      look = lookSlides(d.fragments(), options.look);
      entry.message = `every file of the run directory${look.length ? `, ${look.length} slide(s) to look at` : ''}`;
    });
    const sibling = path.dirname(runDir);
    inputRoot = options.inputs ? path.resolve(options.inputs) : [path.join(sibling, 'build'), path.join(sibling, 'inputs'), path.join(runDir, 'inputs')].find((dir) => existsSync(dir)) ?? null;
    previewRoot = options.previews ? path.resolve(options.previews) : [path.join(runDir, 'preview'), path.join(sibling, 'build', 'preview')].find((dir) => existsSync(dir)) ?? null;
  } else {
    // a. select
    let selection;
    try {
      selection = await step('select', (entry) => {
        const chosen = selectFiles({ manifest, tier: options.tier, decks: options.decks, variants: options.variants, fragments: d.fragments(), look: options.look });
        entry.message = `${chosen.files.length} file(s) from ${new Set(chosen.files.map((file) => file.deck)).size} deck(s)${chosen.look.length ? `, ${chosen.look.length} slide(s) to look at` : ''}`;
        return chosen;
      });
    } catch (problem) {
      d.error(`pnpm native: ${problem.message}`);
      return finish(2);
    }
    look = selection.look;
    report.notRun.push(...selection.notRun);
    report.files = selection.files.map((file) => file.id);

    // c, before the build: a machine that cannot run the target spends no time building.
    if (NO_DRIVER[target]) return refuse('check', [NO_DRIVER[target]]);
    let soffice;
    if (target === 'impress') {
      soffice = d.soffice();
      if (!soffice.program) {
        return refuse('check', [`LibreOffice is not installed here: neither ${soffice.pinned} (scripts/libreoffice/environment.json) nor soffice on PATH. Impress runs on GitHub's runners (scripts/libreoffice/install.sh); pass their run directory with --from-run.`]);
      }
    }
    const out = path.resolve(options.out ?? defaultOut(target, d.now(), { home: d.home, temp: d.temp }));
    if (insideRepository(out, d.root)) {
      d.error('pnpm native: --out must be outside the repository (raw evidence stays out of it)');
      return finish(2);
    }
    if (existsSync(out) && readdirSync(out).length > 0) {
      d.error(`pnpm native: ${out} is not empty; name a new folder with --out`);
      return finish(2);
    }
    report.out = out;
    runDir = path.join(out, 'run');
    report.runDir = runDir;
    const ws = d.workspace();
    if (!ws.built) {
      d.error('pnpm native: the workspace is not built (packages/cli/dist/index.js is missing): run pnpm build:packages, then run this again');
      return finish(2);
    }
    const opf = { version: ws.version, ...(ws.commit ? { commit: ws.commit } : {}) };
    report.opf = opf;

    let driver;
    let ctx;
    if (target === 'keynote') {
      driver = await d.loadDriver(target);
      const warningsText = options.warningsDir
        ? (id) => {
            const file = path.join(options.warningsDir, `${id}.txt`);
            return existsSync(file) ? readFileSync(file, 'utf8') : null;
          }
        : undefined;
      ctx = driver.createContext({ runDir, warningsText });
      const first = await step('check', async (entry) => {
        const answer = await driver.check(ctx);
        entry.status = answer.status;
        return answer;
      });
      if (first.status !== 'ready') return refuse('check', first.reasons);
      report.application = first.facts.application;
    }

    // b. build
    const buildDir = path.join(out, 'build');
    inputRoot = buildDir;
    previewRoot = path.join(buildDir, 'preview');
    const decks = [...new Set(selection.files.map((file) => file.deck))];
    let built;
    try {
      built = await step('build', (entry) => {
        mkdirSync(buildDir, { recursive: true });
        const answer = d.build({ out: buildDir, decks, root: d.root, quiet: options.json });
        const file = path.join(buildDir, 'build.json');
        if (!existsSync(file)) throw new Error(`the builder wrote no build.json (exit ${answer.status})`);
        const record = readJson(file);
        const inputs = [];
        for (const chosen of selection.files) {
          const deck = record.decks.find((item) => item.id === chosen.deck);
          const variant = deck?.variants.find((item) => item.name === chosen.variant);
          if (!variant?.ok) {
            report.notRun.push({ what: `file ${chosen.id}`, reason: `the export failed${variant?.error ? `: ${String(variant.error?.message ?? JSON.stringify(variant.error)).slice(0, 300)}` : ''}`, blocking: true });
            continue;
          }
          if (!deck.previewOk) report.notRun.push({ what: `preview of ${chosen.deck}`, reason: "OPF's preview failed, so its slides are not compared", blocking: true });
          inputs.push({ path: path.join(buildDir, variant.pptx), relativePath: variant.pptx, deck: chosen.deck, variant: chosen.variant, id: chosen.id });
        }
        entry.message = `${inputs.length} file(s), ${record.decks.reduce((sum, deck) => sum + (deck.previewSlides ?? 0), 0)} preview slide(s) in ${buildDir}`;
        if (inputs.length === 0) throw new Error('no file was exported');
        return inputs;
      });
    } catch (problem) {
      d.error(`pnpm native: build: ${problem.message}`);
      return finish(2);
    }

    if (target === 'impress') {
      const cases = built.map((input) => (input.variant === 'default' ? `q-${input.deck}` : `q-${input.deck}~${input.variant}`));
      const lo = path.join(out, 'libreoffice');
      return refuse('check', [
        `LibreOffice is here (${soffice.program}), but pnpm native does not start the LibreOffice runner yet. Run it, then classify its native/ folder:`,
        `node scripts/libreoffice/run.mjs --qualification ${buildDir} --case ${cases.join(',')} --profiles opf --no-control --out ${lo}`,
        `pnpm native impress --from-run ${path.join(lo, 'native')} --inputs ${path.join(lo, 'inputs')} --previews ${previewRoot}`,
      ]);
    }

    // d. run
    try {
      await step('run', async (entry) => {
        const started = iso(d.now());
        const results = [];
        for (const input of built) {
          const again = await driver.check(ctx);
          if (again.status !== 'ready') {
            report.notRun.push({ what: `file ${input.id} and the files after it`, reason: `check refused before it: ${again.reasons.join('; ')}`, blocking: true });
            stopped = true;
            break;
          }
          const done = await runFile(ctx, input, { opf, driver, target });
          results.push(done.result);
          const { verbs } = done.result;
          say(`  ${input.id}\topen ${verbs.open.status}\tprobe ${verbs.probe.status}\trender ${verbs.render.status}\tresave ${verbs.resave.status}\tclose ${done.close.status}`);
          for (const verb of ['open', 'probe', 'render', 'resave']) if (verbs[verb].message) say(`    ${verb}: ${verbs[verb].message}`);
          if (!done.validation.ok) throw new Error(`${input.id}: result.json does not validate: ${done.validation.errors.join('; ')}`);
          if (done.stop) {
            report.notRun.push({ what: `the files after ${input.id}`, reason: done.close.status !== 'done' && done.close.status !== 'not-run' ? `its document did not close (${done.close.message ?? done.close.state}); close it by hand` : `open did not finish; look at ${ctx.facts.application?.name ?? 'the application'} before the next run`, blocking: true });
            stopped = true;
            break;
          }
        }
        const run = buildRun(ctx, { opf, started, check: { status: 'ready', reasons: [] }, results, target, tier: options.tier, baseline: baseline?.version ?? null });
        const validation = writeRun(ctx, run);
        if (!validation.ok) throw new Error(`run.json does not validate: ${validation.errors.join('; ')}`);
        entry.message = `${results.length} of ${built.length} file(s) into ${runDir}`;
        if (results.length === 0) throw new Error('no file was run');
      });
    } catch (problem) {
      d.error(`pnpm native: run: ${problem.message}`);
      return finish(2);
    }
  }

  // e. round trip, compare, classify, sheets
  const results = () => readJson(path.join(runDir, 'run.json')).files.map((entry) => readJson(path.join(runDir, entry.result)));
  let classified;
  try {
    await step('round trip', (entry) => {
      const pending = results().filter((result) => !result.verbs.resave.import);
      if (pending.length === 0) {
        entry.message = 'kept: every file was round-tripped before';
        return;
      }
      if (!inputRoot) throw new Error('no exported files to compare the copies with: pass --inputs <the folder that file.path in result.json is relative to>');
      if (!d.workspace().built) throw new Error("the workspace is not built, so OPF cannot import the application's copies: run pnpm build:packages");
      const done = roundTripRun(runDir, inputRoot, { importer: d.importer, keepDone: true });
      const count = (status) => done.files.filter((file) => file.status === status).length;
      entry.message = `${count('done')} file(s) compared, ${count('kept')} kept, ${count('not-run')} without a copy or input`;
    });
    await step('compare', async (entry) => {
      const all = results();
      const compared = all.every((result) => result.slides.every((slide) => !slide.picture || slide.compare));
      // A run directory that was compared before keeps its scores unless --previews names the previews again.
      if (compared && options.fromRun && !options.previews) {
        entry.message = 'kept: every slide was compared before (pass --previews to compare again)';
        return;
      }
      if (!previewRoot) throw new Error('no OPF previews: pass --previews <folder of <deck>/slide-<n>.png>');
      let root = previewRoot;
      if (target === 'impress') root = impressPreviews(runDir, previewRoot, all);
      const summary = await compareRun(runDir, { preview: root });
      entry.message = `${summary.compared} slide(s) compared, ${summary.unpaired} without a pair`;
    });
    const { known, note } = knownFor(target, d.knownDir);
    if (note) report.notes.push(note);
    classified = await step('classify', (entry) => {
      const value = classifyRun({ runDir, known, baseline: baseline ? readBaseline(baseline.file) : null, options: { look: lookForTarget(target, look, manifest) } });
      entry.message = `known records: ${known.records.length}; baseline: ${baseline ? `runs/${baseline.version}/${target}.json` : 'none'}`;
      return value;
    });
  } catch (problem) {
    report.error = problem instanceof UnusableRun ? `the run directory cannot be classified: ${problem.message}` : problem.message;
    d.error(`pnpm native: ${report.error}`);
    return finish(2);
  }

  const newItems = [];
  for (const file of classified.files) {
    for (const slide of file.slides.filter((item) => item.class === 'new')) newItems.push({ file: file.id, slide: slide.index, score: slide.score, ...(slide.direction ? { direction: slide.direction } : {}), reason: slide.reasons.join('; ') });
    for (const finding of file.findings.filter((item) => item.class === 'new')) newItems.push({ file: file.id, finding: finding.kind, text: finding.text, reason: finding.reasons.join('; ') });
  }
  if (options.sheets) {
    const sheetable = newItems.filter((item) => item.slide && item.score !== null);
    if (sheetable.length > 0) {
      await step('sheets', async (entry) => {
        let written = 0;
        for (const item of sheetable) {
          try {
            item.sheet = await slideSheet(runDir, item.file, item.slide, { caption: item.reason });
            written += 1;
          } catch (problem) {
            item.sheetError = problem.message;
          }
        }
        entry.message = `${written} sheet(s) in ${path.join(runDir, 'sheets')}`;
      });
    }
  }

  // f. report
  const all = results();
  const { counts } = classified;
  const warningsNew = classified.files.flatMap((file) => file.findings.filter((finding) => finding.kind === 'warning' && finding.class === 'new')).length;
  report.application ??= all[0]?.application ?? null;
  report.opf ??= all[0]?.opf ?? null;
  report.counts = {
    files: all.length,
    opened: all.filter((result) => result.verbs.open.status === 'done').length,
    slides: counts.slides,
    findings: counts.findings,
    newWarnings: warningsNew,
    knownGone: classified.knownGone.length,
    new: counts.new,
  };
  report.new = newItems;
  report.knownGone = classified.knownGone;

  // A verb that did not finish on a file that opened leaves slides uncompared or a copy unchecked: the run did not finish.
  for (const result of all) {
    if (result.verbs.open.status !== 'done') continue;
    for (const verb of ['probe', 'render', 'resave']) {
      const { status, message } = result.verbs[verb];
      if (status !== 'done') report.notRun.push({ what: `${verb} of ${result.file.id}`, reason: `${status}${message ? `: ${message}` : ''}`, blocking: true });
    }
  }
  const blocking = report.notRun.some((item) => item.blocking) || stopped;
  let exit = blocking ? 2 : counts.new > 0 ? 1 : 0;
  if (options.writeSummary) {
    if (exit === 2) report.notes.push('--write-summary: not written, the run did not finish (exit 2)');
    else {
      // run.json and every result.json keep the workspace's version and commit; a release candidate's summary is named
      // after the release it will become (--release), with the candidate's commit.
      const run = readJson(path.join(runDir, 'run.json'));
      const opf = options.release ? { version: options.release, ...(run.opf.commit ? { commit: run.opf.commit } : {}) } : run.opf;
      const file = path.join(d.runsDir, opf.version, `${target}.json`);
      try {
        if (existsSync(file) && !options.forceSummary) throw new Error(`not written: ${file} exists and would be replaced; pass --force-summary to replace it`);
        mkdirSync(path.dirname(file), { recursive: true });
        writeSummary(file, summarize({ run: { ...run, opf }, results: all, classified: classified.files, settings: classified.settings }));
        report.summary = file;
        if (counts.new > 0) report.notes.push(`the summary keeps ${counts.new} new item(s) as new: they stay new in the next run until a known record or a fix covers them`);
      } catch (problem) {
        report.notes.push(`--write-summary: ${problem.message}`);
        exit = 2;
      }
    }
  }
  if (!options.json) printReport(report, d.log);
  return finish(exit);
}

/** Impress: OPF's previews under the run's own preview/<file deck>/, copied from preview/<qualification deck>/. */
function impressPreviews(runDir, previewRoot, results) {
  const target = path.join(runDir, 'preview');
  for (const deck of new Set(results.map((result) => result.file.deck))) {
    const from = path.join(previewRoot, impressDeck(deck));
    const to = path.join(target, deck);
    if (!existsSync(from) || path.resolve(from) === path.resolve(to)) continue;
    mkdirSync(to, { recursive: true });
    for (const name of readdirSync(from).filter((item) => /^slide-\d+\.png$/u.test(item))) if (!existsSync(path.join(to, name))) copyFileSync(path.join(from, name), path.join(to, name));
  }
  return target;
}

function table(rows) {
  const width = Math.max(...rows.map(([label]) => label.length));
  return rows.map(([label, value]) => `  ${label.padEnd(width)}  ${value}`);
}

/** "OPF 0.37.0 abc123456", or with --release "OPF workspace 0.36.0 at abc123456, release candidate 0.37.0". */
export function opfLine({ opf, release }) {
  const commit = opf?.commit ? opf.commit.slice(0, 9) : null;
  if (!release) return `OPF ${opf?.version ?? '?'}${commit ? ` ${commit}` : ''}`;
  return `OPF workspace ${opf?.version ?? '?'}${commit ? ` at ${commit}` : ''}, release candidate ${release}`;
}

/** Step f as text. */
export function printReport(report, log) {
  const { counts } = report;
  log('');
  log(`${report.target}${report.application ? ` (${report.application.name} ${report.application.version}${report.application.build ? ` ${report.application.build}` : ''})` : ''}, ${opfLine(report)}, tier ${report.tier ?? 'none'}, baseline ${report.baseline ?? 'none'}`);
  for (const line of table([
    ['files opened', `${counts.opened} of ${counts.files}`],
    ['slides same', counts.slides.same],
    ['known and still there', counts.slides['known-present']],
    ['known and gone', counts.slides['known-gone']],
    ['new', counts.slides.new],
    ['not compared', counts.slides['not-compared']],
    ['file findings', `${counts.findings['known-present']} known, ${counts.findings.new} new`],
    ['new import-warning lines', counts.newWarnings],
  ]))
    log(line);
  if (report.new.length > 0) {
    log('');
    log('New (look at each, then record it in known/<target>.json or fix it):');
    for (const item of report.new) {
      if (item.slide) log(`  ${item.file} slide ${item.slide} (score ${item.score}${item.direction ? `, ${item.direction}` : ''}): ${item.reason}${item.sheet ? `\n    sheet: ${item.sheet}` : item.sheetError ? `\n    no sheet: ${item.sheetError}` : ''}`);
      else log(`  ${item.file} ${item.finding}: ${item.text}\n    ${item.reason}`);
    }
  }
  if (report.notRun.length > 0) {
    log('');
    log('Not run:');
    for (const item of report.notRun) log(`  not run: ${item.what}: ${item.reason}`);
  }
  for (const note of report.notes) log(`note: ${note}`);
  if (report.summary) log(`summary written: ${report.summary}`);
  log(`run directory: ${report.runDir}`);
}

export async function main(argv, deps) {
  const { exit } = await runNative(argv, deps);
  return exit;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main(process.argv.slice(2)).then(
    (code) => {
      process.exitCode = code;
    },
    (problem) => {
      console.error(problem.stack ?? problem.message);
      process.exitCode = 2;
    },
  );
}
