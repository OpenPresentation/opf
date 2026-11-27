// NT-16: powerpoint.ps1 itself, without PowerPoint. On every system: what the script must contain and must never contain
// (read as text). On Windows: Windows PowerShell's parser reads it without an error, and `-SelfTest -Fake <scenario>` runs
// its real control flow (the worker thread, the time limits, not-run after a timeout, the refusal, the hash, quit only when
// no presentation is open) with every Com-* function replaced by powerpoint-fake.ps1, then the Node side builds a valid
// run directory from what it wrote. No test creates PowerPoint.Application.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { validateResult, validateRun } from '../../core/result/result.mjs';
import { windowsPowerShellEnvironment } from '../../windows-powershell-env.mjs';
import { check, createContext, runFiles, SCRIPT } from './driver.mjs';
import { powershellPath } from './machine.mjs';
import { sampleSlides, windowsMachine } from './test-support.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const FAKE = path.join(here, 'powerpoint-fake.ps1');
const source = readFileSync(SCRIPT, 'utf8');
const fakeSource = readFileSync(FAKE, 'utf8');
// The script without its comments: the rules below are about code, not about the words that explain it.
const code = source
  .split('\n')
  .map((line) => line.replace(/(^|\s)#.*$/u, ''))
  .join('\n');
const mainPart = code.slice(code.indexOf('function Get-OfficeProcesses'));
const onWindows = process.platform === 'win32';
const skip = onWindows ? false : 'Windows PowerShell is unavailable on this host; the script is read as text only';

/** The body of one function of the script, by name. */
function body(name, text = code) {
  const start = text.indexOf(`function ${name} {`);
  assert.ok(start >= 0, `${name} is defined`);
  let depth = 0;
  for (let index = text.indexOf('{', start); index < text.length; index += 1) {
    if (text[index] === '{') depth += 1;
    else if (text[index] === '}') {
      depth -= 1;
      if (depth === 0) return text.slice(start, index + 1);
    }
  }
  throw new Error(`${name} does not end`);
}

test('the script never ends a process, drives the window, sends keys, opens a workbook or installs a font', () => {
  for (const [pattern, why] of [
    [/Stop-Process|taskkill|\.Kill\(|Kill-/iu, 'never ends a process'],
    [/SendKeys|AppActivate|WScript\.Shell/iu, 'never sends keys or activates a window'],
    [/ActiveWindow|WindowState|\.Windows\b|\.Activate\(|\$App\.Visible|Application\.Visible/iu, 'never shows or activates a window'],
    [/ChartData|Workbook|Excel\.Application/iu, 'never opens a chart workbook or Excel'],
    [/AddFontResource|Fonts\\|New-ItemProperty|Set-ItemProperty|Register/iu, 'installs and registers no font'],
    [/\.Save\(\)|\.SaveAs\(/iu, 'never saves the input: copies go through SaveCopyAs'],
    [/&&|\?\?|\?\./u, 'Windows PowerShell 5.1 syntax only'],
  ]) {
    assert.doesNotMatch(code, pattern, why);
  }
});

test('every COM touch is inside a Com-* function; the main thread only waits on the worker', () => {
  assert.equal((code.match(/New-Object -ComObject/gu) ?? []).length, 1);
  assert.match(body('Com-NewApp'), /New-Object -ComObject PowerPoint\.Application/u);
  assert.equal((code.match(/Presentations\.Open\(/gu) ?? []).length, 1);
  assert.match(body('Com-Open'), /\$App\.Presentations\.Open\(\$Path, -1, 0, 0\)/u, 'ReadOnly msoTrue, Untitled msoFalse, WithWindow msoFalse');
  assert.equal((code.match(/\.Quit\(\)/gu) ?? []).length, 1);
  assert.match(body('Com-Quit'), /\$App\.Quit\(\)/u);
  // The end on the worker thread: globals cleared, Quit only when nothing is open, every reference released, collected.
  assert.match(body('Ppt-Finish'), /\$global:NtPres = \$null\s+\$global:NtApp = \$null[\s\S]*if \(\$count -eq 0\) \{ Com-Quit \$app; \$quit = \$true \}\s+Com-Release \$app\s+\$app = \$null\s+Com-Collect/u, 'quit only when no presentation is open');
  assert.match(body('Com-Release'), /FinalReleaseComObject\(\$App\)/u);
  assert.match(body('Com-Collect'), /\[GC\]::Collect\(\)\s+\[GC\]::WaitForPendingFinalizers\(\)\s+\[GC\]::Collect\(\)\s+\[GC\]::WaitForPendingFinalizers\(\)/u);
  assert.match(body('Com-Close'), /\$Pres\.Saved = -1[\s\S]*\$Pres\.Close\(\)/u);
  for (const pattern of [/\$App\b/u, /\$Pres\b/u, /\.Presentations\b/u, /\.Slides\b/u, /ComObject/u]) assert.doesNotMatch(mainPart.replace(/function Ppt-[\s\S]*?\n\}/gu, ''), pattern);
  assert.match(code, /ApartmentState = \[System\.Threading\.ApartmentState\]::STA/u);
  assert.match(body('Invoke-Worker'), /BeginInvoke\(\)[\s\S]*AsyncWaitHandle\.WaitOne/u, 'every call waits with a time limit');
  // Environment.Exit only on the stopped path; the clean path closes the worker, waits for PowerPoint's exit, ends normally.
  assert.equal((code.match(/\[Environment\]::Exit\(/gu) ?? []).length, 1);
  assert.match(code, /if \(\$code -ne 0\) \{\s+Write-Json \$runFile \$run\s+Say [^\n]*\n\s+\[Environment\]::Exit\(\$code\)\s*\}/u);
  assert.match(code, /\$script:Worker\.Close\(\)\s+\$script:Worker\.Dispose\(\)[\s\S]*Wait-PowerPointExit[\s\S]*\nexit \$code\s*$/u);
  assert.match(body('Wait-PowerPointExit'), /\.WaitForExit\(\$remaining\)/u, 'a bounded wait, no loop and nothing ended');
});

test('change-link edits a hyperlink from Slide.Hyperlinks; the probe lists them too', () => {
  const edit = body('Com-ApplyEdit');
  assert.match(edit, /foreach \(\$link in \$slide\.Hyperlinks\) \{[\s\S]*\$link\.Address = \$new/u);
  assert.match(edit, /why = 'no slide has a hyperlink with a web address'/u);
  assert.match(body('Com-ProbeSlide'), /foreach \(\$link in \$slide\.Hyperlinks\)/u);
  assert.doesNotMatch(body('Com-Link'), /Action/u, 'a link is its Hyperlink address, whatever Action says');
});

test('the fake replaces every COM entry point, and the script checks each one before a self-test runs', () => {
  assert.match(code, /if \(-not \$file -or -not \$file\.EndsWith\('powerpoint-fake\.ps1'\)\) \{ Say "NT16 self-test: \$name is not faked; nothing runs"; exit 2 \}/u);
  const guarded = /foreach \(\$name in @\(('Com-NewApp'[^)]*)\)\)/u.exec(code)[1].match(/'[^']+'/gu).map((name) => name.slice(1, -1));
  const real = [...code.matchAll(/^function (Com-[A-Za-z]+) \{/gmu)].map((match) => match[1]);
  const helpers = new Set(['Com-TryGet', 'Com-Round', 'Com-Hex', 'Com-Link', 'Com-TextFacts', 'Com-ReadShape', 'Com-FirstTable']);
  // Every Com-* entry point the verbs call is guarded; the helpers are only called from those entry points.
  for (const name of real) assert.ok(guarded.includes(name) || helpers.has(name), `${name} is faked or a helper`);
  for (const name of helpers) for (const verb of [...code.matchAll(/^function (Ppt-[A-Za-z]+) \{/gmu)].map((match) => match[1])) assert.doesNotMatch(body(verb), new RegExp(`${name}\\b`, 'u'), `${verb} does not call the helper ${name}`);
  for (const name of guarded) assert.match(fakeSource, new RegExp(`^function ${name} \\{`, 'mu'), `the fake defines ${name}`);
  assert.doesNotMatch(fakeSource.replace(/^#.*$/gmu, ''), /ComObject|Get-Process/u);
});

function powershell(args, timeout = 120_000) {
  return spawnSync(powershellPath(), ['-NoProfile', '-NonInteractive', ...args], { encoding: 'utf8', timeout, env: windowsPowerShellEnvironment(process.env), windowsHide: true });
}

test('Windows PowerShell parses both scripts without an error', { skip }, () => {
  for (const file of [SCRIPT, FAKE]) {
    const answer = powershell(['-Command', `$errors = $null; [void][System.Management.Automation.Language.Parser]::ParseFile('${file.replaceAll("'", "''")}', [ref]$null, [ref]$errors); Write-Output ('PARSE-ERRORS ' + $errors.Count); foreach ($e in $errors) { Write-Output $e.Message }`]);
    assert.equal(answer.status, 0, answer.stderr);
    assert.match(answer.stdout, /^PARSE-ERRORS 0\s*$/mu, answer.stdout);
  }
});

const LIMITS = { start: 5, open: 1.5, slide: 1.5, probe: 1.5, resave: 1.5, edit: 1.5, close: 1.5, quit: 1.5, exit: 1.5 };

/** A plan and a scenario in a fresh folder: files = { name: spec }. */
function selfTestFolder(files, extra = {}) {
  const root = mkdtempSync(path.join(tmpdir(), 'nt16-ps-'));
  const runDir = path.join(root, 'run');
  const entries = Object.keys(files).map((name) => {
    const input = path.join(root, 'in', name);
    mkdirSync(path.dirname(input), { recursive: true });
    writeFileSync(input, `deck ${name}`);
    const id = `${name.replace(/\.pptx$/u, '')}~default`;
    const dir = path.join(runDir, 'files', id);
    mkdirSync(dir, { recursive: true });
    return { id, path: input, dir };
  });
  const plan = path.join(runDir, 'powerpoint-plan.json');
  writeFileSync(plan, JSON.stringify({ runDir, width: 1920, timeouts: LIMITS, edits: [{ id: 'retype-cell', what: 'retype a table cell' }, { id: 'add-row', what: 'add a table row' }], files: entries }));
  const scenario = path.join(root, 'scenario.json');
  writeFileSync(scenario, JSON.stringify({ processes: [[]], app: { version: '16.0', build: '20625' }, files, ...extra }));
  return { root, runDir, plan, scenario, entries };
}

const callsOf = (scenario) => (existsSync(`${scenario}.calls`) ? readFileSync(`${scenario}.calls`, 'utf8').replace(/^﻿/u, '').trim().split(/\r?\n/u) : []);
const readJson = (file) => JSON.parse(readFileSync(file, 'utf8').replace(/^﻿/u, ''));
const slides = [{ layout: 'Title Only', notes: 'n', shapes: [{ name: 'Title 1', type: 14, placeholder: { type: 1 }, left: 1, top: 2, width: 3, height: 4, text: 'Hello' }] }, { hidden: true, layout: 'Blank', shapes: [] }];

test('self-test: a clean run quits PowerPoint only after every presentation closed', { skip }, () => {
  const folder = selfTestFolder({ 'a.pptx': { slideSize: [960, 540], slides } });
  const answer = powershell(['-File', SCRIPT, '-Plan', folder.plan, '-SelfTest', '-Fake', folder.scenario]);
  assert.equal(answer.status, 0, answer.stdout + answer.stderr);
  assert.match(answer.stdout, /NT16 done exit 0; PowerPoint exited after 0\.5 s\s*$/u);
  // The end, in this order on the worker thread: the globals hold no COM object, Quit, release, collect; then the main
  // thread closes the worker and waits (bounded) for the POWERPNT.EXE this run started.
  assert.deepEqual(callsOf(folder.scenario), [
    'new-app',
    'open a.pptx',
    'save-copy resaved.pptx',
    'close a.pptx',
    'open a.pptx',
    'save-copy retype-cell.pptx',
    'close a.pptx',
    'open a.pptx',
    'save-copy add-row.pptx',
    'close a.pptx',
    'quit (globals null)',
    'release (globals null)',
    'collect (globals null)',
    'wait-exit 4242 within 1.5',
  ]);
  const run = readJson(path.join(folder.runDir, 'powerpoint-run.json'));
  assert.deepEqual([run.selfTest, run.finish.status, run.finish.openCount, run.finish.quit, run.stopped, run.powerpointMayBeLeft], [true, 'done', 0, true, null, false]);
  assert.deepEqual([run.powerpointIds, run.finish.workerClosed, run.finish.exited, run.finish.exitSeconds], [[4242], true, true, 0.5]);
  const raw = readJson(path.join(folder.entries[0].dir, 'powerpoint-raw.json'));
  assert.deepEqual([raw.open.status, raw.resave.status, raw.render.status, raw.probe.status, raw.close.status], ['done', 'done', 'done', 'done', 'done']);
  assert.deepEqual(raw.render.pixelSize, [1920, 1080]);
  assert.deepEqual(raw.slides.map((slide) => slide.picture), ['slides/slide-001.png', 'slides/slide-002.png']);
  assert.equal(raw.sha256Before, raw.sha256After);
  assert.match(raw.sha256Before, /^[0-9a-f]{64}$/u);
});

test('self-test: a call that does not return is a timeout, the rest not-run, and PowerPoint is neither closed nor quit', { skip }, () => {
  const folder = selfTestFolder({
    'a.pptx': { slideSize: [960, 540], slides, exportFail: [2], edits: { 'add-row': { applies: false, why: 'the file has no table' } } },
    'b.pptx': { openError: "PowerPoint can't read b.pptx." },
    'c.pptx': { slideSize: [960, 540], slides, exportHang: 1 },
    'd.pptx': { slideSize: [960, 540], slides },
  });
  const started = Date.now();
  const answer = powershell(['-File', SCRIPT, '-Plan', folder.plan, '-SelfTest', '-Fake', folder.scenario]);
  assert.equal(answer.status, 4, answer.stdout + answer.stderr);
  assert.ok(Date.now() - started < 5600, 'the script exits on its limit, not when the hung call returns');
  assert.match(answer.stdout, /NT16 done exit 4: PowerPoint did not answer Ppt-Export within 1\.5 s/u);
  const calls = callsOf(folder.scenario);
  assert.ok(!calls.some((call) => /^(quit|release|collect|wait-exit)/u.test(call)), 'nothing more is sent to PowerPoint after a timeout, and no wait');
  assert.ok(!calls.includes('close c.pptx'));
  const raw = (id) => readJson(path.join(folder.runDir, 'files', id, 'powerpoint-raw.json'));
  const a = raw('a~default');
  assert.equal(a.render.status, 'failed');
  assert.match(a.render.message, /slide 2: Slide\.Export failed for slide 2 \(fake\)/u);
  assert.deepEqual(a.edits.map((edit) => [edit.id, edit.status, edit.message ?? null]), [['retype-cell', 'done', null], ['add-row', 'not-run', 'not applicable: the file has no table']]);
  assert.deepEqual([raw('b~default').open.status, raw('b~default').open.message], ['failed', "PowerPoint can't read b.pptx."]);
  const c = raw('c~default');
  assert.deepEqual([c.open.status, c.resave.status, c.render.status, c.probe.status, c.close.status], ['done', 'done', 'timeout', 'not-run', 'not-run']);
  assert.match(c.render.message, /a POWERPNT\.EXE process may be left for the supervisor to look at/u);
  assert.ok(c.edits.every((edit) => edit.status === 'not-run'));
  assert.deepEqual([raw('d~default').open.status, raw('d~default').open.message], ['not-run', 'not run: the run stopped earlier (PowerPoint did not answer Ppt-Export within 1.5 s)']);
  const run = readJson(path.join(folder.runDir, 'powerpoint-run.json'));
  assert.equal(run.powerpointMayBeLeft, true);
  assert.equal(run.finish.status, 'not-run');
});

test('self-test: Office already running refuses before anything starts', { skip }, () => {
  const folder = selfTestFolder({ 'a.pptx': { slideSize: [960, 540], slides } }, { processes: [['POWERPNT.EXE']] });
  const answer = powershell(['-File', SCRIPT, '-Plan', folder.plan, '-SelfTest', '-Fake', folder.scenario]);
  assert.equal(answer.status, 3, answer.stdout + answer.stderr);
  assert.deepEqual(callsOf(folder.scenario), [], 'PowerPoint.Application is never created');
  const run = readJson(path.join(folder.runDir, 'powerpoint-run.json'));
  assert.equal(run.check.status, 'refused');
  assert.match(run.check.reasons[0], /^POWERPNT\.EXE is running: that instance is the owner's/u);
});

test('self-test: a failed close keeps PowerPoint running (no quit); Excel appearing stops the run; a changed input shows in the hash', { skip }, () => {
  const kept = selfTestFolder({ 'a.pptx': { slideSize: [960, 540], slides, closeError: 'Close failed (fake)', writeInput: true } });
  const answer = powershell(['-File', SCRIPT, '-Plan', kept.plan, '-SelfTest', '-Fake', kept.scenario]);
  assert.equal(answer.status, 0, answer.stdout + answer.stderr);
  const run = readJson(path.join(kept.runDir, 'powerpoint-run.json'));
  assert.deepEqual([run.finish.openCount, run.finish.quit, run.powerpointMayBeLeft, run.finish.exited], [1, false, true, undefined]);
  const keptCalls = callsOf(kept.scenario);
  assert.ok(!keptCalls.some((call) => call.startsWith('quit') || call.startsWith('wait-exit')), 'no quit, so no wait');
  assert.deepEqual(keptCalls.slice(-2), ['release (globals null)', 'collect (globals null)'], 'its references are still released');
  const raw = readJson(path.join(kept.entries[0].dir, 'powerpoint-raw.json'));
  assert.notEqual(raw.sha256Before, raw.sha256After);
  assert.ok(raw.edits.every((edit) => edit.message === 'not run: the file did not close'));

  const excel = selfTestFolder({ 'a.pptx': { slideSize: [960, 540], slides }, 'b.pptx': { slideSize: [960, 540], slides } }, { processes: [[], ['EXCEL.EXE']] });
  const second = powershell(['-File', SCRIPT, '-Plan', excel.plan, '-SelfTest', '-Fake', excel.scenario]);
  assert.equal(second.status, 4, second.stdout + second.stderr);
  const stopped = readJson(path.join(excel.runDir, 'powerpoint-run.json'));
  assert.equal(stopped.excelSeen, true);
  assert.match(stopped.stopped, /EXCEL\.EXE appeared while a~default was open/u);
  assert.equal(readJson(path.join(excel.entries[1].dir, 'powerpoint-raw.json')).open.status, 'not-run');
});

test('self-test: PowerPoint quit but its process still there after the wait: recorded, said on the done line, never ended', { skip }, () => {
  const folder = selfTestFolder({ 'a.pptx': { slideSize: [960, 540], slides } }, { exitsAfterQuit: false, powerpointIds: [5150] });
  const answer = powershell(['-File', SCRIPT, '-Plan', folder.plan, '-SelfTest', '-Fake', folder.scenario]);
  assert.equal(answer.status, 0, answer.stdout + answer.stderr);
  assert.match(answer.stdout, /NT16 done exit 0; POWERPNT\.EXE 5150 had not exited after 1\.5 s\s*$/u);
  const run = readJson(path.join(folder.runDir, 'powerpoint-run.json'));
  assert.deepEqual([run.finish.quit, run.finish.exited, run.finish.exitSeconds, run.finish.left, run.powerpointMayBeLeft], [true, false, 1.5, [5150], true]);
  assert.match(run.finish.message, /the driver does not end it/u);
  assert.equal(callsOf(folder.scenario).at(-1), 'wait-exit 5150 within 1.5');
});

test('self-test end to end: the Node driver starts the real script once (fake COM) and writes a valid run directory', { skip }, async () => {
  const root = mkdtempSync(path.join(tmpdir(), 'nt16-e2e-'));
  const input = path.join(root, 'pptx', 'pricing.pptx');
  mkdirSync(path.dirname(input), { recursive: true });
  writeFileSync(input, 'deck');
  const scenario = path.join(root, 'scenario.json');
  const withLinks = sampleSlides();
  // Slide.Hyperlinks repeats the cell link the probe found and adds one on words the per-shape reading missed.
  withLinks[0].hyperlinks = [
    { address: 'https://example.com/pro', subAddress: '', type: 0, text: 'Pro' },
    { address: 'https://example.com/words', subAddress: '', type: 0, text: 'these words' },
  ];
  writeFileSync(scenario, JSON.stringify({ processes: [[]], app: { version: '16.0', build: '20625' }, files: { 'pricing.pptx': { slideSize: [960, 540], slides: withLinks } } }));
  const ctx = createContext({ runDir: path.join(root, 'run'), machine: windowsMachine({ officeProcesses: async () => [], powerpointInstall: async () => ({ path: 'POWERPNT.EXE', version: '16.0.20625.20108' }) }), timeouts: LIMITS, selfTest: { fake: scenario } });
  assert.equal((await check(ctx)).status, 'ready');
  const done = await runFiles(ctx, [{ path: input, relativePath: 'pptx/pricing.pptx', deck: 'pricing', variant: 'default' }], { opf: { version: '0.37.0' } });
  assert.equal(done.exit, 0, done.stderr);
  assert.deepEqual(done.notRun, []);
  const [result] = done.results;
  assert.deepEqual(validateResult(result).errors, []);
  assert.deepEqual(validateRun(done.run).errors, []);
  assert.equal(result.file.unchangedAfterRun, true);
  assert.equal(result.verbs.edits.length, 7);
  assert.ok(result.verbs.edits.every((edit) => edit.status === 'done'));
  assert.deepEqual(result.slides[0].objects.map((object) => object.kind), ['title', 'table', 'link', 'link']);
  assert.deepEqual(result.slides[0].objects[3], { kind: 'link', outcome: null, text: 'these words', on: 'text', target: 'https://example.com/words', details: { address: 'https://example.com/words', subAddress: '', from: 'Slide.Hyperlinks' } });
  assert.equal(result.application.version, '16.0');
  assert.deepEqual(result.details.powerpoint, { ids: [4242], quit: true, exited: true, exitSeconds: 0.5, left: [], mayBeLeft: false });
  assert.equal(done.summary, 'PowerPoint quit and POWERPNT.EXE 4242 exited after 0.5 s');
  assert.deepEqual(done.notes, []);
});
