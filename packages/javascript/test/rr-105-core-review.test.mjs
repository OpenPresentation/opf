// RR-105 core review (2026-11-12): composition never throws on authored, editable data; a crowded mark is not overflow; a combo
// without reference lines keeps both engines' own layout; a duration timeline's measured and placed heights agree; language fixes.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { chartReferenceSources, composeSlide, timelineStatusWordsFor } from '../dist/composition.js';

const picture = { src: 'data:image/png;base64,iVBORw0KGgo=', alt: 'A picture' };
const codes = (result) => result.diagnostics.map((entry) => entry.code);

test('finding 6: a callout or overlay composition cannot place is reported and left out, never thrown', () => {
  const callouts = (entries) => composeSlide({ title: 'Callouts', image: { ...picture, callouts: entries } });
  for (const bad of [{ text: 'Zero', x: 0.1, y: 0.1, width: 0, height: 0.2 }, { text: 'Wide', x: 0.1, y: 0.1, width: 1.5, height: 0.2 }, { text: 'Far', x: 1e300, y: 0.1, width: 0.2, height: 0.2 }]) {
    const result = callouts([bad, { text: 'Kept', x: 0.5, y: 0.5, width: 0.3, height: 0.2 }]);
    const image = result.items.find((item) => item.field === 'image');
    assert.deepEqual(image.image.callouts.map((callout) => callout.path), ['slides.0.image.callouts.1'], JSON.stringify(bad));
    assert.ok(result.diagnostics.some((entry) => entry.code === 'unresolved-content' && entry.path === 'slides.0.image.callouts.0'), JSON.stringify(bad));
  }
  const fractional = composeSlide({ title: 'Overlay', text: 'Hello', shapes: [{ shape: 'rect', x: 1e300, y: 0, width: 0.1, height: 0.1 }, { shape: 'rect', x: 0.1, y: 0.1, width: 0.1, height: 0.1 }] });
  assert.deepEqual(fractional.overlayShapes.map((shape) => shape.index), [1]);
  assert.ok(fractional.diagnostics.some((entry) => entry.code === 'unresolved-content' && entry.path === 'slides.0.shapes.0.x'));
  const anchored = composeSlide({ title: 'Overlay', blocks: [{ id: 'note', text: 'Hello' }], shapes: [{ shape: 'rect', at: { block: 'note', edge: 'top', width: 1e300 } }] });
  assert.equal(anchored.overlayShapes, undefined);
  assert.ok(codes(anchored).includes('unresolved-content'));
});

test('finding 5: a timeline period shorter than its marker is a crowded mark, which a strict composition reports without refusing', () => {
  const slide = { title: 'Plan', composition: { overflow: 'error' }, timeline: { events: [{ when: 'Day 1', what: 'Kickoff', duration: 1 }, { when: 'Year 3', what: 'Delivery', duration: 1000 }] } };
  const result = composeSlide(slide);
  assert.ok(result.diagnostics.some((entry) => entry.code === 'mark-crowded'), codes(result).join());
  assert.ok(!codes(result).includes('text-overflow'));
});

test('finding 5: a reference diagnostic names the authored entry when an earlier one has no value', () => {
  assert.deepEqual(chartReferenceSources({ type: 'line', referenceLines: [{ label: 'No value' }, { value: 3 }, { value: Number.NaN }, { value: 5 }] }), [1, 3]);
  assert.deepEqual(chartReferenceSources({ type: 'pie', referenceLines: [{ value: 3 }] }), []);
});

test('finding 7: a combo chart without reference lines has no composed axis or pinned plot, as in v0.33.0; with one it has both', () => {
  const combo = { type: 'combo', data: { columns: ['Quarter', 'Revenue', { name: 'Margin', format: '0%' }], rows: [['Q1', 120, 0.31], ['Q2', 135, 0.34], ['Q3', 150, 0.36]] }, line: ['Margin'], secondaryAxis: ['Margin'] };
  const chartOf = (chart) => composeSlide({ title: 'Revenue and margin', chart }).items.find((item) => item.field === 'chart').chart;
  const plain = chartOf(combo);
  assert.equal(plain?.valueAxis, undefined);
  assert.equal(plain?.secondaryValueAxis, undefined);
  assert.equal(plain?.layer?.plot, undefined);
  const referenced = chartOf({ ...combo, referenceLines: [{ value: 140, label: 'Target' }] });
  assert.ok(referenced.valueAxis && referenced.secondaryValueAxis && referenced.layer.plot && referenced.layer.references);
});

test('finding 4: a duration timeline in a stack of timelines is placed in the height it was measured at', () => {
  const plain = (count) => ({ timeline: { events: Array.from({ length: count }, (_, index) => ({ when: `Q${index + 1}`, what: `Milestone ${index + 1} with a longer label` })) } });
  const ranged = { timeline: { events: [{ when: '2024', what: 'Discovery', duration: 1 }, { when: '2025', what: 'Build the new platform', duration: 3 }, { when: '2026', what: 'Rollout', duration: 1 }] } };
  const result = composeSlide({ title: 'Roadmap', composition: { mode: 'column' }, blocks: [ranged, plain(6), plain(6)] });
  assert.deepEqual(codes(result).filter((code) => code === 'text-overflow'), []);
  for (const item of result.items.filter((entry) => entry.timelineLayout)) assert.ok(item.timelineLayout.bounds.height <= item.box.height + 0.5, `${item.path}: ${item.timelineLayout.bounds.height} in ${item.box.height}`);
  const durations = result.items.find((item) => item.timelineLayout?.ranges);
  for (const part of durations.timelineLayout.parts) assert.ok(part.fit.fontSize >= part.requestedFontSize - 1e-6, 'LH-16: ranged labels never shrink');
});

test('finding 9: a note or an overlay naming "icon" does not change how a short body grows', () => {
  const slide = { title: 'Evidence Pack', composition: { mode: 'column' }, blocks: [{ text: 'Image backgrounds use a fixed image fill.' }, { text: 'Participants said the checklist made the next step obvious.' }] };
  const sizes = (input) => composeSlide(input).items.filter((item) => item.field === 'text').map((item) => item.text.fontSize);
  assert.deepEqual(sizes({ ...slide, notes: 'icon' }), sizes(slide));
  assert.deepEqual(sizes({ ...slide, shapes: [{ shape: 'rect', x: 0.9, y: 0.9, width: 0.05, height: 0.05, alt: 'icon' }] }), sizes(slide));
});

test('finding 11: a short Arabic question ends as a sentence, as one ending in a full stop does', () => {
  const shape = (end) => composeSlide({ title: 'سؤال', language: 'ar', start: { text: 'هل نبدأ الآن' + end }, end: { text: 'نعم نبدأ اليوم' + end } }).items.map((item) => [item.field, item.box.width, item.text?.fontSize]);
  assert.deepEqual(shape('؟'), shape('.'));
  assert.notDeepEqual(shape(''), shape('.'), 'a short text without an end mark is a tile label');
});

test('finding 12: European Portuguese plans with "Planeado", and a slide language wins when the host passes no slide index', () => {
  assert.equal(timelineStatusWordsFor('pt-PT').planned, 'Planeado');
  assert.equal(timelineStatusWordsFor('pt-BR').planned, 'Planejado');
  assert.equal(timelineStatusWordsFor('pt').planned, 'Planejado');
  const slide = { title: 'Plano', language: 'pt-PT', timeline: { events: [{ when: '2025', what: 'Lançamento', status: 'done' }, { when: '2026', what: 'Expansão', status: 'planned' }] } };
  const words = (options) => composeSlide(slide, options).items.find((item) => item.timelineLayout).timelineLayout.statusLabels?.map((part) => part.text);
  assert.ok(words({ presentation: { language: 'en-US', slides: [slide] } })?.includes('Planeado'));
  assert.ok(words({})?.includes('Planeado'));
});
