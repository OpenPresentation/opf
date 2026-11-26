// NT-01: the schemas, the vocabulary constants and the fixtures agree, and the validator rejects what it must.
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import {
  EDIT_ID,
  editPath,
  emptyResult,
  fileId,
  OBJECT_KINDS,
  OUTCOMES,
  parseFileId,
  resultSchema,
  runFileEntry,
  runSchema,
  TARGETS,
  VERB_STATUSES,
  VERBS,
  validateResult,
  validateRun,
} from './result.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const fixtures = path.join(here, 'fixtures');
const readJson = (file) => JSON.parse(readFileSync(file, 'utf8'));

function walk(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => (entry.isDirectory() ? walk(path.join(directory, entry.name)) : [path.join(directory, entry.name)]));
}
const fixtureFiles = walk(fixtures);
const resultFiles = fixtureFiles.filter((file) => path.basename(file) === 'result.json');
const sample = () => structuredClone(readJson(resultFiles.find((file) => file.includes('slide-links~default'))));

test('the constants are the schemas’ enums', () => {
  const defs = resultSchema.$defs;
  assert.deepEqual(defs.target.enum, [...TARGETS]);
  assert.deepEqual(runSchema.properties.target.enum, [...TARGETS]);
  assert.deepEqual(defs.kind.enum, [...OBJECT_KINDS]);
  assert.deepEqual(defs.object.properties.kind, { $ref: '#/$defs/kind' });
  assert.equal(OBJECT_KINDS.length, 15);
  assert.deepEqual(OBJECT_KINDS.slice(13), ['diagram', 'media']);
  assert.equal(defs.edit.properties.id.pattern, EDIT_ID.source);
  assert.deepEqual(defs.outcome.enum, [...OUTCOMES]);
  assert.deepEqual(defs.verbStatus.enum, [...VERB_STATUSES]);
  assert.deepEqual(runSchema.properties.files.items.properties.open.enum, [...VERB_STATUSES]);
  assert.deepEqual(resultSchema.properties.verbs.required, [...VERBS]);
  // The verbs, and the optional edit cases beside resave.
  assert.deepEqual(Object.keys(resultSchema.properties.verbs.properties), [...VERBS, 'edits']);
  for (const shared of ['application', 'system', 'fonts', 'opf']) assert.deepEqual(runSchema.properties[shared], defs[shared], `${shared} is the same in both schemas`);
});

test('every property of both schemas has a description', () => {
  const missing = [];
  const visit = (node, where) => {
    if (!node || typeof node !== 'object') return;
    for (const [name, child] of Object.entries(node.properties ?? {})) {
      if (!child.description && !child.$ref) missing.push(`${where}.${name}`);
      visit(child, `${where}.${name}`);
    }
    for (const [name, child] of Object.entries(node.$defs ?? {})) visit(child, `${where}.$defs.${name}`);
    if (node.items) visit(node.items, `${where}[]`);
  };
  visit(resultSchema, 'result');
  visit(runSchema, 'run');
  assert.deepEqual(missing, []);
});

test('there are three fixture results and a run, and each validates', () => {
  assert.equal(resultFiles.length, 3);
  for (const file of resultFiles) assert.deepEqual(validateResult(readJson(file)), { ok: true, errors: [] }, file);
  const run = readJson(path.join(fixtures, 'keynote-0.36.0/run.json'));
  assert.deepEqual(validateRun(run), { ok: true, errors: [] });
  const entries = new Map(resultFiles.map((file) => runFileEntry(readJson(file))).map((entry) => [entry.id, entry]));
  assert.deepEqual(
    run.files,
    run.files.map((entry) => entries.get(entry.id)),
  );
});

test('no fixture names a home folder', () => {
  for (const file of fixtureFiles) assert.doesNotMatch(readFileSync(file, 'utf8'), /\/Users\/|[A-Za-z]:\\Users\\|\/home\//u, file);
});

test('rejected: an unknown kind, a missing verb, an absolute path, an extra top-level key', () => {
  const unknownKind = sample();
  unknownKind.slides[0].objects[0].kind = 'placeholder';
  assert.equal(validateResult(unknownKind).ok, false);
  assert.match(validateResult(unknownKind).errors.join('\n'), /\/slides\/0\/objects\/0\/kind: must be one of "title"/u);

  const missingVerb = sample();
  delete missingVerb.verbs.resave;
  assert.deepEqual(validateResult(missingVerb).errors, ["/verbs: must have required property 'resave'"]);

  const absolute = sample();
  absolute.file.path = '/Users/someone/deck.pptx';
  assert.match(validateResult(absolute).errors.join('\n'), /^\/file\/path: must match pattern/mu);
  const windows = sample();
  windows.slides[0].picture = 'C:\\work\\slide-001.png';
  assert.equal(validateResult(windows).ok, false);
  const upward = sample();
  upward.verbs.resave.path = '../resaved.pptx';
  assert.equal(validateResult(upward).ok, false);

  const extra = sample();
  extra.comment = 'no';
  assert.deepEqual(validateResult(extra).errors, ["/: must NOT have additional property 'comment'"]);
});

test('rejected: what the schema alone cannot say', () => {
  const wrongId = sample();
  wrongId.file.id = 'slide-links~native';
  assert.match(validateResult(wrongId).errors[0], /^\/file\/id: must be "slide-links~default"/u);
  const reordered = sample();
  reordered.slides.reverse();
  assert.match(validateResult(reordered).errors[0], /^\/slides\/0\/index: must be 1/u);
  const rowsOnText = sample();
  rowsOnText.slides[0].objects[1].rows = 2;
  assert.equal(validateResult(rowsOnText).ok, false);
  const free = sample();
  free.slides[0].objects[0].details = { anything: [1, { goes: true }] };
  assert.deepEqual(validateResult(free), { ok: true, errors: [] });
});

// ---- NT-01b: the additions the Windows driver asked for (opf#1468)

const edit = (id, extra = {}) => ({ id, what: 'retyped the text of table cell B2 on slide 2', path: `edits/${id}.pptx`, status: 'done', ...extra });

test('NT-01b accepted: diagram and media kinds, alt, details on the result and a slide, edit cases', () => {
  const result = sample();
  result.details = { fonts: ['Aptos', 'Aptos Display'], slideSize: [960, 540] };
  result.slides[0].details = { placeholders: [{ type: 'title', name: 'Title 1' }] };
  result.slides[1].objects.push(
    { kind: 'diagram', outcome: 'native', appClass: 'msoSmartArt', box: [40, 260, 400, 200], alt: 'Pyramid of 3 levels', details: { layout: 'Basic Pyramid', nodes: 3 } },
    { kind: 'media', outcome: null, appClass: 'msoMedia', box: [500, 260, 320, 180] },
  );
  result.slides[0].objects[0].alt = 'Agenda';
  result.verbs.edits = [
    edit('retype-cell'),
    edit('add-row', {
      seconds: 1.2,
      import: { status: 'imported', slideCount: 4 },
      outcomes: { counts: { 'table.changed': 1, 'title.native': 3 }, objects: [{ slide: 2, kind: 'table', name: 'OPF table 1', outcome: 'changed', how: 'rows x columns 3x2 -> 4x2' }] },
    }),
    edit('move-shape', { status: 'timeout', message: 'PowerPoint did not answer in 60 s' }),
  ];
  assert.deepEqual(validateResult(result), { ok: true, errors: [] });
  // An empty list is allowed: the driver ran no edit case.
  assert.deepEqual(validateResult({ ...result, verbs: { ...result.verbs, edits: [] } }), { ok: true, errors: [] });
});

test('NT-01b rejected: a bad edit case, a free-form field where there is none, an unknown outcome in an edit', () => {
  const withEdits = (edits) => {
    const result = sample();
    result.verbs.edits = edits;
    return validateResult(result);
  };
  assert.match(withEdits([edit('Retype Cell')]).errors.join('\n'), /\/verbs\/edits\/0\/id: must match pattern/u);
  assert.match(withEdits([{ ...edit('retype-cell'), path: 'retype-cell.pptx' }]).errors.join('\n'), /\/verbs\/edits\/0\/path: must be "edits\/retype-cell\.pptx"/u);
  assert.match(withEdits([edit('retype-cell'), edit('retype-cell')]).errors.join('\n'), /\/verbs\/edits\/1\/id: "retype-cell" is listed twice/u);
  assert.match(withEdits([{ ...edit('retype-cell'), what: '' }]).errors.join('\n'), /\/verbs\/edits\/0\/what/u);
  assert.match(withEdits([{ ...edit('retype-cell'), status: 'partial' }]).errors.join('\n'), /\/verbs\/edits\/0\/status: must be one of/u);
  assert.match(withEdits([{ ...edit('retype-cell'), outcomes: { counts: {}, objects: [{ slide: 1, kind: 'table', outcome: 'native' }] } }]).errors.join('\n'), /outcome: must be one of "changed"/u);
  assert.match(withEdits([{ ...edit('retype-cell'), note: 'x' }]).errors.join('\n'), /must NOT have additional property 'note'/u);
  const altNotText = sample();
  altNotText.slides[0].objects[0].alt = 3;
  assert.equal(validateResult(altNotText).ok, false);
  const verbDetails = sample();
  verbDetails.verbs.open.details = {};
  assert.deepEqual(validateResult(verbDetails).errors, ["/verbs/open: must NOT have additional property 'details'"]);
  const slideDetailsNotObject = sample();
  slideDetailsNotObject.slides[0].details = 'x';
  assert.equal(validateResult(slideDetailsNotObject).ok, false);
  assert.equal(editPath('retype-cell'), 'edits/retype-cell.pptx');
  assert.throws(() => editPath('../x'), /a-z 0-9/u);
});

test('NT-01b: a hidden slide may have a picture (PowerPoint exports one); a partial render keeps the other slides', () => {
  const hidden = sample();
  const last = hidden.slides.at(-1);
  assert.equal(last.hidden, true);
  last.picture = `slides/slide-00${last.index}.png`;
  last.compare = { preview: null, score: null, note: 'hidden slide: OPF previews visible slides only' };
  assert.deepEqual(validateResult(hidden), { ok: true, errors: [] });

  const partial = sample();
  partial.verbs.render = { status: 'failed', seconds: 2.1, message: 'Slide.Export failed for slides 2, 3: the slide could not be drawn' };
  partial.slides[1].picture = null;
  partial.slides[2].picture = null;
  assert.deepEqual(validateResult(partial), { ok: true, errors: [] });
  assert.equal(partial.slides[0].picture, 'slides/slide-001.png', 'the other slides keep their pictures');
});

test('emptyResult has every verb, all not-run, and validates', () => {
  const result = emptyResult({
    target: 'powerpoint',
    application: { name: 'PowerPoint', version: '16.0' },
    system: { os: 'Windows', version: '11' },
    opf: { version: '0.37.0' },
    file: { deck: 'Coverage-Charts', path: 'pptx/coverage-charts.pptx', sha256: '0'.repeat(64) },
    started: '2026-11-25T10:00:00Z',
  });
  assert.deepEqual(Object.keys(result.verbs), [...VERBS]);
  assert.ok(Object.values(result.verbs).every((verb) => verb.status === 'not-run'));
  assert.equal(result.file.id, 'coverage-charts~default');
  assert.deepEqual(validateResult({ ...result, file: { ...result.file, deck: 'coverage-charts' } }), { ok: true, errors: [] });
  assert.deepEqual(runFileEntry(result), { id: 'coverage-charts~default', deck: 'Coverage-Charts', variant: 'default', result: 'files/coverage-charts~default/result.json', open: 'not-run', slideCount: null });
});

test('fileId', () => {
  assert.equal(fileId('slide-links'), 'slide-links~default');
  assert.equal(fileId('Layouts-Lots', 'native'), 'layouts-lots~native');
  assert.throws(() => fileId('a~b', 'default'), /a-z 0-9/u);
  assert.throws(() => fileId('a b'), /a-z 0-9/u);
  assert.deepEqual(parseFileId('slide-links~default'), { deck: 'slide-links', variant: 'default' });
  assert.throws(() => parseFileId('slide-links'), /not <deck>~<variant>/u);
});

test('run.json: rejects a result path that is not files/<id>/result.json and a file listed twice', () => {
  const run = readJson(path.join(fixtures, 'keynote-0.36.0/run.json'));
  const moved = structuredClone(run);
  moved.files[0].result = `files/${moved.files[1].id}/result.json`;
  assert.equal(validateRun(moved).ok, false);
  const twice = structuredClone(run);
  twice.files.push(twice.files[0]);
  assert.match(validateRun(twice).errors.join('\n'), /listed twice/u);
  const extra = structuredClone(run);
  extra.check.note = 'x';
  assert.deepEqual(validateRun(extra).errors, ["/check: must NOT have additional property 'note'"]);
});
