// NT-02: probe lines -> the raw probe object normalize.mjs reads. Two excerpts of real probe lines from the 0.36.0
// Keynote round (fixtures/probe-lines/, trimmed, slides renumbered, nothing else changed but the application's display
// name), and a round trip through every recorded probe.json of the NT-01 fixtures.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { objectFromItem } from './normalize.mjs';
import { DERIVED, parseProbeLines, unescapeValue } from './probe-lines.mjs';
import { escapeValue, probeToLines } from './test-support.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const lines = (name) => readFileSync(path.join(here, 'fixtures/probe-lines', name), 'utf8');
const recorded = path.join(here, '../../core/result/fixtures/keynote-0.36.0');
const RECORDED = ['slide-links~default', 'singleton-combo-reference-lines~default', 'image-callouts~default'];

test('layout-sampler excerpt: document, slides, items in their three read modes, groups and a table', () => {
  const probe = parseProbeLines(lines('layout-sampler-excerpt.lines'));
  assert.equal(probe.app.version, '16.0');
  assert.equal(probe.document.width, 960);
  assert.equal(probe.document['slide numbers showing'], false);
  assert.equal(probe.slides.length, 3);
  assert.deepEqual(probe.errors, []);
  assert.deepEqual(probe.skippedSlides, []);
  assert.deepEqual(probe.derived, DERIVED);
  const [first, second, third] = probe.slides;
  assert.deepEqual(first.transition, { effect: 'no transition effect', duration: 1, delay: 0.5, automatic: false });
  assert.ok(first.items.some((item) => item.class === 'image' && item.readMode === 'single'));
  const modes = new Set(probe.slides.flatMap((slide) => [...slide.items, ...slide.items.flatMap((item) => item.items ?? [])].map((item) => item.readMode)));
  assert.deepEqual([...modes].sort(), ['bulk', 'item', 'single']);
  assert.ok(first.items.some((item) => item.isDefaultTitle === true));
  const groups = second.items.filter((item) => item.class === 'group');
  assert.equal(groups.length, 3);
  assert.ok(groups.every((group) => group.items.every((member) => member.depth === 1)));
  const table = third.items.find((item) => item.class === 'table');
  assert.equal(table.cellsByRow.length, table['row count']);
  assert.deepEqual(table.cellsByRow[0], ['Team', 'Participants', 'Completion', 'Median time (min)']);
  assert.deepEqual(objectFromItem(table).rows, 3);
});

test('an err line keeps the error and the fields read after it', () => {
  const probe = parseProbeLines(lines('document-error-excerpt.lines'));
  assert.deepEqual(probe.errors, [{ path: 'document', error: '-10000 Keynote got an error: AppleEvent handler failed.' }]);
  assert.equal(probe.document.theme, 'Custom Theme');
  assert.equal(probe.slides.length, 1);
});

test('a skipped slide is found by its position, not by its slide number (Keynote says -1)', () => {
  const text = ['slides/#0/slide number\tn\t1', 'slides/#0/skipped\tb\tfalse', 'slides/#1/slide number\tn\t-1', 'slides/#1/skipped\tb\ttrue', 'slides/#2/slide number\tn\t2', 'slides/#2/skipped\tb\tfalse'].join('\n');
  assert.deepEqual(parseProbeLines(text).skippedSlides, [2]);
});

test('values: escapes, numbers in either decimal mark, booleans, null and empty lists', () => {
  const awkward = 'tab\there\nnew \\ line\r   \\t literal';
  assert.equal(unescapeValue(escapeValue(awkward)), awkward);
  const probe = parseProbeLines(
    [`a/text\ts\t${escapeValue(awkward)}`, 'a/int\tn\t43', 'a/real\tn\t51.840000152588', 'a/exp\tn\t1.0E+4', 'a/comma\tn\t0,5', 'a/no\tb\tfalse', 'a/none\tnull\t', 'a/list\tlist\t0', 'a/kind\te\tno fill', 'a/empty\ts\t'].join('\r\n'),
  );
  assert.deepEqual(probe.a, { text: awkward, int: 43, real: 51.840000152588, exp: 10000, comma: 0.5, no: false, none: null, list: [], kind: 'no fill', empty: '' });
});

for (const id of RECORDED) {
  test(`${id}: probe.json -> probe lines -> the same probe, with the skipped slides fixed`, () => {
    const original = JSON.parse(readFileSync(path.join(recorded, id, 'raw/probe.json'), 'utf8'));
    const expected = structuredClone(original);
    delete expected.input;
    expected.skippedSlides = original.slides.flatMap((slide, position) => (slide.skipped ? [position + 1] : []));
    assert.deepEqual(parseProbeLines(probeToLines(original)), expected);
  });
}

test('slide-links: the recorded [-1] becomes [4]', () => {
  const original = JSON.parse(readFileSync(path.join(recorded, 'slide-links~default/raw/probe.json'), 'utf8'));
  assert.deepEqual(original.skippedSlides, [-1]);
  assert.deepEqual(parseProbeLines(probeToLines(original)).skippedSlides, [4]);
});
