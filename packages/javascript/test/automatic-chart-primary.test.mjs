import assert from 'node:assert/strict';
import { test } from 'node:test';
import * as composition from '../dist/composition.js';
const { composeSlide } = composition;
const chart = { chart: { type: 'column', data: { columns: ['Quarter', 'Revenue'], rows: [['Q1', 4.1], ['Q2', 4.5]] } } };
const support = [{ text: 'Enterprise seats up 31%' }, { items: ['Churn down', 'Pipeline up'] }];
const body = result => result.items.filter(item => !['title', 'subtitle', 'tag'].includes(item.field));

test('automatic chartPrimary preserves its weighted chart and automatic support group on every side', () => {
  for (const side of ['left', 'right', 'top', 'bottom']) {
    const first = side === 'left' || side === 'top';
    const hinted = composeSlide({ title: 'C', blocks: [support[0], chart, support[1]] }, { presentation: { design: { chartPrimary: side } }, explain: true });
    const group = { blocks: support, composition: {} };
    const explicit = composeSlide({ title: 'C', blocks: first ? [chart, group] : [group, chart], composition: { mode: ['left', 'right'].includes(side) ? 'row' : 'column', weights: first ? [3, 2] : [2, 3] } });
    const boxes = result => Object.fromEntries(body(result).map(item => [item.field, item.box]));
    assert.deepEqual(boxes(hinted), boxes(explicit), side);
    assert.deepEqual(body(hinted).map(item => item.value).sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b))), [chart.chart, support[0].text, support[1].items].sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b))));
    assert.equal(hinted.explanation.decisions.length, 1);
    assert.equal(hinted.explanation.decisions[0].reason, 'chart-primary');
    assert.deepEqual(hinted.groups, [], 'synthetic support does not invent a source group');
  }
});

test('v1 record construction and slot APIs are absent in 0.19', () => {
  for (const name of ['chartPrimaryLayout', 'layoutLeaves', 'layoutSlots', 'hasPlaceholderGroups', 'isPlaceholderGroup', 'MAX_PLACEHOLDER_GROUP_DEPTH']) assert.equal(name in composition, false, name);
});
