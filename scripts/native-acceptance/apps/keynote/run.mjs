#!/usr/bin/env node
// NT-02: run OPF-exported .pptx files through Keynote with the driver, one after another, into a run directory of the
// shared format. The general entry point (`pnpm native`, NT-05) comes later; this command is the driver's own.
//
//   node scripts/native-acceptance/apps/keynote/run.mjs --out <dir> --opf <version> [--opf-commit <sha>]
//        [--input-root <dir>] [--warnings-dir <dir>] <file.pptx>...
//
// check() runs before every file (as the 0.36.0 round's guards did); a refusal stops the run with exit code 2 and the
// reasons. Exit 0: every verb of every file done; 1: some verb did not finish; 2: refused, bad arguments, or stopped (an
// open that timed out, a document of the run's own that would not close).
// --warnings-dir: <dir>/<fileId>.txt holds the text of Keynote's Warnings window for that file, read by someone who could
// see it; without one the file's import warnings are "not-read".
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { fileId } from '../../core/result/result.mjs';
import { check, createContext } from './driver.mjs';
import { buildRun, iso, runFile, writeRun } from './run-file.mjs';

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..');
const VARIANTS = new Set(['default', 'native', 'static', 'picture', 'shapes', 'native-body']);

const usage = 'usage: run.mjs --out <dir> --opf <version> [--opf-commit <sha>] [--input-root <dir>] [--warnings-dir <dir>] <file.pptx>...';

export function parseArgs(argv) {
  const options = { files: [] };
  const valued = { '--out': 'out', '--opf': 'opf', '--opf-commit': 'opfCommit', '--input-root': 'inputRoot', '--warnings-dir': 'warningsDir' };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (valued[arg]) {
      if (index + 1 >= argv.length) throw new Error(`${arg} needs a value`);
      options[valued[arg]] = argv[++index];
    } else if (arg.startsWith('--')) throw new Error(`unknown option ${arg}`);
    else options.files.push(arg);
  }
  if (!options.out || !options.opf || options.files.length === 0) throw new Error(usage);
  return options;
}

const namePart = (text) =>
  text
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/gu, '-')
    .replace(/^-+|-+$/gu, '') || 'file';

/** deck and variant from a path: <deck>/<variant>.pptx for an export variant's name, <deck>~<variant>.pptx, else <deck>.pptx. */
export function deckAndVariant(file) {
  const base = path.basename(file).replace(/\.pptx$/iu, '');
  if (base.includes('~')) {
    const [deck, variant] = base.split('~');
    return { deck: namePart(deck), variant: namePart(variant) };
  }
  if (VARIANTS.has(base.toLowerCase())) return { deck: namePart(path.basename(path.dirname(file))), variant: base.toLowerCase() };
  return { deck: namePart(base), variant: 'default' };
}

function commonRoot(files) {
  const parts = files.map((file) => path.dirname(file).split(path.sep));
  const shared = [];
  for (let index = 0; parts.every((list) => index < list.length && list[index] === parts[0][index]); index += 1) shared.push(parts[0][index]);
  return shared.join(path.sep) || path.sep;
}

/** The inputs with their ids and paths relative to the input root; throws on a missing file or a repeated id. */
export function planInputs(files, inputRoot) {
  const absolute = files.map((file) => path.resolve(file));
  const root = path.resolve(inputRoot ?? commonRoot(absolute));
  const seen = new Map();
  return absolute.map((file) => {
    if (!existsSync(file)) throw new Error(`no such file: ${file}`);
    const relative = path.relative(root, file);
    if (relative.startsWith('..') || path.isAbsolute(relative)) throw new Error(`${file} is not under the input root ${root}`);
    const { deck, variant } = deckAndVariant(file);
    const id = fileId(deck, variant);
    if (seen.has(id)) throw new Error(`${file} and ${seen.get(id)} both become ${id}`);
    seen.set(id, file);
    return { path: file, relativePath: relative.split(path.sep).join('/'), deck, variant, id };
  });
}

export async function main(argv, { exec, machine, now, log = console.log, error = console.error } = {}) {
  let options;
  let inputs;
  try {
    options = parseArgs(argv);
    inputs = planInputs(options.files, options.inputRoot);
  } catch (problem) {
    error(`run.mjs: ${problem.message}`);
    return 2;
  }
  const runDir = path.resolve(options.out);
  if (runDir === repositoryRoot || runDir.startsWith(`${repositoryRoot}${path.sep}`)) {
    error('run.mjs: --out must be outside the repository (raw evidence stays out of it)');
    return 2;
  }
  const opf = { version: options.opf, ...(options.opfCommit ? { commit: options.opfCommit } : {}) };
  const warningsText = options.warningsDir
    ? (id) => {
        const file = path.join(options.warningsDir, `${id}.txt`);
        return existsSync(file) ? readFileSync(file, 'utf8') : null;
      }
    : undefined;
  const ctx = createContext({ runDir, ...(exec ? { exec } : {}), ...(machine ? { machine } : {}), ...(now ? { now } : {}), warningsText });
  const started = iso(ctx.now());
  const first = await check(ctx);
  if (first.status !== 'ready') {
    error('run.mjs: check refused; nothing was opened:');
    for (const reason of first.reasons) error(`  - ${reason}`);
    return 2;
  }
  log(`Keynote ${first.facts.application.version}${first.facts.application.build ? ` (${first.facts.application.build})` : ''} on macOS ${first.facts.system.version}; ${inputs.length} file(s) into ${runDir}`);
  const results = [];
  let exit = 0;
  for (const [position, input] of inputs.entries()) {
    if (position > 0) {
      const again = await check(ctx);
      if (again.status !== 'ready') {
        error(`run.mjs: check refused before ${input.id}; stopping:`);
        for (const reason of again.reasons) error(`  - ${reason}`);
        exit = 2;
        break;
      }
    }
    const done = await runFile(ctx, input, { opf });
    results.push(done.result);
    const { verbs } = done.result;
    log(`${input.id}\topen ${verbs.open.status}\tprobe ${verbs.probe.status}\trender ${verbs.render.status}\tresave ${verbs.resave.status}\tclose ${done.close.status}\tunchanged ${done.result.file.unchangedAfterRun}`);
    for (const verb of ['open', 'probe', 'render', 'resave']) if (verbs[verb].message) log(`  ${verb}: ${verbs[verb].message}`);
    if (!done.validation.ok) {
      error(`run.mjs: ${input.id}: result.json does not validate:`);
      for (const line of done.validation.errors) error(`  ${line}`);
      exit = Math.max(exit, 1);
    }
    if (Object.values(verbs).some((verb) => verb.status !== 'done')) exit = Math.max(exit, 1);
    if (done.stop) {
      error(`run.mjs: stopping after ${input.id}: ${done.close.status !== 'done' && done.close.status !== 'not-run' ? `its document did not close (${done.close.message ?? done.close.state}); close it by hand` : 'open did not finish; look at Keynote before the next run'}`);
      exit = 2;
      break;
    }
  }
  const validation = writeRun(ctx, buildRun(ctx, { opf, started, check: first, results }));
  if (!validation.ok) {
    error('run.mjs: run.json does not validate:');
    for (const line of validation.errors) error(`  ${line}`);
    exit = Math.max(exit, 1);
  }
  return exit;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exitCode = await main(process.argv.slice(2));
}
