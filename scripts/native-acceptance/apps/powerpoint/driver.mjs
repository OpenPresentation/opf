// NT-16: the PowerPoint driver on Windows. The verbs of the driver contract (core/result/README.md: open, render, probe,
// resave, close, plus the edit cases) run inside ONE Windows PowerShell process, powerpoint.ps1, that drives PowerPoint
// over COM for the whole run; this module is its Node side:
//   check(ctx)                 can this computer run PowerPoint now? Starts no PowerShell and no Office: tasklist.exe and
//                              reg.exe only. Refuses when POWERPNT.EXE or EXCEL.EXE runs (that instance is the owner's).
//   runFiles(ctx, inputs, o)   takes the run directory's lock, hashes every input, writes powerpoint-plan.json, starts
//                              powerpoint.ps1 once, then builds files/<id>/result.json and run.json from what it wrote.
// Every process goes through ctx.exec (machine.mjs execCommand by default; tests pass a fake, so no test starts Office).
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { fileId, validateResult } from '../../core/result/result.mjs';
import { buildRun, iso, writeRun } from '../keynote/run-file.mjs';
import { defaultMachine, execCommand, lockHolder, powershellEnvironment, powershellPath, splitOfficeVersion, takeLock } from './machine.mjs';
import { buildResult, missingRaw } from './normalize.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));

export const SCRIPT = path.join(here, 'powerpoint.ps1');
/** Seconds PowerPoint gets per call, enforced inside powerpoint.ps1 (a call that does not return in time is "timeout"). */
export const TIMEOUTS = Object.freeze({ start: 120, open: 120, slide: 120, probe: 300, resave: 300, edit: 300, close: 60, quit: 60 });
/**
 * The pictures' width in pixels; the height follows the slide's aspect. The compare step works at 1280 pixels and resizes
 * any size (core/result/README.md, "Pictures"); the format names 1920 x 1080 as PowerPoint's size for a 16:9 deck, the
 * size the supervisor's passes export.
 */
export const RENDER_WIDTH = 1920;
/** The edit cases (core/result/README.md, "Edit cases"): each on a fresh read-only open, one copy edits/<id>.pptx. */
export const EDIT_CASES = Object.freeze([
  { id: 'retype-cell', what: 'retype the text of a table cell' },
  { id: 'refill-cell', what: 'refill a table cell' },
  { id: 'change-link', what: "change a web link's address" },
  { id: 'add-row', what: 'add a table row' },
  { id: 'delete-row', what: 'delete a table row' },
  { id: 'add-paragraph', what: 'add a paragraph to a text box' },
  { id: 'move-shape', what: 'move a shape' },
]);
/** powerpoint.ps1's exit codes. */
export const EXIT = Object.freeze({ finished: 0, usage: 2, refused: 3, stopped: 4 });

/**
 * The context of one run: { runDir, exec, machine, timeouts, now, script, powershell, env, selfTest, facts, lastCheck }.
 * selfTest: { fake: <scenario.json> } runs powerpoint.ps1 with -SelfTest (its fake COM layer; tests only).
 */
export function createContext({ runDir, exec = execCommand, machine = {}, timeouts = {}, now = () => new Date(), script = SCRIPT, powershell, env, selfTest = null }) {
  if (!runDir) throw new Error('createContext: runDir is required');
  return {
    runDir,
    exec,
    machine: { ...defaultMachine, ...machine },
    timeouts: { ...TIMEOUTS, ...timeouts },
    now,
    script,
    powershell: powershell ?? powershellPath(),
    env: env ?? powershellEnvironment(),
    selfTest,
    facts: null,
    lastCheck: null,
  };
}

export function sha256File(file) {
  return createHash('sha256').update(readFileSync(file)).digest('hex');
}

/**
 * Can this computer run PowerPoint now? { status: "ready" | "refused", reasons, facts: { application, system } }. Refuses on
 * another system, when POWERPNT.EXE or EXCEL.EXE runs, when PowerPoint is not installed, or when a live driver holds the
 * run directory's lock. Reads PowerPoint's version from the registry; never starts PowerPoint, Excel or PowerShell.
 */
export async function check(ctx) {
  const reasons = [];
  const facts = { application: null, system: null };
  if (ctx.machine.platform() !== 'win32') {
    reasons.push(`PowerPoint runs on Windows only (this is ${ctx.machine.platform()}); pass the Windows run directory with --from-run`);
  } else {
    facts.system = { os: 'Windows', version: ctx.machine.windowsVersion() };
    try {
      for (const name of await ctx.machine.officeProcesses(ctx.exec)) {
        reasons.push(`${name} is running: that instance is the owner's. The driver neither uses nor ends it; when the owner has closed it, run again.`);
      }
    } catch (error) {
      reasons.push(`Could not read the process list: ${error.message}`);
    }
    let install = null;
    try {
      install = await ctx.machine.powerpointInstall(ctx.exec);
    } catch (error) {
      reasons.push(`Could not read PowerPoint's install from the registry: ${error.message}`);
    }
    if (install === null) reasons.push('PowerPoint is not installed here (the registry has no App Paths entry for powerpnt.exe)');
    const split = splitOfficeVersion(install?.version);
    facts.application = split ? { name: 'PowerPoint', version: split.version, build: split.build } : { name: 'PowerPoint', version: 'unknown until the run starts' };
    const holder = lockHolder(ctx.runDir);
    if (holder && holder.pid !== process.pid) reasons.push(`another PowerPoint driver (process ${holder.pid}) holds this run directory's lock`);
  }
  ctx.facts = facts;
  ctx.lastCheck = { status: reasons.length === 0 ? 'ready' : 'refused', reasons };
  return { ...ctx.lastCheck, facts };
}

const readJson = (file) => JSON.parse(readFileSync(file, 'utf8').replace(/^﻿/u, ''));

/** The application of the run: PowerPoint's own version and build once the script started it, else the registry's. */
export function runApplication(started, registry) {
  if (!started?.version) return registry?.version && !registry.version.startsWith('unknown') ? registry : { name: 'PowerPoint', version: 'not started' };
  const application = { name: 'PowerPoint', version: String(started.version) };
  // The registry's build ("20625.20108") is the more exact one when it starts with PowerPoint's own ("20625").
  if (registry?.build && started.build && registry.build.startsWith(String(started.build))) application.build = registry.build;
  else if (started.build) application.build = String(started.build);
  return application;
}

/**
 * Runs every input through PowerPoint in one powerpoint.ps1 process and writes the run directory.
 *   inputs: [{ path (absolute), relativePath, deck, variant, id? }]
 *   options: { opf, fonts?, tier?, baseline?, edits? (EDIT_CASES by default; [] for none), log? (each progress line) }
 * Returns { refused?, results, validations, run, runValidation, driverRun, stopped, notRun, exit, stderr }.
 * notRun entries are { what, reason, blocking } as native.mjs reports them.
 */
export async function runFiles(ctx, inputs, { opf, fonts = 'installed', tier = null, baseline = null, edits = EDIT_CASES, log = () => {} }) {
  if (!ctx.facts?.system) throw new Error('runFiles: run check(ctx) first; it reads the system and the application');
  mkdirSync(ctx.runDir, { recursive: true });
  const lock = takeLock(ctx.runDir, { now: ctx.now });
  if (!lock.ok) return { refused: [lock.reason], results: [], validations: [], notRun: [], stopped: true };
  try {
    const started = iso(ctx.now());
    const files = inputs.map((input) => {
      const id = input.id ?? fileId(input.deck, input.variant ?? 'default');
      const dir = path.join(ctx.runDir, 'files', id);
      mkdirSync(dir, { recursive: true });
      return { input: { ...input, id }, id, dir, before: sha256File(input.path) };
    });
    const planFile = path.join(ctx.runDir, 'powerpoint-plan.json');
    const plan = {
      runDir: ctx.runDir,
      width: RENDER_WIDTH,
      timeouts: ctx.timeouts,
      edits,
      files: files.map(({ input, id, dir }) => ({ id, path: input.path, dir })),
    };
    writeFileSync(planFile, `${JSON.stringify(plan, null, 2)}\n`);
    const args = ['-NoProfile', '-NonInteractive', '-File', ctx.script, '-Plan', planFile];
    if (ctx.selfTest?.fake) args.push('-SelfTest', '-Fake', ctx.selfTest.fake);
    // Node's own limit only guards against a script that never ends; powerpoint.ps1 keeps every PowerPoint call's limit.
    const timeoutMs = (600 + files.length * 3600) * 1000;
    const answer = await ctx.exec(ctx.powershell, args, { timeoutMs, onLine: log, env: ctx.env });

    const runFile = path.join(ctx.runDir, 'powerpoint-run.json');
    const driverRun = existsSync(runFile) ? readJson(runFile) : null;
    if (driverRun?.check?.status === 'refused') return { refused: driverRun.check.reasons, results: [], validations: [], notRun: [], stopped: true, driverRun, exit: answer.code };

    const notRun = [];
    const crashed = !driverRun || ![EXIT.finished, EXIT.stopped].includes(answer.code);
    if (crashed) {
      const said = `${String(answer.stderr ?? '').trim()} ${String(answer.stdout ?? '').trim()}`.trim().slice(-600);
      notRun.push({ what: 'the PowerShell driver', reason: `powerpoint.ps1 ${answer.timedOut ? 'did not end in time and was stopped' : `exited with ${answer.code}`}${driverRun ? '' : ' and wrote no powerpoint-run.json'}${said ? `: ${said}` : ''}`, blocking: true });
    }
    ctx.facts.application = runApplication(driverRun?.application, ctx.facts.application);
    const finished = iso(ctx.now());
    const results = [];
    const validations = [];
    for (const { input, dir, before } of files) {
      const rawFile = path.join(dir, 'powerpoint-raw.json');
      const raw = existsSync(rawFile) ? readJson(rawFile) : missingRaw(input, `not run: powerpoint.ps1 wrote nothing about this file (${crashed ? 'it did not finish' : 'no output'})`);
      let after = null;
      try {
        after = sha256File(input.path);
      } catch {
        // The input went away: unchangedAfterRun stays unknown.
      }
      const result = buildResult({ raw, input, application: ctx.facts.application, system: ctx.facts.system, opf, fonts, started, finished, hashes: { before, after }, fileDir: dir });
      const validation = validateResult(result);
      writeFileSync(path.join(dir, 'result.json'), `${JSON.stringify(result, null, 2)}\n`);
      results.push(result);
      validations.push({ id: result.file.id, ...validation });
    }
    if (driverRun?.stopped) {
      notRun.push({ what: 'the files after the call that stopped the run', reason: `${driverRun.stopped}${driverRun.powerpointMayBeLeft ? '; a POWERPNT.EXE process may be left for the supervisor to look at (the driver never ends it)' : ''}`, blocking: true });
    } else if (driverRun?.powerpointMayBeLeft) {
      notRun.push({ what: 'quitting PowerPoint', reason: driverRun.finish?.message ?? 'PowerPoint was not quit; a POWERPNT.EXE process may be left for the supervisor to look at', blocking: true });
    }
    const run = buildRun(ctx, { opf, fonts, started, check: ctx.lastCheck ?? { status: 'ready', reasons: [] }, results, target: 'powerpoint', tier, baseline });
    const runValidation = writeRun(ctx, run);
    return { results, validations, run, runValidation, driverRun, stopped: crashed || Boolean(driverRun?.stopped), notRun, exit: answer.code, stderr: answer.stderr };
  } finally {
    lock.release();
  }
}
