// NT-18: the Keynote driver stops at the first refused import and reads Keynote's wear. On 2026-11-27 a Keynote that had
// imported about 890 documents since 2026-11-25 refused every further import, and the run went on: five more opens, five
// alerts in front of the owner. These tests use the faked process runner (test-support.mjs fakeExec); none runs
// osascript, ps or lsof.
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { validateRun } from '../../core/result/result.mjs';
import { check, createContext, judgeWear, REMOTE_ASSETS_REFUSE, REMOTE_ASSETS_WARN } from './driver.mjs';
import { keynoteWear, parseLsof, parseStartTime } from './machine.mjs';
import { main } from './run.mjs';
import { isWriteError } from './run-file.mjs';
import { fakeExec, lsofTable, probeToLines } from './test-support.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const LINES = probeToLines(JSON.parse(readFileSync(path.join(here, '../../core/result/fixtures/keynote-0.36.0/slide-links~default/raw/probe.json'), 'utf8')));
const REFUSED_OPEN = 'ERROR\t\topen failed: Can’t get id of missing value. (-1728)\n';
const NO_PERMISSION = 'x.applescript:1:2: execution error: The document “shapes” could not be exported as “_export”. You don’t have permission. (6)';

function inputs(names = ['alpha', 'beta', 'gamma']) {
  const root = mkdtempSync(path.join(tmpdir(), 'nt18-in-'));
  const files = names.map((name) => {
    const file = path.join(root, name, 'default.pptx');
    mkdirSync(path.dirname(file), { recursive: true });
    writeFileSync(file, name);
    return file;
  });
  return { root, files };
}

const outDir = () => path.join(mkdtempSync(path.join(tmpdir(), 'nt18-out-')), 'run');
const quiet = () => {
  const lines = [];
  return { lines, log: (line) => lines.push(line), error: (line) => lines.push(line) };
};
/** The osascript verbs in order, with the deck of each open. */
const verbs = (exec) => exec.osascript().map(([verb, arg]) => (verb === 'open' ? `open ${path.basename(path.dirname(arg))}` : verb));

test('a refused open stops the batch: no further file is sent, exit 2, the owner is told about the alert', async () => {
  const { root, files } = inputs();
  const out = outDir();
  const exec = fakeExec({ lines: LINES, documentId: ['DOC-A', 'DOC-B', 'DOC-C'], on: { open: ([file]) => (file.includes('/beta/') ? { stdout: REFUSED_OPEN } : undefined) } });
  const output = quiet();
  assert.equal(await main(['--out', out, '--opf', '0.37.0', '--input-root', root, ...files], { exec, ...output }), 2);
  // alpha runs whole; beta's open is refused (open() asks info once for a late document); gamma is never sent.
  assert.deepEqual(verbs(exec), ['info', 'open alpha', 'probe', 'render', 'resave', 'close', 'info', 'open beta', 'info']);
  const text = output.lines.join('\n');
  assert.match(text, /stopping after beta~default: Keynote refused to import beta~default: open failed: Can’t get id of missing value\. \(-1728\)\. An alert may be showing in Keynote; only the owner dismisses it\. No further file was sent\./u);
  const run = JSON.parse(readFileSync(path.join(out, 'run.json'), 'utf8'));
  assert.deepEqual(validateRun(run), { ok: true, errors: [] });
  assert.deepEqual(
    run.files.map((file) => [file.id, file.open]),
    [
      ['alpha~default', 'done'],
      ['beta~default', 'failed'],
    ],
  );
});

test('a timed-out open stops too, with or without --keep-going', async () => {
  for (const extra of [[], ['--keep-going']]) {
    const { root, files } = inputs();
    const exec = fakeExec({ lines: LINES, on: { open: () => ({ code: 1, stderr: 'x:1:2: execution error: Keynote got an error: AppleEvent timed out. (-1712)' }) } });
    assert.equal(await main(['--out', outDir(), '--opf', '0.37.0', '--input-root', root, ...extra, ...files], { exec, ...quiet() }), 2);
    assert.deepEqual(verbs(exec), ['info', 'open alpha', 'info']);
  }
});

test('a permission error on render: resave is not sent, the document is closed, the batch stops with exit 2', async () => {
  const { root, files } = inputs(['shapes', 'tables']);
  const out = outDir();
  const exec = fakeExec({ lines: LINES, on: { render: () => ({ code: 1, stderr: NO_PERMISSION }) } });
  const output = quiet();
  assert.equal(await main(['--out', out, '--opf', '0.37.0', '--input-root', root, ...files], { exec, ...output }), 2);
  assert.deepEqual(verbs(exec), ['info', 'open shapes', 'probe', 'render', 'close']);
  assert.equal(exec.openDocuments.length, 0, 'our document was closed');
  assert.match(output.lines.join('\n'), /stopping after shapes~default: Keynote could not write the render of shapes~default: .*You don’t have permission\. \(6\)\. The document was closed; no further file was sent\./u);
  const result = JSON.parse(readFileSync(path.join(out, 'files/shapes~default/result.json'), 'utf8'));
  assert.equal(result.verbs.render.status, 'failed');
  assert.equal(result.verbs.resave.status, 'not-run');
});

test('a permission error on resave stops the batch after the close', async () => {
  const { root, files } = inputs(['shapes', 'tables']);
  const exec = fakeExec({ lines: LINES, on: { resave: () => ({ code: 1, stderr: 'x:1:2: execution error: The document “shapes” could not be exported as “resaved”. You don’t have permission. (6)' }) } });
  assert.equal(await main(['--out', outDir(), '--opf', '0.37.0', '--input-root', root, ...files], { exec, ...quiet() }), 2);
  assert.deepEqual(verbs(exec), ['info', 'open shapes', 'probe', 'render', 'resave', 'close']);
});

test('--keep-going: the old behavior, every file is sent after a refused open and after a write error', async () => {
  const { root, files } = inputs();
  const exec = fakeExec({
    lines: LINES,
    documentId: ['DOC-A', 'DOC-C'],
    on: {
      open: ([file]) => (file.includes('/beta/') ? { stdout: REFUSED_OPEN } : undefined),
      render: ([id]) => (id === 'DOC-A' ? { code: 1, stderr: NO_PERMISSION } : undefined),
    },
  });
  assert.equal(await main(['--out', outDir(), '--opf', '0.37.0', '--input-root', root, '--keep-going', ...files], { exec, ...quiet() }), 1);
  assert.deepEqual(verbs(exec), ['info', 'open alpha', 'probe', 'render', 'resave', 'close', 'info', 'open beta', 'info', 'info', 'open gamma', 'probe', 'render', 'resave', 'close']);
});

test('write errors: permission and write failures, not other failures', () => {
  assert.equal(isWriteError({ status: 'failed', message: 'execution error: The document “shapes” could not be exported as “_export”. You don’t have permission. (6)' }), true);
  assert.equal(isWriteError({ status: 'failed', message: 'execution error: Keynote got an error: File permission error. (-54)' }), true);
  assert.equal(isWriteError({ status: 'failed', message: 'Keynote exported 1 pictures for 3 slides that are not skipped' }), false);
  assert.equal(isWriteError({ status: 'timeout', message: 'permission' }), false);
});

test('lsof parsing: the descriptors and the ones on app-remote-assets; not a table is null', () => {
  const sample = [
    'COMMAND   PID    USER   FD   TYPE             DEVICE SIZE/OFF                NODE NAME',
    'Keynote 41250 michael  cwd    DIR               1,18      640                   2 /',
    'Keynote 41250 michael  txt    REG               1,18 15829840 1152921500312700000 /Applications/Keynote.app/Contents/MacOS/Keynote',
    'Keynote 41250 michael   57u   REG               1,18   167936           123456789 /Users/michael/Library/Containers/com.apple.Keynote/Data/Library/Caches/app-remote-assets/database',
    'Keynote 41250 michael   58u   REG               1,18  4124152           123456790 /Users/michael/Library/Containers/com.apple.Keynote/Data/Library/Caches/app-remote-assets/database-wal',
    'Keynote 41250 michael   59u  unix 0x1234567890abcdef      0t0                     ->0xfedcba0987654321',
    '',
  ].join('\n');
  assert.deepEqual(parseLsof(sample), { descriptors: 5, remoteAssets: 2 });
  assert.deepEqual(parseLsof(lsofTable(1784)), { descriptors: 1786, remoteAssets: 1784 });
  assert.equal(parseLsof(''), null);
  assert.equal(parseLsof('lsof: command not found'), null);
  assert.match(parseStartTime('Wed Nov 25 09:14:03 2026\n'), /^2026-11-2[45]T\d\d:14:03Z$/u);
  assert.equal(parseStartTime('  '), null);
  assert.equal(parseStartTime('yesterday-ish'), null);
});

test('keynoteWear: pid, start, counts; imports are half the app-remote-assets descriptors; an absent lsof is not read', async () => {
  assert.deepEqual(await keynoteWear(fakeExec({ remoteAssets: 1784 })), {
    pid: 4242,
    started: parseStartTime('Wed Nov 25 09:14:03 2026'),
    descriptors: 1786,
    remoteAssets: 1784,
    imports: 892,
    problems: [],
  });
  const missing = await keynoteWear(fakeExec({ remoteAssets: null }));
  assert.equal(missing.remoteAssets, null);
  assert.equal(missing.pid, 4242);
  assert.match(missing.problems.join('\n'), /lsof did not list Keynote's descriptors \(spawn lsof ENOENT\)/u);
  const thrown = await keynoteWear(async (command) => {
    if (command === 'pgrep') return { code: 0, stdout: '7\n' };
    throw new Error(`${command} broke`);
  });
  assert.deepEqual([thrown.pid, thrown.started, thrown.remoteAssets], [7, null, null]);
});

test('thresholds: refuse when count + 2 x planned files passes 1,500, warn past 1,000', () => {
  assert.equal(REMOTE_ASSETS_REFUSE, 1500);
  assert.equal(REMOTE_ASSETS_WARN, 1000);
  const wear = (remoteAssets) => ({ pid: 1, started: '2026-11-25T08:14:03Z', descriptors: remoteAssets + 40, remoteAssets, imports: Math.floor(remoteAssets / 2), problems: [] });
  assert.equal(judgeWear(wear(1400), 50).refusal, null, '1,400 + 100 = 1,500 is not past the limit');
  const refused = judgeWear(wear(1400), 51);
  assert.equal(
    refused.refusal,
    "Keynote has imported about 700 documents since it was started on 2026-11-25T08:14:03Z; it stopped importing at about 890 on 2026-11-27; ask the owner to quit and reopen Keynote (the driver never starts or quits it). This run's 51 file(s) would bring its app-remote-assets descriptors to about 1502, past 1500.",
  );
  assert.equal(judgeWear(wear(1784), 1).refusal !== null, true, "the 2026-11-27 Keynote is refused even for one file");
  assert.equal(judgeWear(wear(1000), 0).notes.length, 1, '1,000 is not past the warning');
  const warned = judgeWear(wear(900), 60);
  assert.equal(warned.refusal, null);
  assert.match(warned.notes[1], /^Warning: Keynote has imported about 450 documents since it was started on 2026-11-25T08:14:03Z; this run would bring its app-remote-assets descriptors to about 1020/u);
  assert.match(judgeWear(wear(10), 3).notes[0], /^Keynote's wear: process 1, started 2026-11-25T08:14:03Z; 10 open descriptors on app-remote-assets \(50 in all\), about 5 documents imported; 3 file\(s\) planned, which would bring app-remote-assets to about 16/u);
  assert.deepEqual(judgeWear({ remoteAssets: null, problems: ['lsof did not list'] }, 99), { refusal: null, notes: ["Keynote's wear: not read (lsof did not list)."] });
});

test('check: refuses a worn Keynote before any open, with the planned files; lsof missing does not fail it', async () => {
  const runDir = mkdtempSync(path.join(tmpdir(), 'nt18-run-'));
  const worn = fakeExec({ remoteAssets: 1784 });
  const answer = await check(createContext({ runDir, exec: worn }), { files: 1 });
  assert.equal(answer.status, 'refused');
  assert.match(answer.reasons.join('\n'), /Keynote has imported about 892 documents since it was started on .*ask the owner to quit and reopen Keynote/u);
  assert.equal(answer.facts.wear.remoteAssets, 1784);

  const blind = await check(createContext({ runDir, exec: fakeExec({ remoteAssets: null }) }), { files: 400 });
  assert.equal(blind.status, 'ready');
  assert.deepEqual(blind.reasons, []);
  assert.match(blind.notes.join('\n'), /Keynote's wear: not read/u);

  const stopped = fakeExec({ running: false });
  const none = await check(createContext({ runDir, exec: stopped }), { files: 1 });
  assert.equal(none.facts.wear, null, 'no wear read when Keynote is not running');
  assert.ok(!stopped.calls.some(([command]) => command === 'lsof'));
});

test('run.mjs: a worn Keynote is refused before anything opens; the per-file check is given the files left', async () => {
  const { root, files } = inputs();
  const refusedExec = fakeExec({ remoteAssets: 1496 });
  const output = quiet();
  assert.equal(await main(['--out', outDir(), '--opf', '0.37.0', '--input-root', root, ...files], { exec: refusedExec, ...output }), 2);
  assert.deepEqual(verbs(refusedExec), ['info']);
  assert.match(output.lines.join('\n'), /check refused; nothing was opened:\n {2}- Keynote has imported about 748 documents/u);

  // Two descriptors per import, starting at 1,494: 1,494 + 2 x 3 = 1,500 before the first file, 1,496 + 2 x 2 before the
  // second, 1,498 + 2 x 1 before the third. Had each check been given all three files, the second would refuse.
  const exec = fakeExec({ lines: LINES, documentId: ['DOC-A', 'DOC-B', 'DOC-C'] });
  const opens = () => exec.osascript().filter(([verb]) => verb === 'open').length;
  const machine = { keynoteWear: async () => ({ pid: 4242, started: '2026-11-25T08:14:03Z', descriptors: 1540, remoteAssets: 1494 + 2 * opens(), imports: 747 + opens(), problems: [] }) };
  const out = outDir();
  const ran = quiet();
  assert.equal(await main(['--out', out, '--opf', '0.37.0', '--input-root', root, ...files], { exec, machine, ...ran }), 0, ran.lines.join('\n'));
  assert.equal(opens(), 3);
  const run = JSON.parse(readFileSync(path.join(out, 'run.json'), 'utf8'));
  assert.deepEqual(validateRun(run), { ok: true, errors: [] });
  assert.equal(run.check.status, 'ready');
  assert.match(run.check.reasons[0], /^Keynote's wear: process 4242, started 2026-11-25T08:14:03Z; 1494 open descriptors on app-remote-assets \(1540 in all\), about 747 documents imported; 3 file\(s\) planned/u);
  assert.match(run.check.reasons[1], /^Warning: Keynote has imported about 747 documents/u);
});
