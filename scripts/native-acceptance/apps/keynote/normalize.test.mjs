// NT-01: the 0.36.0 Keynote round's recorded files normalize to the committed result.json of each fixture.
// UPDATE_FIXTURES=1 node --test scripts/native-acceptance/apps/keynote/normalize.test.mjs rewrites the expected files.
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { validateResult } from '../../core/result/result.mjs';
import { normalize, objectFromItem, parseWarnings, slidesFrom, verbsFromRun } from './normalize.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const fixtures = path.join(here, '../../core/result/fixtures/keynote-0.36.0');
const system = { os: 'macOS', version: '26.6.2' };
// What the recorded files do not say: the OPF that exported each file (slide-links came from main at 04f265afc).
const FIXTURES = {
  'slide-links~default': { opf: { version: '0.36.0', commit: '04f265afc' } },
  'singleton-combo-reference-lines~default': { opf: { version: '0.36.0' } },
  'image-callouts~default': { opf: { version: '0.36.0' } },
};

const readJson = (file) => JSON.parse(readFileSync(file, 'utf8'));
const raw = (id) => ({ run: readJson(path.join(fixtures, id, 'raw/run.json')), probe: readJson(path.join(fixtures, id, 'raw/probe.json')) });
const normalized = (id) => normalize(raw(id), { ...FIXTURES[id], system });

for (const id of Object.keys(FIXTURES)) {
  test(`${id}: the recorded files normalize to result.json`, () => {
    const actual = normalized(id);
    const expectedFile = path.join(fixtures, id, 'result.json');
    if (process.env.UPDATE_FIXTURES === '1') writeFileSync(expectedFile, `${JSON.stringify(actual, null, 2)}\n`);
    assert.deepEqual(actual, readJson(expectedFile));
    assert.deepEqual(validateResult(actual), { ok: true, errors: [] });
  });
}

test('slide-links: the hidden slide is slide 4, by position, with no picture', () => {
  const { run, probe } = raw('slide-links~default');
  assert.deepEqual(probe.skippedSlides, [-1], 'the recorded defect this test guards against');
  const result = normalized('slide-links~default');
  assert.equal(result.slides.length, 4);
  assert.deepEqual(
    result.slides.map((slide) => [slide.index, slide.hidden, slide.picture]),
    [
      [1, false, 'slides/slide-001.png'],
      [2, false, 'slides/slide-002.png'],
      [3, false, 'slides/slide-003.png'],
      [4, true, null],
    ],
  );
  assert.equal(result.verbs.open.slideCount, run.slideCount);
  assert.deepEqual(result.application, { name: 'Keynote', version: '16.0' });
});

test('slide-links: title, table, and a group with nested members', () => {
  const [first, second] = normalized('slide-links~default').slides;
  assert.deepEqual(
    first.objects.map((object) => object.kind),
    ['title', 'text', 'group'],
  );
  assert.deepEqual(
    first.objects[2].objects.map((object) => [object.kind, object.appClass]),
    [
      ['shape', 'shape'],
      ['text', 'text item'],
    ],
  );
  const table = second.objects[1];
  assert.deepEqual([table.kind, table.rows, table.columns, table.box], ['table', 3, 2, [43, 225, 874, 156]]);
  assert.deepEqual(table.fonts, ['Helvetica-Bold', 'Helvetica']);
  assert.equal(first.layout, 'Title Only');
  assert.equal(normalized('slide-links~default').slides[2].layout, 'Title Only 0');
  // Keynote reports a group's members in slide coordinates, as the format wants: the boxes are kept as they are.
  assert.deepEqual(first.objects[2].box, [223, 154, 514, 343]);
  assert.deepEqual(
    first.objects[2].objects.map((object) => object.box),
    [
      [223, 154, 514, 343],
      [244, 303, 472, 46],
    ],
  );
});

test('the two qualification files: the Warnings window text parses to the application’s lines', () => {
  const layouts = ['Cover', 'Gallery', 'Hero', 'Image', 'Image beside'];
  assert.deepEqual(normalized('singleton-combo-reference-lines~default').verbs.open.warnings, {
    status: 'read',
    source: 'screen',
    lines: [{ text: 'Unsupported media were removed.', layouts }, { text: 'The font Roboto is missing. Your text might look different.' }],
  });
  assert.deepEqual(normalized('image-callouts~default').verbs.open.warnings, {
    status: 'read',
    source: 'screen',
    lines: [{ text: 'Unsupported media were removed.', layouts }, { text: 'The font Roboto is missing. Your text might look different.' }, { text: 'SVG images were converted to PNG.' }],
  });
  assert.deepEqual(normalized('slide-links~default').verbs.open.warnings, { status: 'not-read', source: null, lines: [] });
});

test('chart, lines and a picture map to the shared kinds', () => {
  const [chartSlide] = normalized('singleton-combo-reference-lines~default').slides;
  assert.deepEqual(
    chartSlide.objects.map((object) => object.kind),
    ['title', 'chart', 'connector', 'text', 'connector', 'text'],
  );
  const [pictureSlide] = normalized('image-callouts~default').slides;
  const picture = pictureSlide.objects.find((object) => object.kind === 'picture');
  assert.deepEqual([picture.appClass, picture.name, picture.box], ['image', 'OPF image 1', [94, 111, 772, 386]]);
  assert.equal(objectFromItem({ class: 'image', description: 'Harbor\n\nOPF image 2', position: [0, 0], width: 1, height: 1 }).name, 'OPF image 2');
});

test('NT-01b: a movie and an audio clip are media; an image description before the name is alt, the name alone is none', () => {
  const box = { position: [10, 20], width: 300, height: 200 };
  assert.deepEqual(objectFromItem({ class: 'movie', ...box }), { kind: 'media', outcome: null, appClass: 'movie', box: [10, 20, 300, 200] });
  assert.equal(objectFromItem({ class: 'audio clip', ...box }).kind, 'media');
  const titled = objectFromItem({ class: 'image', description: 'Harbor\n\nOPF image 2', ...box });
  assert.deepEqual([titled.name, titled.alt], ['OPF image 2', 'Harbor']);
  // A title of several paragraphs keeps its blank lines; only the last part is the name.
  assert.equal(objectFromItem({ class: 'image', description: 'Pyramid:\nGoal\n\nTwo\n\nOPF smartart slides.1.blocks.0.items', ...box }).alt, 'Pyramid:\nGoal\n\nTwo');
  const named = objectFromItem({ class: 'image', description: 'OPF image 1', ...box });
  assert.deepEqual([named.name, named.alt], ['OPF image 1', undefined]);
  assert.equal(objectFromItem({ class: 'image', description: '', ...box }).alt, undefined);
});

test('parseWarnings: placeholder, none, a slide list and a list cut at the window’s edge', () => {
  assert.deepEqual(parseWarnings([]), { status: 'not-read', source: null, lines: [] });
  assert.deepEqual(parseWarnings([{ ocr: 'Warnings\nTo view warnings, click or open a presentation.\n' }]), { status: 'not-read', source: 'screen', lines: [] });
  assert.deepEqual(parseWarnings([{ ocr: 'Warnings - a\nThere aren’t any warnings for this presentation.\n' }]), { status: 'read', source: 'screen', lines: [] });
  assert.deepEqual(parseWarnings([{ ocr: "Warnings - a\nHere's a list of what changed when you opened it in Keynote.\nStacked Line charts aren't supported and were converted to regular Line chart type.\nSlide(s) 4, 6-7\n" }]), {
    status: 'read',
    source: 'screen',
    lines: [{ text: "Stacked Line charts aren't supported and were converted to regular Line chart type.", slides: [4, 6, 7] }],
  });
  assert.equal(parseWarnings([{ ocr: 'Warnings - a\nThe font Aptos is missing. Your text might look different.\nTh…\n' }]).status, 'partial');
});

test('verbsFromRun: errors go to the verb that names them; a timeout and an alert are their own statuses', () => {
  const base = { documentId: 'X', slideCount: 2, phases: { open: 1, probe: 2, slides: 1, pptxBack: 1, close: 0.2 } };
  const failed = verbsFromRun({ ...base, status: 'ERROR', message: 'probe failed: -1712 timeout; export as PowerPoint failed: -50' });
  assert.deepEqual(
    [failed.open.status, failed.probe.status, failed.render.status, failed.resave.status],
    ['done', 'failed', 'done', 'failed'],
  );
  assert.equal(failed.probe.message, 'probe failed: -1712 timeout');
  const timeout = verbsFromRun({ status: 'TIMEOUT', slideCount: -1, phases: { open: 140 }, message: 'open did not return in 120s' });
  assert.deepEqual([timeout.open.status, timeout.render.status, timeout.open.slideCount], ['timeout', 'not-run', undefined]);
  const alert = verbsFromRun({ ...base, phases: { open: 1 }, status: 'ALERT', message: 'an unexpected Keynote window appeared after open; document X left open' });
  assert.deepEqual([alert.open.status, alert.probe.status], ['alert', 'not-run']);
  const gaps = verbsFromRun({ ...base, status: 'OPENED', message: 'probe: 3 property errors' });
  assert.deepEqual([gaps.probe.status, gaps.probe.message], ['done', 'probe: 3 property errors']);
});

test('slidesFrom: presenter notes become slide.notes and one notes object; without a probe, hidden comes from run.json', () => {
  const run = { slideCount: 2, skippedSlides: [2], pictures: { 'slide-01.png': { keynoteFile: '_export.001.png', slide: 1 } } };
  const probe = { slides: [{ skipped: false, layout: 'Title Only', 'presenter notes': 'Say hello.', items: [] }, { skipped: true, layout: 'Blank', 'presenter notes': '', items: [] }] };
  const [first, second] = slidesFrom(run, probe);
  assert.deepEqual(first, { index: 1, hidden: false, layout: 'Title Only', picture: 'slides/slide-001.png', notes: 'Say hello.', objects: [{ kind: 'notes', outcome: null, text: 'Say hello.' }] });
  assert.equal(second.notes, null);
  assert.deepEqual(
    slidesFrom(run, null).map((slide) => [slide.index, slide.hidden, slide.layout, slide.picture]),
    [
      [1, false, null, 'slides/slide-001.png'],
      [2, true, null, null],
    ],
  );
});

test('normalize refuses an input path outside the input root', () => {
  const { run, probe } = raw('image-callouts~default');
  assert.throws(() => normalize({ run: { ...run, input: '/Volumes/work/x.pptx' }, probe }, { opf: { version: '0.36.0' }, system }), /not under the input root/u);
  const relative = normalize({ run: { ...run, input: '/Volumes/work/build/x.pptx' }, probe }, { opf: { version: '0.36.0' }, system, inputRoot: '/Volumes/work' });
  assert.equal(relative.file.path, 'build/x.pptx');
});
