// NT-16: the PowerPoint driver's Node side without PowerPoint, on every system: check() (Office running, not installed,
// another system, the lock), one run against a fake powerpoint.ps1 child (test-support.mjs) for a clean file, a call that
// does not return, a failed open, a failed slide export, a refusal inside the script, a script that dies, a file changed
// on disk, Excel appearing, a presentation left open, the edit-case bookkeeping, and the raw -> result.json mapping.
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { validateResult, validateRun } from '../../core/result/result.mjs';
import { check, createContext, EDIT_CASES, RENDER_WIDTH, runFiles, SCRIPT } from './driver.mjs';
import { LOCK_NAME, parseRegValue, parseTasklist, splitOfficeVersion, takeLock } from './machine.mjs';
import { buildResult, kindOf, linkTarget, objectsOf, OPEN_NOTE } from './normalize.mjs';
import { fakeExec, REG_VERSION, sampleSlides, TASKLIST_IDLE, tasklistWith, windowsMachine } from './test-support.mjs';

const temp = (name) => mkdtempSync(path.join(tmpdir(), `nt16-${name}-`));
const OPF = { version: '0.37.0', commit: 'abc1234' };
const NOW = () => new Date('2026-11-27T10:00:00Z');

function inputs(names) {
  const root = temp('in');
  return names.map((name) => {
    const file = path.join(root, `${name}.pptx`);
    writeFileSync(file, `deck ${name}`);
    return { path: file, relativePath: `pptx/${name}.pptx`, deck: name, variant: 'default', id: `${name}~default` };
  });
}

async function ready(exec, extra = {}) {
  const ctx = createContext({ runDir: path.join(temp('out'), 'run'), exec, machine: windowsMachine(), now: NOW, powershell: 'C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe', ...extra });
  const answer = await check(ctx);
  assert.equal(answer.status, 'ready', answer.reasons.join('; '));
  return ctx;
}

const readJson = (file) => JSON.parse(readFileSync(file, 'utf8'));
const powershellCalls = (exec) => exec.calls.filter(([command]) => path.basename(command).toLowerCase() === 'powershell.exe');

test('check refuses while POWERPNT.EXE or EXCEL.EXE runs, says whose it is, and starts no PowerShell', async () => {
  for (const running of [['POWERPNT.EXE'], ['EXCEL.EXE'], ['POWERPNT.EXE', 'EXCEL.EXE']]) {
    const exec = fakeExec({ running });
    const ctx = createContext({ runDir: temp('run'), exec, machine: windowsMachine() });
    const answer = await check(ctx);
    assert.equal(answer.status, 'refused');
    assert.equal(answer.reasons.length, running.length);
    for (const [k, name] of running.entries()) assert.match(answer.reasons[k], new RegExp(`^${name.replace('.', '\\.')} is running: that instance is the owner's\\. The driver neither uses nor ends it`, 'u'));
    assert.deepEqual(answer.facts.application, { name: 'PowerPoint', version: '16.0', build: '20625.20108' }, 'the version is read from the registry, without PowerPoint');
    assert.deepEqual(powershellCalls(exec), []);
    assert.deepEqual(exec.calls.map(([command]) => command).sort(), ['reg', 'reg', 'tasklist']);
  }
});

test('check refuses on another system, without PowerPoint, and while a live driver holds the lock', async () => {
  const mac = await check(createContext({ runDir: temp('run'), exec: fakeExec(), machine: { platform: () => 'darwin' } }));
  assert.equal(mac.status, 'refused');
  assert.match(mac.reasons[0], /PowerPoint runs on Windows only \(this is darwin\)/u);
  const none = await check(createContext({ runDir: temp('run'), exec: fakeExec({ installed: false }), machine: windowsMachine() }));
  assert.match(none.reasons.join('\n'), /PowerPoint is not installed here/u);
  assert.equal(none.facts.application.version, 'unknown until the run starts');
  const runDir = temp('run');
  writeFileSync(path.join(runDir, LOCK_NAME), JSON.stringify({ pid: process.ppid, started: 'earlier' }));
  const locked = await check(createContext({ runDir, exec: fakeExec(), machine: windowsMachine() }));
  assert.match(locked.reasons.join('\n'), new RegExp(`another PowerPoint driver \\(process ${process.ppid}\\) holds this run directory's lock`, 'u'));
});

test('the machine facts parse tasklist and reg output', () => {
  assert.deepEqual(parseTasklist(tasklistWith('POWERPNT.EXE', 'excel.exe')), ['SYSTEM IDLE PROCESS', 'EXPLORER.EXE', 'POWERPNT.EXE', 'EXCEL.EXE']);
  assert.deepEqual(parseTasklist(TASKLIST_IDLE).includes('POWERPNT.EXE'), false);
  assert.equal(parseRegValue(REG_VERSION, 'VersionToReport'), '16.0.20625.20108');
  assert.deepEqual(splitOfficeVersion('16.0.20625.20108'), { version: '16.0', build: '20625.20108' });
  assert.equal(splitOfficeVersion('16'), null);
});

test('one clean file: one powershell.exe call, every verb and edit case done, result.json and run.json valid', async () => {
  const exec = fakeExec();
  const ctx = await ready(exec);
  const [input] = inputs(['pricing']);
  const lines = [];
  const done = await runFiles(ctx, [input], { opf: OPF, tier: 'smoke', baseline: '0.36.0', log: (line) => lines.push(line) });
  const calls = powershellCalls(exec);
  assert.equal(calls.length, 1, 'one PowerShell process for the whole run');
  const plan = path.join(ctx.runDir, 'powerpoint-plan.json');
  assert.deepEqual(calls[0].slice(1), ['-NoProfile', '-NonInteractive', '-File', SCRIPT, '-Plan', plan]);
  const written = readJson(plan);
  assert.equal(written.width, RENDER_WIDTH);
  assert.deepEqual(written.edits, EDIT_CASES);
  assert.deepEqual(written.files, [{ id: 'pricing~default', path: input.path, dir: path.join(ctx.runDir, 'files', 'pricing~default') }]);
  assert.deepEqual(lines, ['NT16 file pricing~default open done']);
  assert.equal(done.stopped, false);
  assert.deepEqual(done.notRun, []);
  assert.ok(done.validations.every((validation) => validation.ok), JSON.stringify(done.validations));
  assert.ok(done.runValidation.ok, done.runValidation.errors.join('\n'));
  const result = readJson(path.join(ctx.runDir, 'files', 'pricing~default', 'result.json'));
  assert.deepEqual(validateResult(result), { ok: true, errors: [] });
  assert.equal(result.target, 'powerpoint');
  assert.deepEqual(result.application, { name: 'PowerPoint', version: '16.0', build: '20625.20108' });
  assert.deepEqual(result.system, { os: 'Windows', version: '10.0.26300' });
  assert.equal(result.file.unchangedAfterRun, true);
  assert.equal(result.file.path, 'pptx/pricing.pptx');
  assert.deepEqual(result.verbs.open, { status: 'done', seconds: 0.4, message: OPEN_NOTE, slideCount: 2, warnings: { status: 'not-read', source: null, lines: [] } });
  assert.deepEqual(result.verbs.render.pixelSize, [1, 1], 'the size the picture has (the fake writes 1 x 1)');
  assert.deepEqual(result.verbs.resave, { status: 'done', seconds: 0.3, path: 'resaved.pptx' });
  assert.deepEqual(
    result.verbs.edits.map((edit) => [edit.id, edit.status, edit.path]),
    EDIT_CASES.map((edit) => [edit.id, 'done', `edits/${edit.id}.pptx`]),
  );
  const [one, two] = result.slides;
  assert.equal(two.hidden, true);
  assert.equal(two.picture, 'slides/slide-002.png', 'PowerPoint exports a picture of a hidden slide');
  assert.equal(two.notes, 'Speaker\nnotes');
  assert.deepEqual(
    one.objects.map((object) => object.kind),
    ['title', 'table', 'link'],
  );
  assert.deepEqual(one.objects[1].details.cells[0][0], { text: 'Plan', fill: '1F4E79', color: 'FFFFFF' });
  assert.deepEqual({ on: one.objects[2].on, target: one.objects[2].target }, { on: 'cell', target: 'https://example.com/pro' });
  assert.deepEqual(two.objects.map((object) => [object.kind, object.role ?? null]), [['footer', 'footer'], ['notes', null]]);
  assert.deepEqual(one.details.placeholders, [{ name: 'Title 1', type: 'title' }]);
  assert.equal(result.details.close.status, 'done');
  const run = readJson(path.join(ctx.runDir, 'run.json'));
  assert.deepEqual(validateRun(run), { ok: true, errors: [] });
  assert.deepEqual([run.target, run.tier, run.baseline, run.check.status], ['powerpoint', 'smoke', '0.36.0', 'ready']);
  assert.equal(existsSync(path.join(ctx.runDir, LOCK_NAME)), false, 'the lock is removed at the end');
});

test('a call PowerPoint does not answer: timeout, the files after it not-run, the run stopped and PowerPoint left alone', async () => {
  const exec = fakeExec({ files: { 'b.pptx': { hang: 'open' } } });
  const ctx = await ready(exec);
  const done = await runFiles(ctx, inputs(['a', 'b', 'c']), { opf: OPF });
  assert.equal(done.stopped, true);
  assert.deepEqual(
    done.results.map((result) => result.verbs.open.status),
    ['done', 'timeout', 'not-run'],
  );
  assert.match(done.results[1].verbs.open.message, /did not answer Ppt-Open within 120 s; the run stopped without ending PowerPoint: a POWERPNT\.EXE process may be left/u);
  assert.match(done.results[2].verbs.open.message, /^not run: the run stopped earlier/u);
  assert.match(done.notRun.map((item) => item.reason).join('\n'), /may be left for the supervisor to look at \(the driver never ends it\)/u);
  assert.ok(done.notRun.every((item) => item.blocking));
  assert.ok(done.validations.every((validation) => validation.ok));
  assert.deepEqual(
    done.run.files.map((file) => [file.id, file.open, file.slideCount]),
    [
      ['a~default', 'done', 2],
      ['b~default', 'timeout', null],
      ['c~default', 'not-run', null],
    ],
  );
});

test('a render that does not return mid-file: that verb is timeout, probe and the edit cases are not-run', async () => {
  const ctx = await ready(fakeExec({ files: { 'a.pptx': { hang: 'render' } } }));
  const [result] = (await runFiles(ctx, inputs(['a']), { opf: OPF })).results;
  assert.equal(result.verbs.render.status, 'timeout');
  assert.equal(result.verbs.probe.status, 'not-run');
  assert.equal(result.verbs.edits, undefined);
  assert.deepEqual(validateResult(result).errors, []);
});

test('a failed open keeps PowerPoint\'s message; the next file still runs', async () => {
  const ctx = await ready(fakeExec({ files: { 'a.pptx': { openError: 'PowerPoint found a problem with content in a.pptx.' } } }));
  const done = await runFiles(ctx, inputs(['a', 'b']), { opf: OPF });
  assert.deepEqual(done.results[0].verbs.open, { status: 'failed', seconds: 0.1, message: 'PowerPoint found a problem with content in a.pptx.', warnings: { status: 'not-read', source: null, lines: [] } });
  assert.deepEqual(done.results[0].slides, []);
  assert.equal(done.results[1].verbs.open.status, 'done');
  assert.equal(done.stopped, false);
});

test('one slide that fails to export is a null picture and a failed render naming it, not a failed file', async () => {
  const ctx = await ready(fakeExec({ files: { 'a.pptx': { exportFail: [1] } } }));
  const [result] = (await runFiles(ctx, inputs(['a']), { opf: OPF })).results;
  assert.equal(result.verbs.render.status, 'failed');
  assert.match(result.verbs.render.message, /slide 1: Slide\.Export failed/u);
  assert.deepEqual(
    result.slides.map((slide) => slide.picture),
    [null, 'slides/slide-002.png'],
  );
  assert.equal(result.verbs.probe.status, 'done');
  assert.deepEqual(validateResult(result).errors, []);
});

test('Office started after check: the script refuses, nothing is opened, the lock is released', async () => {
  const ctx = await ready(fakeExec({ refuseInScript: ['POWERPNT.EXE'] }));
  const done = await runFiles(ctx, inputs(['a']), { opf: OPF });
  assert.deepEqual(done.refused, ["POWERPNT.EXE is running: that instance is the owner's."]);
  assert.deepEqual(done.results, []);
  assert.equal(existsSync(path.join(ctx.runDir, LOCK_NAME)), false);
});

test('a script that dies: every file not-run with the reason, the run unfinished, the files still valid', async () => {
  const ctx = await ready(fakeExec({ crash: 'Exception setting "ApartmentState"' }));
  const done = await runFiles(ctx, inputs(['a', 'b']), { opf: OPF });
  assert.equal(done.stopped, true);
  assert.match(done.notRun[0].reason, /powerpoint\.ps1 exited with 1 and wrote no powerpoint-run\.json: Exception setting "ApartmentState"/u);
  assert.ok(done.results.every((result) => result.verbs.open.status === 'not-run' && /wrote nothing about this file/u.test(result.verbs.open.message)));
  assert.ok(done.validations.every((validation) => validation.ok));
  assert.deepEqual(done.run.application, { name: 'PowerPoint', version: '16.0', build: '20625.20108' }, 'the registry facts when PowerPoint never answered');
});

test('the hash proof: an input that changed during the run is not unchanged', async () => {
  const ctx = await ready(fakeExec({ files: { 'a.pptx': { writeInput: true } } }));
  const [result] = (await runFiles(ctx, inputs(['a']), { opf: OPF })).results;
  assert.equal(result.file.unchangedAfterRun, false);
  assert.notEqual(result.details.sha256.node.before, result.details.sha256.node.after);
});

test('the hash proof also needs the PowerShell side\'s two hashes to agree with Node\'s', () => {
  const base = { raw: { open: { status: 'not-run' } }, input: { deck: 'a', variant: 'default', relativePath: 'a.pptx' }, application: { name: 'PowerPoint', version: '16.0' }, system: { os: 'Windows', version: '10' }, opf: OPF, started: '2026-11-27T10:00:00Z', finished: '2026-11-27T10:00:01Z', hashes: { before: 'a'.repeat(64), after: 'a'.repeat(64) } };
  assert.equal(buildResult(base).file.unchangedAfterRun, true);
  assert.equal(buildResult({ ...base, raw: { ...base.raw, sha256Before: 'a'.repeat(64), sha256After: 'b'.repeat(64) } }).file.unchangedAfterRun, false);
  assert.equal(buildResult({ ...base, hashes: { before: 'a'.repeat(64), after: null } }).file.unchangedAfterRun, null);
});

test('Excel appearing stops the run after that file; the driver does not end it', async () => {
  const ctx = await ready(fakeExec({ files: { 'a.pptx': { excel: true } } }));
  const done = await runFiles(ctx, inputs(['a', 'b']), { opf: OPF });
  assert.equal(done.stopped, true);
  assert.equal(done.results[0].details.excelSeen, true);
  assert.equal(done.results[1].verbs.open.status, 'not-run');
  assert.match(done.notRun[0].reason, /EXCEL\.EXE appeared/u);
});

test('a presentation left open: PowerPoint is not quit and the run says so', async () => {
  const ctx = await ready(fakeExec({ keepOpen: true }));
  const done = await runFiles(ctx, inputs(['a']), { opf: OPF });
  assert.equal(done.driverRun.finish.quit, false);
  assert.deepEqual(done.notRun.map((item) => item.what), ['quitting PowerPoint']);
});

test('how PowerPoint ended: exited is the summary line; still there after Quit is a note, not a failed verb', async () => {
  const clean = await runFiles(await ready(fakeExec()), inputs(['a']), { opf: OPF });
  assert.equal(clean.summary, 'PowerPoint quit and POWERPNT.EXE 4242 exited after 0.8 s');
  assert.deepEqual([clean.notes, clean.notRun, clean.stopped], [[], [], false]);
  assert.deepEqual(clean.results[0].details.powerpoint, { ids: [4242], quit: true, exited: true, exitSeconds: 0.8, left: [], mayBeLeft: false });

  const left = await runFiles(await ready(fakeExec({ exitsAfterQuit: false })), inputs(['a']), { opf: OPF });
  assert.match(left.summary, /^PowerPoint quit, but POWERPNT\.EXE 4242 had not exited 15 s later: it is left for the supervisor \(the driver never ends it\)$/u);
  assert.deepEqual(left.notRun, []);
  assert.equal(left.stopped, false);
  assert.match(left.notes[0], /POWERPNT\.EXE 4242 had not ended 15 s later; the driver does not end it/u);
  assert.equal(left.results[0].verbs.resave.status, 'done', 'every verb stands');
  assert.deepEqual(left.results[0].details.powerpoint, { ids: [4242], quit: true, exited: false, exitSeconds: 15, left: [4242], mayBeLeft: true });
  assert.deepEqual(validateResult(left.results[0]).errors, []);
});

test('edit cases: one that does not apply is not-run with the reason; after a failed close none runs', async () => {
  const ctx = await ready(fakeExec({ files: { 'a.pptx': { notApplicable: { 'add-row': 'the file has no table', 'delete-row': 'the file has no table with two rows or more' } }, 'b.pptx': { closeError: 'Close failed' } } }));
  const [a, b] = (await runFiles(ctx, inputs(['a', 'b']), { opf: OPF })).results;
  const addRow = a.verbs.edits.find((edit) => edit.id === 'add-row');
  assert.deepEqual(addRow, { id: 'add-row', what: 'add a table row', path: 'edits/add-row.pptx', status: 'not-run', seconds: 0.2, message: 'not applicable: the file has no table' });
  assert.equal(a.verbs.edits.filter((edit) => edit.status === 'done').length, 5);
  assert.ok(b.verbs.edits.every((edit) => edit.status === 'not-run' && edit.message === 'not run: the file did not close'));
  assert.equal(b.details.close.status, 'failed');
  assert.deepEqual(validateResult(a).errors, []);
  assert.deepEqual(validateResult(b).errors, []);
});

test('the lock: a live holder refuses, a stale one is taken over, a released one is gone', () => {
  const runDir = temp('lock');
  const first = takeLock(runDir, { pid: 111, alive: () => true });
  assert.equal(first.ok, true);
  const second = takeLock(runDir, { pid: 222, alive: () => true });
  assert.equal(second.ok, false);
  assert.match(second.reason, /another PowerPoint driver \(process 111/u);
  const stale = takeLock(runDir, { pid: 333, alive: () => false });
  assert.equal(stale.ok, true, 'a lock whose process is gone is stale');
  first.release();
  assert.equal(existsSync(path.join(runDir, LOCK_NAME)), true, 'a release by a former holder leaves the new lock');
  stale.release();
  assert.equal(existsSync(path.join(runDir, LOCK_NAME)), false);
  writeFileSync(path.join(runDir, LOCK_NAME), 'not json');
  assert.equal(takeLock(runDir, { pid: 444, alive: () => true }).ok, true, 'an unreadable lock is stale');
});

test('a live lock makes runFiles refuse before any PowerShell starts', async () => {
  const exec = fakeExec();
  const ctx = await ready(exec);
  mkdirSync(ctx.runDir, { recursive: true });
  writeFileSync(path.join(ctx.runDir, LOCK_NAME), JSON.stringify({ pid: process.ppid, started: 'earlier' }));
  const done = await runFiles(ctx, inputs(['a']), { opf: OPF });
  assert.match(done.refused[0], /another PowerPoint driver/u);
  assert.deepEqual(powershellCalls(exec), []);
});

test('kinds: each PowerPoint shape type maps to its shared kind', () => {
  const cases = [
    [{ type: 14, placeholder: { type: 3 }, text: 'Cover' }, 'title'],
    [{ type: 14, placeholder: { type: 4 }, text: 'Sub' }, 'body'],
    [{ type: 14, placeholder: { type: 2 }, text: 'One\rTwo', bullets: true }, 'list'],
    [{ type: 14, placeholder: { type: 2 } }, 'body'],
    [{ type: 14, placeholder: { type: 13 }, text: '3' }, 'footer'],
    [{ type: 14, placeholder: { type: 7, containedType: 13 } }, 'picture'],
    [{ type: 14, placeholder: { type: 7, containedType: 19 }, hasTable: true }, 'table'],
    [{ type: 17, text: 'Note' }, 'text'],
    [{ type: 17 }, 'text'],
    [{ type: 1, text: 'Label' }, 'text'],
    [{ type: 1 }, 'shape'],
    [{ type: 5 }, 'shape'],
    [{ type: 9 }, 'connector'],
    [{ type: 1, connector: true }, 'connector'],
    [{ type: 13 }, 'picture'],
    [{ type: 28 }, 'picture'],
    [{ type: 3, hasChart: true }, 'chart'],
    [{ type: 16 }, 'media'],
    [{ type: 24, hasSmartArt: true }, 'diagram'],
    [{ type: 6, hasSmartArt: true }, 'diagram'],
    [{ type: 6, members: [] }, 'group'],
  ];
  for (const [raw, kind] of cases) assert.equal(kindOf(raw), kind, JSON.stringify(raw));
});

test('objects: group members in slide coordinates, SmartArt details, links on shapes and text, slide links', () => {
  const [group, groupLink] = objectsOf({ type: 6, name: 'OPF diagram 1', left: 10, top: 10, width: 200, height: 100, click: { address: 'https://example.com', subAddress: '' }, members: [{ type: 1, name: 'Box', left: 20, top: 30, width: 50, height: 40, text: 'A', textLinks: [{ address: '', subAddress: '258,3,Pricing', text: 'see' }] }] });
  assert.equal(group.kind, 'group');
  assert.deepEqual(group.objects[0].box, [20, 30, 50, 40], 'a member keeps the frame PowerPoint reports, in slide coordinates');
  assert.deepEqual({ kind: group.objects[1].kind, on: group.objects[1].on, target: group.objects[1].target }, { kind: 'link', on: 'text', target: 'slide:3' });
  assert.deepEqual({ on: groupLink.on, target: groupLink.target }, { on: 'shape', target: 'https://example.com' });
  const [diagram] = objectsOf({ type: 24, hasSmartArt: true, name: 'Diagram 2', smartArt: { layout: 'Basic Process', layoutId: 'urn:microsoft.com/office/officeart/2005/8/layout/process1', nodes: 3 } });
  assert.deepEqual([diagram.kind, diagram.appClass, diagram.details.layout, diagram.details.nodes], ['diagram', 'msoSmartArt', 'Basic Process', 3]);
  const [media] = objectsOf({ type: 16, mediaType: 3, alt: 'Clip' });
  assert.deepEqual([media.kind, media.alt, media.details.mediaType], ['media', 'Clip', 3]);
  const [line] = objectsOf({ type: 1, connector: true, line: { flipH: false, flipV: true, begin: { connected: true, shape: 'A', site: 2 }, end: { connected: false } } });
  assert.deepEqual(line.details.line.begin, { connected: true, shape: 'A', site: 2 });
  assert.equal(linkTarget({ address: 'https://example.com/a', subAddress: 'part' }), 'https://example.com/a#part');
  assert.equal(linkTarget({ address: '', subAddress: '' }), null);
  const long = objectsOf({ type: 17, text: 'x'.repeat(500) })[0];
  assert.equal(long.text.length, 200);
});

test('the sample slides of the fake are what powerpoint.ps1 writes for a probe (keys it reads)', () => {
  const keys = new Set(sampleSlides().flatMap((slide) => slide.shapes.flatMap((shape) => Object.keys(shape))));
  for (const key of ['name', 'id', 'type', 'left', 'top', 'width', 'height', 'alt', 'placeholder', 'text', 'fonts', 'bullets', 'textFrame', 'hasTable', 'rows', 'columns', 'cells', 'cellLinks']) assert.ok(keys.has(key), key);
  const script = readFileSync(SCRIPT, 'utf8');
  for (const key of ['hasTable', 'hasChart', 'hasSmartArt', 'connector', 'click', 'textLinks', 'cellLinks', 'cells', 'textFrame', 'smartArt', 'mediaType', 'members', 'placeholder']) assert.match(script, new RegExp(`\\$row\\.${key} =`, 'u'), `powerpoint.ps1 writes ${key}`);
});

test('a picture whose header cannot be read keeps the size PowerPoint was asked for', async () => {
  const ctx = await ready(fakeExec({ files: { 'a.pptx': { picture: Buffer.from('not a png') } } }));
  const [result] = (await runFiles(ctx, inputs(['a']), { opf: OPF })).results;
  assert.deepEqual(result.verbs.render.pixelSize, [1920, 1080]);
});
