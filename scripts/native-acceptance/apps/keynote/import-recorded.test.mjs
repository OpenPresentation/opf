// NT-04a: the recorded-round importer on the three committed raw fixtures, laid out as the round recorded them (one folder
// per file with run.json and probe.json). The fixtures carry no pictures and no back.pptx, so every picture is null and the
// verbs say what was missing; everything else equals the fixture's expected result.json.
import assert from 'node:assert/strict';
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { after, test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { sharp } from '../../core/compare/picture.mjs';
import { validateResult, validateRun } from '../../core/result/result.mjs';
import { importRecorded, parseArgs, recordedFolders } from './import-recorded.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const fixtures = path.join(here, '../../core/result/fixtures/keynote-0.36.0');
const scratch = mkdtempSync(path.join(tmpdir(), 'nt-04a-import-'));
after(() => rmSync(scratch, { recursive: true, force: true }));

const readJson = (file) => JSON.parse(readFileSync(file, 'utf8'));
const system = { os: 'macOS', version: '26.6.2' };

/** A recorded folder with the raw fixtures of `ids`, each under the name kn-run gave it. */
function recorded(name, ids) {
  const from = path.join(scratch, name);
  for (const id of ids) {
    const raw = path.join(fixtures, id, 'raw');
    const folder = path.join(from, readJson(path.join(raw, 'run.json')).name);
    mkdirSync(folder, { recursive: true });
    for (const file of ['run.json', 'probe.json']) copyFileSync(path.join(raw, file), path.join(folder, file));
  }
  mkdirSync(path.join(from, '_sheets'), { recursive: true });
  return from;
}

/** The expected result.json with what a folder without pictures and back.pptx changes. */
function withoutFiles(expected) {
  const result = structuredClone(expected);
  const missing = result.slides.filter((slide) => slide.picture !== null).map((slide) => `slide-${String(slide.index).padStart(2, '0')}.png`);
  for (const slide of result.slides) slide.picture = null;
  if (missing.length > 0) result.verbs.render.message = `not in the recorded folder: ${missing.join(', ')}`;
  delete result.verbs.resave.path;
  result.verbs.resave.message = 'back.pptx was not in the recorded folder';
  return result;
}

test('the two qualification fixtures import into a run directory', async () => {
  const ids = ['image-callouts~default', 'singleton-combo-reference-lines~default'];
  const from = recorded('qualification', ids);
  assert.deepEqual(
    recordedFolders(from).map((folder) => folder.name),
    ['image-callouts', 'singleton-combo-reference-lines'],
    'in the order the round ran them; folders starting with _ are not files',
  );
  const out = path.join(scratch, 'run-qualification');
  const { run, results } = await importRecorded(from, out, { opf: { version: '0.36.0' }, system });
  assert.deepEqual(validateRun(run), { ok: true, errors: [] });
  assert.deepEqual(readJson(path.join(out, 'run.json')), run);
  assert.deepEqual(
    run.files.map((file) => [file.id, file.open, file.slideCount]),
    [
      ['image-callouts~default', 'done', 1],
      ['singleton-combo-reference-lines~default', 'done', 1],
    ],
  );
  assert.equal(run.started, results.map((result) => result.started).sort()[0]);
  assert.equal(run.finished, results.map((result) => result.finished).sort()[1]);
  for (const id of ids) {
    const written = readJson(path.join(out, 'files', id, 'result.json'));
    assert.deepEqual(validateResult(written), { ok: true, errors: [] });
    assert.deepEqual(written, withoutFiles(readJson(path.join(fixtures, id, 'result.json'))));
  }
  await assert.rejects(importRecorded(from, out, { opf: { version: '0.36.0' }, system }), /already has a run.json/u);
});

test('slide-links: the hidden slide stays without a picture; pictures and back.pptx are copied by slide index', async () => {
  const from = recorded('main-features', ['slide-links~default']);
  const folder = path.join(from, 'slide-links~default');
  mkdirSync(path.join(folder, 'slides'), { recursive: true });
  // Keynote's pictures as kn-run named them: slide-NN.png by Keynote's slide number; slide 4 is hidden and was not exported.
  for (const n of [1, 2, 3]) {
    const png = await sharp()({ create: { width: 96, height: 54, channels: 4, background: { r: 10 * n, g: 0, b: 0, alpha: 1 } } })
      .withIccProfile('p3')
      .png()
      .toBuffer();
    writeFileSync(path.join(folder, 'slides', `slide-0${n}.png`), png);
  }
  writeFileSync(path.join(folder, 'back.pptx'), 'not a real deck');
  const out = path.join(scratch, 'run-main');
  const { results } = await importRecorded(from, out, { opf: { version: '0.36.0', commit: '04f265afc' }, system, build: '7052.0.68' });
  const [result] = results;
  const expected = readJson(path.join(fixtures, 'slide-links~default', 'result.json'));
  assert.deepEqual(result.application, { name: 'Keynote', version: '16.0', build: '7052.0.68' });
  assert.deepEqual(result.slides, expected.slides);
  assert.deepEqual(result.verbs.render, { ...expected.verbs.render, pixelSize: [96, 54], colorProfile: 'sP3C', alpha: true });
  assert.deepEqual(result.verbs.resave, expected.verbs.resave);
  for (const n of [1, 2, 3]) assert.ok(existsSync(path.join(out, 'files/slide-links~default/slides', `slide-00${n}.png`)));
  assert.equal(existsSync(path.join(out, 'files/slide-links~default/slides/slide-004.png')), false);
  assert.equal(readFileSync(path.join(out, 'files/slide-links~default/resaved.pptx'), 'utf8'), 'not a real deck');
});

test('--split none takes the whole name as the deck; the command line parses', async () => {
  const from = recorded('split', ['image-callouts~default']);
  const out = path.join(scratch, 'run-split');
  const { run } = await importRecorded(from, out, { opf: { version: '0.36.0' }, system, split: 'none', variant: 'native' });
  assert.deepEqual(
    run.files.map((file) => file.id),
    ['image-callouts~native'],
  );
  assert.deepEqual(parseArgs(['--from', 'a', '--out', 'b', '--opf', '0.36.0', '--os-version', '26.6.2', '--build', '7052.0.68', '--split', 'tilde']), {
    from: 'a',
    out: 'b',
    opf: { version: '0.36.0' },
    system: { os: 'macOS', version: '26.6.2' },
    build: '7052.0.68',
    split: 'tilde',
  });
});
