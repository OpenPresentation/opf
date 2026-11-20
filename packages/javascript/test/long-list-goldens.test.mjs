import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { test } from 'node:test';
import { composeSlide } from '../dist/composition.js';
import { longListCases } from './support/long-list-cases.mjs';

// OPF 0.35 (list columns by default): composition goldens of long lists, 7, 9, 12 and 16 short entries and 8 long ones, in a layout's
// body, in a body between a lead and an aside, in a two-column layout and in a weighted row of an automatic slide, at the 1280 x 720
// reference size with core's estimated measurement. A long list in a region without an arrangement flows into columns when they read at
// least as large as one column. Regenerate with OPF_UPDATE_GOLDENS=1 node --test test/long-list-goldens.test.mjs and review the diff.
const goldenUrl = new URL('./fixtures/long-list-goldens.json', import.meta.url);

const r = (value) => Math.round(value * 10) / 10;
const box = (value) => `${r(value.x)},${r(value.y)},${r(value.width)},${r(value.height)}`;
const summary = (result) => [
  ...(result.regions ?? []).map((region) => `region ${region.name} ${box(region.box)} ${region.content.length}${region.overflow ? `+${region.overflow.length}` : ''}`),
  ...result.items.map((item) => `item ${item.path.replace(/^slides\.0\./, '')} ${item.region ?? '-'} ${box(item.box)}${item.text?.fontSize ? ` ${r(item.text.fontSize)}px` : ''}${item.listColumns ? ` cols=${item.listColumns.length}@${item.listColumns.map((column) => r(column.text.fontSize)).join('/')}` : ''}`),
  ...result.diagnostics.map((entry) => `diagnostic ${entry.code} ${entry.path.replace(/^slides\.0\./, '')}`),
];

const actual = Object.fromEntries(longListCases().map(({ key, slide, layout }) => [key, summary(composeSlide(slide, layout ? { layout } : {}))]));

test('long-list goldens: 5 lists x body, lead and aside, two columns and a weighted row', () => {
  assert.equal(Object.keys(actual).length, 25);
  if (process.env.OPF_UPDATE_GOLDENS === '1') writeFileSync(goldenUrl, `${JSON.stringify(actual, null, 1)}\n`);
  const golden = JSON.parse(readFileSync(goldenUrl, 'utf8'));
  for (const key of Object.keys(golden)) assert.deepEqual(actual[key], golden[key], key);
  assert.deepEqual(Object.keys(actual), Object.keys(golden));
});

test('a long list in a region takes columns only where they read at least as large as one column', () => {
  for (const { key, slide, layout } of longListCases()) {
    if (!layout) continue;
    const composed = composeSlide(slide, { layout });
    const list = composed.items.find((item) => item.field === 'items');
    if (!list.listColumns) continue;
    // The same list with one column of its own (a payload count wins over the region's default).
    const single = composeSlide({ ...slide, blocks: slide.blocks.map((block) => (block.items ? { ...block, columns: 1 } : block)) }, { layout });
    const one = single.items.find((item) => item.field === 'items');
    assert.ok(Math.min(...list.listColumns.map((column) => column.text.fontSize)) >= one.text.fontSize - 0.01, `${key}: columns ${list.listColumns[0].text.fontSize} under one column ${one.text.fontSize}`);
  }
});
