// RR-105 finding 08: an area chart draws a gap (null or a non-numeric value) as a gap, never as zero.
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {toSvg} from './catalog-harness.mjs';

const attrs = (text) => Object.fromEntries([...text.matchAll(/([\w:-]+)="([^"]*)"/g)].map(([, k, v]) => [k, v]));
const tags = (svg, name) => [...svg.matchAll(new RegExp(`<${name}\\b([^>]*)>`, 'g'))].map(([, a]) => attrs(a));
const deck = (type, gap) => ({design: {fontScheme: 'roboto'}, slides: [{title: 'Visits', chart: {type, dataLabels: true, data: {columns: ['Month', 'Visits', 'Calls'], rows: [['Jul', 1200, 300], ['Aug', 1350, 320], ['Sep', gap, 310], ['Oct', 1610, 330]]}}}]});
const areaPath = (svg) => tags(svg, 'path').find((a) => a['data-opf-path'] === 'slides.0.chart.data.columns.1');
const subpaths = (d) => d.split('M').filter((part) => part.trim());
const ys = (d) => [...d.matchAll(/(-?[\d.]+) (-?[\d.]+)/g)].map(([, , y]) => Number(y));

for (const gap of [null, 'n/a']) {
  test(`an unstacked area splits at a gap (${JSON.stringify(gap)}) into runs that stand on the axis`, () => {
    const svg = toSvg(deck('area', gap), 1, {trace: true}), path = areaPath(svg);
    assert.ok(path, 'the series is drawn');
    const runs = subpaths(path.d);
    assert.equal(runs.length, 2, 'Jul to Aug, then Oct alone');
    // Before the fix one polygon ran through every point and dropped to the axis at Sep.
    const baseline = Math.max(...ys(path.d));
    assert.equal(ys(runs[0]).filter((y) => y === baseline).length, 2, 'the first run closes on the axis at its own two points');
    assert.equal(ys(runs[0]).length, 4, 'the first run has Jul and Aug only');
    // No label for the gap, the three values keep theirs.
    const labels = [...svg.matchAll(/data-opf-path="slides\.0\.chart\.data\.rows\.(\d)\.1"/g)].map(([, row]) => Number(row));
    assert.ok(!labels.includes(2), 'the gap draws no data label');
    for (const row of [0, 1, 3]) assert.ok(labels.includes(row), `row ${row} keeps its label`);
  });
}

test('a stacked area keeps the gap layer at zero thickness and draws no label for it', () => {
  const svg = toSvg(deck('stacked-area', null), 1, {trace: true}), path = areaPath(svg);
  assert.ok(path);
  assert.equal(subpaths(path.d).length, 1, 'the stack stays closed');
  const labels = [...svg.matchAll(/data-opf-path="slides\.0\.chart\.data\.rows\.(\d)\.1"/g)].map(([, row]) => Number(row));
  assert.ok(!labels.includes(2), 'the gap draws no data label');
});

test('a line still breaks at a gap', () => {
  const svg = toSvg(deck('line', null), 1, {trace: true});
  // The legend swatch is a polyline too; the plotted line has round caps.
  const runs = tags(svg, 'polyline').filter((a) => a['data-opf-path'] === 'slides.0.chart.data.columns.1' && a['stroke-linecap'] === 'round');
  assert.equal(runs.length, 1, 'Jul to Aug; Oct alone draws no polyline');
  assert.equal(runs[0].points.split(' ').length, 2);
});
