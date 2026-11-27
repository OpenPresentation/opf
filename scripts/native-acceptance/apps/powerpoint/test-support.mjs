// NT-16 tests only: a fake `exec` that answers like this Windows computer (tasklist.exe, reg.exe) and like one run of
// powerpoint.ps1: it reads the plan, writes powerpoint-raw.json per file, the pictures and the copies, and
// powerpoint-run.json, exactly in the shape the real script writes (its control flow is proved by the -SelfTest run of
// powerpoint.test.mjs). Nothing here starts a process.
import { appendFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

/**
 * A command's file name, lower case, whatever the host: the driver names Windows programs with Windows paths
 * ("C:\Windows\System32\...\powershell.exe"), which the host's path.basename does not split on Linux or macOS;
 * path.win32.basename splits on both "\" and "/" on every host.
 */
export const commandName = (command) => path.win32.basename(String(command)).toLowerCase();

/** A 1 x 1 PNG. */
export const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64');

export const TASKLIST_IDLE = '"System Idle Process","0","Services","0","8 K"\r\n"explorer.exe","4242","Console","1","120,000 K"\r\n';
export const tasklistWith = (...names) => TASKLIST_IDLE + names.map((name, k) => `"${name}","${9000 + k}","Console","1","50,000 K"\r\n`).join('');
export const REG_APP_PATH = '\r\nHKEY_LOCAL_MACHINE\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\App Paths\\powerpnt.exe\r\n    (Default)    REG_SZ    C:\\Program Files\\Microsoft Office\\Root\\Office16\\POWERPNT.EXE\r\n\r\n';
export const REG_VERSION = '\r\nHKEY_LOCAL_MACHINE\\SOFTWARE\\Microsoft\\Office\\ClickToRun\\Configuration\r\n    VersionToReport    REG_SZ    16.0.20625.20108\r\n\r\n';

/** A two-slide file: a title and a table with a link on slide 1, a hidden slide 2 with notes. */
export function sampleSlides() {
  return [
    {
      layout: 'Title and Content',
      shapes: [
        { name: 'Title 1', id: 2, type: 14, placeholder: { type: 1, containedType: 1 }, left: 36, top: 20, width: 888, height: 60, alt: '', text: 'Pricing', fonts: ['Aptos Display'], bullets: false, textFrame: { autoSize: 0, wordWrap: -1, boundHeight: 40.5 } },
        {
          name: 'OPF table 1',
          id: 3,
          type: 19,
          hasTable: true,
          left: 36,
          top: 100,
          width: 600,
          height: 120,
          alt: 'Prices',
          rows: 2,
          columns: 2,
          fonts: ['Aptos'],
          cells: [
            [
              { text: 'Plan', fill: '1F4E79', color: 'FFFFFF' },
              { text: 'Price', fill: '1F4E79', color: 'FFFFFF' },
            ],
            [
              { text: 'Pro', fill: null, color: '000000' },
              { text: '$10', fill: null, color: '000000' },
            ],
          ],
          cellLinks: [{ address: 'https://example.com/pro', subAddress: '', text: 'Pro', row: 2, column: 1 }],
        },
      ],
    },
    { hidden: true, layout: 'Blank', notes: 'Speaker\rnotes', shapes: [{ name: 'Footer 3', id: 4, type: 14, placeholder: { type: 15 }, left: 0, top: 500, width: 300, height: 30, text: 'Acme' }] },
  ];
}

const msg = (text) => ({ status: 'failed', seconds: 0.1, message: text });

/**
 * The fake exec. files: { "<input file name>": spec } with spec { slides?, openError?, hang?: "open" | "render",
 * exportFail?: [index], probeFail?: [index], closeError?, notApplicable?: { caseId: why }, writeInput?, excel? }.
 * spec.copyInput: the copies are the input's bytes (a real PowerPoint file for the round trip); spec.picture: the picture bytes.
 * Options: defaults (the spec of a file not named in files), running (names tasklist reports), installed (false: no App Paths), refuseInScript (names powerpoint.ps1 finds
 * running), crash (the script dies with this stderr and writes nothing), keepOpen (Presentations.Count stays 1),
 * exitsAfterQuit (false: POWERPNT.EXE 4242 has not ended when the script stops waiting).
 * exec.calls lists every command with its arguments.
 */
export function fakeExec({ files = {}, running = [], installed = true, refuseInScript = [], crash = null, keepOpen = false, exitsAfterQuit = true, defaults = {}, application = { name: 'PowerPoint', version: '16.0', build: '20625' } } = {}) {
  const calls = [];
  const exec = async (command, args = [], options = {}) => {
    calls.push([command, ...args]);
    const name = commandName(command);
    if (name === 'tasklist') return { code: 0, stdout: tasklistWith(...running), stderr: '', timedOut: false, seconds: 0.1 };
    if (name === 'reg') {
      if (!installed) return { code: 1, stdout: '', stderr: 'ERROR: The system was unable to find the specified registry key or value.', timedOut: false, seconds: 0.1 };
      return { code: 0, stdout: args.includes('/ve') ? REG_APP_PATH : REG_VERSION, stderr: '', timedOut: false, seconds: 0.1 };
    }
    if (name !== 'powershell.exe') return { code: 1, stdout: '', stderr: `unexpected command ${command}`, timedOut: false, seconds: 0 };
    const plan = JSON.parse(readFileSync(args[args.indexOf('-Plan') + 1], 'utf8'));
    const runFile = path.join(plan.runDir, 'powerpoint-run.json');
    if (crash) return { code: 1, stdout: '', stderr: crash, timedOut: false, seconds: 1 };
    const run = { schema: 'nt16-powerpoint-run/1', selfTest: false, check: { status: 'ready', reasons: [] }, application, powershell: '5.1.26100.1', files: plan.files.map((file) => file.id), stopped: null, powerpointMayBeLeft: false, excelSeen: false, finish: { status: 'not-run' }, start: { status: 'done', seconds: 1 }, powerpointIds: [4242] };
    if (refuseInScript.length > 0) {
      writeFileSync(runFile, JSON.stringify({ ...run, application: null, files: [], start: undefined, check: { status: 'refused', reasons: refuseInScript.map((item) => `${item} is running: that instance is the owner's.`) } }));
      return { code: 3, stdout: 'NT16 refused', stderr: '', timedOut: false, seconds: 0.5 };
    }
    let stopped = null;
    let hung = false;
    let error = null;
    let open = 0;
    for (const [position, file] of plan.files.entries()) {
      const spec = files[path.basename(file.path)] ?? defaults;
      const raw = { id: file.id, path: file.path, sha256Before: 'x', sha256After: 'x', started: `2026-11-27T10:0${position}:00Z`, finished: `2026-11-27T10:0${position}:30Z`, open: { status: 'not-run' }, resave: { status: 'not-run' }, render: { status: 'not-run' }, probe: { status: 'not-run' }, close: { status: 'not-run' }, edits: [], slides: [] };
      // The script hashes with Get-FileHash; the fake leaves those to Node's own (see sha256 below).
      delete raw.sha256Before;
      delete raw.sha256After;
      const write = () => writeFileSync(path.join(file.dir, 'powerpoint-raw.json'), JSON.stringify(raw, null, 2));
      if (stopped) {
        raw.open.message = `not run: the run stopped earlier (${stopped})`;
        write();
        continue;
      }
      if (spec.hang === 'open') {
        hung = true;
        stopped = `PowerPoint did not answer Ppt-Open within ${plan.timeouts.open} s`;
        raw.open = { status: 'timeout', seconds: plan.timeouts.open, message: `${stopped}; the run stopped without ending PowerPoint: a POWERPNT.EXE process may be left for the supervisor to look at` };
        write();
        continue;
      }
      if (spec.openError) {
        raw.open = msg(spec.openError);
        write();
        continue;
      }
      open += 1;
      const slides = spec.slides ?? sampleSlides();
      raw.open = { status: 'done', seconds: 0.4 };
      raw.slideCount = slides.length;
      raw.slideSize = [960, 540];
      raw.fonts = [{ name: 'Aptos', embedded: false }];
      raw.slides = slides.map((slide, k) => ({ index: k + 1, id: 256 + k, hidden: Boolean(slide.hidden), layout: slide.layout ?? null, picture: null, shapes: [], notes: null }));
      writeFileSync(path.join(file.dir, 'resaved.pptx'), spec.copyInput ? readFileSync(file.path) : 'copy');
      raw.resave = { status: 'done', seconds: 0.3, path: 'resaved.pptx' };
      mkdirSync(path.join(file.dir, 'slides'), { recursive: true });
      const height = Math.round((plan.width * 540) / 960);
      raw.render = { status: 'done', seconds: 0.5, pixelSize: [plan.width, height] };
      const failed = [];
      for (const slide of raw.slides) {
        if (spec.hang === 'render' && slide.index === 2) {
          hung = true;
          stopped = `PowerPoint did not answer Ppt-Export within ${plan.timeouts.slide} s`;
          raw.render.status = 'timeout';
          raw.render.message = `slide 2: ${stopped}; the run stopped without ending PowerPoint: a POWERPNT.EXE process may be left for the supervisor to look at`;
          break;
        }
        if ((spec.exportFail ?? []).includes(slide.index)) failed.push(`slide ${slide.index}: Slide.Export failed`);
        else {
          const name = `slides/slide-${String(slide.index).padStart(3, '0')}.png`;
          writeFileSync(path.join(file.dir, name), spec.picture ?? PNG);
          slide.picture = name;
        }
      }
      if (raw.render.status === 'done' && failed.length > 0) Object.assign(raw.render, { status: 'failed', message: `PowerPoint exported no picture of ${failed.length} slide(s): ${failed.join('; ')}` });
      if (spec.scriptError) {
        // The script itself throws while this file is open: the file is written as far as it got, the files after it get
        // nothing, and the end still closes it, quits and checks the exit (powerpoint.ps1's catch).
        error = `the driver failed: ${spec.scriptError}`;
        raw.failure = error;
        open -= 1;
        write();
        break;
      }
      if (!stopped) {
        raw.probe = { status: 'done', seconds: 0.6 };
        for (const slide of raw.slides) {
          if ((spec.probeFail ?? []).includes(slide.index)) {
            slide.probeError = 'The object does not support this property';
            raw.probe = { status: 'failed', seconds: 0.6, message: `PowerPoint did not answer the probe of 1 slide(s): slide ${slide.index}: The object does not support this property` };
          } else {
            slide.shapes = slides[slide.index - 1].shapes ?? [];
            slide.notes = slides[slide.index - 1].notes ?? null;
          }
        }
        raw.close = spec.closeError ? msg(spec.closeError) : { status: 'done', seconds: 0.1 };
        if (!spec.closeError && !keepOpen) open -= 1;
        mkdirSync(path.join(file.dir, 'edits'), { recursive: true });
        raw.edits = plan.edits.map((edit) => {
          if (raw.close.status !== 'done') return { id: edit.id, what: edit.what, status: 'not-run', message: 'not run: the file did not close' };
          const why = spec.notApplicable?.[edit.id];
          if (why) return { id: edit.id, what: edit.what, status: 'not-run', seconds: 0.2, message: `not applicable: ${why}` };
          writeFileSync(path.join(file.dir, 'edits', `${edit.id}.pptx`), spec.copyInput ? readFileSync(file.path) : 'edited copy');
          return { id: edit.id, what: `${edit.what} (fake)`, status: 'done', seconds: 0.4 };
        });
      }
      if (spec.writeInput) appendFileSync(file.path, 'changed');
      if (spec.excel) {
        raw.excelSeen = true;
        run.excelSeen = true;
        stopped ??= `EXCEL.EXE appeared while ${file.id} was open; the driver never starts Excel and does not end it: the supervisor looks at it`;
      }
      write();
      options.onLine?.(`NT16 file ${file.id} open ${raw.open.status}`);
    }
    // As powerpoint.ps1: the end runs on every path but a call that did not answer (hung).
    if (!hung) {
      run.finish = { status: 'done', seconds: 0.2, openCount: open, quit: open === 0, workerClosed: true };
      if (open === 0 && exitsAfterQuit) Object.assign(run.finish, { exited: true, exitSeconds: 0.8 });
      if (open === 0 && !exitsAfterQuit) {
        Object.assign(run.finish, { exited: false, exitSeconds: plan.timeouts.exit, left: [4242], message: `PowerPoint was quit, but POWERPNT.EXE 4242 had not ended ${plan.timeouts.exit} s later; the driver does not end it: the supervisor looks at it` });
        run.powerpointMayBeLeft = true;
      }
      if (open > 0) {
        run.finish.message = `${open} presentation(s) still open in PowerPoint, so it was not quit: a POWERPNT.EXE process is left for the supervisor to look at`;
        run.powerpointMayBeLeft = true;
      }
    } else run.powerpointMayBeLeft = true;
    if (stopped) run.stopped = stopped;
    if (error) run.error = error;
    const code = error ? 5 : stopped ? 4 : 0;
    writeFileSync(runFile, JSON.stringify(run, null, 2));
    return { code, stdout: `NT16 done exit ${code}\n`, stderr: '', timedOut: false, seconds: 2 };
  };
  exec.calls = calls;
  return exec;
}

/** A machine that is Windows, with fixed facts (check() still goes through exec for tasklist and reg). */
export const windowsMachine = (extra = {}) => ({ platform: () => 'win32', windowsVersion: () => '10.0.26300', ...extra });
