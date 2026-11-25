// NT-02: the Keynote driver with its process runner faked (test-support.mjs fakeExec): no test runs osascript or talks
// to Keynote. Covers check's decision for every reason, the exact osascript argument lists of one file, timeouts,
// failures that must still close the document, the picture numbering around a hidden slide, and the result's schema.
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { validateResult } from '../../core/result/result.mjs';
import { check, createContext, exportedPositions, osascriptMessage, pairPictures, parseInfo, pngInfo, SCRIPT } from './driver.mjs';
import { foreignDocuments, openLedger } from './ledger.mjs';
import { parseScreenLocked } from './machine.mjs';
import { runFile } from './run-file.mjs';
import { fakeExec, probeToLines, tinyPng } from './test-support.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const recordedProbe = JSON.parse(readFileSync(path.join(here, '../../core/result/fixtures/keynote-0.36.0/slide-links~default/raw/probe.json'), 'utf8'));
const LINES = probeToLines(recordedProbe);
const OPF = { version: '0.37.0' };
const clock = () => {
  let tick = Date.parse('2026-11-25T18:00:00Z');
  return () => {
    tick += 1000;
    return new Date(tick);
  };
};

function setup(options = {}) {
  const runDir = mkdtempSync(path.join(tmpdir(), 'nt02-run-'));
  const inputDir = mkdtempSync(path.join(tmpdir(), 'nt02-in-'));
  const input = path.join(inputDir, 'slide-links', 'default.pptx');
  mkdirSync(path.dirname(input), { recursive: true });
  writeFileSync(input, 'exported by OPF');
  const exec = fakeExec({ lines: LINES, ...options });
  const ctx = createContext({ runDir, exec, now: clock(), ...(options.ctx ?? {}) });
  return { runDir, input, exec, ctx, file: { path: input, relativePath: 'slide-links/default.pptx', deck: 'slide-links', variant: 'default' } };
}

const osascriptCalls = (exec) => exec.calls.filter(([command]) => command === 'osascript');

test('check refuses when Keynote is not running, and sends Keynote nothing', async () => {
  const { exec, ctx } = setup({ running: false });
  const answer = await check(ctx);
  assert.equal(answer.status, 'refused');
  assert.match(answer.reasons.join('\n'), /Keynote is not running\. The owner starts it/u);
  assert.equal(osascriptCalls(exec).length, 0);
});

test('check refuses when the screen is locked, and sends Keynote nothing', async () => {
  const { exec, ctx } = setup({ locked: true });
  const answer = await check(ctx);
  assert.equal(answer.status, 'refused');
  assert.match(answer.reasons.join('\n'), /screen is locked/u);
  assert.equal(osascriptCalls(exec).length, 0);
});

test('check refuses when a document the run did not open is open', async () => {
  const { exec, ctx } = setup({ documents: [{ id: 'FOREIGN-1', name: 'Quarterly review' }] });
  const answer = await check(ctx);
  assert.equal(answer.status, 'refused');
  assert.deepEqual(answer.reasons, ['Keynote has a document this run did not open: "Quarterly review" (FOREIGN-1). Whoever opened it closes it; the driver never does.']);
  assert.deepEqual(exec.osascript(), [['info', 50_000]]);
});

test('check refuses when Keynote does not answer info', async () => {
  const { ctx } = setup({ on: { info: () => ({ code: 1, stderr: `${SCRIPT}:12:40: execution error: Keynote got an error: AppleEvent timed out. (-1712)` }) } });
  const answer = await check(ctx);
  assert.equal(answer.status, 'refused');
  assert.deepEqual(answer.reasons, ['Keynote did not answer the info event (timeout: execution error: Keynote got an error: AppleEvent timed out. (-1712)).']);
});

test('check is ready otherwise: one info event, versions from Keynote and its bundle', async () => {
  const { exec, ctx } = setup();
  const answer = await check(ctx);
  assert.deepEqual({ status: answer.status, reasons: answer.reasons }, { status: 'ready', reasons: [] });
  assert.deepEqual(answer.facts.application, { name: 'Keynote', version: '16.0', build: '7052.0.68' });
  assert.deepEqual(answer.facts.system, { os: 'macOS', version: '26.6.2' });
  assert.deepEqual(exec.osascript(), [['info', 50_000]]);
  assert.deepEqual(
    exec.calls.map(([command]) => command),
    ['pgrep', 'ioreg', 'sw_vers', 'osascript', 'mdfind', 'plutil', 'plutil', 'plutil'],
  );
  assert.deepEqual(exec.calls[0][1], ['-x', 'Keynote']);
});

test('one file: the verb sequence and the exact osascript arguments, closed, unchanged, valid', async () => {
  const { exec, ctx, runDir, input, file } = setup();
  await check(ctx);
  const done = await runFile(ctx, file, { opf: OPF });
  const dir = path.join(runDir, 'files', 'slide-links~default');
  assert.deepEqual(exec.osascript(), [
    ['info', 50_000],
    ['open', input, '120', 140_000],
    ['probe', 'DOC-1', path.join(dir, 'probe.lines'), '900', 920_000],
    ['render', 'DOC-1', path.join(dir, '_export'), '600', 620_000],
    ['resave', 'DOC-1', path.join(dir, 'resaved.pptx'), '600', 620_000],
    ['close', 'DOC-1', '60', 80_000],
  ]);
  assert.ok(osascriptCalls(exec).every(([, args]) => args[0] === SCRIPT));
  assert.deepEqual(done.validation, { ok: true, errors: [] });
  assert.equal(done.stop, false);
  assert.equal(done.close.state, 'CLOSED');
  const { result } = done;
  assert.deepEqual(
    Object.fromEntries(Object.entries(result.verbs).map(([verb, value]) => [verb, value.status])),
    { open: 'done', render: 'done', probe: 'done', resave: 'done' },
  );
  assert.deepEqual(result.verbs.render, { status: 'done', seconds: 0.25, pixelSize: [960, 540], alpha: true, colorProfile: 'Display P3' });
  assert.equal(result.verbs.resave.path, 'resaved.pptx');
  assert.deepEqual(result.verbs.open.warnings, { status: 'not-read', source: null, lines: [] });
  assert.equal(result.file.unchangedAfterRun, true);
  assert.equal(result.file.path, 'slide-links/default.pptx');
  assert.deepEqual(result.application, { name: 'Keynote', version: '16.0', build: '7052.0.68' });
  assert.deepEqual(
    result.slides.map((slide) => [slide.index, slide.hidden, slide.picture]),
    [
      [1, false, 'slides/slide-001.png'],
      [2, false, 'slides/slide-002.png'],
      [3, false, 'slides/slide-003.png'],
      [4, true, null],
    ],
  );
  assert.equal(result.slides[1].objects[0].kind, 'title');
  assert.deepEqual(readdirSync(path.join(dir, 'slides')), ['slide-001.png', 'slide-002.png', 'slide-003.png']);
  assert.ok(!existsSync(path.join(dir, '_export')) && !existsSync(path.join(dir, 'probe.lines')));
  assert.ok(existsSync(path.join(dir, 'result.json')) && existsSync(path.join(dir, 'probe.json')));
  assert.deepEqual(ctx.ledger.open(), []);
  assert.equal(ctx.ledger.get('DOC-1').state, 'closed');
  assert.equal(exec.openDocuments.length, 0);
});

test('an Apple event timeout (-1712) is "timeout", and the document still closes', async () => {
  const { exec, ctx, file } = setup({
    on: { render: () => ({ code: 1, stderr: `${SCRIPT}:20:90: execution error: Keynote got an error: AppleEvent timed out. (-1712)\n` }) },
  });
  await check(ctx);
  const { result, validation, stop } = await runFile(ctx, file, { opf: OPF });
  assert.equal(result.verbs.render.status, 'timeout');
  assert.equal(result.verbs.render.message, 'execution error: Keynote got an error: AppleEvent timed out. (-1712)');
  assert.ok(!result.verbs.render.message.includes(SCRIPT), 'no local path in a message');
  assert.equal(result.verbs.resave.status, 'done');
  assert.deepEqual(exec.osascript().at(-1).slice(0, 2), ['close', 'DOC-1']);
  assert.equal(validation.ok, true);
  assert.equal(stop, false);
  assert.ok(result.slides.every((slide) => slide.picture === null));
});

test('osascript stopped by our own timeout is "timeout" too', async () => {
  const { ctx, file } = setup({ on: { probe: () => ({ code: null, timedOut: true }) } });
  await check(ctx);
  const { result } = await runFile(ctx, file, { opf: OPF });
  assert.equal(result.verbs.probe.status, 'timeout');
  assert.match(result.verbs.probe.message, /did not return in 920 s/u);
  assert.equal(result.slides.length, 4, 'slides from the open answer and the pictures');
  assert.equal(result.slides[0].layout, null);
});

test('a failure in render still closes the document; so does an exception', async () => {
  for (const render of [() => ({ code: 1, stderr: 'x.applescript:1:2: execution error: Keynote got an error: Can’t export. (-10000)' }), () => Promise.reject(new Error('exec broke'))]) {
    const { exec, ctx, file } = setup({ on: { render } });
    await check(ctx);
    const { result, validation, close } = await runFile(ctx, file, { opf: OPF });
    assert.equal(result.verbs.render.status, 'failed');
    assert.equal(close.status, 'done');
    assert.deepEqual(exec.osascript().at(-1).slice(0, 2), ['close', 'DOC-1']);
    assert.deepEqual(ctx.ledger.open(), []);
    assert.equal(validation.ok, true);
  }
});

test('open timing out: the late document is ledgered and closed, the run stops', async () => {
  const { exec, ctx, file } = setup({
    on: {
      open: (args, keynote) => {
        keynote.open(args);
        return { stdout: 'TIMEOUT\t\topen did not answer in 120 s (-1712)\n' };
      },
    },
  });
  await check(ctx);
  const { result, stop, close, validation } = await runFile(ctx, file, { opf: OPF });
  assert.equal(result.verbs.open.status, 'timeout');
  assert.match(result.verbs.open.message, /open did not answer in 120 s.*opened anyway as DOC-1/u);
  assert.deepEqual(
    exec.osascript().map(([verb]) => verb),
    ['info', 'open', 'info', 'close'],
  );
  assert.equal(close.state, 'CLOSED');
  assert.equal(stop, true);
  assert.equal(result.verbs.probe.status, 'not-run');
  assert.equal(validation.ok, true);
});

test('open failing with nothing opened: failed, no close, no stop', async () => {
  const { exec, ctx, file } = setup({ on: { open: () => ({ stdout: 'ERROR\t\topen failed: The file can’t be opened.\\nIt is damaged. (-10000)\n' }) } });
  await check(ctx);
  const { result, stop } = await runFile(ctx, file, { opf: OPF });
  assert.equal(result.verbs.open.status, 'failed');
  assert.equal(result.verbs.open.message, 'open failed: The file can’t be opened.\nIt is damaged. (-10000)');
  assert.deepEqual(
    exec.osascript().map(([verb]) => verb),
    ['info', 'open', 'info'],
  );
  assert.equal(stop, false);
  assert.deepEqual(result.slides, []);
  assert.equal(validateResult(result).ok, true);
});

test('a document that will not close stops the run', async () => {
  const { ctx, file } = setup({ on: { close: () => ({ stdout: 'STILL-OPEN\n' }) } });
  await check(ctx);
  const { close, stop } = await runFile(ctx, file, { opf: OPF });
  assert.equal(close.status, 'failed');
  assert.equal(stop, true);
  assert.deepEqual(ctx.ledger.open(), ['DOC-1']);
});

test('import warnings: not-read without text; text someone read goes through the parser as screen text', async () => {
  const text = 'Warnings – default\nThis PowerPoint presentation may look different.\nThe font Aptos is missing. Your text might look different.\nReplace Fonts...';
  const { ctx, file } = setup({ ctx: { warningsText: (id) => (id === 'slide-links~default' ? text : null) } });
  await check(ctx);
  const { result } = await runFile(ctx, file, { opf: OPF });
  assert.deepEqual(result.verbs.open.warnings, { status: 'read', source: 'screen', lines: [{ text: 'The font Aptos is missing. Your text might look different.' }] });
});

test('a changed input is reported', async () => {
  const { ctx, file, input } = setup({
    on: {
      resave: (args, keynote) => {
        writeFileSync(input, 'changed');
        return keynote.resave(args);
      },
    },
  });
  await check(ctx);
  const { result } = await runFile(ctx, file, { opf: OPF });
  assert.equal(result.file.unchangedAfterRun, false);
});

test('pictures: Keynote numbers among exported slides; they are renamed by slide position around hidden slides', () => {
  assert.deepEqual(exportedPositions(5, [2, 5]), [1, 3, 4]);
  assert.deepEqual(pairPictures(['_export.003.png', '_export.001.png', 'notes.txt', '_export.002.png'], 5, [2, 5]), {
    pairs: [
      { from: '_export.001.png', position: 1, to: 'slides/slide-001.png' },
      { from: '_export.002.png', position: 3, to: 'slides/slide-003.png' },
      { from: '_export.003.png', position: 4, to: 'slides/slide-004.png' },
    ],
  });
  assert.deepEqual(pairPictures(['_export.001.png'], 3, []), { error: 'Keynote exported 1 pictures for 3 slides that are not skipped' });
  assert.deepEqual(pairPictures(['_export.010.png', '_export.009.png'], 2, []).pairs.map((pair) => pair.from), ['_export.009.png', '_export.010.png']);
});

test('pngInfo: size, alpha and the embedded profile description', () => {
  assert.deepEqual(pngInfo(tinyPng({ width: 960, height: 540, profile: 'Display P3' })), { pixelSize: [960, 540], alpha: true, colorProfile: 'Display P3' });
  assert.deepEqual(pngInfo(tinyPng({ width: 720, height: 540, colorType: 2 })), { pixelSize: [720, 540], alpha: false });
  assert.equal(pngInfo(Buffer.from('not a png')), null);
});

test('parsers: info, the lock state, osascript messages', () => {
  assert.deepEqual(parseInfo('version\t16.0\ndocument\tA-1\tdefault\ndocument\tB-2\tname\\twith tab'), {
    version: '16.0',
    documents: [
      { id: 'A-1', name: 'default' },
      { id: 'B-2', name: 'name\twith tab' },
    ],
  });
  assert.equal(parseScreenLocked('<key>CGSSessionScreenIsLocked</key>\n\t<true/>'), true);
  assert.equal(parseScreenLocked('<key>CGSSessionScreenIsLocked</key><false/>'), false);
  assert.equal(parseScreenLocked('<dict></dict>'), false);
  assert.equal(osascriptMessage('/somewhere/keynote.applescript:100:120: execution error: x (-1728)\n'), 'execution error: x (-1728)');
});

test('ledger: kept in the run directory, latest state wins, foreign documents are the ones it does not list', () => {
  const runDir = mkdtempSync(path.join(tmpdir(), 'nt02-ledger-'));
  const ledger = openLedger(runDir);
  ledger.add({ documentId: 'A', input: '/in/a.pptx', sha256Before: 'aa' });
  ledger.add({ documentId: 'B', input: '/in/b.pptx', sha256Before: 'bb' });
  ledger.mark('A', 'closed');
  const again = openLedger(runDir);
  assert.deepEqual(again.open(), ['B']);
  assert.equal(again.get('A').input, '/in/a.pptx');
  assert.deepEqual(
    foreignDocuments(
      [
        { id: 'A', name: 'a' },
        { id: 'C', name: 'c' },
      ],
      again,
    ),
    [{ id: 'C', name: 'c' }],
  );
  assert.throws(() => again.mark('C', 'closed'), /not opened by this run/u);
});

test('close refuses a document the run did not open', async () => {
  const { ctx } = setup();
  const { close } = await import('./driver.mjs');
  await assert.rejects(close(ctx, { documentId: 'FOREIGN-1' }), /not a document this run opened/u);
});
