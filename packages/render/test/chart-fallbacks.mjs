import assert from 'node:assert/strict';
import { colorContrast, textColorForFill } from '@openpresentation/opf/composition';
import { toSvg } from './catalog-harness.mjs'; // FA-23: registers the gallery snapshot (the documents name gallery records)

// LH-60 and LH-56 in the preview: core's chartDrawPlan decides the construct (a map over categories that are not places as columns,
// a box per series, a pie of several series as nested rings, a scatter by position), and labels inside marks contrast with their fill.

const attributesOf = (text) => Object.fromEntries([...text.matchAll(/([\w:-]+)="([^"]*)"/g)].map(([, key, value]) => [key, value]));
const quarters = { columns: ['Quarter', 'Current', 'Baseline'], rows: [['Q1', 21, 18], ['Q2', 25, 20], ['Q3', 28, 22], ['Q4', 32, 24]] };
const deck = (chart, design = {}) => ({ design: { fontScheme: 'roboto', ...design }, slides: [{ title: 'Chart', chart: { alt: 'A chart', ...chart } }] });
const render = (chart, design) => toSvg(deck(chart, design), 1, { trace: true });
const marks = (svg, name) => [...svg.matchAll(new RegExp(`<${name}\\b([^>]*)/>`, 'g'))].map(([, attrs]) => attributesOf(attrs)).filter((mark) => mark['data-opf-path']?.startsWith('slides.0.chart.data.'));

// A world chart over quarters draws clustered columns of both series, like the PPTX export.
{
  const svg = render({ type: 'world', data: quarters });
  const bars = marks(svg, 'rect').filter((bar) => bar['data-opf-path'].includes('.rows.'));
  assert.deepEqual([...new Set(bars.map((bar) => bar['data-opf-path'].replace(/^slides\.0\.chart\.data\.rows\.\d+\./, '')))].sort(), ['1', '2'], 'both series drawn');
  assert.equal(bars.length, 8, 'one column per series and quarter');
  const countries = { columns: ['Country', 'Sales'], rows: [['Germany', 4], ['France', 3], ['Spain', 2]] };
  assert.equal(marks(render({ type: 'world', data: countries }), 'rect').length, 3, 'a map of places keeps its tiles');
}

// A pie of two series draws two rings of four slices each, the first series inside.
for (const type of ['pie', 'doughnut']) {
  const slices = marks(render({ type, data: quarters }), 'path');
  assert.equal(slices.length, 8, `${type}: two rings of four slices`);
  assert.deepEqual([...new Set(slices.map((slice) => slice['data-opf-path'].at(-1)))].sort(), ['1', '2'], `${type}: both series`);
}

// One value per box-and-whisker category: one box per series, in one group named after the category column.
{
  const svg = render({ type: 'box-and-whisker', data: quarters });
  // A box traces to its series column, as its legend key does: one box and one key per series (four boxes each without the fallback).
  const rects = marks(svg, 'rect');
  for (const column of ['1', '2']) assert.equal(rects.filter((mark) => mark['data-opf-path'] === `slides.0.chart.data.columns.${column}`).length, 2, `series ${column}: one box and its legend key`);
  assert.match(svg, />Quarter</, 'the group is named after the category column');
}

// A scatter whose X column is text plots every series against the row position (no points are lost).
{
  const data = { columns: ['Name', 'Region', 'Score', 'Target'], rows: [['a', 'North', 4, 5], ['b', 'South', 6, 5], ['c', 'East', 5, 7]] };
  const points = marks(render({ type: 'scatter', data }), 'circle').filter((point) => point['data-opf-path'].includes('.rows.'));
  assert.equal(points.length, 6, 'three points of each numeric series');
  assert.deepEqual([...new Set(points.map((point) => point['data-opf-path'].at(-1)))].sort(), ['2', '3'], 'points trace to the authored series columns');
}

// LH-56: treemap and funnel labels reach 4.5:1 on their fills, on a light and on a dark slide.
for (const design of [{}, { colorScheme: 'cool-horizon', variant: 'dark1' }]) {
  for (const type of ['treemap', 'funnel']) {
    const svg = render({ type, data: { columns: ['Quarter', 'Current'], rows: quarters.rows.map((row) => row.slice(0, 2)) } }, design);
    const fills = marks(svg, 'rect').map((mark) => mark.fill);
    assert.ok(fills.length >= 4, `${type}: marks drawn`);
    // The labels inside the marks: a treemap's category names, a funnel's values (its category labels sit outside, left of the bars).
    const inside = type === 'treemap' ? '0' : '1';
    const labels = [...svg.matchAll(/<text\b([^>]*)>/g)].map(([, attrs]) => attributesOf(attrs)).filter((text) => new RegExp(`^slides\\.0\\.chart\\.data\\.rows\\.\\d+\\.${inside}$`).test(text['data-opf-path'] ?? ''));
    assert.ok(labels.length >= 4, `${type}: labels drawn`);
    for (const label of labels) {
      const row = Number(label['data-opf-path'].split('.')[5]);
      const fill = type === 'treemap' ? fills[row] : fills[0];
      // 4.5:1, or the better of black and white where no colour reaches it (core's textColorForFill).
      assert.ok(colorContrast(label.fill, fill) >= 4.5 || label.fill === textColorForFill(fill, '#808080'), `${type}: label ${label.fill} on ${fill}`);
    }
  }
}

console.log('chart fallbacks ok');
