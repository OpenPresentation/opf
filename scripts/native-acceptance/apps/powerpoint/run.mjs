#!/usr/bin/env node
// NT-16: run OPF-exported .pptx files through PowerPoint on Windows with the driver, into a run directory of the shared
// format. The general entry point is `pnpm native powerpoint` (native.mjs); this command is the driver's own.
//
//   node scripts/native-acceptance/apps/powerpoint/run.mjs --check
//   node scripts/native-acceptance/apps/powerpoint/run.mjs --out <dir> --opf <version> [--opf-commit <sha>]
//        [--input-root <dir>] [--no-edits] <file.pptx>...
//
// --check runs check() alone: it starts no PowerShell and no Office (tasklist.exe and reg.exe) and prints its answer.
// A run starts exactly one powerpoint.ps1 process. Exit 0: every verb of every file done; 1: some verb or edit case did not
// finish; 2: refused, bad arguments, or stopped (a call PowerPoint did not answer, Excel appeared, the script failed).
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { planInputs } from '../keynote/run.mjs';
import { check, createContext, EDIT_CASES, runFiles } from './driver.mjs';

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..');
const usage = 'usage: run.mjs --check | --out <dir> --opf <version> [--opf-commit <sha>] [--input-root <dir>] [--no-edits] <file.pptx>...';

export function parseArgs(argv) {
  const options = { files: [], edits: true, check: false };
  const valued = { '--out': 'out', '--opf': 'opf', '--opf-commit': 'opfCommit', '--input-root': 'inputRoot' };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (valued[arg]) {
      if (index + 1 >= argv.length) throw new Error(`${arg} needs a value`);
      options[valued[arg]] = argv[++index];
    } else if (arg === '--no-edits') options.edits = false;
    else if (arg === '--check') options.check = true;
    else if (arg.startsWith('--')) throw new Error(`unknown option ${arg}`);
    else options.files.push(arg);
  }
  if (options.check) return options;
  if (!options.out || !options.opf || options.files.length === 0) throw new Error(usage);
  return options;
}

export async function main(argv, { exec, machine, now, selfTest, log = console.log, error = console.error } = {}) {
  let options;
  let inputs = [];
  try {
    options = parseArgs(argv);
    if (!options.check) inputs = planInputs(options.files, options.inputRoot);
  } catch (problem) {
    error(`run.mjs: ${problem.message}`);
    return 2;
  }
  // --check writes nothing; its context needs a folder only to look for another driver's lock.
  const runDir = path.resolve(options.out ?? path.join(tmpdir(), 'opf-nt16-check'));
  if (!options.check && (runDir === repositoryRoot || runDir.startsWith(`${repositoryRoot}${path.sep}`))) {
    error('run.mjs: --out must be outside the repository (raw evidence stays out of it)');
    return 2;
  }
  const ctx = createContext({ runDir, ...(exec ? { exec } : {}), ...(machine ? { machine } : {}), ...(now ? { now } : {}), ...(selfTest ? { selfTest } : {}) });
  const first = await check(ctx);
  const application = first.facts.application;
  const facts = `PowerPoint ${application?.version ?? '?'}${application?.build ? ` (build ${application.build})` : ''} on Windows ${first.facts.system?.version ?? '?'}`;
  if (first.status !== 'ready') {
    error(`run.mjs: check refused; nothing was opened${first.facts.system ? ` (${facts})` : ''}:`);
    for (const reason of first.reasons) error(`  - ${reason}`);
    return 2;
  }
  if (options.check) {
    log(`check ready: ${facts}; no POWERPNT.EXE or EXCEL.EXE running`);
    return 0;
  }
  log(`${facts}; ${inputs.length} file(s) into ${runDir}; one powerpoint.ps1 process`);
  const opf = { version: options.opf, ...(options.opfCommit ? { commit: options.opfCommit } : {}) };
  const done = await runFiles(ctx, inputs, { opf, edits: options.edits ? EDIT_CASES : [], log: (line) => log(`  ${line}`) });
  if (done.refused) {
    error('run.mjs: refused; nothing was opened:');
    for (const reason of done.refused) error(`  - ${reason}`);
    return 2;
  }
  let exit = 0;
  for (const result of done.results) {
    const { verbs } = result;
    const edits = verbs.edits ?? [];
    log(`${result.file.id}\topen ${verbs.open.status}\trender ${verbs.render.status}\tprobe ${verbs.probe.status}\tresave ${verbs.resave.status}\tclose ${result.details?.close?.status}\tedits ${edits.filter((edit) => edit.status === 'done').length} done of ${edits.length}\tunchanged ${result.file.unchangedAfterRun}`);
    for (const verb of ['render', 'probe', 'resave']) if (verbs[verb].message) log(`  ${verb}: ${verbs[verb].message}`);
    if (verbs.open.status !== 'done' && verbs.open.message) log(`  open: ${verbs.open.message}`);
    for (const edit of edits) if (edit.status !== 'done') log(`  edit ${edit.id}: ${edit.status}${edit.message ? `: ${edit.message}` : ''}`);
    const applicable = edits.filter((edit) => !/^not applicable/u.test(edit.message ?? ''));
    if (['open', 'render', 'probe', 'resave'].some((verb) => verbs[verb].status !== 'done') || applicable.some((edit) => edit.status !== 'done') || result.details?.close?.status !== 'done') exit = Math.max(exit, 1);
    if (result.file.unchangedAfterRun !== true) {
      error(`run.mjs: ${result.file.id}: the input file is not proved unchanged (${result.file.unchangedAfterRun})`);
      exit = 2;
    }
  }
  for (const validation of done.validations) {
    if (!validation.ok) {
      error(`run.mjs: ${validation.id}: result.json does not validate:`);
      for (const line of validation.errors) error(`  ${line}`);
      exit = Math.max(exit, 1);
    }
  }
  if (done.runValidation && !done.runValidation.ok) {
    error('run.mjs: run.json does not validate:');
    for (const line of done.runValidation.errors) error(`  ${line}`);
    exit = Math.max(exit, 1);
  }
  for (const item of done.notRun) error(`run.mjs: not run: ${item.what}: ${item.reason}`);
  if (done.stopped) exit = 2;
  log(`run directory: ${runDir}`);
  return exit;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exitCode = await main(process.argv.slice(2));
}
