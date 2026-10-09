import assert from 'node:assert/strict';
import { toSvg } from './catalog-harness.mjs';

// FA-27: Table.alt is the table's accessible name in the preview, as Chart.alt is the chart's (FA-09), but a summary and not a picture:
// a role="group" with aria-label wraps the table and its cell text stays readable (no role="img", no aria-hidden above it). An empty alt
// hides a decorative table (aria-hidden), and a table without alt draws exactly the same SVG as before.

const table = { columns: ['Region', 'Q4'], rows: [['North America', 18.1], ['EMEA', 11.5]] };
const deck = (extra = {}, slide = {}) => ({ design: { fontScheme: 'roboto' }, slides: [{ title: 'Revenue', table: { ...table, ...extra }, ...slide }] });
// The ancestors (tag name and attributes) of the first element whose text contains `needle`.
function ancestorsOfText(svg, needle) {
  const stack = [];
  for (const match of svg.matchAll(/<(\/?)([A-Za-z][\w:-]*)([^>]*?)(\/?)>|([^<]+)/g)) {
    const [, closing, name, attributes, selfClosing, text] = match;
    if (text !== undefined) {
      if (text.includes(needle)) return stack.map((entry) => entry.attributes);
    } else if (closing) stack.pop();
    else if (!selfClosing) stack.push({ name, attributes });
  }
  return undefined;
}
const readable = (svg, needle) => {
  // The slide's own root <svg> is role="img" with the slide title for every slide (not part of this change); look below it.
  const ancestors = ancestorsOfText(svg, needle)?.slice(1);
  assert.ok(ancestors, `${needle}: the cell text is in the SVG`);
  assert.ok(!ancestors.some((attributes) => /aria-hidden="true"|role="img"/.test(attributes)), `${needle}: no aria-hidden or role=img ancestor`);
  return ancestors;
};
const alt = 'North America leads EMEA, $18.1M against $11.5M in Q4 ("EMEA" in grey).';

const plain = toSvg(deck(), 1);
const labelled = toSvg(deck({ alt }), 1);
assert.match(labelled, /<g aria-label="North America leads EMEA, \$18\.1M against \$11\.5M in Q4 \(&quot;EMEA&quot; in grey\)\." role="group">/, 'labelled group');
assert.equal(labelled.split('role="group"').length - 1, plain.split('role="group"').length, 'exactly one new role=group group');
assert.equal(labelled.split('role="img"').length, plain.split('role="img"').length, 'a table is not a role=img picture');
assert.ok(readable(labelled, 'North America').some((attributes) => /role="group"/.test(attributes)), 'the cells sit inside the labelled group');
readable(labelled, 'EMEA');
readable(labelled, 'Region');
const decorative = toSvg(deck({ alt: '' }), 1);
assert.match(decorative, /<g aria-hidden="true">/, 'a decorative table is aria-hidden');
assert.doesNotMatch(decorative, /aria-label="[^"]*North/, 'no label on a decorative table');
assert.ok(ancestorsOfText(decorative, 'North America').some((attributes) => /aria-hidden="true"/.test(attributes)), 'a decorative table hides its cells');

// The wrapper adds nothing else: taking its two tags out reproduces the plain SVG byte for byte, for a labelled and a decorative table.
for (const [name, svg, open] of [['labelled', labelled, /<g aria-label="[^"]*" role="group">/], ['decorative', decorative, /<g aria-hidden="true">/]]) {
  const rest = svg.replace(open.exec(svg)[0], '');
  const ends = [...rest.matchAll(/<\/g>/g)].map((match) => match.index);
  assert.ok(ends.some((at) => rest.slice(0, at) + rest.slice(at + 4) === plain), `${name}: only the wrapper tags are added`);
}

// A table in a block, beside other text, is labelled the same way; the text beside it is untouched.
{
  const svg = toSvg({ design: { fontScheme: 'roboto' }, slides: [{ title: 'T', blocks: [{ table: { ...table, alt: 'Q4 by region' } }, { text: 'Beside' }] }] }, 1);
  assert.match(svg, /aria-label="Q4 by region" role="group"/);
  assert.match(svg, />Beside</);
  readable(svg, 'North America');
}

// A chart's alt does not leak onto a table beside it: each payload gets its own group.
{
  const both = (chartAlt) => toSvg({ design: { fontScheme: 'roboto' }, slides: [{ title: 'T', blocks: [{ table }, { chart: { type: 'column', ...chartAlt, data: { columns: ['Q', 'V'], rows: [['Q1', 1]] } } }] }] }, 1);
  const svg = both({ alt: 'Chart words' });
  assert.equal(svg.split('role="img"').length - both({}).split('role="img"').length, 1);
  assert.equal(svg.split('role="group"').length, both({}).split('role="group"').length, 'the chart alt adds no role=group');
  assert.match(svg, /aria-label="Chart words"/);
}
