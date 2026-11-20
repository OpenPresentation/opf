// RR-105 finding 09: a reference label stays off the bars and areas when a free place exists at either end of its line, and a label
// that cannot stands on a plate of the chart's surface, so it reads against the mark behind it.
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {toSvg, resolvePresentation} from './catalog-harness.mjs';

const attrs = (text) => Object.fromEntries([...text.matchAll(/([\w:-]+)="([^"]*)"/g)].map(([, k, v]) => [k, v]));
const tags = (svg, name) => [...svg.matchAll(new RegExp(`<${name}\\b([^>]*)>`, 'g'))].map(([, a]) => attrs(a));
const deck = (type, value) => ({design: {fontScheme: 'roboto', background: 'light1'}, slides: [{title: 'Floor line', chart: {type, data: {columns: ['Quarter', 'Revenue'], rows: [['Q1', 12], ['Q2', 18], ['Q3', 22], ['Q4', 26]]}, referenceLines: [{value, label: 'Floor'}]}}]});
const overlap = (a, b) => a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
const num = (r) => ({x: Number(r.x), y: Number(r.y), width: Number(r.width), height: Number(r.height)});

test('a column chart label moves to the free end and touches no bar', () => {
  const doc = deck('column', 15), svg = toSvg(doc, 1, {trace: true});
  const line = resolvePresentation(doc).slides[0].geometry.items.find((i) => i.field === 'chart').chart.layer.references.lines[0];
  assert.equal(line.endpoint, 0);
  const bars = tags(svg, 'rect').filter((r) => /^slides\.0\.chart\.data\.rows\.\d\.1$/.test(r['data-opf-path'] ?? '')).map(num);
  assert.equal(bars.length, 4);
  assert.ok(bars.every((bar) => !overlap(bar, line.labelBox)), 'the label is off every drawn bar');
  assert.equal(tags(svg, 'rect').filter((r) => r['data-opf-path'] === 'slides.0.chart.referenceLines.0.label').length, 0, 'no plate when the label is free');
  // The line is drawn after the bars, so it shows across them.
  assert.ok(svg.indexOf('data-opf-path="slides.0.chart.referenceLines.0"') > svg.lastIndexOf('data-opf-path="slides.0.chart.data.rows.3.1"'));
});

for (const type of ['column', 'area']) {
  test(`${type}: a label with no free place stands on a plate of the surface color`, () => {
    const svg = toSvg(deck(type, 6), 1, {trace: true});
    const plate = tags(svg, 'rect').find((r) => r['data-opf-path'] === 'slides.0.chart.referenceLines.0.label');
    assert.ok(plate, 'the plate is drawn');
    assert.equal(plate.fill.toUpperCase(), '#FFFFFF', 'light1 surface');
    assert.ok(svg.indexOf('slides.0.chart.referenceLines.0.label') < svg.lastIndexOf('Floor'), 'the text is drawn over its plate');
  });
}
