import { gallery } from '@openpresentation/gallery';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { CODE_NOMINAL_SIZE, composeSlide, layoutCode } from '../dist/composition.js';

// WI-4 (P21): the code body asks for 22 px (fitting down to the floor) and the panel is only as tall as its metadata, source
// lines and insets need, top-anchored, when the code is shorter than its cell. The language or file label keeps its own smaller role.
const { layouts } = gallery;
const snippet = { language: 'javascript', source: 'const total = items.reduce((sum, item) => sum + item.value, 0);\nconsole.log(total);' };
const long = { language: 'javascript', source: Array.from({ length: 11 }, (_, line) => `const value${line} = compute(${line}, "a long string argument ${line}");`).join('\n') };

test('the body asks for 22 px and the label keeps its smaller role', () => {
  assert.equal(CODE_NOMINAL_SIZE, 22);
  const layout = layoutCode(snippet, { x: 0, y: 0, width: 900, height: 500 });
  const [label, body] = layout.parts;
  assert.equal(body.requestedFontSize, 22);
  assert.equal(body.fit.fontSize, 22);
  assert.ok(label.requestedFontSize < 22, `${label.requestedFontSize}`);
  assert.equal(layout.overflow, false);
});

test('a short snippet gets a panel that hugs its content, anchored at the top of the cell', () => {
  const cell = { x: 40, y: 100, width: 900, height: 500 };
  const layout = layoutCode(snippet, cell);
  const body = layout.parts.at(-1);
  const content = body.box.y + body.fit.lines.length * body.fit.lineHeight + 18 - cell.y;
  assert.ok(Math.abs(layout.bounds.height - content) < 0.01, `${layout.bounds.height} against ${content}`);
  assert.ok(layout.bounds.height < cell.height / 2, `${layout.bounds.height}`);
  assert.equal(layout.bounds.y, cell.y);
  // On a slide the code item's box is that panel.
  const result = composeSlide({ title: 'Code', code: snippet }, { layout: layouts.code });
  const item = result.items.find((entry) => entry.field === 'code');
  assert.ok(Math.abs(item.box.height - item.codeLayout.bounds.height) < 0.02);
  const region = result.regions.find((entry) => entry.name === item.region)?.box;
  assert.ok(!region || item.box.height < region.height - 100, 'the panel is shorter than its region');
  assert.ok(Math.abs(item.box.y - (region?.y ?? item.box.y)) < 0.02, 'top-anchored');
});

test('long code keeps its cell and fits down without clipping', () => {
  const cell = { x: 0, y: 0, width: 900, height: 320 };
  const layout = layoutCode(long, cell);
  const body = layout.parts.at(-1);
  assert.equal(layout.overflow, false);
  assert.ok(body.fit.fontSize < 22 && body.fit.fontSize >= 16, `${body.fit.fontSize}`);
  assert.ok(body.fit.lines.length * body.fit.lineHeight <= body.box.height + 0.01);
  assert.ok(Math.abs(layout.bounds.height - cell.height) < 40, 'a code body that fills its cell keeps the cell');
});

test('two and three columns of code fit down at 22 px without clipping', () => {
  for (const count of [2, 3]) {
    const record = { name: `${count} columns`, direction: 'column', regions: [{ name: 'title' }, { direction: 'row', regions: Array.from({ length: count }, (_, index) => ({ name: `c${index}`, accepts: ['code'], role: 'primary', flow: 'none' })) }] };
    const blocks = Array.from({ length: count }, (_, index) => ({ region: `c${index}`, code: { language: 'js', source: Array.from({ length: 6 + 4 * index }, (_, line) => `const value${line} = compute(${line});`).join('\n') } }));
    const result = composeSlide({ title: 'Columns', blocks }, { layout: record });
    assert.deepEqual(result.diagnostics, [], `${count} columns`);
    for (const item of result.items.filter((entry) => entry.field === 'code')) {
      const body = item.codeLayout.parts.at(-1);
      assert.ok(body.fit.fontSize >= 16 && body.fit.fontSize <= 22);
      assert.ok(body.box.y + body.fit.lines.length * body.fit.lineHeight <= item.box.y + item.box.height + 0.02, 'the lines stay inside the panel');
    }
  }
});
