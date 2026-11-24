// LH-86 with two-column and three-column: a layout whose whole body is one row of regions keeps its columns for long texts, unless the
// texts drawn as full-width rows overflow less or read larger (no slide gets smaller text than the rows gave it). pillars (one region's
// grid) still takes the rows.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { composeSlide } from '../dist/composition.js';
import { layouts } from './support/template-samples.mjs';

const findings = (result) => result.diagnostics.filter((entry) => entry.code === 'text-overflow' || entry.code === 'small-cell');
const texts = (result) => result.items.filter((item) => item.field === 'text');
const sideBySide = (items) => items.every((item, index) => index === 0 || (Math.abs(item.box.y - items[0].box.y) < 1 && item.box.x > items[index - 1].box.x));
const paragraph = (name, repeat = 1) => ({ text: Array.from({ length: repeat }, () => `${name} should test with two teams for six weeks and measure task completion before deciding what to scale.`).join(' ') });

test('LH-86: two-column and three-column keep long texts in columns, one size', () => {
  for (const [id, count] of [['two-column', 2], ['three-column', 3]]) {
    for (const repeat of [1, 3]) {
      for (const direction of ['ltr', 'rtl']) {
        const blocks = ['Evergreen CRM', 'Asteria Robotics', 'Lumina Foods'].slice(0, count).map((name) => paragraph(name, repeat));
        const result = composeSlide({ title: 'Decision options', blocks }, { layout: layouts[id], direction });
        assert.deepEqual(findings(result), [], `${id} ${repeat} ${direction}`);
        const items = texts(result).sort((a, b) => a.box.x - b.box.x);
        assert.ok(sideBySide(items), `${id} ${repeat} ${direction}: columns`);
        assert.equal(new Set(items.map((item) => item.text.fontSize)).size, 1, `${id} ${repeat} ${direction}: one size`);
      }
    }
  }
});

test('LH-86: columns that overflow at the floor give way to rows; pillars still draws rows', () => {
  const sentence = 'Teams should focus the next cycle on recovering at-risk renewals with executive sponsorship and value proof while making the tradeoffs clear. ';
  const long = Array.from({ length: 3 }, () => ({ text: sentence.repeat(6).trim() }));
  assert.deepEqual(findings(composeSlide({ title: 'T', blocks: long }, { layout: layouts['three-column'] })), []);
  // Three two-sentence texts in three columns read larger as rows: rows, at their size.
  const pair = texts(composeSlide({ title: 'T', blocks: Array.from({ length: 3 }, () => ({ text: sentence.repeat(2).trim() })) }, { layout: layouts['three-column'] }));
  assert.ok(pair[1].box.y > pair[0].box.y + pair[0].box.height, 'rows');
  assert.ok(pair[0].text.fontSize >= 28 - 1e-9, `${pair[0].text.fontSize}`);
  const pillars = texts(composeSlide({ title: 'Decision options', blocks: [paragraph('Evergreen CRM'), paragraph('Asteria Robotics')] }, { layout: layouts.pillars }));
  assert.ok(pillars[1].box.y > pillars[0].box.y + pillars[0].box.height, 'one card per row');
});

test('COL-4 with LH-102: two short texts stay columns, as three do, though rows would grow on past them', () => {
  const blocks = [{ text: 'Test with two teams for six weeks. Measure task completion and time before deciding what to scale.' }, { text: 'Keep the scope narrow, collect feedback weekly and give each decision a named owner.' }];
  const items = texts(composeSlide({ title: 'Columns', blocks }, { width: 1280, height: 720, layout: layouts['two-column'] })).sort((a, b) => a.box.x - b.box.x);
  assert.ok(sideBySide(items), 'columns');
  assert.ok(items.every((item) => item.text.fontSize >= 37 - 1e-9), `never smaller than the rows today (${items.map((item) => item.text.fontSize)})`);
});
