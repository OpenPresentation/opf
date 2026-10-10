import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { test } from 'node:test';
import { composeSlide } from '../dist/composition.js';
import { layouts, sampleSlide } from './support/template-samples.mjs';

// OPF 0.19 (RR-79): composition goldens of the 28 built-in templates, each with 1 to 6 blocks of short and of long
// content, at the 1280 x 720 reference size with core's estimated measurement. The templates are the design doc's
// (test/fixtures/layout-templates-0.19.json) until @openpresentation/gallery 2.0.0 (RR-80) ships them; replace the fixture
// with the package then. A change to these goldens is a change to how every 0.19 slide draws: review the diff, and
// regenerate with OPF_UPDATE_GOLDENS=1 node --test test/template-goldens.test.mjs.
const goldenUrl = new URL('./fixtures/template-goldens-0.19.json', import.meta.url);

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
  for (const size of ['short', 'long']) for (let count = 1; count <= 6; count++) actual[`${id} ${count} ${size}`] = summary(composeSlide(sampleSlide(record, count, size), { layout: record }));
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
