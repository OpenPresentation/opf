import assert from 'node:assert/strict';
import { test } from 'node:test';
import * as composition from '../dist/composition.js';
const { composeSlide } = composition;
const chart = { chart: { type: 'column', data: { columns: ['Quarter', 'Revenue'], rows: [['Q1', 4.1], ['Q2', 4.5]] } } };
const support = [{ text: 'Enterprise seats up 31%' }, { items: ['Churn down', 'Pipeline up'] }];
const body = result => result.items.filter(item => !['title', 'subtitle', 'tag'].includes(item.field));

test('OPF 0.35: design.chartPrimary and design.contentDirection no longer reach composition', () => {
  const slide = { title: 'C', blocks: [support[0], chart, support[1]] };
  const plain = composeSlide(slide, { explain: true });
  for (const design of [{ chartPrimary: 'start' }, { chartPrimary: 'top' }, { contentDirection: 'vertical' }, { contentDirection: 'horizontal' }]) {
    const hinted = composeSlide({ ...slide, design }, { presentation: { design }, explain: true });
    assert.deepEqual(body(hinted).map(item => item.box), body(plain).map(item => item.box), JSON.stringify(design));
    assert.equal('chartPrimary' in hinted.design || 'contentDirection' in hinted.design, false);
    assert.equal(hinted.diagnostics.some(entry => /chartPrimary/.test(entry.message)), false);
  }
});

test('v1 record construction and slot APIs are absent in 0.19', () => {
  for (const name of ['chartPrimaryLayout', 'layoutLeaves', 'layoutSlots', 'hasPlaceholderGroups', 'isPlaceholderGroup', 'MAX_PLACEHOLDER_GROUP_DEPTH']) assert.equal(name in composition, false, name);
});
