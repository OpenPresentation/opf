import assert from 'node:assert/strict';
import { toSvg } from './catalog-harness.mjs'; // FA-23: registers the gallery snapshot (the documents name gallery records)
import { CHART_TYPES } from '../src/charts.js';

// FA-09: Chart.alt is the chart's accessible name in the preview. A role="img" group with aria-label wraps the chart, an empty alt
// hides it (aria-hidden), and a chart without alt draws exactly the same SVG as before.

const data = { columns: ['Quarter', 'North', 'South'], rows: [['Q1', 10, 5], ['Q2', 20, 8], ['Q3', 15, 12]] };
const deck = (chart, extra = {}) => ({ design: { fontScheme: 'roboto' }, slides: [{ title: 'Chart', chart: { type: 'column', data, ...chart }, ...extra }] });
const alt = 'North leads South in every quarter; both peak in Q2 at 20 and 8 ("North" in blue).';

for (const type of Object.keys(CHART_TYPES)) {
  const plain = toSvg(deck({ type }), 1);
  const labelled = toSvg(deck({ type, alt }), 1);
  assert.match(labelled, /<g aria-label="North leads South in every quarter; both peak in Q2 at 20 and 8 \(&quot;North&quot; in blue\)\." role="img">/, `${type}: labelled group`);
  assert.equal(labelled.split('role="img"').length - 1, plain.split('role="img"').length, `${type}: exactly one new role=img group`);
  const decorative = toSvg(deck({ type, alt: '' }), 1);
  assert.match(decorative, /<g aria-hidden="true">/, `${type}: decorative chart is aria-hidden`);
  assert.doesNotMatch(decorative, /aria-label="[^"]*North/, `${type}: no label on a decorative chart`);
}

// The wrapper adds nothing else: taking its two tags out of a labelled chart reproduces the plain SVG byte for byte.
for (const type of ['column', 'pie', 'waterfall', 'line']) {
  const plain = toSvg(deck({ type }), 1);
  const open = /<g aria-label="[^"]*" role="img">/.exec(toSvg(deck({ type, alt }), 1))[0];
  const rest = toSvg(deck({ type, alt }), 1).replace(open, '');
  const ends = [...rest.matchAll(/<\/g>/g)].map((match) => match.index);
  assert.ok(ends.some((at) => rest.slice(0, at) + rest.slice(at + 4) === plain), `${type}: only the wrapper tags are added`);
}

// An alt on a chart in a block and a dataset chart is exposed the same way; text beside the chart is untouched.
{
  const svg = toSvg({ design: { fontScheme: 'roboto' }, slides: [{ title: 'T', blocks: [{ chart: { type: 'line', alt: 'Trend up', data } }, { text: 'Beside' }] }] }, 1);
  assert.match(svg, /aria-label="Trend up" role="img"/);
  assert.match(svg, />Beside</);
}
