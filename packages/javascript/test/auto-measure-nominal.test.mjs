import { gallery } from '@openpresentation/gallery';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { composeSlide } from '../dist/composition.js';

// WI-1 (P27): content-sized text is measured as the fit that places it measures it, its outlines and raster padding
// included, so a single-line auto note composes at its 25 px starting size instead of one grid step smaller (24 px on every
// closing next step, comparison verdict and metrics, chart, table and timeline note).
const { layouts } = gallery;
// Measurement with outlines whose ink reaches a little below the line box (descenders), as a real face's do.
const textMeasurement = {
  measure: (text, size) => text.length * size * 0.5,
  outlineBounds: (text, size) => (text ? { x: 0, y: -0.8 * size, width: text.length * size * 0.5, height: size } : null),
};
const note = 'Next step: agree the pilot owner by Friday.';

for (const [id, regionName, slide] of [
  ['metrics', 'note', { title: 'Metrics', blocks: [{ metric: { value: '42%', label: 'Growth' } }, { text: note }] }],
  ['chart', 'note', { title: 'Chart', blocks: [{ chart: { type: 'column', data: { columns: ['Q', 'V'], rows: [['Q1', 1], ['Q2', 2]] } } }, { text: note }] }],
  ['closing', 'details', { title: 'Thank you', text: note }],
]) {
  test(`${id}: a single-line auto note composes at exactly 25 px`, () => {
    const result = composeSlide(slide, { layout: layouts[id], textMeasurement });
    const item = result.items.find((entry) => entry.region === regionName && entry.field === 'text');
    assert.ok(item, JSON.stringify(result.items.map((entry) => [entry.region, entry.field])));
    assert.equal(item.text.fontSize, 25);
    assert.equal(item.text.lines.length, 1);
    assert.equal(item.text.overflow, false);
  });
}
