import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { test } from 'node:test';
import { composeSlide, layoutTemplate } from '../dist/composition.js';

// OPF 0.19 (RR-79): composition goldens of the 28 built-in templates, each with 1 to 6 blocks of short and of long
// content, at the 1280 x 720 reference size with core's estimated measurement. The templates are the design doc's
// (test/fixtures/layout-templates-0.19.json) until @openpresentation/gallery 2.0.0 (RR-80) ships them; replace the fixture
// with the package then. A change to these goldens is a change to how every 0.19 slide draws: review the diff, and
// regenerate with OPF_UPDATE_GOLDENS=1 node --test test/template-goldens.test.mjs.
const { layouts } = JSON.parse(readFileSync(new URL('./fixtures/layout-templates-0.19.json', import.meta.url), 'utf8'));
const goldenUrl = new URL('./fixtures/template-goldens-0.19.json', import.meta.url);

const long = 'Customers told us onboarding took too long, so we rebuilt it around three steps, measured every one of them and removed the two that nobody needed; the flow now takes four minutes instead of twenty.';
const payload = (kind, index, size) => {
  const big = size === 'long';
  switch (kind) {
    case 'text': return { text: big ? `${index + 1}. ${long}` : `Point ${index + 1}` };
    case 'list': return { items: Array.from({ length: big ? 7 : 3 }, (_, item) => (big ? `Item ${item + 1}: ${long.slice(0, 70)}` : `Item ${item + 1}`)) };
    case 'image': return { image: { src: `https://example.com/picture-${index + 1}.png`, alt: `Picture ${index + 1}` } };
    case 'chart': return { chart: { type: 'column', data: { columns: ['Quarter', 'Revenue'], rows: [['Q1', 4.1 + index], ['Q2', 4.5], ['Q3', 5.2]] } } };
    case 'table': return { table: { columns: ['Plan', 'Seats', 'Price'], rows: Array.from({ length: big ? 9 : 3 }, (_, row) => [`Plan ${row + 1}`, String(10 * (row + 1)), `$${row + 5}`]) } };
    case 'code': return { code: { language: 'js', source: Array.from({ length: big ? 16 : 3 }, (_, line) => `const value${line} = compute(${line});`).join('\n') } };
    case 'metric': return { metric: { value: `${40 + index}%`, label: big ? long.slice(0, 90) : `Metric ${index + 1}` } };
    case 'quote': return { quote: { text: big ? long : 'It just works.', attribution: `Person ${index + 1}` } };
    case 'timeline': return { timeline: { events: Array.from({ length: big ? 6 : 3 }, (_, event) => ({ when: `Q${event + 1}`, what: big ? `Milestone ${event + 1} with a longer description` : `Step ${event + 1}` })) } };
    default: throw new Error(kind);
  }
};
/** The kinds a sample slide uses: each region's first accepted kind (videos drawn as pictures), the first primary region first. */
const sampleKinds = (record) => {
  const template = layoutTemplate(record);
  const regions = [...template.regions].sort((a, b) => (a.role === 'primary' ? 0 : 1) - (b.role === 'primary' ? 0 : 1));
  return regions.map((region) => region.accepts.find((kind) => kind !== 'group' && kind !== 'video') ?? 'image');
};
const r = (value) => Math.round(value * 10) / 10;
const box = (value) => `${r(value.x)},${r(value.y)},${r(value.width)},${r(value.height)}`;
const summary = (result) => [
  ...(result.headingAreas ?? []).map((area) => `area ${area.name} ${box(area.box)}${area.collapsed ? ' collapsed' : ''}${area.implicit ? ' implicit' : ''}`),
  ...(result.regions ?? []).map((region) => `region ${region.name} ${box(region.box)} ${region.arrangement ?? '-'} ${region.content.length}${region.overflow ? `+${region.overflow.length}` : ''}${region.collapsed ? ' collapsed' : ''}`),
  ...result.items.map((item) => `item ${item.path.replace(/^slides\.0\./, '')} ${item.region ?? '-'} ${box(item.box)}${item.text?.fontSize ? ` ${r(item.text.fontSize)}px` : ''}${item.listColumns ? ` cols=${item.listColumns.length}` : ''}`),
  ...result.diagnostics.map((entry) => `diagnostic ${entry.code} ${entry.path.replace(/^slides\.0\./, '')}`),
];

const actual = {};
for (const [id, record] of Object.entries(layouts)) {
  const kinds = sampleKinds(record);
  for (const size of ['short', 'long']) for (let count = 1; count <= 6; count++) {
    const blocks = Array.from({ length: count }, (_, index) => payload(kinds.length ? kinds[index % kinds.length] : 'text', index, size));
    const slide = { title: size === 'long' ? `${record.name}: a longer title that may need a second line on the slide` : record.name, blocks };
    actual[`${id} ${count} ${size}`] = summary(composeSlide(slide, { layout: record }));
  }
}

test('composition goldens: 28 templates x 1 to 6 blocks x short and long content', () => {
  assert.equal(Object.keys(actual).length, 28 * 6 * 2);
  if (process.env.OPF_UPDATE_GOLDENS === '1') writeFileSync(goldenUrl, `${JSON.stringify(actual, null, 1)}\n`);
  const golden = JSON.parse(readFileSync(goldenUrl, 'utf8'));
  for (const key of Object.keys(golden)) assert.deepEqual(actual[key], golden[key], key);
  assert.deepEqual(Object.keys(actual), Object.keys(golden));
});

test('no golden drops content: every block is drawn', () => {
  for (const [key, lines] of Object.entries(actual)) {
    const count = Number(key.split(' ')[1]);
    const drawn = new Set(lines.filter((line) => line.startsWith('item blocks.')).map((line) => line.split(' ')[1].split('.')[1]));
    assert.equal(drawn.size, count, key);
  }
});
