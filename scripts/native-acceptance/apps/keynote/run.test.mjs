// NT-02: the run command with the process runner faked: a refusal stops before anything opens (exit 2), a run writes a
// valid run.json and result.json, names come from the paths, and the run directory stays outside the repository.
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { validateResult, validateRun } from '../../core/result/result.mjs';
import { deckAndVariant, main, planInputs } from './run.mjs';
import { fakeExec, probeToLines } from './test-support.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const LINES = probeToLines(JSON.parse(readFileSync(path.join(here, '../../core/result/fixtures/keynote-0.36.0/slide-links~default/raw/probe.json'), 'utf8')));

function inputs() {
  const root = mkdtempSync(path.join(tmpdir(), 'nt02-in-'));
  const files = ['slide-links/default.pptx', 'slide-links/static.pptx'].map((relative) => {
    const file = path.join(root, relative);
    mkdirSync(path.dirname(file), { recursive: true });
    writeFileSync(file, relative);
    return file;
  });
  return { root, files };
}

const quiet = () => {
  const lines = [];
  return { lines, log: (line) => lines.push(line), error: (line) => lines.push(line) };
};

test('refused: exit 2 with the reasons, no Apple event, nothing written', async () => {
  const { files } = inputs();
  const out = path.join(mkdtempSync(path.join(tmpdir(), 'nt02-out-')), 'run');
  const exec = fakeExec({ running: false });
  const output = quiet();
  assert.equal(await main(['--out', out, '--opf', '0.37.0', ...files], { exec, ...output }), 2);
  assert.match(output.lines.join('\n'), /check refused; nothing was opened:\n {2}- Keynote is not running/u);
  assert.equal(exec.osascript().length, 0);
  assert.ok(!existsSync(path.join(out, 'run.json')));
});

test('two files: check before each, both closed, run.json and result.json valid, exit 0', async () => {
  const { root, files } = inputs();
  const out = path.join(mkdtempSync(path.join(tmpdir(), 'nt02-out-')), 'run');
  // Every open gets a new id, as Keynote does.
  const exec = fakeExec({ lines: LINES, documentId: ['DOC-A', 'DOC-B'] });
  const output = quiet();
  assert.equal(await main(['--out', out, '--opf', '0.37.0', '--opf-commit', 'abc1234', '--input-root', root, ...files], { exec, ...output }), 0, output.lines.join('\n'));
  assert.deepEqual(
    exec.osascript().map(([verb, id]) => (verb === 'info' ? verb : `${verb} ${verb === 'open' ? path.basename(id) : id}`)),
    ['info', 'open default.pptx', 'probe DOC-A', 'render DOC-A', 'resave DOC-A', 'close DOC-A', 'info', 'open static.pptx', 'probe DOC-B', 'render DOC-B', 'resave DOC-B', 'close DOC-B'],
  );
  const run = JSON.parse(readFileSync(path.join(out, 'run.json'), 'utf8'));
  assert.deepEqual(validateRun(run), { ok: true, errors: [] });
  assert.deepEqual(
    run.files.map((file) => [file.id, file.open, file.slideCount]),
    [
      ['slide-links~default', 'done', 4],
      ['slide-links~static', 'done', 4],
    ],
  );
  assert.deepEqual(run.opf, { version: '0.37.0', commit: 'abc1234' });
  const result = JSON.parse(readFileSync(path.join(out, 'files/slide-links~static/result.json'), 'utf8'));
  assert.deepEqual(validateResult(result), { ok: true, errors: [] });
  assert.equal(result.file.path, 'slide-links/static.pptx');
  assert.ok(!JSON.stringify(run).includes(tmpdir()) && !JSON.stringify(result).includes(tmpdir()), 'no absolute path in the results');
});

test('the warnings folder feeds a file its Warnings window text', async () => {
  const { files } = inputs();
  const out = path.join(mkdtempSync(path.join(tmpdir(), 'nt02-out-')), 'run');
  const warnings = mkdtempSync(path.join(tmpdir(), 'nt02-warn-'));
  writeFileSync(path.join(warnings, 'slide-links~default.txt'), "There aren't any warnings for this presentation.\n");
  assert.equal(await main(['--out', out, '--opf', '0.37.0', '--warnings-dir', warnings, files[0]], { exec: fakeExec({ lines: LINES }), ...quiet() }), 0);
  const result = JSON.parse(readFileSync(path.join(out, 'files/slide-links~default/result.json'), 'utf8'));
  assert.deepEqual(result.verbs.open.warnings, { status: 'read', source: 'screen', lines: [] });
});

test('bad arguments and an output folder inside the repository: exit 2 before any event', async () => {
  const { files } = inputs();
  const exec = fakeExec();
  assert.equal(await main(['--opf', '0.37.0', ...files], { exec, ...quiet() }), 2);
  assert.equal(await main(['--out', path.join(here, 'run-out'), '--opf', '0.37.0', ...files], { exec, ...quiet() }), 2);
  assert.equal(exec.calls.length, 0);
});

test('names: <deck>/<variant>.pptx, <deck>~<variant>.pptx, <deck>.pptx; a repeated id is refused', () => {
  assert.deepEqual(deckAndVariant('/w/build/0.37.0/main/slide-links/default.pptx'), { deck: 'slide-links', variant: 'default' });
  assert.deepEqual(deckAndVariant('/w/build/layouts-lots/native.pptx'), { deck: 'layouts-lots', variant: 'native' });
  assert.deepEqual(deckAndVariant('/w/m-charts~Static.pptx'), { deck: 'm-charts', variant: 'static' });
  assert.deepEqual(deckAndVariant('/w/qualification/Image Callouts.pptx'), { deck: 'image-callouts', variant: 'default' });
  const { root, files } = inputs();
  assert.deepEqual(
    planInputs(files, root).map((input) => [input.id, input.relativePath]),
    [
      ['slide-links~default', 'slide-links/default.pptx'],
      ['slide-links~static', 'slide-links/static.pptx'],
    ],
  );
  assert.throws(() => planInputs([files[0], files[0]], root), /both become slide-links~default/u);
  assert.throws(() => planInputs([path.join(root, 'missing.pptx')], root), /no such file/u);
});
