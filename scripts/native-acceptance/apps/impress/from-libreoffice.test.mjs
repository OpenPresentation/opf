// NT-06: the LibreOffice runner's facts for one case and profile become a valid result.json of the shared format. The
// fixture is cut from a real nightly artifact (fixtures/nightly-2026-11-25.json says from which run and how).
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { picturePath, validateResult, validateRun } from '../../core/result/result.mjs';
import { applicationFrom, assertValid, fileIdentity, impressResult, impressRun, opfFrom, systemFrom } from './from-libreoffice.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const nightly = JSON.parse(readFileSync(path.join(here, 'fixtures/nightly-2026-11-25.json'), 'utf8'));
const system = systemFrom({ platform: 'linux', release: nightly.environment.os });
const when = { started: '2026-11-25T11:40:00Z', finished: '2026-11-25T11:41:00Z' };
const byId = (id) => nightly.cases.find((entry) => entry.id === id);

/** What run.mjs passes for a fixture case: a picture written for every visible slide, the copy saved. */
function resultOf(entry, overrides = {}) {
  const visible = entry.hidden.map((hidden, position) => (hidden ? null : position + 1)).filter(Boolean);
  // A qualification case (run.mjs: entry.qualification) names its manifest deck and variant.
  const [qualified, variant = 'default'] = entry.id.startsWith('q-') ? entry.id.slice(2).split('~') : [];
  return impressResult({
    caseId: entry.id,
    ...(qualified ? { deck: qualified, variant } : {}),
    profile: 'opf',
    environment: nightly.environment,
    system,
    input: { path: `${entry.id}.pptx`, sha256: entry.pptxSha256, unchangedAfterRun: true },
    hidden: entry.hidden,
    measured: entry.result,
    facts: { converted: entry.result.converted, resaved: entry.result.roundTrip?.converted === true, slideCount: entry.copySlideCount, pictures: visible.map(picturePath), pixelSize: [1280, 720] },
    ...when,
    ...overrides,
  });
}

test('the application, system and OPF come from what the runner records', () => {
  assert.deepEqual(applicationFrom(nightly.environment.libreoffice), { name: 'LibreOffice Impress', version: '26.8.2.2', build: '9dea406ab7695df6325b11b0e19fdca8db4b7276' });
  assert.deepEqual(applicationFrom('LibreOffice 26.8.2.2 notahash'), { name: 'LibreOffice Impress', version: '26.8.2.2' });
  assert.deepEqual(applicationFrom('not found'), { name: 'LibreOffice Impress', version: 'not found' }, 'a broken installation shows, no version is made up');
  assert.deepEqual(system, { os: 'Linux', version: 'Ubuntu 24.04.5 LTS' });
  assert.throws(() => systemFrom({ platform: 'aix', release: '7' }), /not one of/);
  assert.deepEqual(opfFrom(nightly.environment), { version: '0.36.0', commit: '293d956a9933a75859970ff8e633d18ea1652d49' });
});

test('file ids: <deck>~<variant>.<profile>, with the manifest deck and variant when there are some', () => {
  assert.deepEqual(fileIdentity('tables', 'opf'), { deck: 'tables', variant: 'default.opf', id: 'tables~default.opf' });
  assert.deepEqual(fileIdentity('q-smartart~shapes', 'stock', { deck: 'smartart', variant: 'shapes' }), { deck: 'smartart', variant: 'shapes.stock', id: 'smartart~shapes.stock' });
  assert.deepEqual(fileIdentity('q-smartart', 'opf', { deck: 'smartart', variant: 'default' }), { deck: 'smartart', variant: 'default.opf', id: 'smartart~default.opf' });
  assert.deepEqual(fileIdentity('issue-925-rebuilt', 'opf'), { deck: 'issue-925-rebuilt', variant: 'default.opf', id: 'issue-925-rebuilt~default.opf' });
  // Deck, variant and profile stay apart: no two of them give one id.
  const ids = ['opf', 'stock'].flatMap((profile) => ['default', 'shapes'].map((variant) => fileIdentity('q-smartart', profile, { deck: 'smartart', variant }).id));
  assert.equal(new Set(ids).size, 4);
  assert.throws(() => fileIdentity('x', 'opf', { deck: 'x', variant: 'a.b' }), /must not contain/);
});

test('a clean case: open, render and resave done, probe not-run, warnings not read', () => {
  const result = resultOf(byId('tables'));
  assert.deepEqual(validateResult(result), { ok: true, errors: [] });
  assert.equal(result.target, 'impress');
  assert.equal(result.fonts, 'opf');
  assert.deepEqual(result.file, { id: 'tables~default.opf', deck: 'tables', variant: 'default.opf', path: 'tables.pptx', sha256: byId('tables').pptxSha256, unchangedAfterRun: true });
  assert.deepEqual(result.verbs, {
    open: { status: 'done', slideCount: 3, warnings: { status: 'not-read', source: null, lines: [] } },
    render: { status: 'done', pixelSize: [1280, 720] },
    probe: { status: 'not-run' },
    resave: { status: 'done', path: 'resaved.pptx', import: { status: 'imported', slideCount: 3 } },
  });
  assert.deepEqual(
    result.slides.map((slide) => [slide.index, slide.hidden, slide.picture, slide.objects.length]),
    [
      [1, false, 'slides/slide-001.png', 0],
      [2, false, 'slides/slide-002.png', 0],
      [3, false, 'slides/slide-003.png', 0],
    ],
  );
});

test('a case with defects and a hidden slide: the defects stay in results.json, the hidden slide has no picture', () => {
  const entry = byId('q-coverage-composition');
  assert.equal(entry.result.status, 'fail', 'the fixture case has defects');
  const result = resultOf(entry);
  assert.deepEqual(validateResult(result), { ok: true, errors: [] });
  assert.equal(result.file.id, 'coverage-composition~default.opf');
  assert.deepEqual([result.verbs.open.status, result.verbs.render.status, result.verbs.probe.status, result.verbs.resave.status], ['done', 'done', 'not-run', 'done']);
  assert.equal(result.verbs.open.slideCount, 11);
  assert.equal(result.slides.length, 11);
  assert.deepEqual(result.slides[10], { index: 11, hidden: true, layout: null, picture: null, notes: null, objects: [] });
  assert.equal(result.slides[9].picture, 'slides/slide-010.png');
  assert.ok(!JSON.stringify(result).includes('text-box'), 'no defect is copied into the result');
});

test("OPF's failed import of LibreOffice's copy is resave.import failed", () => {
  const result = resultOf(byId('q-singleton-combo-reference-lines'));
  assert.deepEqual(validateResult(result), { ok: true, errors: [] });
  assert.equal(result.verbs.resave.status, 'done');
  assert.deepEqual(result.verbs.resave.import, { status: 'failed', error: 'Imported PPTX did not produce valid OPF.' });
});

test('a failed conversion is open failed with the message, and nothing else ran', () => {
  // The 2026-11-25 corpus has no failed conversion; this is the shape run.mjs records for one (checks.mjs verdict "open").
  const entry = structuredClone(byId('tables'));
  entry.result = { id: 'tables', profile: 'opf', slides: 3, converted: false, conversionError: 'soffice status 1: Error: source file could not be loaded', status: 'fail', defects: [{ check: 'open', detail: 'soffice status 1: Error: source file could not be loaded' }], differences: [] };
  const result = resultOf(entry, { facts: { converted: false } });
  assert.deepEqual(validateResult(result), { ok: true, errors: [] });
  assert.deepEqual(result.verbs.open, { status: 'failed', message: 'soffice status 1: Error: source file could not be loaded', warnings: { status: 'not-read', source: null, lines: [] } });
  assert.deepEqual([result.verbs.render.status, result.verbs.probe.status, result.verbs.resave.status], ['not-run', 'not-run', 'not-run']);
  assert.deepEqual(result.slides, []);
});

test("a fault of the runner while measuring is render failed; a copy LibreOffice could not write is resave failed", () => {
  const entry = structuredClone(byId('tables'));
  entry.result = { id: 'tables', profile: 'opf', status: 'fail', defects: [{ check: 'runner', detail: 'TypeError: page is undefined' }], differences: [] };
  const fault = resultOf(entry, { facts: { converted: true, resaved: false, pictures: ['slides/slide-001.png', null, null] } });
  assert.deepEqual(validateResult(fault), { ok: true, errors: [] });
  assert.equal(fault.verbs.render.status, 'failed');
  assert.match(fault.verbs.render.message, /runner could not measure .*TypeError/);
  assert.deepEqual(fault.slides.map((slide) => slide.picture), ['slides/slide-001.png', null, null]);
  assert.equal(fault.verbs.resave.status, 'not-run', 'the round trip was never measured');

  const noCopy = structuredClone(byId('tables'));
  noCopy.result.roundTrip = { converted: false };
  const failed = resultOf(noCopy, { facts: { converted: true, resaved: false, pictures: ['slides/slide-001.png', 'slides/slide-002.png', 'slides/slide-003.png'] } });
  assert.deepEqual(failed.verbs.resave, { status: 'failed', message: 'LibreOffice could not re-export the file as PPTX' });
});

test('without pictures render is not-run and no slides are listed; a copy with another slide count is a message', () => {
  const entry = byId('tables');
  const result = resultOf(entry, { facts: { converted: true, resaved: true, slideCount: 4 } });
  assert.deepEqual(validateResult(result), { ok: true, errors: [] });
  assert.equal(result.verbs.render.status, 'not-run');
  assert.deepEqual(result.slides, []);
  assert.equal(result.verbs.open.slideCount, undefined);
  assert.equal(result.verbs.open.message, "LibreOffice's PowerPoint copy has 4 slides, the file 3");
});

test('run.json lists every case and profile and validates; an invalid result throws', () => {
  const results = nightly.cases.flatMap((entry) => ['opf', 'stock'].map((profile) => resultOf(entry, { profile })));
  const run = impressRun({ environment: nightly.environment, system, profiles: ['opf', 'stock'], ...when, results });
  assert.deepEqual(validateRun(run), { ok: true, errors: [] });
  assert.equal(run.fonts, 'opf,stock');
  assert.deepEqual(run.check, { status: 'ready', reasons: [] });
  assert.deepEqual(
    run.files.map((file) => [file.id, file.open, file.slideCount]),
    [
      ['tables~default.opf', 'done', 3],
      ['tables~default.stock', 'done', 3],
      ['coverage-composition~default.opf', 'done', 11],
      ['coverage-composition~default.stock', 'done', 11],
      ['singleton-combo-reference-lines~default.opf', 'done', 1],
      ['singleton-combo-reference-lines~default.stock', 'done', 1],
    ],
  );
  const unpinned = impressRun({ environment: { ...nightly.environment, pinned: false }, system, profiles: ['opf'], ...when, results: [] });
  assert.deepEqual(unpinned.check.reasons, ['LibreOffice is not the pinned 26.8.2.2']);
  const broken = { ...results[0], file: { ...results[0].file, path: '/tmp/tables.pptx' } };
  assert.throws(() => assertValid('result', broken, 'files/tables~default.opf/result.json'), /files\/tables~default\.opf\/result\.json does not validate:\n {2}\/file\/path/);
});
