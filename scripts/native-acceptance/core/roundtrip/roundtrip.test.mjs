// NT-04b: inspect, outcomes, merge, import and the run step on small decks built in memory (test-deck.mjs).
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { emptyResult, OBJECT_KINDS, validateResult } from '../result/result.mjs';
import { errorOf, importResaved } from './import.mjs';
import { allItems, inspectPptx } from './inspect.mjs';
import { countOutcomes, mergeOutcomes, objectOutcomes } from './outcomes.mjs';
import { formatTable, roundTripRun } from './roundtrip-run.mjs';
import { alternate, chartFrame, cxnSp, diagramFrame, grpSp, makePptx, pic, sp, table } from './test-deck.mjs';

const TITLE = [44, 43, 874, 49];
const heading = (slide, text, type = 'title') => sp(2, `OPF heading slides.${slide}.title line 0`, { ph: { type }, box: TITLE, paragraphs: [text] });

// What OPF exported: every kind, a hidden slide, links to slides and the web, notes, a footer with a live field.
const exported = makePptx({
  slides: [
    {
      notes: 'Say hello',
      links: { rSlide3: 'slide:3', rWeb: 'https://acme.com', rWeb2: 'https://acme.com/about' },
      shapes: [
        heading(0, 'Agenda'),
        sp(3, 'OPF native body slides.0.body', { ph: { idx: '1' }, box: [40, 120, 400, 100], paragraphs: ['One', 'Two'] }),
        sp(4, 'OPF text slides.0.blocks.0.text line 0', { box: [500, 120, 400, 30], paragraphs: [{ text: 'Pricing', link: 'rSlide3' }, { text: 'acme', link: 'rWeb' }] }),
        sp(5, 'OPF shape slides.0.blocks.1.shape', { box: [500, 200, 120, 120], prst: 'roundRect', paragraphs: ['Go'] }),
        sp(6, 'OPF shape slides.0.blocks.2.shape', { box: [700, 200, 80, 80], prst: 'ellipse', fill: 'solid' }),
        cxnSp(7, 'OPF timeline 0 connector', [40, 300, 400, 0]),
        sp(8, 'OPF text slides.0.blocks.3.text line 1', { box: [40, 330, 400, 20], paragraphs: [''] }),
        pic(9, 'OPF image 1', { box: [40, 360, 200, 120], prst: 'roundRect' }),
        sp(10, 'OPF furniture 0 part 0 line 0', { ph: { type: 'sldNum', idx: '12' }, box: [880, 500, 40, 20], paragraphs: [{ text: '1', field: 'slidenum' }] }),
        sp(11, 'OPF furniture 0 part 1 line 0', { ph: { type: 'ftr', idx: '11' }, box: [40, 500, 300, 20], paragraphs: ['Acme'], link: 'rWeb2' }),
      ],
    },
    {
      links: { rSlide1: 'slide:1' },
      charts: { rChart1: { type: 'lineChart', grouping: 'stacked', series: [{ name: 'A', points: 4 }, { name: 'B', points: 4 }] } },
      shapes: [
        heading(1, 'Numbers', 'ctrTitle'),
        table(3, 'OPF table 1', [40, 120, 400, 100], [['Plan', 'Price'], [{ text: 'Go back', link: 'rSlide1' }, '$4']]),
        chartFrame(4, 'OPF chart 1', [500, 120, 400, 200]),
        diagramFrame(5, 'OPF smartart slides.1.blocks.0.items', [40, 260, 400, 200]),
        grpSp(6, 'OPF diagram 1', [500, 340, 200, 100], [0, 0, 400, 200], [sp(7, 'OPF diagram 1 node 0', { box: [0, 0, 200, 200], prst: 'ellipse', fill: 'solid' })]),
        alternate(sp(8, 'OPF text slides.1.blocks.9.text line 0', { box: [720, 340, 100, 30], paragraphs: ['alt'] }), sp(8, 'fallback', { box: [720, 340, 100, 30], paragraphs: ['fallback'] })),
      ],
    },
    {
      hidden: true,
      links: { rSlide1: 'slide:1' },
      shapes: [heading(2, 'Appendix'), sp(3, 'OPF native body slides.2.body', { ph: { idx: '1' }, box: [40, 120, 400, 100], paragraphs: [{ text: 'Plain', bullet: 'none' }], link: 'rSlide1' })],
    },
    { hidden: true, shapes: [heading(3, 'Gone')] },
  ],
});

// The application's copy, written the way Keynote 16.0 wrote its copies in the 0.36.0 round.
const copy = makePptx({
  slides: [
    {
      notes: 'Say hello',
      links: { rSlide3: 'slide:3', rWeb: 'https://acme.org' },
      shapes: [
        heading(0, 'Agenda'),
        sp(3, 'OPF native body slides.0.body', { ph: { idx: '1' }, box: [40, 120, 400, 100], paragraphs: ['One', 'Two'] }),
        sp(4, 'OPF text slides.0.blocks.0.text line 0', { box: [500, 120, 300, 30], paragraphs: [{ text: 'Pricing', link: 'rSlide3' }, { text: 'acme', link: 'rWeb' }] }),
        grpSp(5, 'OPF shape slides.0.blocks.1.shape', [500, 200, 120, 120], null, [
          sp(20, 'Rounded Rectangle', { box: [500, 200, 120, 120], prst: 'roundRect', fill: 'solid' }),
          sp(21, 'Go', { box: [510, 240, 100, 30], paragraphs: ['Go'] }),
        ]),
        sp(6, 'OPF shape slides.0.blocks.2.shape', { box: [700, 200, 80, 80], prst: 'ellipse', fill: 'solid' }),
        pic(9, 'Harbor OPF image 1', { box: [40, 360, 200, 120], prst: 'custGeom' }),
        sp(10, 'OPF furniture 0 part 0 line 0', { ph: { type: 'sldNum', idx: '12' }, box: [880, 500, 20, 20], paragraphs: [{ text: '1', field: 'slidenum' }] }),
        sp(11, 'OPF furniture 0 part 1 line 0', { box: [40, 500, 300, 20], paragraphs: ['Acme'] }),
      ],
    },
    {
      links: { rSlide1: 'slide:1' },
      charts: { rChart1: { type: 'lineChart', grouping: 'standard', series: [{ name: 'A', points: 4 }, { name: 'B', points: 4 }] } },
      shapes: [
        heading(1, 'Numbers', 'title'),
        table(3, 'OPF table 1', [40, 120, 400, 100], [['Plan', 'Price'], [{ text: 'Go back', link: 'rSlide1' }, '$4']]),
        chartFrame(4, 'OPF chart 1', [500, 120, 400, 200]),
        pic(5, 'OPF smartart slides.1.blocks.0.items', { box: [40, 260, 400, 200] }),
        grpSp(6, 'OPF diagram 1', [500, 340, 200, 100], [0, 0, 400, 200], [sp(7, 'OPF diagram 1 node 0', { box: [0, 0, 200, 200], prst: 'ellipse', fill: 'solid' })]),
        sp(8, 'OPF text slides.1.blocks.9.text line 0', { box: [720, 340, 100, 30], paragraphs: ['alt'] }),
      ],
    },
    {
      hidden: true,
      links: { rSlide1: 'slide:1' },
      shapes: [heading(2, 'Appendix'), sp(3, 'OPF native body slides.2.body', { ph: { idx: '1' }, box: [40, 120, 400, 100], paragraphs: [{ text: 'Plain', bullet: 'none' }], link: 'rSlide1' })],
    },
    { shapes: [heading(3, 'Gone')] },
  ],
});

const find = (records, name, kind) => records.find((entry) => entry.name === name && (!kind || entry.kind === kind));

test('inspectPptx reads slides in order, hidden slides, kinds, boxes, links and notes', () => {
  const deck = inspectPptx(exported);
  assert.deepEqual(deck.slideSize, { width: 960, height: 540 });
  assert.deepEqual(
    deck.slides.map((slide) => [slide.index, slide.hidden, slide.layout]),
    [
      [1, false, 'Title and Content'],
      [2, false, 'Title and Content'],
      [3, true, 'Title and Content'],
      [4, true, 'Title and Content'],
    ],
  );
  const [one, two, three] = deck.slides;
  assert.deepEqual(
    one.items.map((item) => [item.kind, item.label]),
    [
      ['title', 'slide title'],
      ['list', 'list items'],
      ['text', 'body text'],
      ['text', 'other text'],
      ['shape', 'shape'],
      ['connector', 'line/connector'],
      ['text', 'empty text box'],
      ['picture', 'picture'],
      ['footer', 'footer / slide number / date'],
      ['footer', 'footer / slide number / date'],
    ],
  );
  // The body's bullets come from the master's body style, not from the paragraph.
  assert.deepEqual(one.items[1].paragraphs[0].bullet, { kind: 'buChar', char: '•', type: null });
  assert.deepEqual(one.items[0].box, TITLE);
  assert.deepEqual([one.items[8].role, one.items[9].role], ['slide-number', 'footer']);
  assert.equal(one.notes, 'Say hello');
  assert.deepEqual(
    one.links.map((link) => [link.on, link.target, link.text]),
    [
      ['text', 'slide:3', 'Pricing'],
      ['text', 'https://acme.com', 'acme'],
      ['shape', 'https://acme.com/about', null],
    ],
  );
  assert.deepEqual(
    two.items.map((item) => [item.element, item.frame ?? null, item.kind, item.label]),
    [
      ['sp', null, 'title', 'slide title'],
      ['graphicFrame', 'table', 'table', 'table'],
      ['graphicFrame', 'chart', 'chart', 'chart (native)'],
      ['graphicFrame', 'diagram', 'group', 'diagram'],
      ['grpSp', null, 'group', 'diagram'],
      ['sp', null, 'text', 'body text'],
    ],
  );
  assert.equal(two.items[5].text, 'alt', 'mc:AlternateContent reads its Choice');
  assert.deepEqual([two.items[1].rows, two.items[1].columns], [2, 2]);
  assert.deepEqual(two.items[2].chart, { types: [{ type: 'lineChart', grouping: 'stacked', barDir: null }], series: [{ name: 'A', points: 4 }, { name: 'B', points: 4 }], legend: 'r' });
  // A member's box goes through its group's transform: child space 400 x 200 drawn at 200 x 100.
  assert.deepEqual(two.items[4].items[0].box, [500, 340, 100, 100]);
  assert.deepEqual(
    two.links.map((link) => [link.on, link.target]),
    [['cell', 'slide:1']],
  );
  assert.equal(three.items[1].kind, 'body', 'a body placeholder without bullets is body text');
  assert.equal(three.items[1].text, 'Plain');
  // Every kind but link and notes is an object kind here; links and notes are the slide's.
  const kinds = new Set(deck.slides.flatMap((slide) => [...allItems(slide.items)].map((item) => item.kind)));
  assert.deepEqual(
    OBJECT_KINDS.filter((kind) => !kinds.has(kind)),
    ['link', 'notes'],
  );
});

test('inspectPptx reads a path as well as bytes, and refuses a file that is not a presentation', () => {
  const folder = mkdtempSync(path.join(tmpdir(), 'nt-inspect-'));
  try {
    const file = path.join(folder, 'deck.pptx');
    writeFileSync(file, exported);
    assert.equal(inspectPptx(file).slides.length, 4);
    assert.throws(() => inspectPptx(new Uint8Array([1, 2, 3])));
  } finally {
    rmSync(folder, { recursive: true, force: true });
  }
});

test('objectOutcomes: native, changed, picture and dropped, matched by name', () => {
  const outcomes = objectOutcomes(exported, copy);
  const { objects } = outcomes;
  const outcomeOf = (name, kind) => {
    const entry = find(objects, name, kind);
    assert.ok(entry, `no record for ${name}`);
    return [entry.outcome, entry.how ?? null];
  };
  assert.deepEqual(outcomeOf('OPF heading slides.0.title line 0'), ['native', null]);
  assert.deepEqual(outcomeOf('OPF native body slides.0.body'), ['native', null], 'bullets inherited on both sides');
  assert.deepEqual(outcomeOf('OPF shape slides.0.blocks.1.shape'), ['changed', 'split into a group: the shape plus a separate text box (roundRect, rect)']);
  assert.deepEqual(outcomeOf('OPF shape slides.0.blocks.2.shape'), ['native', null]);
  assert.deepEqual(outcomeOf('OPF timeline 0 connector'), ['dropped', null]);
  assert.equal(find(objects, 'OPF timeline 0 connector').why, 'not in the copy');
  const empty = find(objects, 'OPF text slides.0.blocks.3.text line 1');
  assert.deepEqual([empty.outcome, empty.empty, empty.kind], ['dropped', true, 'text']);
  // Keynote writes a picture's title before its name: "Harbor OPF image 1".
  const picture = find(objects, 'OPF image 1');
  assert.deepEqual([picture.outcome, picture.how, picture.copyName], ['changed', 'mask roundRect -> custGeom', 'Harbor OPF image 1']);
  assert.deepEqual(outcomeOf('OPF furniture 0 part 0 line 0'), ['native', null], 'a kept field is native from the files alone');
  assert.deepEqual(outcomeOf('OPF heading slides.1.title line 0'), ['changed', 'placeholder ctrTitle -> title']);
  assert.deepEqual(outcomeOf('OPF table 1', 'table'), ['native', null]);
  assert.deepEqual(outcomeOf('OPF chart 1'), ['changed', 'chart type lineChart stacked -> lineChart standard']);
  // A picture replacing a diagram.
  assert.deepEqual(outcomeOf('OPF smartart slides.1.blocks.0.items'), ['picture', null]);
  assert.equal(find(objects, 'OPF smartart slides.1.blocks.0.items').why, 'became a picture');
  assert.deepEqual(outcomeOf('OPF diagram 1'), ['native', null]);
  assert.deepEqual(outcomeOf('OPF text slides.1.blocks.9.text line 0'), ['native', null]);
  assert.deepEqual(outcomeOf('OPF native body slides.2.body', 'body'), ['native', null]);

  const links = objects.filter((entry) => entry.kind === 'link').map((entry) => [entry.slide, entry.on, entry.label, entry.target, entry.outcome, entry.how ?? null]);
  assert.deepEqual(links, [
    [1, 'text', 'link to a slide', 'slide:3', 'native', null],
    [1, 'text', 'link on text', 'https://acme.com', 'changed', 'target https://acme.com -> https://acme.org'],
    [1, 'shape', 'link on a shape', 'https://acme.com/about', 'dropped', null],
    [2, 'cell', 'link to a slide', 'slide:1', 'native', null],
    [3, 'shape', 'link to a slide', 'slide:1', 'native', null],
  ]);
  assert.deepEqual(outcomeOf(undefined, 'notes'), ['native', null]);
  assert.deepEqual(
    outcomes.slides.map((slide) => slide.hidden?.outcome ?? null),
    [null, null, 'native', 'dropped'],
  );
  // The group Keynote made: its two parts are new in the copy.
  assert.deepEqual(
    outcomes.added.map((entry) => [entry.slide, entry.name, entry.parent]),
    [
      [1, 'Rounded Rectangle', 'OPF shape slides.0.blocks.1.shape'],
      [1, 'Go', 'OPF shape slides.0.blocks.1.shape'],
    ],
  );
  const counts = countOutcomes(objects);
  for (const outcome of ['native', 'changed', 'picture', 'dropped']) assert.ok(Object.values(counts).some((row) => row[outcome] > 0), `no ${outcome}`);
  assert.deepEqual(new Set(Object.keys(counts)), new Set(OBJECT_KINDS));
  assert.equal(countOutcomes(objects, 'label')['link to a slide'].native, 3);
});

test('objectOutcomes: a kept slide-number field is changed in Keynote, whose own slide number it is not', () => {
  const entry = find(objectOutcomes(exported, copy, { target: 'keynote' }).objects, 'OPF furniture 0 part 0 line 0');
  assert.equal(entry.outcome, 'changed');
  assert.match(entry.how, /^live slide-number field kept/u);
});

test('objectOutcomes: a field that became typed text, or vanished', () => {
  const deck = (text, field) => makePptx({ slides: [{ shapes: [sp(2, 'OPF furniture 0 part 0 line 0', { ph: { type: 'sldNum' }, box: [1, 1, 10, 10], paragraphs: [field ? { text, field: 'slidenum' } : text] })] }] });
  const typed = objectOutcomes(deck('1', true), deck('1', false)).objects[0];
  assert.deepEqual([typed.outcome, typed.how], ['changed', 'field became typed text "1"']);
  const gone = objectOutcomes(deck('1', true), deck('', false)).objects[0];
  assert.deepEqual([gone.outcome, gone.why], ['dropped', 'field gone, placeholder left empty']);
});

function probedResult() {
  const result = emptyResult({
    target: 'keynote',
    application: { name: 'Keynote', version: '16.0' },
    system: { os: 'macOS', version: '26.1' },
    opf: { version: '0.37.0' },
    file: { deck: 'round-trip', variant: 'default', path: 'round-trip.pptx', sha256: 'a'.repeat(64) },
    started: '2026-11-25T10:00:00Z',
  });
  result.verbs.open = { status: 'done', slideCount: 4, warnings: { status: 'not-read', source: null, lines: [] } };
  result.verbs.probe = { status: 'done' };
  result.verbs.resave = { status: 'done', path: 'resaved.pptx' };
  const o = (kind, appClass, box, extra = {}) => ({ kind, outcome: null, appClass, box, ...extra });
  result.slides = [
    {
      index: 1,
      hidden: false,
      layout: 'Title and Content',
      picture: 'slides/slide-001.png',
      notes: 'Say hello',
      objects: [
        o('title', 'shape', [44, 43, 874, 49], { text: 'Agenda' }),
        o('body', 'shape', [40, 120, 400, 100], { text: 'One\nTwo' }),
        o('text', 'text item', [500, 120, 300, 30]),
        o('group', 'group', [500, 200, 120, 120], { objects: [o('shape', 'shape', [500, 200, 120, 120]), o('text', 'text item', [510, 240, 100, 30], { text: 'Go' })] }),
        o('shape', 'shape', [700, 200, 80, 80]),
        o('picture', 'image', [40, 360, 200, 120], { name: 'OPF image 1' }),
        o('text', 'text item', [880, 500, 20, 20], { text: '￼' }),
        o('text', 'text item', [40, 500, 300, 20], { text: 'Acme' }),
        { kind: 'notes', outcome: null, text: 'Say hello' },
      ],
    },
    {
      index: 2,
      hidden: false,
      layout: 'Title and Content',
      picture: 'slides/slide-002.png',
      notes: null,
      // Five objects for six in the copy (the chart is missing from this probe): pairs come from the boxes; the text
      // item reported at another place pairs with nothing.
      objects: [
        o('title', 'shape', [44, 43, 874, 49]),
        o('table', 'table', [40, 120, 400, 100], { rows: 2, columns: 2 }),
        o('picture', 'image', [40, 260, 400, 200]),
        o('group', 'group', [500, 340, 200, 100]),
        o('text', 'text item', [100, 100, 50, 50], { text: 'alt' }),
      ],
    },
    { index: 3, hidden: true, layout: 'Title and Content', picture: null, notes: null, objects: [o('title', 'shape', [44, 43, 874, 49])] },
    { index: 4, hidden: true, layout: 'Title and Content', picture: null, notes: null, objects: [o('title', 'shape', [44, 43, 874, 49])] },
  ];
  assert.deepEqual(validateResult(result).errors, []);
  return result;
}

test('mergeOutcomes writes outcomes into the probe objects, says how sure each pair is, and adds what the probe cannot see', () => {
  const result = mergeOutcomes(probedResult(), objectOutcomes(exported, copy, { target: 'keynote' }));
  assert.deepEqual(validateResult(result).errors, []);
  const [one, two, three] = result.slides;
  const view = (object) => [object.kind, object.outcome, object.name ?? null, object.details?.match ?? null];
  assert.deepEqual(one.objects.slice(0, 8).map(view), [
    ['title', 'native', 'OPF heading slides.0.title line 0', 'order-and-box'],
    ['list', 'native', 'OPF native body slides.0.body', 'order-and-box'],
    ['text', 'native', 'OPF text slides.0.blocks.0.text line 0', 'order-and-box'],
    ['group', 'changed', 'OPF shape slides.0.blocks.1.shape', 'order-and-box'],
    ['shape', 'native', 'OPF shape slides.0.blocks.2.shape', 'order-and-box'],
    ['picture', 'changed', 'OPF image 1', 'name'],
    ['footer', 'changed', 'OPF furniture 0 part 0 line 0', 'order-and-box'],
    ['footer', 'native', 'OPF furniture 0 part 1 line 0', 'order-and-box'],
  ]);
  assert.equal(one.objects[3].how, 'split into a group: the shape plus a separate text box (roundRect, rect)');
  assert.deepEqual(one.objects[6].role, 'slide-number');
  // The parts Keynote made are paired, but the export had no such object.
  assert.deepEqual(one.objects[3].objects.map((object) => [object.outcome, object.details.match, object.details.inExport]), [
    [null, 'order-and-box', false],
    [null, 'order-and-box', false],
  ]);
  assert.equal(one.objects[8].outcome, 'native', 'notes');
  const added = one.objects.slice(9).map((object) => [object.kind, object.outcome, object.on ?? null, object.target ?? null, object.details.source]);
  assert.deepEqual(added, [
    ['connector', 'dropped', null, null, 'round trip'],
    ['text', 'dropped', null, null, 'round trip'],
    ['link', 'native', 'text', 'slide:3', 'round trip'],
    ['link', 'changed', 'text', 'https://acme.com', 'round trip'],
    ['link', 'dropped', 'shape', 'https://acme.com/about', 'round trip'],
  ]);
  assert.equal(one.objects[10].details.empty, true);
  assert.deepEqual(two.objects.map(view).slice(0, 5), [
    ['title', 'changed', 'OPF heading slides.1.title line 0', 'box'],
    ['table', 'native', 'OPF table 1', 'box'],
    ['picture', 'picture', 'OPF smartart slides.1.blocks.0.items', 'box'],
    ['group', 'native', 'OPF diagram 1', 'box'],
    ['text', null, null, 'none'],
  ]);
  assert.deepEqual(two.objects.slice(5).map((object) => [object.kind, object.target]), [['link', 'slide:1']]);
  // The probe saw only the title; the native body it missed is not added (only what a probe cannot see is).
  assert.deepEqual(three.objects.map((object) => [object.kind, object.outcome]), [
    ['title', 'native'],
    ['link', 'native'],
  ]);
});

test('mergeOutcomes makes slides from the copy when the result has none', () => {
  const result = probedResult();
  result.slides = [];
  result.verbs.probe = { status: 'not-run' };
  mergeOutcomes(result, objectOutcomes(exported, copy));
  assert.equal(result.slides.length, 4);
  assert.deepEqual(result.slides.map((slide) => slide.hidden), [false, false, true, false]);
  assert.ok(result.slides[0].objects.some((object) => object.kind === 'link'));
});

test('importResaved reports not-run without a copy or without a built command line, and reads the importer report', () => {
  assert.equal(importResaved('/nonexistent/resaved.pptx').status, 'not-run');
  const folder = mkdtempSync(path.join(tmpdir(), 'nt-import-'));
  try {
    const file = path.join(folder, 'resaved.pptx');
    writeFileSync(file, copy);
    const missing = importResaved(file, { cli: path.join(folder, 'no-cli.js') });
    assert.equal(missing.status, 'not-run');
    assert.match(missing.error, /not built/u);
  } finally {
    rmSync(folder, { recursive: true, force: true });
  }
  const report = JSON.stringify({ ok: false, code: 'import-failed', reason: 'invalid-chart-cache', error: 'Invalid chart cache.', findings: [{ severity: 'error', path: 'ppt/charts/chart1.xml#c:pt[1]' }, { severity: 'warning', path: '/x' }] });
  assert.equal(errorOf('', report), 'invalid-chart-cache: Invalid chart cache. at ppt/charts/chart1.xml#c:pt[1]');
  assert.equal(errorOf('', 'plain failure\n'), 'plain failure');
});

test('roundTripRun fills a run directory: outcomes, the import, a valid result.json, a table', () => {
  const folder = mkdtempSync(path.join(tmpdir(), 'nt-run-'));
  try {
    const inputs = path.join(folder, 'inputs');
    const run = path.join(folder, 'run');
    mkdirSync(inputs);
    writeFileSync(path.join(inputs, 'round-trip.pptx'), exported);
    const files = path.join(run, 'files', 'round-trip~default');
    mkdirSync(files, { recursive: true });
    writeFileSync(path.join(files, 'result.json'), JSON.stringify(probedResult()));
    writeFileSync(path.join(files, 'resaved.pptx'), copy);
    // A second file whose application wrote no copy.
    const other = probedResult();
    other.file = { ...other.file, id: 'other~default', deck: 'other' };
    other.verbs.resave = { status: 'failed', message: 'export as PowerPoint failed' };
    mkdirSync(path.join(run, 'files', 'other~default'), { recursive: true });
    writeFileSync(path.join(run, 'files', 'other~default', 'result.json'), JSON.stringify(other));

    const seen = [];
    const { files: summary, records } = roundTripRun(run, inputs, {
      importer: (file) => {
        seen.push(path.basename(file));
        return { status: 'imported', slideCount: 4 };
      },
    });
    assert.deepEqual(seen, ['resaved.pptx']);
    assert.deepEqual(summary.map((file) => [file.id, file.status, file.import.status]), [
      ['other~default', 'not-run', 'not-run'],
      ['round-trip~default', 'done', 'imported'],
    ]);
    const written = JSON.parse(readFileSync(path.join(files, 'result.json'), 'utf8'));
    assert.deepEqual(validateResult(written).errors, []);
    assert.deepEqual(written.verbs.resave.import, { status: 'imported', slideCount: 4 });
    const table = formatTable(countOutcomes(records, 'row'));
    assert.match(table, /^kind +native +changed +picture +dropped$/mu);
    assert.match(table, /^text \(empty box\) +0 +0 +0 +1$/mu);
    assert.match(table, /^hidden slide +1 +0 +0 +1$/mu);
  } finally {
    rmSync(folder, { recursive: true, force: true });
  }
});
