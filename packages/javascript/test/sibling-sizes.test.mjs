import { gallery } from '@openpresentation/gallery';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { composeSlide, layoutMetric } from '../dist/composition.js';

// LH-43: blocks of one kind in a region (and across the parallel regions of a layout) share the smallest size any of them fitted
// at, so uneven content does not draw sibling cards at different sizes. LH-17: a block that shrinks takes a size of the type scale
// (16, 18, 21, 24, 28 and 32 px at the default floor) instead of any size between.
const { layouts } = gallery;
const long = (name) => `${name} should focus the next cycle on improving evaluation timelines and family communication while making the operating tradeoffs clear to student services stakeholders.`;
const SCALE = [16, 18, 21, 24, 28, 32];
// LH-50: a label drawn as the eyebrow of the text after it is set at the tag's size, not shared with its siblings.
const sizesOf = (result, field = 'text') => result.items.filter((item) => item.field === field && item.path.includes('.blocks.') && !item.eyebrow).map((item) => item.text.fontSize);
const overflow = (result) => result.diagnostics.filter((entry) => entry.code === 'text-overflow');

test('the cards of a grid share one size across its rows', () => {
  const blocks = [long('Canyon Unified'), long('Mosaic Strategy'), 'The deck-level language can be a tag.', long('SignalKit'),
    'Evidence: share the same geometry.', 'Inputs', 'Pattern backgrounds carry a preset plus colors.', 'Then: explain the change.'].map((text) => ({ text }));
  const result = composeSlide({ title: 'Why this matters', blocks }, { layout: layouts.pillars });
  const sizes = sizesOf(result);
  // LH-50: "Inputs" is the eyebrow of the paragraph after it.
  assert.equal(sizes.length, 7);
  assert.equal(result.items.filter((item) => item.eyebrow).map((item) => item.value).join(), 'Inputs');
  assert.equal(new Set(sizes).size, 1, `one size: ${sizes}`);
  assert.deepEqual(overflow(result), []);
  // The joint fit: the rows are sized at the shared size, so the long row is tall, the row of short texts short, and the shared size
  // is above what equal rows allowed the long cards (18 px).
  assert.ok(sizes[0] >= 21, String(sizes[0]));
  const texts = result.items.filter((item) => item.field === 'text' && item.path.includes('.blocks.') && !item.eyebrow);
  assert.ok(texts[0].box.height > 2 * texts[4].box.height, `${texts[0].box.height} over ${texts[4].box.height}`);
  // A row keeps one height: its cells share their top and foot (a paragraph under an eyebrow starts below it, LH-50).
  const cellOf = (item) => { const at = result.items.indexOf(item), above = result.items[at - 1]; return above?.eyebrow ? { top: above.box.y, bottom: item.box.y + item.box.height } : { top: item.box.y, bottom: item.box.y + item.box.height }; };
  for (const row of [texts.slice(0, 4), texts.slice(4)]) for (const edge of ['top', 'bottom']) assert.equal(new Set(row.map((item) => Math.round(cellOf(item)[edge]))).size, 1, `a row keeps one ${edge}`);
});

test('the rows of a grid without cards fill the region as before when their needs are equal', () => {
  // At the role size (`fill: false`): LH-48 grows four short points and centers them, so their rows hug their text.
  const result = composeSlide({ title: 'Points', blocks: ['Point 1', 'Point 2', 'Point 3', 'Point 4'].map((text) => ({ text })) }, { layout: layouts.text, fill: false });
  const texts = result.items.filter((item) => item.field === 'text' && item.path.includes('.blocks.'));
  assert.equal(texts[0].box.height, texts[2].box.height, 'equal needs, equal rows');
  assert.ok(texts[2].box.y + texts[2].box.height > 650, 'the rows fill the region');
  assert.deepEqual(sizesOf(result), [28, 28, 28, 28]);
});

test('blocks below the grid read at the size of the parallel columns they continue', () => {
  const blocks = ['Lumina Foods', 'Cedarwell Properties', 'Brightpath Analytics', 'North Pier Advisory', 'RheinWorks Mobility'].map((name) => ({ text: long(name) }));
  const result = composeSlide({ title: 'Scope 3 reporting readiness', blocks }, { layout: layouts['two-column'] });
  const sizes = sizesOf(result);
  assert.equal(new Set(sizes).size, 1, `one size: ${sizes}`);
  assert.deepEqual(overflow(result), []);
  // The joint fit: the row below takes what its blocks need at the shared size and the columns keep the rest, so the shared size is
  // above the 18 px the columns were cut to when the row below was sized at the role size.
  assert.ok(sizes[0] >= 21, String(sizes[0]));
});

test("a lone primary region keeps its own size over the other blocks (a statement's message)", () => {
  const blocks = [{ text: long('Civic Arts Commission') }, ...['Measure the result.', 'Gradient backgrounds carry angle and color stops.', 'Support it with evidence.', long('Test with two teams')].map((text) => ({ text }))];
  // `fill: false`: LH-129 grows a statement whose body leaves the slide mostly empty (the message alone), which is not this rule.
  const result = composeSlide({ title: 'Grant equity review', blocks }, { layout: layouts.statement, fill: false });
  const message = result.items.find((item) => item.path === 'slides.0.blocks.0.text');
  const others = result.items.filter((item) => item.field === 'text' && item.path !== 'slides.0.blocks.0.text' && item.path.includes('.blocks.'));
  assert.ok(others.length > 0);
  // Wave 2: with LH-46 the other blocks join the statement's region as cards under the message (a lead over cards) instead of a row
  // below the grid. The message keeps the size it has alone and never takes a smaller size from the cards.
  const alone = composeSlide({ title: 'Grant equity review', blocks: blocks.slice(0, 1) }, { layout: layouts.statement, fill: false }).items.find((item) => item.path === 'slides.0.blocks.0.text');
  assert.equal(message.text.fontSize, alone.text.fontSize);
  assert.ok(others.every((item) => item.text.fontSize <= message.text.fontSize), `${message.text.fontSize} over ${others.map((item) => item.text.fontSize)}`);
});

test('sibling metrics share their value, label and description sizes', () => {
  const blocks = [
    { metric: { value: '11 days', label: 'Primary signal', description: 'Show regional patterns with maps, charts, and concise interpretation', trend: 'down' } },
    { metric: { value: 91, unit: '%', delta: '+6 pts', trend: 'up', label: 'Illustrative result' } },
    { metric: { value: '2.4x', label: 'Primary signal', description: 'Prepare a self-running lobby deck with concise navigation cues', trend: 'up' } },
    { metric: { value: '42', label: 'Inputs' } },
  ];
  const result = composeSlide({ title: 'Operating model', blocks }, { layout: layouts.metrics });
  const metrics = result.items.filter((item) => item.metricLayout);
  assert.equal(metrics.length, 4);
  // LH-53: the trend is drawn as an arrow (no text part to size); its host line shares the label's size.
  for (const role of ['value', 'label', 'description']) {
    const sizes = metrics.flatMap((item) => item.metricLayout.parts.filter((part) => part.role === role && part.visible).map((part) => part.fit.fontSize));
    assert.equal(new Set(sizes).size, 1, `${role}: ${sizes}`);
  }
  // The item's text is the value part the engines draw.
  for (const item of metrics) assert.equal(item.text.fontSize, item.metricLayout.parts.find((part) => part.role === 'value').fit.fontSize);
  assert.deepEqual(overflow(result), []);
});

test('layoutMetric roleSizes start a role below its role size; a role still fits down from there', () => {
  const box = { x: 0, y: 0, width: 600, height: 300 };
  const own = layoutMetric({ value: '42%', label: 'Adoption' }, box);
  const capped = layoutMetric({ value: '42%', label: 'Adoption' }, box, { roleSizes: { value: 50, label: 19 } });
  const size = (layout, role) => layout.parts.find((part) => part.role === role).fit.fontSize;
  assert.equal(size(own, 'value'), 76);
  assert.equal(size(capped, 'value'), 50);
  assert.equal(size(capped, 'label'), 19);
  // A start above the role size changes nothing.
  assert.equal(size(layoutMetric({ value: '42%' }, box, { roleSizes: { value: 200 } }), 'value'), 76);
});

test('a shrunk text or list takes a size of the type scale, and unshrunk blocks keep their start', () => {
  for (const [id, count] of [['text', 5], ['two-column', 4], ['three-column', 6], ['list', 3], ['agenda', 4], ['statement', 6]]) {
    for (const size of [1, 3]) {
      const blocks = Array.from({ length: count }, (_, index) => id === 'list' || id === 'agenda'
        ? { items: Array.from({ length: 3 + size * 2 }, (_, item) => `Item ${item + 1}: ${long(`Team ${index}`).slice(0, 40 * size)}`) }
        : { text: long(`Team ${index}`).repeat(size) });
      const result = composeSlide({ title: id, blocks }, { layout: layouts[id] });
      for (const item of result.items.filter((entry) => ['text', 'items', 'bullets'].includes(entry.field) && entry.path.includes('.blocks.') && !entry.listColumns)) {
        assert.ok(SCALE.includes(item.text.fontSize), `${id} x${count} (${size}): ${item.path} at ${item.text.fontSize}`);
      }
    }
  }
});

test('the scale follows a raised floor and the canvas scale, and keeps a start that is off it', () => {
  // A 20 px floor: 20, 23, 26, 30 and 35 px; a 28 px paragraph that fits keeps 28 (`fill: false`: LH-48 would grow the short body).
  const fits = composeSlide({ title: 'Short', composition: { minFontSize: 20 }, blocks: [{ text: 'A short point.' }, { text: 'Another one.' }] }, { layout: layouts['two-column'], fill: false });
  assert.deepEqual(sizesOf(fits), [28, 28]);
  const dense = composeSlide({ title: 'Dense', composition: { minFontSize: 20 }, blocks: Array.from({ length: 4 }, (_, index) => ({ text: long(`Team ${index}`).repeat(2) })) }, { layout: layouts['two-column'] });
  for (const size of sizesOf(dense)) assert.ok([20, 23, 26, 28].includes(size), String(size));
  // At 1920 x 1080 every step is 1.5 times the reference size.
  const large = composeSlide({ title: 'Dense', blocks: Array.from({ length: 6 }, (_, index) => ({ text: long(`Team ${index}`) })) }, { layout: layouts['three-column'], width: 1920, height: 1080 });
  for (const size of sizesOf(large)) assert.ok([...SCALE.map((step) => step * 1.5), 42].includes(size), String(size));
});

test('right to left: siblings share one size as they do left to right', () => {
  const blocks = ['Canyon', 'Mosaic', 'Signal', 'Inputs'].map((name, index) => ({ text: index % 2 ? 'قصير' : `${long(name)} ${'نص عربي طويل '.repeat(6)}` }));
  const result = composeSlide({ title: 'عنوان', language: 'ar', blocks }, { layout: layouts.pillars, presentation: { language: 'ar', slides: [] } });
  assert.equal(result.direction, 'rtl');
  const sizes = sizesOf(result);
  assert.equal(new Set(sizes).size, 1, `one size: ${sizes}`);
});
